const mongoose = require('mongoose');

const sportBetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  matchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Match',
    required: true
  },
  prediction: {
    type: String,
    enum: ['1', 'N', '2'],    // 1=domicile, N=nul, 2=extérieur
    required: true
  },
  amount: {
    type: Number,
    required: true             // Crédits misés
  },
  odds: {
    type: Number,
    required: true             // Cote au moment du pari
  },
  status: {
    type: String,
    enum: ['pending', 'won', 'lost'],
    default: 'pending'
  },
  creditsChange: {
    type: Number,
    default: null              // Calculé quand le match est terminé
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SportBet', sportBetSchema);
