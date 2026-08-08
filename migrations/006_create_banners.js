exports.up = function (knex) {
  return knex.schema.createTable('banners', (table) => {
    table.increments('id').primary();
    table.string('image_url', 500).notNullable();
    table.string('link_url', 500).nullable();
    table.integer('sort_order').notNullable().defaultTo(0);
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('banners');
};
