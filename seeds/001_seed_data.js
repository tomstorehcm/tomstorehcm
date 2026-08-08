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
  { slug: 'dien-thoai', name: 'Điện thoại', sort_order: 1, image_url: '/images/categories/dien-thoai.webp' },
  { slug: 'macbook', name: 'MacBook', sort_order: 2, image_url: '/images/categories/macbook.webp' },
  { slug: 'may-tinh-bang', name: 'Máy tính bảng', sort_order: 3, image_url: '/images/categories/may-tinh-bang.webp' },
  { slug: 'tai-nghe', name: 'Tai nghe', sort_order: 4, image_url: '/images/categories/tai-nghe.webp' }
];

const PRODUCTS_BY_CATEGORY = {
  'dien-thoai': [
    {
      name: 'iPhone 17 Pro Max 256GB',
      brand: 'Apple',
      price: 37990000,
      salePrice: 35990000,
      hotDeal: true,
      specs: { 'Màn hình': '6.9 inch Super Retina XDR, ProMotion 120Hz', 'Chip': 'Apple A19 Pro', 'RAM': '12GB', 'Bộ nhớ': '256GB', 'Pin': 'Tới 33 giờ xem video', 'Camera sau': '48MP + 48MP + 48MP' }
    },
    {
      name: 'iPhone 17 Pro 256GB',
      brand: 'Apple',
      price: 34790000,
      featured: true,
      specs: { 'Màn hình': '6.3 inch Super Retina XDR, ProMotion 120Hz', 'Chip': 'Apple A19 Pro', 'RAM': '12GB', 'Bộ nhớ': '256GB', 'Pin': 'Tới 31 giờ xem video', 'Camera sau': '48MP + 48MP + 48MP' }
    },
    {
      name: 'iPhone Air 256GB',
      brand: 'Apple',
      price: 26990000,
      salePrice: 24990000,
      hotDeal: true,
      specs: { 'Màn hình': '6.5 inch Super Retina XDR, ProMotion 120Hz', 'Chip': 'Apple A19 Pro', 'RAM': '8GB', 'Bộ nhớ': '256GB', 'Pin': 'Tới 27 giờ xem video', 'Camera sau': '48MP' }
    },
    {
      name: 'iPhone 17 256GB',
      brand: 'Apple',
      price: 24690000,
      featured: true,
      specs: { 'Màn hình': '6.3 inch Super Retina XDR, 120Hz', 'Chip': 'Apple A19', 'RAM': '8GB', 'Bộ nhớ': '256GB', 'Pin': 'Tới 30 giờ xem video', 'Camera sau': '48MP + 12MP' }
    },
    {
      name: 'iPhone 17e 128GB',
      brand: 'Apple',
      price: 17790000,
      specs: { 'Màn hình': '6.1 inch Super Retina XDR', 'Chip': 'Apple A19', 'RAM': '6GB', 'Bộ nhớ': '128GB', 'Pin': 'Tới 26 giờ xem video', 'Camera sau': '48MP' }
    },
    {
      name: 'iPhone 16 128GB',
      brand: 'Apple',
      price: 18990000,
      salePrice: 16990000,
      hotDeal: true,
      specs: { 'Màn hình': '6.1 inch Super Retina XDR, 60Hz', 'Chip': 'Apple A18', 'RAM': '8GB', 'Bộ nhớ': '128GB', 'Pin': 'Tới 26 giờ xem video', 'Camera sau': '48MP + 12MP' }
    }
  ],
  macbook: [
    {
      name: 'MacBook Air 13 inch M4 16GB/256GB',
      brand: 'Apple',
      price: 27990000,
      salePrice: 26990000,
      hotDeal: true,
      specs: { 'Màn hình': '13.6 inch Liquid Retina', 'Chip': 'Apple M4 10-core', 'RAM': '16GB', 'Ổ cứng': '256GB SSD', 'Pin': 'Tới 18 giờ', 'Trọng lượng': '1.24 kg' }
    },
    {
      name: 'MacBook Air 15 inch M4 16GB/256GB',
      brand: 'Apple',
      price: 31990000,
      featured: true,
      specs: { 'Màn hình': '15.3 inch Liquid Retina', 'Chip': 'Apple M4 10-core', 'RAM': '16GB', 'Ổ cứng': '256GB SSD', 'Pin': 'Tới 18 giờ', 'Trọng lượng': '1.51 kg' }
    },
    {
      name: 'MacBook Pro 14 inch M4 16GB/512GB',
      brand: 'Apple',
      price: 42990000,
      featured: true,
      specs: { 'Màn hình': '14.2 inch Liquid Retina XDR', 'Chip': 'Apple M4 10-core', 'RAM': '16GB', 'Ổ cứng': '512GB SSD', 'Pin': 'Tới 18 giờ', 'Trọng lượng': '1.55 kg' }
    },
    {
      name: 'MacBook Pro 14 inch M4 Pro 24GB/512GB',
      brand: 'Apple',
      price: 52990000,
      featured: true,
      specs: { 'Màn hình': '14.2 inch Liquid Retina XDR', 'Chip': 'Apple M4 Pro 14-core', 'RAM': '24GB', 'Ổ cứng': '512GB SSD', 'Pin': 'Tới 18 giờ', 'Trọng lượng': '1.60 kg' }
    },
    {
      name: 'MacBook Pro 16 inch M4 Pro 24GB/512GB',
      brand: 'Apple',
      price: 64990000,
      specs: { 'Màn hình': '16.2 inch Liquid Retina XDR', 'Chip': 'Apple M4 Pro 14-core', 'RAM': '24GB', 'Ổ cứng': '512GB SSD', 'Pin': 'Tới 24 giờ', 'Trọng lượng': '2.15 kg' }
    },
    {
      name: 'MacBook Air 13 inch M3 8GB/256GB',
      brand: 'Apple',
      price: 23990000,
      salePrice: 21990000,
      hotDeal: true,
      specs: { 'Màn hình': '13.6 inch Liquid Retina', 'Chip': 'Apple M3 8-core', 'RAM': '8GB', 'Ổ cứng': '256GB SSD', 'Pin': 'Tới 18 giờ', 'Trọng lượng': '1.24 kg' }
    }
  ],
  'may-tinh-bang': [
    {
      name: 'iPad Gen 11 128GB WiFi',
      brand: 'Apple',
      price: 12390000,
      featured: true,
      specs: { 'Màn hình': '11 inch Liquid Retina', 'Chip': 'Apple A16', 'Bộ nhớ': '128GB', 'Kết nối': 'WiFi', 'Pin': 'Tới 10 giờ' }
    },
    {
      name: 'iPad Air 11 inch M3 128GB',
      brand: 'Apple',
      price: 16990000,
      salePrice: 15490000,
      hotDeal: true,
      specs: { 'Màn hình': '11 inch Liquid Retina', 'Chip': 'Apple M3', 'Bộ nhớ': '128GB', 'Kết nối': 'WiFi', 'Pin': 'Tới 10 giờ' }
    },
    {
      name: 'iPad Air 13 inch M3 128GB',
      brand: 'Apple',
      price: 20990000,
      specs: { 'Màn hình': '13 inch Liquid Retina', 'Chip': 'Apple M3', 'Bộ nhớ': '128GB', 'Kết nối': 'WiFi', 'Pin': 'Tới 10 giờ' }
    },
    {
      name: 'iPad Pro 11 inch M4 256GB',
      brand: 'Apple',
      price: 25790000,
      featured: true,
      specs: { 'Màn hình': '11 inch Ultra Retina XDR', 'Chip': 'Apple M4', 'Bộ nhớ': '256GB', 'Kết nối': 'WiFi', 'Pin': 'Tới 10 giờ' }
    },
    {
      name: 'iPad Pro 13 inch M4 256GB',
      brand: 'Apple',
      price: 39990000,
      featured: true,
      specs: { 'Màn hình': '13 inch Ultra Retina XDR', 'Chip': 'Apple M4', 'Bộ nhớ': '256GB', 'Kết nối': 'WiFi', 'Pin': 'Tới 10 giờ' }
    },
    {
      name: 'iPad Mini 7 128GB',
      brand: 'Apple',
      price: 14990000,
      specs: { 'Màn hình': '8.3 inch Liquid Retina', 'Chip': 'Apple A17 Pro', 'Bộ nhớ': '128GB', 'Kết nối': 'WiFi', 'Pin': 'Tới 10 giờ' }
    }
  ],
  'tai-nghe': [
    {
      name: 'AirPods Pro 3 USB-C',
      brand: 'Apple',
      price: 6490000,
      salePrice: 6190000,
      hotDeal: true,
      specs: { 'Kiểu dáng': 'True Wireless, In-ear', 'Chống ồn': 'Active Noise Cancellation', 'Pin': 'Tới 8 giờ/lần sạc', 'Chống nước': 'IP57', 'Kết nối': 'Bluetooth 5.3' }
    },
    {
      name: 'AirPods Pro 2 USB-C',
      brand: 'Apple',
      price: 5290000,
      salePrice: 4790000,
      hotDeal: true,
      specs: { 'Kiểu dáng': 'True Wireless, In-ear', 'Chống ồn': 'Active Noise Cancellation', 'Pin': 'Tới 6 giờ/lần sạc', 'Chống nước': 'IP54', 'Kết nối': 'Bluetooth 5.3' }
    },
    {
      name: 'AirPods 4',
      brand: 'Apple',
      price: 3490000,
      featured: true,
      specs: { 'Kiểu dáng': 'True Wireless, In-ear', 'Pin': 'Tới 5 giờ/lần sạc', 'Chống nước': 'IPX4', 'Kết nối': 'Bluetooth 5.3' }
    },
    {
      name: 'AirPods 4 ANC',
      brand: 'Apple',
      price: 4790000,
      featured: true,
      specs: { 'Kiểu dáng': 'True Wireless, In-ear', 'Chống ồn': 'Active Noise Cancellation', 'Pin': 'Tới 5 giờ/lần sạc', 'Chống nước': 'IPX4', 'Kết nối': 'Bluetooth 5.3' }
    },
    {
      name: 'AirPods Max USB-C',
      brand: 'Apple',
      price: 13190000,
      featured: true,
      specs: { 'Kiểu dáng': 'Over-ear', 'Chống ồn': 'Active Noise Cancellation', 'Pin': 'Tới 20 giờ', 'Kết nối': 'Bluetooth 5.3' }
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
      image_url: '/images/banners/mainbanners/BANNER_1.jpg',
      link_url: null,
      sort_order: 1,
      is_active: true,
      type: 'hero'
    },
    {
      image_url: '/images/banners/mainbanners/BANNER_2.jpg',
      link_url: '/danh-muc/dien-thoai',
      sort_order: 2,
      is_active: true,
      type: 'hero'
    },
    {
      image_url: '/images/banners/len-doi-may-moi.jpg',
      link_url: null,
      sort_order: 1,
      is_active: true,
      type: 'featured'
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
