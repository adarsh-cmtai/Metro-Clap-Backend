const Booking = require('../../models/bookingModel');
const Service = require('../../models/serviceModel');
const User = require('../../models/userModel');
const Review = require('../../models/reviewModel');
const Address = require('../../models/addressModel');
const SupportTicket = require('../../models/supportTicketModel');
const crypto = require('crypto');
const aws = require('aws-sdk');
const PDFDocument = require('pdfkit');

async function sendBookingConfirmationSMS(customer, booking) {
    const message = `Booking Confirmed! ID: ${booking.bookingId}. Service on ${new Date(booking.bookingDate).toLocaleDateString()} at ${booking.slotTime}. Your Booking OTP is: ${booking.bookingOTP}. Thank you for choosing MetroClap.`;
    
    console.log("--- SIMULATED SMS SENT ---");
    console.log(`To: ${customer.mobileNumber}`);
    console.log(`Message: ${message}`);
    console.log("--------------------------");
}

const createBooking = async (req, res) => {
    try {
        const { items, bookingDate, slotTime, address, totalPrice, paymentMethod, amountPaid, paymentDetails } = req.body;
        const customerId = req.user._id;

        const bookingData = {
            customerId,
            bookingId: `METRO-${Date.now()}`,
            items: items.map(item => ({
                serviceId: item.serviceId,
                serviceName: item.serviceName,
                quantity: item.quantity,
                totalPrice: item.price * item.quantity, 
                selectedOptions: [{
                    groupName: 'Type',
                    optionName: item.subService.name,
                    price: item.subService.price
                }]
            })),
            bookingDate: new Date(bookingDate),
            slotTime,
            address,
            totalPrice,
            paymentMethod,
            amountPaid: 0,
            amountDue: totalPrice,
            bookingOTP: Math.floor(1000 + Math.random() * 9000).toString(),
        };

        if (paymentMethod === 'Online') {
            const { orderId, paymentId, signature } = paymentDetails;
            if (!orderId || !paymentId || !signature) {
                return res.status(400).json({ message: "Payment details are missing for online payment." });
            }

            const body = orderId + "|" + paymentId;
            const expectedSignature = crypto
                .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
                .update(body.toString())
                .digest('hex');

            if (expectedSignature !== signature) {
                return res.status(400).json({ message: "Payment verification failed. Invalid signature." });
            }
            
            bookingData.amountPaid = amountPaid;
            bookingData.amountDue = totalPrice - amountPaid;
            bookingData.paymentDetails = paymentDetails;
            bookingData.paymentStatus = bookingData.amountDue > 0 ? 'Partially Paid' : 'Paid';

        } else if (paymentMethod === 'COD') {
            bookingData.paymentStatus = 'Pending';
        } else {
            return res.status(400).json({ message: "Invalid payment method specified." });
        }

        const newBooking = new Booking(bookingData);
        const savedBooking = await newBooking.save();
        
        await sendBookingConfirmationSMS(req.user, savedBooking);
        
        res.status(201).json({ 
            message: "Booking created successfully", 
            booking: savedBooking 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

const payRemainingAmount = async (req, res) => {
    try {
        const { paymentDetails } = req.body;
        const booking = await Booking.findById(req.params.id);

        if (!booking) return res.status(404).json({ message: 'Booking not found.' });
        if (booking.customerId.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not authorized.' });
        if (booking.amountDue <= 0) return res.status(400).json({ message: 'No amount due.' });

        const { orderId, paymentId, signature } = paymentDetails;
        const body = orderId + "|" + paymentId;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');

        if (expectedSignature !== signature) {
            return res.status(400).json({ message: "Payment verification failed." });
        }

        booking.amountPaid += booking.amountDue;
        booking.amountDue = 0;
        booking.paymentStatus = 'Paid';
        
        const updatedBooking = await booking.save();
        res.json(updatedBooking);

    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

const downloadInvoice = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id)
            .populate('customerId', 'name email mobileNumber')
            .populate('items.serviceId', 'name');

        if (!booking || booking.customerId._id.toString() !== req.user._id.toString()) {
            return res.status(404).json({ message: "Booking not found or you're not authorized." });
        }

        const doc = new PDFDocument({ margin: 50 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${booking.bookingId}.pdf`);

        doc.pipe(res);

        doc.fontSize(20).text('INVOICE', { align: 'center' });
        doc.moveDown();
        doc.fontSize(14).text('MetroClap Services', { align: 'center' });
        doc.moveDown(2);

        doc.fontSize(12);
        doc.text(`Booking ID: ${booking.bookingId}`);
        doc.text(`Booking Date: ${new Date(booking.bookingDate).toLocaleDateString()}`);
        doc.moveDown();

        doc.text('Bill To:');
        doc.font('Helvetica-Bold').text(booking.customerId.name);
        doc.font('Helvetica').text(booking.address);
        doc.text(booking.customerId.email || '');
        doc.text(booking.customerId.mobileNumber);
        doc.moveDown(2);

        const tableTop = doc.y;
        doc.font('Helvetica-Bold');
        doc.text('Service', 50, tableTop);
        doc.text('Qty', 300, tableTop, { width: 90, align: 'right' });
        doc.text('Price', 370, tableTop, { width: 90, align: 'right' });
        doc.text('Total', 450, tableTop, { width: 90, align: 'right' });
        doc.font('Helvetica');

        let i = 0;
        booking.items.forEach(item => {
            const y = tableTop + (i + 1) * 25;
            doc.text(item.serviceName, 50, y);
            doc.text(item.quantity.toString(), 300, y, { width: 90, align: 'right' });
            doc.text(`Rs. ${item.totalPrice / item.quantity}`, 370, y, { width: 90, align: 'right' });
            doc.text(`Rs. ${item.totalPrice}`, 450, y, { width: 90, align: 'right' });
            i++;
        });

        const subtotalY = tableTop + (i + 1) * 25 + 10;
        doc.lineCap('butt').moveTo(50, subtotalY-5).lineTo(550, subtotalY-5).stroke();
        doc.font('Helvetica-Bold');
        doc.text('Grand Total:', 370, subtotalY, { width: 90, align: 'right' });
        doc.text(`Rs. ${booking.totalPrice}`, 450, subtotalY, { width: 90, align: 'right' });
        doc.text('Amount Paid:', 370, subtotalY + 15, { width: 90, align: 'right' });
        doc.text(`Rs. ${booking.amountPaid}`, 450, subtotalY + 15, { width: 90, align: 'right' });
        doc.font('Helvetica-Bold').fillColor('red');
        doc.text('Amount Due:', 370, subtotalY + 30, { width: 90, align: 'right' });
        doc.text(`Rs. ${booking.amountDue}`, 450, subtotalY + 30, { width: 90, align: 'right' });
        doc.fillColor('black');

        doc.end();

    } catch (error) {
        console.error('Invoice generation error:', error);
        res.status(500).send('Error generating PDF');
    }
};

const getMyBookings = async (req, res) => {
    try {
        const customerId = req.user._id;
        const bookings = await Booking.find({ customerId })
            .populate({
                path: 'items.serviceId',
                select: 'name'
            })
            .populate({
                path: 'items.partnerId',
                select: 'name rating avatarUrl mobileNumber'
            })
            .sort({ bookingDate: -1 });

        const reviews = await Review.find({ customerId }).select('bookingId');
        const reviewedBookingIds = new Set(reviews.map(r => r.bookingId.toString()));

        const bookingsWithReviewStatus = bookings.map(b => ({
            ...b.toObject(),
            isRated: reviewedBookingIds.has(b._id.toString()),
        }));
        
        res.json(bookingsWithReviewStatus);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

const submitReview = async (req, res) => {
    try {
        const { bookingId, partnerId, serviceId, rating, comment } = req.body;
        const customerId = req.user._id;

        const booking = await Booking.findById(bookingId);
        if (!booking || booking.customerId.toString() !== customerId.toString()) {
            return res.status(404).json({ message: 'Booking not found or does not belong to user.' });
        }
        
        if (!partnerId || !serviceId) {
             return res.status(400).json({ message: 'Partner and Service must be specified for a review.' });
        }

        const newReview = new Review({
            bookingId,
            customerId,
            partnerId,
            serviceId,
            rating,
            comment,
            isApproved: true,
        });

        await newReview.save();
        res.status(201).json({ message: 'Review submitted successfully.' });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'You have already reviewed this booking.' });
        }
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

const getCustomerDashboard = async (req, res) => {
    try {
        const customerId = req.user._id;

        const upcomingBooking = await Booking.findOne({ 
            customerId, 
            status: { $in: ['Pending', 'Confirmed', 'Searching', 'Partially Assigned'] } 
        })
        .sort({ bookingDate: 1 })
        .populate({
            path: 'items.partnerId',
            select: 'name rating avatarUrl mobileNumber'
        });

        res.json({
            upcomingBooking,
        });

    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

const cancelBooking = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);

        if (!booking) return res.status(404).json({ message: 'Booking not found.' });
        if (booking.customerId.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not authorized.' });
        if (['Completed', 'Cancelled'].includes(booking.status)) return res.status(400).json({ message: `Cannot cancel a ${booking.status.toLowerCase()} booking.` });

        booking.status = 'Cancelled';
        const updatedBooking = await booking.save();
        res.json(updatedBooking);

    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

const rescheduleBooking = async (req, res) => {
    try {
        const { bookingDate, slotTime } = req.body;
        if (!bookingDate || !slotTime) return res.status(400).json({ message: 'New date and slot time are required.' });

        const booking = await Booking.findById(req.params.id);

        if (!booking) return res.status(404).json({ message: 'Booking not found.' });
        if (booking.customerId.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not authorized.' });
        if (['Completed', 'Cancelled'].includes(booking.status)) return res.status(400).json({ message: `Cannot reschedule a ${booking.status.toLowerCase()} booking.` });

        booking.bookingDate = new Date(bookingDate);
        booking.slotTime = slotTime;
        const updatedBooking = await booking.save();
        res.json(updatedBooking);

    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

const updateMyProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (user) {
            user.name = req.body.name || user.name;
            user.email = req.body.email || user.email;
            if (req.body.avatarUrl) {
                user.avatarUrl = req.body.avatarUrl;
            }
            const updatedUser = await user.save();
            res.json({
                _id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                mobileNumber: updatedUser.mobileNumber,
                avatarUrl: updatedUser.avatarUrl,
                role: updatedUser.role,
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(400).json({ message: 'Failed to update profile', error: error.message });
    }
};

const updateMyPassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user._id).select('+password');

        if (user && (await user.matchPassword(currentPassword))) {
            user.password = newPassword;
            await user.save();
            res.json({ message: 'Password updated successfully' });
        } else {
            res.status(401).json({ message: 'Invalid current password' });
        }
    } catch (error) {
        res.status(400).json({ message: 'Failed to update password', error: error.message });
    }
};

const getSignedUrlForUpload = async (req, res) => {
    try {
        const s3 = new aws.S3({
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            region: process.env.AWS_REGION,
        });
        const { fileName, fileType } = req.query;
        const key = `profile-pictures/${req.user._id}-${Date.now()}-${fileName}`;
        const s3Params = {
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: key,
            Expires: 60,
            ContentType: fileType,
        };
        const uploadUrl = await s3.getSignedUrlPromise('putObject', s3Params);
        const fileUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/${key}`;
        res.json({ uploadUrl, fileUrl });
    } catch (error) {
        res.status(500).json({ message: 'Failed to get signed URL', error: error.message });
    }
};

const getMyAddresses = async (req, res) => {
    try {
        const addresses = await Address.find({ userId: req.user._id });
        res.json(addresses);
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

const addMyAddress = async (req, res) => {
    try {
        const { type, line1, line2, city, pincode } = req.body;
        
        const address = new Address({
            userId: req.user._id,
            type,
            line1,
            line2,
            city,
            pincode
        });

        const createdAddress = await address.save();
        res.status(201).json(createdAddress);
    } catch (error) {
        res.status(400).json({ message: "Failed to create address", error: error.message });
    }
};

const updateMyAddress = async (req, res) => {
    try {
        const address = await Address.findById(req.params.id);

        if (!address) {
            return res.status(404).json({ message: "Address not found" });
        }

        if (address.userId.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: "Not authorized to update this address" });
        }

        const { type, line1, line2, city, pincode } = req.body;
        address.type = type || address.type;
        address.line1 = line1 || address.line1;
        address.line2 = line2 || address.line2;
        address.city = city || address.city;
        address.pincode = pincode || address.pincode;

        const updatedAddress = await address.save();
        res.json(updatedAddress);
    } catch (error) {
        res.status(400).json({ message: "Failed to update address", error: error.message });
    }
};

const deleteMyAddress = async (req, res) => {
    try {
        const address = await Address.findById(req.params.id);

        if (!address) {
            return res.status(404).json({ message: "Address not found" });
        }
        
        if (address.userId.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: "Not authorized to delete this address" });
        }

        await address.deleteOne();
        res.json({ message: "Address removed" });

    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

const getRecentBookingsForSupport = async (req, res) => {
    try {
        const recentBookings = await Booking.find({ customerId: req.user._id, status: 'Completed' })
            .sort({ bookingDate: -1 })
            .limit(2)
            .populate('items.serviceId', 'name');
        res.json(recentBookings);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

const createSupportTicket = async (req, res) => {
    try {
        const { topic, message } = req.body;
        const ticket = new SupportTicket({
            userId: req.user._id,
            topic,
            message
        });
        await ticket.save();
        res.status(201).json({ message: 'Support ticket submitted successfully.' });
    } catch (error) {
        console.error(error);
        res.status(400).json({ message: 'Failed to submit ticket', error: error.message });
    }
};

module.exports = { 
    getCustomerDashboard, 
    getMyBookings,
    createBooking, 
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
};