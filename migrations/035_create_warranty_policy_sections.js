// Trang "Chính Sách Bảo Hành" (customer-facing) -- same pattern as
// installment_sections/"Trả góp linh động": admin-editable rich-text (Quill)
// sections, rendered as tabs on the public page. Separate from the existing
// "policies" table (short icon + title badges shown under product price) --
// this is a full read-along policy page, not per-product badges.
exports.up = async function (knex) {
  await knex.schema.createTable('warranty_policy_sections', (table) => {
    table.increments('id').primary();
    table.string('section_key', 20).notNullable().unique();
    table.string('title', 100).notNullable();
    table.text('content_html', 'longtext').notNullable().defaultTo('');
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  await knex('warranty_policy_sections').insert([
    { section_key: 'dieu_kien', title: 'Điều kiện bảo hành', content_html: '' },
    { section_key: 'quy_trinh', title: 'Quy trình bảo hành', content_html: '' }
  ]);
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('warranty_policy_sections');
};
