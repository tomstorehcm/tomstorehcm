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
  const stocks = [].concat(body.variantStock || []);
  const rows = [];
  for (let i = 0; i < labels.length; i++) {
    const label = (labels[i] || '').trim();
    const price = Number(String(prices[i] || '').replace(/\D/g, ''));
    if (!label || Number.isNaN(price)) continue;
    rows.push({
      label,
      price,
      stock: Math.max(0, Number(stocks[i]) || 0)
    });
  }
  return rows;
}

async function syncProductVariants(productId, variantRows) {
  await db('product_variants').where('product_id', productId).del();
  if (variantRows.length > 0) {
    await db('product_variants').insert(
      variantRows.map((v, i) => ({
        product_id: productId,
        label: v.label,
        price: v.price,
        stock: v.stock,
        sort_order: i
      }))
    );
  }
}

async function listProducts(req, res, next) {
  try {
    const categories = await db('categories').orderBy('sort_order');
    const products = await db('products')
      .join('categories', 'products.category_id', 'categories.id')
      .select('products.*', 'categories.name as category_name')
      .orderBy('products.created_at', 'desc');

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
      variants: []
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
  body('salePrice').optional({ checkFalsy: true }).isInt({ min: 0 }).withMessage('Giá khuyến mãi không hợp lệ'),
  body('stock').isInt({ min: 0 }).withMessage('Tồn kho phải là số nguyên >= 0')
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
        variants: variantRows
      });
    }

    if (!errors.isEmpty()) {
      if (req.file) removeUploadedFile('/images/uploads/products/' + req.file.filename);
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
        variants: variantRows
      });
    }

    const slugBase = slugify(req.body.name);
    let slug = slugBase;
    let suffix = 1;
    while (await db('products').where('slug', slug).first()) {
      slug = `${slugBase}-${suffix++}`;
    }

    let imageUrl = req.body.imageUrl || null;
    if (req.file) {
      const destPath = path.join(__dirname, '..', '..', '..', 'public', 'images', 'uploads', 'products', req.file.filename);
      try {
        await cropToFixedSize(destPath, 'product');
      } catch (imgErr) {
        removeUploadedFile('/images/uploads/products/' + req.file.filename);
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
          variants: variantRows
        });
      }
      imageUrl = '/images/uploads/products/' + req.file.filename;
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
      stock: Number(req.body.stock),
      is_featured: req.body.isFeatured === 'on'
    });
    const insertedId = insertedRaw && insertedRaw.id ? insertedRaw.id : insertedRaw;

    const policyGroupId = req.body.policyGroupId ? Number(req.body.policyGroupId) : null;
    await syncProductPolicies(insertedId, policyGroupId, selectedPolicyIds);
    await syncProductVariants(insertedId, variantRows);

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
      variants
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
        variants: variantRows
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
      stock: Number(req.body.stock),
      is_featured: req.body.isFeatured === 'on'
    });

    const policyGroupId = req.body.policyGroupId ? Number(req.body.policyGroupId) : null;
    await syncProductPolicies(product.id, policyGroupId, selectedPolicyIds);
    await syncProductVariants(product.id, variantRows);

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

module.exports = {
  listProducts,
  newProductForm,
  productValidators,
  createProduct,
  editProductForm,
  updateProduct,
  deleteProduct
};
