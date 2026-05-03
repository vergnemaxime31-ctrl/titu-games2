const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { Notification } = require('../models/Notification');

// GET /api/notifications — get my notifications (last 30, sorted by date desc)
router.get('/', auth, async (req, res) => {
  try {
    // Get notifications targeted to this user OR broadcast (userId = null)
    const notifs = await Notification.find({
      $or: [
        { userId: req.userId },
        { userId: null }
      ]
    })
      .sort({ createdAt: -1 })
      .limit(30);

    const unreadCount = await Notification.countDocuments({
      $or: [
        { userId: req.userId, isRead: false },
        { userId: null, isRead: false }
      ]
    });

    res.json({ notifications: notifs, unreadCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/notifications/read-all — mark all as read
router.patch('/read-all', auth, async (req, res) => {
  try {
    await Notification.updateMany(
      {
        $or: [
          { userId: req.userId, isRead: false },
          { userId: null, isRead: false }
        ]
      },
      { isRead: true }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/notifications/:id/read — mark one as read
router.patch('/:id/read', auth, async (req, res) => {
  try {
    const notif = await Notification.findById(req.params.id);
    if (!notif) return res.status(404).json({ error: 'Notification introuvable' });

    notif.isRead = true;
    await notif.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
