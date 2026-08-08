const db = require('../db');

async function showHome(req, res, next) {
  try {
    const now = new Date();

    const hotDeals = await db('products')
      .where('is_hot_deal', true)
      .andWhere('hot_deal_expires_at', '>', now)
      .orderBy('hot_deal_expires_at', 'asc');

    const categories = await db('categories').orderBy('sort_order');

    const sections = [];
    for (const cat of categories) {
      const products = await db('products')
        .where('category_id', cat.id)
        .orderBy('created_at', 'desc')
        .limit(8);
      sections.push({ category: cat, products });
    }

    res.render('home', {
      title: 'TOMSTORE - Điện thoại, MacBook, Máy tính bảng, Tai nghe chính hãng',
      hotDeals,
      sections
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { showHome };
