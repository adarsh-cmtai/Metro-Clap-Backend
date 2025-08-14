const express = require('express');
const { generateOtp, verifyOtpAndLogin, registerPartner } = require('./authController');
const router = express.Router();

router.post('/generate-otp', generateOtp);
router.post('/partner/register', registerPartner);
router.post('/verify-otp', verifyOtpAndLogin);

module.exports = router;