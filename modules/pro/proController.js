const aws = require('aws-sdk');
const Booking = require('../../models/bookingModel');
const Review = require('../../models/reviewModel');
const User = require('../../models/userModel');
const mongoose = require('mongoose')

const startJobWithOtp = async (req, res) => {
    const { bookingId, itemId } = req.params;
    const { otp } = req.body;
    const partnerId = req.user._id;

    if (!otp) {
        return res.status(400).json({ message: 'OTP is required.' });
    }

    try {
        const booking = await Booking.findById(bookingId);
        if (!booking) return res.status(404).json({ message: "Booking not found." });

        const item = booking.items.id(itemId);
        if (!item) return res.status(404).json({ message: "Job item not found." });
        
        if (item.partnerId.toString() !== partnerId.toString()) {
            return res.status(403).json({ message: 'You are not authorized to start this job.' });
        }
        if (item.status !== 'Assigned') {
            return res.status(400).json({ message: `Cannot start a job with status: ${item.status}` });
        }
        if (booking.bookingOTP !== otp) {
            return res.status(400).json({ message: 'Invalid or incorrect OTP.' });
        }

        item.status = 'InProgress';
        await booking.save();
        
        const updatedBooking = await Booking.findById(bookingId).populate('customerId', 'name avatarUrl');
        const updatedJob = updatedBooking.items.id(itemId);
        
        res.json({
            bookingId: updatedBooking._id,
            itemId: updatedJob._id,
            serviceName: updatedJob.serviceName,
            date: new Date(updatedBooking.bookingDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
            time: updatedBooking.slotTime,
            status: updatedJob.status,
            bookingStatus: updatedBooking.status,
            customer: updatedBooking.customerId,
            address: updatedBooking.address,
            totalAmount: updatedBooking.totalPrice,
            earnings: updatedJob.totalPrice * 0.8,
        });

    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

const getProDashboardStats = async (req, res) => {
    try {
        const partnerId = req.user._id;
        const partnerObjectId = new mongoose.Types.ObjectId(partnerId);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        
        const [
            earningsAgg,
            todayBookings,
            newJobRequests,
            fiveStarRatings,
            partnerData
        ] = await Promise.all([
             Booking.aggregate([
                { $unwind: '$items' },
                { $match: { 'items.partnerId': partnerObjectId, 'items.status': 'Completed', bookingDate: { $gte: startOfWeek } } },
                { 
                    $group: { 
                        _id: null,
                        weeksEarnings: { $sum: '$items.totalPrice' },
                        todaysEarnings: {
                            $sum: {
                                $cond: [{ $gte: ['$bookingDate', today] }, '$items.totalPrice', 0]
                            }
                        }
                    } 
                }
            ]),
            Booking.find({ 
                "items.partnerId": partnerId, 
                "items.status": { $in: ['Assigned', 'InProgress'] },
                bookingDate: { $gte: today, $lt: tomorrow } 
            }).populate('customerId', 'name').limit(5),
            Booking.find({
                $or: [
                    { broadcastedTo: partnerId, status: 'Searching' },
                    { "items.partnerId": partnerId, "items.status": "PendingPartnerConfirmation" }
                ]
             })
                .populate('items.serviceId', 'name')
                .limit(5),
            Review.countDocuments({ partnerId, rating: 5 }),
            User.findById(partnerId).select('rating')
        ]);
        
        const todaysEarnings = earningsAgg[0]?.todaysEarnings * 0.8 || 0;
        const weeksEarnings = earningsAgg[0]?.weeksEarnings * 0.8 || 0;

        const formattedTodayJobs = todayBookings.flatMap(booking =>
            booking.items
                .filter(item => item.partnerId && item.partnerId.toString() === partnerId.toString())
                .map(item => ({
                    timeSlot: booking.slotTime,
                    serviceName: item.serviceName,
                    customerName: booking.customerId.name,
                    address: booking.address,
                }))
        );
        
        const formattedNewRequests = newJobRequests.flatMap(booking =>
             booking.items
             .filter(item => item.partnerId?.toString() === partnerId.toString() || booking.status === 'Searching')
             .map(item => ({
                 bookingId: booking._id,
                 itemId: item._id,
                 serviceName: item.serviceName,
                 location: booking.address,
                 earnings: item.totalPrice * 0.8,
                 status: item.status
             }))
        );

        res.json({
            todaysEarnings,
            weeksEarnings,
            rating: partnerData?.rating || 0,
            todayJobs: formattedTodayJobs,
            newJobRequests: formattedNewRequests,
            performance: {
                acceptanceRate: 95, 
                completionRate: 100,
                fiveStarRatings,
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

const confirmAssignment = async (req, res) => {
    const { bookingId, itemId } = req.params;
    const partnerId = req.user._id;

    try {
        const booking = await Booking.findById(bookingId);
        if (!booking) return res.status(404).json({ message: "Booking not found." });

        const item = booking.items.id(itemId);
        if (!item) return res.status(404).json({ message: "Job item not found." });

        if (item.partnerId.toString() !== partnerId.toString()) {
            return res.status(403).json({ message: "You are not authorized to accept this job." });
        }
        if (item.status !== 'PendingPartnerConfirmation') {
            return res.status(400).json({ message: "This job is no longer pending confirmation." });
        }

        item.status = 'Assigned';
        await booking.save();
        res.json({ message: 'Job confirmed successfully!' });

    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

const declineAssignment = async (req, res) => {
    const { bookingId, itemId } = req.params;
    const { reason } = req.body;
    const partnerId = req.user._id;

    if (!reason) return res.status(400).json({ message: 'A reason for rejection is required.' });

    try {
        const booking = await Booking.findById(bookingId);
        if (!booking) return res.status(404).json({ message: "Booking not found." });

        const item = booking.items.id(itemId);
        if (!item) return res.status(404).json({ message: "Job item not found." });

        if (item.partnerId.toString() !== partnerId.toString()) {
            return res.status(403).json({ message: "You are not authorized to decline this job." });
        }

        item.rejectedBy.push({ partnerId, reason });
        item.partnerId = null;
        item.status = 'Pending Assignment';
        
        const anyItemAssigned = booking.items.some(i => i.partnerId != null);
        if (!anyItemAssigned) {
             booking.status = 'Pending';
        }

        await booking.save();
        res.json({ message: 'Job declined successfully.' });

    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};


const acceptJobItem = async (req, res) => {
    const { bookingId, itemId } = req.params;
    const partnerId = req.user._id;

    try {
        const booking = await Booking.findById(bookingId);
        if (!booking) return res.status(404).json({ message: "Booking not found." });
        if (booking.status !== 'Searching') return res.status(400).json({ message: "This job is no longer available." });

        const item = booking.items.id(itemId);
        if (!item) return res.status(404).json({ message: "Job item not found." });
        if (item.partnerId) return res.status(400).json({ message: "This job has already been assigned." });
        
        item.partnerId = partnerId;
        item.status = 'Assigned';

        booking.broadcastedTo = [];
        
        const allItemsAssigned = booking.items.every(i => i.partnerId);
        booking.status = allItemsAssigned ? 'Confirmed' : 'Partially Assigned';

        await booking.save();
        res.json({ message: 'Job accepted successfully!' });
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

const rejectJobRequest = async (req, res) => {
    const { bookingId } = req.params;
    const partnerId = req.user._id;
    try {
        await Booking.updateOne({ _id: bookingId }, { $pull: { broadcastedTo: partnerId } });
        res.json({ message: 'Job request rejected.' });
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

const updateJobStatus = async (req, res) => {
    const { bookingId, itemId } = req.params;
    const { status } = req.body;
    const partnerId = req.user._id;

    if (!['CompletedByPartner'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status update.' });
    }
    
    try {
        const booking = await Booking.findById(bookingId);
        if (!booking) return res.status(404).json({ message: "Booking not found." });

        const item = booking.items.id(itemId);
        if (!item) return res.status(404).json({ message: "Job item not found." });

        if (item.partnerId.toString() !== partnerId.toString()) {
            return res.status(403).json({ message: 'You are not authorized to update this job.' });
        }

        item.status = status;
        
        const allItemsDoneByPartner = booking.items.every(i => i.status === 'CompletedByPartner' || i.status === 'Completed');
        if (allItemsDoneByPartner) {
            booking.status = 'Completed';
        }

        await booking.save();
        
        const updatedBooking = await Booking.findById(bookingId)
            .populate('customerId', 'name avatarUrl')
            
        const updatedJob = updatedBooking.items.id(itemId);

        res.json({
            bookingId: updatedBooking._id,
            itemId: updatedJob._id,
            serviceName: updatedJob.serviceName,
            date: new Date(updatedBooking.bookingDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
            time: updatedBooking.slotTime,
            status: updatedJob.status,
            bookingStatus: updatedBooking.status,
            customer: updatedBooking.customerId,
            address: updatedBooking.address,
            totalAmount: updatedBooking.totalPrice,
            earnings: updatedJob.totalPrice * 0.8,
        });

    } catch (error) {
         res.status(500).json({ message: "Server Error", error: error.message });
    }
};


const getProBookings = async (req, res) => {
    try {
        const partnerId = new mongoose.Types.ObjectId(req.user._id);

        const bookings = await Booking.find({
            $or: [
                { "items.partnerId": partnerId },
                { "items.rejectedBy.partnerId": partnerId }
            ]
        })
        .populate('customerId', 'name avatarUrl')
        .sort({ bookingDate: -1 });

        const formattedJobs = bookings.flatMap(booking => 
            booking.items.map(item => {
                const isAssignedToMe = item.partnerId && item.partnerId.equals(partnerId);
                const rejection = item.rejectedBy.find(r => r.partnerId && r.partnerId.equals(partnerId));

                if (isAssignedToMe || rejection) {
                    return {
                        bookingId: booking._id,
                        itemId: item._id,
                        serviceName: item.serviceName,
                        date: new Date(booking.bookingDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
                        time: booking.slotTime,
                        status: item.status,
                        bookingStatus: booking.status,
                        customer: booking.customerId,
                        address: booking.address,
                        totalAmount: booking.totalPrice,
                        earnings: item.totalPrice * 0.8,
                        isRejectedByMe: !!rejection,
                        rejectionReason: rejection ? rejection.reason : undefined
                    };
                }
                return null;
            }).filter(Boolean)
        );
        
        res.json(formattedJobs);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};


const getAvailabilityForDate = async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) {
            return res.status(400).json({ message: 'Date query parameter is required.' });
        }
        const partner = await User.findById(req.user._id).select('availability');
        if (!partner) {
            return res.status(404).json({ message: 'Partner not found.' });
        }
        const unavailableHours = partner.availability.get(date) || [];
        res.json({ date, unavailableHours });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

const updateAvailability = async (req, res) => {
    try {
        const { date, unavailableHours } = req.body;
        if (!date || !Array.isArray(unavailableHours)) {
            return res.status(400).json({ message: 'Date and an array of unavailable hours are required.' });
        }
        const partner = await User.findById(req.user._id);
        if (!partner) {
            return res.status(404).json({ message: 'Partner not found.' });
        }
        partner.availability.set(date, unavailableHours);
        await partner.save();
        res.json({ message: `Availability for ${date} updated successfully.` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

const getEarningsData = async (req, res) => {
    try {
        const partnerId = req.user._id;
        
        const [totalEarnings, paidBookings] = await Promise.all([
            Booking.aggregate([
                { $unwind: '$items' },
                { $match: { 'items.partnerId': new mongoose.Types.ObjectId(partnerId), 'items.payoutStatus': 'Paid' } },
                { $group: { _id: null, total: { $sum: '$items.totalPrice' } } }
            ]),
            Booking.find({ "items.partnerId": partnerId, "items.payoutStatus": 'Paid' })
                .sort({ bookingDate: -1 })
                .limit(10)
        ]);

        const transactions = paidBookings.flatMap(booking => 
            booking.items
            .filter(item => item.partnerId && item.partnerId.toString() === partnerId.toString() && item.payoutStatus === 'Paid')
            .map(item => ({
                bookingId: `METRO-${booking._id.toString().slice(-5).toUpperCase()}`,
                total: item.totalPrice,
                commission: item.totalPrice * 0.2,
                earning: item.totalPrice * 0.8,
                date: item.payoutDetails.payoutDate || booking.bookingDate
            }))
        );

        res.json({
            totalEarnings: totalEarnings[0]?.total * 0.8 || 0,
            lastPayout: 12500,
            nextPayout: 9800,
            transactions
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

const getBankDetails = async (req, res) => {
    try {
        const partner = await User.findById(req.user._id).select('bankDetails');
        if (!partner) {
            return res.status(404).json({ message: 'Partner not found.' });
        }
        res.json(partner.bankDetails || {});
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

const updateBankDetails = async (req, res) => {
    try {
        const { accountHolderName, accountNumber, ifscCode, vpa } = req.body;
        if (!((accountNumber && ifscCode) || vpa)) {
            return res.status(400).json({ message: 'Please provide either bank account details or a UPI VPA.' });
        }

        const partner = await User.findById(req.user._id);
        if (!partner) {
            return res.status(404).json({ message: 'Partner not found.' });
        }

        partner.bankDetails.accountHolderName = accountHolderName;
        partner.bankDetails.accountNumber = accountNumber;
        partner.bankDetails.ifscCode = ifscCode;
        partner.bankDetails.vpa = vpa;
        partner.bankDetails.fundAccountId = undefined;

        await partner.save();
        res.json(partner.bankDetails);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

const getSignedUrlForProUpload = async (req, res) => {
    try {
        const s3 = new aws.S3({
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            region: process.env.AWS_REGION,
        });

        const { fileName, fileType } = req.query;
        const key = `partner-profiles/${req.user._id}-${Date.now()}-${fileName}`;

        const s3Params = {
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: key,
            Expires: 60,
            ContentType: fileType,
        };

        const uploadUrl = await s3.getSignedUrlPromise('putObject', s3Params);
        const fileUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

        res.json({ uploadUrl, fileUrl });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to get signed URL', error: error.message });
    }
};

const getProProfile = async (req, res) => {
    try {
        const partner = await User.findById(req.user._id);
        if (!partner) {
            return res.status(404).json({ message: 'Partner not found.' });
        }
        res.json({
            _id: partner._id,
            name: partner.name,
            email: partner.email,
            mobileNumber: partner.mobileNumber,
            avatarUrl: partner.avatarUrl,
            role: partner.role,
            partnerProfile: partner.partnerProfile
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

const updateProProfile = async (req, res) => {
    try {
        const partner = await User.findById(req.user._id);
        if (!partner) {
            return res.status(404).json({ message: 'Partner not found.' });
        }
        
        const { name, bio, serviceablePincodes, avatarUrl, skills } = req.body;

        partner.name = name || partner.name;
        partner.avatarUrl = avatarUrl || partner.avatarUrl;

        if (!partner.partnerProfile) {
            partner.partnerProfile = {};
        }
        
        partner.partnerProfile.bio = bio;
        
        if (skills && Array.isArray(skills)) {
            partner.partnerProfile.skills = skills.filter(s => typeof s === 'string' && s.trim() !== '');
        }
        
        if (serviceablePincodes && typeof serviceablePincodes === 'string') {
            partner.partnerProfile.serviceablePincodes = serviceablePincodes.split(',').map(p => p.trim());
        }

        const updatedPartner = await partner.save();
        
        res.json({
            _id: updatedPartner._id,
            name: updatedPartner.name,
            email: updatedPartner.email,
            mobileNumber: updatedPartner.mobileNumber,
            avatarUrl: updatedPartner.avatarUrl,
            role: updatedPartner.role,
            partnerProfile: updatedPartner.partnerProfile,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

const getProReviews = async (req, res) => {
    try {
        const partnerId = new mongoose.Types.ObjectId(req.user._id);

        const [reviews, summary] = await Promise.all([
            Review.find({ partnerId })
                .populate('customerId', 'name avatarUrl')
                .sort({ createdAt: -1 }),
            
            Review.aggregate([
                { $match: { partnerId } },
                { 
                    $group: {
                        _id: null,
                        totalReviews: { $sum: 1 },
                        avgRating: { $avg: '$rating' },
                        '5': { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
                        '4': { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
                        '3': { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
                        '2': { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
                        '1': { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
                    }
                }
            ])
        ]);

        const ratingSummary = summary[0] ? {
            totalReviews: summary[0].totalReviews,
            avgRating: summary[0].avgRating,
            ratingDistribution: [
                { stars: 5, count: summary[0]['5'] },
                { stars: 4, count: summary[0]['4'] },
                { stars: 3, count: summary[0]['3'] },
                { stars: 2, count: summary[0]['2'] },
                { stars: 1, count: summary[0]['1'] },
            ]
        } : {
            totalReviews: 0,
            avgRating: 0,
            ratingDistribution: [
                { stars: 5, count: 0 }, { stars: 4, count: 0 }, { stars: 3, count: 0 }, { stars: 2, count: 0 }, { stars: 1, count: 0 }
            ]
        };

        res.json({ reviews, summary: ratingSummary });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

module.exports = { getProDashboardStats, getProBookings ,
    getAvailabilityForDate, 
    updateAvailability,
    getEarningsData,
    getBankDetails,
    updateBankDetails,
    getProProfile,
    updateProProfile,
    getSignedUrlForProUpload,
    getProReviews,
    acceptJobItem,
    rejectJobRequest,
    updateJobStatus,
    confirmAssignment,
    declineAssignment,
    startJobWithOtp,
 };