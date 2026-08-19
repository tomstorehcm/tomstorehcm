// Optional short label for the top nav bar, distinct from the category's
// real name (used everywhere else -- homepage tiles, category page heading).
// Falls back to name when not set, so this is purely additive.
exports.up = function (knex) {
  return knex.schema.alterTable('categories', (table) => {
    table.string('nav_label', 30).nullable();
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('categories', (table) => {
    table.dropColumn('nav_label');
  });
};
