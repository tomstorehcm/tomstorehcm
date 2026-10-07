const path = require('path');
const fs = require('fs');
const sanitizeHtml = require('sanitize-html');
const db = require('../../db');
const { STATUSES, STATUS_KEYS } = require('../../utils/tradeInStatus');
const { cropToFixedSize, resizeToMaxWidth } = require('../../utils/imageProcess');

const CONTENT_IMAGE_MAX_WIDTH = 1000;

const IMAGE_ERROR_MESSAGE = 'Ảnh không hợp lệ hoặc bị lỗi khi xử lý. Vui lòng thử lại với file JPG/PNG/GIF/WEBP khác.';

function removeUploadedFile(imageUrl) {
  if (imageUrl && imageUrl.startsWith('/images/uploads/')) {
    const filePath = path.join(__dirname, '..', '..', '..', 'public', imageUrl);
    fs.unlink(filePath, () => {});
  }
}

// ---------- Trade-in products (may TOM nhan thu lai) ----------

async function listTradeInProducts(req, res, next) {
  try {
    const categories = await db('categories').orderBy('sort_order');
    const products = await db('trade_in_products').orderBy(['sort_order', 'id']);
    const conditionCounts = await db('trade_in_conditions')
      .select('trade_in_product_id')
      .count('* as count')
      .groupBy('trade_in_product_id');
    const countByProduct = {};
    conditionCounts.forEach((row) => { countByProduct[row.trade_in_product_id] = Number(row.count); });

    const categoryById = {};
    categories.forEach((c) => { categoryById[c.id] = c; });

    const rows = products.map((p) => ({
      ...p,
      category_name: p.category_id && categoryById[p.category_id] ? categoryById[p.category_id].name : '(Không có danh mục)',
      condition_count: countByProduct[p.id] || 0
    }));

    res.render('admin/trade-in-products', {
      title: 'Sản phẩm thu cũ (Trade-in) - TOMSTORE Admin',
      rows
    });
  } catch (err) {
    next(err);
  }
}

function parseConditionRows(body) {
  const labels = [].concat(body.conditionLabel || []);
  const descriptions = [].concat(body.conditionDescription || []);
  const prices = [].concat(body.conditionPrice || []);
  const rows = [];
  for (let i = 0; i < labels.length; i++) {
    const label = (labels[i] || '').trim();
    const price = Number(String(prices[i] || '').replace(/\D/g, ''));
    if (!label || Number.isNaN(price)) continue;
    rows.push({ label, description: (descriptions[i] || '').trim() || null, price });
  }
  return rows;
}

// Danh sach "nguon de copy muc tinh trang" -- cac san pham thu cu da co san
// kem day du cac dong tinh trang (label/mo ta/gia), de admin chon 1 san pham
// giong (vd cung dong may) roi copy nguyen bo tinh trang sang san pham dang
// them/sua, do nhieu may co bo muc tinh trang + gia giong nhau. Chi lay cac
// san pham DA CO it nhat 1 muc tinh trang (khong co gi de copy thi bo qua).
async function getTradeInCopySources(excludeId) {
  const products = await db('trade_in_products')
    .modify((qb) => { if (excludeId) qb.whereNot('id', excludeId); })
    .orderBy('name');
  if (products.length === 0) return [];

  const productIds = products.map((p) => p.id);
  const allConditions = await db('trade_in_conditions')
    .whereIn('trade_in_product_id', productIds)
    .orderBy(['trade_in_product_id', 'sort_order']);

  const conditionsByProduct = {};
  allConditions.forEach((c) => {
    if (!conditionsByProduct[c.trade_in_product_id]) conditionsByProduct[c.trade_in_product_id] = [];
    conditionsByProduct[c.trade_in_product_id].push({ label: c.label, description: c.description, price: c.price });
  });

  return products
    .map((p) => ({ id: p.id, name: p.name, conditions: conditionsByProduct[p.id] || [] }))
    .filter((p) => p.conditions.length > 0);
}

async function syncTradeInConditions(tradeInProductId, rows) {
  await db('trade_in_conditions').where('trade_in_product_id', tradeInProductId).del();
  if (rows.length === 0) return;
  await db('trade_in_conditions').insert(
    rows.map((r, i) => ({
      trade_in_product_id: tradeInProductId,
      label: r.label,
      description: r.description,
      price: r.price,
      sort_order: i
    }))
  );
}

async function newTradeInProductForm(req, res, next) {
  try {
    const categories = await db('categories').orderBy('sort_order');
    const copySources = await getTradeInCopySources(null);
    res.render('admin/trade-in-product-form', {
      title: 'Thêm sản phẩm thu cũ - TOMSTORE Admin',
      categories,
      product: {},
      conditions: [],
      copySources,
      errors: [],
      isEdit: false
    });
  } catch (err) {
    next(err);
  }
}

async function createTradeInProduct(req, res, next) {
  try {
    const categories = await db('categories').orderBy('sort_order');
    const conditionRows = parseConditionRows(req.body);
    const name = (req.body.name || '').trim();

    const errors = [];
    if (!name) errors.push({ msg: 'Vui lòng nhập tên sản phẩm.' });
    if (conditionRows.length === 0) errors.push({ msg: 'Vui lòng thêm ít nhất 1 mức tình trạng máy kèm giá thu.' });

    const imageFile = req.files && req.files.imageFile && req.files.imageFile[0];

    if (errors.length > 0) {
      if (imageFile) removeUploadedFile('/images/uploads/trade-in/' + imageFile.filename);
      return res.status(400).render('admin/trade-in-product-form', {
        title: 'Thêm sản phẩm thu cũ - TOMSTORE Admin',
        categories,
        product: req.body,
        conditions: conditionRows,
        copySources: await getTradeInCopySources(null),
        errors,
        isEdit: false
      });
    }

    let imageUrl = null;
    if (imageFile) {
      const destPath = path.join(__dirname, '..', '..', '..', 'public', 'images', 'uploads', 'trade-in', imageFile.filename);
      try {
        const finalFilename = await cropToFixedSize(destPath, 'product');
        imageUrl = '/images/uploads/trade-in/' + finalFilename;
      } catch (imgErr) {
        removeUploadedFile('/images/uploads/trade-in/' + imageFile.filename);
        return res.status(400).render('admin/trade-in-product-form', {
          title: 'Thêm sản phẩm thu cũ - TOMSTORE Admin',
          categories,
          product: req.body,
          conditions: conditionRows,
          copySources: await getTradeInCopySources(null),
          errors: [{ msg: IMAGE_ERROR_MESSAGE }],
          isEdit: false
        });
      }
    }

    const subsidyDigits = String(req.body.subsidyAmount || '').replace(/\D/g, '');

    const [insertedRaw] = await db('trade_in_products').insert({
      category_id: req.body.categoryId ? Number(req.body.categoryId) : null,
      name,
      image_url: imageUrl,
      subsidy_amount: subsidyDigits ? Number(subsidyDigits) : null,
      is_active: req.body.isActive !== 'off'
    });
    const insertedId = insertedRaw && insertedRaw.id ? insertedRaw.id : insertedRaw;

    await syncTradeInConditions(insertedId, conditionRows);

    res.redirect('/admin/thu-cu');
  } catch (err) {
    next(err);
  }
}

async function editTradeInProductForm(req, res, next) {
  try {
    const product = await db('trade_in_products').where('id', req.params.id).first();
    if (!product) return res.redirect('/admin/thu-cu');

    const categories = await db('categories').orderBy('sort_order');
    const conditions = await db('trade_in_conditions').where('trade_in_product_id', product.id).orderBy('sort_order');
    const copySources = await getTradeInCopySources(product.id);

    res.render('admin/trade-in-product-form', {
      title: 'Sửa sản phẩm thu cũ - TOMSTORE Admin',
      categories,
      product,
      conditions,
      copySources,
      errors: [],
      isEdit: true
    });
  } catch (err) {
    next(err);
  }
}

async function updateTradeInProduct(req, res, next) {
  try {
    const product = await db('trade_in_products').where('id', req.params.id).first();
    if (!product) return res.redirect('/admin/thu-cu');

    const categories = await db('categories').orderBy('sort_order');
    const conditionRows = parseConditionRows(req.body);
    const name = (req.body.name || '').trim();

    const errors = [];
    if (!name) errors.push({ msg: 'Vui lòng nhập tên sản phẩm.' });
    if (conditionRows.length === 0) errors.push({ msg: 'Vui lòng thêm ít nhất 1 mức tình trạng máy kèm giá thu.' });

    const imageFile = req.files && req.files.imageFile && req.files.imageFile[0];

    if (errors.length > 0) {
      if (imageFile) removeUploadedFile('/images/uploads/trade-in/' + imageFile.filename);
      return res.status(400).render('admin/trade-in-product-form', {
        title: 'Sửa sản phẩm thu cũ - TOMSTORE Admin',
        categories,
        product: { ...product, ...req.body, id: product.id },
        conditions: conditionRows,
        copySources: await getTradeInCopySources(product.id),
        errors,
        isEdit: true
      });
    }

    let imageUrl = req.body.existingImageUrl || product.image_url || null;
    if (imageFile) {
      const destPath = path.join(__dirname, '..', '..', '..', 'public', 'images', 'uploads', 'trade-in', imageFile.filename);
      try {
        const finalFilename = await cropToFixedSize(destPath, 'product');
        if (imageUrl) removeUploadedFile(imageUrl);
        imageUrl = '/images/uploads/trade-in/' + finalFilename;
      } catch (imgErr) {
        removeUploadedFile('/images/uploads/trade-in/' + imageFile.filename);
        return res.status(400).render('admin/trade-in-product-form', {
          title: 'Sửa sản phẩm thu cũ - TOMSTORE Admin',
          categories,
          product: { ...product, ...req.body, id: product.id },
          conditions: conditionRows,
          copySources: await getTradeInCopySources(product.id),
          errors: [{ msg: IMAGE_ERROR_MESSAGE }],
          isEdit: true
        });
      }
    }

    const subsidyDigits = String(req.body.subsidyAmount || '').replace(/\D/g, '');

    await db('trade_in_products').where('id', product.id).update({
      category_id: req.body.categoryId ? Number(req.body.categoryId) : null,
      name,
      image_url: imageUrl,
      subsidy_amount: subsidyDigits ? Number(subsidyDigits) : null,
      is_active: req.body.isActive !== 'off'
    });

    await syncTradeInConditions(product.id, conditionRows);

    res.redirect('/admin/thu-cu');
  } catch (err) {
    next(err);
  }
}

async function deleteTradeInProduct(req, res, next) {
  try {
    const product = await db('trade_in_products').where('id', req.params.id).first();
    await db('trade_in_products').where('id', req.params.id).del();
    if (product) removeUploadedFile(product.image_url);
    res.redirect('/admin/thu-cu');
  } catch (err) {
    next(err);
  }
}

// ---------- San pham duoc chon len doi (danh dau trade_in_enabled tren bang
// products co san) -- gom het ra 1 trang danh sach + tick hang loat, thay vi
// phai mo tung trang sua sanh pham 1 (nhanh hon nhieu khi co nhieu san pham). ----------

async function listUpgradeEligibleProducts(req, res, next) {
  try {
    const categories = await db('categories').orderBy('sort_order');
    const products = await db('products').orderBy([
      { column: 'category_sort_order', order: 'asc' },
      { column: 'created_at', order: 'desc' },
      { column: 'id', order: 'asc' }
    ]);
    const catalogProducts = products.filter((p) => !p.is_standalone_hotdeal);

    const sections = categories
      .map((cat) => ({ category: cat, products: catalogProducts.filter((p) => p.category_id === cat.id) }))
      .filter((s) => s.products.length > 0);

    res.render('admin/trade-in-upgrade-products', {
      title: 'Sản phẩm được lên đời - TOMSTORE Admin',
      sections,
      enabledCount: catalogProducts.filter((p) => p.trade_in_enabled).length,
      totalCount: catalogProducts.length
    });
  } catch (err) {
    next(err);
  }
}

async function updateUpgradeEligibleProducts(req, res, next) {
  try {
    const products = await db('products').where('is_standalone_hotdeal', false);
    for (const p of products) {
      const enabled = req.body['tradeInEnabled_' + p.id] === 'on';
      const subsidyDigits = String(req.body['tradeInSubsidy_' + p.id] || '').replace(/\D/g, '');
      await db('products')
        .where('id', p.id)
        .update({
          trade_in_enabled: enabled,
          trade_in_subsidy: enabled && subsidyDigits ? Number(subsidyDigits) : null
        });
    }
    res.redirect('/admin/thu-cu/san-pham-len-doi');
  } catch (err) {
    next(err);
  }
}

// ---------- Trade-in requests (yeu cau cua khach) ----------

async function listTradeInRequests(req, res, next) {
  try {
    const statusFilter = STATUS_KEYS.includes(req.query.status) ? req.query.status : '';
    let query = db('trade_in_requests').orderBy('created_at', 'desc');
    if (statusFilter) query = query.where('status', statusFilter);
    const requests = await query;

    res.render('admin/trade-in-requests', {
      title: 'Yêu cầu thu cũ đổi mới - TOMSTORE Admin',
      requests,
      statuses: STATUSES,
      statusFilter
    });
  } catch (err) {
    next(err);
  }
}

async function updateTradeInRequestStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!STATUS_KEYS.includes(status)) {
      return res.redirect('/admin/thu-cu/yeu-cau');
    }
    await db('trade_in_requests').where('id', req.params.id).update({ status });
    res.redirect(req.body.redirectTo || '/admin/thu-cu/yeu-cau');
  } catch (err) {
    next(err);
  }
}

async function deleteTradeInRequest(req, res, next) {
  try {
    await db('trade_in_requests').where('id', req.params.id).del();
    res.redirect('/admin/thu-cu/yeu-cau');
  } catch (err) {
    next(err);
  }
}

// ---------- Trade-in intro/policy content (giong warranty_policy_sections) ----------

const SANITIZE_OPTIONS = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'u', 's']),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    img: ['src', 'alt', 'width', 'height', 'style', 'class'],
    span: ['style', 'class'],
    p: ['style', 'class'],
    '*': ['style']
  },
  allowedSchemes: ['http', 'https']
};

async function listTradeInPolicySections(req, res, next) {
  try {
    const sections = await db('trade_in_policy_sections').orderBy('id');
    res.render('admin/trade-in-policy', {
      title: 'Giới thiệu / chính sách Thu cũ đổi mới - TOMSTORE Admin',
      sections,
      error: null
    });
  } catch (err) {
    next(err);
  }
}

async function createTradeInPolicySection(req, res, next) {
  try {
    const title = (req.body.title || '').trim();
    if (!title) {
      const sections = await db('trade_in_policy_sections').orderBy('id');
      return res.status(400).render('admin/trade-in-policy', {
        title: 'Giới thiệu / chính sách Thu cũ đổi mới - TOMSTORE Admin',
        sections,
        error: 'Vui lòng nhập tiêu đề mục mới.'
      });
    }

    await db('trade_in_policy_sections').insert({
      section_key: 'sec_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      title,
      content_html: ''
    });

    res.redirect('/admin/thu-cu/gioi-thieu');
  } catch (err) {
    next(err);
  }
}

async function updateTradeInPolicySection(req, res, next) {
  try {
    const title = (req.body.title || '').trim();
    if (!title) {
      const sections = await db('trade_in_policy_sections').orderBy('id');
      return res.status(400).render('admin/trade-in-policy', {
        title: 'Giới thiệu / chính sách Thu cũ đổi mới - TOMSTORE Admin',
        sections,
        error: 'Vui lòng nhập tiêu đề mục.'
      });
    }

    const contentHtml = sanitizeHtml(req.body.contentHtml || '', SANITIZE_OPTIONS);

    await db('trade_in_policy_sections').where('id', req.params.id).update({
      title,
      content_html: contentHtml,
      updated_at: new Date()
    });

    res.redirect('/admin/thu-cu/gioi-thieu');
  } catch (err) {
    next(err);
  }
}

async function deleteTradeInPolicySection(req, res, next) {
  try {
    await db('trade_in_policy_sections').where('id', req.params.id).del();
    res.redirect('/admin/thu-cu/gioi-thieu');
  } catch (err) {
    next(err);
  }
}

async function uploadTradeInPolicyImage(req, res, next) {
  try {
    if (req.fileUploadError || !req.file) {
      return res.status(400).json({ error: req.fileUploadError || 'Không có file ảnh.' });
    }

    const destPath = path.join(__dirname, '..', '..', '..', 'public', 'images', 'uploads', 'thu-cu', req.file.filename);
    let finalFilename;
    try {
      finalFilename = await resizeToMaxWidth(destPath, CONTENT_IMAGE_MAX_WIDTH);
    } catch (imgErr) {
      removeUploadedFile('/images/uploads/thu-cu/' + req.file.filename);
      return res.status(400).json({ error: IMAGE_ERROR_MESSAGE });
    }

    res.json({ url: '/images/uploads/thu-cu/' + finalFilename });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listTradeInProducts,
  newTradeInProductForm,
  createTradeInProduct,
  editTradeInProductForm,
  updateTradeInProduct,
  deleteTradeInProduct,
  listUpgradeEligibleProducts,
  updateUpgradeEligibleProducts,
  listTradeInRequests,
  updateTradeInRequestStatus,
  deleteTradeInRequest,
  listTradeInPolicySections,
  createTradeInPolicySection,
  updateTradeInPolicySection,
  deleteTradeInPolicySection,
  uploadTradeInPolicyImage
};
