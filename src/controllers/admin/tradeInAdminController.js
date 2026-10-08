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

// Khi has_variants = true, gia thu thuong nam o bang gia to hop
// trade_in_variant_prices (theo Dung luong x Mau) nen o day price thuong la
// null. Nhung neu san pham khong khai bao Dung luong/Mau nao ca (hasVariants
// bat ma khong bat buoc phai co Dung luong/Mau nua), admin co the bam nut
// "+ Them gia" tren tung dong Tinh trang de nhap gia truc tiep (JS khong con
// disable input nay nua, chi an/hien bang "hidden" -- input hidden van duoc
// gui len binh thuong) -- vi vay o day LUON co gang doc gia tu body, khong
// con gan cung price=null khi hasVariants nua. Che do don gian (khong
// hasVariants) van bat buoc moi dong phai co gia (bo qua dong neu thieu gia),
// con che do co hasVariants thi gia la tuy chon (null = dung bang gia to hop).
function parseConditionRows(body, hasVariants) {
  const labels = [].concat(body.conditionLabel || []);
  const descriptions = [].concat(body.conditionDescription || []);
  const prices = [].concat(body.conditionPrice || []);
  const rows = [];
  for (let i = 0; i < labels.length; i++) {
    const label = (labels[i] || '').trim();
    if (!label) continue;
    const priceDigits = String(prices[i] || '').replace(/\D/g, '');
    const price = priceDigits ? Number(priceDigits) : null;
    if (!hasVariants && price == null) continue;
    rows.push({ label, description: (descriptions[i] || '').trim() || null, price });
  }
  return rows;
}

function parseLabelRows(field) {
  return [].concat(field || [])
    .map((v) => (v || '').trim())
    .filter(Boolean)
    .map((label) => ({ label }));
}

// Moi dong Mau gio nam long trong 1 dong Dung luong (giong trang San pham),
// nen can biet no thuoc Dung luong nao -- colorRowStorageIndex la VI TRI
// (index) cua dong Dung luong cha, duoc JS phia client gan ngay truoc luc
// submit (xem comment o view), dung chinh pattern "colorVariantIndex" da co
// san o product-form.ejs/productAdminController.js.
function parseColorOptionRows(body) {
  const labels = [].concat(body.colorRowLabel || []);
  const hexes = [].concat(body.colorRowHex || []);
  const storageIdxs = [].concat(body.colorRowStorageIndex || []);
  const rows = [];
  for (let i = 0; i < labels.length; i++) {
    const label = (labels[i] || '').trim();
    if (!label) continue;
    const hex = (hexes[i] || '').trim();
    const storageIndex = storageIdxs[i] !== undefined && storageIdxs[i] !== '' ? Number(storageIdxs[i]) : null;
    rows.push({
      label,
      hex: /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : null,
      storageIndex: Number.isNaN(storageIndex) ? null : storageIndex
    });
  }
  return rows;
}

// Gia thu nhap thang tai dong Mau (1 o gia / Muc tinh trang, khong qua bang
// ma tran rieng nua) -- gui len duoi dang 3 mang song song theo VI TRI
// (khong dung bracket-name vi multer khong tu nest nhu qs). Khong can
// storageIndex rieng o day nua: Dung luong cua 1 o gia duoc suy ra tu chinh
// Mau cua no (moi Mau chi thuoc 1 Dung luong duy nhat) trong syncTradeInVariants.
function parseVariantPriceRows(body) {
  const cIdx = [].concat(body.variantPriceColorIndex || []);
  const kIdx = [].concat(body.variantPriceConditionIndex || []);
  const vals = [].concat(body.variantPriceValue || []);
  const rows = [];
  for (let i = 0; i < vals.length; i++) {
    const price = Number(String(vals[i] || '').replace(/\D/g, ''));
    const c = Number(cIdx[i]);
    const k = Number(kIdx[i]);
    if (Number.isNaN(price) || Number.isNaN(c) || Number.isNaN(k)) continue;
    rows.push({ colorIndex: c, conditionIndex: k, price });
  }
  return rows;
}

// Don gia nam-vi-tri (storageRows/colorRows/variantPriceRows deu chi dung
// INDEX, chua co id that) thanh cay long nhau de view render truc tiep --
// dung CHUNG cho ca 2 truong hop: (1) luc loi validate, dung lai dung du lieu
// admin vua go (KHONG doc tu DB) de khong lam mat du lieu ho da nhap -- day
// la cach sua loi "luu bi bao loi va mat het du lieu da nhap" ; (2) luc tai
// trang sua san pham, sau khi da quy doi du lieu DB ve dung hinh dang nay
// (xem loadVariantFormData).
function buildStorageGroupsView(storageRows, colorRows, variantPriceRows) {
  const groups = storageRows.map((s) => ({ label: s.label, colors: [] }));
  const colorEntries = colorRows.map((c) => ({ label: c.label, hex: c.hex, prices: {} }));
  colorRows.forEach((c, colorIndex) => {
    if (c.storageIndex != null && groups[c.storageIndex]) {
      groups[c.storageIndex].colors.push(colorEntries[colorIndex]);
    }
  });
  variantPriceRows.forEach((r) => {
    const entry = colorEntries[r.colorIndex];
    if (entry) entry.prices[r.conditionIndex] = r.price;
  });
  return groups;
}

// Danh sach "nguon de copy muc tinh trang" -- cac san pham thu cu da co san
// kem day du cac dong tinh trang (label/mo ta/gia), de admin chon 1 san pham
// giong (vd cung dong may) roi copy nguyen bo tinh trang sang san pham dang
// them/sua, do nhieu may co bo muc tinh trang + gia giong nhau. Chi lay cac
// san pham DA CO it nhat 1 muc tinh trang (khong co gi de copy thi bo qua).
// Chi ap dung cho che do don gian (khong co_variants) -- copy ca bang gia to
// hop chua duoc ho tro, nen UI se an han muc nay khi has_variants dang bat.
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
    .filter((p) => p.conditions.length > 0 && p.conditions.every((c) => c.price != null));
}

// Luon xoa het + them lai toan bo (dieu kien/dung luong/mau/bang gia) moi lan
// luu -- dung pattern "full replace" da dung san cho syncTradeInConditions tu
// truoc, don gian va an toan hon update tung dong rieng le. CASCADE FK tu
// dong don het trade_in_variant_prices khi xoa storage/color/condition cu.
async function syncTradeInVariants(tradeInProductId, { conditionRows, storageRows, colorRows, variantPriceRows }) {
  await db('trade_in_conditions').where('trade_in_product_id', tradeInProductId).del();
  const conditionIds = [];
  for (let i = 0; i < conditionRows.length; i++) {
    const r = conditionRows[i];
    const [inserted] = await db('trade_in_conditions').insert({
      trade_in_product_id: tradeInProductId,
      label: r.label,
      description: r.description,
      price: r.price,
      sort_order: i
    });
    conditionIds.push(inserted && inserted.id ? inserted.id : inserted);
  }

  await db('trade_in_storage_options').where('trade_in_product_id', tradeInProductId).del();
  const storageIds = [];
  for (let i = 0; i < storageRows.length; i++) {
    const [inserted] = await db('trade_in_storage_options').insert({
      trade_in_product_id: tradeInProductId,
      label: storageRows[i].label,
      sort_order: i
    });
    storageIds.push(inserted && inserted.id ? inserted.id : inserted);
  }

  await db('trade_in_color_options').where('trade_in_product_id', tradeInProductId).del();
  const colorIds = [];
  for (let i = 0; i < colorRows.length; i++) {
    const r = colorRows[i];
    const storageOptionId = r.storageIndex != null && storageIds[r.storageIndex] != null ? storageIds[r.storageIndex] : null;
    const [inserted] = await db('trade_in_color_options').insert({
      trade_in_product_id: tradeInProductId,
      storage_option_id: storageOptionId,
      label: r.label,
      hex_code: r.hex,
      sort_order: i
    });
    colorIds.push(inserted && inserted.id ? inserted.id : inserted);
  }

  // Dung luong cua 1 o gia duoc suy ra tu chinh Mau cua o do (moi Mau chi
  // thuoc 1 Dung luong) thay vi doc tu 1 chi so storageIndex gui rieng --
  // vua don gian form phia client, vua tranh truong hop le admin gui lech
  // storageIndex khac voi Dung luong that su cua Mau do.
  if (variantPriceRows.length && colorIds.length && conditionIds.length) {
    const rows = variantPriceRows
      .filter((r) => colorIds[r.colorIndex] != null && conditionIds[r.conditionIndex] != null)
      .map((r) => {
        const colorRow = colorRows[r.colorIndex];
        const storageOptionId = colorRow && colorRow.storageIndex != null ? storageIds[colorRow.storageIndex] : null;
        return {
          trade_in_product_id: tradeInProductId,
          storage_option_id: storageOptionId,
          color_option_id: colorIds[r.colorIndex],
          trade_in_condition_id: conditionIds[r.conditionIndex],
          price: r.price
        };
      })
      .filter((r) => r.storage_option_id != null);
    if (rows.length) await db('trade_in_variant_prices').insert(rows);
  }
}

// Doc du lieu Dung luong/Mau/gia tu DB roi quy ve dung hinh dang nam-vi-tri
// (storageRows/colorRows/variantPriceRows) ma buildStorageGroupsView() hieu
// -- de view sua san pham dung CHUNG 1 logic dung cay voi luc loi validate
// (xem buildStorageGroupsView), khong phai viet rieng 1 lan nua.
async function loadVariantFormData(tradeInProductId) {
  const [storages, colors, conditions, variantPriceRows] = await Promise.all([
    db('trade_in_storage_options').where('trade_in_product_id', tradeInProductId).orderBy(['sort_order', 'id']),
    db('trade_in_color_options').where('trade_in_product_id', tradeInProductId).orderBy(['sort_order', 'id']),
    db('trade_in_conditions').where('trade_in_product_id', tradeInProductId).orderBy(['sort_order', 'id']),
    db('trade_in_variant_prices').where('trade_in_product_id', tradeInProductId)
  ]);

  const storageIndexById = {};
  storages.forEach((s, i) => { storageIndexById[s.id] = i; });
  const colorIndexById = {};
  colors.forEach((c, i) => { colorIndexById[c.id] = i; });
  const conditionIndexById = {};
  conditions.forEach((c, i) => { conditionIndexById[c.id] = i; });

  const storageRows = storages.map((s) => ({ label: s.label }));
  const colorRows = colors.map((c) => ({
    label: c.label,
    hex: c.hex_code,
    storageIndex: c.storage_option_id != null ? storageIndexById[c.storage_option_id] : null
  }));
  const parsedVariantPriceRows = variantPriceRows
    .map((vp) => ({
      colorIndex: colorIndexById[vp.color_option_id],
      conditionIndex: conditionIndexById[vp.trade_in_condition_id],
      price: vp.price
    }))
    .filter((r) => r.colorIndex != null && r.conditionIndex != null);

  const storageGroups = buildStorageGroupsView(storageRows, colorRows, parsedVariantPriceRows);
  return { conditions, storageGroups };
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
      storageGroups: [],
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
    const hasVariants = req.body.hasVariants === 'on';
    const conditionRows = parseConditionRows(req.body, hasVariants);
    const storageRows = hasVariants ? parseLabelRows(req.body.storageRowLabel) : [];
    const colorRows = hasVariants ? parseColorOptionRows(req.body) : [];
    const variantPriceRows = hasVariants ? parseVariantPriceRows(req.body) : [];
    const name = (req.body.name || '').trim();

    const errors = [];
    if (!name) errors.push({ msg: 'Vui lòng nhập tên sản phẩm.' });
    if (conditionRows.length === 0) errors.push({ msg: 'Vui lòng thêm ít nhất 1 mức tình trạng máy.' });
    // Dung luong/Mau gio la TUY CHON ke ca khi bat "co nhieu Dung luong/Mau"
    // -- nhung neu khong co Dung luong nao (khong co bang gia to hop de dua
    // vao), moi dong Tinh trang BAT BUOC phai co gia rieng (qua nut "+ Them
    // gia" tren form), giong het yeu cau cua che do don gian.
    if (hasVariants && storageRows.length === 0 && conditionRows.some((r) => r.price == null)) {
      errors.push({ msg: 'Chưa thêm Dung lượng nào thì mỗi Mức tình trạng cần có giá riêng — bấm "+ Thêm giá" để nhập, hoặc thêm Dung lượng/Màu.' });
    }

    const imageFile = req.files && req.files.imageFile && req.files.imageFile[0];

    if (errors.length > 0) {
      if (imageFile) removeUploadedFile('/images/uploads/trade-in/' + imageFile.filename);
      return res.status(400).render('admin/trade-in-product-form', {
        title: 'Thêm sản phẩm thu cũ - TOMSTORE Admin',
        categories,
        product: { ...req.body, has_variants: hasVariants },
        conditions: conditionRows,
        storageGroups: buildStorageGroupsView(storageRows, colorRows, variantPriceRows),
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
          product: { ...req.body, has_variants: hasVariants },
          conditions: conditionRows,
          storageGroups: buildStorageGroupsView(storageRows, colorRows, variantPriceRows),
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
      is_active: req.body.isActive !== 'off',
      has_variants: hasVariants
    });
    const insertedId = insertedRaw && insertedRaw.id ? insertedRaw.id : insertedRaw;

    await syncTradeInVariants(insertedId, { conditionRows, storageRows, colorRows, variantPriceRows });

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
    const { conditions, storageGroups } = await loadVariantFormData(product.id);
    const copySources = await getTradeInCopySources(product.id);

    res.render('admin/trade-in-product-form', {
      title: 'Sửa sản phẩm thu cũ - TOMSTORE Admin',
      categories,
      product,
      conditions,
      storageGroups,
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
    const hasVariants = req.body.hasVariants === 'on';
    const conditionRows = parseConditionRows(req.body, hasVariants);
    const storageRows = hasVariants ? parseLabelRows(req.body.storageRowLabel) : [];
    const colorRows = hasVariants ? parseColorOptionRows(req.body) : [];
    const variantPriceRows = hasVariants ? parseVariantPriceRows(req.body) : [];
    const name = (req.body.name || '').trim();

    const errors = [];
    if (!name) errors.push({ msg: 'Vui lòng nhập tên sản phẩm.' });
    if (conditionRows.length === 0) errors.push({ msg: 'Vui lòng thêm ít nhất 1 mức tình trạng máy.' });
    // Dung luong/Mau gio la TUY CHON ke ca khi bat "co nhieu Dung luong/Mau"
    // -- nhung neu khong co Dung luong nao (khong co bang gia to hop de dua
    // vao), moi dong Tinh trang BAT BUOC phai co gia rieng (qua nut "+ Them
    // gia" tren form), giong het yeu cau cua che do don gian.
    if (hasVariants && storageRows.length === 0 && conditionRows.some((r) => r.price == null)) {
      errors.push({ msg: 'Chưa thêm Dung lượng nào thì mỗi Mức tình trạng cần có giá riêng — bấm "+ Thêm giá" để nhập, hoặc thêm Dung lượng/Màu.' });
    }

    const imageFile = req.files && req.files.imageFile && req.files.imageFile[0];

    if (errors.length > 0) {
      if (imageFile) removeUploadedFile('/images/uploads/trade-in/' + imageFile.filename);
      return res.status(400).render('admin/trade-in-product-form', {
        title: 'Sửa sản phẩm thu cũ - TOMSTORE Admin',
        categories,
        product: { ...product, ...req.body, id: product.id, has_variants: hasVariants },
        conditions: conditionRows,
        storageGroups: buildStorageGroupsView(storageRows, colorRows, variantPriceRows),
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
          product: { ...product, ...req.body, id: product.id, has_variants: hasVariants },
          conditions: conditionRows,
          storageGroups: buildStorageGroupsView(storageRows, colorRows, variantPriceRows),
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
      is_active: req.body.isActive !== 'off',
      has_variants: hasVariants
    });

    await syncTradeInVariants(product.id, { conditionRows, storageRows, colorRows, variantPriceRows });

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
