// Coût pour passer au niveau suivant
function getLevelUpCost(currentLevel) {
  const baseCosts = [0, 2000, 4000, 7000, 12000, 20000, 35000, 60000];
  if (currentLevel < baseCosts.length) {
    return baseCosts[currentLevel];
  }
  // Au-delà du niveau 8, formule exponentielle
  return Math.round(60000 * Math.pow(1.7, currentLevel - 8));
}

// Revenu quotidien = 10% du coût du niveau suivant
function getDailyReward(currentLevel) {
  return Math.round(getLevelUpCost(currentLevel) * 0.1);
}

module.exports = { getLevelUpCost, getDailyReward };
