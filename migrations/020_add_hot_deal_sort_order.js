exports.up = function (knex) {
  return knex.schema.alterTable('products', function (table) {
    table.integer('hot_deal_sort_order').notNullable().defaultTo(0);
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('products', function (table) {
    table.dropColumn('hot_deal_sort_order');
  });
};
