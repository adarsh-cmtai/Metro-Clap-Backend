// --- START OF FILE models/subServiceModel.js ---

const mongoose = require('mongoose');

const subServiceSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    duration: { type: Number, required: true },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

const SubService = mongoose.model('SubService', subServiceSchema);
module.exports = SubService;

// --- END OF FILE models/subServiceModel.js ---