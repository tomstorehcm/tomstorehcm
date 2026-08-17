exports.up = function (knex) {
  return knex.schema.alterTable('orders', function (table) {
    table.text('admin_note').nullable();
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('orders', function (table) {
    table.dropColumn('admin_note');
  });
};
