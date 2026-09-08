const db = require('../db');
const cartService = require('../services/cart');
const { formatVND, discountPercent } = require('../utils/format');
const { categoryIcon } = require('../utils/icons');
const { getIconSvg } = require('../utils/policyIcons');

// Builds the top-nav list: categories with no nav_group_key stay flat links
// (unchanged behavior); categories sharing a nav_group_key (e.g. Tai nghe +
// Apple Watch under "Phụ kiện") collapse into one dropdown item, positioned
// where the first (lowest sort_order) member would have been. A group with
// only one member (nothing to merge with yet) is left as a plain flat link.
function buildNavItems(categories) {
  const navItems = [];
  const groupsByKey = new Map();

  categories.forEach((cat) => {
    if (!cat.nav_group_key) {
      navItems.push({ type: 'link', category: cat });
      return;
    }
    let group = groupsByKey.get(cat.nav_group_key);
    if (!group) {
      group = { type: 'group', key: cat.nav_group_key, label: cat.nav_group_label || cat.name, categories: [] };
      groupsByKey.set(cat.nav_group_key, group);
      navItems.push(group);
    }
    group.categories.push(cat);
  });

  return navItems
    .map((item) => {
      if (item.type === 'group' && item.categories.length < 2) {
        return { type: 'link', category: item.categories[0] };
      }
      return item;
    })
    .filter((item) => (item.type === 'link' ? !!item.category : true));
}

async function attachLocals(req, res, next) {
  try {
    // Every page shows the cart badge, so any page could be served stale by
    // the browser's back-forward cache after the cart changes elsewhere.
    res.set('Cache-Control', 'no-store');
    const categories = await db('categories').orderBy('sort_order');
    res.locals.categories = categories;
    res.locals.categoriesById = Object.fromEntries(categories.map((c) => [c.id, c]));
    res.locals.navItems = buildNavItems(categories);
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
