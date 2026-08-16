exports.up = async function (knex) {
  await knex.schema.alterTable('product_variants', (table) => {
    table.boolean('in_stock').notNullable().defaultTo(true);
  });
  await knex('product_variants').where('stock', 0).update({ in_stock: false });
  await knex.schema.alterTable('product_variants', (table) => {
    table.dropColumn('stock');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('product_variants', (table) => {
    table.integer('stock').unsigned().notNullable().defaultTo(0);
  });
  await knex('product_variants').where('in_stock', true).update({ stock: 10 });
  await knex.schema.alterTable('product_variants', (table) => {
    table.dropColumn('in_stock');
  });
};
