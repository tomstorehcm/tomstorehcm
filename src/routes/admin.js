const express = require('express');
const router = express.Router();

const { requireAdmin, redirectIfAdmin } = require('../middleware/auth');
const { makeUploader } = require('../middleware/upload');
const authController = require('../controllers/admin/authController');
const dashboardController = require('../controllers/admin/dashboardController');
const productAdminController = require('../controllers/admin/productAdminController');
const productGalleryController = require('../controllers/admin/productGalleryController');
const hotDealController = require('../controllers/admin/hotDealController');
const orderAdminController = require('../controllers/admin/orderAdminController');
const bannerController = require('../controllers/admin/bannerController');

const uploadProductImage = makeUploader('products');
const uploadBannerImage = makeUploader('banners');
const uploadCategoryImage = makeUploader('categories');

router.get('/login', redirectIfAdmin, authController.showLogin);
router.post('/login', redirectIfAdmin, authController.login);
router.post('/logout', authController.logout);

router.use(requireAdmin);

router.get('/', dashboardController.showDashboard);

router.get('/san-pham', productAdminController.listProducts);
router.get('/san-pham/moi', productAdminController.newProductForm);
router.post(
  '/san-pham/moi',
  uploadProductImage.single('imageFile'),
  productAdminController.productValidators,
  productAdminController.createProduct
);
router.get('/san-pham/:id/sua', productAdminController.editProductForm);
router.post(
  '/san-pham/:id/sua',
  uploadProductImage.single('imageFile'),
  productAdminController.productValidators,
  productAdminController.updateProduct
);
router.post('/san-pham/:id/xoa', productAdminController.deleteProduct);

router.post('/san-pham/:id/anh', uploadProductImage.array('images', 8), productGalleryController.uploadImages);
router.post('/san-pham/:id/anh/:imageId/xoa', productGalleryController.deleteImage);

router.get('/hot-deal', hotDealController.listHotDeals);
router.post('/hot-deal/:id/bat', hotDealController.enableHotDeal);
router.post('/hot-deal/:id/tat', hotDealController.disableHotDeal);
router.post('/hot-deal/:id/gia-han', hotDealController.extendHotDeal);
router.post('/hot-deal/:id/dat-gio', hotDealController.setHotDealExpiry);

router.get('/don-hang', orderAdminController.listOrders);
router.get('/don-hang/:id', orderAdminController.showOrder);
router.post('/don-hang/:id/trang-thai', orderAdminController.updateStatus);

router.get('/banner', bannerController.listBanners);
router.post('/banner/chinh', uploadBannerImage.single('image'), bannerController.createHeroBanner);
router.post('/banner/chinh/:id/an-hien', bannerController.toggleHeroBanner);
router.post('/banner/chinh/:id/thu-tu', bannerController.updateHeroSortOrder);
router.post('/banner/chinh/:id/xoa', bannerController.deleteHeroBanner);
router.post('/banner/san-pham-hot', uploadBannerImage.single('image'), bannerController.uploadFeaturedBanner);
router.post('/banner/danh-muc/:id', uploadCategoryImage.single('image'), bannerController.uploadCategoryThumb);

module.exports = router;
