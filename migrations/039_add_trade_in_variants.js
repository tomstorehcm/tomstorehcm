// Mo rong tinh nang Trade-In: cho phep 1 trade_in_product (tuy chon, admin tu
// bat/tat qua has_variants) khai bao them Dung luong + Mau rieng, va 1 bang
// gia day du theo tung to hop (Dung luong x Mau x Tinh trang) -- vi admin can
// gia khac nhau theo ca 3 chieu (khong chi theo tinh trang nhu truoc).
// - Khi has_variants = false (mac dinh): giu nguyen luong cu 100% -- gia nam
//   thang tren trade_in_conditions.price nhu truoc gio.
// - Khi has_variants = true: trade_in_conditions.price khong con dung nua
//   (duoc phep NULL), gia thuc luon lay tu trade_in_variant_prices theo dung
//   3 id (storage_option_id, color_option_id, trade_in_condition_id) khach da
//   chon. 2 bang moi (trade_in_storage_options/trade_in_color_options) moi
//   trade_in_product tu dinh nghia danh sach rieng, giong cach da lam voi
//   trade_in_conditions tu truoc (khong dung chung 1 danh sach co dinh toan site).
exports.up = async function (knex) {
  await knex.schema.alterTable('trade_in_products', (table) => {
    table.boolean('has_variants').notNullable().defaultTo(false);
  });

  // trade_in_conditions.price phai cho phep NULL vi khi has_variants=true,
  // gia khong con nam o day nua (nam o trade_in_variant_prices). Dung knex
  // schema builder (.nullable().alter()) thay vi raw SQL "MODIFY" -- cu phap
  // "MODIFY" chi MySQL hieu, local dev dung SQLite (better-sqlite3) se bao
  // loi syntax error. .alter() la cach lam da dung thanh cong o migration
  // 036 (cung doi 1 cot tu NOT NULL sang nullable) -- knex tu lo phan ung
  // cho tung dialect (MySQL ALTER COLUMN that su, SQLite thi tu dung lai
  // bang tam thoi phia sau hau truong).
  await knex.schema.alterTable('trade_in_conditions', (table) => {
    table.integer('price').unsigned().nullable().alter();
  });

  await knex.schema.createTable('trade_in_storage_options', (table) => {
    table.increments('id').primary();
    table
      .integer('trade_in_product_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('trade_in_products')
      .onDelete('CASCADE');
    table.string('label', 50).notNullable();
    table.integer('sort_order').notNullable().defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['trade_in_product_id']);
  });

  await knex.schema.createTable('trade_in_color_options', (table) => {
    table.increments('id').primary();
    table
      .integer('trade_in_product_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('trade_in_products')
      .onDelete('CASCADE');
    table.string('label', 50).notNullable();
    table.string('hex_code', 7).nullable();
    table.integer('sort_order').notNullable().defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['trade_in_product_id']);
  });

  await knex.schema.createTable('trade_in_variant_prices', (table) => {
    table.increments('id').primary();
    table
      .integer('trade_in_product_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('trade_in_products')
      .onDelete('CASCADE');
    table
      .integer('storage_option_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('trade_in_storage_options')
      .onDelete('CASCADE');
    table
      .integer('color_option_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('trade_in_color_options')
      .onDelete('CASCADE');
    table
      .integer('trade_in_condition_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('trade_in_conditions')
      .onDelete('CASCADE');
    table.integer('price').unsigned().notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.unique(['storage_option_id', 'color_option_id', 'trade_in_condition_id'], 'trade_in_variant_prices_combo_unique');
    table.index(['trade_in_product_id']);
  });

  await knex.schema.alterTable('trade_in_requests', (table) => {
    table.string('trade_in_storage_label', 50).nullable();
    table.string('trade_in_color_label', 50).nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('trade_in_requests', (table) => {
    table.dropColumn('trade_in_storage_label');
    table.dropColumn('trade_in_color_label');
  });
  await knex.schema.dropTableIfExists('trade_in_variant_prices');
  await knex.schema.dropTableIfExists('trade_in_color_options');
  await knex.schema.dropTableIfExists('trade_in_storage_options');
  await knex.schema.alterTable('trade_in_conditions', (table) => {
    table.integer('price').unsigned().notNullable().alter();
  });
  await knex.schema.alterTable('trade_in_products', (table) => {
    table.dropColumn('has_variants');
  });
};
