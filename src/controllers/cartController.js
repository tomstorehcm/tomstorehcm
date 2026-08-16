const db = require('../db');
const cartService = require('../services/cart');
const { formatVND } = require('../utils/format');

function wantsJson(req) {
  return req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') > -1);
}

async function showCart(req, res, next) {
  try {
    const cart = await cartService.getCartDetails(req);
    res.render('cart', {
      title: 'Giỏ hàng - TOMSTORE',
      cart
    });
  } catch (err) {
    next(err);
  }
}

async function addToCart(req, res, next) {
  try {
    const productId = Number(req.body.productId);
    const quantity = Math.max(1, Number(req.body.quantity) || 1);

    const product = await db('products').where('id', productId).first();
    if (!product || product.is_contact_price) {
      if (wantsJson(req)) return res.status(404).json({ success: false });
      return res.status(404).redirect('/');
    }

    cartService.addItem(req, productId, quantity);

    if (wantsJson(req)) {
      return res.json({ success: true, cartCount: cartService.cartCount(req) });
    }
    res.redirect(req.body.redirectTo || '/gio-hang');
  } catch (err) {
    next(err);
  }
}

async function updateCart(req, res, next) {
  try {
    const productId = Number(req.body.productId);
    const quantity = Number(req.body.quantity);
    cartService.setQuantity(req, productId, quantity);

    if (wantsJson(req)) {
      const cart = await cartService.getCartDetails(req);
      const item = cart.items.find((i) => i.product.id === productId);
      return res.json({
        success: true,
        cartCount: cart.count,
        total: cart.total,
        formattedTotal: formatVND(cart.total),
        isEmpty: cart.items.length === 0,
        lineTotal: item ? item.lineTotal : 0,
        formattedLineTotal: item ? formatVND(item.lineTotal) : null
      });
    }
    res.redirect('/gio-hang');
  } catch (err) {
    next(err);
  }
}

async function removeFromCart(req, res, next) {
  try {
    const productId = Number(req.body.productId);
    cartService.removeItem(req, productId);

    if (wantsJson(req)) {
      const cart = await cartService.getCartDetails(req);
      return res.json({
        success: true,
        cartCount: cart.count,
        total: cart.total,
        formattedTotal: formatVND(cart.total),
        isEmpty: cart.items.length === 0
      });
    }
    res.redirect('/gio-hang');
  } catch (err) {
    next(err);
  }
}

module.exports = { showCart, addToCart, updateCart, removeFromCart };
