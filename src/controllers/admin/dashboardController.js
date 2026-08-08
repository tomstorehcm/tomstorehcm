const db = require('../../db');

async function showDashboard(req, res, next) {
  try {
    const [{ count: productCount }] = await db('products').count('id as count');
    const [{ count: orderCount }] = await db('orders').count('id as count');
    const [{ count: pendingCount }] = await db('orders').where('status', 'pending').count('id as count');
    const now = new Date();
    const [{ count: hotDealCount }] = await db('products')
      .where('is_hot_deal', true)
      .andWhere('hot_deal_expires_at', '>', now)
      .count('id as count');

    const recentOrders = await db('orders').orderBy('created_at', 'desc').limit(5);

    res.render('admin/dashboard', {
      title: 'Bảng điều khiển - TOMSTORE Admin',
      stats: {
        productCount: Number(productCount),
        orderCount: Number(orderCount),
        pendingCount: Number(pendingCount),
        hotDealCount: Number(hotDealCount)
      },
      recentOrders
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { showDashboard };
