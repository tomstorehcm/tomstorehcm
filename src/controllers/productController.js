const db = require('../db');
const { getPoliciesForProduct } = require('../services/policies');
const { attachFallbackImages } = require('../utils/productImages');

async function showProduct(req, res, next) {
  try {
    const product = await db('products').where('slug', req.params.slug).first();
    if (!product) {
      return res.status(404).render('error', {
        title: 'Không tìm thấy sản phẩm',
        statusCode: 404,
        message: 'Sản phẩm bạn tìm không tồn tại hoặc đã ngừng kinh doanh.'
      });
    }

    const category = await db('categories').where('id', product.category_id).first();

    const related = await db('products')
      .where('category_id', product.category_id)
      .andWhereNot('id', product.id)
      .limit(4);
    await attachFallbackImages(related);

    const galleryImages = await db('product_images')
      .where('product_id', product.id)
      .orderBy('sort_order');

    const variants = await db('product_variants')
      .where('product_id', product.id)
      .orderBy('sort_order');

    const colors = await db('product_colors')
      .where('product_id', product.id)
      .orderBy('sort_order');

    // Colors tied to a specific variant (capacity) get their own price and only
    // show up when that capacity is selected; colors with no variant_id are
    // "general" colors that apply regardless of capacity (no price of their own).
    variants.forEach((v) => {
      v.colors = colors.filter((c) => c.variant_id === v.id);
    });
    const generalColors = colors.filter((c) => !c.variant_id);

    const images = [];
    if (product.image_url) images.push(product.image_url);
    galleryImages.forEach((img) => images.push(img.image_url));

    let specs = {};
    try {
      specs = product.specs_json ? JSON.parse(product.specs_json) : {};
    } catch (e) {
      specs = {};
    }

    const policies = await getPoliciesForProduct(product);

    res.render('product', {
      title: `${product.name} - TOMSTORE`,
      product,
      category,
      related,
      specs,
      images,
      policies,
      variants,
      colors,
      generalColors
    });
  } catch (err) {
    next(err);
  }
}

async function searchProducts(req, res, next) {
  try {
    const q = (req.query.q || '').trim();
    let products = [];
    if (q) {
      products = await db('products').where('name', 'like', `%${q}%`).orderBy('created_at', 'desc');
      await attachFallbackImages(products);
    }

    res.render('search', {
      title: `Kết quả tìm kiếm "${q}" - TOMSTORE`,
      q,
      products
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { showProduct, searchProducts };
