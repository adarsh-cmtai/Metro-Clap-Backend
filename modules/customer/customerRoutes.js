const express = require('express');
const { 
    getCustomerDashboard,
    createBooking, 
    getMyBookings, 
    submitReview,
    cancelBooking,
    rescheduleBooking,
    updateMyProfile, 
    updateMyPassword, 
    getSignedUrlForUpload,
    getMyAddresses,
    addMyAddress,
    updateMyAddress,
    deleteMyAddress,
    getRecentBookingsForSupport,
    createSupportTicket,
    downloadInvoice,
    payRemainingAmount
} = require('./customerController');
const { protect , customer} = require('../../middleware/authMiddleware');

const router = express.Router();

router.post('/bookings', protect, customer, createBooking);
router.put('/bookings/:id/cancel', protect, customer, cancelBooking);
router.put('/bookings/:id/reschedule', protect, customer, rescheduleBooking);
router.put('/bookings/:id/pay-remaining', protect, customer, payRemainingAmount);
router.get('/dashboard', protect, getCustomerDashboard);
router.get('/bookings', protect, getMyBookings);
router.post('/reviews', protect, submitReview);
router.route('/profile').put(protect, updateMyProfile);
router.put('/profile/password', protect, updateMyPassword);
router.get('/profile/signed-url', protect, getSignedUrlForUpload);

router.route('/addresses')
    .get(protect, getMyAddresses)
    .post(protect, addMyAddress);

router.route('/addresses/:id')
    .put(protect, updateMyAddress)
    .delete(protect, deleteMyAddress);

router.get('/bookings/:id/invoice', protect, customer, downloadInvoice);
router.get('/recent-bookings', protect, getRecentBookingsForSupport);
router.post('/support-tickets', protect, createSupportTicket);

module.exports = router;