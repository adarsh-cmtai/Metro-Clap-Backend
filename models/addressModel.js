// --- START OF FILE models/addressModel.js ---

const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    type: {
        type: String,
        enum: ['Home', 'Office', 'Other'],
        required: true,
    },
    line1: {
        type: String,
        required: [true, 'Please provide the first line of the address'],
        trim: true,
    },
    line2: {
        type: String,
        required: [true, 'Please provide the second line of the address'],
        trim: true,
    },
    city: {
        type: String,
        required: [true, 'Please provide the city'],
        trim: true,
    },
    pincode: {
        type: String,
        required: [true, 'Please provide the pincode'],
        trim: true,
        maxlength: 6,
    }
}, { timestamps: true });

const Address = mongoose.model('Address', addressSchema);
module.exports = Address;

// --- END OF FILE models/addressModel.js ---