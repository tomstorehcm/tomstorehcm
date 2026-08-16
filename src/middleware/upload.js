const path = require('path');
const fs = require('fs');
const multer = require('multer');

function makeUploader(subfolder) {
  const destDir = path.join(__dirname, '..', '..', 'public', 'images', 'uploads', subfolder);
  fs.mkdirSync(destDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, destDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const stamp = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, stamp + ext);
    }
  });

  const fileFilter = (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      return cb(new Error('Chỉ chấp nhận file ảnh (jpg, png, gif, webp)'));
    }
    cb(null, true);
  };

  return multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }
  });
}

// Multer's fileFilter/limits errors normally throw before the route handler even
// runs, so a try/catch inside the controller can never see them. This wraps a
// multer middleware (single/array/fields) so those errors become a plain
// `req.fileUploadError` string instead — the controller can then check it and
// re-render the same friendly "invalid image" message it already uses for
// crop failures, instead of the whole request crashing to a generic 500 page.
function handleUploadErrors(multerMiddleware) {
  return function (req, res, next) {
    multerMiddleware(req, res, (err) => {
      if (err) {
        req.fileUploadError = err.message || 'Ảnh không hợp lệ hoặc bị lỗi khi tải lên.';
      }
      next();
    });
  };
}

module.exports = { makeUploader, handleUploadErrors };
