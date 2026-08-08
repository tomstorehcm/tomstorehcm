exports.up = function (knex) {
  return knex.schema.alterTable('products', (table) => {
    table.boolean('is_featured').notNullable().defaultTo(false);
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('products', (table) => {
    table.dropColumn('is_featured');
  });
};
