const fs = require('fs');
const path = require('path');
const db = require('../../db');
const { cropToFixedSize } = require('../../utils/imageProcess');

const MAX_IMAGES = 8;

function removeUploadedFile(imageUrl) {
  if (imageUrl && imageUrl.startsWith('/images/uploads/')) {
    const filePath = path.join(__dirname, '..', '..', '..', 'public', imageUrl);
    fs.unlink(filePath, () => {});
  }
}

function specsToText(specsJson) {
  try {
    const specs = specsJson ? JSON.parse(specsJson) : {};
    return Object.entries(specs).map(([k, v]) => `${k}: ${v}`).join('\n');
  } catch (e) {
    return '';
  }
}

async function renderEditWithError(req, res, product, message) {
  const categories = await db('categories').orderBy('sort_order');
  const galleryImages = await db('product_images').where('product_id', product.id).orderBy('sort_order');
  res.status(400).render('admin/product-form', {
    title: 'Sửa sản phẩm - TOMSTORE Admin',
    categories,
    product,
    specsText: specsToText(product.specs_json),
    errors: [{ msg: message }],
    isEdit: true,
    galleryImages
  });
}

async function uploadImages(req, res, next) {
  try {
    const product = await db('products').where('id', req.params.id).first();
    if (!product) return res.redirect('/admin/san-pham');

    if (req.fileUploadError) {
      return renderEditWithError(req, res, product, req.fileUploadError);
    }

    const mainImageFile = req.files && req.files.imageFile && req.files.imageFile[0];
    const galleryFiles = (req.files && req.files.images) || [];

    // Ảnh đại diện: file tải lên được ưu tiên hơn URL dán vào
    if (mainImageFile) {
      const destPath = path.join(__dirname, '..', '..', '..', 'public', 'images', 'uploads', 'products', mainImageFile.filename);
      try {
        await cropToFixedSize(destPath, 'product');
        removeUploadedFile(product.image_url);
        await db('products').where('id', product.id).update({
          image_url: '/images/uploads/products/' + mainImageFile.filename
        });
      } catch (imgErr) {
        removeUploadedFile('/images/uploads/products/' + mainImageFile.filename);
      }
    } else if (req.body.imageUrl !== undefined && req.body.imageUrl !== '') {
      await db('products').where('id', product.id).update({ image_url: req.body.imageUrl });
    }

    // Ảnh chi tiết
    if (galleryFiles.length > 0) {
      const existingCount = await db('product_images').where('product_id', product.id).count('id as count').first();
      const remaining = MAX_IMAGES - Number(existingCount.count);

      const maxSort = await db('product_images').where('product_id', product.id).max('sort_order as max').first();
      let nextSort = (maxSort.max || 0) + 1;

      for (let i = 0; i < galleryFiles.length; i++) {
        const file = galleryFiles[i];
        if (i >= remaining) {
          removeUploadedFile('/images/uploads/products/' + file.filename);
          continue;
        }
        const destPath = path.join(__dirname, '..', '..', '..', 'public', 'images', 'uploads', 'products', file.filename);
        try {
          await cropToFixedSize(destPath, 'product');
        } catch (imgErr) {
          removeUploadedFile('/images/uploads/products/' + file.filename);
          continue;
        }

        await db('product_images').insert({
          product_id: product.id,
          image_url: '/images/uploads/products/' + file.filename,
          sort_order: nextSort++
        });
      }
    }

    res.redirect('/admin/san-pham/' + product.id + '/sua');
  } catch (err) {
    next(err);
  }
}

async function deleteImage(req, res, next) {
  try {
    const image = await db('product_images').where('id', req.params.imageId).where('product_id', req.params.id).first();
    if (image) {
      await db('product_images').where('id', image.id).del();
      removeUploadedFile(image.image_url);
    }
    res.redirect('/admin/san-pham/' + req.params.id + '/sua');
  } catch (err) {
    next(err);
  }
}

module.exports = { uploadImages, deleteImage, MAX_IMAGES };
