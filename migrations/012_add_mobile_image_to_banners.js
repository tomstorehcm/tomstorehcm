exports.up = function (knex) {
  return knex.schema.alterTable('banners', (table) => {
    table.string('image_url_mobile', 500).nullable();
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('banners', (table) => {
    table.dropColumn('image_url_mobile');
  });
};
