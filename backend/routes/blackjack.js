const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const BlackjackGame = require('../models/BlackjackGame');

// ============ LOGIQUE DU JEU ============

function createDeck(numDecks = 6) {
  const suits = ['♠', '♥', '♦', '♣'];
  const values = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  const deck = [];

  for (let d = 0; d < numDecks; d++) {
    for (const suit of suits) {
      for (const value of values) {
        deck.push(`${value}${suit}`);
      }
    }
  }

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
  let total = 0;
  let aces = 0;

  for (let card of cards) {
    if (card === '?') continue;
    const val = getCardValue(card);
    if (card.startsWith('A')) aces++;
    total += val;
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }

  return total;
}

function checkBlackjack(cards) {
  return cards.length === 2 && calculateTotal(cards) === 21;
}

// ============ ROUTES ============

// POST /api/blackjack/start
router.post('/start', auth, async (req, res) => {
  try {
    const { bet } = req.body;
    const user = await User.findById(req.user.id);

    if (!bet || bet <= 0) return res.status(400).json({ message: 'Mise invalide' });
    if (user.credits < bet) return res.status(400).json({ message: 'Crédits insuffisants' });

    const deck = createDeck();
    const playerCards = [deck.pop(), deck.pop()];
    const dealerCards = [deck.pop(), '?'];
    // ↑ La vraie 2ème carte du croupier est stockée séparément
    const dealerHiddenCard = deck.pop();

    const playerTotal = calculateTotal(playerCards);

    let result = 'ongoing';
    let creditsChange = 0;

    user.credits -= bet;

    if (checkBlackjack(playerCards)) {
      result = 'blackjack';
      creditsChange = Math.floor(bet * 1.5);
      user.credits += bet + creditsChange;
      user.notifications.push({ message: `Blackjack ! Vous gagnez ${creditsChange} crédits` });
    }

    await user.save();

    const game = await BlackjackGame.create({
      userId: req.user.id,
      bet,
      playerCards,
      dealerCards,
      dealerHiddenCard, // ← carte cachée stockée séparément
      playerTotal,
      dealerTotal: getCardValue(dealerCards[0]),
      result,
      creditsChange,
      deck // ← deck restant sauvegardé
    });

    res.json({
      gameId: game._id,
      playerCards,
      dealerCards,
      playerTotal,
      result,
      credits: user.credits
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/blackjack/hit
router.post('/hit', auth, async (req, res) => {
  try {
    const { gameId } = req.body;
    const game = await BlackjackGame.findById(gameId);

    if (!game || game.userId.toString() !== req.user.id)
      return res.status(404).json({ message: 'Partie introuvable' });
    if (game.result !== 'ongoing')
      return res.status(400).json({ message: 'Partie déjà terminée' });

    // ✅ Utiliser le deck sauvegardé
    const deck = game.deck;
    const newCard = deck.pop();
    game.playerCards.push(newCard);
    game.deck = deck; // ← mettre à jour

    const playerTotal = calculateTotal(game.playerCards);
    game.playerTotal = playerTotal;

    let result = 'ongoing';
    let creditsChange = 0;

    if (playerTotal > 21) {
      result = 'lose';
      creditsChange = -game.bet;
      game.result = result;
      game.creditsChange = creditsChange;

      const user = await User.findById(req.user.id);
      user.notifications.push({ message: `Blackjack - Perdu ! -${game.bet} crédits` });
      await user.save();
    }

    game.result = result;
    game.creditsChange = creditsChange;
    await game.save();

    const user = await User.findById(req.user.id);

    res.json({
      playerCards: game.playerCards,
      playerTotal,
      result,
      credits: user.credits
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/blackjack/stand
router.post('/stand', auth, async (req, res) => {
  try {
    const { gameId } = req.body;
    const game = await BlackjackGame.findById(gameId);

    if (!game || game.userId.toString() !== req.user.id)
      return res.status(404).json({ message: 'Partie introuvable' });
    if (game.result !== 'ongoing')
      return res.status(400).json({ message: 'Partie déjà terminée' });

    // ✅ Utiliser le deck sauvegardé
    const deck = game.deck;

    // Révéler la vraie carte cachée
    game.dealerCards[1] = game.dealerHiddenCard;
    let dealerTotal = calculateTotal(game.dealerCards);

    // Le croupier tire jusqu'à 17
    while (dealerTotal < 17) {
      game.dealerCards.push(deck.pop());
      dealerTotal = calculateTotal(game.dealerCards);
    }

    game.deck = deck;

    const playerTotal = game.playerTotal;
    let result = '';
    let creditsChange = 0;

    if (dealerTotal > 21 || playerTotal > dealerTotal) {
      result = 'win';
      creditsChange = game.bet;
    } else if (playerTotal < dealerTotal) {
      result = 'lose';
      creditsChange = -game.bet;
    } else {
      result = 'push';
    }

    const user = await User.findById(req.user.id);
    user.credits += game.bet + creditsChange;

    const notifMsg = result === 'win'
      ? `Blackjack - Gagné ! +${creditsChange} crédits`
      : result === 'lose'
      ? `Blackjack - Perdu ! -${Math.abs(creditsChange)} crédits`
      : `Blackjack - Égalité !`;

    user.notifications.push({ message: notifMsg });
    await user.save();

    game.dealerTotal = dealerTotal;
    game.result = result;
    game.creditsChange = creditsChange;
    await game.save();

    res.json({
      playerCards: game.playerCards,
      dealerCards: game.dealerCards,
      playerTotal,
      dealerTotal,
      result,
      creditsChange,
      credits: user.credits
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/blackjack/double
router.post('/double', auth, async (req, res) => {
  try {
    const { gameId } = req.body;
    const game = await BlackjackGame.findById(gameId);
    const user = await User.findById(req.user.id);

    if (!game || game.userId.toString() !== req.user.id)
      return res.status(404).json({ message: 'Partie introuvable' });
    if (game.result !== 'ongoing')
      return res.status(400).json({ message: 'Partie déjà terminée' });
    if (game.playerCards.length !== 2)
      return res.status(400).json({ message: 'Double uniquement sur 2 cartes' });
    if (user.credits < game.bet)
      return res.status(400).json({ message: 'Crédits insuffisants pour doubler' });

    // ✅ Utiliser le deck sauvegardé
    const deck = game.deck;

    user.credits -= game.bet;
    game.bet *= 2;

    const newCard = deck.pop();
    game.playerCards.push(newCard);
    const playerTotal = calculateTotal(game.playerCards);
    game.playerTotal = playerTotal;

    if (playerTotal > 21) {
      game.result = 'lose';
      game.creditsChange = -game.bet;
      game.deck = deck;

      user.notifications.push({ message: `Blackjack - Perdu (double) ! -${game.bet} crédits` });
      await user.save();
      await game.save();

      return res.json({
        playerCards: game.playerCards,
        dealerCards: game.dealerCards,
        playerTotal,
        dealerTotal: '?',
        result: 'lose',
        creditsChange: game.creditsChange,
        credits: user.credits
      });
    }

    // Croupier joue avec le même deck
    game.dealerCards[1] = game.dealerHiddenCard;
    let dealerTotal = calculateTotal(game.dealerCards);

    while (dealerTotal < 17) {
      game.dealerCards.push(deck.pop());
      dealerTotal = calculateTotal(game.dealerCards);
    }

    game.deck = deck;

    let result = '';
    let creditsChange = 0;

    if (dealerTotal > 21 || playerTotal > dealerTotal) {
      result = 'win';
      creditsChange = game.bet;
    } else if (playerTotal < dealerTotal) {
      result = 'lose';
      creditsChange = -game.bet;
    } else {
      result = 'push';
    }

    user.credits += game.bet + creditsChange;
    user.notifications.push({
      message: result === 'win'
        ? `Blackjack - Gagné (double) ! +${creditsChange} crédits`
        : result === 'lose'
        ? `Blackjack - Perdu (double) ! -${Math.abs(creditsChange)} crédits`
        : `Blackjack - Égalité !`
    });
    await user.save();

    game.dealerTotal = dealerTotal;
    game.result = result;
    game.creditsChange = creditsChange;
    await game.save();

    res.json({
      playerCards: game.playerCards,
      dealerCards: game.dealerCards,
      playerTotal,
      dealerTotal,
      result,
      creditsChange,
      credits: user.credits
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/blackjack/history
router.get('/history', auth, async (req, res) => {
  try {
    const games = await BlackjackGame.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json(games);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
