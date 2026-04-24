const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const PvpSession = require('../models/PvpSession');
const mongoose = require('mongoose');

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function cardValue(card) {
  if (['J', 'Q', 'K'].includes(card)) return 10;
  if (card === 'A') return 11;
  return parseInt(card);
}

function handTotal(cards) {
  let total = 0, aces = 0;
  for (const card of cards) {
    total += cardValue(card);
    if (card === 'A') aces++;
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function drawCard() {
  const cards = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  return cards[Math.floor(Math.random() * cards.length)];
}

function playHand(bet) {
  const playerCards = [drawCard(), drawCard()];
  const dealerCards = [drawCard(), drawCard()];

  if (handTotal(playerCards) === 21) {
    return { result: 'blackjack', creditsTransferred: Math.floor(bet * 2.5), playerCards, dealerCards };
  }

  let playerTotal = handTotal(playerCards);
  let dealerTotal = handTotal(dealerCards);

  while (playerTotal < 17) { playerCards.push(drawCard()); playerTotal = handTotal(playerCards); }
  while (dealerTotal < 17) { dealerCards.push(drawCard()); dealerTotal = handTotal(dealerCards); }

  if (playerTotal > 21) return { result: 'bust', creditsTransferred: -bet, playerCards, dealerCards };
  if (dealerTotal > 21 || playerTotal > dealerTotal) return { result: 'win', creditsTransferred: bet, playerCards, dealerCards };
  if (playerTotal === dealerTotal) return { result: 'push', creditsTransferred: 0, playerCards, dealerCards };
  return { result: 'lose', creditsTransferred: -bet, playerCards, dealerCards };
}

// GET /api/pvp/targets
router.get('/targets', auth, async (req, res) => {
  try {
    const today = todayString();
    const alreadyAttacked = await PvpSession.find({ attackerId: req.user.id, date: today }).select('targetId');
    const excludedIds = alreadyAttacked.map(s => s.targetId);
    excludedIds.push(req.user.id);

    const targets = await User.find({ _id: { $nin: excludedIds }, credits: { $gte: 500 } }).select('username credits');
    res.json(targets.map(t => ({ id: t._id, username: t.username, credits: t.credits, cap: Math.floor(t.credits * 0.1) })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pvp/start
router.post('/start', auth, async (req, res) => {
  try {
    const { targetId } = req.body;
    const today = todayString();

    const target = await User.findById(targetId);
    if (!target) return res.status(404).json({ error: 'Cible introuvable' });
    if (target.credits < 500) return res.status(400).json({ error: 'Cible non attaquable (< 500 crédits)' });

    const existing = await PvpSession.findOne({ attackerId: req.user.id, targetId, date: today });
    if (existing) return res.status(400).json({ error: 'Tu as déjà attaqué ce joueur aujourd\'hui' });

    const cap = Math.floor(target.credits * 0.1);
    const session = await PvpSession.create({ attackerId: req.user.id, targetId, date: today, cap });

    res.json({ sessionId: session._id, cap, targetUsername: target.username });
  } catch (err) {
    console.error('PVP START ERROR:', err.message, err.code);
    res.status(500).json({ error: err.message });
  }

});

// POST /api/pvp/session/:id/hand
router.post('/session/:id/hand', auth, async (req, res) => {
  try {
    const { bet } = req.body;
    const pvpSession = await PvpSession.findById(req.params.id);

    if (!pvpSession) return res.status(404).json({ error: 'Session introuvable' });
    if (String(pvpSession.attackerId) !== String(req.user.id)) return res.status(403).json({ error: 'Pas ta session' });
    if (pvpSession.status === 'closed') return res.status(400).json({ error: 'Session fermée' });

    const capRestant = pvpSession.cap - Math.abs(pvpSession.netDifference);
    if (bet > capRestant) return res.status(400).json({ error: `Mise trop élevée, cap restant : ${capRestant}` });

    const attacker = await User.findById(pvpSession.attackerId);
    const target = await User.findById(pvpSession.targetId);
    if (!attacker || !target) throw new Error('Joueur introuvable');

    const hand = playHand(bet);
    const { creditsTransferred } = hand;

    if (creditsTransferred > 0 && target.credits < creditsTransferred)
      return res.status(400).json({ error: 'La cible n\'a plus assez de crédits' });
    if (creditsTransferred < 0 && attacker.credits < Math.abs(creditsTransferred))
      return res.status(400).json({ error: 'Tu n\'as pas assez de crédits' });

    await User.updateOne({ _id: pvpSession.attackerId }, { $inc: { credits: creditsTransferred } });
    await User.updateOne({ _id: pvpSession.targetId }, { $inc: { credits: -creditsTransferred } });

    pvpSession.hands.push({ bet, result: hand.result, creditsTransferred });
    pvpSession.netDifference += creditsTransferred;

    const newCapRestant = pvpSession.cap - Math.abs(pvpSession.netDifference);
    let sessionClosed = false;
    if (newCapRestant <= 0) {
      pvpSession.status = 'closed';
      pvpSession.closedAt = new Date();
      sessionClosed = true;
    }

    await pvpSession.save();

    const notifMessage = creditsTransferred > 0
      ? `⚔️ ${attacker.username} t'a attaqué et t'a pris ${creditsTransferred} crédits !`
      : creditsTransferred < 0
        ? `⚔️ ${attacker.username} t'a attaqué mais a perdu ${Math.abs(creditsTransferred)} crédits !`
        : `⚔️ ${attacker.username} t'a attaqué, égalité !`;

    await User.updateOne({ _id: pvpSession.targetId }, { $push: { notifications: { message: notifMessage } } });

    res.json({ result: hand.result, playerCards: hand.playerCards, dealerCards: hand.dealerCards, creditsTransferred, netDifference: pvpSession.netDifference, capRestant: newCapRestant, sessionClosed });
  } catch (err) {
    console.error('PVP HAND ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
});


// POST /api/pvp/session/:id/quit
router.post('/session/:id/quit', auth, async (req, res) => {
  try {
    const pvpSession = await PvpSession.findById(req.params.id);
    if (!pvpSession) return res.status(404).json({ error: 'Session introuvable' });
    if (String(pvpSession.attackerId) !== String(req.user.id)) return res.status(403).json({ error: 'Pas ta session' });

    pvpSession.status = 'closed';
    pvpSession.closedAt = new Date();
    await pvpSession.save();

    res.json({ message: 'Session fermée', netDifference: pvpSession.netDifference, handsPlayed: pvpSession.hands.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pvp/notifications
router.get('/notifications', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const unread = user.notifications.filter(n => !n.read);
    await User.updateOne({ _id: req.user.id }, { $set: { 'notifications.$[].read': true } });
    res.json(unread);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
