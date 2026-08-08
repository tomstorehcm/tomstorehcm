exports.up = function (knex) {
  return knex.schema.alterTable('categories', (table) => {
    table.string('image_url', 500).nullable();
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('categories', (table) => {
    table.dropColumn('image_url');
  });
};
