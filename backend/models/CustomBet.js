const mongoose = require('mongoose');

const customBetSchema = new mongoose.Schema({
  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  question: {
    type: String,
    required: true             // "Mbappé va se marier cet été ?"
  },
  odds: {
    type: Number,
    required: true             // 2 (= 2 contre 1)
  },
  amount: {
    type: Number,
    required: true             // Crédits misés par le créateur
  },
  expiresAt: {
    type: Date,
    required: true             // Date limite pour accepter
  },
  status: {
    type: String,
    enum: ['open', 'accepted', 'resolved', 'expired', 'cancelled'],
    default: 'open'
  },
  acceptedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null              // Joueur qui accepte le pari
  },
  result: {
    type: String,
    enum: ['creator_wins', 'acceptor_wins', null],
    default: null
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',              // Admin qui valide le résultat
    default: null
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CustomBet', customBetSchema);
