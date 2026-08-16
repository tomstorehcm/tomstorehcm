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

function showChangePassword(req, res) {
  res.render('admin/change-password', {
    title: 'Đổi mật khẩu - TOMSTORE Admin',
    error: null,
    success: null
  });
}

async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const admin = await db('admin_users').where('id', req.session.adminId).first();

    const ok = await bcrypt.compare(currentPassword || '', admin.password_hash);
    if (!ok) {
      return res.status(400).render('admin/change-password', {
        title: 'Đổi mật khẩu - TOMSTORE Admin',
        error: 'Mật khẩu hiện tại không đúng.',
        success: null
      });
    }

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).render('admin/change-password', {
        title: 'Đổi mật khẩu - TOMSTORE Admin',
        error: 'Mật khẩu mới phải có ít nhất 8 ký tự.',
        success: null
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).render('admin/change-password', {
        title: 'Đổi mật khẩu - TOMSTORE Admin',
        error: 'Xác nhận mật khẩu không khớp.',
        success: null
      });
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    await db('admin_users').where('id', admin.id).update({ password_hash: newHash });

    res.render('admin/change-password', {
      title: 'Đổi mật khẩu - TOMSTORE Admin',
      error: null,
      success: 'Đổi mật khẩu thành công.'
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { showLogin, login, logout, showChangePassword, changePassword };
