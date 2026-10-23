const { body, validationResult } = require('express-validator');
const db = require('../db');
const { generateOrderCode } = require('../utils/format');

// Flow moi (giong trade-in): khach chon 1 SAN PHAM (dong may) TRUOC tren
// luoi chinh cua trang (giong y het buoc 1 cua trade-in), roi trong modal
// nhieu buoc: chon (tich) 1 hay nhieu DICH VU ap dung cho san pham do, sau
// do lan luot 1 buoc "chon loai" cho TUNG dich vu da chon, cuoi cung la
// buoc thong tin lien he (tom tat gia + gui yeu cau qua fetch JSON, dung
// y het /thu-cu-doi-moi). Toan bo du lieu (san pham + dich vu + gia) duoc
// nhung san thanh 1 JSON blob ngay trong trang de JS tu xu ly tung buoc,
// khong can round-trip len server giua cac buoc.
async function loadRepairFlowData() {
  const devices = await db('repair_devices as rd')
    .leftJoin('products as p', 'p.id', 'rd.product_id')
    .where('rd.is_active', true)
    .orderBy(['rd.sort_order', 'rd.id'])
    .select(
      'rd.id',
      db.raw('COALESCE(p.name, rd.name) as name'),
      db.raw('COALESCE(p.image_url, rd.image_url) as image_url')
    );
  const deviceIds = devices.map((d) => d.id);

  const serviceDeviceRows = deviceIds.length
    ? await db('repair_service_devices as sd')
        .join('repair_services as s', 's.id', 'sd.repair_service_id')
        .whereIn('sd.repair_device_id', deviceIds)
        .where('s.is_active', true)
        .select('sd.repair_device_id', 'sd.repair_service_id')
    : [];

  const activeServiceIds = [...new Set(serviceDeviceRows.map((r) => r.repair_service_id))];

  const services = activeServiceIds.length
    ? await db('repair_services').whereIn('id', activeServiceIds).orderBy(['sort_order', 'id'])
    : [];

  const variants = activeServiceIds.length
    ? await db('repair_variants').whereIn('repair_service_id', activeServiceIds).orderBy(['repair_service_id', 'sort_order', 'id'])
    : [];
  const variantIds = variants.map((v) => v.id);

  const prices = variantIds.length && deviceIds.length
    ? await db('repair_variant_prices').whereIn('repair_variant_id', variantIds).whereIn('repair_device_id', deviceIds)
    : [];

  // Chi giu lai san pham co it nhat 1 dich vu da duoc nhap gia -- san pham
  // chua co gia nao thi an di, khach se khong chon nham muc chua khai bao.
  const repairDevices = devices
    .map((d) => ({
      id: d.id,
      name: d.name,
      imageUrl: d.image_url,
      serviceIds: [...new Set(
        serviceDeviceRows.filter((r) => r.repair_device_id === d.id).map((r) => r.repair_service_id)
      )]
    }))
    .filter((d) => d.serviceIds.some((sid) =>
      prices.some((p) => p.repair_device_id === d.id && variants.some((v) => v.id === p.repair_variant_id && v.repair_service_id === sid))
    ));

  const repairServices = services.map((s) => ({
    id: s.id,
    name: s.name,
    variants: variants
      .filter((v) => v.repair_service_id === s.id)
      .map((v) => ({ id: v.id, label: v.label, description: v.description, imageUrl: v.image_url }))
  }));

  // imageUrl o day la anh RIENG cho dung cap (Loai, san pham) nay (vd man
  // hinh/pin dung hang khac cho may nay) -- co the null, luc do trang cong
  // khai tu fallback ve anh mac dinh cua chinh "Loai" do (repairServices[].
  // variants[].imageUrl).
  const repairPrices = prices.map((p) => ({
    deviceId: p.repair_device_id,
    variantId: p.repair_variant_id,
    price: p.price,
    imageUrl: p.image_url || null
  }));

  return { repairDevices, repairServices, repairPrices };
}

async function showRepairPage(req, res, next) {
  try {
    const { repairDevices, repairServices, repairPrices } = await loadRepairFlowData();
    res.render('repair', {
      title: 'REPAIRING - TOMSTORE',
      repairDevices,
      repairServices,
      repairPrices
    });
  } catch (err) {
    next(err);
  }
}

const repairRequestValidators = [
  body('customerName').trim().notEmpty().withMessage('Vui lòng nhập họ tên').isLength({ max: 150 }),
  body('phone').trim().matches(/^(0\d{9}|\+84\d{9})$/).withMessage('Số điện thoại không hợp lệ'),
  body('deviceId').isInt().withMessage('Vui lòng chọn sản phẩm')
];

// Client gui len: deviceId (1 san pham duy nhat cho ca yeu cau) + selections
// (JSON string mang [{serviceId, variantId}, ...]). Giong tinh than
// submitTradeInRequest: KHONG tin bat ky gia/ten nao tu client, moi thu deu
// duoc tra cuu + doi chieu lai tu DB bang chinh id gui len (san pham phai
// dang hien, dich vu phai ap dung cho san pham, loai phai thuoc dich vu, va
// phai CO gia da nhap cho dung cap san pham+loai do).
async function submitRepairRequest(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ ok: false, errors: errors.array() });
    }

    const device = await db('repair_devices as rd')
      .leftJoin('products as p', 'p.id', 'rd.product_id')
      .where('rd.id', req.body.deviceId)
      .where('rd.is_active', true)
      .select('rd.id', db.raw('COALESCE(p.name, rd.name) as name'))
      .first();
    if (!device) {
      return res.status(400).json({ ok: false, errors: [{ msg: 'Sản phẩm không hợp lệ, vui lòng chọn lại.' }] });
    }

    let selectionsRaw;
    try {
      selectionsRaw = JSON.parse(req.body.selections || '[]');
    } catch (parseErr) {
      selectionsRaw = [];
    }
    if (!Array.isArray(selectionsRaw) || selectionsRaw.length === 0) {
      return res.status(400).json({ ok: false, errors: [{ msg: 'Vui lòng chọn ít nhất 1 dịch vụ sửa chữa.' }] });
    }

    const resolved = [];
    for (const sel of selectionsRaw) {
      const serviceId = Number(sel && sel.serviceId);
      const variantId = Number(sel && sel.variantId);
      if (!serviceId || !variantId) continue;

      const applies = await db('repair_service_devices')
        .where({ repair_service_id: serviceId, repair_device_id: device.id })
        .first();
      if (!applies) continue;

      const service = await db('repair_services').where({ id: serviceId, is_active: true }).first();
      if (!service) continue;

      const variant = await db('repair_variants').where({ id: variantId, repair_service_id: serviceId }).first();
      if (!variant) continue;

      const priceRow = await db('repair_variant_prices')
        .where({ repair_variant_id: variantId, repair_device_id: device.id })
        .first();
      if (!priceRow) continue;

      resolved.push({ service, variant, price: priceRow.price });
    }

    if (resolved.length === 0) {
      return res.status(400).json({ ok: false, errors: [{ msg: 'Vui lòng chọn lại dịch vụ, lựa chọn vừa gửi không còn hợp lệ.' }] });
    }

    const totalPrice = resolved.reduce((sum, r) => sum + r.price, 0);

    let requestCode = generateOrderCode();
    while (await db('repair_requests').where('request_code', requestCode).first()) {
      requestCode = generateOrderCode();
    }

    const [insertedRaw] = await db('repair_requests').insert({
      request_code: requestCode,
      customer_name: req.body.customerName.trim(),
      phone: req.body.phone.trim(),
      total_price: totalPrice,
      note: (req.body.note || '').trim() || null
    });
    const requestId = insertedRaw && insertedRaw.id ? insertedRaw.id : insertedRaw;

    await db('repair_request_items').insert(
      resolved.map((r) => ({
        repair_request_id: requestId,
        repair_service_id: r.service.id,
        service_name: r.service.name,
        repair_device_id: device.id,
        device_name: device.name,
        repair_variant_id: r.variant.id,
        variant_label: r.variant.label,
        price: r.price
      }))
    );

    res.json({ ok: true, redirectUrl: `/sua-chua/xac-nhan/${requestCode}` });
  } catch (err) {
    next(err);
  }
}

async function showRepairConfirmation(req, res, next) {
  try {
    const request = await db('repair_requests').where('request_code', req.params.code).first();
    if (!request) {
      return res.status(404).render('error', {
        title: 'Không tìm thấy yêu cầu',
        statusCode: 404,
        message: 'Yêu cầu sửa chữa không tồn tại.'
      });
    }
    const items = await db('repair_request_items').where('repair_request_id', request.id);

    res.render('repair-confirmation', {
      title: 'Đã gửi yêu cầu sửa chữa - TOMSTORE',
      request,
      items
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  showRepairPage,
  repairRequestValidators,
  submitRepairRequest,
  showRepairConfirmation
};
