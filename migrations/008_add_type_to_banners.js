exports.up = function (knex) {
  return knex.schema.alterTable('banners', (table) => {
    table.string('type', 20).notNullable().defaultTo('hero');
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('banners', (table) => {
    table.dropColumn('type');
  });
};
