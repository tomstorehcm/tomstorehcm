// Tinh nang "Repairing" (Sua chua).
// - repair_services: cac MUC sua chua chung, ap dung cho MOI thiet bi, KHONG
//   gan voi 1 dong may/model cu the nao (vd "Thay pin", "Thay man hinh"...).
//   Admin tao 1 lan, khong phai tao rieng tung dong may.
// - repair_variants: moi repair_service tu dinh nghia nhieu "Loai" (vd
//   "Chinh hang", "Hang ABC"...), moi loai co ANH RIENG (ten + mo ta + anh
//   dung chung cho moi san pham). KHONG con gia o day nua -- gia phu thuoc
//   vao TUNG san pham khach chon (xem repair_variant_prices ben duoi).
// - repair_devices: danh sach "San pham" (dong may, vd iPhone 15, Samsung
//   S24...) DUNG CHUNG cho moi dich vu sua chua, admin tao 1 lan. Co the
//   LIEN KET voi 1 san pham THAT trong catalog (product_id -> products.id,
//   ten/anh lay truc tiep tu do, luon dong bo) HOAC tu nhap ten/anh rieng
//   (name/image_url, danh cho may doi cu khong con trong catalog) -- 1 trong
//   2, khong dung dong thoi.
// - repair_service_devices: danh dau san pham nao ap dung dich vu nao (1 san
//   pham co the ap dung NHIEU dich vu, 1 dich vu cung co the ap dung cho
//   nhieu san pham). Duoc quan ly tu trang SAN PHAM (chon dich vu ap dung +
//   gia), khong phai tu trang dich vu.
// - repair_variant_prices: gia cu the cho tung cap (loai, san pham) -- day
//   la noi gia THUC SU duoc luu, 1 loai se co nhieu gia khac nhau tuy san
//   pham khach chon.
// - repair_requests: yeu cau cua khach gui tu trang cong khai -- khach co the
//   chon NHIEU dich vu cung luc trong 1 yeu cau, moi dich vu chon 1 san pham
//   + 1 loai, tong gia = tong gia cac loai da chon. Co status (giong Trade
//   In) de admin theo doi tien trinh xu ly.
// - repair_request_items: tung bo (dich vu, san pham, loai) cu the khach da
//   chon trong 1 yeu cau, kem snapshot ten dich vu / ten san pham / nhan loai
//   / gia tai thoi diem gui yeu cau (khong vo du lieu neu sau nay dich
//   vu/san pham/loai lien quan bi sua/xoa).
// - repair_history: so ghi lich su sua chua THUC TE, admin tu nhap sau khi
//   da xu ly xong cho khach -- doc lap HOAN TOAN voi bang
//   customers/customer_purchases co san, tim kiem duoc theo IMEI hoac so
//   dien thoai. KHONG co status, chi ghi nhan lai ket qua da hoan tat.
exports.up = async function (knex) {
  // Don cac bang rac tu ban thiet ke v1 (truoc khi co repair_services) --
  // da xac nhan rong/khong con duoc code nao dung toi.
  await knex.schema.dropTableIfExists('repair_request_options');
  await knex.schema.dropTableIfExists('repair_options');
  await knex.schema.dropTableIfExists('repair_products');

  await knex.schema.createTable('repair_services', (table) => {
    table.increments('id').primary();
    table.string('name', 200).notNullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.integer('sort_order').notNullable().defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['is_active']);
  });

  await knex.schema.createTable('repair_variants', (table) => {
    table.increments('id').primary();
    table
      .integer('repair_service_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('repair_services')
      .onDelete('CASCADE');
    table.string('label', 150).notNullable();
    table.text('description').nullable();
    table.string('image_url', 500).nullable();
    table.integer('sort_order').notNullable().defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['repair_service_id']);
  });

  await knex.schema.createTable('repair_devices', (table) => {
    table.increments('id').primary();
    table
      .integer('product_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('products')
      .onDelete('SET NULL');
    table.string('name', 200).nullable();
    table.string('image_url', 500).nullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.integer('sort_order').notNullable().defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['is_active']);
    table.index(['product_id']);
  });

  await knex.schema.createTable('repair_service_devices', (table) => {
    table.increments('id').primary();
    table
      .integer('repair_service_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('repair_services')
      .onDelete('CASCADE');
    table
      .integer('repair_device_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('repair_devices')
      .onDelete('CASCADE');
    table.integer('sort_order').notNullable().defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.unique(['repair_service_id', 'repair_device_id']);
    table.index(['repair_service_id']);
  });

  await knex.schema.createTable('repair_variant_prices', (table) => {
    table.increments('id').primary();
    table
      .integer('repair_variant_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('repair_variants')
      .onDelete('CASCADE');
    table
      .integer('repair_device_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('repair_devices')
      .onDelete('CASCADE');
    table.integer('price').unsigned().notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.unique(['repair_variant_id', 'repair_device_id']);
    table.index(['repair_device_id']);
  });

  await knex.schema.createTable('repair_requests', (table) => {
    table.increments('id').primary();
    table.string('request_code', 40).notNullable().unique();
    table.string('customer_name', 150).notNullable();
    table.string('phone', 30).notNullable();
    table.integer('total_price').unsigned().notNullable();
    table.string('status', 20).notNullable().defaultTo('moi');
    table.text('note').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['status']);
    table.index(['created_at']);
  });

  await knex.schema.createTable('repair_request_items', (table) => {
    table.increments('id').primary();
    table
      .integer('repair_request_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('repair_requests')
      .onDelete('CASCADE');
    table
      .integer('repair_service_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('repair_services')
      .onDelete('SET NULL');
    table.string('service_name', 200).notNullable();
    table
      .integer('repair_device_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('repair_devices')
      .onDelete('SET NULL');
    table.string('device_name', 200).notNullable();
    table
      .integer('repair_variant_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('repair_variants')
      .onDelete('SET NULL');
    table.string('variant_label', 150).notNullable();
    table.integer('price').unsigned().notNullable();

    table.index(['repair_request_id']);
  });

  await knex.schema.createTable('repair_history', (table) => {
    table.increments('id').primary();
    table.date('repair_date').notNullable();
    table.string('customer_name', 150).notNullable();
    table.string('phone', 30).notNullable();
    table.string('imei', 50).nullable();
    table.string('device_name', 200).notNullable();
    table.text('issue').notNullable();
    table.text('resolution').nullable();
    table.integer('cost').unsigned().nullable();
    table.text('note').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['imei']);
    table.index(['phone']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('repair_history');
  await knex.schema.dropTableIfExists('repair_request_items');
  await knex.schema.dropTableIfExists('repair_requests');
  await knex.schema.dropTableIfExists('repair_variant_prices');
  await knex.schema.dropTableIfExists('repair_service_devices');
  await knex.schema.dropTableIfExists('repair_devices');
  await knex.schema.dropTableIfExists('repair_variants');
  await knex.schema.dropTableIfExists('repair_services');
};
