exports.up = function (knex) {
  return knex.schema.createTable('products', (table) => {
    table.increments('id').primary();
    table
      .integer('category_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('categories')
      .onDelete('CASCADE');
    table.string('name', 200).notNullable();
    table.string('slug', 220).notNullable().unique();
    table.string('brand', 100).nullable();
    table.integer('price').unsigned().notNullable();
    table.integer('sale_price').unsigned().nullable();
    table.string('image_url', 500).nullable();
    table.text('description').nullable();
    table.text('specs_json').nullable();
    table.integer('stock').unsigned().notNullable().defaultTo(0);
    table.boolean('is_hot_deal').notNullable().defaultTo(false);
    table.datetime('hot_deal_expires_at').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['category_id']);
    table.index(['is_hot_deal', 'hot_deal_expires_at']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('products');
};
