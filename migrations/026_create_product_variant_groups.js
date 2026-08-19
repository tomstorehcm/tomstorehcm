// Adds an optional third tier above capacity/color: a "big group" (e.g. screen
// size for MacBook, connectivity for iPad) that a product's variants can
// belong to. product_variant_groups holds the group options themselves;
// products.variant_group_label is the admin-typed heading shown above them
// (e.g. "Kích thước màn hình"); product_variants.variant_group_id links each
// capacity to its parent group. All nullable/optional -- products that don't
// use this keep working exactly as before (variant_group_id stays NULL).
exports.up = async function (knex) {
  await knex.schema.alterTable('products', (table) => {
    table.string('variant_group_label', 100).nullable();
  });
  await knex.schema.createTable('product_variant_groups', (table) => {
    table.increments('id').primary();
    table
      .integer('product_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('products')
      .onDelete('CASCADE');
    table.string('name', 50).notNullable();
    table.integer('sort_order').notNullable().defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['product_id']);
  });
  await knex.schema.alterTable('product_variants', (table) => {
    table
      .integer('variant_group_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('product_variant_groups')
      .onDelete('CASCADE');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('product_variants', (table) => {
    table.dropColumn('variant_group_id');
  });
  await knex.schema.dropTableIfExists('product_variant_groups');
  await knex.schema.alterTable('products', (table) => {
    table.dropColumn('variant_group_label');
  });
};
