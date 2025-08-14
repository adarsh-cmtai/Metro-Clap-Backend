const express = require('express');
const { getLocationSuggestions } = require('./locationController');
const router = express.Router();

router.get('/suggest', getLocationSuggestions);

module.exports = router;