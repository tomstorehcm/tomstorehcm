// Ghi lại lich su nhung lan khach mang san pham toi bao hanh, tach rieng
// khoi ban than dong "customer_purchases" (1 san pham co the duoc bao hanh
// nhieu lan qua thoi gian, moi lan la 1 dong rieng thay vi ghi de 1 o ghi
// chu duy nhat). purchase_id tro ve dung dong san pham (customer_purchases)
// ma lan bao hanh nay thuoc ve -- ke ca voi san pham khach mua o noi khac
// (transaction_type = 'bao_hanh_ngoai'), vi dong "customer_purchases" cho
// san pham do van duoc tao binh thuong qua form co san.
exports.up = async function (knex) {
  await knex.schema.createTable('purchase_warranty_visits', (table) => {
    table.increments('id').primary();
    table
      .integer('purchase_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('customer_purchases')
      .onDelete('CASCADE');
    table.date('visit_date').notNullable();
    table.text('issue').notNullable();
    table.text('resolution').nullable();
    table.integer('cost').unsigned().nullable();
    table.text('note').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.index('purchase_id');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('purchase_warranty_visits');
};
