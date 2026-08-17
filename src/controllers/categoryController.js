const db = require('../db');

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

    let query = db('products').where('category_id', category.id);
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

    const products = await query;

    res.render('category', {
      title: `${category.name} - TOMSTORE`,
      category,
      products,
      sort
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { showCategory };
