// Distinguishes real orders from price-inquiry leads ("Liên hệ" button on
// products with no set price / out of stock) so both can live in the same
// orders table and share the admin order-management list, without needing
// address/payment-method to mean anything for a lead.
exports.up = function (knex) {
  return knex.schema.alterTable('orders', (table) => {
    table.string('order_type', 20).notNullable().defaultTo('order');
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('orders', (table) => {
    table.dropColumn('order_type');
  });
};
