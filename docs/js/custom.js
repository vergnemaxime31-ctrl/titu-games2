let currentBet = null; // pari sélectionné pour voter/détail

// ─────────────────────────────────────────
// INIT — appelé quand on va sur la page
// ─────────────────────────────────────────
async function initCustom() {
  updateCustomCredits();
  loadOpenBets();
  loadMyBets();
}

// ─────────────────────────────────────────
// Solde
// ─────────────────────────────────────────
async function updateCustomCredits() {
  try {
    const user = JSON.parse(localStorage.getItem('user'));
    
    // Affichage immédiat depuis le localStorage
    if (user?.credits !== undefined) {
      document.getElementById('custom-credits').textContent = user.credits + ' crédits';
    }

    // Mise à jour depuis le serveur
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/users/leaderboard`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    const me = data.find(u => u.username === user?.username);
    if (me) {
      document.getElementById('custom-credits').textContent = me.credits + ' crédits';
    }
  } catch (e) {
    console.error('Erreur crédits custom:', e);
  }
}

// ─────────────────────────────────────────
// Paris ouverts
// ─────────────────────────────────────────
async function loadOpenBets() {
  const container = document.getElementById('custom-open-list');
  container.innerHTML = '<p class="no-data">Chargement...</p>';

  try {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));
    const res = await fetch(`${API_URL}/custom-bets`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const bets = await res.json();

    if (!bets.length) {
      container.innerHTML = '<p class="no-data">Aucun pari disponible</p>';
      return;
    }

    container.innerHTML = bets.map(bet => `
      <div class="custom-bet-card">
        <div class="custom-bet-title">${bet.question}</div>
        <div class="custom-bet-meta">
          Cote: ${bet.odds} · Mise créateur: ${bet.creatorAmount} crédits · 
          Tu mises: <strong>${bet.opponentAmount} crédits</strong> · 
          Proposé par ${bet.creatorId?.username || '?'} · 
          Expire le ${new Date(bet.expiresAt).toLocaleDateString('fr-FR')}
        </div>
        <div class="custom-bet-actions">
          ${bet.creatorId?._id !== user?.id 
            ? `<button class="btn btn-success" onclick="acceptBet('${bet._id}', ${bet.opponentAmount})">Accepter</button>`
            : `<span style="color:var(--text-secondary);font-size:13px;">Votre pari</span>`
          }
        </div>
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = '<p class="no-data">Erreur de chargement</p>';
  }
}

// ─────────────────────────────────────────
// Mes paris
// ─────────────────────────────────────────
async function loadMyBets() {
  const container = document.getElementById('custom-my-list');
  container.innerHTML = '<p class="no-data">Chargement...</p>';

  try {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));
    const res = await fetch(`${API_URL}/custom-bets/mine`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const bets = await res.json();

    if (!bets.length) {
      container.innerHTML = '<p class="no-data">Aucun pari</p>';
      return;
    }

    const statusLabel = {
      open: '🟡 En attente',
      matched: '🟢 En cours',
      pending_result: '🗳️ Vote en cours',
      resolved: '✅ Résolu',
      cancelled: '❌ Annulé'
    };

    container.innerHTML = bets.map(bet => {
      const isCreator = bet.creatorId?._id === user?.id;
      const opponent = isCreator ? bet.acceptedBy : bet.creatorId;
      const resultLabel = bet.result 
        ? (bet.result === 'creator_wins' 
            ? (isCreator ? '🏆 Gagné' : '❌ Perdu') 
            : (isCreator ? '❌ Perdu' : '🏆 Gagné'))
        : '';

      return `
        <div class="custom-bet-card ${bet.status === 'resolved' ? 'faded' : ''}">
          <div class="custom-bet-title">${bet.question}</div>
          <div class="custom-bet-meta">
            ${statusLabel[bet.status] || bet.status} · 
            ${opponent ? 'vs ' + opponent.username : 'Pas encore d\'adversaire'} · 
            ${resultLabel}
          </div>
          ${bet.status === 'matched' && isCreator ? `
            <div class="custom-bet-actions">
              <button class="btn btn-danger" onclick="closeBet('${bet._id}')">Clôturer & ouvrir les votes</button>
            </div>
          ` : ''}
          ${bet.status === 'pending_result' ? `
            <div class="custom-bet-actions">
              <button class="btn btn-outline" onclick="openVoteModal('${bet._id}', \`${bet.question}\`)">🗳️ Voir les votes</button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  } catch (e) {
    container.innerHTML = '<p class="no-data">Erreur de chargement</p>';
  }
}

// ─────────────────────────────────────────
// Accepter un pari
// ─────────────────────────────────────────
async function acceptBet(betId, cost) {
  if (!confirm(`Accepter ce pari ? Cela vous coûtera ${cost} crédits.`)) return;

  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/custom-bets/${betId}/accept`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();

    if (!res.ok) return alert(data.message);

    alert('Pari accepté ! 🎉');
    document.getElementById('custom-credits').textContent = data.credits + ' crédits';
    loadOpenBets();
    loadMyBets();
  } catch (e) {
    alert('Erreur serveur');
  }
}

// ─────────────────────────────────────────
// Clôturer un pari (créateur)
// ─────────────────────────────────────────
async function closeBet(betId) {
  if (!confirm('Clôturer ce pari ? Les spectateurs pourront voter.')) return;

  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/custom-bets/${betId}/close`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();

    if (!res.ok) return alert(data.message);

    alert('Pari clôturé, votes ouverts ! 🗳️');
    loadMyBets();
  } catch (e) {
    alert('Erreur serveur');
  }
}

// ─────────────────────────────────────────
// Modal vote
// ─────────────────────────────────────────
let voteTargetId = null;

async function openVoteModal(betId, question) {
  voteTargetId = betId;
  document.getElementById('vote-modal-question').textContent = question;
  document.getElementById('vote-result-msg').textContent = '';

  // Charger les votes actuels
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/custom-bets/${betId}`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    const votes = data.votes || [];
    const creatorWins = votes.filter(v => v.vote === 'creator_wins').length;
    const acceptorWins = votes.filter(v => v.vote === 'acceptor_wins').length;
    document.getElementById('vote-counts').textContent = 
      `Créateur gagne: ${creatorWins} · Adversaire gagne: ${acceptorWins}`;
  } catch(e) {}

  document.getElementById('vote-modal').style.display = 'flex';
}

function closeVoteModal() {
  document.getElementById('vote-modal').style.display = 'none';
  voteTargetId = null;
}

async function submitVote(vote) {
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/custom-bets/${voteTargetId}/vote`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ vote })
    });
    const data = await res.json();

    const msg = document.getElementById('vote-result-msg');
    if (!res.ok) {
      msg.style.color = 'var(--accent-red)';
      msg.textContent = data.message;
    } else {
      msg.style.color = 'var(--accent-green)';
      msg.textContent = `✅ Vote enregistré ! Créateur: ${data.votes.creatorWins} · Adversaire: ${data.votes.acceptorWins}`;
    }
  } catch (e) {
    alert('Erreur serveur');
  }
}

// ─────────────────────────────────────────
// Modal créer un pari
// ─────────────────────────────────────────
function openCreateModal() {
  document.getElementById('create-modal').style.display = 'flex';
  document.getElementById('create-error').textContent = '';
}

function closeCreateModal() {
  document.getElementById('create-modal').style.display = 'none';
}

async function submitCreateBet() {
  const question = document.getElementById('create-question').value.trim();
  const odds = parseFloat(document.getElementById('create-odds').value);
  const amount = parseInt(document.getElementById('create-amount').value);
  const expiresAt = document.getElementById('create-expires').value;
  const errorEl = document.getElementById('create-error');

  if (!question || !odds || !amount || !expiresAt) {
    errorEl.textContent = 'Remplis tous les champs';
    return;
  }

  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/custom-bets`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, odds, creatorAmount: amount, expiresAt })
    });
    const data = await res.json();

    if (!res.ok) {
      errorEl.textContent = data.message;
      return;
    }

    closeCreateModal();
    document.getElementById('custom-credits').textContent = data.credits + ' crédits';
    alert('Pari créé ! 🎉');
    loadOpenBets();
    loadMyBets();
  } catch (e) {
    errorEl.textContent = 'Erreur serveur';
  }
}
