const mongoose = require('mongoose');

const GameSchema = new mongoose.Schema({
  user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  gameType:  { type: String, required: true },
  bet:       { type: Number, required: true },
  result:    { type: String, enum: ['win','lose'], required: true },
  gain:      { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Game', GameSchema);
