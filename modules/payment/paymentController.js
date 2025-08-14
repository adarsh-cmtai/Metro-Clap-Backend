const Razorpay = require('razorpay');
const dotenv = require('dotenv');
const Booking = require('../../models/bookingModel');

dotenv.config();

const createOrder = async (req, res) => {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
        console.error("Razorpay Key ID or Key Secret is not defined in .env file.");
        return res.status(500).json({
            message: "Server configuration error. Payment gateway keys are missing."
        });
    }

    try {
        const instance = new Razorpay({
            key_id: keyId,
            key_secret: keySecret,
        });

        const { amount } = req.body;

        if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            return res.status(400).json({ message: 'A valid amount is required.' });
        }

        const options = {
            amount: Math.round(parseFloat(amount) * 100),
            currency: "INR",
            receipt: `receipt_order_${new Date().getTime()}`,
        };

        const order = await instance.orders.create(options);

        if (!order) {
            return res.status(500).json({ message: "Failed to create Razorpay order." });
        }

        res.json(order);
    } catch (error) {
        console.error("Error in createOrder:", error);
        return res.status(500).json({
            message: "An error occurred while creating the payment order.",
            error: error.message
        });
    }
};

const createRemainingOrder = async (req, res) => {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
     if (!keyId || !keySecret) {
        return res.status(500).json({ message: "Server configuration error." });
    }

    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({ message: "Booking not found" });
        }
        if (booking.customerId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Not authorized" });
        }
        if (booking.amountDue <= 0) {
            return res.status(400).json({ message: "No amount due for this booking." });
        }

        const instance = new Razorpay({ key_id: keyId, key_secret: keySecret });
        const options = {
            amount: Math.round(booking.amountDue * 100),
            currency: "INR",
            receipt: `receipt_booking_${booking.bookingId}`,
        };
        const order = await instance.orders.create(options);
        res.json(order);

    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
}

module.exports = { createOrder, createRemainingOrder };