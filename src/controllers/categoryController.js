const db = require('../db');
const { attachFallbackImages } = require('../utils/productImages');

async function productsForCategoryIds(categoryIds, sort) {
  let query = db('products').whereIn('category_id', categoryIds);
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

function resolveSort(query) {
  return query.sort === 'price_asc' || query.sort === 'price_desc' ? query.sort : 'newest';
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

    const sort = resolveSort(req.query);

    // "Điện thoại cũ 99%" and "Samsung" are hidden from the homepage tiles but
    // browsable as tabs within "Điện thoại" instead of their own separate page.
    // Categories that belong to an explicit nav group (nav_group_key, e.g.
    // "Phụ kiện" for Tai nghe + Apple Watch) are NOT merged as tabs here --
    // each category page (vd /danh-muc/apple-watch) only shows its own
    // products. "Xem tất cả" trong dropdown mới là nơi gộp cả nhóm lại
    // (xem showNavGroup bên dưới).
    let relatedCategories = [];
    if (category.slug === 'dien-thoai') {
      relatedCategories = await db('categories')
        .where('show_on_homepage', false)
        .whereNull('nav_group_key')
        .orderBy('sort_order');
    }

    const tabCategories = [category, ...relatedCategories];
    const tabGroups = await Promise.all(
      tabCategories.map(async (cat) => ({
        category: cat,
        products: await productsForCategoryIds([cat.id], sort)
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

// "Xem tất cả" from a nav dropdown (e.g. /nhom/phu-kien) -- merges every
// category sharing a nav_group_key into one plain product grid (no tabs).
async function showNavGroup(req, res, next) {
  try {
    const groupCategories = await db('categories')
      .where('nav_group_key', req.params.key)
      .orderBy('sort_order');

    if (groupCategories.length === 0) {
      return res.status(404).render('error', {
        title: 'Không tìm thấy danh mục',
        statusCode: 404,
        message: 'Danh mục bạn tìm không tồn tại.'
      });
    }

    const label = groupCategories[0].nav_group_label || groupCategories.map((c) => c.name).join(' & ');
    const sort = resolveSort(req.query);
    const products = await productsForCategoryIds(groupCategories.map((c) => c.id), sort);
    await attachFallbackImages(products);

    res.render('category', {
      title: `${label} - TOMSTORE`,
      category: { name: label, slug: req.params.key },
      products,
      sort,
      tabGroups: []
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { showCategory, showNavGroup };
