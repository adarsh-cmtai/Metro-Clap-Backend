const express = require('express');
const {
    createPost,
    updatePost,
    deletePost,
    getAllPosts,
    getPostById,
    getUploadUrl,
} = require('./adminBlogController');
const { protect, admin } = require('../../middleware/authMiddleware');

const router = express.Router();

router.route('/')
    .post(protect, admin, createPost)
    .get(protect, admin, getAllPosts);

router.get('/signed-url', protect, admin, getUploadUrl);

router.route('/:id')
    .get(protect, admin, getPostById)
    .put(protect, admin, updatePost)
    .delete(protect, admin, deletePost);

module.exports = router;