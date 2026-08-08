const fs = require('fs');
const path = require('path');
const db = require('../../db');

async function listBanners(req, res, next) {
  try {
    const banners = await db('banners').orderBy('sort_order');
    res.render('admin/banners', {
      title: 'Quản lý Banner - TOMSTORE Admin',
      banners,
      error: null
    });
  } catch (err) {
    next(err);
  }
}

async function createBanner(req, res, next) {
  try {
    if (!req.file) {
      const banners = await db('banners').orderBy('sort_order');
      return res.status(400).render('admin/banners', {
        title: 'Quản lý Banner - TOMSTORE Admin',
        banners,
        error: 'Vui lòng chọn ảnh banner.'
      });
    }

    const imageUrl = '/images/uploads/banners/' + req.file.filename;
    const maxSort = await db('banners').max('sort_order as max').first();

    await db('banners').insert({
      image_url: imageUrl,
      link_url: req.body.linkUrl || null,
      sort_order: (maxSort.max || 0) + 1,
      is_active: true
    });

    res.redirect('/admin/banner');
  } catch (err) {
    next(err);
  }
}

async function toggleBanner(req, res, next) {
  try {
    const banner = await db('banners').where('id', req.params.id).first();
    if (banner) {
      await db('banners').where('id', banner.id).update({ is_active: !banner.is_active });
    }
    res.redirect('/admin/banner');
  } catch (err) {
    next(err);
  }
}

async function updateSortOrder(req, res, next) {
  try {
    const sortOrder = Number(req.body.sortOrder) || 0;
    await db('banners').where('id', req.params.id).update({ sort_order: sortOrder });
    res.redirect('/admin/banner');
  } catch (err) {
    next(err);
  }
}

async function deleteBanner(req, res, next) {
  try {
    const banner = await db('banners').where('id', req.params.id).first();
    if (banner) {
      await db('banners').where('id', banner.id).del();
      if (banner.image_url && banner.image_url.startsWith('/images/uploads/')) {
        const filePath = path.join(__dirname, '..', '..', '..', 'public', banner.image_url);
        fs.unlink(filePath, () => {});
      }
    }
    res.redirect('/admin/banner');
  } catch (err) {
    next(err);
  }
}

module.exports = { listBanners, createBanner, toggleBanner, updateSortOrder, deleteBanner };
