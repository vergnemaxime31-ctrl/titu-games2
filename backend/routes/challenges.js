const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Challenge = require('../models/Challenge');
const UserChallenge = require('../models/UserChallenge');
const User = require('../models/User');
const ShopItem = require('../models/ShopItem');

// GET /api/challenges
router.get('/', auth, async (req, res) => {
  try {
    const now = new Date();
    const challenges = await Challenge.find({
      active: true,
      weekStart: { $lte: now },
      weekEnd: { $gte: now }
    });

    const result = await Promise.all(challenges.map(async (c) => {
      const uc = await UserChallenge.findOne({
        userId: req.userId,
        challengeId: c._id
      });
      return {
        ...c.toObject(),
        progress: uc ? uc.progress : 0,
        completed: uc ? uc.completed : false,
        claimed: uc ? !!uc.claimedAt : false
      };
    }));

    res.json({ challenges: result });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/challenges/claim/:id
router.post('/claim/:id', auth, async (req, res) => {
  try {
    const uc = await UserChallenge.findOne({
      userId: req.userId,
      challengeId: req.params.id
    });

    if (!uc || !uc.completed) {
      return res.status(400).json({ error: 'Défi non complété' });
    }
    if (uc.claimedAt) {
      return res.status(400).json({ error: 'Récompense déjà réclamée' });
    }

    const challenge = await Challenge.findById(req.params.id);
    const user = await User.findById(req.userId);

    if (challenge.rewardCredits > 0) {
      user.credits += challenge.rewardCredits;
    }
    if (challenge.rewardItem) {
      const existing = user.inventory.find(i => i.effect === challenge.rewardItem);
      if (existing) {
        existing.quantity += 1;
      } else {
        user.inventory.push({
          itemId: challenge.rewardItem,
          name: challenge.rewardItem,
          effect: challenge.rewardItem,
          quantity: 1
        });
      }
    }

    uc.claimedAt = new Date();
    await uc.save();
    await user.save();

    res.json({ success: true, newCredits: user.credits });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/admin/challenges (admin seulement)
router.post('/admin/create', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user.isAdmin) return res.status(403).json({ error: 'Interdit' });

    const { title, description, type, target, rewardCredits, rewardItem, weekStart, weekEnd } = req.body;
    const challenge = await Challenge.create({
      title, description, type, target,
      rewardCredits: rewardCredits || 0,
      rewardItem: rewardItem || null,
      weekStart: new Date(weekStart),
      weekEnd: new Date(weekEnd)
    });

    res.json({ success: true, challenge });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
