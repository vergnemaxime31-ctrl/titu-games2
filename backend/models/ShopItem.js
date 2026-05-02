const mongoose = require('mongoose');

const shopItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  effect: { type: String, required: true }, 
  // ex: 'attack_boost', 'shield_24h', 'double_daily'
  price: { type: Number, required: true },
  active: { type: Boolean, default: true }
});

module.exports = mongoose.model('ShopItem', shopItemSchema);
