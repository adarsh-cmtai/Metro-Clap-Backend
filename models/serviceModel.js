// --- START OF FILE models/serviceModel.js ---

const mongoose = require('mongoose');

const faqSchema = new mongoose.Schema({
    question: { type: String, required: true },
    answer: { type: String, required: true }
}, { _id: false });

const howItWorksStepSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true }
}, { _id: false });

const serviceSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    tagline: { type: String },
    price: { type: Number, required: true }, // Standardized name
    duration: { type: String },
    imageUrl: { type: String },
    
    inclusions: [String],
    exclusions: [String],
    
    faqs: [faqSchema],
    howItWorks: [howItWorksStepSchema],

    isActive: { type: Boolean, default: true },
}, { timestamps: true });

const Service = mongoose.model('Service', serviceSchema);
module.exports = Service;

// --- END OF FILE models/serviceModel.js ---