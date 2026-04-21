// ============ ÉTAT DU JEU ============
let gameState = {
  gameId: null,
  phase: 'idle',
  bet: 0,
  credits: 0
};

// ============ INIT ============
async function initBlackjack() {
  renderIdle();
  try {
    const res = await fetch(`${API_URL}/users/profile`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const data = await res.json();
    updateCreditsDisplay(data.credits);
  } catch (err) {}
}

// ============ PHASES D'AFFICHAGE ============

function renderIdle() {
  gameState.phase = 'idle';
  document.getElementById('bj-dealer-cards').innerHTML = '<div class="playing-card empty">?</div>';
  document.getElementById('bj-player-cards').innerHTML = '<div class="playing-card empty">?</div>';
  document.getElementById('bj-player-total').textContent = '';
  document.getElementById('bj-dealer-total').textContent = '';
  document.getElementById('bj-message').textContent = '';

  document.getElementById('bj-btn-play-area').style.display = 'block';
  document.getElementById('bj-bet-area').style.display = 'none';
  document.getElementById('bj-action-area').style.display = 'none';
}

function renderBetting() {
  gameState.phase = 'betting';
  document.getElementById('bj-btn-play-area').style.display = 'none';
  document.getElementById('bj-bet-area').style.display = 'block';
  document.getElementById('bj-action-area').style.display = 'none';
  document.getElementById('bj-message').textContent = 'Choisissez votre mise';
  document.getElementById('bj-selected-bet').textContent = '0';
  selectedBet = 0;
}

function renderPlaying(data) {
  gameState.phase = 'playing';
  document.getElementById('bj-btn-play-area').style.display = 'none';
  document.getElementById('bj-bet-area').style.display = 'none';
  document.getElementById('bj-action-area').style.display = 'block';

  updateCards(data.playerCards, data.dealerCards);
  document.getElementById('bj-player-total').textContent = `Total : ${data.playerTotal}`;
  document.getElementById('bj-dealer-total').textContent = '';
  document.getElementById('bj-message').textContent = '';

  document.getElementById('bj-btn-double').disabled = data.playerCards.length !== 2;
}

function renderEnded(data) {
  gameState.phase = 'ended';
  document.getElementById('bj-action-area').style.display = 'none';
  document.getElementById('bj-btn-play-area').style.display = 'block';

  updateCards(data.playerCards, data.dealerCards);
  document.getElementById('bj-player-total').textContent = `Total : ${data.playerTotal}`;
  document.getElementById('bj-dealer-total').textContent = `Croupier : ${data.dealerTotal}`;

  const msg = document.getElementById('bj-message');
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

  updateCreditsDisplay(data.credits);
}

// ============ CARTES ============

function updateCards(playerCards, dealerCards) {
  const playerArea = document.getElementById('bj-player-cards');
  const dealerArea = document.getElementById('bj-dealer-cards');

  playerArea.innerHTML = playerCards.map(c => `<div class="playing-card ${getCardColor(c)}">${c}</div>`).join('');
  dealerArea.innerHTML = dealerCards.map(c =>
    c === '?' ? `<div class="playing-card hidden">?</div>` : `<div class="playing-card ${getCardColor(c)}">${c}</div>`
  ).join('');
}

function getCardColor(card) {
  if (card === '?') return '';
  return card.includes('♥') || card.includes('♦') ? 'red' : '';
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

async function bjPlay() {
  renderBetting();
}

async function bjConfirmBet() {
  if (selectedBet <= 0) {
    document.getElementById('bj-message').textContent = 'Choisissez une mise';
    return;
  }

  gameState.bet = selectedBet;

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
      document.getElementById('bj-message').textContent = data.message;
      return;
    }

    gameState.gameId = data.gameId;
    updateCreditsDisplay(data.credits);

    if (data.result === 'blackjack') {
      renderEnded({ ...data, dealerTotal: '?' });
    } else {
      renderPlaying(data);
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
      body: JSON.stringify({ gameId: gameState.gameId })
    });

    const data = await res.json();
    if (!res.ok) return;

    updateCards(data.playerCards, ['?', '?']);
    document.getElementById('bj-player-total').textContent = `Total : ${data.playerTotal}`;
    document.getElementById('bj-btn-double').disabled = true;

    if (data.result === 'lose') {
      renderEnded({ ...data, dealerCards: ['?', '?'], dealerTotal: '?' });
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
      body: JSON.stringify({ gameId: gameState.gameId })
    });

    const data = await res.json();
    if (!res.ok) return;

    renderEnded(data);

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
      body: JSON.stringify({ gameId: gameState.gameId })
    });

    const data = await res.json();
    if (!res.ok) return;

    renderEnded(data);

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
      const label = g.result === 'blackjack' ? 'Blackjack !' : g.result === 'win' ? 'Gagné' : g.result === 'lose' ? 'Perdu' : 'Égalité';
      const amount = g.creditsChange >= 0 ? `+${g.creditsChange}` : `${g.creditsChange}`;
      const cls = g.creditsChange > 0 ? 'positive' : g.creditsChange < 0 ? 'negative' : '';
      div.innerHTML = `<span class="bet-label">${label}</span><span class="bet-amount ${cls}">${amount} crédits</span>`;
      container.appendChild(div);
    });

  } catch (err) {}
}

// ============ UTILITAIRES ============

function updateCreditsDisplay(credits) {
  gameState.credits = credits;
  const el = document.getElementById('bj-credits');
  if (el) el.textContent = `Solde: ${credits} crédits`;
}
