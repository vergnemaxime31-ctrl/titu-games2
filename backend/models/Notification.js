const mongoose = require('mongoose');

const NOTIF_TYPES = {
  BLACKJACK_ATTACKED: 'blackjack_attacked',
  BLACKJACK_DEFENDED: 'blackjack_defended',
  BET_NEW_CUSTOM: 'bet_new_custom',
  BET_RESULT_WIN: 'bet_result_win',
  BET_RESULT_LOSE: 'bet_result_lose',
  ADMIN_ANNOUNCEMENT: 'admin_announcement'
};

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // null = broadcast to all
  type: { type: String, required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  isRead: { type: Boolean, default: false },
  metadata: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now }
});

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = { Notification, NOTIF_TYPES };
