// Doi cach nhap Dung luong/Mau cua san pham thu cu: truoc day Mau la 1 danh
// sach rieng, dung chung cho ca san pham (khong gan voi Dung luong nao) va
// gia duoc nhap qua 1 bang ma tran rieng (Dung luong x Mau x Tinh trang).
// Theo yeu cau moi, giao dien nhap se giong trang Them san pham: moi Dung
// luong co danh sach Mau RIENG long ben trong, gia thu nhap thang tai dong
// Mau (1 o gia cho moi Muc tinh trang). Vi vay moi Mau gio can biet no thuoc
// Dung luong nao -- them storage_option_id vao trade_in_color_options, dung
// dung pattern da chung minh hoat dong tren ca MySQL/SQLite o migration 026
// (product_variants.variant_group_id): FK nullable khai bao ngay trong
// alterTable, onDelete CASCADE (xoa dung luong thi xoa luon cac mau con cua
// no). Nullable de khong vo du lieu mau cu (truoc gio chua gan dung luong)
// -- code ung dung (tradeInAdminController) luon gan gia tri nay cho moi mau
// moi tu nay ve sau.
exports.up = async function (knex) {
  await knex.schema.alterTable('trade_in_color_options', (table) => {
    table
      .integer('storage_option_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('trade_in_storage_options')
      .onDelete('CASCADE');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('trade_in_color_options', (table) => {
    table.dropColumn('storage_option_id');
  });
};
