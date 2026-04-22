const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
  origin: ['https://vergnemaxime31-ctrl.github.io', 'http://localhost:3001'],
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
const blackjackRoutes = require('./routes/blackjack');
app.use('/api/blackjack', blackjackRoutes);
app.use('/api/users', require('./routes/users'));
app.use('/api/sports', require('./routes/sports'));

// Connexion MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connecté'))
  .catch(err => console.log(err));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Serveur lancé sur le port ${PORT}`));

app.use(express.static('frontend'));
