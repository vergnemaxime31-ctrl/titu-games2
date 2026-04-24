// ============ ÉTAT DU JEU ============
let gameState = {
  gameId: null,
  phase: 'idle',
  bet: 0,
  lastBet: 0,
  credits: 0,
  splitActive: false,
  currentHand: 1
};

// ============ INIT ============
async function initBlackjack() {
  renderIdle();
  try {
    const res = await fetch(`${API_URL}/users/me`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const data = await res.json();
    const profile = data?.user ?? data;
    const credits = profile?.coins ?? profile?.credits ?? 0;
    updateCreditsDisplay(credits);
  } catch (err) {}
}

// ============ PHASES D'AFFICHAGE ============

function renderIdle() {
  gameState.phase = 'idle';
  gameState.splitActive = false;
  gameState.currentHand = 1;

  document.getElementById('bj-dealer-cards').innerHTML = '<div class="playing-card empty">?</div>';
  document.getElementById('bj-player-cards').innerHTML = '<div class="playing-card empty">?</div>';
  document.getElementById('bj-player-total').textContent = '';
  document.getElementById('bj-dealer-total').textContent = '';
  document.getElementById('bj-hand-indicator').textContent = '';
  document.getElementById('bj-message').textContent = '';
  document.getElementById('bj-message').className = 'bj-message';
  document.getElementById('bj-split-area').style.display = 'none';
  document.getElementById('bj-player-cards-2').innerHTML = '';
  document.getElementById('bj-player-total-2').textContent = '';

  document.getElementById('bj-bet-area').style.display = 'none';
  document.getElementById('bj-action-area').style.display = 'none';
  document.getElementById('bj-btn-play-area').style.display = 'block';
  document.getElementById('bj-btn-replay').style.display = gameState.lastBet > 0 ? 'block' : 'none';
}

function renderBetting() {
  gameState.phase = 'betting';
  selectedBet = 0;
  document.getElementById('bj-selected-bet').textContent = '0';
  document.getElementById('bj-bet-area').style.display = 'block';
  document.getElementById('bj-action-area').style.display = 'none';
  document.getElementById('bj-btn-play-area').style.display = 'none';
  document.getElementById('bj-message').textContent = '';
}

async function renderPlaying(data) {
  gameState.phase = 'playing';

  document.getElementById('bj-bet-area').style.display = 'none';
  document.getElementById('bj-btn-play-area').style.display = 'none';
  document.getElementById('bj-action-area').style.display = 'block';
  document.getElementById('bj-message').textContent = '';
  document.getElementById('bj-dealer-total').textContent = '';
  document.getElementById('bj-player-total').textContent = '';

  const playerArea = document.getElementById('bj-player-cards');
  const dealerArea = document.getElementById('bj-dealer-cards');
  playerArea.innerHTML = '';
  dealerArea.innerHTML = '';

  setActionButtonsEnabled(false);

  playerArea.appendChild(createCardElement(data.playerCards[0]));
  await delay(DEAL_DELAY);

  dealerArea.appendChild(createCardElement(data.dealerCards[0]));
  await delay(DEAL_DELAY);

  playerArea.appendChild(createCardElement(data.playerCards[1]));
  document.getElementById('bj-player-total').textContent = `Total : ${data.playerTotal}`;
  await delay(DEAL_DELAY);

  // Toujours cacher la 2e carte du croupier pendant la phase playing
  dealerArea.appendChild(createCardElement('?'));
  await delay(DEAL_DELAY);

  setActionButtonsEnabled(true);

  document.getElementById('bj-btn-double').style.display = 'block';
  document.getElementById('bj-btn-double').disabled = false;

  if (data.canSplit) {
    document.getElementById('bj-btn-split').style.display = 'block';
  } else {
    document.getElementById('bj-btn-split').style.display = 'none';
  }
}

async function renderEnded(data) {
  gameState.phase = 'ended';

  document.getElementById('bj-action-area').style.display = 'none';
  document.getElementById('bj-bet-area').style.display = 'none';

  const dealerCards = data.dealerCards ?? ['?'];
  const dealerArea = document.getElementById('bj-dealer-cards');
  dealerArea.innerHTML = '';

  for (let i = 0; i < dealerCards.length; i++) {
    dealerArea.appendChild(createCardElement(dealerCards[i]));
    if (i >= 1) {
      await delay(DEAL_DELAY);
    }
  }

  document.getElementById('bj-dealer-total').textContent = data.dealerTotal ? `Croupier : ${data.dealerTotal}` : '';

  const msg = document.getElementById('bj-message');

  if (gameState.splitActive && data.hand1 && data.hand2) {
    document.getElementById('bj-split-area').style.display = 'block';
    updatePlayerCards(data.hand1.cards, 1);
    document.getElementById('bj-player-total').textContent = `Main 1 : ${data.hand1.total} — ${labelResult(data.hand1.result)}`;
    updatePlayerCards(data.hand2.cards, 2);
    document.getElementById('bj-player-total-2').textContent = `Main 2 : ${data.hand2.total} — ${labelResult(data.hand2.result)}`;

    const totalGain = (data.hand1.creditsChange ?? 0) + (data.hand2.creditsChange ?? 0);
    msg.textContent = `Résultat : ${totalGain >= 0 ? '+' : ''}${totalGain} crédits`;
    msg.className = `bj-message ${totalGain > 0 ? 'win' : totalGain < 0 ? 'lose' : 'push'}`;
  } else {
    updatePlayerCards(data.playerCards, 1);
    document.getElementById('bj-player-total').textContent = `Total : ${data.playerTotal}`;

    if (data.result === 'blackjack') {
      msg.textContent = '🃏 Blackjack ! Vous gagnez !';
      msg.className = 'bj-message win';
    } else if (data.result === 'win') {
      msg.textContent = `✅ Gagné ! +${data.creditsChange} crédits`;
      msg.className = 'bj-message win';
    } else if (data.result === 'lose') {
      msg.textContent = `❌ Perdu ! -${Math.abs(data.creditsChange)} crédits`;
      msg.className = 'bj-message lose';
    } else {
      msg.textContent = '🤝 Égalité !';
      msg.className = 'bj-message push';
    }
  }

  updateCreditsDisplay(data.credits ?? gameState.credits);
  document.getElementById('bj-btn-play-area').style.display = 'block';
  document.getElementById('bj-btn-replay').style.display = gameState.lastBet > 0 ? 'block' : 'none';
}

// ============ CARTES ============

function updatePlayerCards(cards, hand = 1) {
  const id = hand === 2 ? 'bj-player-cards-2' : 'bj-player-cards';
  const area = document.getElementById(id);
  if (!area || !cards) return;
  area.innerHTML = cards.map(c =>
    `<div class="playing-card ${getCardColor(c)}">${c}</div>`
  ).join('');
}

function updateDealerCards(cards) {
  const area = document.getElementById('bj-dealer-cards');
  if (!area || !cards) return;
  area.innerHTML = cards.map(c =>
    c === '?' ? `<div class="playing-card hidden">?</div>` : `<div class="playing-card ${getCardColor(c)}">${c}</div>`
  ).join('');
}

function getCardColor(card) {
  if (!card || card === '?') return '';
  return (card.includes('♥') || card.includes('♦')) ? 'red' : '';
}

function labelResult(result) {
  return result === 'blackjack' ? 'Blackjack !' :
         result === 'win' ? 'Gagné ✅' :
         result === 'lose' ? 'Perdu ❌' : 'Égalité 🤝';
}

// ============ MISE ============

let selectedBet = 0;

function addBet(amount) {
  selectedBet += amount;
  document.getElementById('bj-selected-bet').textContent = selectedBet;
}

function resetBet() {
  selectedBet = 0;
  document.getElementById('bj-selected-bet').textContent = '0';
}

// ============ ACTIONS ============

function bjPlay() {
  renderBetting();
}

async function bjReplay() {
  if (gameState.lastBet <= 0) {
    document.getElementById('bj-message').textContent = 'Aucune mise précédente';
    return;
  }
  selectedBet = gameState.lastBet;
  document.getElementById('bj-selected-bet').textContent = selectedBet;
  await bjConfirmBet();
}

async function bjConfirmBet() {
  if (selectedBet <= 0) {
    document.getElementById('bj-message').textContent = 'Choisissez une mise';
    return;
  }

  // ===== MODE PVP =====
  if (pvpState.active && pvpState.sessionId) {
    if (selectedBet > pvpState.capRestant) {
      document.getElementById('bj-message').textContent = `Mise max : ${pvpState.capRestant} crédits`;
      return;
    }
    try {
      const res = await fetch(`${API_URL}/pvp/session/${pvpState.sessionId}/hand`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ bet: selectedBet })
      });
      const data = await res.json();
      if (!res.ok) {
        document.getElementById('bj-message').textContent = data.error || 'Erreur';
        return;
      }

      pvpState.netDifference = data.netDifference;
      pvpState.capRestant = data.capRestant;
      updatePvpStatus();
      gameState.lastBet = selectedBet;

      // Animer la distribution avant le résultat
      await renderPlaying({
        playerCards: data.playerCards,
        dealerCards: [data.dealerCards[0], '?'],
        playerTotal: handTotalDisplay(data.playerCards),
        canSplit: false
      });

      // Pause pour que le joueur voie ses cartes
      await delay(800);

      // Révéler le résultat final
      await renderEnded({
        result: data.result,
        playerCards: data.playerCards,
        dealerCards: data.dealerCards,
        dealerTotal: handTotalDisplay(data.dealerCards),
        playerTotal: handTotalDisplay(data.playerCards),
        creditsChange: data.creditsTransferred,
        credits: data.attackerCredits
      });

      if (data.sessionClosed) {
        document.getElementById('bj-pvp-status').textContent += ' — Cap atteint';
        document.getElementById('bj-pvp-btn-quit').style.display = 'none';
      }
    } catch (err) {
      document.getElementById('bj-message').textContent = 'Erreur serveur';
    }
    return;
  }

  // ===== MODE NORMAL =====
  document.getElementById('bj-split-area').style.display = 'none';
  document.getElementById('bj-player-cards-2').innerHTML = '';
  document.getElementById('bj-player-total-2').textContent = '';
  document.getElementById('bj-hand-indicator').textContent = '';
  gameState.bet = selectedBet;
  gameState.splitActive = false;
  gameState.currentHand = 1;

  try {
    const res = await fetch(`${API_URL}/blackjack/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ bet: selectedBet })
    });
    const data = await res.json();
    if (!res.ok) {
      document.getElementById('bj-message').textContent = data.message || 'Erreur';
      return;
    }

    gameState.gameId = data.gameId;
    gameState.lastBet = selectedBet;
    updateCreditsDisplay(data.credits);

    if (data.result === 'blackjack') {
      // Animer la distribution puis afficher le blackjack
      await renderPlaying({
        playerCards: data.playerCards,
        dealerCards: [data.dealerCards[0], '?'],
        playerTotal: data.playerTotal,
        canSplit: false
      });
      await delay(600);
      await renderEnded({
        ...data,
        dealerCards: data.dealerCards ?? ['?', '?'],
        dealerTotal: data.dealerTotal ?? '?'
      });
    } else {
      await renderPlaying(data);
    }
  } catch (err) {
    document.getElementById('bj-message').textContent = 'Erreur serveur';
  }
}

async function bjHit() {
  try {
    const res = await fetch(`${API_URL}/blackjack/hit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        gameId: gameState.gameId,
        hand: gameState.splitActive ? gameState.currentHand : undefined
      })
    });

    const data = await res.json();
    if (!res.ok) return;

    const hand = gameState.currentHand;

    if (gameState.splitActive && data.hand1 && data.hand2) {
      await renderEnded(data);
      return;
    }

    if (data.switchToHand2) {
      updatePlayerCards(data.hand1Cards, 1);
      document.getElementById('bj-player-total').textContent = `Total : ${data.hand1Total} — Perdu ❌`;
      gameState.currentHand = 2;
      document.getElementById('bj-hand-indicator').textContent = '▶ Main 2 active';
      document.getElementById('bj-split-area').style.display = 'block';
      document.getElementById('bj-btn-double').style.display = 'block';
      document.getElementById('bj-btn-double').disabled = false;
      document.getElementById('bj-btn-split').style.display = 'none';
      return;
    }

    updatePlayerCards(data.playerCards, hand);

    if (hand === 2) {
      document.getElementById('bj-player-total-2').textContent = `Total : ${data.playerTotal}`;
    } else {
      document.getElementById('bj-player-total').textContent = `Total : ${data.playerTotal}`;
    }

    document.getElementById('bj-btn-double').style.display = 'none';
    document.getElementById('bj-btn-split').style.display = 'none';

    if (data.result === 'lose' && !gameState.splitActive) {
      await renderEnded({
        ...data,
        dealerCards: data.dealerCards ?? ['?'],
        dealerTotal: data.dealerTotal ?? '?'
      });
    }

  } catch (err) {
    document.getElementById('bj-message').textContent = 'Erreur serveur';
  }
}

async function bjStand() {
  try {
    const res = await fetch(`${API_URL}/blackjack/stand`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        gameId: gameState.gameId,
        hand: gameState.splitActive ? gameState.currentHand : undefined
      })
    });

    const data = await res.json();
    if (!res.ok) return;

    if (data.switchToHand2) {
      gameState.currentHand = 2;
      document.getElementById('bj-hand-indicator').textContent = '▶ Main 2 active';

      updatePlayerCards(data.hand1Cards, 1);
      document.getElementById('bj-player-total').textContent = `Total : ${data.hand1Total} — Stand`;

      updatePlayerCards(data.hand2Cards, 2);
      document.getElementById('bj-player-total-2').textContent = `Total : ${data.hand2Total}`;
      document.getElementById('bj-split-area').style.display = 'block';

      document.getElementById('bj-action-area').style.display = 'block';
      document.getElementById('bj-btn-double').style.display = 'block';
      document.getElementById('bj-btn-double').disabled = false;
      document.getElementById('bj-btn-split').style.display = 'none';
      return;
    }

    await renderEnded(data);

  } catch (err) {
    document.getElementById('bj-message').textContent = 'Erreur serveur';
  }
}

async function bjDouble() {
  try {
    const res = await fetch(`${API_URL}/blackjack/double`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        gameId: gameState.gameId,
        hand: gameState.splitActive ? gameState.currentHand : undefined
      })
    });

    const data = await res.json();
    if (!res.ok) {
      document.getElementById('bj-message').textContent = data.message || 'Erreur';
      return;
    }

    updateCreditsDisplay(data.credits);

    if (data.switchToHand2) {
      gameState.currentHand = 2;
      document.getElementById('bj-hand-indicator').textContent = '▶ Main 2 active';

      updatePlayerCards(data.hand1Cards, 1);
      document.getElementById('bj-player-total').textContent = `Total : ${data.hand1Total} — Stand`;

      updatePlayerCards(data.hand2Cards, 2);
      document.getElementById('bj-player-total-2').textContent = `Total : ${data.hand2Total}`;
      document.getElementById('bj-split-area').style.display = 'block';

      document.getElementById('bj-action-area').style.display = 'block';
      document.getElementById('bj-btn-double').style.display = 'block';
      document.getElementById('bj-btn-double').disabled = false;
      document.getElementById('bj-btn-split').style.display = 'none';
      return;
    }

    await renderEnded(data);

  } catch (err) {
    document.getElementById('bj-message').textContent = 'Erreur serveur';
  }
}

// ============ SPLIT ============

async function bjSplit() {
  try {
    const res = await fetch(`${API_URL}/blackjack/split`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ gameId: gameState.gameId })
    });

    const data = await res.json();
    if (!res.ok) {
      document.getElementById('bj-message').textContent = data.message || 'Erreur split';
      return;
    }

    gameState.splitActive = true;
    gameState.currentHand = 1;

    document.getElementById('bj-split-area').style.display = 'block';
    document.getElementById('bj-hand-indicator').textContent = '▶ Main 1 active';
    document.getElementById('bj-btn-split').style.display = 'none';

    updatePlayerCards(data.hand1Cards, 1);
    document.getElementById('bj-player-total').textContent = `Total : ${data.hand1Total}`;
    updatePlayerCards(data.hand2Cards, 2);
    document.getElementById('bj-player-total-2').textContent = `Total : ${data.hand2Total}`;

    document.getElementById('bj-btn-double').style.display = 'block';
    document.getElementById('bj-btn-double').disabled = false;

    updateCreditsDisplay(data.credits);

  } catch (err) {
    document.getElementById('bj-message').textContent = 'Erreur serveur';
  }
}

// ============ HISTORIQUE ============

function toggleHistory() {
  const container = document.getElementById('bj-history');
  if (container.style.display === 'none') {
    container.style.display = 'block';
    loadHistory();
  } else {
    container.style.display = 'none';
  }
}

async function loadHistory() {
  try {
    const res = await fetch(`${API_URL}/blackjack/history`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const games = await res.json();
    const container = document.getElementById('bj-history');
    container.innerHTML = '';

    if (!games.length) {
      container.innerHTML = '<div class="bet-item"><span class="bet-label">Aucune partie</span></div>';
      return;
    }

    games.forEach(g => {
      const div = document.createElement('div');
      div.className = 'bet-item';
      const label = g.result === 'blackjack' ? 'Blackjack !' :
                    g.result === 'win' ? 'Gagné' :
                    g.result === 'lose' ? 'Perdu' :
                    g.result === 'split' ? 'Split' : 'Égalité';
      const amount = g.creditsChange >= 0 ? `+${g.creditsChange}` : `${g.creditsChange}`;
      const cls = g.creditsChange > 0 ? 'positive' : g.creditsChange < 0 ? 'negative' : '';
      div.innerHTML = `<span class="bet-label">${label}</span><span class="bet-amount ${cls}">${amount} crédits</span>`;
      container.appendChild(div);
    });

  } catch (err) {}
}

// ============ UTILITAIRES ============

const DEAL_DELAY = 600;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createCardElement(card) {
  const div = document.createElement('div');
  if (card === '?') {
    div.className = 'playing-card hidden card-deal';
    div.textContent = '?';
  } else {
    div.className = `playing-card ${getCardColor(card)} card-deal`;
    div.textContent = card;
  }
  return div;
}

function setActionButtonsEnabled(enabled) {
  const ids = ['bj-btn-hit', 'bj-btn-stand', 'bj-btn-double', 'bj-btn-split'];
  ids.forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = !enabled;
  });
}

function updateCreditsDisplay(credits) {
  if (credits === undefined || credits === null) return;
  gameState.credits = credits;
  const el = document.getElementById('bj-credits');
  if (el) el.textContent = `Solde: ${credits} crédits`;
  const navCredits = document.querySelector('.credits');
  if (navCredits) navCredits.textContent = credits + ' crédits';
}

function handTotalDisplay(cards) {
  if (!cards || !cards.length) return '?';
  let total = 0, aces = 0;
  for (const c of cards) {
    if (c === '?' ) continue;
    if (['J','Q','K'].includes(c)) total += 10;
    else if (c === 'A') { total += 11; aces++; }
    else total += parseInt(c);
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

// ============ MODE PVP ============

let pvpState = {
  active: false,
  sessionId: null,
  targetId: null,
  targetName: null,
  cap: 0,
  netDifference: 0,
  capRestant: 0
};

async function enablePvpMode() {
  pvpState.active = true;
  document.getElementById('bj-pvp-panel').style.display = 'block';
  document.getElementById('bj-pvp-btn-activate').style.display = 'none';
  await loadPvpTargets();
}

function disablePvpMode() {
  pvpState = { active: false, sessionId: null, targetId: null, targetName: null, cap: 0, netDifference: 0, capRestant: 0 };
  document.getElementById('bj-pvp-panel').style.display = 'none';
  document.getElementById('bj-pvp-btn-activate').style.display = 'block';
  document.getElementById('bj-pvp-status').textContent = '';
  renderIdle();
}

async function loadPvpTargets() {
  try {
    const res = await fetch(`${API_URL}/pvp/targets`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const targets = await res.json();

    const select = document.getElementById('bj-pvp-target-select');
    select.innerHTML = '<option value="">— Choisir une cible —</option>';
    targets.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = `${t.username} (${t.credits} crédits)`;
      select.appendChild(opt);
    });
  } catch (err) {
    document.getElementById('bj-pvp-status').textContent = 'Erreur chargement cibles';
  }
}

async function startPvpSession() {
  const select = document.getElementById('bj-pvp-target-select');
  const targetId = select.value;
  if (!targetId) {
    document.getElementById('bj-pvp-status').textContent = 'Choisissez une cible';
    return;
  }

  try {
    const res = await fetch(`${API_URL}/pvp/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ targetId })
    });

    const data = await res.json();
    if (!res.ok) {
      document.getElementById('bj-pvp-status').textContent = data.error || 'Erreur';
      return;
    }

    pvpState.sessionId = data.sessionId;
    pvpState.targetId = targetId;
    pvpState.targetName = select.options[select.selectedIndex].textContent.split(' (')[0];
    pvpState.cap = data.cap;
    pvpState.capRestant = data.cap;
    pvpState.netDifference = 0;

    updatePvpStatus();

    document.getElementById('bj-pvp-target-select').style.display = 'none';
    document.getElementById('bj-pvp-btn-start').style.display = 'none';
    document.getElementById('bj-pvp-btn-quit').style.display = 'block';

  } catch (err) {
    document.getElementById('bj-pvp-status').textContent = 'Erreur serveur';
  }
}

async function quitPvpSession() {
  if (!pvpState.sessionId) { disablePvpMode(); return; }

  try {
    await fetch(`${API_URL}/pvp/session/${pvpState.sessionId}/quit`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
  } catch (err) {}

  disablePvpMode();
}

function updatePvpStatus() {
  const diff = pvpState.netDifference;
  const sign = diff >= 0 ? '+' : '';
  document.getElementById('bj-pvp-status').textContent =
    `⚔️ ${pvpState.targetName} | Cap : ${pvpState.cap} | Restant : ${pvpState.capRestant} | Bilan : ${sign}${diff}`;
}

// ============ NOTIFICATIONS PVP ============

async function loadPvpNotifications() {
  try {
    const res = await fetch(`${API_URL}/pvp/notifications`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const notifs = await res.json();
    if (!notifs.length) return;

    const container = document.getElementById('bj-pvp-notifs');
    if (!container) return;
    container.innerHTML = notifs.map(n => `<div class="pvp-notif">🔔 ${n.message}</div>`).join('');
    container.style.display = 'block';
  } catch (err) {}
}

// ============ DÉMARRAGE ============

document.addEventListener('DOMContentLoaded', () => {
  initBlackjack();
  loadPvpNotifications();
});
