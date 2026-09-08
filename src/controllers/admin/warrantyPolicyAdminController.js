const path = require('path');
const fs = require('fs');
const sanitizeHtml = require('sanitize-html');
const db = require('../../db');
const { resizeToMaxWidth } = require('../../utils/imageProcess');

const IMAGE_ERROR_MESSAGE = 'Ảnh không hợp lệ hoặc bị lỗi khi xử lý. Vui lòng thử lại với file JPG/PNG/GIF/WEBP khác.';
const CONTENT_IMAGE_MAX_WIDTH = 1000;

// Same rules as the installment-page editor: content comes from the Quill
// editor, authored only by the admin, still sanitized before every save
// since this HTML is rendered unescaped on the public page.
const SANITIZE_OPTIONS = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'u', 's']),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    img: ['src', 'alt', 'width', 'height', 'style', 'class'],
    span: ['style', 'class'],
    p: ['style', 'class'],
    '*': ['style']
  },
  allowedSchemes: ['http', 'https']
};

function removeUploadedFile(imageUrl) {
  if (imageUrl && imageUrl.startsWith('/images/uploads/')) {
    const filePath = path.join(__dirname, '..', '..', '..', 'public', imageUrl);
    fs.unlink(filePath, () => {});
  }
}

async function listWarrantySections(req, res, next) {
  try {
    const sections = await db('warranty_policy_sections').orderBy('id');
    res.render('admin/warranty-policy', {
      title: 'Chính sách bảo hành (trang) - TOMSTORE Admin',
      sections,
      error: null
    });
  } catch (err) {
    next(err);
  }
}

// Admin can freely add as many mục (sections/tabs) as they want -- section_key
// only exists to satisfy the column's NOT NULL/UNIQUE constraint from the
// original 2-fixed-section design; nothing routes by it anymore (routes use
// the row's own auto-increment id), so a timestamp-based value is enough.
async function createWarrantySection(req, res, next) {
  try {
    const title = (req.body.title || '').trim();
    if (!title) {
      const sections = await db('warranty_policy_sections').orderBy('id');
      return res.status(400).render('admin/warranty-policy', {
        title: 'Chính sách bảo hành (trang) - TOMSTORE Admin',
        sections,
        error: 'Vui lòng nhập tiêu đề mục mới.'
      });
    }

    await db('warranty_policy_sections').insert({
      section_key: 'sec_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      title,
      content_html: ''
    });

    res.redirect('/admin/bao-hanh');
  } catch (err) {
    next(err);
  }
}

async function updateWarrantySection(req, res, next) {
  try {
    const title = (req.body.title || '').trim();
    if (!title) {
      const sections = await db('warranty_policy_sections').orderBy('id');
      return res.status(400).render('admin/warranty-policy', {
        title: 'Chính sách bảo hành (trang) - TOMSTORE Admin',
        sections,
        error: 'Vui lòng nhập tiêu đề mục.'
      });
    }

    const contentHtml = sanitizeHtml(req.body.contentHtml || '', SANITIZE_OPTIONS);

    await db('warranty_policy_sections').where('id', req.params.id).update({
      title,
      content_html: contentHtml,
      updated_at: new Date()
    });

    res.redirect('/admin/bao-hanh');
  } catch (err) {
    next(err);
  }
}

async function deleteWarrantySection(req, res, next) {
  try {
    await db('warranty_policy_sections').where('id', req.params.id).del();
    res.redirect('/admin/bao-hanh');
  } catch (err) {
    next(err);
  }
}

// Called by the Quill editor's image-insert button, same as the
// installment-page editor's uploadInstallmentImage.
async function uploadWarrantyImage(req, res, next) {
  try {
    if (req.fileUploadError || !req.file) {
      return res.status(400).json({ error: req.fileUploadError || 'Không có file ảnh.' });
    }

    const destPath = path.join(__dirname, '..', '..', '..', 'public', 'images', 'uploads', 'bao-hanh', req.file.filename);
    let finalFilename;
    try {
      finalFilename = await resizeToMaxWidth(destPath, CONTENT_IMAGE_MAX_WIDTH);
    } catch (imgErr) {
      removeUploadedFile('/images/uploads/bao-hanh/' + req.file.filename);
      return res.status(400).json({ error: IMAGE_ERROR_MESSAGE });
    }

    res.json({ url: '/images/uploads/bao-hanh/' + finalFilename });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listWarrantySections,
  createWarrantySection,
  updateWarrantySection,
  deleteWarrantySection,
  uploadWarrantyImage
};
