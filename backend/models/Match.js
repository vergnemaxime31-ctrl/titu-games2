const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  homeTeam: { type: String, required: true },   // "PSG"
  awayTeam: { type: String, required: true },   // "OM"
  league: { type: String },                      // "Ligue 1"
  matchDate: { type: Date },
  odds: {
    home: { type: Number },    // 2.10
    draw: { type: Number },    // 3.50
    away: { type: Number }     // 4.20
  },
  status: {
    type: String,
    enum: ['upcoming', 'ongoing', 'finished'],
    default: 'upcoming'
  },
  result: {
    type: String,
    enum: ['1', 'N', '2', null],
    default: null              // null tant que pas terminé
  },
  apiMatchId: { type: String }, // ID du match dans l'API externe
  score: {
    home: { type: Number, default: null },
    away: { type: Number, default: null }
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Match', matchSchema);
