const Cart = require('../../models/cartModel');
const Service = require('../../models/serviceModel');
const SubService = require('../../models/subServiceModel');

const getCart = async (req, res) => {
    try {
        let cart = await Cart.findOne({ userId: req.user._id }).populate({
            path: 'items.serviceId',
            select: 'name imageUrl'
        });
        if (!cart) {
            cart = await Cart.create({ userId: req.user._id, items: [] });
        }
        res.json(cart);
    } catch (error) { res.status(500).json({ message: "Server Error" }); }
};

const addToCart = async (req, res) => {
    try {
        const { items: itemsToAdd } = req.body; 
        if (!itemsToAdd || !Array.isArray(itemsToAdd)) {
            return res.status(400).json({ message: "Invalid request body. 'items' array is required." });
        }

        const cart = await Cart.findOneAndUpdate(
            { userId: req.user._id },
            { $setOnInsert: { userId: req.user._id } },
            { upsert: true, new: true }
        );

        for (const item of itemsToAdd) {
            const existingItemIndex = cart.items.findIndex(i => 
                i.serviceId.toString() === item.serviceId &&
                JSON.stringify(i.selectedOptions) === JSON.stringify(item.selectedOptions || [])
            );

            if (existingItemIndex > -1) {
                cart.items[existingItemIndex].quantity += item.quantity;
                cart.items[existingItemIndex].totalPrice = cart.items[existingItemIndex].quantity * (item.totalPrice / item.quantity);
            } else {
                cart.items.push(item);
            }
        }
        
        await cart.save();
        
        const updatedCart = await Cart.findOne({ userId: req.user._id }).populate({
            path: 'items.serviceId',
            select: 'name imageUrl'
        });

        res.status(200).json(updatedCart);
    } catch (error) { 
        res.status(400).json({ message: "Failed to add to cart", error: error.message }); 
    }
};

const removeFromCart = async (req, res) => {
    try {
        const { itemId } = req.params;
        const cart = await Cart.findOneAndUpdate(
            { userId: req.user._id },
            { $pull: { items: { _id: itemId } } },
            { new: true }
        ).populate('items.serviceId');
        res.json(cart);
    } catch (error) { res.status(500).json({ message: "Server Error" }); }
};

module.exports = { getCart, addToCart, removeFromCart };