const DEFAULT_POLICIES = [
  {
    title: 'Bảo hành 2 năm phần cứng',
    description: 'Không bao gồm rơi rớt, vô nước',
    icon: 'shield'
  },
  {
    title: '1 đổi 1 trong 60 ngày',
    description: 'Khi phát sinh lỗi từ nhà sản xuất',
    icon: 'refresh'
  },
  {
    title: 'Màn hình bảo hành 1 năm',
    description: 'Lỗi xanh, trắng màn',
    icon: 'monitor'
  },
  {
    title: 'Bảo hành pin trọn đời',
    description: 'Thay miễn phí khi pin còn dưới 75%',
    icon: 'battery'
  },
  {
    title: 'Phụ kiện tặng kèm bảo hành trọn đời',
    description: 'Sạc, cáp, ốp lưng... đi kèm sản phẩm',
    icon: 'gift'
  }
];

exports.up = async function (knex) {
  await knex.schema.createTable('policy_groups', (table) => {
    table.increments('id').primary();
    table.string('name', 150).notNullable();
    table.boolean('is_default').notNullable().defaultTo(false);
    table.integer('sort_order').notNullable().defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('policies', (table) => {
    table.increments('id').primary();
    table
      .integer('group_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('policy_groups')
      .onDelete('SET NULL');
    table.string('title', 200).notNullable();
    table.string('description', 300).nullable();
    table.string('icon', 50).notNullable().defaultTo('shield');
    table.integer('sort_order').notNullable().defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['group_id']);
  });

  await knex.schema.createTable('product_policies', (table) => {
    table.increments('id').primary();
    table
      .integer('product_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('products')
      .onDelete('CASCADE');
    table
      .integer('policy_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('policies')
      .onDelete('CASCADE');
    table.unique(['product_id', 'policy_id']);
  });

  await knex.schema.alterTable('products', (table) => {
    table
      .integer('policy_group_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('policy_groups')
      .onDelete('SET NULL');
  });

  const [groupIdRaw] = await knex('policy_groups').insert({
    name: 'Mặc định',
    is_default: true,
    sort_order: 0
  });
  const groupId = groupIdRaw && groupIdRaw.id ? groupIdRaw.id : groupIdRaw;

  await knex('policies').insert(
    DEFAULT_POLICIES.map((p, i) => ({
      group_id: groupId,
      title: p.title,
      description: p.description,
      icon: p.icon,
      sort_order: i
    }))
  );

  await knex('products').update({ policy_group_id: groupId });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('products', (table) => {
    table.dropColumn('policy_group_id');
  });
  await knex.schema.dropTableIfExists('product_policies');
  await knex.schema.dropTableIfExists('policies');
  await knex.schema.dropTableIfExists('policy_groups');
};
