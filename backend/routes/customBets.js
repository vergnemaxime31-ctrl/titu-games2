const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const CustomBet = require('../models/CustomBet');
const CustomBetVote = require('../models/CustomBetVote');
const User = require('../models/User');

// ─────────────────────────────────────────
// POST /api/custom-bets — Créer un pari
// ─────────────────────────────────────────
router.post('/', auth, async (req, res) => {
  try {
    const { question, odds, creatorAmount, expiresAt } = req.body;

    if (!question || !odds || !creatorAmount || !expiresAt)
      return res.status(400).json({ message: 'Champs manquants' });

    if (odds < 1.1 || odds > 100)
      return res.status(400).json({ message: 'Cote invalide (entre 1.1 et 100)' });

    if (creatorAmount <= 0)
      return res.status(400).json({ message: 'Mise invalide' });

    const user = await User.findById(req.user.id);
    if (user.credits < creatorAmount)
      return res.status(400).json({ message: 'Crédits insuffisants' });

    // Bloquer les crédits du créateur
    user.credits -= creatorAmount;
    await user.save();

    const bet = await CustomBet.create({
      creatorId: req.user.id,
      question,
      odds,
      creatorAmount,
      opponentAmount: Math.round(creatorAmount * odds),
      expiresAt: new Date(expiresAt)
    });

    res.json({ message: 'Pari créé !', bet, credits: user.credits });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────
// GET /api/custom-bets — Liste des paris ouverts
// ─────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const bets = await CustomBet.find({ status: 'open' })
      .populate('creatorId', 'username avatar')
      .sort({ createdAt: -1 });
    res.json(bets);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────
// GET /api/custom-bets/mine — Mes paris
// ─────────────────────────────────────────
router.get('/mine', auth, async (req, res) => {
  try {
    const bets = await CustomBet.find({
      $or: [{ creatorId: req.user.id }, { acceptedBy: req.user.id }]
    })
      .populate('creatorId', 'username avatar')
      .populate('acceptedBy', 'username avatar')
      .sort({ createdAt: -1 });
    res.json(bets);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────
// GET /api/custom-bets/:id — Détail d'un pari
// ─────────────────────────────────────────
router.get('/:id', auth, async (req, res) => {
  try {
    const bet = await CustomBet.findById(req.params.id)
      .populate('creatorId', 'username avatar')
      .populate('acceptedBy', 'username avatar');

    if (!bet) return res.status(404).json({ message: 'Pari introuvable' });

    // Récupérer les votes
    const votes = await CustomBetVote.find({ betId: bet._id })
      .populate('userId', 'username avatar');

    res.json({ bet, votes });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────
// POST /api/custom-bets/:id/accept — Accepter un pari
// ─────────────────────────────────────────
router.post('/:id/accept', auth, async (req, res) => {
  try {
    const bet = await CustomBet.findById(req.params.id);
    if (!bet) return res.status(404).json({ message: 'Pari introuvable' });
    if (bet.status !== 'open') return res.status(400).json({ message: 'Pari non disponible' });
    if (bet.creatorId.toString() === req.user.id)
      return res.status(400).json({ message: 'Vous ne pouvez pas accepter votre propre pari' });

    const user = await User.findById(req.user.id);
    if (user.credits < bet.opponentAmount)
      return res.status(400).json({ message: `Il vous faut ${bet.opponentAmount} crédits pour accepter` });

    // Bloquer les crédits de l'adversaire
    user.credits -= bet.opponentAmount;
    await user.save();

    bet.acceptedBy = req.user.id;
    bet.status = 'matched';
    await bet.save();

    // Notifier le créateur
    const creator = await User.findById(bet.creatorId);
    creator.notifications.push({
      message: `${user.username} a accepté votre pari : "${bet.question}"`
    });
    await creator.save();

    res.json({ message: 'Pari accepté !', bet, credits: user.credits });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────
// POST /api/custom-bets/:id/close — Clôturer avant terme (créateur)
// ─────────────────────────────────────────
router.post('/:id/close', auth, async (req, res) => {
  try {
    const bet = await CustomBet.findById(req.params.id);
    if (!bet) return res.status(404).json({ message: 'Pari introuvable' });
    if (bet.creatorId.toString() !== req.user.id)
      return res.status(403).json({ message: 'Seul le créateur peut clôturer' });
    if (bet.status !== 'matched')
      return res.status(400).json({ message: 'Le pari doit être en cours (matched)' });

    bet.status = 'pending_result';
    await bet.save();

    res.json({ message: 'Pari clôturé, les votes sont ouverts', bet });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────
// POST /api/custom-bets/:id/vote — Voter (spectateurs uniquement)
// ─────────────────────────────────────────
router.post('/:id/vote', auth, async (req, res) => {
  try {
    const { vote } = req.body; // 'creator_wins' ou 'acceptor_wins'
    const bet = await CustomBet.findById(req.params.id);

    if (!bet) return res.status(404).json({ message: 'Pari introuvable' });
    if (bet.status !== 'pending_result')
      return res.status(400).json({ message: 'Les votes ne sont pas ouverts' });

    // Ni le créateur ni l'adversaire ne peuvent voter
    if (bet.creatorId.toString() === req.user.id || bet.acceptedBy?.toString() === req.user.id)
      return res.status(403).json({ message: 'Les joueurs ne peuvent pas voter' });

    if (!['creator_wins', 'acceptor_wins'].includes(vote))
      return res.status(400).json({ message: 'Vote invalide' });

    // Créer le vote (l'index unique empêche le double vote)
    await CustomBetVote.create({ betId: bet._id, userId: req.user.id, vote });

    // Compter les votes
    const votes = await CustomBetVote.find({ betId: bet._id });
    const creatorWinsCount = votes.filter(v => v.vote === 'creator_wins').length;
    const acceptorWinsCount = votes.filter(v => v.vote === 'acceptor_wins').length;

    // Résoudre si au moins 2 votes et majorité claire
    if (votes.length >= 2 && creatorWinsCount !== acceptorWinsCount) {
      const result = creatorWinsCount > acceptorWinsCount ? 'creator_wins' : 'acceptor_wins';
      await resolveBet(bet, result);
    }

    res.json({ message: 'Vote enregistré', votes: { creatorWins: creatorWinsCount, acceptorWins: acceptorWinsCount } });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'Vous avez déjà voté' });
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────
// Fonction interne : résoudre un pari
// ─────────────────────────────────────────
async function resolveBet(bet, result) {
  bet.result = result;
  bet.status = 'resolved';
  await bet.save();

  const totalPot = bet.creatorAmount + bet.opponentAmount;
  const winnerId = result === 'creator_wins' ? bet.creatorId : bet.acceptedBy;
  const loserId = result === 'creator_wins' ? bet.acceptedBy : bet.creatorId;

  const winner = await User.findById(winnerId);
  const loser = await User.findById(loserId);

  winner.credits += totalPot;
  winner.notifications.push({
    message: `🏆 Vous avez gagné le pari "${bet.question}" ! +${totalPot} crédits`
  });

  loser.notifications.push({
    message: `❌ Vous avez perdu le pari "${bet.question}" (-${result === 'creator_wins' ? bet.opponentAmount : bet.creatorAmount} crédits)`
  });

  await winner.save();
  await loser.save();
}

module.exports = router;
