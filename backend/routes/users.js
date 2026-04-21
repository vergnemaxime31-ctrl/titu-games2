const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

// GET /api/users/leaderboard
router.get('/leaderboard', auth, async (req, res) => {
  try {
    const users = await User.find()
      .select('username coins')
      .sort({ coins: -1 })
      .limit(10);
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
