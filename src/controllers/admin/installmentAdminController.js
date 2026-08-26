const path = require('path');
const fs = require('fs');
const sanitizeHtml = require('sanitize-html');
const db = require('../../db');
const { resizeToMaxWidth } = require('../../utils/imageProcess');

const IMAGE_ERROR_MESSAGE = 'Ảnh không hợp lệ hoặc bị lỗi khi xử lý. Vui lòng thử lại với file JPG/PNG/GIF/WEBP khác.';
const CONTENT_IMAGE_MAX_WIDTH = 1000;

// Content comes from the Quill editor, authored only by the admin -- still
// sanitized before every save so a pasted snippet (or a compromised admin
// session) can't smuggle in a <script> tag, since this HTML is rendered
// unescaped on the public page.
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

async function listInstallmentSections(req, res, next) {
  try {
    const sections = await db('installment_sections').orderBy('id');
    res.render('admin/installment', {
      title: 'Trả góp linh động - TOMSTORE Admin',
      sections,
      error: null
    });
  } catch (err) {
    next(err);
  }
}

async function updateInstallmentSection(req, res, next) {
  try {
    const title = (req.body.title || '').trim();
    if (!title) {
      const sections = await db('installment_sections').orderBy('id');
      return res.status(400).render('admin/installment', {
        title: 'Trả góp linh động - TOMSTORE Admin',
        sections,
        error: 'Vui lòng nhập tiêu đề mục.'
      });
    }

    const contentHtml = sanitizeHtml(req.body.contentHtml || '', SANITIZE_OPTIONS);

    await db('installment_sections').where('section_key', req.params.key).update({
      title,
      content_html: contentHtml,
      updated_at: new Date()
    });

    res.redirect('/admin/tra-gop');
  } catch (err) {
    next(err);
  }
}

// Called by the Quill editor's image-insert button (custom handler in the
// admin page's script). Returns { url } so the editor can insert it inline
// instead of falling back to Quill's default base64-embedded image.
async function uploadInstallmentImage(req, res, next) {
  try {
    if (req.fileUploadError || !req.file) {
      return res.status(400).json({ error: req.fileUploadError || 'Không có file ảnh.' });
    }

    const destPath = path.join(__dirname, '..', '..', '..', 'public', 'images', 'uploads', 'installment', req.file.filename);
    let finalFilename;
    try {
      finalFilename = await resizeToMaxWidth(destPath, CONTENT_IMAGE_MAX_WIDTH);
    } catch (imgErr) {
      removeUploadedFile('/images/uploads/installment/' + req.file.filename);
      return res.status(400).json({ error: IMAGE_ERROR_MESSAGE });
    }

    res.json({ url: '/images/uploads/installment/' + finalFilename });
  } catch (err) {
    next(err);
  }
}

module.exports = { listInstallmentSections, updateInstallmentSection, uploadInstallmentImage };
