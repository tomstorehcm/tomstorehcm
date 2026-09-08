// Replaces the "customer_leads" (pre-sale consultation notes) concept with a
// proper purchase/warranty record: one "customers" row per person (found by
// phone so repeat buyers don't get duplicated), with a "customer_purchases"
// row per product they bought -- IMEI/serial, purchase date, warranty
// expiry, price and transaction type, so admin can search a customer by
// name/phone and see their full purchase + warranty history.
exports.up = async function (knex) {
  await knex.schema.dropTableIfExists('customer_leads');

  await knex.schema.createTable('customers', (table) => {
    table.increments('id').primary();
    table.string('name', 150).notNullable();
    table.string('phone', 20).notNullable();
    table.string('address', 300).nullable();
    table.text('note').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.index('phone');
  });

  await knex.schema.createTable('customer_purchases', (table) => {
    table.increments('id').primary();
    table
      .integer('customer_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('customers')
      .onDelete('CASCADE');
    table.string('product_name', 255).notNullable();
    table.string('imei', 100).nullable();
    table.date('purchase_date').notNullable();
    table.integer('price').unsigned().nullable();
    table.date('warranty_expires_at').nullable();
    table.string('transaction_type', 30).notNullable().defaultTo('mua_moi');
    table.text('note').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('customer_purchases');
  await knex.schema.dropTableIfExists('customers');

  await knex.schema.createTable('customer_leads', (table) => {
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
