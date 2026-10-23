// Tinh nang "Trade In" (thu cu doi moi):
// - trade_in_products: danh sach may TOM nhan thu lai, admin tu them (doc lap
//   voi catalog dang ban, de con thu duoc may da ngung ban).
// - trade_in_conditions: moi trade_in_product tu dinh nghia rieng cac muc
//   tinh trang (vd "Loai 1", "Loai 2"...) + gia thu rieng cho tung muc --
//   khong dung chung 1 bo muc co dinh, vi moi loai san pham co hang muc khac nhau.
// - products.trade_in_enabled / trade_in_subsidy: danh dau san pham nao trong
//   catalog dang ban duoc hien o buoc "chon may len doi", kem tro gia them tuy chon.
// - trade_in_policy_sections: noi dung gioi thieu/chinh sach tinh (giong
//   warranty_policy_sections), admin tu them/sua/xoa muc.
// - trade_in_requests: yeu cau cua khach sau khi hoan tat luong (chi thu cu,
//   hoac thu cu + len doi) -- luu rieng, co snapshot ten/gia de khong vo du
//   lieu neu sau nay trade-in product/condition/san pham lien quan bi sua/xoa.
exports.up = async function (knex) {
  await knex.schema.createTable('trade_in_products', (table) => {
    table.increments('id').primary();
    table
      .integer('category_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('categories')
      .onDelete('SET NULL');
    table.string('name', 200).notNullable();
    table.string('image_url', 500).nullable();
    table.integer('subsidy_amount').unsigned().nullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.integer('sort_order').notNullable().defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['category_id']);
    table.index(['is_active']);
  });

  await knex.schema.createTable('trade_in_conditions', (table) => {
    table.increments('id').primary();
    table
      .integer('trade_in_product_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('trade_in_products')
      .onDelete('CASCADE');
    table.string('label', 150).notNullable();
    table.text('description').nullable();
    table.integer('price').unsigned().notNullable();
    table.integer('sort_order').notNullable().defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['trade_in_product_id']);
  });

  await knex.schema.alterTable('products', (table) => {
    table.boolean('trade_in_enabled').notNullable().defaultTo(false);
    table.integer('trade_in_subsidy').unsigned().nullable();
  });

  await knex.schema.createTable('trade_in_policy_sections', (table) => {
    table.increments('id').primary();
    table.string('section_key', 100).notNullable().unique();
    table.string('title', 200).notNullable();
    table.text('content_html').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').nullable();
  });

  await knex.schema.createTable('trade_in_requests', (table) => {
    table.increments('id').primary();
    table.string('request_code', 40).notNullable().unique();
    table.string('mode', 20).notNullable(); // 'thu_cu' | 'len_doi'
    table.string('customer_name', 150).notNullable();
    table.string('phone', 30).notNullable();

    table
      .integer('trade_in_product_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('trade_in_products')
      .onDelete('SET NULL');
    table.string('trade_in_product_name', 200).notNullable();
    table
      .integer('trade_in_condition_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('trade_in_conditions')
      .onDelete('SET NULL');
    table.string('trade_in_condition_label', 150).notNullable();
    table.integer('trade_in_price').unsigned().notNullable();

    table
      .integer('upgrade_product_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('products')
      .onDelete('SET NULL');
    table.string('upgrade_product_name', 200).nullable();
    table
      .integer('upgrade_variant_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('product_variants')
      .onDelete('SET NULL');
    table.string('upgrade_variant_label', 100).nullable();
    table
      .integer('upgrade_color_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('product_colors')
      .onDelete('SET NULL');
    table.string('upgrade_color_name', 100).nullable();
    table.integer('upgrade_price').unsigned().nullable();
    table.integer('upgrade_subsidy').unsigned().nullable();

    table.string('status', 20).notNullable().defaultTo('moi');
    table.text('note').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['status']);
    table.index(['created_at']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('trade_in_requests');
  await knex.schema.dropTableIfExists('trade_in_policy_sections');
  await knex.schema.alterTable('products', (table) => {
    table.dropColumn('trade_in_enabled');
    table.dropColumn('trade_in_subsidy');
  });
  await knex.schema.dropTableIfExists('trade_in_conditions');
  await knex.schema.dropTableIfExists('trade_in_products');
};
