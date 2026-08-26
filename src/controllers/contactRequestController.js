const { body, validationResult } = require('express-validator');
const db = require('../db');
const { generateOrderCode } = require('../utils/format');
const { DEFAULT_STATUS } = require('../utils/orderStatus');

// Resolves whichever product/variant/color/group the "Liên hệ" button was
// clicked from, so the request can show that context to the customer and be
// saved for staff to see exactly what the customer was asking about.
async function resolveProductContext(query) {
  const productId = Number(query.productId);
  const product = await db('products').where('id', productId).first();
  if (!product) return null;

  const variant = query.variantId
    ? await db('product_variants').where({ id: Number(query.variantId), product_id: productId }).first()
    : null;
  const color = query.colorId
    ? await db('product_colors').where({ id: Number(query.colorId), product_id: productId }).first()
    : null;
  const group = variant && variant.variant_group_id
    ? await db('product_variant_groups').where('id', variant.variant_group_id).first()
    : null;

  return { product, variant, color, group };
}

function buildContextLabel(ctx) {
  const parts = [];
  if (ctx.group) parts.push(ctx.group.name);
  if (ctx.variant) parts.push(ctx.variant.label);
  if (ctx.color) parts.push(ctx.color.name);
  return parts.length > 0 ? `${ctx.product.name} (${parts.join(', ')})` : ctx.product.name;
}

async function showContactRequestForm(req, res, next) {
  try {
    const ctx = await resolveProductContext(req.query);
    if (!ctx) return res.redirect('/');

    res.render('contact-request', {
      title: `Liên hệ báo giá ${ctx.product.name} - TOMSTORE`,
      product: ctx.product,
      contextLabel: buildContextLabel(ctx),
      productId: req.query.productId,
      variantId: req.query.variantId || '',
      colorId: req.query.colorId || '',
      errors: [],
      formData: {}
    });
  } catch (err) {
    next(err);
  }
}

const contactRequestValidators = [
  body('customerName').trim().notEmpty().withMessage('Vui lòng nhập họ tên').isLength({ max: 150 }),
  body('phone').trim().matches(/^(0\d{9}|\+84\d{9})$/).withMessage('Số điện thoại không hợp lệ')
];

async function submitContactRequest(req, res, next) {
  try {
    const ctx = await resolveProductContext(req.body);
    if (!ctx) return res.redirect('/');

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).render('contact-request', {
        title: `Liên hệ báo giá ${ctx.product.name} - TOMSTORE`,
        product: ctx.product,
        contextLabel: buildContextLabel(ctx),
        productId: req.body.productId,
        variantId: req.body.variantId || '',
        colorId: req.body.colorId || '',
        errors: errors.array(),
        formData: req.body
      });
    }

    const orderCode = generateOrderCode();
    const [insertedRaw] = await db('orders').insert({
      order_code: orderCode,
      customer_name: req.body.customerName,
      phone: req.body.phone,
      address: '',
      note: req.body.note || null,
      payment_method: 'cod',
      status: DEFAULT_STATUS,
      total: 0,
      order_type: 'lien_he'
    });
    const orderId = insertedRaw && insertedRaw.id ? insertedRaw.id : insertedRaw;

    await db('order_items').insert({
      order_id: orderId,
      product_id: ctx.product.id,
      product_name: buildContextLabel(ctx),
      price: 0,
      quantity: 1
    });

    res.redirect(`/lien-he-bao-gia/${orderCode}`);
  } catch (err) {
    next(err);
  }
}

async function showContactRequestConfirmation(req, res, next) {
  try {
    const order = await db('orders').where({ order_code: req.params.code, order_type: 'lien_he' }).first();
    if (!order) {
      return res.status(404).render('error', {
        title: 'Không tìm thấy yêu cầu',
        statusCode: 404,
        message: 'Yêu cầu liên hệ không tồn tại.'
      });
    }
    const items = await db('order_items').where('order_id', order.id);

    res.render('contact-request-confirmation', {
      title: 'Đã gửi yêu cầu liên hệ - TOMSTORE',
      order,
      items
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  showContactRequestForm,
  contactRequestValidators,
  submitContactRequest,
  showContactRequestConfirmation
};
