// Adds a recovery email for the admin account plus a small table of
// short-lived codes used both for "quên mật khẩu" (a link emailed to reset a
// forgotten password) and for confirming an in-session password change via a
// code emailed to the same address -- so a hijacked admin session alone
// can't silently change the password without the real owner seeing an email.
exports.up = async function (knex) {
  await knex.schema.alterTable('admin_users', (table) => {
    table.string('email', 150).nullable();
  });
  await knex.schema.createTable('admin_verification_codes', (table) => {
    table.increments('id').primary();
    table
      .integer('admin_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('admin_users')
      .onDelete('CASCADE');
    table.string('purpose', 20).notNullable(); // 'reset' | 'change_password'
    table.string('code', 100).notNullable();
    table.timestamp('expires_at').notNullable();
    table.timestamp('used_at').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['admin_id', 'purpose']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('admin_verification_codes');
  await knex.schema.alterTable('admin_users', (table) => {
    table.dropColumn('email');
  });
};
