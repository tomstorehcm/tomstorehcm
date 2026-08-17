const { body, validationResult } = require('express-validator');
const db = require('../db');
const cartService = require('../services/cart');
const paymentService = require('../services/payment');
const { generateOrderCode } = require('../utils/format');
const { getDefaultPolicies } = require('../services/policies');

function buildOrderItemName(item) {
  const parts = [];
  if (item.variant) parts.push(item.variant.label);
  if (item.color) parts.push(item.color.name);
  return parts.length > 0 ? `${item.product.name} (${parts.join(', ')})` : item.product.name;
}

async function resolveBuyNowCart(buyNow) {
  const product = await db('products').where('id', buyNow.productId).first();
  if (!product) return null;

  const variant = buyNow.variantId
    ? await db('product_variants').where({ id: buyNow.variantId, product_id: buyNow.productId }).first()
    : null;
  if (buyNow.variantId && !variant) return null;

  const color = buyNow.colorId
    ? await db('product_colors').where({ id: buyNow.colorId, product_id: buyNow.productId }).first()
    : null;
  if (buyNow.colorId && !color) return null;

  const unitPrice = (color && color.price != null) ? color.price : (variant ? variant.price : (product.sale_price || product.price));
  const quantity = buyNow.quantity;
  const lineTotal = unitPrice * quantity;

  return {
    items: [{ product, variant, color, quantity, unitPrice, lineTotal }],
    total: lineTotal,
    count: quantity
  };
}

async function getActiveCart(req) {
  if (req.session.buyNow) {
    const buyNowCart = await resolveBuyNowCart(req.session.buyNow);
    if (buyNowCart) return { cart: buyNowCart, isBuyNow: true };
    delete req.session.buyNow;
  }
  const cart = await cartService.getCartDetails(req);
  return { cart, isBuyNow: false };
}

async function buyNow(req, res, next) {
  try {
    const productId = Number(req.body.productId);
    const variantId = req.body.variantId ? Number(req.body.variantId) : null;
    const colorId = req.body.colorId ? Number(req.body.colorId) : null;

    const product = await db('products').where('id', productId).first();
    if (!product || product.is_contact_price || !product.in_stock) {
      return res.status(404).redirect('/');
    }

    if (variantId) {
      const variant = await db('product_variants').where({ id: variantId, product_id: productId }).first();
      if (!variant || !variant.in_stock) return res.status(404).redirect('/');
    }

    if (colorId) {
      const color = await db('product_colors').where({ id: colorId, product_id: productId }).first();
      if (!color || !color.in_stock || (color.variant_id && color.variant_id !== variantId)) return res.status(404).redirect('/');
    }

    req.session.buyNow = { productId, variantId, colorId, quantity: 1 };
    res.redirect('/thanh-toan');
  } catch (err) {
    next(err);
  }
}

async function showCheckout(req, res, next) {
  try {
    res.set('Cache-Control', 'no-store');
    const { cart } = await getActiveCart(req);
    if (cart.items.length === 0) {
      return res.redirect('/gio-hang');
    }

    const policies = await getDefaultPolicies();

    res.render('checkout', {
      title: 'Thanh toán - TOMSTORE',
      cart,
      methods: paymentService.listMethods(),
      errors: [],
      formData: {},
      policies
    });
  } catch (err) {
    next(err);
  }
}

const checkoutValidators = [
  body('customerName').trim().notEmpty().withMessage('Vui lòng nhập họ tên').isLength({ max: 150 }),
  body('phone').trim().matches(/^(0\d{9}|\+84\d{9})$/).withMessage('Số điện thoại không hợp lệ'),
  body('address').trim().notEmpty().withMessage('Vui lòng nhập địa chỉ giao hàng').isLength({ max: 300 }),
  body('paymentMethod').isIn(['cod']).withMessage('Phương thức thanh toán không hợp lệ')
];

async function submitOrder(req, res, next) {
  try {
    const { cart, isBuyNow } = await getActiveCart(req);
    if (cart.items.length === 0) {
      return res.redirect('/gio-hang');
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const policies = await getDefaultPolicies();
      return res.status(400).render('checkout', {
        title: 'Thanh toán - TOMSTORE',
        cart,
        methods: paymentService.listMethods(),
        errors: errors.array(),
        formData: req.body,
        policies
      });
    }

    const orderCode = generateOrderCode();

    const [orderId] = await db('orders').insert({
      order_code: orderCode,
      customer_name: req.body.customerName,
      phone: req.body.phone,
      address: req.body.address,
      note: req.body.note || null,
      payment_method: req.body.paymentMethod,
      status: 'pending',
      total: cart.total
    });

    const insertedOrderId = orderId && orderId.id ? orderId.id : orderId;

    for (const item of cart.items) {
      await db('order_items').insert({
        order_id: insertedOrderId,
        product_id: item.product.id,
        product_name: buildOrderItemName(item),
        price: item.unitPrice,
        quantity: item.quantity
      });
    }

    if (isBuyNow) {
      delete req.session.buyNow;
    } else {
      cartService.clearCart(req);
    }
    res.redirect(`/don-hang/${orderCode}`);
  } catch (err) {
    next(err);
  }
}

async function showConfirmation(req, res, next) {
  try {
    const order = await db('orders').where('order_code', req.params.code).first();
    if (!order) {
      return res.status(404).render('error', {
        title: 'Không tìm thấy đơn hàng',
        statusCode: 404,
        message: 'Đơn hàng không tồn tại.'
      });
    }

    const items = await db('order_items').where('order_id', order.id);
    const instructions = paymentService.getInstructions(order);

    res.render('order-confirmation', {
      title: `Đơn hàng ${order.order_code} - TOMSTORE`,
      order,
      items,
      instructions
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { showCheckout, checkoutValidators, submitOrder, showConfirmation, buyNow };
