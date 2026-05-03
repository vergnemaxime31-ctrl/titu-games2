const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const { sendAnnouncement } = require('../services/notificationService');

// Admin middleware — checks user role
async function adminOnly(req, res, next) {
  try {
    const user = await User.findById(req.userId || req.user?.id);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès interdit' });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/admin/notifications/announce — send announcement to ALL users
router.post('/notifications/announce', auth, adminOnly, async (req, res) => {
  try {
    const { title, message } = req.body;
    if (!title || !message) {
      return res.status(400).json({ error: 'Titre et message requis' });
    }

    await sendAnnouncement({ title, message });
    res.json({ success: true, message: 'Annonce envoyée à tous les utilisateurs' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
