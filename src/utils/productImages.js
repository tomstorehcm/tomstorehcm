const db = require('../db');

// Admin can skip the main "ảnh đại diện" and rely on color photos instead --
// when that happens, product cards/listings should still show something
// instead of the generic category icon, so fall back to the first color
// photo (by sort_order) that has one.
async function attachFallbackImages(products) {
  const missingIds = products.filter((p) => !p.image_url).map((p) => p.id);
  if (missingIds.length === 0) return products;

  const colors = await db('product_colors')
    .whereIn('product_id', missingIds)
    .whereNotNull('image_url')
    .orderBy('sort_order');

  const firstImageByProduct = {};
  colors.forEach((c) => {
    if (!firstImageByProduct[c.product_id]) firstImageByProduct[c.product_id] = c.image_url;
  });

  products.forEach((p) => {
    if (!p.image_url && firstImageByProduct[p.id]) {
      p.image_url = firstImageByProduct[p.id];
    }
  });
  return products;
}

module.exports = { attachFallbackImages };
