// Hero banners could always leave the mobile image blank, but the desktop
// image was required (NOT NULL). Some admins now want to add mobile-only
// banners (e.g. more mobile variants than desktop ones), so this relaxes
// the same constraint on the desktop side -- image_url becomes nullable,
// matching image_url_mobile. This does not touch any existing row's data.
exports.up = function (knex) {
  return knex.schema.alterTable('banners', (table) => {
    table.string('image_url', 500).nullable().alter();
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('banners', (table) => {
    table.string('image_url', 500).notNullable().alter();
  });
};
