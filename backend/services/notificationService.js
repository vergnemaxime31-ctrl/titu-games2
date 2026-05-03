const { Notification, NOTIF_TYPES } = require('../models/Notification');
const User = require('../models/User');

async function notifyBlackjackAttack({ victimId, attackerId, attackerName, amount }) {
  await Notification.create({
    userId: victimId,
    type: NOTIF_TYPES.BLACKJACK_ATTACKED,
    title: 'Attaque PvP !',
    message: `${attackerName} vous a attaqué et a pris ${amount} crédits !`,
    metadata: { attackerId, attackerName, amount }
  });
}

async function notifyBlackjackDefended({ victimId, attackerId, attackerName, amount }) {
  await Notification.create({
    userId: victimId,
    type: NOTIF_TYPES.BLACKJACK_DEFENDED,
    title: 'Attaque repoussée !',
    message: `${attackerName} vous a attaqué mais a perdu ${amount} crédits !`,
    metadata: { attackerId, attackerName, amount }
  });
}

async function notifyBetResult({ userId, betTitle, won, amount }) {
  const type = won ? NOTIF_TYPES.BET_RESULT_WIN : NOTIF_TYPES.BET_RESULT_LOSE;
  const title = won ? 'Pari gagné !' : 'Pari perdu';
  const message = won
    ? `Vous avez gagné le pari "${betTitle}" ! +${amount} crédits`
    : `Vous avez perdu le pari "${betTitle}". -${amount} crédits`;

  await Notification.create({
    userId,
    type,
    title,
    message,
    metadata: { betTitle, amount }
  });
}

async function notifyNewCustomBet({ betTitle, betId, creatorName }) {
  // Broadcast to all users (userId = null)
  await Notification.create({
    userId: null,
    type: NOTIF_TYPES.BET_NEW_CUSTOM,
    title: 'Nouveau pari !',
    message: `${creatorName} a proposé un pari : "${betTitle}"`,
    metadata: { betId, creatorName }
  });
}

async function sendAnnouncement({ title, message }) {
  // Broadcast to all users (userId = null)
  await Notification.create({
    userId: null,
    type: NOTIF_TYPES.ADMIN_ANNOUNCEMENT,
    title,
    message,
    metadata: {}
  });
}

module.exports = {
  notifyBlackjackAttack,
  notifyBlackjackDefended,
  notifyBetResult,
  notifyNewCustomBet,
  sendAnnouncement
};
