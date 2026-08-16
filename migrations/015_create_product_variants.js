exports.up = function (knex) {
  return knex.schema.createTable('product_variants', (table) => {
    table.increments('id').primary();
    table
      .integer('product_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('products')
      .onDelete('CASCADE');
    table.string('label', 50).notNullable();
    table.integer('price').unsigned().notNullable();
    table.integer('stock').unsigned().notNullable().defaultTo(0);
    table.integer('sort_order').notNullable().defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['product_id']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('product_variants');
};
