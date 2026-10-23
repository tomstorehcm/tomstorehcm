// Cho phep admin SUA thong tin khach o "Khach sua chua" (them IMEI) va o
// "Khach Trade In" (sau nay), kem 1 bang LICH SU chung ghi lai moi lan sua
// (truoc/sau cho tung truong) -- dung chung cho ca repair_request,
// trade_in_request va customer. Xem src/utils/auditLog.js.
exports.up = async function (knex) {
  const hasImei = await knex.schema.hasColumn('repair_requests', 'imei');
  if (!hasImei) {
    await knex.schema.alterTable('repair_requests', (table) => {
      table.string('imei', 50).nullable();
    });
  }

  const hasLogsTable = await knex.schema.hasTable('admin_edit_logs');
  if (!hasLogsTable) {
    await knex.schema.createTable('admin_edit_logs', (table) => {
      table.increments('id').primary();
      table.string('entity_type', 40).notNullable();
      table.integer('entity_id').unsigned().notNullable();
      table.string('entity_label', 200).nullable();
      table.text('changes').notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index(['entity_type', 'entity_id']);
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('admin_edit_logs');
  const hasImei = await knex.schema.hasColumn('repair_requests', 'imei');
  if (hasImei) {
    await knex.schema.alterTable('repair_requests', (table) => {
      table.dropColumn('imei');
    });
  }
};
