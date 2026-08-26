const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../../db');
const { sendMail } = require('../../services/mailer');

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 phút
const CHANGE_CODE_TTL_MS = 10 * 60 * 1000; // 10 phút

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

// Bước 1: kiểm tra mật khẩu hiện tại + mật khẩu mới hợp lệ, rồi gửi mã xác
// nhận qua email thay vì đổi ngay -- tránh trường hợp 1 phiên đăng nhập bị
// chiếm quyền (session bị đánh cắp) có thể tự ý đổi mật khẩu mà chủ tài
// khoản không hề hay biết.
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

    if (!admin.email) {
      return res.status(400).render('admin/change-password', {
        title: 'Đổi mật khẩu - TOMSTORE Admin',
        error: 'Tài khoản chưa có email xác nhận. Liên hệ kỹ thuật để thêm email trước khi đổi mật khẩu.',
        success: null
      });
    }

    const code = String(crypto.randomInt(100000, 1000000));
    await db('admin_verification_codes').insert({
      admin_id: admin.id,
      purpose: 'change_password',
      code,
      expires_at: new Date(Date.now() + CHANGE_CODE_TTL_MS)
    });

    req.session.pendingPasswordHash = bcrypt.hashSync(newPassword, 10);

    try {
      await sendMail({
        to: admin.email,
        subject: 'Mã xác nhận đổi mật khẩu - TOMSTORE Admin',
        html: `<p>Mã xác nhận đổi mật khẩu của bạn là:</p><h2>${code}</h2><p>Mã có hiệu lực trong 10 phút. Nếu không phải bạn yêu cầu, hãy bỏ qua email này.</p>`
      });
    } catch (mailErr) {
      return res.status(500).render('admin/change-password', {
        title: 'Đổi mật khẩu - TOMSTORE Admin',
        error: 'Không gửi được email xác nhận. Vui lòng thử lại sau.',
        success: null
      });
    }

    res.redirect('/admin/doi-mat-khau/xac-nhan');
  } catch (err) {
    next(err);
  }
}

function showConfirmChangePassword(req, res) {
  if (!req.session.pendingPasswordHash) return res.redirect('/admin/doi-mat-khau');
  res.render('admin/change-password-confirm', {
    title: 'Xác nhận đổi mật khẩu - TOMSTORE Admin',
    error: null
  });
}

async function confirmChangePassword(req, res, next) {
  try {
    if (!req.session.pendingPasswordHash) return res.redirect('/admin/doi-mat-khau');

    const record = await db('admin_verification_codes')
      .where({ admin_id: req.session.adminId, purpose: 'change_password', code: (req.body.code || '').trim() })
      .whereNull('used_at')
      .andWhere('expires_at', '>', new Date())
      .orderBy('id', 'desc')
      .first();

    if (!record) {
      return res.status(400).render('admin/change-password-confirm', {
        title: 'Xác nhận đổi mật khẩu - TOMSTORE Admin',
        error: 'Mã xác nhận không đúng hoặc đã hết hạn.'
      });
    }

    await db('admin_verification_codes').where('id', record.id).update({ used_at: new Date() });
    await db('admin_users').where('id', req.session.adminId).update({ password_hash: req.session.pendingPasswordHash });
    delete req.session.pendingPasswordHash;

    res.render('admin/change-password', {
      title: 'Đổi mật khẩu - TOMSTORE Admin',
      error: null,
      success: 'Đổi mật khẩu thành công.'
    });
  } catch (err) {
    next(err);
  }
}

function showForgotPassword(req, res) {
  res.render('admin/forgot-password', {
    title: 'Quên mật khẩu - TOMSTORE Admin',
    error: null,
    success: null
  });
}

async function submitForgotPassword(req, res, next) {
  try {
    const email = (req.body.email || '').trim();
    const admin = email ? await db('admin_users').where('email', email).first() : null;

    // Luôn hiện cùng 1 thông báo dù email có tồn tại hay không, tránh lộ
    // thông tin tài khoản nào đang dùng email nào.
    const successMsg = 'Nếu email này đúng với tài khoản admin, TOMSTORE đã gửi link đặt lại mật khẩu. Vui lòng kiểm tra hộp thư.';

    if (admin) {
      const token = crypto.randomBytes(32).toString('hex');
      await db('admin_verification_codes').insert({
        admin_id: admin.id,
        purpose: 'reset',
        code: token,
        expires_at: new Date(Date.now() + RESET_TOKEN_TTL_MS)
      });

      const resetUrl = `${req.protocol}://${req.get('host')}/admin/dat-lai-mat-khau/${token}`;
      try {
        await sendMail({
          to: admin.email,
          subject: 'Đặt lại mật khẩu - TOMSTORE Admin',
          html: `<p>Bấm vào link bên dưới để đặt lại mật khẩu quản trị TOMSTORE:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>Link có hiệu lực trong 30 phút. Nếu không phải bạn yêu cầu, hãy bỏ qua email này.</p>`
        });
      } catch (mailErr) {
        // Không lộ lỗi gửi mail cho người dùng chưa xác thực -- vẫn hiện
        // thông báo thành công như bình thường.
      }
    }

    res.render('admin/forgot-password', {
      title: 'Quên mật khẩu - TOMSTORE Admin',
      error: null,
      success: successMsg
    });
  } catch (err) {
    next(err);
  }
}

async function findValidResetRecord(token) {
  return db('admin_verification_codes')
    .where({ purpose: 'reset', code: token })
    .whereNull('used_at')
    .andWhere('expires_at', '>', new Date())
    .first();
}

async function showResetPassword(req, res, next) {
  try {
    const record = await findValidResetRecord(req.params.token);
    if (!record) {
      return res.status(400).render('admin/reset-password', {
        title: 'Đặt lại mật khẩu - TOMSTORE Admin',
        token: req.params.token,
        error: 'Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu lại.',
        invalid: true
      });
    }
    res.render('admin/reset-password', {
      title: 'Đặt lại mật khẩu - TOMSTORE Admin',
      token: req.params.token,
      error: null,
      invalid: false
    });
  } catch (err) {
    next(err);
  }
}

async function submitResetPassword(req, res, next) {
  try {
    const record = await findValidResetRecord(req.params.token);
    if (!record) {
      return res.status(400).render('admin/reset-password', {
        title: 'Đặt lại mật khẩu - TOMSTORE Admin',
        token: req.params.token,
        error: 'Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu lại.',
        invalid: true
      });
    }

    const { newPassword, confirmPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).render('admin/reset-password', {
        title: 'Đặt lại mật khẩu - TOMSTORE Admin',
        token: req.params.token,
        error: 'Mật khẩu mới phải có ít nhất 8 ký tự.',
        invalid: false
      });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).render('admin/reset-password', {
        title: 'Đặt lại mật khẩu - TOMSTORE Admin',
        token: req.params.token,
        error: 'Xác nhận mật khẩu không khớp.',
        invalid: false
      });
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    await db('admin_users').where('id', record.admin_id).update({ password_hash: newHash });
    await db('admin_verification_codes').where('id', record.id).update({ used_at: new Date() });

    res.render('admin/login', {
      title: 'Đăng nhập quản trị - TOMSTORE',
      error: null,
      success: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.'
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  showLogin,
  login,
  logout,
  showChangePassword,
  changePassword,
  showConfirmChangePassword,
  confirmChangePassword,
  showForgotPassword,
  submitForgotPassword,
  showResetPassword,
  submitResetPassword
};
