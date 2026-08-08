const db = require('../../db');

const HOURS_24 = 24 * 60 * 60 * 1000;

async function listHotDeals(req, res, next) {
  try {
    const products = await db('products')
      .join('categories', 'products.category_id', 'categories.id')
      .select('products.*', 'categories.name as category_name')
      .orderBy('products.is_hot_deal', 'desc')
      .orderBy('products.name');

    res.render('admin/hotdeals', {
      title: 'Quản lý Hot Deal - TOMSTORE Admin',
      products,
      now: new Date()
    });
  } catch (err) {
    next(err);
  }
}

async function enableHotDeal(req, res, next) {
  try {
    const product = await db('products').where('id', req.params.id).first();
    if (!product) return res.redirect('/admin/hot-deal');

    const salePrice = Number(req.body.salePrice);
    if (!salePrice || salePrice <= 0 || salePrice >= product.price) {
      return res.redirect('/admin/hot-deal');
    }

    await db('products').where('id', product.id).update({
      is_hot_deal: true,
      sale_price: salePrice,
      hot_deal_expires_at: new Date(Date.now() + HOURS_24)
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

module.exports = { listHotDeals, enableHotDeal, disableHotDeal, extendHotDeal };
