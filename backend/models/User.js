const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  credits: {
    type: Number,
    default: 1000
  },
  avatar: {
    type: String,
    default: ''
  },
  notifications: [{
    message: String,
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  level: { type: Number, default: 1 },
  lastDailyReward: { type: Date, default: null },
  inventory: [
    {
      itemId: { type: String },
      name: { type: String },
      effect: { type: String },
      quantity: { type: Number, default: 1 }
    }
  ],
  shieldUntil: { type: Date, default: null },
  doubleDailyUntil: { type: Date, default: null },
  attackBoostUntil: { type: Date, default: null }

});


module.exports = mongoose.model('User', UserSchema);
