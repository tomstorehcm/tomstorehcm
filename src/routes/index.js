const express = require('express');
const router = express.Router();

const homeController = require('../controllers/homeController');
const categoryController = require('../controllers/categoryController');
const productController = require('../controllers/productController');
const cartController = require('../controllers/cartController');
const checkoutController = require('../controllers/checkoutController');

router.get('/', homeController.showHome);

router.get('/tim-kiem', productController.searchProducts);

router.get('/danh-muc/:slug', categoryController.showCategory);
router.get('/san-pham/:slug', productController.showProduct);

router.get('/gio-hang', cartController.showCart);
router.post('/gio-hang/them', cartController.addToCart);
router.post('/gio-hang/cap-nhat', cartController.updateCart);
router.post('/gio-hang/xoa', cartController.removeFromCart);

router.get('/thanh-toan', checkoutController.showCheckout);
router.post('/thanh-toan', checkoutController.checkoutValidators, checkoutController.submitOrder);
router.get('/don-hang/:code', checkoutController.showConfirmation);

module.exports = router;
