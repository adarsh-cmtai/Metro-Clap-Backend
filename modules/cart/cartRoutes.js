// --- START OF FILE modules/cart/cartRoutes.js ---

const express = require('express');
const { getCart, addToCart, removeFromCart } = require('./cartController');
const { protect } = require('../../middleware/authMiddleware');
const router = express.Router();

router.route('/')
    .get(protect, getCart)
    .post(protect, addToCart);

router.route('/:itemId').delete(protect, removeFromCart);

module.exports = router;

// --- END OF FILE modules/cart/cartRoutes.js ---