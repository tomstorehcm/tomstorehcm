exports.up = async function (knex) {
  await knex.schema.alterTable('products', (table) => {
    table.boolean('in_stock').notNullable().defaultTo(true);
  });
  await knex('products').where('stock', 0).update({ in_stock: false });
  await knex.schema.alterTable('products', (table) => {
    table.dropColumn('stock');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('products', (table) => {
    table.integer('stock').unsigned().notNullable().defaultTo(0);
  });
  await knex('products').where('in_stock', true).update({ stock: 10 });
  await knex.schema.alterTable('products', (table) => {
    table.dropColumn('in_stock');
  });
};
