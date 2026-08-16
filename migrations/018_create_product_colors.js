exports.up = function (knex) {
  return knex.schema.createTable('product_colors', (table) => {
    table.increments('id').primary();
    table
      .integer('product_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('products')
      .onDelete('CASCADE');
    table.string('name', 50).notNullable();
    table.string('hex_code', 7).notNullable().defaultTo('#000000');
    table.boolean('in_stock').notNullable().defaultTo(true);
    table.integer('sort_order').notNullable().defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['product_id']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('product_colors');
};
