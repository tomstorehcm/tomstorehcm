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
    const allowed = ['.jpg', '.jpeg', '.png', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      return cb(new Error('Chỉ chấp nhận file ảnh (jpg, png, gif) — chưa hỗ trợ webp'));
    }
    cb(null, true);
  };

  return multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }
  });
}

module.exports = { makeUploader };
