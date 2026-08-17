const db = require('../db');

function ensureCart(req) {
  if (!req.session.cart) {
    req.session.cart = {};
  }
  return req.session.cart;
}

function cartKey(productId, variantId, colorId) {
  return [productId, variantId || '', colorId || ''].join(':');
}

function parseKey(key) {
  const [productIdStr, variantIdStr, colorIdStr] = key.split(':');
  return {
    productId: Number(productIdStr),
    variantId: variantIdStr ? Number(variantIdStr) : null,
    colorId: colorIdStr ? Number(colorIdStr) : null
  };
}

function addItem(req, productId, variantId, colorId) {
  const cart = ensureCart(req);
  cart[cartKey(productId, variantId, colorId)] = 1;
}

function removeItem(req, productId, variantId, colorId) {
  const cart = ensureCart(req);
  delete cart[cartKey(productId, variantId, colorId)];
}

function clearCart(req) {
  req.session.cart = {};
}

function cartCount(req) {
  const cart = req.session.cart || {};
  return Object.values(cart).reduce((sum, qty) => sum + qty, 0);
}

async function getCartDetails(req) {
  const cart = ensureCart(req);
  const keys = Object.keys(cart);
  if (keys.length === 0) {
    return { items: [], total: 0, count: 0 };
  }

  const parsed = keys.map((key) => ({ key, ...parseKey(key) }));
  const productIds = [...new Set(parsed.map((p) => p.productId))].filter(Boolean);
  const variantIds = [...new Set(parsed.filter((p) => p.variantId).map((p) => p.variantId))];
  const colorIds = [...new Set(parsed.filter((p) => p.colorId).map((p) => p.colorId))];

  const products = await db('products').whereIn('id', productIds);
  const productMap = new Map(products.map((p) => [p.id, p]));

  const variants = variantIds.length > 0 ? await db('product_variants').whereIn('id', variantIds) : [];
  const variantMap = new Map(variants.map((v) => [v.id, v]));

  const colors = colorIds.length > 0 ? await db('product_colors').whereIn('id', colorIds) : [];
  const colorMap = new Map(colors.map((c) => [c.id, c]));

  const items = [];
  let total = 0;
  let count = 0;

  for (const { key, productId, variantId, colorId } of parsed) {
    const qty = cart[key];
    const product = productMap.get(productId);
    if (!product) { delete cart[key]; continue; }
    const variant = variantId ? variantMap.get(variantId) : null;
    if (variantId && !variant) { delete cart[key]; continue; }
    const color = colorId ? colorMap.get(colorId) : null;
    if (colorId && !color) { delete cart[key]; continue; }

    const unitPrice = (color && color.price != null) ? color.price : (variant ? variant.price : (product.sale_price || product.price));
    const lineTotal = unitPrice * qty;
    total += lineTotal;
    count += qty;
    items.push({
      product,
      variant,
      color,
      quantity: qty,
      unitPrice,
      lineTotal
    });
  }

  return { items, total, count };
}

module.exports = {
  addItem,
  removeItem,
  clearCart,
  cartCount,
  getCartDetails
};
