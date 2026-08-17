const db = require('../db');

async function showHome(req, res, next) {
  try {
    const now = new Date();

    const banners = await db('banners').where('is_active', true).where('type', 'hero').orderBy('sort_order');
    const featuredBanner = await db('banners').where('type', 'featured').first();

    const hotDeals = await db('products')
      .where('is_hot_deal', true)
      .andWhere('hot_deal_expires_at', '>', now)
      .orderBy([{ column: 'hot_deal_sort_order', order: 'asc' }, { column: 'hot_deal_expires_at', order: 'asc' }, { column: 'id', order: 'asc' }]);

    const categories = await db('categories').orderBy('sort_order');
    const homeCategories = categories.filter((c) => c.show_on_homepage);

    let featuredProducts = await db('products').where('is_featured', true).limit(8);
    if (featuredProducts.length === 0) {
      featuredProducts = await db('products').orderBy('created_at', 'desc').limit(8);
    }

    const sections = [];
    for (const cat of categories) {
      const products = await db('products')
        .where('category_id', cat.id)
        .orderBy([
          { column: 'category_sort_order', order: 'asc' },
          { column: 'created_at', order: 'desc' },
          { column: 'id', order: 'asc' }
        ])
        .limit(8);
      sections.push({ category: cat, products });
    }

    res.render('home', {
      title: 'TOMSTORE - Chuyên các sản phẩm Apple: iPhone, MacBook, iPad, AirPods chính hãng',
      banners,
      featuredBanner,
      hotDeals,
      categories,
      homeCategories,
      featuredProducts,
      sections
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { showHome };
