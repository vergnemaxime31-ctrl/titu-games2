// API_URL est déjà défini dans auth.js

function initSports() {
  loadSportsCredits();
  loadMatches();
  loadBets();

  document.getElementById('bet-amount')?.addEventListener('input', () => {
    const amount = parseFloat(document.getElementById('bet-amount').value);
    const gain = document.getElementById('potential-gain');
    if (amount > 0 && window._selectedOdds) {
      gain.textContent = `${Math.floor(amount * window._selectedOdds)} crédits`;
    } else {
      gain.textContent = '—';
    }
  });

  document.getElementById('bet-modal')?.addEventListener('click', e => {
    if (e.target.id === 'bet-modal') closeBetModal();
  });

  document.getElementById('btn-confirm-bet')?.addEventListener('click', confirmBet);
}

async function loadSportsCredits() {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    const el = document.getElementById('sports-credits');
    if (el) el.textContent = data.credits ?? '—';
  } catch {}
}

async function loadMatches() {
  const token = localStorage.getItem('token');
  const matchesList = document.getElementById('matches-list');
  try {
    const res = await fetch(`${API_URL}/sports/matches`, { headers: { Authorization: `Bearer ${token}` } });
    const matches = await res.json();
    if (!matches.length) { matchesList.innerHTML = '<p class="no-data">Aucun match disponible</p>'; return; }
    matchesList.innerHTML = matches.map(m => `
      <div class="match-card">
        <div class="match-header">
          <span class="league">${formatLeague(m.league)}</span>
          <span class="match-date">${formatDate(m.matchDate)}</span>
        </div>
        <div class="match-teams">
          <span class="team">${m.homeTeam}</span>
          <span class="vs">VS</span>
          <span class="team">${m.awayTeam}</span>
        </div>
        <div class="match-odds">
          <button class="odd-btn" onclick="openBetModal('${m._id}','1',${m.odds.home},'${m.homeTeam}','${m.awayTeam}')">
            <span class="odd-label">1</span>
            <span class="odd-value">${m.odds.home?.toFixed(2)}</span>
          </button>
          ${m.odds.draw != null ? `
          <button class="odd-btn" onclick="openBetModal('${m._id}','N',${m.odds.draw},'${m.homeTeam}','${m.awayTeam}')">
            <span class="odd-label">N</span>
            <span class="odd-value">${m.odds.draw?.toFixed(2)}</span>
          </button>` : ''}
          <button class="odd-btn" onclick="openBetModal('${m._id}','2',${m.odds.away},'${m.homeTeam}','${m.awayTeam}')">
            <span class="odd-label">2</span>
            <span class="odd-value">${m.odds.away?.toFixed(2)}</span>
          </button>
        </div>
      </div>
    `).join('');
  } catch {
    matchesList.innerHTML = '<p class="no-data">Erreur de chargement</p>';
  }
}

function openBetModal(matchId, prediction, odds, homeTeam, awayTeam) {
  window._selectedMatchId = matchId;
  window._selectedPrediction = prediction;
  window._selectedOdds = odds;

  document.getElementById('modal-match-title').textContent = `${homeTeam} vs ${awayTeam}`;
  const predLabel = prediction === '1' ? homeTeam : prediction === '2' ? awayTeam : 'Match nul';
  document.getElementById('modal-prediction-label').textContent = `Pronostic : ${predLabel} (×${odds.toFixed(2)})`;
  document.getElementById('bet-amount').value = '';
  document.getElementById('potential-gain').textContent = '—';
  document.getElementById('bet-modal').style.display = 'flex';
}

function closeBetModal() {
  document.getElementById('bet-modal').style.display = 'none';
}

async function confirmBet() {
  const token = localStorage.getItem('token');
  const amount = parseInt(document.getElementById('bet-amount').value);
  if (!amount || amount < 1) return showSportsToast('Mise invalide', 'error');

  const btn = document.getElementById('btn-confirm-bet');
  btn.disabled = true;

  try {
    const res = await fetch(`${API_URL}/sports/bets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ matchId: window._selectedMatchId, prediction: window._selectedPrediction, amount })
    });
    const data = await res.json();
    if (!res.ok) return showSportsToast(data.message || 'Erreur', 'error');
    showSportsToast('Pari placé ! 🎯', 'success');
    closeBetModal();
    loadSportsCredits();
    loadBets();
  } catch { showSportsToast('Erreur serveur', 'error'); }
  finally { btn.disabled = false; }
}

async function loadBets() {
  const token = localStorage.getItem('token');
  const betsList = document.getElementById('bets-list');
  try {
    const res = await fetch(`${API_URL}/sports/bets`, { headers: { Authorization: `Bearer ${token}` } });
    const bets = await res.json();
    if (!bets.length) { betsList.innerHTML = '<p class="no-data">Aucun pari</p>'; return; }
    betsList.innerHTML = bets.map(b => {
      const match = b.matchId;
      const statusClass = b.status === 'won' ? 'won' : b.status === 'lost' ? 'lost' : 'pending';
      const statusLabel = b.status === 'won' ? '✅ Gagné' : b.status === 'lost' ? '❌ Perdu' : '⏳ En attente';
      const predLabel = b.prediction === '1' ? match?.homeTeam : b.prediction === '2' ? match?.awayTeam : 'Nul';
      const gainText = b.creditsChange != null
        ? (b.creditsChange > 0 ? `+${b.creditsChange}` : `${b.creditsChange}`) + ' crédits'
        : `Gain potentiel : ${Math.floor(b.amount * b.odds)} crédits`;
      return `
        <div class="bet-card ${statusClass}">
          <div class="bet-match">${match?.homeTeam ?? '?'} vs ${match?.awayTeam ?? '?'}</div>
          <div class="bet-details">
            <span>Pronostic : <strong>${predLabel}</strong></span>
            <span>Mise : <strong>${b.amount}</strong></span>
            <span>Cote : <strong>×${b.odds?.toFixed(2)}</strong></span>
          </div>
          <div class="bet-footer">
            <span class="bet-status ${statusClass}">${statusLabel}</span>
            <span class="bet-gain">${gainText}</span>
          </div>
        </div>`;
    }).join('');
  } catch {}
}

function formatLeague(slug) {
  const map = {
    soccer_france_ligue1: '🇫🇷 Ligue 1',
    soccer_spain_la_liga: '🇪🇸 La Liga',
    soccer_england_league1: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Championship'
  };
  return map[slug] || slug;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  });
}

function showSportsToast(msg, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
