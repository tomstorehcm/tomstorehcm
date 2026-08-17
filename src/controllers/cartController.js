const db = require('../db');
const cartService = require('../services/cart');
const { formatVND } = require('../utils/format');

function wantsJson(req) {
  return req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') > -1);
}

function parseVariantId(body) {
  return body.variantId ? Number(body.variantId) : null;
}

function parseColorId(body) {
  return body.colorId ? Number(body.colorId) : null;
}

async function showCart(req, res, next) {
  try {
    delete req.session.buyNow;
    const cart = res.locals.cart || (await cartService.getCartDetails(req));
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
    const variantId = parseVariantId(req.body);
    const colorId = parseColorId(req.body);

    const product = await db('products').where('id', productId).first();
    if (!product || product.is_contact_price || !product.in_stock) {
      if (wantsJson(req)) return res.status(404).json({ success: false });
      return res.status(404).redirect('/');
    }

    if (variantId) {
      const variant = await db('product_variants').where({ id: variantId, product_id: productId }).first();
      if (!variant || !variant.in_stock) {
        if (wantsJson(req)) return res.status(404).json({ success: false });
        return res.status(404).redirect('/');
      }
    }

    if (colorId) {
      const color = await db('product_colors').where({ id: colorId, product_id: productId }).first();
      if (!color || !color.in_stock || (color.variant_id && color.variant_id !== variantId)) {
        if (wantsJson(req)) return res.status(404).json({ success: false });
        return res.status(404).redirect('/');
      }
    }

    cartService.addItem(req, productId, variantId, colorId);

    if (wantsJson(req)) {
      return res.json({ success: true, cartCount: cartService.cartCount(req) });
    }
    res.redirect(req.body.redirectTo || '/gio-hang');
  } catch (err) {
    next(err);
  }
}

async function removeFromCart(req, res, next) {
  try {
    const productId = Number(req.body.productId);
    const variantId = parseVariantId(req.body);
    const colorId = parseColorId(req.body);
    cartService.removeItem(req, productId, variantId, colorId);

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

module.exports = { showCart, addToCart, removeFromCart };
