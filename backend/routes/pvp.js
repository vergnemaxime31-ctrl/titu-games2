const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const PvpSession = require('../models/PvpSession');
const mongoose = require('mongoose');

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

// ============ BLACKJACK HELPERS (PvP) ============

function createDeck(numDecks = 6) {
  const suits = ['♠', '♥', '♦', '♣'];
  const values = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  const deck = [];
  for (let d = 0; d < numDecks; d++)
    for (const suit of suits)
      for (const value of values)
        deck.push(`${value}${suit}`);
  // Shuffle (Fisher-Yates)
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function getCardValue(card) {
  const value = card.slice(0, -1);
  if (['J', 'Q', 'K'].includes(value)) return 10;
  if (value === 'A') return 11;
  return parseInt(value);
}

function calculateTotal(cards) {
  let total = 0, aces = 0;
  for (const card of cards) {
    if (card === '?') continue;
    total += getCardValue(card);
    if (card.startsWith('A')) aces++;
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function isNaturalBlackjack(cards) {
  if (cards.length !== 2) return false;
  const v1 = cards[0].slice(0, -1);
  const v2 = cards[1].slice(0, -1);
  const hasAce = (v1 === 'A' || v2 === 'A');
  const hasTenValue = (['10','J','Q','K'].includes(v1) || ['10','J','Q','K'].includes(v2));
  return hasAce && hasTenValue;
}

function checkBlackjack(cards) {
  return isNaturalBlackjack(cards);
}

/**
 * Resolve the hand: dealer draws to 17, determine result, apply credits.
 * Returns the result object (does NOT send response).
 */
async function resolveHand(pvpSession, session) {
  const hand = pvpSession.currentHand;
  const deck = [...hand.deck];
  const dealerCards = [...hand.dealerCards];
  const playerCards = [...hand.playerCards];
  const bet = hand.bet;

  // Dealer draws to 17
  let dealerTotal = calculateTotal(dealerCards);
  while (dealerTotal < 17) {
    dealerCards.push(deck.pop());
    dealerTotal = calculateTotal(dealerCards);
  }

  const playerTotal = calculateTotal(playerCards);

  let result, creditsTransferred;
  if (playerTotal > 21) {
    result = 'bust';
    creditsTransferred = -bet;
  } else if (isNaturalBlackjack(playerCards)) {
    // Blackjack naturel = toujours payé 2.5x, peu importe le croupier
    result = 'blackjack';
    creditsTransferred = Math.floor(bet * 1.5);
  } else if (dealerTotal > 21) {
    result = 'win';
    creditsTransferred = bet;
  } else if (playerTotal > dealerTotal) {
    result = 'win';
    creditsTransferred = bet;
  } else if (playerTotal === dealerTotal) {
    result = 'push';
    creditsTransferred = 0;
  } else {
    result = 'lose';
    creditsTransferred = -bet;
  }

  // Apply credits atomically using $inc
  const attacker = await User.findById(pvpSession.attackerId);
  const target = await User.findById(pvpSession.targetId);
  if (!attacker || !target) throw new Error('Joueur introuvable');

  // Validate sufficient credits before transfer
  if (creditsTransferred > 0 && target.credits < creditsTransferred) {
    // Target can't pay full amount, cap it
    creditsTransferred = target.credits;
  }
  if (creditsTransferred < 0 && attacker.credits < Math.abs(creditsTransferred)) {
    // Attacker can't pay full amount, cap it
    creditsTransferred = -attacker.credits;
  }

  if (creditsTransferred !== 0) {
    await User.updateOne({ _id: pvpSession.attackerId }, { $inc: { credits: creditsTransferred } });
    await User.updateOne({ _id: pvpSession.targetId }, { $inc: { credits: -creditsTransferred } });
  }

  // Record hand in history
  pvpSession.hands.push({ bet, result, creditsTransferred });
  pvpSession.netDifference += creditsTransferred;

  // Check if cap reached
  const newCapRestant = pvpSession.cap - Math.abs(pvpSession.netDifference);
  let sessionClosed = false;
  if (newCapRestant <= 0) {
    pvpSession.status = 'closed';
    pvpSession.closedAt = new Date();
    sessionClosed = true;
  }

  // Clear current hand
  pvpSession.currentHand = null;
  pvpSession.markModified('currentHand');
  await pvpSession.save();

  // Notification to target
  const notifMessage = creditsTransferred > 0
    ? `⚔️ ${attacker.username} t'a attaqué et t'a pris ${creditsTransferred} crédits !`
    : creditsTransferred < 0
      ? `⚔️ ${attacker.username} t'a attaqué mais a perdu ${Math.abs(creditsTransferred)} crédits !`
      : `⚔️ ${attacker.username} t'a attaqué, égalité !`;
  await User.updateOne({ _id: pvpSession.targetId }, { $push: { notifications: { message: notifMessage } } });

  // Reload attacker credits for response
  const updatedAttacker = await User.findById(pvpSession.attackerId).select('credits');

  return {
    result,
    playerCards,
    playerTotal,
    dealerCards,
    dealerTotal,
    creditsTransferred,
    netDifference: pvpSession.netDifference,
    capRestant: Math.max(0, newCapRestant),
    sessionClosed,
    attackerCredits: updatedAttacker.credits
  };
}

// ============ ROUTES ============

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

// POST /api/pvp/session/:id/deal — distribue 2 cartes joueur + 2 cartes dealer
router.post('/session/:id/deal', auth, async (req, res) => {
  try {
    const { bet } = req.body;
    const pvpSession = await PvpSession.findById(req.params.id);

    if (!pvpSession) return res.status(404).json({ error: 'Session introuvable' });
    if (String(pvpSession.attackerId) !== String(req.user.id)) return res.status(403).json({ error: 'Pas ta session' });
    if (pvpSession.status === 'closed') return res.status(400).json({ error: 'Session fermée' });
    if (pvpSession.currentHand) return res.status(400).json({ error: 'Une main est déjà en cours, terminez-la d\'abord' });

    if (!bet || bet <= 0) return res.status(400).json({ error: 'Mise invalide' });

    const capRestant = pvpSession.cap - Math.abs(pvpSession.netDifference);
    if (bet > capRestant) return res.status(400).json({ error: `Mise trop élevée, cap restant : ${capRestant}` });

    // Validate attacker has enough credits
    const attacker = await User.findById(pvpSession.attackerId);
    if (!attacker) return res.status(404).json({ error: 'Joueur introuvable' });
    if (attacker.credits < bet) return res.status(400).json({ error: 'Tu n\'as pas assez de crédits' });

    // Create deck and deal
    const deck = createDeck();
    const playerCards = [deck.pop(), deck.pop()];
    const dealerCard1 = deck.pop();
    const dealerHiddenCard = deck.pop();
    const dealerCards = [dealerCard1, dealerHiddenCard];

    const playerTotal = calculateTotal(playerCards);
    const isBlackjack = isNaturalBlackjack(playerCards);

    // Store hand state server-side
    pvpSession.currentHand = {
      bet,
      deck,
      playerCards,
      dealerCards,
      dealerHiddenCard,
      phase: 'playing'
    };
    pvpSession.markModified('currentHand');
    await pvpSession.save();

    // If player has blackjack, resolve immediately
    if (isBlackjack) {
      const result = await resolveHand(pvpSession);
      return res.json({
        phase: 'ended',
        ...result
      });
    }

    // Return initial state — NEVER send the hidden card
    res.json({
      phase: 'playing',
      playerCards,
      playerTotal,
      dealerVisibleCard: dealerCard1,
      dealerTotal: getCardValue(dealerCard1)
    });
  } catch (err) {
    console.error('PVP DEAL ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pvp/session/:id/hit — ajoute une carte au joueur
router.post('/session/:id/hit', auth, async (req, res) => {
  try {
    const pvpSession = await PvpSession.findById(req.params.id);

    if (!pvpSession) return res.status(404).json({ error: 'Session introuvable' });
    if (String(pvpSession.attackerId) !== String(req.user.id)) return res.status(403).json({ error: 'Pas ta session' });
    if (pvpSession.status === 'closed') return res.status(400).json({ error: 'Session fermée' });
    if (!pvpSession.currentHand) return res.status(400).json({ error: 'Aucune main en cours. Faites /deal d\'abord' });
    if (pvpSession.currentHand.phase !== 'playing') return res.status(400).json({ error: 'Main déjà terminée' });

    const hand = pvpSession.currentHand;
    const deck = [...hand.deck];
    const playerCards = [...hand.playerCards];

    // Draw a card
    const newCard = deck.pop();
    playerCards.push(newCard);

    const playerTotal = calculateTotal(playerCards);

    // Update state
    pvpSession.currentHand.deck = deck;
    pvpSession.currentHand.playerCards = playerCards;
    pvpSession.markModified('currentHand');
    await pvpSession.save();

    // Check bust
    if (playerTotal > 21) {
      const result = await resolveHand(pvpSession);
      return res.json({
        phase: 'ended',
        ...result
      });
    }

    res.json({
      phase: 'playing',
      playerCards,
      playerTotal,
      newCard
    });
  } catch (err) {
    console.error('PVP HIT ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pvp/session/:id/double — le joueur double sa mise, tire une carte, et la main se résout
router.post('/session/:id/double', auth, async (req, res) => {
  try {
    const pvpSession = await PvpSession.findById(req.params.id);

    if (!pvpSession) return res.status(404).json({ error: 'Session introuvable' });
    if (String(pvpSession.attackerId) !== String(req.user.id)) return res.status(403).json({ error: 'Pas ta session' });
    if (pvpSession.status === 'closed') return res.status(400).json({ error: 'Session fermée' });
    if (!pvpSession.currentHand) return res.status(400).json({ error: 'Aucune main en cours' });
    if (pvpSession.currentHand.phase !== 'playing') return res.status(400).json({ error: 'Main déjà terminée' });
    if (pvpSession.currentHand.playerCards.length !== 2) return res.status(400).json({ error: 'Double uniquement sur 2 cartes' });

    const hand = pvpSession.currentHand;
    const currentBet = hand.bet;

    // Vérifier que l'attaquant a assez de crédits pour doubler
    const attacker = await User.findById(pvpSession.attackerId);
    if (!attacker) return res.status(404).json({ error: 'Joueur introuvable' });
    if (attacker.credits < currentBet) return res.status(400).json({ error: 'Crédits insuffisants pour doubler' });

    // Vérifier que le double ne dépasse pas le cap restant
    const capRestant = pvpSession.cap - Math.abs(pvpSession.netDifference);
    if (currentBet * 2 > capRestant) return res.status(400).json({ error: `Double trop élevé pour le cap restant (${capRestant})` });

    // Doubler la mise
    pvpSession.currentHand.bet = currentBet * 2;

    // Tirer une seule carte
    const deck = [...hand.deck];
    const playerCards = [...hand.playerCards];
    playerCards.push(deck.pop());

    pvpSession.currentHand.deck = deck;
    pvpSession.currentHand.playerCards = playerCards;
    pvpSession.markModified('currentHand');
    await pvpSession.save();

    // Résoudre la main (le joueur ne peut plus tirer après un double)
    const result = await resolveHand(pvpSession);
    res.json({
      phase: 'ended',
      ...result
    });
  } catch (err) {
    console.error('PVP DOUBLE ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pvp/session/:id/stand — le joueur reste, le dealer joue
router.post('/session/:id/stand', auth, async (req, res) => {
  try {
    const pvpSession = await PvpSession.findById(req.params.id);

    if (!pvpSession) return res.status(404).json({ error: 'Session introuvable' });
    if (String(pvpSession.attackerId) !== String(req.user.id)) return res.status(403).json({ error: 'Pas ta session' });
    if (pvpSession.status === 'closed') return res.status(400).json({ error: 'Session fermée' });
    if (!pvpSession.currentHand) return res.status(400).json({ error: 'Aucune main en cours. Faites /deal d\'abord' });
    if (pvpSession.currentHand.phase !== 'playing') return res.status(400).json({ error: 'Main déjà terminée' });

    const result = await resolveHand(pvpSession);
    res.json({
      phase: 'ended',
      ...result
    });
  } catch (err) {
    console.error('PVP STAND ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pvp/session/:id/quit
router.post('/session/:id/quit', auth, async (req, res) => {
  try {
    const pvpSession = await PvpSession.findById(req.params.id);
    if (!pvpSession) return res.status(404).json({ error: 'Session introuvable' });
    if (String(pvpSession.attackerId) !== String(req.user.id)) return res.status(403).json({ error: 'Pas ta session' });

    // If there's an ongoing hand, resolve it as a stand (player forfeits the hand)
    if (pvpSession.currentHand && pvpSession.currentHand.phase === 'playing') {
      await resolveHand(pvpSession);
      // Re-fetch after resolve modified the session
      const updated = await PvpSession.findById(req.params.id);
      updated.status = 'closed';
      updated.closedAt = new Date();
      await updated.save();
      return res.json({ message: 'Session fermée', netDifference: updated.netDifference, handsPlayed: updated.hands.length });
    }

    pvpSession.status = 'closed';
    pvpSession.closedAt = new Date();
    await pvpSession.save();

    res.json({ message: 'Session fermée', netDifference: pvpSession.netDifference, handsPlayed: pvpSession.hands.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== LEGACY ROUTE — kept for backward compatibility, now calls deal+auto-resolve =====
// POST /api/pvp/session/:id/hand (auto-play, deprecated)
router.post('/session/:id/hand', auth, async (req, res) => {
  try {
    const { bet } = req.body;
    const pvpSession = await PvpSession.findById(req.params.id);

    if (!pvpSession) return res.status(404).json({ error: 'Session introuvable' });
    if (String(pvpSession.attackerId) !== String(req.user.id)) return res.status(403).json({ error: 'Pas ta session' });
    if (pvpSession.status === 'closed') return res.status(400).json({ error: 'Session fermée' });
    if (pvpSession.currentHand) return res.status(400).json({ error: 'Une main est déjà en cours' });

    if (!bet || bet <= 0) return res.status(400).json({ error: 'Mise invalide' });

    const capRestant = pvpSession.cap - Math.abs(pvpSession.netDifference);
    if (bet > capRestant) return res.status(400).json({ error: `Mise trop élevée, cap restant : ${capRestant}` });

    const attacker = await User.findById(pvpSession.attackerId);
    if (!attacker || attacker.credits < bet) return res.status(400).json({ error: 'Tu n\'as pas assez de crédits' });

    // Create deck, deal, then immediately resolve (auto-play for legacy)
    const deck = createDeck();
    const playerCards = [deck.pop(), deck.pop()];
    const dealerCard1 = deck.pop();
    const dealerHiddenCard = deck.pop();
    const dealerCards = [dealerCard1, dealerHiddenCard];

    pvpSession.currentHand = {
      bet,
      deck,
      playerCards,
      dealerCards,
      dealerHiddenCard,
      phase: 'playing'
    };
    pvpSession.markModified('currentHand');
    await pvpSession.save();

    const result = await resolveHand(pvpSession);
    res.json(result);
  } catch (err) {
    console.error('PVP HAND ERROR:', err.message);
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
