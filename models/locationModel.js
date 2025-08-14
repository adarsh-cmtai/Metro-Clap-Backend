// --- START OF FILE models/locationModel.js ---

const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    city: {
        type: String,
        required: true,
        trim: true,
    },
    state: {
        type: String,
        required: true,
        trim: true,
    },
    pincode: {
        type: String,
        required: true,
        trim: true,
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

const Location = mongoose.model('Location', locationSchema);
module.exports = Location;

// --- END OF FILE models/locationModel.js ---