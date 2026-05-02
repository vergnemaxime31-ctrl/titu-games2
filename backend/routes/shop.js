const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const ShopItem = require('../models/ShopItem');

// GET /api/shop
router.get('/', auth, async (req, res) => {
  try {
    const items = await ShopItem.find({ active: true });
    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/shop/buy
router.post('/buy', auth, async (req, res) => {
  try {
    const { itemId } = req.body;
    const user = await User.findById(req.userId);
    const item = await ShopItem.findById(itemId);

    if (!item) return res.status(404).json({ error: 'Item introuvable' });
    if (user.credits < item.price) {
      return res.status(400).json({ error: 'Crédits insuffisants' });
    }

    user.credits -= item.price;

    // Ajouter à l'inventaire
    const existing = user.inventory.find(i => i.itemId === itemId);
    if (existing) {
      existing.quantity += 1;
    } else {
      user.inventory.push({
        itemId: item._id.toString(),
        name: item.name,
        effect: item.effect,
        quantity: 1
      });
    }

    await user.save();
    res.json({ success: true, newCredits: user.credits, inventory: user.inventory });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/shop/use
router.post('/use', auth, async (req, res) => {
  try {
    const { itemId } = req.body;
    const user = await User.findById(req.userId);
    const invItem = user.inventory.find(i => i.itemId === itemId);

    if (!invItem || invItem.quantity < 1) {
      return res.status(400).json({ error: 'Item non disponible' });
    }

    // Appliquer l'effet selon le type
    let message = '';
    if (invItem.effect === 'shield_24h') {
      user.shieldUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
      message = 'Bouclier activé pour 24h';
    } else if (invItem.effect === 'double_daily') {
      user.doubleDailyUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
      message = 'Revenu doublé pour demain';
    } else if (invItem.effect === 'attack_boost') {
      user.attackBoostUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
      message = 'Attaque boostée à 20% pour 24h';
    }

    invItem.quantity -= 1;
    if (invItem.quantity === 0) {
      user.inventory = user.inventory.filter(i => i.itemId !== itemId);
    }

    await user.save();
    res.json({ success: true, message });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
