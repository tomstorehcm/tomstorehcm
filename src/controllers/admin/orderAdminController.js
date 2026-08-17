const db = require('../../db');
const { STATUSES, STATUS_KEYS } = require('../../utils/orderStatus');

async function showOrder(req, res, next) {
  try {
    const order = await db('orders').where('id', req.params.id).first();
    if (!order) return res.redirect('/admin');

    const items = await db('order_items').where('order_id', order.id);

    res.render('admin/order-detail', {
      title: `Đơn hàng ${order.order_code} - TOMSTORE Admin`,
      order,
      items,
      statuses: STATUSES
    });
  } catch (err) {
    next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!STATUS_KEYS.includes(status)) {
      return res.redirect('/admin');
    }
    await db('orders').where('id', req.params.id).update({ status });
    res.redirect(req.body.redirectTo || '/admin');
  } catch (err) {
    next(err);
  }
}

async function updateNote(req, res, next) {
  try {
    await db('orders').where('id', req.params.id).update({ admin_note: req.body.adminNote || null });
    res.redirect('/admin/don-hang/' + req.params.id);
  } catch (err) {
    next(err);
  }
}

module.exports = { showOrder, updateStatus, updateNote };
