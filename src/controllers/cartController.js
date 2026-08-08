const db = require('../db');
const cartService = require('../services/cart');

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
    if (!product) {
      return res.status(404).redirect('/');
    }

    cartService.addItem(req, productId, quantity);
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
    res.redirect('/gio-hang');
  } catch (err) {
    next(err);
  }
}

async function removeFromCart(req, res, next) {
  try {
    const productId = Number(req.body.productId);
    cartService.removeItem(req, productId);
    res.redirect('/gio-hang');
  } catch (err) {
    next(err);
  }
}

module.exports = { showCart, addToCart, updateCart, removeFromCart };
