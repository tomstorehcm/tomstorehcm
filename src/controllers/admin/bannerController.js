const fs = require('fs');
const path = require('path');
const db = require('../../db');
const { cropToFixedSize } = require('../../utils/imageProcess');

const IMAGE_ERROR_MESSAGE = 'Ảnh không hợp lệ hoặc bị lỗi khi xử lý. Vui lòng thử lại với file JPG/PNG/GIF khác.';

function removeUploadedFile(imageUrl) {
  if (imageUrl && imageUrl.startsWith('/images/uploads/')) {
    const filePath = path.join(__dirname, '..', '..', '..', 'public', imageUrl);
    fs.unlink(filePath, () => {});
  }
}

async function renderWithError(req, res, message) {
  const heroBanners = await db('banners').where('type', 'hero').orderBy('sort_order');
  const featuredBanner = await db('banners').where('type', 'featured').first();
  const categories = await db('categories').orderBy('sort_order');

  res.status(400).render('admin/banners', {
    title: 'Quản lý Banner - TOMSTORE Admin',
    heroBanners,
    featuredBanner,
    categories,
    error: message
  });
}

async function listBanners(req, res, next) {
  try {
    const heroBanners = await db('banners').where('type', 'hero').orderBy('sort_order');
    const featuredBanner = await db('banners').where('type', 'featured').first();
    const categories = await db('categories').orderBy('sort_order');

    res.render('admin/banners', {
      title: 'Quản lý Banner - TOMSTORE Admin',
      heroBanners,
      featuredBanner,
      categories,
      error: null
    });
  } catch (err) {
    next(err);
  }
}

async function createHeroBanner(req, res, next) {
  try {
    if (!req.file) return res.redirect('/admin/banner');

    const destPath = path.join(__dirname, '..', '..', '..', 'public', 'images', 'uploads', 'banners', req.file.filename);
    try {
      await cropToFixedSize(destPath, 'hero');
    } catch (imgErr) {
      removeUploadedFile('/images/uploads/banners/' + req.file.filename);
      return renderWithError(req, res, IMAGE_ERROR_MESSAGE);
    }

    const imageUrl = '/images/uploads/banners/' + req.file.filename;
    const maxSort = await db('banners').where('type', 'hero').max('sort_order as max').first();

    await db('banners').insert({
      image_url: imageUrl,
      link_url: req.body.linkUrl || null,
      sort_order: (maxSort.max || 0) + 1,
      is_active: true,
      type: 'hero'
    });

    res.redirect('/admin/banner');
  } catch (err) {
    next(err);
  }
}

async function toggleHeroBanner(req, res, next) {
  try {
    const banner = await db('banners').where('id', req.params.id).where('type', 'hero').first();
    if (banner) {
      await db('banners').where('id', banner.id).update({ is_active: !banner.is_active });
    }
    res.redirect('/admin/banner');
  } catch (err) {
    next(err);
  }
}

async function updateHeroSortOrder(req, res, next) {
  try {
    const sortOrder = Number(req.body.sortOrder) || 0;
    await db('banners').where('id', req.params.id).where('type', 'hero').update({ sort_order: sortOrder });
    res.redirect('/admin/banner');
  } catch (err) {
    next(err);
  }
}

async function deleteHeroBanner(req, res, next) {
  try {
    const banner = await db('banners').where('id', req.params.id).where('type', 'hero').first();
    if (banner) {
      await db('banners').where('id', banner.id).del();
      removeUploadedFile(banner.image_url);
    }
    res.redirect('/admin/banner');
  } catch (err) {
    next(err);
  }
}

async function uploadFeaturedBanner(req, res, next) {
  try {
    const existing = await db('banners').where('type', 'featured').first();

    let imageUrl = existing ? existing.image_url : null;
    if (req.file) {
      const destPath = path.join(__dirname, '..', '..', '..', 'public', 'images', 'uploads', 'banners', req.file.filename);
      try {
        await cropToFixedSize(destPath, 'featured');
      } catch (imgErr) {
        removeUploadedFile('/images/uploads/banners/' + req.file.filename);
        return renderWithError(req, res, IMAGE_ERROR_MESSAGE);
      }
      imageUrl = '/images/uploads/banners/' + req.file.filename;
    }

    if (!imageUrl) return res.redirect('/admin/banner');

    if (existing) {
      if (req.file) removeUploadedFile(existing.image_url);
      await db('banners').where('id', existing.id).update({
        image_url: imageUrl,
        link_url: req.body.linkUrl || null
      });
    } else {
      await db('banners').insert({
        image_url: imageUrl,
        link_url: req.body.linkUrl || null,
        sort_order: 1,
        is_active: true,
        type: 'featured'
      });
    }

    res.redirect('/admin/banner');
  } catch (err) {
    next(err);
  }
}

async function uploadCategoryThumb(req, res, next) {
  try {
    const category = await db('categories').where('id', req.params.id).first();
    if (!category || !req.file) return res.redirect('/admin/banner');

    const destPath = path.join(__dirname, '..', '..', '..', 'public', 'images', 'uploads', 'categories', req.file.filename);
    try {
      await cropToFixedSize(destPath, 'thumb');
    } catch (imgErr) {
      removeUploadedFile('/images/uploads/categories/' + req.file.filename);
      return renderWithError(req, res, IMAGE_ERROR_MESSAGE);
    }

    const imageUrl = '/images/uploads/categories/' + req.file.filename;
    if (category.image_url && category.image_url.startsWith('/images/uploads/')) {
      removeUploadedFile(category.image_url);
    }

    await db('categories').where('id', category.id).update({ image_url: imageUrl });

    res.redirect('/admin/banner');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listBanners,
  createHeroBanner,
  toggleHeroBanner,
  updateHeroSortOrder,
  deleteHeroBanner,
  uploadFeaturedBanner,
  uploadCategoryThumb
};
