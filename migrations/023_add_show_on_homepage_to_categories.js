exports.up = function (knex) {
  return knex.schema.alterTable('categories', function (table) {
    table.boolean('show_on_homepage').notNullable().defaultTo(true);
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('categories', function (table) {
    table.dropColumn('show_on_homepage');
  });
};
