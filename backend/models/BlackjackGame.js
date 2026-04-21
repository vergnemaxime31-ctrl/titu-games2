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
    enum: ['win', 'lose', 'push', 'blackjack', 'ongoing'],
    default: 'ongoing'
  },
  creditsChange: Number,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('BlackjackGame', blackjackGameSchema);
