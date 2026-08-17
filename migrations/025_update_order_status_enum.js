// Collapses the old 5-state order status (pending/confirmed/shipping/
// completed/cancelled) into the 3 states the store actually uses day to day.
//
// This can't be a plain "UPDATE to new values, then ALTER the constraint"
// migration: on MySQL, `status` is a native ENUM, and writing a value that
// isn't in the *current* enum list gets silently coerced to '' instead of
// erroring (in non-strict sql_mode) -- so mapping old string values to new
// ones before the enum itself accepts them silently wipes the column. SQLite
// has the mirror problem: its CHECK constraint is strict, so the same
// premature UPDATE would throw outright. Both dialects are handled below by
// never letting the column hold a value invalid for whatever constraint is
// active at that moment -- the remapping happens inside the same statement
// that changes the constraint, never before it.

// SQLite silently ignores "PRAGMA foreign_keys" changes while a transaction
// is open, and knex wraps every migration in one by default -- disable that
// wrapping so the pragma toggle below actually takes effect.
exports.config = { transaction: false };

const OLD_TO_NEW = {
  pending: 'moi',
  confirmed: 'da_lien_he',
  shipping: 'da_lien_he',
  completed: 'da_giao',
  cancelled: 'da_lien_he'
};
const NEW_TO_OLD = {
  moi: 'pending',
  da_lien_he: 'confirmed',
  da_giao: 'completed'
};

function caseExpr(knex, mapping) {
  const whens = Object.entries(mapping).map(([from, to]) => `WHEN '${from}' THEN '${to}'`).join(' ');
  return knex.raw(`CASE status ${whens} ELSE status END`);
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

async function rebuildOrdersTable(knex, { fromTableName, statusValues, statusDefault, statusMapping }) {
  await knex.schema.renameTable('orders', fromTableName);
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
    table.enu('status', statusValues, {
      useNative: false,
      enumName: 'order_status_check'
    }).notNullable().defaultTo(statusDefault);
    table.integer('total').unsigned().notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.text('admin_note').nullable();
  });

  const statusSelect = caseExpr(knex, statusMapping).toString();
  await knex.raw(`
    INSERT INTO orders (id, order_code, customer_name, phone, address, note, payment_method, status, total, created_at, admin_note)
    SELECT id, order_code, customer_name, phone, address, note, payment_method, ${statusSelect}, total, created_at, admin_note FROM ${fromTableName}
  `);
  await knex.schema.dropTable(fromTableName);
  await fixOrderItemsForeignKey(knex);
}

exports.up = async function (knex) {
  const isSqlite = knex.client.config.client.includes('sqlite');

  if (isSqlite) {
    // Renaming/dropping tables mid-rebuild can trip FK-related side effects
    // on the still-attached order_items table (observed: it lost its rows
    // entirely partway through). Foreign keys aren't needed mid-migration --
    // both tables are rebuilt correctly by the end -- so turn enforcement
    // off for the duration.
    await knex.raw('PRAGMA foreign_keys = OFF');
    await rebuildOrdersTable(knex, {
      fromTableName: 'orders_old_status_migration',
      statusValues: ['moi', 'da_lien_he', 'da_giao'],
      statusDefault: 'moi',
      statusMapping: OLD_TO_NEW
    });
    await knex.raw('PRAGMA foreign_keys = ON');
  } else {
    // Native MySQL ENUM: widen to accept both old and new values first, so
    // the remap UPDATE is always valid, then narrow to just the new ones.
    await knex.schema.alterTable('orders', (table) => {
      table.enu('status', [
        'pending', 'confirmed', 'shipping', 'completed', 'cancelled',
        'moi', 'da_lien_he', 'da_giao'
      ], { useNative: false, enumName: 'order_status_check' }).notNullable().defaultTo('moi').alter();
    });
    await knex('orders').update({ status: caseExpr(knex, OLD_TO_NEW) });
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
    await knex.raw('PRAGMA foreign_keys = OFF');
    await rebuildOrdersTable(knex, {
      fromTableName: 'orders_new_status_migration',
      statusValues: ['pending', 'confirmed', 'shipping', 'completed', 'cancelled'],
      statusDefault: 'pending',
      statusMapping: NEW_TO_OLD
    });
    await knex.raw('PRAGMA foreign_keys = ON');
  } else {
    await knex.schema.alterTable('orders', (table) => {
      table.enu('status', [
        'pending', 'confirmed', 'shipping', 'completed', 'cancelled',
        'moi', 'da_lien_he', 'da_giao'
      ], { useNative: false, enumName: 'order_status_check' }).notNullable().defaultTo('pending').alter();
    });
    await knex('orders').update({ status: caseExpr(knex, NEW_TO_OLD) });
    await knex.schema.alterTable('orders', (table) => {
      table.enu('status', ['pending', 'confirmed', 'shipping', 'completed', 'cancelled'], {
        useNative: false,
        enumName: 'order_status_check'
      }).notNullable().defaultTo('pending').alter();
    });
  }
};
