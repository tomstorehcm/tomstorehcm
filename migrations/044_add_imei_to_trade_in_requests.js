// Cho phep admin xem/sua IMEI cua CA 2 may trong 1 yeu cau Trade In: may
// khach mang toi thu cu (trade_in_imei) va may khach mua/len doi (upgrade_imei,
// chi co khi mode = 'len_doi'). Tuong tu IMEI da them cho repair_requests o
// migration 043.
exports.up = async function (knex) {
  const hasTradeInImei = await knex.schema.hasColumn('trade_in_requests', 'trade_in_imei');
  const hasUpgradeImei = await knex.schema.hasColumn('trade_in_requests', 'upgrade_imei');
  if (!hasTradeInImei || !hasUpgradeImei) {
    await knex.schema.alterTable('trade_in_requests', (table) => {
      if (!hasTradeInImei) table.string('trade_in_imei', 50).nullable();
      if (!hasUpgradeImei) table.string('upgrade_imei', 50).nullable();
    });
  }
};

exports.down = async function (knex) {
  const hasTradeInImei = await knex.schema.hasColumn('trade_in_requests', 'trade_in_imei');
  const hasUpgradeImei = await knex.schema.hasColumn('trade_in_requests', 'upgrade_imei');
  if (hasTradeInImei || hasUpgradeImei) {
    await knex.schema.alterTable('trade_in_requests', (table) => {
      if (hasTradeInImei) table.dropColumn('trade_in_imei');
      if (hasUpgradeImei) table.dropColumn('upgrade_imei');
    });
  }
};
