// Collapses the old 5-state order status (pending/confirmed/shipping/
// completed/cancelled) into the 3 states the store actually uses day to day.
// SQLite's ALTER TABLE can't replace an existing CHECK constraint (knex's
// emulated enum .alter() just stacks a second one on top and the old values
// keep failing), so on SQLite this rebuilds the table properly instead.

async function mapOldStatuses(knex) {
  await knex('orders').where('status', 'pending').update({ status: 'moi' });
  await knex('orders').whereIn('status', ['confirmed', 'shipping', 'cancelled']).update({ status: 'da_lien_he' });
  await knex('orders').where('status', 'completed').update({ status: 'da_giao' });
}

async function mapNewStatuses(knex) {
  await knex('orders').where('status', 'moi').update({ status: 'pending' });
  await knex('orders').where('status', 'da_lien_he').update({ status: 'confirmed' });
  await knex('orders').where('status', 'da_giao').update({ status: 'completed' });
}

// SQLite silently rewrites other tables' FOREIGN KEY clauses to match a
// renamed table, so after "orders" gets renamed away and a new "orders" is
// created in its place, order_items is left pointing at the now-dropped
// intermediate name. Rebuild it so its FK targets "orders" again.
async function fixOrderItemsForeignKey(knex) {
  await knex.schema.renameTable('order_items', 'order_items_fk_rebuild');
  await knex.raw('DROP INDEX IF EXISTS order_items_order_id_index');
  await knex.raw('DROP INDEX IF EXISTS order_items_product_id_index');
  await knex.schema.createTable('order_items', (table) => {
    table.increments('id').primary();
    table.integer('order_id').unsigned().notNullable().references('id').inTable('orders').onDelete('CASCADE');
    table.integer('product_id').unsigned().nullable().references('id').inTable('products').onDelete('SET NULL');
    table.string('product_name', 200).notNullable();
    table.integer('price').unsigned().notNullable();
    table.integer('quantity').unsigned().notNullable();
  });
  await knex.raw(`
    INSERT INTO order_items (id, order_id, product_id, product_name, price, quantity)
    SELECT id, order_id, product_id, product_name, price, quantity FROM order_items_fk_rebuild
  `);
  await knex.schema.dropTable('order_items_fk_rebuild');
}

exports.up = async function (knex) {
  const isSqlite = knex.client.config.client.includes('sqlite');

  await mapOldStatuses(knex);

  if (isSqlite) {
    await knex.schema.renameTable('orders', 'orders_old_status_migration');
    // SQLite indexes are named independently of their table and don't get
    // renamed along with it, so the old unique index has to go before the
    // new "orders" table can claim the same index name.
    await knex.raw('DROP INDEX IF EXISTS orders_order_code_unique');
    await knex.schema.createTable('orders', (table) => {
      table.increments('id').primary();
      table.string('order_code', 20).notNullable().unique();
      table.string('customer_name', 150).notNullable();
      table.string('phone', 20).notNullable();
      table.string('address', 300).notNullable();
      table.text('note').nullable();
      table.enu('payment_method', ['cod', 'bank_transfer'], {
        useNative: false,
        enumName: 'payment_method_check'
      }).notNullable();
      table.enu('status', ['moi', 'da_lien_he', 'da_giao'], {
        useNative: false,
        enumName: 'order_status_check'
      }).notNullable().defaultTo('moi');
      table.integer('total').unsigned().notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.text('admin_note').nullable();
    });
    await knex.raw(`
      INSERT INTO orders (id, order_code, customer_name, phone, address, note, payment_method, status, total, created_at, admin_note)
      SELECT id, order_code, customer_name, phone, address, note, payment_method, status, total, created_at, admin_note FROM orders_old_status_migration
    `);
    await knex.schema.dropTable('orders_old_status_migration');
    await fixOrderItemsForeignKey(knex);
  } else {
    await knex.schema.alterTable('orders', (table) => {
      table.enu('status', ['moi', 'da_lien_he', 'da_giao'], {
        useNative: false,
        enumName: 'order_status_check'
      }).notNullable().defaultTo('moi').alter();
    });
  }
};

exports.down = async function (knex) {
  const isSqlite = knex.client.config.client.includes('sqlite');

  if (isSqlite) {
    await knex.schema.renameTable('orders', 'orders_new_status_migration');
    await knex.raw('DROP INDEX IF EXISTS orders_order_code_unique');
    await knex.schema.createTable('orders', (table) => {
      table.increments('id').primary();
      table.string('order_code', 20).notNullable().unique();
      table.string('customer_name', 150).notNullable();
      table.string('phone', 20).notNullable();
      table.string('address', 300).notNullable();
      table.text('note').nullable();
      table.enu('payment_method', ['cod', 'bank_transfer'], {
        useNative: false,
        enumName: 'payment_method_check'
      }).notNullable();
      table.enu('status', ['pending', 'confirmed', 'shipping', 'completed', 'cancelled'], {
        useNative: false,
        enumName: 'order_status_check'
      }).notNullable().defaultTo('pending');
      table.integer('total').unsigned().notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.text('admin_note').nullable();
    });
    await knex.raw(`
      INSERT INTO orders (id, order_code, customer_name, phone, address, note, payment_method, status, total, created_at, admin_note)
      SELECT id, order_code, customer_name, phone, address, note, payment_method, status, total, created_at, admin_note FROM orders_new_status_migration
    `);
    await knex.schema.dropTable('orders_new_status_migration');
    await fixOrderItemsForeignKey(knex);
  } else {
    await knex.schema.alterTable('orders', (table) => {
      table.enu('status', ['pending', 'confirmed', 'shipping', 'completed', 'cancelled'], {
        useNative: false,
        enumName: 'order_status_check'
      }).notNullable().defaultTo('pending').alter();
    });
  }

  await mapNewStatuses(knex);
};
