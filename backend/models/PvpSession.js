const mongoose = require('mongoose');

const HandSchema = new mongoose.Schema({
  bet: Number,
  result: { 
    type: String, 
    enum: ['win', 'lose', 'blackjack', 'push', 'bust'] 
  },
  creditsTransferred: Number, // + = A a gagné, - = A a perdu
}, { _id: false });

const PvpSessionSchema = new mongoose.Schema({
  attackerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  targetId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  date: { 
    type: String, // "YYYY-MM-DD"
    required: true 
  },
  cap: { 
    type: Number, 
    required: true // 10% des crédits de B au démarrage
  },
  netDifference: { 
    type: Number, 
    default: 0 // + = A a volé à B, - = A a perdu vers B
  },
  status: { 
    type: String, 
    enum: ['active', 'closed'], 
    default: 'active' 
  },
  hands: [HandSchema],
  createdAt: { type: Date, default: Date.now },
  closedAt: { type: Date }
});

// Index pour vérifier rapidement "A a-t-il déjà attaqué B aujourd'hui ?"
PvpSessionSchema.index({ attackerId: 1, targetId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('PvpSession', PvpSessionSchema);
