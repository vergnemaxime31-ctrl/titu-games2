const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Match = require('../models/Match');
const SportBet = require('../models/SportBet');
const User = require('../models/User');
const axios = require('axios');

const API_KEY = process.env.API_FOOTBALL_KEY;
const API_BASE = 'https://v3.football.api-sports.io';

// GET /api/sports/matches - matchs disponibles (depuis DB)
router.get('/matches', auth, async (req, res) => {
  try {
    const matches = await Match.find({ status: 'upcoming' }).sort({ matchDate: 1 });
    res.json(matches);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/sports/fetch - récupère les matchs depuis l'API (admin/cron)
router.post('/fetch', async (req, res) => {
  try {
    const sports = ['soccer_france_ligue1', 'soccer_spain_la_liga', 'soccer_england_league1'];
    let totalAdded = 0;

    for (const sport of sports) {
      const { data } = await axios.get(`${API_BASE}/sports/${sport}/odds`, {
        params: {
          apiKey: API_KEY,
          regions: 'eu',
          markets: 'h2h',
          oddsFormat: 'decimal',
          dateFormat: 'iso'
        }
      });

      for (const match of data) {
        const exists = await Match.findOne({ apiMatchId: match.id });
        if (exists) continue;

        const bookmaker = match.bookmakers?.[0];
        const market = bookmaker?.markets?.[0];
        const outcomes = market?.outcomes || [];

        const homeOdd = outcomes.find(o => o.name === match.home_team)?.price;
        const awayOdd = outcomes.find(o => o.name === match.away_team)?.price;
        const drawOdd = outcomes.find(o => o.name === 'Draw')?.price;

        if (!homeOdd || !awayOdd) continue;

        await Match.create({
          homeTeam: match.home_team,
          awayTeam: match.away_team,
          league: sport,
          matchDate: new Date(match.commence_time),
          odds: { home: homeOdd, draw: drawOdd || null, away: awayOdd },
          apiMatchId: match.id,
          status: 'upcoming'
        });
        totalAdded++;
      }
    }

    res.json({ message: `${totalAdded} matchs ajoutés` });
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

module.exports = router;
