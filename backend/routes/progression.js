const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const { getLevelUpCost, getDailyReward } = require('../services/progressionService');

// GET /api/progression/status
router.get('/status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const costNext = getLevelUpCost(user.level);
    const dailyAmount = getDailyReward(user.level);

    // Vérifier si le revenu quotidien est disponible
    const now = new Date();
    const lastReward = user.lastDailyReward;
    const dailyAvailable = !lastReward || 
      new Date(lastReward).toDateString() !== now.toDateString();

    res.json({
      level: user.level,
      credits: user.credits,
      costNextLevel: costNext,
      canLevelUp: user.credits >= costNext,
      dailyReward: dailyAmount,
      dailyAvailable
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/progression/levelup
router.post('/levelup', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const cost = getLevelUpCost(user.level);

    if (user.credits < cost) {
      return res.status(400).json({ error: 'Crédits insuffisants' });
    }

    user.credits -= cost;
    user.level += 1;
    await user.save();

    res.json({
      success: true,
      newLevel: user.level,
      creditsRemaining: user.credits,
      message: `Félicitations ! Vous êtes niveau ${user.level}`
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/progression/daily
router.post('/daily', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const now = new Date();

    if (user.lastDailyReward && 
        new Date(user.lastDailyReward).toDateString() === now.toDateString()) {
      return res.status(400).json({ error: 'Revenu déjà réclamé aujourd\'hui' });
    }

    const reward = getDailyReward(user.level);
    user.credits += reward;
    user.lastDailyReward = now;
    await user.save();

    res.json({
      success: true,
      reward,
      newCredits: user.credits
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
