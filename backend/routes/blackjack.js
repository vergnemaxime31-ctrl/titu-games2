const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const BlackjackGame = require('../models/BlackjackGame');

// ============ LOGIQUE DU JEU ============

const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function createDeck() {
  const deck = [];
  for (let suit of SUITS) {
    for (let value of VALUES) {
      deck.push(value + suit);
    }
  }
  return shuffle(deck);
}

function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function getCardValue(card) {
  const value = card.slice(0, -1); // Enlève le symbole
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

  // Si on dépasse 21, l'As vaut 1 au lieu de 11
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
// Démarre une nouvelle partie
router.post('/start', auth, async (req, res) => {
  try {
    const { bet } = req.body;
    const user = await User.findById(req.user.id);

    // Vérifications
    if (!bet || bet <= 0) {
      return res.status(400).json({ message: 'Mise invalide' });
    }
    if (user.credits < bet) {
      return res.status(400).json({ message: 'Crédits insuffisants' });
    }

    // Créer le deck et distribuer
    const deck = createDeck();
    const playerCards = [deck.pop(), deck.pop()];
    const dealerCards = [deck.pop(), '?']; // 2ème carte cachée

    const playerTotal = calculateTotal(playerCards);

    // Vérifier blackjack immédiat
    let result = 'ongoing';
    let creditsChange = 0;

    if (checkBlackjack(playerCards)) {
      result = 'blackjack';
      creditsChange = Math.floor(bet * 1.5); // Blackjack paie 3:2
    }

    // Déduire la mise
    user.credits -= bet;

    // Si blackjack, on ajoute directement les gains
    if (result === 'blackjack') {
      user.credits += bet + creditsChange;
      user.notifications.push({
        message: `Blackjack ! Vous gagnez ${creditsChange} crédits`
      });
    }

    await user.save();

    // Sauvegarder la partie
    const game = await BlackjackGame.create({
      userId: req.user.id,
      bet,
      playerCards,
      dealerCards,
      playerTotal,
      dealerTotal: getCardValue(dealerCards[0]),
      result,
      creditsChange,
      deck: deck // On garde le deck pour la suite
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
// Tirer une carte
router.post('/hit', auth, async (req, res) => {
  try {
    const { gameId } = req.body;
    const game = await BlackjackGame.findById(gameId);

    if (!game || game.userId.toString() !== req.user.id) {
      return res.status(404).json({ message: 'Partie introuvable' });
    }
    if (game.result !== 'ongoing') {
      return res.status(400).json({ message: 'Partie déjà terminée' });
    }

    // Tirer une carte
    const deck = createDeck(); // En prod on garderait le vrai deck
    const newCard = deck.pop();
    game.playerCards.push(newCard);
    const playerTotal = calculateTotal(game.playerCards);

    let result = 'ongoing';
    let creditsChange = 0;

    // Bust ?
    if (playerTotal > 21) {
      result = 'lose';
      creditsChange = -game.bet;

      const user = await User.findById(req.user.id);
      user.notifications.push({
        message: `Blackjack - Perdu ! -${game.bet} crédits`
      });
      await user.save();
    }

    game.playerTotal = playerTotal;
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
// Rester - le croupier joue
router.post('/stand', auth, async (req, res) => {
  try {
    const { gameId } = req.body;
    const game = await BlackjackGame.findById(gameId);

    if (!game || game.userId.toString() !== req.user.id) {
      return res.status(404).json({ message: 'Partie introuvable' });
    }
    if (game.result !== 'ongoing') {
      return res.status(400).json({ message: 'Partie déjà terminée' });
    }

    // Révéler la carte cachée du croupier
    const deck = createDeck();
    game.dealerCards[1] = deck.pop();
    let dealerTotal = calculateTotal(game.dealerCards);

    // Le croupier tire jusqu'à 17
    while (dealerTotal < 17) {
      game.dealerCards.push(deck.pop());
      dealerTotal = calculateTotal(game.dealerCards);
    }

    const playerTotal = game.playerTotal;
    let result = '';
    let creditsChange = 0;

    // Déterminer le résultat
    if (dealerTotal > 21) {
      result = 'win';
      creditsChange = game.bet;
    } else if (playerTotal > dealerTotal) {
      result = 'win';
      creditsChange = game.bet;
    } else if (playerTotal < dealerTotal) {
      result = 'lose';
      creditsChange = -game.bet;
    } else {
      result = 'push'; // Égalité
      creditsChange = 0;
    }

    // Mettre à jour les crédits
    const user = await User.findById(req.user.id);
    user.credits += game.bet + creditsChange; // Remboursement mise + gain/perte

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
// Doubler la mise
router.post('/double', auth, async (req, res) => {
  try {
    const { gameId } = req.body;
    const game = await BlackjackGame.findById(gameId);
    const user = await User.findById(req.user.id);

    if (!game || game.userId.toString() !== req.user.id) {
      return res.status(404).json({ message: 'Partie introuvable' });
    }
    if (game.result !== 'ongoing') {
      return res.status(400).json({ message: 'Partie déjà terminée' });
    }
    if (game.playerCards.length !== 2) {
      return res.status(400).json({ message: 'Double uniquement sur 2 cartes' });
    }
    if (user.credits < game.bet) {
      return res.status(400).json({ message: 'Crédits insuffisants pour doubler' });
    }

    // Déduire la mise supplémentaire
    user.credits -= game.bet;
    game.bet *= 2;

    // Tirer UNE seule carte
    const deck = createDeck();
    const newCard = deck.pop();
    game.playerCards.push(newCard);
    const playerTotal = calculateTotal(game.playerCards);
    game.playerTotal = playerTotal;

    // Si bust
    if (playerTotal > 21) {
      game.result = 'lose';
      game.creditsChange = -game.bet;
      user.notifications.push({
        message: `Blackjack - Perdu (double) ! -${game.bet} crédits`
      });
      await user.save();
      await game.save();

      return res.json({
        playerCards: game.playerCards,
        playerTotal,
        result: 'lose',
        credits: user.credits
      });
    }

    await user.save();
    await game.save();

    // Ensuite le croupier joue (comme un stand)
    game.dealerCards[1] = deck.pop();
    let dealerTotal = calculateTotal(game.dealerCards);

    while (dealerTotal < 17) {
      game.dealerCards.push(deck.pop());
      dealerTotal = calculateTotal(game.dealerCards);
    }

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
// Historique des parties
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
