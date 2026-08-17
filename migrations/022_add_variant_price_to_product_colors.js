exports.up = function (knex) {
  return knex.schema.alterTable('product_colors', function (table) {
    table.integer('variant_id').unsigned().nullable().references('id').inTable('product_variants').onDelete('CASCADE');
    table.integer('price').nullable();
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('product_colors', function (table) {
    table.dropColumn('variant_id');
    table.dropColumn('price');
  });
};
