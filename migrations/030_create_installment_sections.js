// Trang "Trả góp linh động" (customer-facing) with 2 admin-editable rich-text
// sections: "Tín dụng" and "Ngân hàng". content_html holds Quill-authored
// HTML (sanitized server-side before every save).
exports.up = async function (knex) {
  await knex.schema.createTable('installment_sections', (table) => {
    table.increments('id').primary();
    table.string('section_key', 20).notNullable().unique();
    table.string('title', 100).notNullable();
    table.text('content_html', 'longtext').notNullable().defaultTo('');
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  await knex('installment_sections').insert([
    { section_key: 'tin_dung', title: 'Tín dụng', content_html: '' },
    { section_key: 'ngan_hang', title: 'Ngân hàng', content_html: '' }
  ]);
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('installment_sections');
};
