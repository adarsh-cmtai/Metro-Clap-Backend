const express = require('express');
const {
  getBlogPosts,
  getFeaturedPost,
  getBlogPostBySlug,
  getBlogCategories,
} = require('./blogController');

const router = express.Router();

router.get('/posts', getBlogPosts);
router.get('/posts/featured', getFeaturedPost);
router.get('/categories', getBlogCategories);
router.get('/posts/:slug', getBlogPostBySlug);

module.exports = router;