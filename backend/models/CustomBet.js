const mongoose = require('mongoose');

const customBetSchema = new mongoose.Schema({
  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  question: {
    type: String,
    required: true
  },
  odds: {
    type: Number,
    required: true
  },
  creatorAmount: {
    type: Number,
    required: true
  },
  opponentAmount: {
    type: Number,
    required: true  // calculé auto : creatorAmount * odds
  },
  status: {
    type: String,
    enum: ['open', 'matched', 'pending_result', 'resolved', 'cancelled'],
    default: 'open'
  },
  acceptedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  expiresAt: {
    type: Date,
    required: true
  },
  result: {
    type: String,
    enum: ['creator_wins', 'acceptor_wins', null],
    default: null
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CustomBet', customBetSchema);
