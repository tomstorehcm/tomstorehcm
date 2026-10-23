const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const db = require('../../db');
const { STATUSES, STATUS_KEYS, statusLabel } = require('../../utils/repairStatus');
const { cropToFixedSize } = require('../../utils/imageProcess');
const { toDateInputValue } = require('../../utils/format');
const { logFieldChanges, getEditHistory } = require('../../utils/auditLog');

function removeUploadedFile(imageUrl) {
  if (imageUrl && imageUrl.startsWith('/images/uploads/')) {
    const filePath = path.join(__dirname, '..', '..', '..', 'public', imageUrl);
    fs.unlink(filePath, () => {});
  }
}

// ---------- Repair services (muc sua chua chung, ap dung moi thiet bi) ----------
// Trang dich vu CHI quan ly ten + cac "Loai" (khong gia). San pham nao ap
// dung dich vu nay + gia bao nhieu duoc quan ly tu trang SAN PHAM (xem
// saveDeviceServices ben duoi), khong phai tu day.

async function listRepairServices(req, res, next) {
  try {
    const services = await db('repair_services').orderBy(['sort_order', 'id']);
    const variantCounts = await db('repair_variants')
      .select('repair_service_id')
      .count('* as count')
      .groupBy('repair_service_id');
    const countByService = {};
    variantCounts.forEach((row) => { countByService[row.repair_service_id] = Number(row.count); });

    const rows = services.map((s) => ({ ...s, variant_count: countByService[s.id] || 0 }));

    res.render('admin/repair-products', {
      title: 'Dịch vụ sửa chữa - TOMSTORE Admin',
      rows
    });
  } catch (err) {
    next(err);
  }
}

// Moi dong "Loai" gom nhan/mo ta (mang song song theo VI TRI, giong
// parseConditionRows) + anh RIENG cua dong do. KHONG con gia o day nua --
// gia phu thuoc vao tung san pham khach chon, xem saveDeviceServices ben
// duoi. File anh duoc gui len duoi ten `variantImage_<i>` voi i LA VI TRI HIEN TAI cua dong trong
// toan bo form luc submit (JS tu danh lai so ngay truoc khi gui, xem script
// o repair-product-form.ejs) -- giong het pattern colorImage_<i> da dung
// cho mau san pham trong productAdminController.js.
//
// variantId (co the rong voi dong moi them) duoc dung de GIU NGUYEN id cua
// "Loai" qua moi lan luu (xem syncRepairVariants) -- QUAN TRONG vi gia theo
// san pham (repair_variant_prices) duoc khoa theo repair_variant_id, neu
// moi lan luu lai tao id moi se lam mat het gia da nhap cho tung san pham.
async function parseVariantRows(body, files) {
  const ids = [].concat(body.variantId || []);
  const labels = [].concat(body.variantLabel || []);
  const descriptions = [].concat(body.variantDescription || []);
  const existingImageUrls = [].concat(body.variantImageUrl || []);
  const rows = [];

  for (let i = 0; i < labels.length; i++) {
    const fileArr = files && files['variantImage_' + i];
    const file = fileArr && fileArr[0];
    const label = (labels[i] || '').trim();

    if (!label) {
      if (file) removeUploadedFile('/images/uploads/repair/' + file.filename);
      continue;
    }

    let imageUrl = existingImageUrls[i] || null;
    if (file) {
      const destPath = path.join(__dirname, '..', '..', '..', 'public', 'images', 'uploads', 'repair', file.filename);
      try {
        const finalFilename = await cropToFixedSize(destPath, 'product');
        if (imageUrl) removeUploadedFile(imageUrl);
        imageUrl = '/images/uploads/repair/' + finalFilename;
      } catch (imgErr) {
        removeUploadedFile('/images/uploads/repair/' + file.filename);
      }
    }

    const idRaw = (ids[i] || '').toString().trim();
    rows.push({ id: idRaw ? Number(idRaw) : null, label, description: (descriptions[i] || '').trim() || null, imageUrl });
  }
  return rows;
}

// Cap nhat tai cho (UPDATE theo id neu con, INSERT neu la dong moi, DELETE
// dong nao bi bo ra khoi form) thay vi xoa-het-them-lai nhu truoc -- giu
// nguyen id cua "Loai" khong doi qua moi lan luu de KHONG lam mat gia theo
// san pham da nhap (repair_variant_prices khoa theo repair_variant_id, FK
// CASCADE se tu don gia khi 1 Loai bi xoa that su).
async function syncRepairVariants(repairServiceId, variantRows) {
  const existing = await db('repair_variants').where('repair_service_id', repairServiceId);
  const existingById = {};
  existing.forEach((v) => { existingById[v.id] = v; });

  const keptIds = new Set();
  for (let i = 0; i < variantRows.length; i++) {
    const r = variantRows[i];
    if (r.id && existingById[r.id]) {
      keptIds.add(r.id);
      const old = existingById[r.id];
      if (old.image_url && old.image_url !== r.imageUrl) removeUploadedFile(old.image_url);
      await db('repair_variants').where('id', r.id).update({
        label: r.label,
        description: r.description,
        image_url: r.imageUrl,
        sort_order: i
      });
    } else {
      await db('repair_variants').insert({
        repair_service_id: repairServiceId,
        label: r.label,
        description: r.description,
        image_url: r.imageUrl,
        sort_order: i
      });
    }
  }

  const removed = existing.filter((v) => !keptIds.has(v.id));
  removed.forEach((v) => { if (v.image_url) removeUploadedFile(v.image_url); });
  if (removed.length) {
    await db('repair_variants').whereIn('id', removed.map((v) => v.id)).del();
  }
}

function newRepairServiceForm(req, res) {
  res.render('admin/repair-product-form', {
    title: 'Thêm dịch vụ sửa chữa - TOMSTORE Admin',
    service: {},
    variants: [],
    errors: [],
    isEdit: false
  });
}

async function createRepairService(req, res, next) {
  try {
    const variantRows = await parseVariantRows(req.body, req.files);
    const name = (req.body.name || '').trim();

    const errors = [];
    if (!name) errors.push({ msg: 'Vui lòng nhập tên dịch vụ sửa chữa.' });
    if (variantRows.length === 0) errors.push({ msg: 'Vui lòng thêm ít nhất 1 loại.' });

    if (errors.length > 0) {
      return res.status(400).render('admin/repair-product-form', {
        title: 'Thêm dịch vụ sửa chữa - TOMSTORE Admin',
        service: { ...req.body },
        variants: variantRows,
        errors,
        isEdit: false
      });
    }

    const [insertedRaw] = await db('repair_services').insert({
      name,
      is_active: req.body.isActive !== 'off'
    });
    const insertedId = insertedRaw && insertedRaw.id ? insertedRaw.id : insertedRaw;

    await syncRepairVariants(insertedId, variantRows);

    res.redirect('/admin/sua-chua');
  } catch (err) {
    next(err);
  }
}

async function editRepairServiceForm(req, res, next) {
  try {
    const service = await db('repair_services').where('id', req.params.id).first();
    if (!service) return res.redirect('/admin/sua-chua');

    const variants = await db('repair_variants').where('repair_service_id', service.id).orderBy(['sort_order', 'id']);

    res.render('admin/repair-product-form', {
      title: 'Sửa dịch vụ sửa chữa - TOMSTORE Admin',
      service,
      variants,
      errors: [],
      isEdit: true
    });
  } catch (err) {
    next(err);
  }
}

async function updateRepairService(req, res, next) {
  try {
    const service = await db('repair_services').where('id', req.params.id).first();
    if (!service) return res.redirect('/admin/sua-chua');

    const variantRows = await parseVariantRows(req.body, req.files);
    const name = (req.body.name || '').trim();

    const errors = [];
    if (!name) errors.push({ msg: 'Vui lòng nhập tên dịch vụ sửa chữa.' });
    if (variantRows.length === 0) errors.push({ msg: 'Vui lòng thêm ít nhất 1 loại.' });

    if (errors.length > 0) {
      return res.status(400).render('admin/repair-product-form', {
        title: 'Sửa dịch vụ sửa chữa - TOMSTORE Admin',
        service: { ...service, ...req.body, id: service.id },
        variants: variantRows,
        errors,
        isEdit: true
      });
    }

    await db('repair_services').where('id', service.id).update({
      name,
      is_active: req.body.isActive !== 'off'
    });

    await syncRepairVariants(service.id, variantRows);

    res.redirect('/admin/sua-chua');
  } catch (err) {
    next(err);
  }
}

async function deleteRepairService(req, res, next) {
  try {
    const variants = await db('repair_variants').where('repair_service_id', req.params.id);
    await db('repair_services').where('id', req.params.id).del();
    variants.forEach((v) => removeUploadedFile(v.image_url));
    res.redirect('/admin/sua-chua');
  } catch (err) {
    next(err);
  }
}

// ---------- Repair devices (San pham / dong may DUNG CHUNG cho moi dich vu) ----------
// 1 san pham co the LA 1 san pham THAT trong catalog dang ban (product_id,
// ten/anh luon lay tu do -- khong luu rieng) HOAC tu nhap ten/anh (danh cho
// may doi cu khong con trong catalog). Tu trang sua 1 san pham, admin chon
// NHUNG dich vu nao ap dung + nhap gia theo tung Loai cua dich vu do (xem
// saveDeviceServices).

async function listRepairDevices(req, res, next) {
  try {
    const devices = await db('repair_devices as rd')
      .leftJoin('products as p', 'p.id', 'rd.product_id')
      .orderBy(['rd.sort_order', 'rd.id'])
      .select(
        'rd.id',
        'rd.product_id',
        'rd.is_active',
        'p.name as product_name',
        'rd.name as manual_name',
        'p.image_url as product_image_url',
        'rd.image_url as manual_image_url'
      );
    const deviceIds = devices.map((d) => d.id);

    // Danh sach dich vu dang ap dung cho tung san pham -- hien truc tiep o
    // bang danh sach de admin biet ngay khong can bam vao tung san pham.
    const serviceRows = deviceIds.length
      ? await db('repair_service_devices as sd')
          .join('repair_services as s', 's.id', 'sd.repair_service_id')
          .whereIn('sd.repair_device_id', deviceIds)
          .orderBy(['sd.sort_order', 'sd.id'])
          .select('sd.repair_device_id', 's.name as service_name')
      : [];

    // San pham cong khai CHI hien tren /sua-chua khi co it nhat 1 "Loai" da
    // duoc nhap gia (xem loadRepairFlowData) -- tich dich vu thoi chua du.
    // Query rieng danh sach da co gia de canh bao ngay o day, tranh admin
    // tich dich vu roi tuong da xong nhung quen nhap gia nen may khong hien.
    const pricedDeviceRows = deviceIds.length
      ? await db('repair_variant_prices').whereIn('repair_device_id', deviceIds).select('repair_device_id')
      : [];
    const pricedDeviceIds = new Set(pricedDeviceRows.map((r) => r.repair_device_id));

    const rows = devices.map((d) => ({
      id: d.id,
      is_active: d.is_active,
      fromCatalog: !!d.product_id,
      name: d.product_id ? d.product_name : d.manual_name,
      image_url: d.product_id ? d.product_image_url : d.manual_image_url,
      appliedServiceNames: serviceRows
        .filter((r) => r.repair_device_id === d.id)
        .map((r) => r.service_name),
      hasPrice: pricedDeviceIds.has(d.id)
    }));

    res.render('admin/repair-device-products', {
      title: 'Sản phẩm (dòng máy) - TOMSTORE Admin',
      devices: rows
    });
  } catch (err) {
    next(err);
  }
}

// Them san pham THU CONG (may doi cu khong con trong catalog) -- san pham
// LIEN KET catalog gio chon hang loat qua trang "Chon tu san pham co san"
// (xem listCatalogRepairDevices/updateCatalogRepairDevices ben duoi), giong
// cach trang San pham Trade In cho tich chon nhieu san pham 1 luc, thay vi
// phai them tung san pham 1 qua form nay.
function newRepairDeviceForm(req, res) {
  res.render('admin/repair-device-product-form', {
    title: 'Thêm thủ công - TOMSTORE Admin',
    device: {},
    linkedProduct: null,
    services: [],
    errors: [],
    isEdit: false
  });
}

async function createRepairDevice(req, res, next) {
  try {
    const name = (req.body.name || '').trim();
    const errors = [];
    if (!name) errors.push({ msg: 'Vui lòng nhập tên sản phẩm.' });

    if (errors.length > 0) {
      if (req.file) removeUploadedFile('/images/uploads/repair/' + req.file.filename);
      return res.status(400).render('admin/repair-device-product-form', {
        title: 'Thêm thủ công - TOMSTORE Admin',
        device: { ...req.body },
        linkedProduct: null,
        services: [],
        errors,
        isEdit: false
      });
    }

    let imageUrl = null;
    if (req.file) {
      const destPath = path.join(__dirname, '..', '..', '..', 'public', 'images', 'uploads', 'repair', req.file.filename);
      try {
        const finalFilename = await cropToFixedSize(destPath, 'product');
        imageUrl = '/images/uploads/repair/' + finalFilename;
      } catch (imgErr) {
        removeUploadedFile('/images/uploads/repair/' + req.file.filename);
      }
    }

    await db('repair_devices').insert({
      product_id: null,
      name,
      image_url: imageUrl,
      is_active: req.body.isActive !== 'off'
    });

    res.redirect('/admin/sua-chua/san-pham');
  } catch (err) {
    next(err);
  }
}

// ---------- Chon hang loat san pham tu catalog lam "dong may" sua chua ----------
// Gom het ra 1 trang danh sach + tich hang loat (giong het pattern trang San
// pham Trade In cho tich chon nhieu san pham), thay vi phai mo form them tung
// san pham catalog 1. Bo tich 1 san pham CHI an no di (is_active = false),
// KHONG xoa repair_devices -- tranh mat het dich vu/gia da gan cho san pham
// do neu admin lo bo tich roi tich lai sau.
async function listCatalogRepairDevices(req, res, next) {
  try {
    const categories = await db('categories').orderBy('sort_order');
    const products = await db('products').orderBy([
      { column: 'category_sort_order', order: 'asc' },
      { column: 'created_at', order: 'desc' },
      { column: 'id', order: 'asc' }
    ]);
    const catalogProducts = products.filter((p) => !p.is_standalone_hotdeal);

    const existingDevices = await db('repair_devices').whereNotNull('product_id');
    const deviceByProductId = {};
    existingDevices.forEach((d) => { deviceByProductId[d.product_id] = d; });

    const sections = categories
      .map((cat) => ({ category: cat, products: catalogProducts.filter((p) => p.category_id === cat.id) }))
      .filter((s) => s.products.length > 0);

    const enabledCount = catalogProducts.filter((p) => {
      const d = deviceByProductId[p.id];
      return d && d.is_active;
    }).length;

    res.render('admin/repair-catalog-products', {
      title: 'Chọn sản phẩm từ catalog - TOMSTORE Admin',
      sections,
      deviceByProductId,
      enabledCount,
      totalCount: catalogProducts.length
    });
  } catch (err) {
    next(err);
  }
}

async function updateCatalogRepairDevices(req, res, next) {
  try {
    const products = await db('products').where('is_standalone_hotdeal', false);
    const existingDevices = await db('repair_devices').whereNotNull('product_id');
    const deviceByProductId = {};
    existingDevices.forEach((d) => { deviceByProductId[d.product_id] = d; });

    const maxSortOrderRow = await db('repair_devices').max('sort_order as m').first();
    let nextSortOrder = (maxSortOrderRow && maxSortOrderRow.m != null ? maxSortOrderRow.m : -1) + 1;

    for (const p of products) {
      const enabled = req.body['repairEnabled_' + p.id] === 'on';
      const existing = deviceByProductId[p.id];

      if (existing) {
        if (!!existing.is_active !== enabled) {
          await db('repair_devices').where('id', existing.id).update({ is_active: enabled });
        }
      } else if (enabled) {
        await db('repair_devices').insert({
          product_id: p.id,
          name: null,
          image_url: null,
          is_active: true,
          sort_order: nextSortOrder++
        });
      }
    }

    res.redirect('/admin/sua-chua/san-pham/chon-san-pham');
  } catch (err) {
    next(err);
  }
}

// Nap phan "Dich vu ap dung & gia" cho trang sua 1 san pham: TAT CA dich vu
// trong he thong (de hien duoi dang checkbox tich chon 1 lan, giong cach
// trang San pham Trade In cho tich chon nhieu san pham), kem co moi dich vu
// da duoc ap dung cho san pham nay chua (applied) va bang gia rieng theo
// tung "Loai" cua dich vu do UNG VOI san pham nay -- tat ca luu 1 lan qua
// saveDeviceServices ben duoi, khong con tach rieng attach/gia/go nua.
async function loadDeviceServiceData(deviceId) {
  const allServices = await db('repair_services').orderBy(['sort_order', 'id']);
  const serviceIds = allServices.map((s) => s.id);

  const appliedRows = await db('repair_service_devices').where('repair_device_id', deviceId);
  const appliedServiceIds = new Set(appliedRows.map((r) => r.repair_service_id));

  const variants = serviceIds.length
    ? await db('repair_variants').whereIn('repair_service_id', serviceIds).orderBy(['repair_service_id', 'sort_order', 'id'])
    : [];

  const prices = variants.length
    ? await db('repair_variant_prices').whereIn('repair_variant_id', variants.map((v) => v.id)).where('repair_device_id', deviceId)
    : [];
  const priceRowByVariant = {};
  prices.forEach((p) => { priceRowByVariant[p.repair_variant_id] = p; });

  const services = allServices.map((s) => ({
    id: s.id,
    name: s.name,
    applied: appliedServiceIds.has(s.id),
    variants: variants
      .filter((v) => v.repair_service_id === s.id)
      .map((v) => {
        const row = priceRowByVariant[v.id];
        return {
          id: v.id,
          label: v.label,
          price: row && row.price != null ? row.price : '',
          // imageUrl: anh RIENG cho dung san pham nay (admin vua upload qua
          // saveDeviceServices). defaultImageUrl: anh mac dinh cua chinh
          // "Loai" do (repair_variants.image_url) -- hien o day de admin biet
          // dang dung anh nao khi chua ghi de rieng.
          imageUrl: row ? row.image_url : null,
          defaultImageUrl: v.image_url || null
        };
      })
  }));

  return { services };
}

async function editRepairDeviceForm(req, res, next) {
  try {
    const device = await db('repair_devices').where('id', req.params.id).first();
    if (!device) return res.redirect('/admin/sua-chua/san-pham');

    let linkedProduct = null;
    if (device.product_id) linkedProduct = await db('products').where('id', device.product_id).first();

    const { services } = await loadDeviceServiceData(device.id);

    res.render('admin/repair-device-product-form', {
      title: 'Sửa sản phẩm - TOMSTORE Admin',
      device,
      linkedProduct,
      services,
      errors: [],
      isEdit: true
    });
  } catch (err) {
    next(err);
  }
}

async function updateRepairDevice(req, res, next) {
  try {
    const device = await db('repair_devices').where('id', req.params.id).first();
    if (!device) return res.redirect('/admin/sua-chua/san-pham');

    // San pham lien ket catalog: chi doi duoc trang thai hien/an, ten/anh
    // luon lay tu san pham that nen khong co gi de sua them o day.
    if (device.product_id) {
      if (req.file) removeUploadedFile('/images/uploads/repair/' + req.file.filename);
      await db('repair_devices').where('id', device.id).update({ is_active: req.body.isActive !== 'off' });
      return res.redirect('/admin/sua-chua/san-pham');
    }

    const name = (req.body.name || '').trim();
    const errors = [];
    if (!name) errors.push({ msg: 'Vui lòng nhập tên sản phẩm.' });

    if (errors.length > 0) {
      if (req.file) removeUploadedFile('/images/uploads/repair/' + req.file.filename);
      const { services } = await loadDeviceServiceData(device.id);
      return res.status(400).render('admin/repair-device-product-form', {
        title: 'Sửa sản phẩm - TOMSTORE Admin',
        device: { ...device, ...req.body, id: device.id },
        linkedProduct: null,
        services,
        errors,
        isEdit: true
      });
    }

    let imageUrl = device.image_url;
    if (req.file) {
      const destPath = path.join(__dirname, '..', '..', '..', 'public', 'images', 'uploads', 'repair', req.file.filename);
      try {
        const finalFilename = await cropToFixedSize(destPath, 'product');
        if (imageUrl) removeUploadedFile(imageUrl);
        imageUrl = '/images/uploads/repair/' + finalFilename;
      } catch (imgErr) {
        removeUploadedFile('/images/uploads/repair/' + req.file.filename);
      }
    }

    await db('repair_devices').where('id', device.id).update({
      name,
      image_url: imageUrl,
      is_active: req.body.isActive !== 'off'
    });

    res.redirect('/admin/sua-chua/san-pham');
  } catch (err) {
    next(err);
  }
}

async function deleteRepairDevice(req, res, next) {
  try {
    const device = await db('repair_devices').where('id', req.params.id).first();
    await db('repair_devices').where('id', req.params.id).del();
    if (device && device.image_url) removeUploadedFile(device.image_url);
    res.redirect('/admin/sua-chua/san-pham');
  } catch (err) {
    next(err);
  }
}

// ---------- Dich vu ap dung cho 1 san pham + gia theo tung Loai ----------
// 1 FORM DUY NHAT tren trang sua san pham: tich/bo tich dich vu nao ap dung
// (checkbox, hien TAT CA dich vu, giong cach trang San pham Trade In cho
// tich chon nhieu san pham 1 luc) + nhap gia cho tung "Loai" cua CAC dich vu
// dang tich, tat ca luu bang 1 nut "Luu thay doi" duy nhat -- truoc day
// tach thanh 3 form/nut rieng (them dich vu, luu gia, go dich vu) de nguoi
// dung de bam nham nut ma khong luu duoc gia da nhap.
async function saveDeviceServices(req, res, next) {
  try {
    const deviceId = req.params.id;
    const selectedServiceIds = [].concat(req.body.serviceIds || []).map(Number).filter(Boolean);

    const existingRows = await db('repair_service_devices').where('repair_device_id', deviceId);
    const existingServiceIds = existingRows.map((r) => r.repair_service_id);

    const toAdd = selectedServiceIds.filter((id) => !existingServiceIds.includes(id));
    const toRemove = existingServiceIds.filter((id) => !selectedServiceIds.includes(id));

    if (toAdd.length) {
      let sortOrder = existingRows.length;
      await db('repair_service_devices').insert(
        toAdd.map((id) => ({ repair_service_id: id, repair_device_id: deviceId, sort_order: sortOrder++ }))
      );
    }
    if (toRemove.length) {
      await db('repair_service_devices')
        .where('repair_device_id', deviceId)
        .whereIn('repair_service_id', toRemove)
        .del();
    }

    // Anh RIENG cho dung cap (Loai, san pham) nay -- gui len qua
    // variantDeviceImage_<variantId>. Dung multer.any() (khong fields() co
    // san) vi danh sach Loai dai ngan tuy he thong, khong co so luong co dinh
    // de khai bao truoc ten field nhu cac form khac (vd variantImage_<i>).
    const filesByField = {};
    (req.files || []).forEach((f) => { filesByField[f.fieldname] = f; });

    // Luu/xoa gia (+ anh rieng neu co) cho tung "Loai" cua MOI dich vu dang
    // duoc tich (ke ca dich vu vua them o tren) -- o gia nao de trong thi xoa
    // gia + anh rieng da luu (neu co), khong de trong thi upsert theo cap
    // (variant, device).
    const variants = selectedServiceIds.length
      ? await db('repair_variants').whereIn('repair_service_id', selectedServiceIds)
      : [];
    for (const v of variants) {
      const digits = String(req.body['price_' + v.id] || '').replace(/\D/g, '');
      const existingPrice = await db('repair_variant_prices')
        .where({ repair_variant_id: v.id, repair_device_id: deviceId })
        .first();
      const uploadedFile = filesByField['variantDeviceImage_' + v.id];

      if (!digits) {
        if (existingPrice) {
          if (existingPrice.image_url) removeUploadedFile(existingPrice.image_url);
          await db('repair_variant_prices').where('id', existingPrice.id).del();
        }
        // Khong co gia -> dong nay khong duoc luu, file vua upload (neu co)
        // la rac, xoa luon tranh ton dung luong.
        if (uploadedFile) removeUploadedFile('/images/uploads/repair/' + uploadedFile.filename);
        continue;
      }

      const price = Number(digits);
      let imageUrl = existingPrice ? existingPrice.image_url : null;

      if (uploadedFile) {
        const destPath = path.join(__dirname, '..', '..', '..', 'public', 'images', 'uploads', 'repair', uploadedFile.filename);
        try {
          const finalFilename = await cropToFixedSize(destPath, 'product');
          if (imageUrl) removeUploadedFile(imageUrl);
          imageUrl = '/images/uploads/repair/' + finalFilename;
        } catch (imgErr) {
          removeUploadedFile('/images/uploads/repair/' + uploadedFile.filename);
        }
      } else if (req.body['clearImage_' + v.id] === '1' && imageUrl) {
        removeUploadedFile(imageUrl);
        imageUrl = null;
      }

      if (existingPrice) {
        await db('repair_variant_prices').where('id', existingPrice.id).update({ price, image_url: imageUrl });
      } else {
        await db('repair_variant_prices').insert({ repair_variant_id: v.id, repair_device_id: deviceId, price, image_url: imageUrl });
      }
    }

    res.redirect('/admin/sua-chua/san-pham');
  } catch (err) {
    next(err);
  }
}

// ---------- Repair requests (yeu cau cua khach, co the gom nhieu dich vu) ----------

async function listRepairRequests(req, res, next) {
  try {
    const statusFilter = STATUS_KEYS.includes(req.query.status) ? req.query.status : '';
    let query = db('repair_requests').orderBy('created_at', 'desc');
    if (statusFilter) query = query.where('status', statusFilter);
    const requests = await query;

    const requestIds = requests.map((r) => r.id);
    const allItems = requestIds.length
      ? await db('repair_request_items').whereIn('repair_request_id', requestIds)
      : [];
    const itemsByRequest = {};
    allItems.forEach((it) => {
      if (!itemsByRequest[it.repair_request_id]) itemsByRequest[it.repair_request_id] = [];
      itemsByRequest[it.repair_request_id].push(it);
    });

    const rows = requests.map((r) => ({ ...r, items: itemsByRequest[r.id] || [] }));

    res.render('admin/repair-requests', {
      title: 'Yêu cầu sửa chữa - TOMSTORE Admin',
      requests: rows,
      statuses: STATUSES,
      statusFilter
    });
  } catch (err) {
    next(err);
  }
}

async function updateRepairRequestStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!STATUS_KEYS.includes(status)) {
      return res.redirect('/admin/sua-chua/yeu-cau');
    }
    await db('repair_requests').where('id', req.params.id).update({ status });
    res.redirect(req.body.redirectTo || '/admin/sua-chua/yeu-cau');
  } catch (err) {
    next(err);
  }
}

async function deleteRepairRequest(req, res, next) {
  try {
    await db('repair_requests').where('id', req.params.id).del();
    res.redirect('/admin/sua-chua/yeu-cau');
  } catch (err) {
    next(err);
  }
}

const REQUEST_PHONE_RE = /^(0\d{9}|\+84\d{9})$/;

// Cho phep admin sua thong tin khach + THEM SO IMEI cua yeu cau khach gui tu
// trang cong khai (truoc day chi doi duoc "Trang thai" + Xoa). Dich vu/loai/
// gia VAN giu nguyen, khong cho sua o day (da luu co dinh tai thoi diem
// khach gui, xem comment o dau "Repair requests"). Moi lan luu se tu dong
// ghi lich su thay doi (xem auditLog.js) de biet truoc/sau the nao.
const repairRequestValidators = [
  body('customerName').trim().notEmpty().withMessage('Vui lòng nhập tên khách').isLength({ max: 150 }),
  body('phone').trim().matches(REQUEST_PHONE_RE).withMessage('Số điện thoại không hợp lệ'),
  body('imei').optional({ checkFalsy: true }).trim().isLength({ max: 50 }).withMessage('IMEI tối đa 50 ký tự'),
  body('note').optional({ checkFalsy: true }).isLength({ max: 1000 })
];

async function editRepairRequestForm(req, res, next) {
  try {
    const request = await db('repair_requests').where('id', req.params.id).first();
    if (!request) return res.redirect('/admin/sua-chua/yeu-cau');
    const items = await db('repair_request_items').where('repair_request_id', request.id);
    const editHistory = await getEditHistory('repair_request', request.id);

    res.render('admin/repair-request-edit', {
      title: 'Sửa yêu cầu sửa chữa - TOMSTORE Admin',
      request,
      items,
      editHistory,
      errors: []
    });
  } catch (err) {
    next(err);
  }
}

async function updateRepairRequest(req, res, next) {
  try {
    const request = await db('repair_requests').where('id', req.params.id).first();
    if (!request) return res.redirect('/admin/sua-chua/yeu-cau');

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const items = await db('repair_request_items').where('repair_request_id', request.id);
      const editHistory = await getEditHistory('repair_request', request.id);
      return res.status(400).render('admin/repair-request-edit', {
        title: 'Sửa yêu cầu sửa chữa - TOMSTORE Admin',
        request: { ...request, customer_name: req.body.customerName, phone: req.body.phone, imei: req.body.imei, note: req.body.note },
        items,
        editHistory,
        errors: errors.array()
      });
    }

    const newValues = {
      customer_name: req.body.customerName.trim(),
      phone: req.body.phone.trim(),
      imei: (req.body.imei || '').trim() || null,
      note: (req.body.note || '').trim() || null
    };

    await logFieldChanges('repair_request', request.id, request.request_code, request, newValues, {
      customer_name: 'Tên khách',
      phone: 'Số điện thoại',
      imei: 'IMEI',
      note: 'Ghi chú'
    });

    await db('repair_requests').where('id', request.id).update(newValues);

    res.redirect('/admin/sua-chua/yeu-cau');
  } catch (err) {
    next(err);
  }
}

// ---------- Repair history (so ghi lich su sua chua, doc lap voi Khach mua hang) ----------
// Khong doi gi o phan nay so voi truoc.

const PHONE_RE = /^(0\d{9}|\+84\d{9})$/;

const repairHistoryValidators = [
  body('repairDate').notEmpty().withMessage('Vui lòng chọn ngày sửa chữa').isISO8601().withMessage('Ngày không hợp lệ'),
  body('customerName').trim().notEmpty().withMessage('Vui lòng nhập tên khách').isLength({ max: 150 }),
  body('phone').trim().matches(PHONE_RE).withMessage('Số điện thoại không hợp lệ'),
  body('deviceName').trim().notEmpty().withMessage('Vui lòng nhập tên thiết bị').isLength({ max: 200 }),
  body('issue').trim().notEmpty().withMessage('Vui lòng nhập nội dung sửa chữa / tình trạng'),
  body('resolution').optional({ checkFalsy: true }).isLength({ max: 1000 }),
  body('cost')
    .optional({ checkFalsy: true })
    .customSanitizer((v) => String(v).replace(/[^\d]/g, ''))
    .isInt({ min: 0 })
    .withMessage('Chi phí không hợp lệ'),
  body('imei').optional({ checkFalsy: true }).isLength({ max: 50 })
];

function repairHistoryFieldsFromBody(body) {
  return {
    repair_date: body.repairDate,
    customer_name: body.customerName.trim(),
    phone: body.phone.trim(),
    imei: (body.imei || '').trim() || null,
    device_name: body.deviceName.trim(),
    issue: body.issue.trim(),
    resolution: (body.resolution || '').trim() || null,
    cost: body.cost ? Number(String(body.cost).replace(/[^\d]/g, '')) : null,
    note: (body.note || '').trim() || null
  };
}

async function queryRepairHistory(q) {
  let query = db('repair_history').orderBy('repair_date', 'desc');
  if (q) {
    query = query.where(function () {
      this.where('imei', 'like', `%${q}%`).orWhere('phone', 'like', `%${q}%`);
    });
  }
  return query;
}

// Yeu cau khach gui tu trang cong khai (repair_requests) CUNG hien len trang
// "Lich su sua chua" (truoc day chi co 1 so ghi thu cong, khach gui tu trang
// web phai qua rieng trang "Khach sua chua" moi thay) -- gom chung lai de
// admin tra cuu lich su 1 khach/so dien thoai o 1 cho duy nhat. KHONG copy
// du lieu sang bang repair_history, chi doc-hien-thi, nguon that su van la
// repair_requests/repair_request_items; quan ly trang thai/xoa yeu cau VAN
// lam o trang "Khach sua chua" nhu cu.
async function queryWebsiteRepairRows(q) {
  let query = db('repair_requests').orderBy('created_at', 'desc');
  if (q) {
    query = query.where(function () {
      this.where('phone', 'like', `%${q}%`).orWhere('customer_name', 'like', `%${q}%`).orWhere('imei', 'like', `%${q}%`);
    });
  }
  const requests = await query;
  if (requests.length === 0) return [];

  const requestIds = requests.map((r) => r.id);
  const allItems = await db('repair_request_items').whereIn('repair_request_id', requestIds);
  const itemsByRequest = {};
  allItems.forEach((it) => {
    if (!itemsByRequest[it.repair_request_id]) itemsByRequest[it.repair_request_id] = [];
    itemsByRequest[it.repair_request_id].push(it);
  });

  return requests.map((r) => {
    const items = itemsByRequest[r.id] || [];
    return {
      source: 'website',
      id: r.id,
      requestCode: r.request_code,
      repair_date: r.created_at,
      customer_name: r.customer_name,
      phone: r.phone,
      imei: r.imei || null,
      device_name: items.length ? items[0].device_name : '-',
      issue: items.length ? items.map((it) => it.service_name + ' - ' + it.variant_label).join('; ') : '-',
      resolution: statusLabel(r.status),
      cost: r.total_price,
      note: r.note
    };
  });
}

async function buildHistoryRows(q) {
  const [manualRows, websiteRows] = await Promise.all([queryRepairHistory(q), queryWebsiteRepairRows(q)]);
  const combined = manualRows.map((h) => ({ ...h, source: 'manual' })).concat(websiteRows);
  combined.sort((a, b) => new Date(b.repair_date) - new Date(a.repair_date));
  return combined;
}

async function listRepairHistory(req, res, next) {
  try {
    const q = (req.query.q || '').trim();
    const history = await buildHistoryRows(q);

    res.render('admin/repair-history', {
      title: 'Lịch sử sửa chữa - TOMSTORE Admin',
      history,
      q,
      errors: [],
      historyForm: {}
    });
  } catch (err) {
    next(err);
  }
}

async function createRepairHistory(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const q = (req.query.q || '').trim();
      const history = await buildHistoryRows(q);
      return res.status(400).render('admin/repair-history', {
        title: 'Lịch sử sửa chữa - TOMSTORE Admin',
        history,
        q,
        errors: errors.array(),
        historyForm: req.body
      });
    }

    await db('repair_history').insert(repairHistoryFieldsFromBody(req.body));
    res.redirect('/admin/sua-chua/lich-su');
  } catch (err) {
    next(err);
  }
}

async function editRepairHistoryForm(req, res, next) {
  try {
    const entry = await db('repair_history').where('id', req.params.id).first();
    if (!entry) return res.redirect('/admin/sua-chua/lich-su');

    res.render('admin/repair-history-edit', {
      title: 'Sửa lịch sử sửa chữa - TOMSTORE Admin',
      entry: { ...entry, repair_date: toDateInputValue(entry.repair_date) },
      errors: []
    });
  } catch (err) {
    next(err);
  }
}

async function updateRepairHistory(req, res, next) {
  try {
    const entry = await db('repair_history').where('id', req.params.id).first();
    if (!entry) return res.redirect('/admin/sua-chua/lich-su');

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).render('admin/repair-history-edit', {
        title: 'Sửa lịch sử sửa chữa - TOMSTORE Admin',
        entry: { ...entry, ...req.body, id: entry.id },
        errors: errors.array()
      });
    }

    await db('repair_history').where('id', entry.id).update(repairHistoryFieldsFromBody(req.body));
    res.redirect('/admin/sua-chua/lich-su');
  } catch (err) {
    next(err);
  }
}

async function deleteRepairHistory(req, res, next) {
  try {
    await db('repair_history').where('id', req.params.id).del();
    res.redirect('/admin/sua-chua/lich-su');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listRepairServices,
  newRepairServiceForm,
  createRepairService,
  editRepairServiceForm,
  updateRepairService,
  deleteRepairService,
  listRepairDevices,
  newRepairDeviceForm,
  createRepairDevice,
  listCatalogRepairDevices,
  updateCatalogRepairDevices,
  editRepairDeviceForm,
  updateRepairDevice,
  deleteRepairDevice,
  saveDeviceServices,
  listRepairRequests,
  updateRepairRequestStatus,
  deleteRepairRequest,
  repairRequestValidators,
  editRepairRequestForm,
  updateRepairRequest,
  repairHistoryValidators,
  listRepairHistory,
  createRepairHistory,
  editRepairHistoryForm,
  updateRepairHistory,
  deleteRepairHistory
};
