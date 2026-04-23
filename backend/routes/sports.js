const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Match = require('../models/Match');
const SportBet = require('../models/SportBet');
const User = require('../models/User');

// GET /api/sports/matches - matchs disponibles (depuis DB)
router.get('/matches', auth, async (req, res) => {
  try {
    const matches = await Match.find({ status: 'upcoming' }).sort({ matchDate: 1 });
    res.json(matches);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/sports/bet - placer un pari
router.post('/bet', auth, async (req, res) => {
  try {
    const { matchId, prediction, amount } = req.body;

    if (!['1', 'N', '2'].includes(prediction))
      return res.status(400).json({ message: 'Prédiction invalide' });
    if (!amount || amount <= 0)
      return res.status(400).json({ message: 'Mise invalide' });

    const match = await Match.findById(matchId);
    if (!match) return res.status(404).json({ message: 'Match introuvable' });
    if (match.status !== 'upcoming')
      return res.status(400).json({ message: 'Ce match n\'est plus disponible' });

    const user = await User.findById(req.user.id);
    if (user.credits < amount)
      return res.status(400).json({ message: 'Crédits insuffisants' });

    // Vérifier pari existant
    const existing = await SportBet.findOne({ userId: req.user.id, matchId, status: 'pending' });
    if (existing) return res.status(400).json({ message: 'Vous avez déjà parié sur ce match' });

    const oddsMap = { '1': match.odds.home, 'N': match.odds.draw, '2': match.odds.away };
    const odds = oddsMap[prediction];
    if (!odds) return res.status(400).json({ message: 'Cote non disponible' });

    user.credits -= amount;
    await user.save();

    const bet = await SportBet.create({
      userId: req.user.id,
      matchId,
      prediction,
      amount,
      odds,
      status: 'pending'
    });

    res.json({ message: 'Pari placé !', bet, credits: user.credits });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/sports/bets - historique des paris du user
router.get('/bets', auth, async (req, res) => {
  try {
    const bets = await SportBet.find({ userId: req.user.id })
      .populate('matchId')
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(bets);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/sports/resolve/:matchId - résoudre un match (admin)
router.post('/resolve/:matchId', async (req, res) => {
  try {
    const { result, scoreHome, scoreAway } = req.body; // result: '1','N','2'
    const match = await Match.findById(req.params.matchId);
    if (!match) return res.status(404).json({ message: 'Match introuvable' });

    match.result = result;
    match.status = 'finished';
    match.score = { home: scoreHome, away: scoreAway };
    await match.save();

    // Résoudre tous les paris liés
    const bets = await SportBet.find({ matchId: match._id, status: 'pending' });
    for (const bet of bets) {
      const user = await User.findById(bet.userId);
      if (bet.prediction === result) {
        bet.status = 'won';
        const gain = Math.floor(bet.amount * bet.odds);
        bet.creditsChange = gain - bet.amount;
        user.credits += gain;
        user.notifications?.push({ message: `Paris sportifs - Gagné ! +${bet.creditsChange} crédits (${match.homeTeam} vs ${match.awayTeam})` });
      } else {
        bet.status = 'lost';
        bet.creditsChange = -bet.amount;
        user.notifications?.push({ message: `Paris sportifs - Perdu ! -${bet.amount} crédits (${match.homeTeam} vs ${match.awayTeam})` });
      }
      await bet.save();
      await user.save();
    }

    res.json({ message: `Match résolu, ${bets.length} paris traités` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/sports/matches - créer un match manuellement (admin)
router.post('/matches', async (req, res) => {
  try {
    const { homeTeam, awayTeam, league, matchDate, odds } = req.body;

    if (!homeTeam || !awayTeam || !odds?.home || !odds?.away)
      return res.status(400).json({ message: 'Champs manquants' });

    const match = await Match.create({
      homeTeam,
      awayTeam,
      league: league || 'Autre',
      matchDate: matchDate ? new Date(matchDate) : new Date(),
      odds: {
        home: odds.home,
        draw: odds.draw || null,
        away: odds.away
      },
      status: 'upcoming'
    });

    res.json({ message: 'Match créé !', match });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Supprimer un match
router.delete('/matches/:matchId', async (req, res) => {
  await Match.findByIdAndDelete(req.params.matchId);
  res.json({ message: 'Match supprimé' });
});

// Supprimer tous les matchs
router.delete('/matches', async (req, res) => {
  await Match.deleteMany({});
  res.json({ message: 'Tous les matchs supprimés' });
});


module.exports = router;
