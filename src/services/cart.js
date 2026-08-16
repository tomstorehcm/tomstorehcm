const db = require('../db');

function ensureCart(req) {
  if (!req.session.cart) {
    req.session.cart = {};
  }
  return req.session.cart;
}

function cartKey(productId, variantId) {
  return variantId ? `${productId}:${variantId}` : String(productId);
}

function parseKey(key) {
  const [productIdStr, variantIdStr] = key.split(':');
  return { productId: Number(productIdStr), variantId: variantIdStr ? Number(variantIdStr) : null };
}

function addItem(req, productId, quantity, variantId) {
  const cart = ensureCart(req);
  const key = cartKey(productId, variantId);
  cart[key] = (cart[key] || 0) + quantity;
  if (cart[key] < 1) delete cart[key];
}

function setQuantity(req, productId, quantity, variantId) {
  const cart = ensureCart(req);
  const key = cartKey(productId, variantId);
  if (quantity <= 0) {
    delete cart[key];
  } else {
    cart[key] = quantity;
  }
}

function removeItem(req, productId, variantId) {
  const cart = ensureCart(req);
  delete cart[cartKey(productId, variantId)];
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

  const products = await db('products').whereIn('id', productIds);
  const productMap = new Map(products.map((p) => [p.id, p]));

  const variants = variantIds.length > 0 ? await db('product_variants').whereIn('id', variantIds) : [];
  const variantMap = new Map(variants.map((v) => [v.id, v]));

  const items = [];
  let total = 0;
  let count = 0;

  for (const { key, productId, variantId } of parsed) {
    const qty = cart[key];
    const product = productMap.get(productId);
    if (!product) continue;
    const variant = variantId ? variantMap.get(variantId) : null;
    if (variantId && !variant) continue;

    const unitPrice = variant ? variant.price : (product.sale_price || product.price);
    const lineTotal = unitPrice * qty;
    total += lineTotal;
    count += qty;
    items.push({
      product,
      variant,
      quantity: qty,
      unitPrice,
      lineTotal
    });
  }

  return { items, total, count };
}

module.exports = {
  addItem,
  setQuantity,
  removeItem,
  clearCart,
  cartCount,
  getCartDetails
};
