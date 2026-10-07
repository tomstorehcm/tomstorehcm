const { body, validationResult } = require('express-validator');
const db = require('../db');
const { generateOrderCode } = require('../utils/format');

// Builds the client-side data blob for the "chon may thu cu" step: every
// active trade-in product (grouped by its category for the tab filter) with
// its own condition tiers (label/price), exactly as the admin configured them
// -- no shared/global condition list, each trade-in product owns its own set.
async function loadTradeInProductsData() {
  const products = await db('trade_in_products')
    .where('is_active', true)
    .orderBy(['sort_order', 'id']);
  const productIds = products.map((p) => p.id);
  const conditions = productIds.length
    ? await db('trade_in_conditions').whereIn('trade_in_product_id', productIds).orderBy(['trade_in_product_id', 'sort_order', 'id'])
    : [];

  return products.map((p) => {
    const ownConditions = conditions.filter((c) => c.trade_in_product_id === p.id);
    const maxPrice = ownConditions.reduce((max, c) => Math.max(max, c.price), 0);
    return {
      id: p.id,
      categoryId: p.category_id,
      name: p.name,
      imageUrl: p.image_url,
      subsidyAmount: p.subsidy_amount,
      maxPrice,
      conditions: ownConditions.map((c) => ({ id: c.id, label: c.label, description: c.description, price: c.price }))
    };
  });
}

// Builds the client-side data blob for the "chon may len doi" step: every
// catalog product the admin flagged trade_in_enabled, with its full
// variant-group/variant/color tree so the modal can let the customer pick the
// exact capacity/color, mirroring the same shape used on the product detail
// page (views/product.ejs's variantColorData blob).
async function loadUpgradeProductsData() {
  const products = await db('products')
    .where('trade_in_enabled', true)
    .where('in_stock', true)
    .orderBy(['category_id', 'id']);
  const productIds = products.map((p) => p.id);
  if (productIds.length === 0) return [];

  const variantGroups = await db('product_variant_groups').whereIn('product_id', productIds).orderBy('sort_order');
  const variants = await db('product_variants').whereIn('product_id', productIds).orderBy('sort_order');
  const colors = await db('product_colors').whereIn('product_id', productIds).orderBy('sort_order');

  return products.map((p) => {
    const pVariants = variants.filter((v) => v.product_id === p.id);
    const pGroups = variantGroups.filter((g) => g.product_id === p.id);
    const pColors = colors.filter((c) => c.product_id === p.id);

    pVariants.forEach((v) => {
      v.colorsList = pColors.filter((c) => c.variant_id === v.id);
    });
    const generalColors = pColors.filter((c) => !c.variant_id);

    const hasGroups = pGroups.length > 0;
    const flatVariants = pVariants.filter((v) => !v.variant_group_id);

    const basePrice = p.is_contact_price
      ? null
      : (p.sale_price && p.sale_price < p.price ? p.sale_price : p.price);

    return {
      id: p.id,
      categoryId: p.category_id,
      name: p.name,
      slug: p.slug,
      imageUrl: p.image_url,
      isContactPrice: !!p.is_contact_price,
      basePrice,
      subsidy: p.trade_in_subsidy || 0,
      variantGroupLabel: p.variant_group_label,
      variantGroups: pGroups.map((g) => ({
        id: g.id,
        name: g.name,
        variants: pVariants.filter((v) => v.variant_group_id === g.id).map((v) => ({
          id: v.id,
          label: v.label,
          price: v.price,
          inStock: !!v.in_stock,
          colors: v.colorsList.map((c) => ({ id: c.id, name: c.name, hex: c.hex_code, price: c.price, inStock: !!c.in_stock }))
        }))
      })),
      variants: hasGroups ? [] : flatVariants.map((v) => ({
        id: v.id,
        label: v.label,
        price: v.price,
        inStock: !!v.in_stock,
        colors: v.colorsList.map((c) => ({ id: c.id, name: c.name, hex: c.hex_code, price: c.price, inStock: !!c.in_stock }))
      })),
      generalColors: generalColors.map((c) => ({ id: c.id, name: c.name, hex: c.hex_code, price: null, inStock: !!c.in_stock }))
    };
  });
}

async function showTradeInPage(req, res, next) {
  try {
    const categories = await db('categories').orderBy('sort_order');
    const tradeInProducts = await loadTradeInProductsData();
    const usedCategoryIds = new Set(tradeInProducts.map((p) => p.categoryId).filter(Boolean));
    const tradeInCategories = categories.filter((c) => usedCategoryIds.has(c.id));

    const upgradeProducts = await loadUpgradeProductsData();
    const usedUpgradeCategoryIds = new Set(upgradeProducts.map((p) => p.categoryId).filter(Boolean));
    const upgradeCategories = categories.filter((c) => usedUpgradeCategoryIds.has(c.id));

    const policySections = await db('trade_in_policy_sections').orderBy('id');

    res.render('trade-in', {
      title: 'Thu Cũ Đổi Mới - TOMSTORE',
      tradeInCategories,
      tradeInProducts,
      upgradeCategories,
      upgradeProducts,
      policySections
    });
  } catch (err) {
    next(err);
  }
}

const tradeInRequestValidators = [
  body('customerName').trim().notEmpty().withMessage('Vui lòng nhập họ tên').isLength({ max: 150 }),
  body('phone').trim().matches(/^(0\d{9}|\+84\d{9})$/).withMessage('Số điện thoại không hợp lệ'),
  body('mode').isIn(['thu_cu', 'len_doi']).withMessage('Yêu cầu không hợp lệ'),
  body('tradeInProductId').isInt().withMessage('Vui lòng chọn máy muốn thu cũ'),
  body('tradeInConditionId').isInt().withMessage('Vui lòng chọn tình trạng máy')
];

// Every price/label in the final request is re-resolved from the DB using
// only the ids the client submitted -- the client can send whatever display
// numbers it wants, but what gets saved always comes from the server's own
// data, never trusted from the request body directly.
async function submitTradeInRequest(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ ok: false, errors: errors.array() });
    }

    const tradeInProduct = await db('trade_in_products').where('id', req.body.tradeInProductId).first();
    const tradeInCondition = await db('trade_in_conditions')
      .where({ id: req.body.tradeInConditionId, trade_in_product_id: req.body.tradeInProductId })
      .first();
    if (!tradeInProduct || !tradeInCondition) {
      return res.status(400).json({ ok: false, errors: [{ msg: 'Sản phẩm hoặc tình trạng máy không hợp lệ.' }] });
    }

    const mode = req.body.mode;
    let upgrade = null;

    if (mode === 'len_doi') {
      const upgradeProductId = Number(req.body.upgradeProductId);
      const upgradeProduct = upgradeProductId
        ? await db('products').where({ id: upgradeProductId, trade_in_enabled: true }).first()
        : null;
      if (!upgradeProduct) {
        return res.status(400).json({ ok: false, errors: [{ msg: 'Vui lòng chọn máy muốn lên đời.' }] });
      }

      let variant = null;
      let color = null;
      if (req.body.upgradeVariantId) {
        variant = await db('product_variants').where({ id: Number(req.body.upgradeVariantId), product_id: upgradeProduct.id }).first();
      }
      if (req.body.upgradeColorId) {
        color = await db('product_colors').where({ id: Number(req.body.upgradeColorId), product_id: upgradeProduct.id }).first();
      }

      const price = (color && color.price != null) ? color.price
        : (variant ? variant.price
          : (upgradeProduct.sale_price && upgradeProduct.sale_price < upgradeProduct.price ? upgradeProduct.sale_price : upgradeProduct.price));

      upgrade = {
        upgrade_product_id: upgradeProduct.id,
        upgrade_product_name: upgradeProduct.name,
        upgrade_variant_id: variant ? variant.id : null,
        upgrade_variant_label: variant ? variant.label : null,
        upgrade_color_id: color ? color.id : null,
        upgrade_color_name: color ? color.name : null,
        upgrade_price: upgradeProduct.is_contact_price ? null : price,
        upgrade_subsidy: upgradeProduct.trade_in_subsidy || null
      };
    }

    let requestCode = generateOrderCode();
    while (await db('trade_in_requests').where('request_code', requestCode).first()) {
      requestCode = generateOrderCode();
    }

    await db('trade_in_requests').insert({
      request_code: requestCode,
      mode,
      customer_name: req.body.customerName.trim(),
      phone: req.body.phone.trim(),
      trade_in_product_id: tradeInProduct.id,
      trade_in_product_name: tradeInProduct.name,
      trade_in_condition_id: tradeInCondition.id,
      trade_in_condition_label: tradeInCondition.label,
      trade_in_price: tradeInCondition.price,
      note: (req.body.note || '').trim() || null,
      ...(upgrade || {})
    });

    res.json({ ok: true, redirectUrl: `/thu-cu-doi-moi/xac-nhan/${requestCode}` });
  } catch (err) {
    next(err);
  }
}

async function showTradeInConfirmation(req, res, next) {
  try {
    const request = await db('trade_in_requests').where('request_code', req.params.code).first();
    if (!request) {
      return res.status(404).render('error', {
        title: 'Không tìm thấy yêu cầu',
        statusCode: 404,
        message: 'Yêu cầu thu cũ đổi mới không tồn tại.'
      });
    }

    res.render('trade-in-confirmation', {
      title: 'Đã gửi yêu cầu thu cũ đổi mới - TOMSTORE',
      request
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  showTradeInPage,
  tradeInRequestValidators,
  submitTradeInRequest,
  showTradeInConfirmation
};
