const db = require('../db');
const cartService = require('../services/cart');
const { formatVND, discountPercent } = require('../utils/format');
const { categoryIcon } = require('../utils/icons');
const { getIconSvg } = require('../utils/policyIcons');

async function attachLocals(req, res, next) {
  try {
    const categories = await db('categories').orderBy('sort_order');
    res.locals.categories = categories;
    res.locals.categoriesById = Object.fromEntries(categories.map((c) => [c.id, c]));
    res.locals.cartCount = cartService.cartCount(req);
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
