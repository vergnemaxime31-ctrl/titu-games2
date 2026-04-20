const router = require('express').Router();
const { playGame, getHistory } = require('../controllers/gameController');
const auth = require('../middleware/auth');

router.post('/play', auth, playGame);
router.get('/history', auth, getHistory);

module.exports = router;
