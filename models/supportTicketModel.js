const mongoose = require('mongoose');

const replySchema = new mongoose.Schema({
    sender: {
        type: String,
        enum: ['admin', 'customer'],
        required: true,
    },
    message: {
        type: String,
        required: true,
        trim: true,
    }
}, { timestamps: true });

const supportTicketSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    topic: {
        type: String,
        enum: ['general', 'payment', 'booking', 'feedback'],
        required: true,
    },
    message: {
        type: String,
        required: true,
        trim: true,
    },
    status: {
        type: String,
        enum: ['Open', 'In Progress', 'Closed'],
        default: 'Open',
    },
    replies: [replySchema]
}, { timestamps: true });

const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);
module.exports = SupportTicket;