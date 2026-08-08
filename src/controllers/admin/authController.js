const bcrypt = require('bcryptjs');
const db = require('../../db');

function showLogin(req, res) {
  res.render('admin/login', {
    title: 'Đăng nhập quản trị - TOMSTORE',
    error: null
  });
}

async function login(req, res, next) {
  try {
    const { username, password } = req.body;
    const admin = await db('admin_users').where('username', username).first();

    if (!admin) {
      return res.status(401).render('admin/login', {
        title: 'Đăng nhập quản trị - TOMSTORE',
        error: 'Sai tên đăng nhập hoặc mật khẩu.'
      });
    }

    const ok = await bcrypt.compare(password || '', admin.password_hash);
    if (!ok) {
      return res.status(401).render('admin/login', {
        title: 'Đăng nhập quản trị - TOMSTORE',
        error: 'Sai tên đăng nhập hoặc mật khẩu.'
      });
    }

    req.session.adminId = admin.id;
    req.session.adminUsername = admin.username;
    res.redirect('/admin');
  } catch (err) {
    next(err);
  }
}

function logout(req, res, next) {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.redirect('/admin/login');
  });
}

module.exports = { showLogin, login, logout };
