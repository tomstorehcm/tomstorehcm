const fs = require('fs');
const path = require('path');
const db = require('../../db');
const { cropToFixedSize } = require('../../utils/imageProcess');

const IMAGE_ERROR_MESSAGE = 'Ảnh không hợp lệ hoặc bị lỗi khi xử lý. Vui lòng thử lại với file JPG/PNG/GIF/WEBP khác.';

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
    if (req.fileUploadError) return renderWithError(req, res, req.fileUploadError);
    const desktopFile = req.files && req.files.image && req.files.image[0];
    const mobileFile = req.files && req.files.imageMobile && req.files.imageMobile[0];
    if (!desktopFile) return res.redirect('/admin/banner');

    const destPath = path.join(__dirname, '..', '..', '..', 'public', 'images', 'uploads', 'banners', desktopFile.filename);
    let finalDesktopFilename;
    try {
      finalDesktopFilename = await cropToFixedSize(destPath, 'hero');
    } catch (imgErr) {
      removeUploadedFile('/images/uploads/banners/' + desktopFile.filename);
      if (mobileFile) removeUploadedFile('/images/uploads/banners/' + mobileFile.filename);
      return renderWithError(req, res, IMAGE_ERROR_MESSAGE);
    }

    let imageUrlMobile = null;
    if (mobileFile) {
      const mobileDestPath = path.join(__dirname, '..', '..', '..', 'public', 'images', 'uploads', 'banners', mobileFile.filename);
      try {
        const finalMobileFilename = await cropToFixedSize(mobileDestPath, 'heroMobile');
        imageUrlMobile = '/images/uploads/banners/' + finalMobileFilename;
      } catch (imgErr) {
        removeUploadedFile('/images/uploads/banners/' + mobileFile.filename);
      }
    }

    const imageUrl = '/images/uploads/banners/' + finalDesktopFilename;
    const maxSort = await db('banners').where('type', 'hero').max('sort_order as max').first();

    await db('banners').insert({
      image_url: imageUrl,
      image_url_mobile: imageUrlMobile,
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

async function updateHeroBannerMobileImage(req, res, next) {
  try {
    if (req.fileUploadError) return renderWithError(req, res, req.fileUploadError);
    const banner = await db('banners').where('id', req.params.id).where('type', 'hero').first();
    if (!banner || !req.file) return res.redirect('/admin/banner');

    const destPath = path.join(__dirname, '..', '..', '..', 'public', 'images', 'uploads', 'banners', req.file.filename);
    let finalFilename;
    try {
      finalFilename = await cropToFixedSize(destPath, 'heroMobile');
    } catch (imgErr) {
      removeUploadedFile('/images/uploads/banners/' + req.file.filename);
      return renderWithError(req, res, IMAGE_ERROR_MESSAGE);
    }

    if (banner.image_url_mobile) removeUploadedFile(banner.image_url_mobile);
    await db('banners').where('id', banner.id).update({
      image_url_mobile: '/images/uploads/banners/' + finalFilename
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

// Saves every hero banner's link + sort order in one request -- the table
// posts them all keyed by banner id (linkUrl_<id>, sortOrder_<id>) instead of
// each row having its own separate save action.
async function bulkUpdateHeroBanners(req, res, next) {
  try {
    const banners = await db('banners').where('type', 'hero');
    for (const b of banners) {
      const linkUrl = (req.body['linkUrl_' + b.id] || '').trim() || null;
      const sortOrder = Number(req.body['sortOrder_' + b.id]) || 0;
      await db('banners').where('id', b.id).update({ link_url: linkUrl, sort_order: sortOrder });
    }
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
      removeUploadedFile(banner.image_url_mobile);
    }
    res.redirect('/admin/banner');
  } catch (err) {
    next(err);
  }
}

async function uploadFeaturedBanner(req, res, next) {
  try {
    if (req.fileUploadError) return renderWithError(req, res, req.fileUploadError);
    const existing = await db('banners').where('type', 'featured').first();

    let imageUrl = existing ? existing.image_url : null;
    if (req.file) {
      const destPath = path.join(__dirname, '..', '..', '..', 'public', 'images', 'uploads', 'banners', req.file.filename);
      let finalFilename;
      try {
        finalFilename = await cropToFixedSize(destPath, 'featured');
      } catch (imgErr) {
        removeUploadedFile('/images/uploads/banners/' + req.file.filename);
        return renderWithError(req, res, IMAGE_ERROR_MESSAGE);
      }
      imageUrl = '/images/uploads/banners/' + finalFilename;
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

async function toggleCategoryHomepage(req, res, next) {
  try {
    const category = await db('categories').where('id', req.params.id).first();
    if (category) {
      await db('categories').where('id', category.id).update({ show_on_homepage: !category.show_on_homepage });
    }
    res.redirect('/admin/banner');
  } catch (err) {
    next(err);
  }
}

async function updateCategoryName(req, res, next) {
  try {
    const name = (req.body.name || '').trim().slice(0, 24);
    if (name) {
      await db('categories').where('id', req.params.id).update({ name });
    }
    res.redirect('/admin/banner');
  } catch (err) {
    next(err);
  }
}

async function uploadCategoryThumb(req, res, next) {
  try {
    if (req.fileUploadError) return renderWithError(req, res, req.fileUploadError);
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
  updateHeroBannerMobileImage,
  toggleHeroBanner,
  bulkUpdateHeroBanners,
  deleteHeroBanner,
  uploadFeaturedBanner,
  updateCategoryName,
  toggleCategoryHomepage,
  uploadCategoryThumb
};
