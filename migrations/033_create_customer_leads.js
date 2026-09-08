// Standalone lead-capture table for staff to log customer info while
// consulting a sale (name/phone plus optional context) -- separate from the
// checkout "orders" table since these aren't orders and need full
// edit/delete from admin, which orders intentionally don't support.
exports.up = function (knex) {
  return knex.schema.createTable('customer_leads', (table) => {
    table.increments('id').primary();
    table.string('customer_name', 150).notNullable();
    table.string('phone', 20).notNullable();
    table.string('interest', 255).nullable();
    table.text('note').nullable();
    table.string('source', 100).nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').nullable();
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('customer_leads');
};
