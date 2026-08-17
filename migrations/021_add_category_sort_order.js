exports.up = function (knex) {
  return knex.schema.alterTable('products', function (table) {
    table.integer('category_sort_order').notNullable().defaultTo(0);
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('products', function (table) {
    table.dropColumn('category_sort_order');
  });
};
