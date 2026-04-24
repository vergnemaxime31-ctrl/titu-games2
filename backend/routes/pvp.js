const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const PvpSession = require('../models/PvpSession');
const mongoose = require('mongoose');

// Utilitaire — date du jour en UTC "YYYY-MM-DD"
function todayString() {
  return new Date().toISOString().slice(0, 10);
}

// Logique blackjack
function cardValue(card) {
  if (['J', 'Q', 'K'].includes(card)) return 10;
  if (card === 'A') return 11;
  return parseInt(card);
}

function handTotal(cards) {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    total += cardValue(card);
    if (card === 'A') aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

function drawCard() {
  const cards = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  return cards[Math.floor(Math.random() * cards.length)];
}

function playHand(bet) {
  // Cartes initiales
  const playerCards = [drawCard(), drawCard()];
  const dealerCards = [drawCard(), drawCard()];

  // Blackjack naturel joueur
  if (handTotal(playerCards) === 21) {
    return {
      result: 'blackjack',
      creditsTransferred: Math.floor(bet * 2.5),
      playerCards,
      dealerCards
    };
  }

  // Dealer joue (simple : tire jusqu'à 17)
  let playerTotal = handTotal(playerCards);
  let dealerTotal = handTotal(dealerCards);

  // Joueur "stand" automatiquement à 17+ (on peut améliorer plus tard)
  // Pour l'instant : logique simple, le joueur tire jusqu'à 17
  while (playerTotal < 17) {
    playerCards.push(drawCard());
    playerTotal = handTotal(playerCards);
  }

  // Dealer tire jusqu'à 17
  while (dealerTotal < 17) {
    dealerCards.push(drawCard());
    dealerTotal = handTotal(dealerCards);
  }

  // Résultat
  if (playerTotal > 21) {
    return { result: 'bust', creditsTransferred: -bet, playerCards, dealerCards };
  }
  if (dealerTotal > 21 || playerTotal > dealerTotal) {
    return { result: 'win', creditsTransferred: bet, playerCards, dealerCards };
  }
  if (playerTotal === dealerTotal) {
    return { result: 'push', creditsTransferred: 0, playerCards, dealerCards };
  }
  return { result: 'lose', creditsTransferred: -bet, playerCards, dealerCards };
}

// ─────────────────────────────────────────
// GET /api/pvp/targets
// Liste des joueurs attaquables
// ─────────────────────────────────────────
router.get('/targets', auth, async (req, res) => {
  try {
    const today = todayString();

    // Sessions déjà lancées aujourd'hui par cet attaquant
    const alreadyAttacked = await PvpSession.find({
      attackerId: req.user.id,
      date: today
    }).select('targetId');

    const excludedIds = alreadyAttacked.map(s => s.targetId);
    excludedIds.push(req.user.id); // pas soi-même

    const targets = await User.find({
      _id: { $nin: excludedIds },
      credits: { $gte: 500 }
    }).select('username credits');

    const result = targets.map(t => ({
      id: t._id,
      username: t.username,
      credits: t.credits,
      cap: Math.floor(t.credits * 0.1)
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// POST /api/pvp/start
// Démarre une session contre une cible
// ─────────────────────────────────────────
router.post('/start', auth, async (req, res) => {
  try {
    const { targetId } = req.body;
    const today = todayString();

    // Vérifs
    const target = await User.findById(targetId);
    if (!target) return res.status(404).json({ error: 'Cible introuvable' });
    if (target.credits < 500) return res.status(400).json({ error: 'Cible non attaquable (< 500 crédits)' });

    const existing = await PvpSession.findOne({
      attackerId: req.user.id,
      targetId,
      date: today
    });
    if (existing) return res.status(400).json({ error: 'Tu as déjà attaqué ce joueur aujourd\'hui' });

    const cap = Math.floor(target.credits * 0.1);

    const session = await PvpSession.create({
      attackerId: req.user.id,
      targetId,
      date: today,
      cap
    });

    res.json({ 
      sessionId: session._id, 
      cap, 
      targetUsername: target.username 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// POST /api/pvp/session/:id/hand
// Joue une main
// ─────────────────────────────────────────
router.post('/session/:id/hand', auth, async (req, res) => {
  const mongoSession = await mongoose.startSession();
  mongoSession.startTransaction();

  try {
    const { bet } = req.body;
    if (!bet || bet <= 0) return res.status(400).json({ error: 'Mise invalide' });

    const pvpSession = await PvpSession.findById(req.params.id);
    if (!pvpSession) return res.status(404).json({ error: 'Session introuvable' });
    if (pvpSession.status === 'closed') return res.status(400).json({ error: 'Session fermée' });
    if (String(pvpSession.attackerId) !== String(req.user.id)) return res.status(403).json({ error: 'Pas ta session' });

    const capRestant = pvpSession.cap - Math.abs(pvpSession.netDifference);

    // Vérif mise (sauf blackjack naturel on ne peut pas savoir à l'avance)
    if (bet > capRestant) {
      return res.status(400).json({ 
        error: `Mise trop élevée, cap restant : ${capRestant}` 
      });
    }

    // Récupérer attaquant et cible
    const attacker = await User.findById(pvpSession.attackerId).session(mongoSession);
    const target = await User.findById(pvpSession.targetId).session(mongoSession);

    if (!attacker || !target) throw new Error('Joueur introuvable');

    // Jouer la main
    const hand = playHand(bet);
    const { creditsTransferred } = hand;

    // Vérif que la cible a assez si A gagne
    if (creditsTransferred > 0 && target.credits < creditsTransferred) {
      await mongoSession.abortTransaction();
      return res.status(400).json({ error: 'La cible n\'a plus assez de crédits' });
    }
    // Vérif que l'attaquant a assez si A perd
    if (creditsTransferred < 0 && attacker.credits < Math.abs(creditsTransferred)) {
      await mongoSession.abortTransaction();
      return res.status(400).json({ error: 'Tu n\'as pas assez de crédits' });
    }

    // Transfert atomique
    await User.updateOne(
      { _id: pvpSession.attackerId },
      { $inc: { credits: creditsTransferred } },
      { session: mongoSession }
    );
    await User.updateOne(
      { _id: pvpSession.targetId },
      { $inc: { credits: -creditsTransferred } },
      { session: mongoSession }
    );

    // Mise à jour session
    pvpSession.hands.push({
      bet,
      result: hand.result,
      creditsTransferred
    });
    pvpSession.netDifference += creditsTransferred;

    // Fermer la session si cap atteint
    const newCapRestant = pvpSession.cap - Math.abs(pvpSession.netDifference);
    let sessionClosed = false;
    if (newCapRestant <= 0) {
      pvpSession.status = 'closed';
      pvpSession.closedAt = new Date();
      sessionClosed = true;
    }

    await pvpSession.save({ session: mongoSession });

    // Notification à la cible
    const attackerUser = await User.findById(req.user.id).session(mongoSession);
    const notifMessage = creditsTransferred > 0
      ? `⚔️ ${attackerUser.username} t'a attaqué au blackjack et t'a pris ${creditsTransferred} crédits !`
      : creditsTransferred < 0
        ? `⚔️ ${attackerUser.username} t'a attaqué au blackjack mais a perdu ${Math.abs(creditsTransferred)} crédits !`
        : `⚔️ ${attackerUser.username} t'a attaqué au blackjack, égalité !`;

    await User.updateOne(
      { _id: pvpSession.targetId },
      { $push: { notifications: { message: notifMessage } } },
      { session: mongoSession }
    );

    await mongoSession.commitTransaction();

    res.json({
      result: hand.result,
      playerCards: hand.playerCards,
      dealerCards: hand.dealerCards,
      creditsTransferred,
      netDifference: pvpSession.netDifference,
      capRestant: newCapRestant,
      sessionClosed
    });

  } catch (err) {
    await mongoSession.abortTransaction();
    res.status(500).json({ error: err.message });
  } finally {
    mongoSession.endSession();
  }
});

// ─────────────────────────────────────────
// POST /api/pvp/session/:id/quit
// Quitte la session
// ─────────────────────────────────────────
router.post('/session/:id/quit', auth, async (req, res) => {
  try {
    const pvpSession = await PvpSession.findById(req.params.id);
    if (!pvpSession) return res.status(404).json({ error: 'Session introuvable' });
    if (String(pvpSession.attackerId) !== String(req.user.id)) return res.status(403).json({ error: 'Pas ta session' });

    pvpSession.status = 'closed';
    pvpSession.closedAt = new Date();
    await pvpSession.save();

    res.json({ 
      message: 'Session fermée',
      netDifference: pvpSession.netDifference,
      handsPlayed: pvpSession.hands.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// GET /api/pvp/notifications
// Mes notifications non lues
// ─────────────────────────────────────────
router.get('/notifications', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const unread = user.notifications.filter(n => !n.read);

    // Marquer comme lues
    await User.updateOne(
      { _id: req.user.id },
      { $set: { 'notifications.$[].read': true } }
    );

    res.json(unread);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
