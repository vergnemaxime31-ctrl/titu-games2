const Game = require('../models/Game');
const User = require('../models/User');

exports.playGame = async (req, res) => {
  try {
    const { gameType, bet } = req.body;
    const user = await User.findById(req.user.id);

    if (bet > user.coins) return res.status(400).json({ message: 'Pas assez de coins' });

    const win = Math.random() > 0.5;
    const gain = win ? bet : -bet;
    user.coins += gain;
    await user.save();

    const game = await Game.create({
      user: user._id,
      gameType,
      bet,
      result: win ? 'win' : 'lose',
      gain
    });

    res.json({ result: win ? 'win' : 'lose', gain, coins: user.coins, game });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getHistory = async (req, res) => {
  try {
    const games = await Game.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(20);
    res.json(games);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
