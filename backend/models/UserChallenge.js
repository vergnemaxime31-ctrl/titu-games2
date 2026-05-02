const mongoose = require('mongoose');

const userChallengeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  challengeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Challenge' },
  progress: { type: Number, default: 0 },
  completed: { type: Boolean, default: false },
  claimedAt: { type: Date, default: null }
});

module.exports = mongoose.model('UserChallenge', userChallengeSchema);
