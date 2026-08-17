const fs = require('fs');
const path = require('path');
const { body, validationResult } = require('express-validator');
const db = require('../../db');
const { slugify } = require('../../utils/slug');
const { cropToFixedSize } = require('../../utils/imageProcess');

const IMAGE_ERROR_MESSAGE = 'Ảnh không hợp lệ hoặc bị lỗi khi xử lý. Vui lòng thử lại với file JPG/PNG/GIF/WEBP khác.';

function removeUploadedFile(imageUrl) {
  if (imageUrl && imageUrl.startsWith('/images/uploads/')) {
    const filePath = path.join(__dirname, '..', '..', '..', 'public', imageUrl);
    fs.unlink(filePath, () => {});
  }
}

async function getPolicyFormData() {
  const policyGroups = await db('policy_groups').orderBy('sort_order');
  const allPolicies = await db('policies').orderBy('sort_order');
  return { policyGroups, allPolicies };
}

async function getSelectedPolicyIds(productId) {
  return db('product_policies').where('product_id', productId).pluck('policy_id');
}

async function syncProductPolicies(productId, policyGroupId, policyIds) {
  await db('products').where('id', productId).update({ policy_group_id: policyGroupId });
  await db('product_policies').where('product_id', productId).del();
  if (!policyGroupId && policyIds.length > 0) {
    await db('product_policies').insert(policyIds.map((policyId) => ({ product_id: productId, policy_id: policyId })));
  }
}

function parsePolicyIds(body) {
  return [].concat(body.policyIds || []).map(Number).filter((n) => !Number.isNaN(n));
}

function parseVariantRows(body) {
  const labels = [].concat(body.variantLabel || []);
  const prices = [].concat(body.variantPrice || []);
  const inStocks = [].concat(body.variantInStock || []);
  const rows = [];
  for (let i = 0; i < labels.length; i++) {
    const label = (labels[i] || '').trim();
    const price = Number(String(prices[i] || '').replace(/\D/g, ''));
    if (!label || Number.isNaN(price)) continue;
    rows.push({
      label,
      price,
      inStock: inStocks[i] !== '0'
    });
  }
  return rows;
}

async function syncProductVariants(productId, variantRows) {
  await db('product_variants').where('product_id', productId).del();
  if (variantRows.length === 0) return [];
  await db('product_variants').insert(
    variantRows.map((v, i) => ({
      product_id: productId,
      label: v.label,
      price: v.price,
      in_stock: v.inStock,
      sort_order: i
    }))
  );
  // Colors reference variants positionally (colorVariantIndex) since new variant
  // ids aren't known until after this insert -- re-fetch in the same sort_order
  // to map each position back to its real id.
  const inserted = await db('product_variants').where('product_id', productId).orderBy('sort_order');
  return inserted.map((v) => v.id);
}

async function parseColorRows(body, files) {
  const names = [].concat(body.colorName || []);
  const hexes = [].concat(body.colorHex || []);
  const inStocks = [].concat(body.colorInStock || []);
  const imageUrls = [].concat(body.colorImageUrl || []);
  const prices = [].concat(body.colorPrice || []);
  const variantIndexes = [].concat(body.colorVariantIndex || []);
  const rows = [];
  for (let i = 0; i < names.length; i++) {
    const name = (names[i] || '').trim();
    if (!name) continue;
    const hex = /^#[0-9a-fA-F]{6}$/.test(hexes[i]) ? hexes[i] : '#000000';
    let imageUrl = imageUrls[i] || null;

    const fileArr = files && files['colorImage_' + i];
    const file = fileArr && fileArr[0];
    if (file) {
      const destPath = path.join(__dirname, '..', '..', '..', 'public', 'images', 'uploads', 'products', file.filename);
      try {
        const finalFilename = await cropToFixedSize(destPath, 'product');
        if (imageUrl) removeUploadedFile(imageUrl);
        imageUrl = '/images/uploads/products/' + finalFilename;
      } catch (imgErr) {
        removeUploadedFile('/images/uploads/products/' + file.filename);
      }
    }

    const priceDigits = String(prices[i] || '').replace(/\D/g, '');
    const variantIndex = variantIndexes[i] !== undefined && variantIndexes[i] !== '' ? Number(variantIndexes[i]) : null;

    rows.push({
      name,
      hex,
      inStock: inStocks[i] !== '0',
      imageUrl,
      price: priceDigits ? Number(priceDigits) : null,
      variantIndex
    });
  }
  return rows;
}

async function syncProductColors(productId, colorRows, variantIds) {
  await db('product_colors').where('product_id', productId).del();
  if (colorRows.length > 0) {
    await db('product_colors').insert(
      colorRows.map((c, i) => ({
        product_id: productId,
        variant_id: c.variantIndex !== null && variantIds[c.variantIndex] !== undefined ? variantIds[c.variantIndex] : null,
        name: c.name,
        hex_code: c.hex,
        price: c.price,
        in_stock: c.inStock,
        image_url: c.imageUrl,
        sort_order: i
      }))
    );
  }
}

const MAX_GALLERY_IMAGES = 8;

// Only used at product creation, when there are no existing gallery images
// yet -- editing an existing product's gallery still goes through the
// separate upload form on the edit page.
async function syncGalleryImages(productId, files) {
  const filesToUse = files.slice(0, MAX_GALLERY_IMAGES);
  files.slice(MAX_GALLERY_IMAGES).forEach((file) => removeUploadedFile('/images/uploads/products/' + file.filename));

  let sortOrder = 0;
  for (const file of filesToUse) {
    const destPath = path.join(__dirname, '..', '..', '..', 'public', 'images', 'uploads', 'products', file.filename);
    try {
      const finalFilename = await cropToFixedSize(destPath, 'product');
      await db('product_images').insert({
        product_id: productId,
        image_url: '/images/uploads/products/' + finalFilename,
        sort_order: sortOrder++
      });
    } catch (imgErr) {
      removeUploadedFile('/images/uploads/products/' + file.filename);
    }
  }
}

async function listProducts(req, res, next) {
  try {
    const categories = await db('categories').orderBy('sort_order');
    const products = await db('products')
      .join('categories', 'products.category_id', 'categories.id')
      .select('products.*', 'categories.name as category_name')
      .orderBy([
        { column: 'products.category_sort_order', order: 'asc' },
        { column: 'products.created_at', order: 'desc' },
        { column: 'products.id', order: 'asc' }
      ]);

    const standaloneProducts = products.filter((p) => p.is_standalone_hotdeal);
    const catalogProducts = products.filter((p) => !p.is_standalone_hotdeal);

    const sections = categories.map((cat) => ({
      category: cat,
      products: catalogProducts.filter((p) => p.category_id === cat.id)
    }));

    res.render('admin/products', {
      title: 'Quản lý sản phẩm - TOMSTORE Admin',
      sections,
      standaloneProducts,
      totalCount: products.length
    });
  } catch (err) {
    next(err);
  }
}

async function newProductForm(req, res, next) {
  try {
    const categories = await db('categories').orderBy('sort_order');
    const { policyGroups, allPolicies } = await getPolicyFormData();
    res.render('admin/product-form', {
      title: 'Thêm sản phẩm - TOMSTORE Admin',
      categories,
      product: {},
      specsText: '',
      errors: [],
      isEdit: false,
      galleryImages: [],
      policyGroups,
      allPolicies,
      selectedPolicyIds: [],
      variants: [],
      colors: []
    });
  } catch (err) {
    next(err);
  }
}

const productValidators = [
  body('name').trim().notEmpty().withMessage('Vui lòng nhập tên sản phẩm'),
  body('categoryId').isInt().withMessage('Vui lòng chọn danh mục'),
  body('price')
    .if((value, { req }) => req.body.isContactPrice !== 'on')
    .isInt({ min: 0 }).withMessage('Giá phải là số nguyên >= 0'),
  body('salePrice').optional({ checkFalsy: true }).isInt({ min: 0 }).withMessage('Giá khuyến mãi không hợp lệ')
];

function parseSpecsText(text) {
  const specs = {};
  if (!text) return specs;
  text.split('\n').forEach((line) => {
    const idx = line.indexOf(':');
    if (idx > -1) {
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (key) specs[key] = value;
    }
  });
  return specs;
}

function specsToText(specsJson) {
  try {
    const specs = specsJson ? JSON.parse(specsJson) : {};
    return Object.entries(specs).map(([k, v]) => `${k}: ${v}`).join('\n');
  } catch (e) {
    return '';
  }
}

async function createProduct(req, res, next) {
  try {
    const errors = validationResult(req);
    const categories = await db('categories').orderBy('sort_order');
    const { policyGroups, allPolicies } = await getPolicyFormData();
    const selectedPolicyIds = parsePolicyIds(req.body);
    const variantRows = parseVariantRows(req.body);
    const colorRows = await parseColorRows(req.body, req.files);
    const mainImageFile = req.files && req.files.imageFile && req.files.imageFile[0];

    if (req.fileUploadError) {
      return res.status(400).render('admin/product-form', {
        title: 'Thêm sản phẩm - TOMSTORE Admin',
        categories,
        product: req.body,
        specsText: req.body.specsText || '',
        errors: [{ msg: req.fileUploadError }],
        isEdit: false,
        galleryImages: [],
        policyGroups,
        allPolicies,
        selectedPolicyIds,
        variants: variantRows,
        colors: colorRows
      });
    }

    if (!errors.isEmpty()) {
      if (mainImageFile) removeUploadedFile('/images/uploads/products/' + mainImageFile.filename);
      return res.status(400).render('admin/product-form', {
        title: 'Thêm sản phẩm - TOMSTORE Admin',
        categories,
        product: req.body,
        specsText: req.body.specsText || '',
        errors: errors.array(),
        isEdit: false,
        galleryImages: [],
        policyGroups,
        allPolicies,
        selectedPolicyIds,
        variants: variantRows,
        colors: colorRows
      });
    }

    const slugBase = slugify(req.body.name);
    let slug = slugBase;
    let suffix = 1;
    while (await db('products').where('slug', slug).first()) {
      slug = `${slugBase}-${suffix++}`;
    }

    let imageUrl = req.body.imageUrl || null;
    if (mainImageFile) {
      const destPath = path.join(__dirname, '..', '..', '..', 'public', 'images', 'uploads', 'products', mainImageFile.filename);
      let finalFilename;
      try {
        finalFilename = await cropToFixedSize(destPath, 'product');
      } catch (imgErr) {
        removeUploadedFile('/images/uploads/products/' + mainImageFile.filename);
        return res.status(400).render('admin/product-form', {
          title: 'Thêm sản phẩm - TOMSTORE Admin',
          categories,
          product: req.body,
          specsText: req.body.specsText || '',
          errors: [{ msg: IMAGE_ERROR_MESSAGE }],
          isEdit: false,
          galleryImages: [],
          policyGroups,
          allPolicies,
          selectedPolicyIds,
          variants: variantRows,
          colors: colorRows
        });
      }
      imageUrl = '/images/uploads/products/' + finalFilename;
    }

    const isContactPrice = req.body.isContactPrice === 'on';

    const [insertedRaw] = await db('products').insert({
      category_id: Number(req.body.categoryId),
      name: req.body.name,
      slug,
      brand: req.body.brand || null,
      price: isContactPrice ? (Number(req.body.price) || 0) : Number(req.body.price),
      sale_price: isContactPrice ? null : (req.body.salePrice ? Number(req.body.salePrice) : null),
      is_contact_price: isContactPrice,
      image_url: imageUrl,
      description: req.body.description || null,
      specs_json: JSON.stringify(parseSpecsText(req.body.specsText)),
      in_stock: req.body.outOfStock !== 'on',
      is_featured: req.body.isFeatured === 'on'
    });
    const insertedId = insertedRaw && insertedRaw.id ? insertedRaw.id : insertedRaw;

    const policyGroupId = req.body.policyGroupId ? Number(req.body.policyGroupId) : null;
    await syncProductPolicies(insertedId, policyGroupId, selectedPolicyIds);
    const variantIds = await syncProductVariants(insertedId, variantRows);
    await syncProductColors(insertedId, colorRows, variantIds);
    await syncGalleryImages(insertedId, (req.files && req.files.images) || []);

    res.redirect('/admin/san-pham');
  } catch (err) {
    next(err);
  }
}

async function editProductForm(req, res, next) {
  try {
    const product = await db('products').where('id', req.params.id).first();
    if (!product) return res.redirect('/admin/san-pham');

    const categories = await db('categories').orderBy('sort_order');
    const galleryImages = await db('product_images').where('product_id', product.id).orderBy('sort_order');
    const { policyGroups, allPolicies } = await getPolicyFormData();
    const selectedPolicyIds = await getSelectedPolicyIds(product.id);
    const variants = await db('product_variants').where('product_id', product.id).orderBy('sort_order');
    const colors = await db('product_colors').where('product_id', product.id).orderBy('sort_order');
    res.render('admin/product-form', {
      title: 'Sửa sản phẩm - TOMSTORE Admin',
      categories,
      product,
      specsText: specsToText(product.specs_json),
      errors: [],
      isEdit: true,
      galleryImages,
      policyGroups,
      allPolicies,
      selectedPolicyIds,
      variants,
      colors
    });
  } catch (err) {
    next(err);
  }
}

async function updateProduct(req, res, next) {
  try {
    const product = await db('products').where('id', req.params.id).first();
    if (!product) return res.redirect('/admin/san-pham');

    const errors = validationResult(req);
    const categories = await db('categories').orderBy('sort_order');
    const { policyGroups, allPolicies } = await getPolicyFormData();
    const selectedPolicyIds = parsePolicyIds(req.body);
    const variantRows = parseVariantRows(req.body);
    const colorRows = await parseColorRows(req.body, req.files);

    if (!errors.isEmpty()) {
      const galleryImages = await db('product_images').where('product_id', product.id).orderBy('sort_order');
      return res.status(400).render('admin/product-form', {
        title: 'Sửa sản phẩm - TOMSTORE Admin',
        categories,
        product: { ...product, ...req.body, id: product.id },
        specsText: req.body.specsText || '',
        errors: errors.array(),
        isEdit: true,
        galleryImages,
        policyGroups,
        allPolicies,
        selectedPolicyIds,
        variants: variantRows,
        colors: colorRows
      });
    }

    const isContactPrice = req.body.isContactPrice === 'on';

    await db('products').where('id', product.id).update({
      category_id: Number(req.body.categoryId),
      name: req.body.name,
      brand: req.body.brand || null,
      price: isContactPrice ? (Number(req.body.price) || 0) : Number(req.body.price),
      sale_price: isContactPrice ? null : (req.body.salePrice ? Number(req.body.salePrice) : null),
      is_contact_price: isContactPrice,
      description: req.body.description || null,
      specs_json: JSON.stringify(parseSpecsText(req.body.specsText)),
      in_stock: req.body.outOfStock !== 'on',
      is_featured: req.body.isFeatured === 'on'
    });

    const policyGroupId = req.body.policyGroupId ? Number(req.body.policyGroupId) : null;
    await syncProductPolicies(product.id, policyGroupId, selectedPolicyIds);
    const variantIds = await syncProductVariants(product.id, variantRows);
    await syncProductColors(product.id, colorRows, variantIds);

    res.redirect('/admin/san-pham/' + product.id + '/sua');
  } catch (err) {
    next(err);
  }
}

async function deleteProduct(req, res, next) {
  try {
    const product = await db('products').where('id', req.params.id).first();
    await db('products').where('id', req.params.id).del();
    if (product) removeUploadedFile(product.image_url);
    res.redirect('/admin/san-pham');
  } catch (err) {
    next(err);
  }
}

async function moveProductInCategory(req, res, next, direction) {
  try {
    const product = await db('products').where('id', req.params.id).first();
    if (!product) return res.redirect('/admin/san-pham');

    const siblings = await db('products')
      .where('category_id', product.category_id)
      .where('is_standalone_hotdeal', false)
      .orderBy([
        { column: 'category_sort_order', order: 'asc' },
        { column: 'created_at', order: 'desc' },
        { column: 'id', order: 'asc' }
      ]);

    const idx = siblings.findIndex((p) => p.id === product.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;

    if (idx !== -1 && swapIdx >= 0 && swapIdx < siblings.length) {
      // Re-normalize to the current display order first, so this works even
      // if category_sort_order was never set (defaults to 0 for everyone).
      const order = siblings.map((p) => p.id);
      const tmp = order[idx];
      order[idx] = order[swapIdx];
      order[swapIdx] = tmp;
      await Promise.all(order.map((id, i) => db('products').where('id', id).update({ category_sort_order: i })));
    }

    res.redirect('/admin/san-pham');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listProducts,
  newProductForm,
  productValidators,
  createProduct,
  editProductForm,
  updateProduct,
  deleteProduct,
  moveProductUp: (req, res, next) => moveProductInCategory(req, res, next, 'up'),
  moveProductDown: (req, res, next) => moveProductInCategory(req, res, next, 'down')
};
