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

async function uploadImages(req, res, next) {
  try {
    const product = await db('products').where('id', req.params.id).first();
    if (!product) return res.redirect('/admin/san-pham');

    const files = req.files || [];
    if (files.length === 0) return res.redirect('/admin/san-pham/' + product.id + '/sua');

    const existingCount = await db('product_images').where('product_id', product.id).count('id as count').first();
    const remaining = MAX_IMAGES - Number(existingCount.count);

    const maxSort = await db('product_images').where('product_id', product.id).max('sort_order as max').first();
    let nextSort = (maxSort.max || 0) + 1;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
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
