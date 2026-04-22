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

function canSplit(cards) {
  if (cards.length !== 2) return false;
  const v1 = cards[0].slice(0, -1);
  const v2 = cards[1].slice(0, -1);
  return v1 === v2 || (['10','J','Q','K'].includes(v1) && ['10','J','Q','K'].includes(v2));
}

async function resolveSplit(game, res) {
  const deck = [...game.deck];

  // Croupier révèle et joue
  const dealerCards = [...game.dealerCards];
  dealerCards[1] = game.dealerHiddenCard;
  let dealerTotal = calculateTotal(dealerCards);
  while (dealerTotal < 17) {
    dealerCards.push(deck.pop());
    dealerTotal = calculateTotal(dealerCards);
  }

  game.deck = deck;
  game.dealerCards = dealerCards;
  game.markModified('deck');
  game.markModified('dealerCards');

  const user = await User.findById(game.userId);

  const resolveHand = (handCards) => {
    const total = calculateTotal(handCards);
    if (total > 21) return { result: 'lose', change: -game.bet };
    if (dealerTotal > 21 || total > dealerTotal) return { result: 'win', change: game.bet };
    if (total === dealerTotal) return { result: 'push', change: 0 };
    return { result: 'lose', change: -game.bet };
  };

  const h1 = resolveHand(game.hand1Cards);
  const h2 = resolveHand(game.hand2Cards);

  const totalChange = h1.change + h2.change;

  // Rembourser les deux mises + gains nets
  user.credits += game.bet * 2 + totalChange;

  const notifMsg = `Blackjack Split - Main1: ${h1.result} (${h1.change >= 0 ? '+' : ''}${h1.change}), Main2: ${h2.result} (${h2.change >= 0 ? '+' : ''}${h2.change})`;
  user.notifications.push({ message: notifMsg });
  await user.save();

  game.result = 'split';
  game.creditsChange = totalChange;
  game.dealerTotal = dealerTotal;
  await game.save();

  return res.json({
    dealerCards,
    dealerTotal,
    hand1: {
      cards: game.hand1Cards,
      total: calculateTotal(game.hand1Cards),
      result: h1.result,
      creditsChange: h1.change
    },
    hand2: {
      cards: game.hand2Cards,
      total: calculateTotal(game.hand2Cards),
      result: h2.result,
      creditsChange: h2.change
    },
    totalCreditsChange: totalChange,
    credits: user.credits
  });
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
      playerCards: [...playerCards],
      dealerCards: [...dealerCards],
      dealerHiddenCard,
      playerTotal,
      dealerTotal: getCardValue(dealerCards[0]),
      result,
      creditsChange,
      deck: [...deck],
      splitActive: false,
      hand1Cards: [],
      hand2Cards: [],
      hand1Done: false,
      hand2Done: false
    });

    res.json({
      gameId: game._id,
      playerCards,
      dealerCards,
      playerTotal,
      canSplit: canSplit(playerCards),
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
    const { gameId, handNumber } = req.body;
    const game = await BlackjackGame.findById(gameId);

    if (!game || game.userId.toString() !== req.user.id)
      return res.status(404).json({ message: 'Partie introuvable' });
    if (game.result !== 'ongoing')
      return res.status(400).json({ message: 'Partie déjà terminée' });

    const deck = [...game.deck];
    const newCard = deck.pop();
    game.deck = deck;
    game.markModified('deck');

    // ── Split actif ──
    if (game.splitActive) {
      if (handNumber === 2) {
        const hand2Cards = [...game.hand2Cards, newCard];
        game.hand2Cards = hand2Cards;
        game.markModified('hand2Cards');
        const total = calculateTotal(hand2Cards);

        if (total > 21) {
          game.hand2Done = true;
          await game.save();
          // Les deux mains sont terminées
          if (game.hand1Done) {
            return await resolveSplit(game, res);
          }
          return res.json({
            newCard,
            hand2Cards,
            hand2Total: total,
            bust: true
          });
        }

        await game.save();
        return res.json({
          newCard,
          hand2Cards,
          hand2Total: total,
          bust: false
        });

      } else {
        // Main 1
        const hand1Cards = [...game.hand1Cards, newCard];
        game.hand1Cards = hand1Cards;
        game.markModified('hand1Cards');
        const total = calculateTotal(hand1Cards);

        if (total > 21) {
          game.hand1Done = true;
          await game.save();
          return res.json({
            newCard,
            hand1Cards,
            hand1Total: total,
            bust: true,
            switchToHand2: true
          });
        }

        await game.save();
        return res.json({
          newCard,
          hand1Cards,
          hand1Total: total,
          bust: false
        });
      }
    }

    // ── Jeu normal ──
    const playerCards = [...game.playerCards, newCard];
    game.playerCards = playerCards;
    game.markModified('playerCards');
    const playerTotal = calculateTotal(playerCards);
    game.playerTotal = playerTotal;

    if (playerTotal > 21) {
      game.result = 'lose';
      game.creditsChange = -game.bet;
      await game.save();

      const user = await User.findById(req.user.id);
      user.notifications.push({ message: `Blackjack - Perdu ! -${game.bet} crédits` });
      await user.save();

      return res.json({
        playerCards,
        playerTotal,
        result: 'lose',
        creditsChange: -game.bet,
        credits: user.credits
      });
    }

    await game.save();
    const user = await User.findById(req.user.id);

    res.json({
      playerCards,
      playerTotal,
      result: 'ongoing',
      canSplit: false,
      credits: user.credits
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/blackjack/stand
router.post('/stand', auth, async (req, res) => {
  try {
    const { gameId, handNumber } = req.body;
    const game = await BlackjackGame.findById(gameId);

    if (!game || game.userId.toString() !== req.user.id)
      return res.status(404).json({ message: 'Partie introuvable' });
    if (game.result !== 'ongoing')
      return res.status(400).json({ message: 'Partie déjà terminée' });

    // ── Split actif ──
    if (game.splitActive) {
      if (handNumber === 1) {
        game.hand1Done = true;
        await game.save();
        return res.json({
          switchToHand2: true,
          hand1Cards: game.hand1Cards,
          hand1Total: calculateTotal(game.hand1Cards),
          hand2Cards: game.hand2Cards,
          hand2Total: calculateTotal(game.hand2Cards)
        });
      } else {
        game.hand2Done = true;
        await game.save();
        return await resolveSplit(game, res);
      }
    }

    // ── Jeu normal ──
    const deck = [...game.deck];
    const dealerCards = [...game.dealerCards];
    dealerCards[1] = game.dealerHiddenCard;
    let dealerTotal = calculateTotal(dealerCards);

    while (dealerTotal < 17) {
      dealerCards.push(deck.pop());
      dealerTotal = calculateTotal(dealerCards);
    }

    game.deck = deck;
    game.dealerCards = dealerCards;
    game.markModified('deck');
    game.markModified('dealerCards');

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

    user.notifications.push({
      message: result === 'win'
        ? `Blackjack - Gagné ! +${creditsChange} crédits`
        : result === 'lose'
        ? `Blackjack - Perdu ! -${Math.abs(creditsChange)} crédits`
        : `Blackjack - Égalité !`
    });
    await user.save();

    game.dealerTotal = dealerTotal;
    game.result = result;
    game.creditsChange = creditsChange;
    await game.save();

    res.json({
      playerCards: game.playerCards,
      dealerCards,
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

    const deck = [...game.deck];

    user.credits -= game.bet;
    game.bet *= 2;

    const newCard = deck.pop();
    const playerCards = [...game.playerCards, newCard];
    game.playerCards = playerCards;
    game.markModified('playerCards');
    const playerTotal = calculateTotal(playerCards);
    game.playerTotal = playerTotal;

    if (playerTotal > 21) {
      game.result = 'lose';
      game.creditsChange = -game.bet;
      game.deck = deck;
      game.markModified('deck');

      user.notifications.push({ message: `Blackjack - Perdu (double) ! -${game.bet} crédits` });
      await user.save();
      await game.save();

      return res.json({
        playerCards,
        dealerCards: game.dealerCards,
        playerTotal,
        dealerTotal: '?',
        result: 'lose',
        creditsChange: game.creditsChange,
        credits: user.credits
      });
    }

    const dealerCards = [...game.dealerCards];
    dealerCards[1] = game.dealerHiddenCard;
    let dealerTotal = calculateTotal(dealerCards);

    while (dealerTotal < 17) {
      dealerCards.push(deck.pop());
      dealerTotal = calculateTotal(dealerCards);
    }

    game.deck = deck;
    game.dealerCards = dealerCards;
    game.markModified('deck');
    game.markModified('dealerCards');

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
      playerCards,
      dealerCards,
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

// POST /api/blackjack/split
router.post('/split', auth, async (req, res) => {
  try {
    const { gameId } = req.body;
    const game = await BlackjackGame.findById(gameId);
    const user = await User.findById(req.user.id);

    if (!game || game.userId.toString() !== req.user.id)
      return res.status(404).json({ message: 'Partie introuvable' });
    if (game.result !== 'ongoing')
      return res.status(400).json({ message: 'Partie déjà terminée' });
    if (!canSplit(game.playerCards))
      return res.status(400).json({ message: 'Split impossible' });
    if (user.credits < game.bet)
      return res.status(400).json({ message: 'Crédits insuffisants pour splitter' });

    user.credits -= game.bet;
    await user.save();

    const deck = [...game.deck];

    const hand1Cards = [game.playerCards[0], deck.pop()];
    const hand2Cards = [game.playerCards[1], deck.pop()];

    game.splitActive = true;
    game.hand1Cards = [...hand1Cards];
    game.hand2Cards = [...hand2Cards];
    game.hand1Done = false;
    game.hand2Done = false;
    game.deck = deck;
    game.markModified('hand1Cards');
    game.markModified('hand2Cards');
    game.markModified('deck');
    await game.save();

    res.json({
      hand1Cards: game.hand1Cards,
      hand1Total: calculateTotal(game.hand1Cards),
      hand2Cards: game.hand2Cards,
      hand2Total: calculateTotal(game.hand2Cards),
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
