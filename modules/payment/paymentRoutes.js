const express = require('express');
const { createOrder, createRemainingOrder } = require('./paymentController');
const { protect } = require('../../middleware/authMiddleware');
const router = express.Router();

router.post('/create-order', protect, createOrder);
router.post('/create-remaining-order/:id', protect, createRemainingOrder);

module.exports = router;