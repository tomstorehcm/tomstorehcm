const db = require('../db');

function ensureCart(req) {
  if (!req.session.cart) {
    req.session.cart = {};
  }
  return req.session.cart;
}

function addItem(req, productId, quantity) {
  const cart = ensureCart(req);
  const id = String(productId);
  cart[id] = (cart[id] || 0) + quantity;
  if (cart[id] < 1) delete cart[id];
}

function setQuantity(req, productId, quantity) {
  const cart = ensureCart(req);
  const id = String(productId);
  if (quantity <= 0) {
    delete cart[id];
  } else {
    cart[id] = quantity;
  }
}

function removeItem(req, productId) {
  const cart = ensureCart(req);
  delete cart[String(productId)];
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
  const ids = Object.keys(cart).map(Number).filter(Boolean);
  if (ids.length === 0) {
    return { items: [], total: 0, count: 0 };
  }

  const products = await db('products').whereIn('id', ids);
  const productMap = new Map(products.map((p) => [p.id, p]));

  const items = [];
  let total = 0;
  let count = 0;

  for (const [idStr, qty] of Object.entries(cart)) {
    const product = productMap.get(Number(idStr));
    if (!product) continue;
    const unitPrice = product.sale_price || product.price;
    const lineTotal = unitPrice * qty;
    total += lineTotal;
    count += qty;
    items.push({
      product,
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
