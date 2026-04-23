const mongoose = require('mongoose');

const customBetVoteSchema = new mongoose.Schema({
  betId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CustomBet',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  vote: {
    type: String,
    enum: ['creator_wins', 'acceptor_wins'],
    required: true
  },
  createdAt: { type: Date, default: Date.now }
});

// Un user ne peut voter qu'une fois par pari
customBetVoteSchema.index({ betId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('CustomBetVote', customBetVoteSchema);
