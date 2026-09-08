// Lets several categories share one dropdown item on the top nav bar (e.g.
// "Tai nghe" + "Apple Watch" merged under "Phụ kiện") instead of each being
// its own flat link. Rows sharing the same nav_group_key are grouped
// together; nav_group_label is the text shown on the dropdown button.
// Purely additive/optional -- categories with no group keep behaving exactly
// as before (flat nav link).
exports.up = function (knex) {
  return knex.schema.alterTable('categories', (table) => {
    table.string('nav_group_key', 40).nullable();
    table.string('nav_group_label', 40).nullable();
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('categories', (table) => {
    table.dropColumn('nav_group_key');
    table.dropColumn('nav_group_label');
  });
};
