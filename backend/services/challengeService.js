const Challenge = require('../models/Challenge');
const UserChallenge = require('../models/UserChallenge');

async function trackProgress(userId, eventType, value = 1) {
  const now = new Date();

  // Trouver les défis actifs correspondant à cet event
  const challenges = await Challenge.find({
    type: eventType,
    active: true,
    weekStart: { $lte: now },
    weekEnd: { $gte: now }
  });

  for (const challenge of challenges) {
    let userChallenge = await UserChallenge.findOne({
      userId,
      challengeId: challenge._id
    });

    if (!userChallenge) {
      userChallenge = new UserChallenge({
        userId,
        challengeId: challenge._id,
        progress: 0
      });
    }

    if (!userChallenge.completed) {
      userChallenge.progress += value;
      if (userChallenge.progress >= challenge.target) {
        userChallenge.completed = true;
      }
      await userChallenge.save();
    }
  }
}

module.exports = { trackProgress };
