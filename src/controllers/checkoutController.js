const { body, validationResult } = require('express-validator');
const db = require('../db');
const cartService = require('../services/cart');
const paymentService = require('../services/payment');
const { generateOrderCode } = require('../utils/format');

async function showCheckout(req, res, next) {
  try {
    const cart = await cartService.getCartDetails(req);
    if (cart.items.length === 0) {
      return res.redirect('/gio-hang');
    }

    res.render('checkout', {
      title: 'Thanh toán - TOMSTORE',
      cart,
      methods: paymentService.listMethods(),
      errors: [],
      formData: {}
    });
  } catch (err) {
    next(err);
  }
}

const checkoutValidators = [
  body('customerName').trim().notEmpty().withMessage('Vui lòng nhập họ tên').isLength({ max: 150 }),
  body('phone').trim().matches(/^(0\d{9}|\+84\d{9})$/).withMessage('Số điện thoại không hợp lệ'),
  body('address').trim().notEmpty().withMessage('Vui lòng nhập địa chỉ giao hàng').isLength({ max: 300 }),
  body('paymentMethod').isIn(['cod', 'bank_transfer']).withMessage('Phương thức thanh toán không hợp lệ')
];

async function submitOrder(req, res, next) {
  try {
    const cart = await cartService.getCartDetails(req);
    if (cart.items.length === 0) {
      return res.redirect('/gio-hang');
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).render('checkout', {
        title: 'Thanh toán - TOMSTORE',
        cart,
        methods: paymentService.listMethods(),
        errors: errors.array(),
        formData: req.body
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
        product_name: item.product.name,
        price: item.unitPrice,
        quantity: item.quantity
      });
    }

    cartService.clearCart(req);
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

module.exports = { showCheckout, checkoutValidators, submitOrder, showConfirmation };
