const express = require('express');
const router = express.Router();

const homeController = require('../controllers/homeController');
const categoryController = require('../controllers/categoryController');
const productController = require('../controllers/productController');
const cartController = require('../controllers/cartController');
const checkoutController = require('../controllers/checkoutController');
const contactRequestController = require('../controllers/contactRequestController');
const installmentController = require('../controllers/installmentController');

router.get('/', homeController.showHome);

router.get('/tim-kiem', productController.searchProducts);

router.get('/danh-muc/:slug', categoryController.showCategory);
router.get('/san-pham/:slug', productController.showProduct);

router.get('/gio-hang', cartController.showCart);
router.post('/gio-hang/them', cartController.addToCart);
router.post('/gio-hang/xoa', cartController.removeFromCart);

router.post('/thanh-toan/mua-ngay', checkoutController.buyNow);
router.get('/thanh-toan', checkoutController.showCheckout);
router.post('/thanh-toan', checkoutController.checkoutValidators, checkoutController.submitOrder);
router.get('/don-hang/:code', checkoutController.showConfirmation);

router.get('/lien-he-bao-gia', contactRequestController.showContactRequestForm);
router.post('/lien-he-bao-gia', contactRequestController.contactRequestValidators, contactRequestController.submitContactRequest);
router.get('/lien-he-bao-gia/:code', contactRequestController.showContactRequestConfirmation);

router.get('/tra-gop', installmentController.showInstallmentPage);

module.exports = router;
