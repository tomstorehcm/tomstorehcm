const path = require('path');
const db = require('../../db');
const { slugify } = require('../../utils/slug');
const { cropToFixedSize } = require('../../utils/imageProcess');

const HOURS_24 = 24 * 60 * 60 * 1000;

async function listHotDeals(req, res, next) {
  try {
    const now = new Date();
    const categories = await db('categories').orderBy('sort_order');
    const products = await db('products')
      .join('categories', 'products.category_id', 'categories.id')
      .select('products.*', 'categories.name as category_name')
      .orderBy('products.name');

    const activeProducts = products
      .filter((p) => p.is_hot_deal && p.hot_deal_expires_at && new Date(p.hot_deal_expires_at) > now)
      .sort((a, b) => a.hot_deal_sort_order - b.hot_deal_sort_order || new Date(a.hot_deal_expires_at) - new Date(b.hot_deal_expires_at) || a.id - b.id);
    const inactiveProducts = products.filter((p) => !activeProducts.includes(p));

    const sections = categories.map((cat) => ({
      category: cat,
      products: inactiveProducts.filter((p) => p.category_id === cat.id)
    }));

    res.render('admin/hotdeals', {
      title: 'Quản lý Hot Deal - TOMSTORE Admin',
      activeProducts,
      sections,
      categories,
      now,
      errors: []
    });
  } catch (err) {
    next(err);
  }
}

function parseExpiresAt(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) return null;
  return date;
}

async function enableHotDeal(req, res, next) {
  try {
    const product = await db('products').where('id', req.params.id).first();
    if (!product) return res.redirect('/admin/hot-deal');

    const salePrice = Number(req.body.salePrice);
    if (!salePrice || salePrice <= 0 || salePrice >= product.price) {
      return res.redirect('/admin/hot-deal');
    }

    const expiresAt = parseExpiresAt(req.body.expiresAt) || new Date(Date.now() + HOURS_24);

    await db('products').where('id', product.id).update({
      is_hot_deal: true,
      sale_price: salePrice,
      hot_deal_expires_at: expiresAt
    });

    res.redirect('/admin/hot-deal');
  } catch (err) {
    next(err);
  }
}

async function setHotDealExpiry(req, res, next) {
  try {
    const product = await db('products').where('id', req.params.id).first();
    if (!product) return res.redirect('/admin/hot-deal');

    const expiresAt = parseExpiresAt(req.body.expiresAt);
    if (!expiresAt) return res.redirect('/admin/hot-deal');

    await db('products').where('id', product.id).update({
      is_hot_deal: true,
      hot_deal_expires_at: expiresAt
    });

    res.redirect('/admin/hot-deal');
  } catch (err) {
    next(err);
  }
}

async function disableHotDeal(req, res, next) {
  try {
    await db('products').where('id', req.params.id).update({
      is_hot_deal: false
    });
    res.redirect('/admin/hot-deal');
  } catch (err) {
    next(err);
  }
}

async function extendHotDeal(req, res, next) {
  try {
    const product = await db('products').where('id', req.params.id).first();
    if (!product) return res.redirect('/admin/hot-deal');

    const base = product.hot_deal_expires_at && new Date(product.hot_deal_expires_at) > new Date()
      ? new Date(product.hot_deal_expires_at)
      : new Date();

    await db('products').where('id', product.id).update({
      is_hot_deal: true,
      hot_deal_expires_at: new Date(base.getTime() + HOURS_24)
    });

    res.redirect('/admin/hot-deal');
  } catch (err) {
    next(err);
  }
}

async function createStandaloneHotDeal(req, res, next) {
  try {
    if (req.fileUploadError) {
      return res.redirect('/admin/hot-deal');
    }

    const { name, categoryId, price, salePrice, expiresAt } = req.body;
    const priceNum = Number(price);
    const salePriceNum = Number(salePrice);

    if (
      !name || !categoryId ||
      !priceNum || priceNum <= 0 ||
      !salePriceNum || salePriceNum <= 0 || salePriceNum >= priceNum
    ) {
      if (req.file) {
        require('fs').unlink(
          path.join(__dirname, '..', '..', '..', 'public', 'images', 'uploads', 'products', req.file.filename),
          () => {}
        );
      }
      return res.redirect('/admin/hot-deal');
    }

    const expiry = parseExpiresAt(expiresAt) || new Date(Date.now() + HOURS_24);

    const slugBase = slugify(name);
    let slug = slugBase;
    let suffix = 1;
    while (await db('products').where('slug', slug).first()) {
      slug = `${slugBase}-${suffix++}`;
    }

    let imageUrl = null;
    if (req.file) {
      const destPath = path.join(__dirname, '..', '..', '..', 'public', 'images', 'uploads', 'products', req.file.filename);
      try {
        await cropToFixedSize(destPath, 'product');
        imageUrl = '/images/uploads/products/' + req.file.filename;
      } catch (imgErr) {
        require('fs').unlink(destPath, () => {});
      }
    }

    await db('products').insert({
      category_id: Number(categoryId),
      name,
      slug,
      price: priceNum,
      sale_price: salePriceNum,
      image_url: imageUrl,
      description: null,
      specs_json: '{}',
      in_stock: true,
      is_hot_deal: true,
      hot_deal_expires_at: expiry,
      is_featured: false,
      is_standalone_hotdeal: true
    });

    res.redirect('/admin/hot-deal');
  } catch (err) {
    next(err);
  }
}

async function moveHotDeal(req, res, next, direction) {
  try {
    const now = new Date();
    const active = await db('products')
      .where('is_hot_deal', true)
      .andWhere('hot_deal_expires_at', '>', now)
      .orderBy([{ column: 'hot_deal_sort_order', order: 'asc' }, { column: 'hot_deal_expires_at', order: 'asc' }, { column: 'id', order: 'asc' }]);

    const idx = active.findIndex((p) => p.id === Number(req.params.id));
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;

    if (idx !== -1 && swapIdx >= 0 && swapIdx < active.length) {
      // Re-normalize sort_order to the current display order first, so this
      // works even if hot_deal_sort_order was never set (defaults to 0 for all).
      const order = active.map((p) => p.id);
      const tmp = order[idx];
      order[idx] = order[swapIdx];
      order[swapIdx] = tmp;
      await Promise.all(order.map((id, i) => db('products').where('id', id).update({ hot_deal_sort_order: i })));
    }

    res.redirect('/admin/hot-deal');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listHotDeals,
  enableHotDeal,
  disableHotDeal,
  extendHotDeal,
  setHotDealExpiry,
  createStandaloneHotDeal,
  moveHotDealUp: (req, res, next) => moveHotDeal(req, res, next, 'up'),
  moveHotDealDown: (req, res, next) => moveHotDeal(req, res, next, 'down')
};
