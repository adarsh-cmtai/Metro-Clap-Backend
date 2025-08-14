const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const contactSchema = new mongoose.Schema({ name: String, mobile: String, email: String }, { _id: false });
const addressSchema = new mongoose.Schema({ pin: String, street: String, block: String, house: String, apartment: String, landmark: String, district: String, state: String, country: String }, { _id: false });

const bankDetailsSchema = new mongoose.Schema({
    accountHolderName: { type: String, trim: true },
    accountNumber: { type: String, trim: true },
    ifscCode: { type: String, trim: true },
    vpa: { type: String, trim: true },
    fundAccountId: { type: String, trim: true }
}, { _id: false });

const partnerProfileSchema = new mongoose.Schema({
    bio: { type: String, trim: true },
    skills: [{ type: String }],
    serviceablePincodes: [{ type: String, trim: true }],
    
    companyName: { type: String, trim: true },
    aadhaarNo: { type: String, trim: true },
    gstNo: { type: String, trim: true },
    
    contacts: [contactSchema],
    addresses: [addressSchema],
    
    contactId: { type: String, trim: true },

    documents: {
        photoUrl: String,
        aadhaarFrontUrl: String,
        aadhaarBackUrl: String,
        gstCertificateUrl: String,
        aadhaar: { status: { type: String, enum: ['Pending', 'Verified', 'Rejected'], default: 'Pending' } },
        bankAccount: { status: { type: String, enum: ['Pending', 'Verified', 'Rejected'], default: 'Pending' } },
        skillCertificate: { status: { type: String, enum: ['Pending', 'Verified', 'Rejected'], default: 'Pending' } },
    }
}, { _id: false });

const userSchema = new mongoose.Schema(
  {
    mobileNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ['customer', 'partner', 'admin'],
      required: true,
    },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Suspended'],
      default: 'Pending'
    },
    otp: {
      type: String,
    },
    otpExpiry: {
      type: Date,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    name: { type: String, default: 'New User' },
    email: { type: String, trim: true, sparse: true },
    password: { type: String, select: false },
    avatarUrl: { type: String, default: 'default-avatar.png' },
    rating: { type: Number, default: 0 },
    availability: {
      type: Map,
      of: [Number],
      default: {},
    },
    bankDetails: bankDetailsSchema,
    partnerProfile: partnerProfileSchema,
  },
  
  {
    timestamps: true,
  }
);

userSchema.pre('save', async function (next) {
    if (!this.isModified('password') || !this.password) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
    if (!this.password) return false;
    return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
module.exports = User;