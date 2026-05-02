const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const BlackjackGame = require('../models/BlackjackGame');

function createDeck(numDecks = 6) {
  const suits = ['♠', '♥', '♦', '♣'];
  const values = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  const deck = [];
  for (let d = 0; d < numDecks; d++)
    for (const suit of suits)
      for (const value of values)
        deck.push(`${value}${suit}`);
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

// Keep backward-compatible alias
function checkBlackjack(cards) {
  return isNaturalBlackjack(cards);
}

function canSplit(cards) {
  if (cards.length !== 2) return false;
  const v1 = cards[0].slice(0, -1);
  const v2 = cards[1].slice(0, -1);
  return v1 === v2 || (['10','J','Q','K'].includes(v1) && ['10','J','Q','K'].includes(v2));
}

async function resolveSplit(game, res) {
  const deck = [...game.deck];
  const dealerCards = [...game.dealerCards];
  dealerCards[1] = game.dealerHiddenCard;
  if (!dealerCards[1]) {
    return res.status(500).json({ message: 'Erreur interne : carte cachée du dealer introuvable (split)' });
  }
  let dealerTotal = calculateTotal(dealerCards);
  while (dealerTotal < 17) {
    if (deck.length === 0) {
      return res.status(500).json({ message: 'Erreur interne : deck vide pendant le tirage du dealer (split)' });
    }
    const drawnCard = deck.pop();
    if (!drawnCard) {
      return res.status(500).json({ message: 'Erreur interne : carte tirée invalide pour le dealer (split)' });
    }
    dealerCards.push(drawnCard);
    dealerTotal = calculateTotal(dealerCards);
  }
  game.deck = deck;
  game.dealerCards = dealerCards;
  game.markModified('deck');
  game.markModified('dealerCards');

  const resolveOneHand = (handCards) => {
    const total = calculateTotal(handCards);
    if (total > 21) return { result: 'lose', change: -game.bet };
    // Blackjack naturel (As + figure en 2 cartes) = toujours payé 2.5x
    if (isNaturalBlackjack(handCards)) {
      return { result: 'blackjack', change: Math.floor(game.bet * 1.5) };
    }
    if (dealerTotal > 21 || total > dealerTotal) return { result: 'win', change: game.bet };
    if (total === dealerTotal) return { result: 'push', change: 0 };
    return { result: 'lose', change: -game.bet };
  };

  const h1 = resolveOneHand(game.hand1Cards);
  const h2 = resolveOneHand(game.hand2Cards);
  const totalChange = h1.change + h2.change;

  // On a déjà débité bet*2 au total (bet au start + bet au split)
  // On rembourse bet*2 + gains/pertes (atomique)
  const creditsDelta = game.bet * 2 + totalChange;
  const notifMsg = `Split - M1: ${h1.result} (${h1.change >= 0 ? '+' : ''}${h1.change}), M2: ${h2.result} (${h2.change >= 0 ? '+' : ''}${h2.change})`;
  await User.updateOne({ _id: game.userId }, {
    $inc: { credits: creditsDelta },
    $push: { notifications: { message: notifMsg } }
  });

  game.result = 'split';
  game.creditsChange = totalChange;
  game.dealerTotal = dealerTotal;
  await game.save();

  const user = await User.findById(game.userId).select('credits');

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

// POST /api/blackjack/start
router.post('/start', auth, async (req, res) => {
  try {
    const { bet } = req.body;
    const user = await User.findById(req.user.id);
    if (!bet || bet <= 0) return res.status(400).json({ message: 'Mise invalide' });
    if (user.credits < bet) return res.status(400).json({ message: 'Crédits insuffisants' });

    // Supprimer toute partie en cours pour ce joueur avant d'en créer une nouvelle
    await BlackjackGame.deleteMany({ userId: req.user.id, result: 'ongoing' });

    const deck = createDeck();

    // Vérifier que le deck est bien généré (6 decks = 312 cartes)
    if (deck.length !== 312) {
      return res.status(500).json({ message: 'Erreur interne : deck mal généré' });
    }

    const playerCards = [deck.pop(), deck.pop()];
    const dealerVisibleCard = deck.pop();
    const dealerHiddenCard = deck.pop();
    const dealerCards = [dealerVisibleCard, '?'];

    // Valider qu'aucune carte tirée n'est undefined
    if (!playerCards[0] || !playerCards[1] || !dealerVisibleCard || !dealerHiddenCard) {
      return res.status(500).json({ message: 'Erreur interne : carte tirée invalide (deck corrompu)' });
    }

    const playerTotal = calculateTotal(playerCards);

    let result = 'ongoing';
    let creditsChange = 0;
    user.credits -= bet;

    const playerBJ = isNaturalBlackjack(playerCards);

    if (playerBJ) {
      // Blackjack naturel = toujours payé 2.5x la mise, peu importe le croupier
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
      dealerTotal: getCardValue(dealerVisibleCard),
      result,
      creditsChange,
      deck: [...deck],
      splitActive: false,
      hand1Cards: [],
      hand2Cards: [],
      hand1Done: false,
      hand2Done: false
    });

    // Construire la réponse — ne JAMAIS envoyer la carte cachée en phase playing
    const response = {
      gameId: game._id,
      playerCards,
      dealerCards, // contient [carte_visible, '?']
      playerTotal,
      canSplit: canSplit(playerCards),
      result,
      credits: user.credits
    };

    // Si la main est terminée (blackjack), révéler les cartes du dealer
    if (result !== 'ongoing') {
      const dealerFullCards = [dealerVisibleCard, dealerHiddenCard];
      response.dealerCards = dealerFullCards;
      response.dealerTotal = calculateTotal(dealerFullCards);
      response.creditsChange = creditsChange;
    }

    res.json(response);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/blackjack/hit
router.post('/hit', auth, async (req, res) => {
  try {
    const { gameId, hand } = req.body;
    const game = await BlackjackGame.findById(gameId);
    if (!game || game.userId.toString() !== req.user.id)
      return res.status(404).json({ message: 'Partie introuvable' });
    if (game.result !== 'ongoing')
      return res.status(400).json({ message: 'Partie déjà terminée' });

    const deck = [...game.deck];
    if (deck.length === 0) {
      return res.status(500).json({ message: 'Erreur interne : deck vide, impossible de tirer une carte' });
    }
    const newCard = deck.pop();
    if (!newCard) {
      return res.status(500).json({ message: 'Erreur interne : carte tirée invalide' });
    }
    game.deck = deck;
    game.markModified('deck');

    if (game.splitActive) {
      if (hand === 1) {
        const hand1Cards = [...game.hand1Cards, newCard];
        game.hand1Cards = hand1Cards;
        game.markModified('hand1Cards');
        const total = calculateTotal(hand1Cards);

        if (total > 21) {
          game.hand1Done = true;
          await game.save();
          return res.json({
            playerCards: hand1Cards,
            playerTotal: total,
            bust: true,
            switchToHand2: true,
            hand1Cards,
            hand1Total: total,
            hand2Cards: game.hand2Cards,
            hand2Total: calculateTotal(game.hand2Cards)
          });
        }
        await game.save();
        return res.json({ playerCards: hand1Cards, playerTotal: total, bust: false });

      } else {
        const hand2Cards = [...game.hand2Cards, newCard];
        game.hand2Cards = hand2Cards;
        game.markModified('hand2Cards');
        const total = calculateTotal(hand2Cards);

        if (total > 21) {
          game.hand2Done = true;
          await game.save();
          return await resolveSplit(game, res);
        }
        await game.save();
        return res.json({ playerCards: hand2Cards, playerTotal: total, bust: false });
      }
    }

    // Jeu normal
    const playerCards = [...game.playerCards, newCard];
    game.playerCards = playerCards;
    game.markModified('playerCards');
    const playerTotal = calculateTotal(playerCards);
    game.playerTotal = playerTotal;

    if (playerTotal > 21) {
      game.result = 'lose';
      game.creditsChange = -game.bet;
      await game.save();
      // Crédit déjà débité au /start, pas de mouvement supplémentaire
      await User.updateOne({ _id: req.user.id }, {
        $push: { notifications: { message: `Blackjack - Perdu ! -${game.bet} crédits` } }
      });
      const user = await User.findById(req.user.id).select('credits');
      return res.json({ playerCards, playerTotal, result: 'lose', creditsChange: -game.bet, credits: user.credits });
    }

    await game.save();
    const user = await User.findById(req.user.id).select('credits');
    res.json({ playerCards, playerTotal, result: 'ongoing', credits: user.credits });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/blackjack/stand
router.post('/stand', auth, async (req, res) => {
  try {
    const { gameId, hand } = req.body;
    const game = await BlackjackGame.findById(gameId);
    if (!game || game.userId.toString() !== req.user.id)
      return res.status(404).json({ message: 'Partie introuvable' });
    if (game.result !== 'ongoing')
      return res.status(400).json({ message: 'Partie déjà terminée' });

    if (game.splitActive) {
      if (hand === 1) {
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

    // Jeu normal
    const deck = [...game.deck];
    const dealerCards = [...game.dealerCards];
    dealerCards[1] = game.dealerHiddenCard;
    if (!dealerCards[1]) {
      return res.status(500).json({ message: 'Erreur interne : carte cachée du dealer introuvable' });
    }
    let dealerTotal = calculateTotal(dealerCards);
    while (dealerTotal < 17) {
      if (deck.length === 0) {
        return res.status(500).json({ message: 'Erreur interne : deck vide pendant le tirage du dealer' });
      }
      const drawnCard = deck.pop();
      if (!drawnCard) {
        return res.status(500).json({ message: 'Erreur interne : carte tirée invalide pour le dealer' });
      }
      dealerCards.push(drawnCard);
      dealerTotal = calculateTotal(dealerCards);
    }

    game.deck = deck;
    game.dealerCards = dealerCards;
    game.markModified('deck');
    game.markModified('dealerCards');

    const playerTotal = game.playerTotal;
    let result, creditsChange = 0;

    if (dealerTotal > 21 || playerTotal > dealerTotal) { result = 'win'; creditsChange = game.bet; }
    else if (playerTotal < dealerTotal) { result = 'lose'; creditsChange = -game.bet; }
    else { result = 'push'; }

    // Rembourser la mise + gains (atomique)
    const creditsDelta = game.bet + creditsChange;
    const notifMessage = result === 'win' ? `Blackjack - Gagné ! +${creditsChange} crédits`
            : result === 'lose' ? `Blackjack - Perdu ! -${Math.abs(creditsChange)} crédits`
            : `Blackjack - Égalité !`;
    await User.updateOne({ _id: req.user.id }, {
      $inc: { credits: creditsDelta },
      $push: { notifications: { message: notifMessage } }
    });

    game.dealerTotal = dealerTotal;
    game.result = result;
    game.creditsChange = creditsChange;
    await game.save();

    const user = await User.findById(req.user.id).select('credits');
    res.json({ playerCards: game.playerCards, dealerCards, playerTotal, dealerTotal, result, creditsChange, credits: user.credits });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/blackjack/double
router.post('/double', auth, async (req, res) => {
  try {
    const { gameId, hand } = req.body;
    const game = await BlackjackGame.findById(gameId);
    const user = await User.findById(req.user.id);
    if (!game || game.userId.toString() !== req.user.id)
      return res.status(404).json({ message: 'Partie introuvable' });
    if (game.result !== 'ongoing')
      return res.status(400).json({ message: 'Partie déjà terminée' });
    if (user.credits < game.bet)
      return res.status(400).json({ message: 'Crédits insuffisants pour doubler' });

    const deck = [...game.deck];

    if (game.splitActive) {
      if (deck.length === 0) {
        return res.status(500).json({ message: 'Erreur interne : deck vide (double/split)' });
      }
      const newCard = deck.pop();
      if (!newCard) {
        return res.status(500).json({ message: 'Erreur interne : carte tirée invalide (double/split)' });
      }
      game.deck = deck;
      game.markModified('deck');
      user.credits -= game.bet;

      if (hand === 1) {
        if (game.hand1Cards.length !== 2)
          return res.status(400).json({ message: 'Double uniquement sur 2 cartes' });
        game.hand1Cards = [...game.hand1Cards, newCard];
        game.markModified('hand1Cards');
        game.hand1Done = true;
        const total = calculateTotal(game.hand1Cards);
        await game.save();
        await user.save();
        return res.json({
          switchToHand2: true,
          hand1Cards: game.hand1Cards,
          hand1Total: total,
          hand2Cards: game.hand2Cards,
          hand2Total: calculateTotal(game.hand2Cards),
          credits: user.credits
        });
      } else {
        if (game.hand2Cards.length !== 2)
          return res.status(400).json({ message: 'Double uniquement sur 2 cartes' });
        game.hand2Cards = [...game.hand2Cards, newCard];
        game.markModified('hand2Cards');
        game.hand2Done = true;
        await game.save();
        await user.save();
        return await resolveSplit(game, res);
      }
    }

    // Jeu normal
    if (game.playerCards.length !== 2)
      return res.status(400).json({ message: 'Double uniquement sur 2 cartes' });

    // Débiter le supplément de mise (atomique)
    await User.updateOne({ _id: req.user.id }, { $inc: { credits: -game.bet } });
    game.bet *= 2;

    if (deck.length === 0) {
      return res.status(500).json({ message: 'Erreur interne : deck vide (double)' });
    }
    const newCard = deck.pop();
    if (!newCard) {
      return res.status(500).json({ message: 'Erreur interne : carte tirée invalide (double)' });
    }
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
      await game.save();
      // Pas de remboursement — les 2 mises sont perdues (déjà débitées)
      await User.updateOne({ _id: req.user.id }, {
        $push: { notifications: { message: `Blackjack - Perdu (double) ! -${game.bet} crédits` } }
      });
      const updatedUser = await User.findById(req.user.id).select('credits');
      // Ne pas envoyer la carte cachée du dealer sur bust
      return res.json({ playerCards, playerTotal, result: 'lose', creditsChange: game.creditsChange, credits: updatedUser.credits });
    }

    const dealerCards = [...game.dealerCards];
    dealerCards[1] = game.dealerHiddenCard;
    let dealerTotal = calculateTotal(dealerCards);
    while (dealerTotal < 17) {
      if (deck.length === 0) {
        return res.status(500).json({ message: 'Erreur interne : deck vide pendant tirage dealer (double)' });
      }
      const drawnCard = deck.pop();
      if (!drawnCard) {
        return res.status(500).json({ message: 'Erreur interne : carte dealer invalide (double)' });
      }
      dealerCards.push(drawnCard);
      dealerTotal = calculateTotal(dealerCards);
    }

    game.deck = deck;
    game.dealerCards = dealerCards;
    game.markModified('deck');
    game.markModified('dealerCards');

    let result, creditsChange = 0;
    if (dealerTotal > 21 || playerTotal > dealerTotal) { result = 'win'; creditsChange = game.bet; }
    else if (playerTotal < dealerTotal) { result = 'lose'; creditsChange = -game.bet; }
    else { result = 'push'; }

    // Rembourser mise + gains (atomique)
    const creditsDelta = game.bet + creditsChange;
    const notifMsg = result === 'win' ? `Blackjack - Gagné (double) ! +${creditsChange} crédits`
            : result === 'lose' ? `Blackjack - Perdu (double) ! -${Math.abs(creditsChange)} crédits`
            : `Blackjack - Égalité !`;
    await User.updateOne({ _id: req.user.id }, {
      $inc: { credits: creditsDelta },
      $push: { notifications: { message: notifMsg } }
    });

    game.dealerTotal = dealerTotal;
    game.result = result;
    game.creditsChange = creditsChange;
    await game.save();

    const updatedUser = await User.findById(req.user.id).select('credits');
    res.json({ playerCards, dealerCards, playerTotal, dealerTotal, result, creditsChange, credits: updatedUser.credits });

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
    if (deck.length < 2) {
      return res.status(500).json({ message: 'Erreur interne : deck insuffisant pour le split' });
    }
    const card1 = deck.pop();
    const card2 = deck.pop();
    if (!card1 || !card2) {
      return res.status(500).json({ message: 'Erreur interne : carte tirée invalide (split)' });
    }
    const hand1Cards = [game.playerCards[0], card1];
    const hand2Cards = [game.playerCards[1], card2];

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
      .select('bet playerCards dealerCards playerTotal dealerTotal result creditsChange splitActive hand1Cards hand2Cards createdAt')
      .sort({ createdAt: -1 })
      .limit(10);
    res.json(games);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
