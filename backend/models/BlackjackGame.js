const mongoose = require('mongoose');

const blackjackGameSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  bet: {
    type: Number,
    required: true
  },
  playerCards: [String],
  dealerCards: [String],
  dealerHiddenCard: { type: String, default: '' },  // ← carte cachée du croupier
  deck: { type: Array, default: [] },                // ← deck persistant
  playerTotal: Number,
  dealerTotal: Number,
  result: {
    type: String,
    enum: ['win', 'lose', 'push', 'blackjack', 'ongoing', 'split'],
    default: 'ongoing'
  },
  creditsChange: Number,
  // Split fields
  splitActive: { type: Boolean, default: false },
  hand1Cards: { type: [String], default: [] },
  hand2Cards: { type: [String], default: [] },
  hand1Done: { type: Boolean, default: false },
  hand2Done: { type: Boolean, default: false },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('BlackjackGame', blackjackGameSchema);
