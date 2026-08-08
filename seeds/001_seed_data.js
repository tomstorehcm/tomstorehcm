const bcrypt = require('bcryptjs');

function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const HOURS_24 = 24 * 60 * 60 * 1000;

const CATEGORIES = [
  { slug: 'dien-thoai', name: 'Điện thoại', sort_order: 1 },
  { slug: 'macbook', name: 'MacBook', sort_order: 2 },
  { slug: 'may-tinh-bang', name: 'Máy tính bảng', sort_order: 3 },
  { slug: 'tai-nghe', name: 'Tai nghe', sort_order: 4 }
];

const PRODUCTS_BY_CATEGORY = {
  'dien-thoai': [
    {
      name: 'iPhone 15 Pro Max 256GB',
      brand: 'Apple',
      price: 34990000,
      salePrice: 32990000,
      hotDeal: true,
      specs: { 'Màn hình': '6.7 inch OLED, 120Hz', 'Chip': 'Apple A17 Pro', 'RAM': '8GB', 'Bộ nhớ': '256GB', 'Pin': '4422 mAh', 'Camera sau': '48MP + 12MP + 12MP' }
    },
    {
      name: 'iPhone 15 128GB',
      brand: 'Apple',
      price: 22990000,
      featured: true,
      specs: { 'Màn hình': '6.1 inch OLED', 'Chip': 'Apple A16 Bionic', 'RAM': '6GB', 'Bộ nhớ': '128GB', 'Pin': '3349 mAh', 'Camera sau': '48MP + 12MP' }
    },
    {
      name: 'Samsung Galaxy S24 Ultra 256GB',
      brand: 'Samsung',
      price: 29990000,
      salePrice: 27990000,
      hotDeal: true,
      specs: { 'Màn hình': '6.8 inch Dynamic AMOLED 2X', 'Chip': 'Snapdragon 8 Gen 3', 'RAM': '12GB', 'Bộ nhớ': '256GB', 'Pin': '5000 mAh', 'Camera sau': '200MP + 50MP + 12MP + 10MP' }
    },
    {
      name: 'Samsung Galaxy Z Flip5',
      brand: 'Samsung',
      price: 24990000,
      specs: { 'Màn hình': '6.7 inch Dynamic AMOLED gập', 'Chip': 'Snapdragon 8 Gen 2', 'RAM': '8GB', 'Bộ nhớ': '256GB', 'Pin': '3700 mAh', 'Camera sau': '12MP + 12MP' }
    },
    {
      name: 'Xiaomi 14 Pro',
      brand: 'Xiaomi',
      price: 18990000,
      specs: { 'Màn hình': '6.73 inch AMOLED, 120Hz', 'Chip': 'Snapdragon 8 Gen 3', 'RAM': '12GB', 'Bộ nhớ': '256GB', 'Pin': '4880 mAh', 'Camera sau': '50MP + 50MP + 50MP' }
    },
    {
      name: 'OPPO Find X7',
      brand: 'OPPO',
      price: 19990000,
      specs: { 'Màn hình': '6.78 inch AMOLED, 120Hz', 'Chip': 'Dimensity 9300', 'RAM': '12GB', 'Bộ nhớ': '256GB', 'Pin': '5000 mAh', 'Camera sau': '50MP + 50MP + 32MP' }
    }
  ],
  macbook: [
    {
      name: 'MacBook Air M2 13 inch 256GB',
      brand: 'Apple',
      price: 26990000,
      salePrice: 24990000,
      hotDeal: true,
      specs: { 'Màn hình': '13.6 inch Liquid Retina', 'Chip': 'Apple M2 8-core', 'RAM': '8GB', 'Ổ cứng': '256GB SSD', 'Pin': 'Tới 18 giờ', 'Trọng lượng': '1.24 kg' }
    },
    {
      name: 'MacBook Air M3 15 inch 512GB',
      brand: 'Apple',
      price: 36990000,
      specs: { 'Màn hình': '15.3 inch Liquid Retina', 'Chip': 'Apple M3 8-core', 'RAM': '8GB', 'Ổ cứng': '512GB SSD', 'Pin': 'Tới 18 giờ', 'Trọng lượng': '1.51 kg' }
    },
    {
      name: 'MacBook Pro 14 M3 Pro 512GB',
      brand: 'Apple',
      price: 52990000,
      featured: true,
      specs: { 'Màn hình': '14.2 inch Liquid Retina XDR', 'Chip': 'Apple M3 Pro 11-core', 'RAM': '18GB', 'Ổ cứng': '512GB SSD', 'Pin': 'Tới 18 giờ', 'Trọng lượng': '1.61 kg' }
    },
    {
      name: 'MacBook Pro 16 M3 Max 1TB',
      brand: 'Apple',
      price: 89990000,
      featured: true,
      specs: { 'Màn hình': '16.2 inch Liquid Retina XDR', 'Chip': 'Apple M3 Max 14-core', 'RAM': '36GB', 'Ổ cứng': '1TB SSD', 'Pin': 'Tới 22 giờ', 'Trọng lượng': '2.16 kg' }
    },
    {
      name: 'MacBook Air M1 8GB/256GB',
      brand: 'Apple',
      price: 18990000,
      salePrice: 16990000,
      hotDeal: true,
      specs: { 'Màn hình': '13.3 inch Retina', 'Chip': 'Apple M1 8-core', 'RAM': '8GB', 'Ổ cứng': '256GB SSD', 'Pin': 'Tới 18 giờ', 'Trọng lượng': '1.29 kg' }
    },
    {
      name: 'MacBook Pro 13 M2 256GB',
      brand: 'Apple',
      price: 29990000,
      specs: { 'Màn hình': '13.3 inch Retina', 'Chip': 'Apple M2 8-core', 'RAM': '8GB', 'Ổ cứng': '256GB SSD', 'Pin': 'Tới 20 giờ', 'Trọng lượng': '1.4 kg' }
    }
  ],
  'may-tinh-bang': [
    {
      name: 'iPad Gen 10 64GB WiFi',
      brand: 'Apple',
      price: 10990000,
      featured: true,
      specs: { 'Màn hình': '10.9 inch Liquid Retina', 'Chip': 'Apple A14 Bionic', 'Bộ nhớ': '64GB', 'Kết nối': 'WiFi', 'Pin': 'Tới 10 giờ' }
    },
    {
      name: 'iPad Air M2 11 inch 128GB',
      brand: 'Apple',
      price: 16990000,
      salePrice: 15490000,
      hotDeal: true,
      specs: { 'Màn hình': '11 inch Liquid Retina', 'Chip': 'Apple M2', 'Bộ nhớ': '128GB', 'Kết nối': 'WiFi', 'Pin': 'Tới 10 giờ' }
    },
    {
      name: 'iPad Pro M4 11 inch 256GB',
      brand: 'Apple',
      price: 27990000,
      featured: true,
      specs: { 'Màn hình': '11 inch Ultra Retina XDR', 'Chip': 'Apple M4', 'Bộ nhớ': '256GB', 'Kết nối': 'WiFi', 'Pin': 'Tới 10 giờ' }
    },
    {
      name: 'iPad Mini 6 64GB',
      brand: 'Apple',
      price: 12990000,
      featured: true,
      specs: { 'Màn hình': '8.3 inch Liquid Retina', 'Chip': 'Apple A15 Bionic', 'Bộ nhớ': '64GB', 'Kết nối': 'WiFi', 'Pin': 'Tới 10 giờ' }
    },
    {
      name: 'Samsung Galaxy Tab S9',
      brand: 'Samsung',
      price: 17990000,
      specs: { 'Màn hình': '11 inch Dynamic AMOLED 2X', 'Chip': 'Snapdragon 8 Gen 2', 'Bộ nhớ': '128GB', 'Kết nối': 'WiFi', 'Pin': '8400 mAh' }
    },
    {
      name: 'Xiaomi Pad 6',
      brand: 'Xiaomi',
      price: 8990000,
      specs: { 'Màn hình': '11 inch LCD, 144Hz', 'Chip': 'Snapdragon 870', 'Bộ nhớ': '128GB', 'Kết nối': 'WiFi', 'Pin': '8840 mAh' }
    }
  ],
  'tai-nghe': [
    {
      name: 'AirPods Pro 2 USB-C',
      brand: 'Apple',
      price: 5990000,
      salePrice: 5290000,
      hotDeal: true,
      specs: { 'Kiểu dáng': 'True Wireless, In-ear', 'Chống ồn': 'Active Noise Cancellation', 'Pin': 'Tới 6 giờ/lần sạc', 'Chống nước': 'IP54', 'Kết nối': 'Bluetooth 5.3' }
    },
    {
      name: 'AirPods 4',
      brand: 'Apple',
      price: 3290000,
      featured: true,
      specs: { 'Kiểu dáng': 'True Wireless, In-ear', 'Pin': 'Tới 5 giờ/lần sạc', 'Chống nước': 'IPX4', 'Kết nối': 'Bluetooth 5.3' }
    },
    {
      name: 'AirPods Max',
      brand: 'Apple',
      price: 12990000,
      featured: true,
      specs: { 'Kiểu dáng': 'Over-ear', 'Chống ồn': 'Active Noise Cancellation', 'Pin': 'Tới 20 giờ', 'Kết nối': 'Bluetooth 5.0' }
    },
    {
      name: 'Sony WH-1000XM5',
      brand: 'Sony',
      price: 8490000,
      salePrice: 7490000,
      hotDeal: true,
      specs: { 'Kiểu dáng': 'Over-ear', 'Chống ồn': 'Active Noise Cancellation', 'Pin': 'Tới 30 giờ', 'Kết nối': 'Bluetooth 5.2' }
    },
    {
      name: 'Samsung Galaxy Buds3 Pro',
      brand: 'Samsung',
      price: 4990000,
      specs: { 'Kiểu dáng': 'True Wireless, In-ear', 'Chống ồn': 'Active Noise Cancellation', 'Pin': 'Tới 6 giờ/lần sạc', 'Chống nước': 'IP57', 'Kết nối': 'Bluetooth 5.3' }
    },
    {
      name: 'JBL Tune 720BT',
      brand: 'JBL',
      price: 1490000,
      specs: { 'Kiểu dáng': 'Over-ear', 'Pin': 'Tới 76 giờ', 'Kết nối': 'Bluetooth 5.3' }
    }
  ]
};

exports.seed = async function (knex) {
  await knex('order_items').del();
  await knex('orders').del();
  await knex('products').del();
  await knex('categories').del();
  await knex('admin_users').del();
  await knex('banners').del();

  const categoryIds = {};
  for (const cat of CATEGORIES) {
    const [id] = await knex('categories').insert(cat).returning('id');
    categoryIds[cat.slug] = typeof id === 'object' ? id.id : id;
  }

  const now = Date.now();
  for (const [catSlug, products] of Object.entries(PRODUCTS_BY_CATEGORY)) {
    for (const p of products) {
      await knex('products').insert({
        category_id: categoryIds[catSlug],
        name: p.name,
        slug: slugify(p.name),
        brand: p.brand,
        price: p.price,
        sale_price: p.salePrice || null,
        image_url: null,
        description: `${p.name} chính hãng, bảo hành 12 tháng tại TOMSTORE.`,
        specs_json: JSON.stringify(p.specs),
        stock: 20,
        is_hot_deal: !!p.hotDeal,
        hot_deal_expires_at: p.hotDeal ? new Date(now + HOURS_24) : null,
        is_featured: !!p.featured
      });
    }
  }

  await knex('banners').insert([
    {
      image_url: '/images/banners/len-doi-may-moi.jpg',
      link_url: '/danh-muc/dien-thoai',
      sort_order: 1,
      is_active: true
    }
  ]);

  const passwordHash = bcrypt.hashSync(
    process.env.ADMIN_DEFAULT_PASSWORD || 'TomStore@2026',
    10
  );
  await knex('admin_users').insert({
    username: process.env.ADMIN_DEFAULT_USERNAME || 'admin',
    password_hash: passwordHash
  });
};
