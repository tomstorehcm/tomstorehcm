exports.up = function (knex) {
  return knex.schema.createTable('order_items', (table) => {
    table.increments('id').primary();
    table
      .integer('order_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('orders')
      .onDelete('CASCADE');
    table
      .integer('product_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('products')
      .onDelete('SET NULL');
    table.string('product_name', 200).notNullable();
    table.integer('price').unsigned().notNullable();
    table.integer('quantity').unsigned().notNullable();
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('order_items');
};
