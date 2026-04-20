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
  playerCards: [String],   // Ex: ["K♥", "7♦"]
  dealerCards: [String],   // Ex: ["A♠", "?"]
  playerTotal: Number,
  dealerTotal: Number,
  result: {
    type: String,
    enum: ['win', 'lose', 'push', 'blackjack', 'ongoing'],
    default: 'ongoing'
  },
  creditsChange: Number,   // +100 ou -50
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('BlackjackGame', blackjackGameSchema);
