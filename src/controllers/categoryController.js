const db = require('../db');
const { attachFallbackImages } = require('../utils/productImages');

async function productsForCategory(categoryId, sort) {
  let query = db('products').where('category_id', categoryId);
  if (sort === 'price_asc') {
    query = query.orderByRaw('COALESCE(sale_price, price) asc');
  } else if (sort === 'price_desc') {
    query = query.orderByRaw('COALESCE(sale_price, price) desc');
  } else {
    query = query.orderBy([
      { column: 'category_sort_order', order: 'asc' },
      { column: 'created_at', order: 'desc' },
      { column: 'id', order: 'asc' }
    ]);
  }
  return query;
}

async function showCategory(req, res, next) {
  try {
    const category = await db('categories').where('slug', req.params.slug).first();
    if (!category) {
      return res.status(404).render('error', {
        title: 'Không tìm thấy danh mục',
        statusCode: 404,
        message: 'Danh mục bạn tìm không tồn tại.'
      });
    }

    const sort = req.query.sort === 'price_asc' || req.query.sort === 'price_desc'
      ? req.query.sort
      : 'newest';

    // "Điện thoại cũ 99%" and "Samsung" are hidden from the homepage tiles but
    // browsable as tabs within "Điện thoại" instead of their own separate page.
    const relatedCategories = category.slug === 'dien-thoai'
      ? await db('categories').where('show_on_homepage', false).orderBy('sort_order')
      : [];

    const tabCategories = [category, ...relatedCategories];
    const tabGroups = await Promise.all(
      tabCategories.map(async (cat) => ({
        category: cat,
        products: await productsForCategory(cat.id, sort)
      }))
    );

    await attachFallbackImages(tabGroups.flatMap((g) => g.products));

    res.render('category', {
      title: `${category.name} - TOMSTORE`,
      category,
      products: tabGroups[0].products,
      sort,
      tabGroups
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { showCategory };
