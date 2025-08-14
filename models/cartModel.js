// --- START OF FILE models/cartModel.js ---

const mongoose = require('mongoose');

const selectedOptionSchema = new mongoose.Schema({
    groupName: String,
    optionName: String,
    price: Number
}, { _id: false });

const cartItemSchema = new mongoose.Schema({
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    quantity: { type: Number, required: true, default: 1 },
    selectedOptions: [selectedOptionSchema],
    totalPrice: { type: Number, required: true }
}, { _id: false });

const cartSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  items: [cartItemSchema],
}, { timestamps: true });

const Cart = mongoose.model('Cart', cartSchema);
module.exports = Cart;

// --- END OF FILE models/cartModel.js ---