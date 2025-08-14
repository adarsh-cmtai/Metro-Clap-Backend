const express = require('express');
const { 
    getProDashboardStats, getProBookings, getAvailabilityForDate,
    updateAvailability, getEarningsData, getBankDetails,
    updateBankDetails, getProProfile, updateProProfile,
    getSignedUrlForProUpload, getProReviews, acceptJobItem,
    rejectJobRequest, updateJobStatus, confirmAssignment, declineAssignment,
    startJobWithOtp
} = require('./proController');
const { protect, partner } = require('../../middleware/authMiddleware');


const router = express.Router();

router.get('/dashboard', protect, partner, getProDashboardStats);
router.get('/bookings', protect, partner, getProBookings);
router.route('/availability')
    .get(protect, partner, getAvailabilityForDate)
    .post(protect, partner, updateAvailability);

router.get('/earnings', protect, partner, getEarningsData);

router.route('/bank-details')
    .get(protect, partner, getBankDetails)
    .post(protect, partner, updateBankDetails);

router.route('/profile')
    .get(protect, partner, getProProfile)
    .put(protect, partner, updateProProfile);

router.get('/profile/signed-url', protect, partner, getSignedUrlForProUpload);
router.get('/reviews', protect, partner, getProReviews);

router.put('/bookings/:bookingId/items/:itemId/accept', protect, partner, acceptJobItem);
router.put('/bookings/:bookingId/reject', protect, partner, rejectJobRequest);
router.put('/bookings/:bookingId/items/:itemId/status', protect, partner, updateJobStatus);
router.put('/bookings/:bookingId/items/:itemId/start', protect, partner, startJobWithOtp);

router.put('/bookings/:bookingId/items/:itemId/confirm', protect, partner, confirmAssignment);
router.put('/bookings/:bookingId/items/:itemId/decline', protect, partner, declineAssignment);


module.exports = router;