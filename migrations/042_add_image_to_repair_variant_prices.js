// Them anh RIENG theo tung cap (Loai, San pham) vao repair_variant_prices --
// truoc gio 1 "Loai" (repair_variants) chi co 1 anh DUNG CHUNG cho moi san
// pham (vd "Man hinh Kinh Vang"), nhung thuc te moi dong may dung linh kien
// (man hinh/pin) khac hang nen anh co the khac nhau. Cot nay la anh GHI DE
// rieng cho dung 1 san pham -- de trong (null) thi trang cong khai/trang
// admin se tu dong fallback ve anh mac dinh cua repair_variants.image_url.
exports.up = async function (knex) {
  await knex.schema.alterTable('repair_variant_prices', (table) => {
    table.string('image_url', 500).nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('repair_variant_prices', (table) => {
    table.dropColumn('image_url');
  });
};
