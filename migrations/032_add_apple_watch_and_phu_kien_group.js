// Adds the "Apple Watch" category and groups it with the existing "Tai
// nghe" category under one "Phụ kiện" nav dropdown (nav_group_key =
// 'phu-kien'). Apple Watch starts hidden from the homepage category tiles
// (show_on_homepage = false), same treatment as other categories that are
// only reachable through a grouped/tabbed view rather than their own tile.
exports.up = async function (knex) {
  await knex('categories')
    .where('slug', 'tai-nghe')
    .update({
      nav_group_key: 'phu-kien',
      nav_group_label: 'Phụ kiện'
    });

  const existing = await knex('categories').where('slug', 'apple-watch').first();
  if (!existing) {
    const maxRow = await knex('categories').max('sort_order as max').first();
    const nextSort = (maxRow && maxRow.max ? maxRow.max : 0) + 1;
    await knex('categories').insert({
      slug: 'apple-watch',
      name: 'Apple Watch',
      sort_order: nextSort,
      show_on_homepage: false,
      nav_group_key: 'phu-kien',
      nav_group_label: 'Phụ kiện'
    });
  }
};

exports.down = async function (knex) {
  await knex('categories').where('slug', 'apple-watch').del();
  await knex('categories')
    .where('slug', 'tai-nghe')
    .update({
      nav_group_key: null,
      nav_group_label: null
    });
};
