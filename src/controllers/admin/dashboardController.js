const db = require('../../db');
const { DEFAULT_STATUS, STATUSES } = require('../../utils/orderStatus');

const MONTH_NAMES = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
];

function dateKey(date) {
  const d = new Date(date);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

async function showDashboard(req, res, next) {
  try {
    const [{ count: productCount }] = await db('products').count('id as count');
    const [{ count: orderCount }] = await db('orders').count('id as count');
    const [{ count: pendingCount }] = await db('orders').where('status', DEFAULT_STATUS).count('id as count');
    const now = new Date();
    const [{ count: hotDealCount }] = await db('products')
      .where('is_hot_deal', true)
      .andWhere('hot_deal_expires_at', '>', now)
      .count('id as count');

    const allOrders = await db('orders').orderBy('created_at', 'desc');

    const years = Array.from(new Set(allOrders.map((o) => new Date(o.created_at).getFullYear()))).sort((a, b) => b - a);

    const selectedYear = req.query.year ? Number(req.query.year) : null;
    const selectedMonth = req.query.month ? Number(req.query.month) : null;

    let orders = allOrders;
    if (selectedYear) orders = orders.filter((o) => new Date(o.created_at).getFullYear() === selectedYear);
    if (selectedMonth) orders = orders.filter((o) => new Date(o.created_at).getMonth() + 1 === selectedMonth);

    const groups = [];
    const groupsByKey = {};
    orders.forEach((o) => {
      const key = dateKey(o.created_at);
      if (!groupsByKey[key]) {
        groupsByKey[key] = { date: new Date(o.created_at), orders: [] };
        groups.push(groupsByKey[key]);
      }
      groupsByKey[key].orders.push(o);
    });

    res.render('admin/dashboard', {
      title: 'Quản lý đơn hàng - TOMSTORE Admin',
      stats: {
        productCount: Number(productCount),
        orderCount: Number(orderCount),
        pendingCount: Number(pendingCount),
        hotDealCount: Number(hotDealCount)
      },
      groups,
      years,
      months: MONTH_NAMES,
      selectedYear,
      selectedMonth,
      statuses: STATUSES
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { showDashboard };
