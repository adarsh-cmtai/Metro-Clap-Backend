// --- START OF FILE modules/partner-application/applicationRoutes.js ---

const express = require('express');
const { createApplication, getUploadUrl } = require('./applicationController');
const router = express.Router();

router.post('/', createApplication);
router.get('/signed-url', getUploadUrl);

module.exports = router;

// --- END OF FILE modules/partner-application/applicationRoutes.js ---