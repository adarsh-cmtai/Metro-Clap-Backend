const mongoose = require('mongoose');

const selectedOptionSchema = new mongoose.Schema({
    groupName: String,
    optionName: String,
    price: Number
}, { _id: false });

const rejectionSchema = new mongoose.Schema({
    partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: { type: String, required: true }
}, { _id: false });

const cartItemSchema = new mongoose.Schema({
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    serviceName: { type: String, required: true },
    quantity: { type: Number, required: true, default: 1 },
    selectedOptions: [selectedOptionSchema],
    totalPrice: { type: Number, required: true },
    partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    status: { 
        type: String, 
        enum: ['Pending Assignment', 'PendingPartnerConfirmation', 'Assigned', 'InProgress', 'CompletedByPartner', 'Completed'], 
        default: 'Pending Assignment' 
    },
    payoutStatus: {
        type: String,
        enum: ['Pending', 'Paid', 'Failed'],
        default: 'Pending'
    },
    payoutDetails: {
        transactionId: String,
        payoutDate: Date
    },
    rejectedBy: [rejectionSchema]
});

const bookingSchema = new mongoose.Schema(
  {
    bookingId: { type: String, required: true, unique: true },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    items: [cartItemSchema],
    bookingDate: {
      type: Date,
      required: true,
    },
    slotTime: {
        type: String,
        required: true,
    },
    status: {
      type: String,
      enum: ['Pending', 'Searching', 'Confirmed', 'Partially Assigned', 'Completed', 'Cancelled'],
      default: 'Pending',
      required: true,
    },
    totalPrice: {
      type: Number,
      required: true,
    },
    amountPaid: {
      type: Number,
      required: true,
      default: 0,
    },
    amountDue: {
        type: Number,
        required: true,
        default: 0,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    paymentMethod: {
        type: String,
        enum: ['Online', 'COD'],
        required: true,
    },
    paymentStatus: {
        type: String,
        enum: ['Pending', 'Paid', 'Partially Paid', 'Failed'],
        default: 'Pending',
        required: true
    },
    paymentDetails: {
        orderId: String,
        paymentId: String,
        signature: String,
    },
    bookingOTP: {
        type: String,
    },
    broadcastedTo: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    assignmentDeadline: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;