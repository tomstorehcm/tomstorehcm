const fs = require('fs');
const path = require('path');
const { body, validationResult } = require('express-validator');
const db = require('../../db');
const { slugify } = require('../../utils/slug');

function removeUploadedFile(imageUrl) {
  if (imageUrl && imageUrl.startsWith('/images/uploads/')) {
    const filePath = path.join(__dirname, '..', '..', '..', 'public', imageUrl);
    fs.unlink(filePath, () => {});
  }
}

async function listProducts(req, res, next) {
  try {
    const products = await db('products')
      .join('categories', 'products.category_id', 'categories.id')
      .select('products.*', 'categories.name as category_name')
      .orderBy('products.created_at', 'desc');

    res.render('admin/products', {
      title: 'Quản lý sản phẩm - TOMSTORE Admin',
      products
    });
  } catch (err) {
    next(err);
  }
}

async function newProductForm(req, res, next) {
  try {
    const categories = await db('categories').orderBy('sort_order');
    res.render('admin/product-form', {
      title: 'Thêm sản phẩm - TOMSTORE Admin',
      categories,
      product: {},
      specsText: '',
      errors: [],
      isEdit: false
    });
  } catch (err) {
    next(err);
  }
}

const productValidators = [
  body('name').trim().notEmpty().withMessage('Vui lòng nhập tên sản phẩm'),
  body('categoryId').isInt().withMessage('Vui lòng chọn danh mục'),
  body('price').isInt({ min: 0 }).withMessage('Giá phải là số nguyên >= 0'),
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

    if (!errors.isEmpty()) {
      if (req.file) removeUploadedFile('/images/uploads/products/' + req.file.filename);
      return res.status(400).render('admin/product-form', {
        title: 'Thêm sản phẩm - TOMSTORE Admin',
        categories,
        product: req.body,
        specsText: req.body.specsText || '',
        errors: errors.array(),
        isEdit: false
      });
    }

    const slugBase = slugify(req.body.name);
    let slug = slugBase;
    let suffix = 1;
    while (await db('products').where('slug', slug).first()) {
      slug = `${slugBase}-${suffix++}`;
    }

    const imageUrl = req.file ? '/images/uploads/products/' + req.file.filename : (req.body.imageUrl || null);

    await db('products').insert({
      category_id: Number(req.body.categoryId),
      name: req.body.name,
      slug,
      brand: req.body.brand || null,
      price: Number(req.body.price),
      sale_price: req.body.salePrice ? Number(req.body.salePrice) : null,
      image_url: imageUrl,
      description: req.body.description || null,
      specs_json: JSON.stringify(parseSpecsText(req.body.specsText)),
      stock: Number(req.body.stock),
      is_featured: req.body.isFeatured === 'on'
    });

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
    res.render('admin/product-form', {
      title: 'Sửa sản phẩm - TOMSTORE Admin',
      categories,
      product,
      specsText: specsToText(product.specs_json),
      errors: [],
      isEdit: true
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

    if (!errors.isEmpty()) {
      if (req.file) removeUploadedFile('/images/uploads/products/' + req.file.filename);
      return res.status(400).render('admin/product-form', {
        title: 'Sửa sản phẩm - TOMSTORE Admin',
        categories,
        product: { ...product, ...req.body, id: product.id },
        specsText: req.body.specsText || '',
        errors: errors.array(),
        isEdit: true
      });
    }

    let imageUrl = product.image_url;
    if (req.file) {
      removeUploadedFile(product.image_url);
      imageUrl = '/images/uploads/products/' + req.file.filename;
    } else if (req.body.imageUrl !== undefined) {
      imageUrl = req.body.imageUrl || null;
    }

    await db('products').where('id', product.id).update({
      category_id: Number(req.body.categoryId),
      name: req.body.name,
      brand: req.body.brand || null,
      price: Number(req.body.price),
      sale_price: req.body.salePrice ? Number(req.body.salePrice) : null,
      image_url: imageUrl,
      description: req.body.description || null,
      specs_json: JSON.stringify(parseSpecsText(req.body.specsText)),
      stock: Number(req.body.stock),
      is_featured: req.body.isFeatured === 'on'
    });

    res.redirect('/admin/san-pham');
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
