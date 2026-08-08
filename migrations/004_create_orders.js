exports.up = function (knex) {
  return knex.schema.createTable('orders', (table) => {
    table.increments('id').primary();
    table.string('order_code', 20).notNullable().unique();
    table.string('customer_name', 150).notNullable();
    table.string('phone', 20).notNullable();
    table.string('address', 300).notNullable();
    table.text('note').nullable();
    table.enu('payment_method', ['cod', 'bank_transfer'], {
      useNative: false,
      enumName: 'payment_method_check'
    }).notNullable();
    table.enu('status', ['pending', 'confirmed', 'shipping', 'completed', 'cancelled'], {
      useNative: false,
      enumName: 'order_status_check'
    }).notNullable().defaultTo('pending');
    table.integer('total').unsigned().notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('orders');
};
