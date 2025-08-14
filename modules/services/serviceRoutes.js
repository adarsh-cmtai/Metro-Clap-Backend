const express = require('express');
const { getAllServices, getServiceCategories, getServicesByCategory, getServiceBySlug, getFeaturedServices, getHomepageReviews } = require('./serviceController');
const router = express.Router();

router.get('/', getAllServices);
router.get('/featured', getFeaturedServices);
router.get('/reviews/homepage', getHomepageReviews);
router.get('/categories', getServiceCategories);
router.get('/by-category', getServicesByCategory);
router.get('/:slug', getServiceBySlug);

module.exports = router;