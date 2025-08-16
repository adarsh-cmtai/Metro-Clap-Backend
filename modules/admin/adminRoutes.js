const express = require('express');
const { getDashboardStats ,getPartners, getCustomers,
    getServices, createService, updateService,
    getCategories, createCategory, deleteCategory, getBookings, getReviews, updateReviewStatus, deleteReview, getReports,getBookingDetails, broadcastBookingToPartners,
    getSubServices, createSubService,
    getLocations, createLocation,
    updateLocation,deleteLocation,updateCategory, updateSubService, deleteSubService, deleteService,getPartnerApplications,
    getPartnerApplicationDetails,
    approvePartnerApplication,
    rejectPartnerApplication,
    getServiceablePincodes, getPartnersByService,
    assignPartnerToBookingItem, 
    initiatePartnerPayout,
    getCustomerDetails,
    updateCustomerProfile,
    updateCustomerAddress,
    deleteCustomerAddress,
    addAdminReplyToTicket,
    getPartnerDetails,
    getServiceImageUploadUrl,
    cancelAndRefundBooking,
} = require('./adminController');
const { protect, admin } = require('../../middleware/authMiddleware');

const router = express.Router();

router.get('/dashboard-stats',protect, admin, getDashboardStats);
router.get('/partners', protect, admin, getPartners);
router.get('/customers', protect, admin, getCustomers);
router.get('/pincodes', getServiceablePincodes);

router.get('/services/signed-url', protect, admin, getServiceImageUploadUrl);
router.route('/services').get(protect, admin, getServices).post(protect, admin, createService);
router.route('/services/:id').put(protect, admin, updateService).delete(protect, admin, deleteService);

router.route('/categories').get(protect, admin, getCategories).post(protect, admin,createCategory);
router.route('/categories/:id').put(protect, admin, updateCategory).delete(protect, admin, deleteCategory);

router.put('/bookings/:id/cancel-refund', protect, admin, cancelAndRefundBooking);
router.get('/bookings', protect, admin, getBookings);
router.route('/reviews').get(protect, admin, getReviews);
router.route('/reviews/:id').put(protect, admin, updateReviewStatus).delete(protect, admin, deleteReview);

router.get('/reports', protect, admin, getReports);
router.get('/bookings/:id', protect, admin, getBookingDetails);
router.put('/bookings/:id/broadcast', protect, admin, broadcastBookingToPartners);
router.route('/locations').get(getLocations).post(protect, admin, createLocation);
router.route('/locations/:id').put(protect, admin, updateLocation).delete(protect, admin, deleteLocation);
router.route('/sub-services').get(protect, admin, getSubServices).post(protect, admin, createSubService);
router.route('/sub-services/:id').put(protect, admin, updateSubService).delete(protect, admin, deleteSubService);

router.get('/partner-applications', protect, admin, getPartnerApplications);
router.get('/partner-applications/:id', protect, admin, getPartnerApplicationDetails);
router.put('/partner-applications/:id/approve', protect, admin, approvePartnerApplication);
router.put('/partner-applications/:id/reject', protect, admin, rejectPartnerApplication);

router.get('/partners/by-service/:serviceId', protect, admin, getPartnersByService);
router.put('/bookings/:bookingId/items/:itemId/assign', protect, admin, assignPartnerToBookingItem);
router.post('/payouts/initiate', protect, admin, initiatePartnerPayout);

router.get('/customers/:id/details', protect, admin, getCustomerDetails);
router.put('/customers/:id', protect, admin, updateCustomerProfile);
router.put('/addresses/:id', protect, admin, updateCustomerAddress);
router.delete('/addresses/:id', protect, admin, deleteCustomerAddress);
router.post('/support-tickets/:id/reply', protect, admin, addAdminReplyToTicket);

router.get('/partners/:id/details', protect, admin, getPartnerDetails);

module.exports = router;
