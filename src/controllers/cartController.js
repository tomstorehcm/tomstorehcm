const db = require('../db');
const cartService = require('../services/cart');
const { formatVND } = require('../utils/format');
const { MAX_QTY_PER_ITEM } = require('../utils/constants');

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
    const variantId = parseVariantId(req.body);
    const colorId = parseColorId(req.body);
    const quantity = Math.min(MAX_QTY_PER_ITEM, Math.max(1, Number(req.body.quantity) || 1));

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
      if (!color || !color.in_stock) {
        if (wantsJson(req)) return res.status(404).json({ success: false });
        return res.status(404).redirect('/');
      }
    }

    cartService.addItem(req, productId, quantity, variantId, colorId, MAX_QTY_PER_ITEM);

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
    const variantId = parseVariantId(req.body);
    const colorId = parseColorId(req.body);
    const quantity = Math.min(MAX_QTY_PER_ITEM, Number(req.body.quantity));
    cartService.setQuantity(req, productId, quantity, variantId, colorId);

    if (wantsJson(req)) {
      const cart = await cartService.getCartDetails(req);
      const item = cart.items.find(
        (i) =>
          i.product.id === productId &&
          (i.variant ? i.variant.id : null) === variantId &&
          (i.color ? i.color.id : null) === colorId
      );
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

module.exports = { showCart, addToCart, updateCart, removeFromCart };
