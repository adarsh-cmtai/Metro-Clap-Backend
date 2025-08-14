const User = require('../../models/userModel');
const Booking = require('../../models/bookingModel');
const Service = require('../../models/serviceModel');
const Category = require('../../models/categoryModel');
const Review = require('../../models/reviewModel');
const Location = require('../../models/locationModel');
const SubService = require('../../models/subServiceModel');
const PartnerApplication = require('../../models/partnerApplicationModel');
const Address = require('../../models/addressModel');
const SupportTicket = require('../../models/supportTicketModel');
const mongoose = require('mongoose');
const Razorpay = require('razorpay');
const aws = require('aws-sdk');

const getServiceImageUploadUrl = async (req, res) => {
    try {
        const s3 = new aws.S3({
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            region: process.env.AWS_REGION,
        });
        const { fileName, fileType } = req.query;
        if (!fileName || !fileType) {
            return res.status(400).json({ message: 'fileName and fileType query parameters are required.' });
        }

        const key = `service-images/${Date.now()}-${fileName}`;
        const s3Params = {
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: key,
            Expires: 60 * 5,
            ContentType: fileType,
        };
        const uploadUrl = await s3.getSignedUrlPromise('putObject', s3Params);
        const fileUrl = uploadUrl.split('?')[0];

        res.json({ uploadUrl, fileUrl });
    } catch (error) {
        res.status(500).json({ message: 'Failed to get signed URL', error: error.message });
    }
};

const initiatePartnerPayout = async (req, res) => {
    try {
        const { bookingId, itemId } = req.body;
        
        const keyId = process.env.RAZORPAY_KEY_ID;
        const keySecret = process.env.RAZORPAY_KEY_SECRET;

        if (!keyId || !keySecret) {
            console.error("RazorpayX API keys are not set in .env file.");
            return res.status(500).json({ message: "Server configuration error: Payment gateway keys are missing." });
        }

        const booking = await Booking.findById(bookingId).populate({
            path: 'items.partnerId',
            model: 'User'
        });

        if (!booking) return res.status(404).json({ message: 'Booking not found.' });

        const item = booking.items.id(itemId);
        if (!item) return res.status(404).json({ message: 'Item not found.' });
        if (item.status !== 'CompletedByPartner') return res.status(400).json({ message: 'Job not yet completed by partner.' });
        if (item.payoutStatus === 'Paid') return res.status(400).json({ message: 'Payout already processed.' });
        
        const partner = item.partnerId;
        if (!partner || !(partner.bankDetails?.accountNumber || partner.bankDetails?.vpa)) {
            return res.status(400).json({ message: "Partner's bank or UPI details are not available." });
        }
        
        const razorpay = new Razorpay({
            key_id: keyId,
            key_secret: keySecret
        });

        let contactId = partner.partnerProfile.contactId;
        if (!contactId) {
            const contact = await razorpay.contacts.create({
                name: partner.name,
                email: partner.email || `${partner.mobileNumber}@example.com`,
                contact: partner.mobileNumber,
                type: 'vendor',
            });
            contactId = contact.id;
            partner.partnerProfile.contactId = contactId;
        }

        let fundAccountId = partner.bankDetails.fundAccountId;
        if (!fundAccountId) {
            const fundAccountDetails = partner.bankDetails.vpa
                ? { account_type: 'vpa', vpa: { address: partner.bankDetails.vpa } }
                : { account_type: 'bank_account', bank_account: { name: partner.bankDetails.accountHolderName, ifsc: partner.bankDetails.ifscCode, account_number: partner.bankDetails.accountNumber } };
            
            const fundAccount = await razorpay.fundAccount.create({
                contact_id: contactId,
                ...fundAccountDetails
            });
            fundAccountId = fundAccount.id;
            partner.bankDetails.fundAccountId = fundAccountId;
        }

        await partner.save();

        const amountToPay = item.totalPrice * 80;
        const payout = await razorpay.payouts.create({
            fund_account_id: fundAccountId,
            amount: amountToPay,
            currency: "INR",
            mode: partner.bankDetails.vpa ? "UPI" : "IMPS",
            purpose: "payout",
            queue_if_low_balance: true,
            reference_id: `booking_${bookingId}_item_${itemId}`,
            narration: `Payout for ${item.serviceName}`
        });

        item.payoutStatus = 'Paid';
        item.payoutDetails = {
            transactionId: payout.id,
            payoutDate: new Date(),
        };
        item.status = 'Completed'; 
        
        await booking.save();

        const updatedBooking = await Booking.findById(bookingId)
            .populate('customerId', 'name email mobileNumber')
            .populate({ path: 'items.serviceId', select: 'name' })
            .populate({ 
                path: 'items.partnerId', 
                select: 'name bankDetails',
             })
            .populate({
                path: 'items.rejectedBy.partnerId',
                select: 'name'
            });
            
        res.json(updatedBooking);

    } catch (error) {
        console.error("Payout Error:", error);
        res.status(500).json({ message: "Failed to initiate payout", error: error.message || error });
    }
};

const getServiceablePincodes = async (req, res) => {
    try {
        const locations = await Location.find({ isActive: true }).select('pincode');
        const pincodes = locations.map(location => location.pincode);
        res.json(pincodes);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

const getDashboardStats = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalEarningsMonth,
      totalBookingsMonth,
      newCustomersMonth,
      newPartnersMonth,
      pendingPartnerApprovals,
      bookingsByStatus,
      topServices,
    ] = await Promise.all([
      Booking.aggregate([
        { $match: { status: 'Completed', createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$totalPrice' } } },
      ]),
      Booking.countDocuments({ createdAt: { $gte: startOfMonth } }),
      User.countDocuments({ role: 'customer', createdAt: { $gte: startOfMonth } }),
      User.countDocuments({ role: 'partner', createdAt: { $gte: startOfMonth } }),
      PartnerApplication.countDocuments({ status: 'Pending' }),
      Booking.aggregate([
        { $group: { _id: '$status', value: { $sum: 1 } } },
        { $project: { _id: 0, name: '$_id', value: '$value' } }
      ]),
      Booking.aggregate([
        { $unwind: '$items' },
        { $match: { 'items.status': 'Completed' } },
        { $group: { _id: '$items.serviceId', bookings: { $sum: 1 } } },
        { $sort: { bookings: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'services', localField: '_id', foreignField: '_id', as: 'service' } },
        { $unwind: '$service' },
        { $project: { _id: 0, name: '$service.name', bookings: '$bookings' } }
      ]),
    ]);

    const earnings = totalEarningsMonth.length > 0 ? totalEarningsMonth[0].total : 0;

    res.json({
      totalEarningsMonth: earnings,
      totalBookingsMonth,
      newCustomersMonth,
      newPartnersMonth,
      pendingPartnerApprovals,
      bookingsByStatus,
      topServices,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

const getBookingDetails = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id)
            .populate('customerId', 'name email mobileNumber')
            .populate({ path: 'items.serviceId', select: 'name' })
            .populate({ 
                path: 'items.partnerId', 
                select: 'name bankDetails',
             })
            .populate({
                path: 'items.rejectedBy.partnerId',
                select: 'name'
            });
        
        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }
        res.json(booking);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error" });
    }
};

const broadcastBookingToPartners = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }
        if (booking.status !== 'Pending') {
            return res.status(400).json({ message: 'Booking has already been processed.' });
        }

        const availablePartners = await User.find({ role: 'partner', status: 'Approved' });
        
        booking.broadcastedTo = availablePartners.map(p => p._id);
        booking.status = 'Searching';
        await booking.save();
        
        res.json({ message: `Booking broadcasted to ${availablePartners.length} partners.` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error" });
    }
};


const getPartners = async (req, res) => {
    try {
        const { search, status } = req.query;

        const query = { role: 'partner' };

        if (status && status !== 'All') {
            query.status = status;
        }

        if (search) {
            const searchRegex = new RegExp(search, 'i');
            query.$or = [
                { name: searchRegex },
                { mobileNumber: searchRegex }
            ];
        }

        const partners = await User.find(query).select('-password -otp -otpExpiry');
        res.json(partners);

    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};


const getCustomers = async (req, res) => {
    try {
        const { search } = req.query;
        const matchQuery = { role: 'customer' };

        if (search) {
            const searchRegex = new RegExp(search, 'i');
            matchQuery.$or = [
                { name: searchRegex },
                { mobileNumber: searchRegex }
            ];
        }

        const customers = await User.aggregate([
            { $match: matchQuery },
            {
                $lookup: {
                    from: 'bookings',
                    localField: '_id',
                    foreignField: 'customerId',
                    as: 'bookings'
                }
            },
            {
                $addFields: {
                    totalBookings: { $size: '$bookings' }
                }
            },
            {
                $project: {
                    bookings: 0,
                    password: 0,
                    otp: 0,
                    otpExpiry: 0,
                    status: 0
                }
            },
            { $sort: { createdAt: -1 } }
        ]);

        res.json(customers);

    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

const getLocations = async (req, res) => {
    try {
        const locations = await Location.find({});
        res.json(locations);
    } catch (error) { res.status(500).json({ message: 'Server Error' }); }
};

const createLocation = async (req, res) => {
    try {
        const { name, city, state, pincode, isActive } = req.body;
        const newLocation = new Location({ name, city, state, pincode, isActive });
        await newLocation.save();
        res.status(201).json(newLocation);
    } catch (error) { res.status(400).json({ message: 'Failed to create location', error }); }
};

const updateLocation = async (req, res) => { try { const d = await Location.findByIdAndUpdate(req.params.id, req.body, { new: true }); res.json(d); } catch (e) { res.status(400).json({ m: 'Failed to update' }); } };
const deleteLocation = async (req, res) => { try { const children = await Category.countDocuments({ locationId: req.params.id }); if (children > 0) return res.status(400).json({ message: 'Cannot delete. Location has categories.' }); await Location.findByIdAndDelete(req.params.id); res.json({ _id: req.params.id }); } catch (e) { res.status(400).json({ m: 'Failed to delete' }); } };

const getCategories = async (req, res) => {
    try {
        const query = req.query.locationId ? { locationId: req.query.locationId } : {};
        const categories = await Category.find(query).populate('locationId', 'name');
        res.json(categories);
    } catch (error) { res.status(500).json({ message: 'Server Error' }); }
};

const createCategory = async (req, res) => {
    try {
        const { name, locationId } = req.body;
        const newCategory = new Category({ name, locationId });
        await newCategory.save();
        res.status(201).json(newCategory);
    } catch (error) { res.status(400).json({ message: 'Failed to create category', error }); }
};

const updateCategory = async (req, res) => { try { const d = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true }); res.json(d); } catch (e) { res.status(400).json({ m: 'Failed to update' }); } };
const deleteCategory = async (req, res) => { try { const children = await Service.countDocuments({ category: req.params.id }); if (children > 0) return res.status(400).json({ message: 'Cannot delete. Category has services.' }); await Category.findByIdAndDelete(req.params.id); res.json({ _id: req.params.id }); } catch (e) { res.status(400).json({ m: 'Failed to delete' }); } };

const getServices = async (req, res) => {
    try {
        const query = req.query.categoryId ? { category: req.query.categoryId } : {};
        const services = await Service.find(query).populate('category', 'name');
        res.json(services);
    } catch (error) { res.status(500).json({ message: 'Server Error' }); }
};

const createService = async (req, res) => {
    try {
        const newService = new Service(req.body);
        await newService.save();
        res.status(201).json(newService);
    } catch (error) { res.status(400).json({ message: 'Failed to create service', error }); }
};

const getSubServices = async (req, res) => {
    try {
        const query = req.query.serviceId ? { serviceId: req.query.serviceId } : {};
        const subServices = await SubService.find(query).populate('serviceId', 'name');
        res.json(subServices);
    } catch (error) { res.status(500).json({ message: 'Server Error' }); }
};

const createSubService = async (req, res) => {
    try {
        const newSubService = new SubService(req.body);
        await newSubService.save();
        res.status(201).json(newSubService);
    } catch (error) { res.status(400).json({ message: 'Failed to create sub-service', error }); }
};

const updateSubService = async (req, res) => { try { const d = await SubService.findByIdAndUpdate(req.params.id, req.body, { new: true }); res.json(d); } catch (e) { res.status(400).json({ m: 'Failed to update' }); } };
const deleteSubService = async (req, res) => { try { await SubService.findByIdAndDelete(req.params.id); res.json({ _id: req.params.id }); } catch (e) { res.status(400).json({ m: 'Failed to delete' }); } };

const updateService = async (req, res) => { try { const d = await Service.findByIdAndUpdate(req.params.id, req.body, { new: true }); res.json(d); } catch (e) { res.status(400).json({ m: 'Failed to update' }); } };
const deleteService = async (req, res) => { try { const children = await SubService.countDocuments({ serviceId: req.params.id }); if (children > 0) return res.status(400).json({ message: 'Cannot delete. Service has sub-services.' }); await Service.findByIdAndDelete(req.params.id); res.json({ _id: req.params.id }); } catch (e) { res.status(400).json({ m: 'Failed to delete' }); } };

const getBookings = async (req, res) => {
    try {
        const { search, status, startDate, endDate } = req.query;

        let query = {};

        if (status && status !== 'All') {
            query.status = status;
        }

        if (search) {
            query.bookingId = { $regex: search, $options: 'i' };
        }

        if (startDate && endDate) {
            query.bookingDate = {
                $gte: new Date(startDate),
                $lte: new Date(endDate),
            };
        }

        const bookings = await Booking.find(query)
            .populate('customerId', 'name')
            .populate('partnerId', 'name')
            .populate({
                path: 'items.serviceId',
                select: 'name',
            })
            .sort({ createdAt: -1 });

        res.json(bookings);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

const getReviews = async (req, res) => {
    try {
        const { search, rating } = req.query;
        let query = {};

        if (rating && rating !== 'All') {
            query.rating = parseInt(rating, 10);
        }

        if (search) {
            const searchRegex = new RegExp(search, 'i');
            const partners = await User.find({ name: searchRegex, role: 'partner' }).select('_id');
            const customers = await User.find({ name: searchRegex, role: 'customer' }).select('_id');
            const partnerIds = partners.map(p => p._id);
            const customerIds = customers.map(c => c._id);

            query.$or = [
                { partnerId: { $in: partnerIds } },
                { customerId: { $in: customerIds } }
            ];
        }

        const reviews = await Review.find(query)
            .populate('customerId', 'name avatarUrl')
            .populate('partnerId', 'name')
            .populate('serviceId', 'name')
            .sort({ createdAt: -1 });

        res.json(reviews);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

const updateReviewStatus = async (req, res) => {
    try {
        const { isApproved } = req.body;
        const review = await Review.findByIdAndUpdate(req.params.id, { isApproved }, { new: true });
        if (!review) {
            return res.status(404).json({ message: 'Review not found' });
        }
        res.json(review);
    } catch (error) {
        res.status(400).json({ message: 'Failed to update review' });
    }
};

const deleteReview = async (req, res) => {
    try {
        const review = await Review.findByIdAndDelete(req.params.id);
        if (!review) {
            return res.status(404).json({ message: 'Review not found' });
        }
        res.json({ message: 'Review deleted' });
    } catch (error) {
        res.status(400).json({ message: 'Failed to delete review' });
    }
};

const getReports = async (req, res) => {
    try {
        const [
            revenueByCity,
            bookingsByDay,
            customerRepeatData,
            topPartners
        ] = await Promise.all([
            Booking.aggregate([
                { $match: { status: 'Completed' } },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'customerId',
                        foreignField: '_id',
                        as: 'customer'
                    }
                },
                { $unwind: '$customer' },
                {
                    $group: {
                        _id: '$customer.city',
                        revenue: { $sum: '$totalPrice' }
                    }
                },
                { $sort: { revenue: -1 } },
                { $limit: 5 },
                { $project: { _id: 0, name: "$_id", revenue: "$revenue" } } 
            ]),

            Booking.aggregate([
                {
                    $group: {
                        _id: { $dayOfWeek: '$bookingDate' },
                        bookings: { $sum: 1 }
                    }
                },
                { $project: { day: "$_id", bookings: "$bookings", _id: 0 } }, 
                { $sort: { day: 1 } }
            ]),

            Booking.aggregate([
                { $sort: { customerId: 1, createdAt: 1 } },
                {
                    $group: {
                        _id: '$customerId',
                        firstBooking: { $first: '$_id' }
                    }
                },
                {
                    $group: {
                        _id: null,
                        returningCustomers: {
                            $sum: {
                                $cond: [{ $ne: ["$firstBooking", null] }, 1, 0]
                            }
                        }
                    }
                }
            ]),

            Review.aggregate([
                {
                    $group: {
                        _id: '$partnerId',
                        avgRating: { $avg: '$rating' },
                        completed: { $sum: 1 }
                    }
                },
                { $sort: { avgRating: -1, completed: -1 } },
                { $limit: 5 },
                {
                    $lookup: {
                        from: 'users',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'partner'
                    }
                },
                { $unwind: '$partner' },
                {
                    $project: {
                        _id: 0,
                        name: "$partner.name",       
                        rating: "$avgRating",        
                        completed: "$completed"      
                    }
                }
            ])
        ]);

        const totalCustomers = await User.countDocuments({ role: 'customer' });
        const returningCount = customerRepeatData.length > 0 ? customerRepeatData[0].returningCustomers : 0;
        const newCount = totalCustomers - returningCount;

        const formattedCustomerData = [
            { name: 'New Customers', value: newCount > 0 ? newCount : 0 },
            { name: 'Returning Customers', value: returningCount }
        ];

        const dayMapping = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const formattedBookingsByDay = bookingsByDay.map(item => ({
            day: dayMapping[item.day - 1],
            bookings: item.bookings
        }));

        res.json({
            revenueByCity,
            bookingsByDay: formattedBookingsByDay,
            customerRepeatData: formattedCustomerData,
            topPartners
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};


const getPartnerApplications = async (req, res) => {
    try {
        const applications = await PartnerApplication.find({ status: 'Pending' }).sort({ createdAt: -1 });
        res.json(applications);
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

const getPartnerApplicationDetails = async (req, res) => {
    try {
        const application = await PartnerApplication.findById(req.params.id);
        if (!application) {
            return res.status(404).json({ message: 'Application not found.' });
        }
        res.json(application);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

const approvePartnerApplication = async (req, res) => {
    try {
        const application = await PartnerApplication.findById(req.params.id);
        if (!application || application.status !== 'Pending') {
            return res.status(404).json({ message: 'Application not found or already processed.' });
        }

        const mainContact = application.contacts[0];
        const user = await User.findOne({ mobileNumber: mainContact.mobile });
        if (!user) {
            return res.status(404).json({ message: 'No partner account exists for this mobile number. The partner must sign up first.' });
        }
        
        if (user.role !== 'partner') {
             return res.status(400).json({ message: 'An account with this mobile number exists but is not a partner account.' });
        }
        
        user.name = mainContact.name;
        user.email = mainContact.email;
        user.status = 'Approved';
        user.isVerified = true;
        user.avatarUrl = application.documents.photoUrl;

        user.partnerProfile = {
            skills: application.services,
            serviceablePincodes: application.servicePincodes,
            companyName: application.companyName,
            aadhaarNo: application.aadhaarNo,
            gstNo: application.gstNo,
            contacts: application.contacts,
            addresses: application.addresses,
            documents: {
                ...application.documents,
                aadhaar: { status: 'Verified' },
                bankAccount: { status: 'Verified' },
                skillCertificate: { status: 'Verified' },
            }
        };

        await user.save();

        application.status = 'Approved';
        await application.save();

        res.json({ message: 'Partner approved successfully and profile has been updated.' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to approve partner.', error: error.message });
    }
};

const rejectPartnerApplication = async (req, res) => {
    try {
        const application = await PartnerApplication.findByIdAndUpdate(
            req.params.id,
            { status: 'Rejected' },
            { new: true }
        );
        if (!application) {
            return res.status(404).json({ message: 'Application not found.' });
        }
        res.json({ message: 'Application has been rejected.' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to reject application.', error: error.message });
    }
};

const getPartnersByService = async (req, res) => {
    try {
        const { serviceId } = req.params;
        const { pincode, bookingId, itemId } = req.query;

        const service = await Service.findById(serviceId);
        if (!service) {
            return res.status(404).json({ message: 'Service not found' });
        }

        let rejectedPartnerIds = [];
        if (bookingId && itemId) {
            const booking = await Booking.findById(bookingId).select('items');
            const item = booking.items.id(itemId);
            if (item && item.rejectedBy) {
                rejectedPartnerIds = item.rejectedBy.map(r => r.partnerId);
            }
        }

        const query = {
            role: 'partner',
            status: 'Approved',
            'partnerProfile.skills': service.name,
            _id: { $nin: rejectedPartnerIds }
        };

        if (pincode) {
            query['partnerProfile.serviceablePincodes'] = pincode;
        }

        const partners = await User.find(query).select('name _id');

        res.json(partners);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

const assignPartnerToBookingItem = async (req, res) => {
    try {
        const { bookingId, itemId } = req.params;
        const { partnerId } = req.body;

        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return res.status(404).json({ message: "Booking not found" });
        }

        const item = booking.items.id(itemId);
        if (!item) {
            return res.status(404).json({ message: "Booking item not found" });
        }

        item.partnerId = partnerId;
        item.status = 'PendingPartnerConfirmation';

        const allItemsAssigned = booking.items.every(i => i.partnerId != null);
        if (allItemsAssigned) {
            booking.status = 'Confirmed';
        } else {
            booking.status = 'Partially Assigned';
        }

        await booking.save();
        
        const updatedBooking = await Booking.findById(bookingId)
          .populate('customerId', 'name email mobileNumber')
          .populate({ path: 'items.serviceId', select: 'name' })
          .populate({ path: 'items.partnerId', select: 'name bankDetails' })
          .populate({ path: 'items.rejectedBy.partnerId', select: 'name' });

        res.json(updatedBooking);
    } catch (error) {
        res.status(500).json({ message: "Failed to assign partner", error: error.message });
    }
};

const getCustomerDetails = async (req, res) => {
    try {
        const customerId = req.params.id;
        const [user, bookings, addresses, supportTickets] = await Promise.all([
            User.findById(customerId).select('-password -otp -otpExpiry'),
            Booking.find({ customerId }).sort({ createdAt: -1 }),
            Address.find({ userId: customerId }).sort({ createdAt: -1 }),
            SupportTicket.find({ userId: customerId }).sort({ createdAt: -1 })
        ]);

        if (!user) {
            return res.status(404).json({ message: 'Customer not found' });
        }

        res.json({ user, bookings, addresses, supportTickets });

    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

const updateCustomerProfile = async (req, res) => {
    try {
        const customer = await User.findById(req.params.id);
        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }
        
        customer.name = req.body.name || customer.name;
        customer.email = req.body.email || customer.email;

        const updatedCustomer = await customer.save();
        res.json(updatedCustomer);
    } catch (error) {
        res.status(400).json({ message: 'Failed to update profile', error: error.message });
    }
};

const updateCustomerAddress = async (req, res) => {
    try {
        const address = await Address.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!address) {
            return res.status(404).json({ message: 'Address not found' });
        }
        res.json(address);
    } catch (error) {
        res.status(400).json({ message: 'Failed to update address', error: error.message });
    }
};

const deleteCustomerAddress = async (req, res) => {
    try {
        const address = await Address.findByIdAndDelete(req.params.id);
        if (!address) {
            return res.status(404).json({ message: 'Address not found' });
        }
        res.json({ message: 'Address removed' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

const addAdminReplyToTicket = async (req, res) => {
    try {
        const { message } = req.body;
        const ticket = await SupportTicket.findById(req.params.id);

        if (!ticket) {
            return res.status(404).json({ message: 'Support ticket not found' });
        }

        const reply = {
            sender: 'admin',
            message: message,
        };

        ticket.replies.push(reply);
        ticket.status = 'In Progress';
        
        await ticket.save();
        res.status(201).json(ticket);
    } catch (error) {
        res.status(400).json({ message: 'Failed to add reply', error: error.message });
    }
};

const getPartnerDetails = async (req, res) => {
    try {
        const partnerId = new mongoose.Types.ObjectId(req.params.id);

        const [partner, bookings, reviews] = await Promise.all([
            User.findById(partnerId).select('-password -otp -otpExpiry'),
            Booking.find({ "items.partnerId": partnerId }).populate('customerId', 'name'),
            Review.find({ partnerId }).populate('customerId', 'name avatarUrl').sort({ createdAt: -1 })
        ]);

        if (!partner) {
            return res.status(404).json({ message: 'Partner not found' });
        }
        
        let pendingPayout = 0;
        let totalPaid = 0;
        const transactions = [];
        const partnerBookings = bookings.flatMap(booking =>
            booking.items
                .filter(item => item.partnerId && item.partnerId.equals(partnerId))
                .map(item => {
                    const earning = item.totalPrice * 0.8;
                    if (item.status === 'CompletedByPartner' && item.payoutStatus === 'Pending') {
                        pendingPayout += earning;
                    }
                    if (item.payoutStatus === 'Paid') {
                        totalPaid += earning;
                        transactions.push({
                            bookingId: booking.bookingId,
                            date: item.payoutDetails?.payoutDate || booking.bookingDate,
                            amount: earning,
                            status: 'Paid'
                        });
                    }
                     return {
                        _id: booking._id,
                        itemId: item._id,
                        bookingId: booking.bookingId,
                        serviceName: item.serviceName,
                        date: booking.bookingDate,
                        customerName: booking.customerId.name,
                        status: item.status,
                        earning: earning
                    };
                })
        );
        
        const totalReviews = reviews.length;
        const avgRating = totalReviews > 0 ? reviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews : 0;
        
        res.json({
            user: partner,
            bookings: partnerBookings,
            earnings: {
                pendingPayout,
                totalPaid,
                transactions
            },
            reviews: {
                list: reviews,
                summary: {
                    totalReviews,
                    avgRating
                }
            }
        });

    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

module.exports = {
    getDashboardStats, getPartners, getCustomers, getServices,
    createService,
    updateService,
    getCategories,
    createCategory,
    deleteCategory, getBookings,
    getReviews,
    updateReviewStatus,
    deleteReview,
    getReports,
    getBookingDetails,
    broadcastBookingToPartners,
    getLocations, createLocation,
    getSubServices, createSubService,
    updateLocation, deleteLocation, updateCategory, updateSubService, deleteSubService, deleteService,
    getPartnerApplications,
    getPartnerApplicationDetails,
    approvePartnerApplication,
    rejectPartnerApplication,
    getServiceablePincodes,
    getPartnersByService,
    assignPartnerToBookingItem,
    initiatePartnerPayout,
    getCustomerDetails,
    updateCustomerProfile,
    updateCustomerAddress,
    deleteCustomerAddress,
    addAdminReplyToTicket,
    getPartnerDetails,
    getServiceImageUploadUrl,
};