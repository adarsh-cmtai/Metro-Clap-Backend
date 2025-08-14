// --- START OF FILE models/partnerApplicationModel.js ---

const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({ name: String, mobile: String, email: String }, { _id: false });
const addressSchema = new mongoose.Schema({ pin: String, street: String, block: String, house: String, apartment: String, landmark: String, district: String, state: String, country: String }, { _id: false });

const partnerApplicationSchema = new mongoose.Schema({
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    
    services: [String],
    city: String,
    
    companyName: String,
    aadhaarNo: String,
    gstNo: String,
    
    contacts: [contactSchema],
    addresses: [addressSchema],
    servicePincodes: [String],
    
    documents: {
        photoUrl: String,
        aadhaarFrontUrl: String,
        aadhaarBackUrl: String,
        gstCertificateUrl: String,
    },
}, { timestamps: true });

const PartnerApplication = mongoose.model('PartnerApplication', partnerApplicationSchema);
module.exports = PartnerApplication;

// --- END OF FILE models/partnerApplicationModel.js ---