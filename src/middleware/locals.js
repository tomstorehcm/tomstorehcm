const db = require('../db');
const cartService = require('../services/cart');
const { formatVND, discountPercent } = require('../utils/format');
const { categoryIcon } = require('../utils/icons');
const { getIconSvg } = require('../utils/policyIcons');

async function attachLocals(req, res, next) {
  try {
    // Every page shows the cart badge, so any page could be served stale by
    // the browser's back-forward cache after the cart changes elsewhere.
    res.set('Cache-Control', 'no-store');
    const categories = await db('categories').orderBy('sort_order');
    res.locals.categories = categories;
    res.locals.categoriesById = Object.fromEntries(categories.map((c) => [c.id, c]));
    // getCartDetails self-heals stale session entries (e.g. products deleted
    // since the item was added), so the badge never disagrees with the cart page.
    const cart = await cartService.getCartDetails(req);
    res.locals.cartCount = cart.count;
    res.locals.cart = cart;
    res.locals.storeName = 'TOMSTORE';
    res.locals.hotline = process.env.STORE_HOTLINE || '';
    res.locals.currentPath = req.path;
    res.locals.formatVND = formatVND;
    res.locals.discountPercent = discountPercent;
    res.locals.categoryIcon = categoryIcon;
    res.locals.getPolicyIcon = getIconSvg;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = attachLocals;
