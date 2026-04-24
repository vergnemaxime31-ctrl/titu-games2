const express = require('express');
const router = express.Router();
const User = require('../models/User');
const SportBet = require('../models/SportBet');
const CustomBet = require('../models/CustomBet');
const auth = require('../middleware/auth');

// GET /api/users/leaderboard
router.get('/leaderboard', auth, async (req, res) => {
  try {
    const users = await User.find()
      .select('username credits')
      .sort({ credits: -1 })
      .limit(10);
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/users/me
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/stats/bets-count', auth, async (req, res) => {
  try {
    const sportBets = await SportBet.countDocuments();
    const customBets = await CustomBet.countDocuments();
    res.json({ total: sportBets + customBets });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

