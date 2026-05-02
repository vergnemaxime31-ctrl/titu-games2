const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  type: { type: String, required: true },
  // ex: 'blackjack_wins', 'sports_wins', 'level_up', 'pvp_wins'
  target: { type: Number, required: true },
  rewardCredits: { type: Number, default: 0 },
  rewardItem: { type: String, default: null }, // effect name
  weekStart: { type: Date, required: true },
  weekEnd: { type: Date, required: true },
  active: { type: Boolean, default: true }
});

module.exports = mongoose.model('Challenge', challengeSchema);
