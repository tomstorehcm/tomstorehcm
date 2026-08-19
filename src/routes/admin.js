const express = require('express');
const router = express.Router();

const { requireAdmin, redirectIfAdmin } = require('../middleware/auth');
const { makeUploader, handleUploadErrors } = require('../middleware/upload');
const authController = require('../controllers/admin/authController');
const dashboardController = require('../controllers/admin/dashboardController');
const productAdminController = require('../controllers/admin/productAdminController');
const productGalleryController = require('../controllers/admin/productGalleryController');
const hotDealController = require('../controllers/admin/hotDealController');
const orderAdminController = require('../controllers/admin/orderAdminController');
const bannerController = require('../controllers/admin/bannerController');
const policyController = require('../controllers/admin/policyController');

const uploadProductImage = makeUploader('products');
const uploadBannerImage = makeUploader('banners');
const uploadCategoryImage = makeUploader('categories');

const MAX_COLOR_ROWS = 20;
const colorImageFields = Array.from({ length: MAX_COLOR_ROWS }, (_, i) => ({ name: `colorImage_${i}`, maxCount: 1 }));
const uploadProductWithColors = uploadProductImage.fields([{ name: 'imageFile', maxCount: 1 }, { name: 'images', maxCount: 8 }, ...colorImageFields]);

router.get('/login', redirectIfAdmin, authController.showLogin);
router.post('/login', redirectIfAdmin, authController.login);
router.post('/logout', authController.logout);

router.use(requireAdmin);

router.get('/', dashboardController.showDashboard);

router.get('/doi-mat-khau', authController.showChangePassword);
router.post('/doi-mat-khau', authController.changePassword);

router.get('/san-pham', productAdminController.listProducts);
router.get('/san-pham/moi', productAdminController.newProductForm);
router.post(
  '/san-pham/moi',
  handleUploadErrors(uploadProductWithColors),
  productAdminController.productValidators,
  productAdminController.createProduct
);
router.get('/san-pham/:id/sua', productAdminController.editProductForm);
router.post(
  '/san-pham/:id/sua',
  handleUploadErrors(uploadProductWithColors),
  productAdminController.productValidators,
  productAdminController.updateProduct
);
router.post('/san-pham/:id/xoa', productAdminController.deleteProduct);
router.post('/san-pham/:id/len', productAdminController.moveProductUp);
router.post('/san-pham/:id/xuong', productAdminController.moveProductDown);

router.post(
  '/san-pham/:id/anh',
  handleUploadErrors(uploadProductImage.fields([{ name: 'imageFile', maxCount: 1 }, { name: 'images', maxCount: 8 }])),
  productGalleryController.uploadImages
);
router.post('/san-pham/:id/anh/:imageId/xoa', productGalleryController.deleteImage);

router.get('/hot-deal', hotDealController.listHotDeals);
router.post('/hot-deal/:id/bat', hotDealController.enableHotDeal);
router.post('/hot-deal/:id/tat', hotDealController.disableHotDeal);
router.post('/hot-deal/:id/gia-han', hotDealController.extendHotDeal);
router.post('/hot-deal/:id/dat-gio', hotDealController.setHotDealExpiry);
router.post('/hot-deal/:id/len', hotDealController.moveHotDealUp);
router.post('/hot-deal/:id/xuong', hotDealController.moveHotDealDown);
router.post('/hot-deal/them-rieng', handleUploadErrors(uploadProductImage.single('imageFile')), hotDealController.createStandaloneHotDeal);

router.get('/don-hang/:id', orderAdminController.showOrder);
router.post('/don-hang/:id/trang-thai', orderAdminController.updateStatus);
router.post('/don-hang/:id/ghi-chu', orderAdminController.updateNote);

router.get('/banner', bannerController.listBanners);
router.post(
  '/banner/chinh',
  handleUploadErrors(uploadBannerImage.fields([{ name: 'image', maxCount: 1 }, { name: 'imageMobile', maxCount: 1 }])),
  bannerController.createHeroBanner
);
router.post('/banner/chinh/:id/anh-mobile', handleUploadErrors(uploadBannerImage.single('image')), bannerController.updateHeroBannerMobileImage);
router.post('/banner/chinh/:id/an-hien', bannerController.toggleHeroBanner);
router.post('/banner/chinh/:id/thu-tu', bannerController.updateHeroSortOrder);
router.post('/banner/chinh/:id/link', bannerController.updateHeroLinkUrl);
router.post('/banner/chinh/:id/xoa', bannerController.deleteHeroBanner);
router.post('/banner/san-pham-hot', handleUploadErrors(uploadBannerImage.single('image')), bannerController.uploadFeaturedBanner);
router.post('/banner/danh-muc/:id', handleUploadErrors(uploadCategoryImage.single('image')), bannerController.uploadCategoryThumb);

router.get('/chinh-sach', policyController.listPolicies);
router.post('/chinh-sach/nhom', policyController.createGroup);
router.post('/chinh-sach/nhom/:id/doi-ten', policyController.renameGroup);
router.post('/chinh-sach/nhom/:id/mac-dinh', policyController.setDefaultGroup);
router.post('/chinh-sach/nhom/:id/xoa', policyController.deleteGroup);
router.post('/chinh-sach', policyController.createPolicy);
router.get('/chinh-sach/:id/sua', policyController.editPolicyForm);
router.post('/chinh-sach/:id/sua', policyController.updatePolicy);
router.post('/chinh-sach/:id/xoa', policyController.deletePolicy);

module.exports = router;
