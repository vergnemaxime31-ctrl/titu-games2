// ===== NAVIGATION =====
function goTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');
  const navItem = document.getElementById('nav-' + page);
  if (navItem) navItem.classList.add('active');

  // Close notification panel when navigating
  closeNotifPanel();

  // Charger les données selon la page
  if (page === 'progression') loadProgression();
  if (page === 'shop') loadShop();
  if (page === 'challenges') loadChallenges();
  if (page === 'sports') initSports();
  if (page === 'custom') initCustom();
  if (page === 'top') loadLeaderboardPage();
}

// ===== HOME CUSTOM BETS =====
async function loadHomeCustomBets() {
  try {
    const token = localStorage.getItem('token');
    if (!token) return;
    const res = await fetch(`${API_URL}/custom-bets`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) return;
    const data = await res.json();
    const container = document.getElementById('home-custom-bets');
    if (!container) return;
    container.innerHTML = '';

    const bets = Array.isArray(data) ? data : [];
    bets.slice(0, 3).forEach(bet => {
      container.innerHTML += `
        <div class="card">
          <div style="font-size:15px; font-weight:500;">${bet.question || bet.description || ''}</div>
          <div style="color:var(--text-secondary); margin-top:4px; font-size:14px;">
            Proposé par ${bet.creatorId?.username || '?'}
          </div>
        </div>
      `;
    });

    if (bets.length === 0) {
      container.innerHTML = '<p style="color:var(--text-secondary); text-align:center;">Aucun pari pour l\'instant</p>';
    }
  } catch (err) {
    console.error('Erreur home custom bets:', err);
  }
}

// ===== LEADERBOARD =====
async function loadLeaderboard() {
  try {
    const token = localStorage.getItem('token');
    if (!token) return;
    const res = await fetch(`${API_URL}/users/leaderboard`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) return;
    const data = await res.json();

    const table = document.querySelector('.ranking-table');
    if (!table) return;
    const header = table.querySelector('.ranking-row.header');
    table.innerHTML = '';
    if (header) table.appendChild(header);

    const users = Array.isArray(data) ? data : [];
    users.slice(0, 3).forEach((user, index) => {
      const row = document.createElement('div');
      row.className = 'ranking-row';
      row.innerHTML = `
        <span class="rank-number">${index + 1}</span>
        <div class="rank-avatar">${user.username[0].toUpperCase()}</div>
        <span class="rank-pseudo">${user.username}</span>
        <span class="rank-score">${user.credits}</span>
      `;
      table.appendChild(row);
    });
  } catch (err) {
    console.error('Erreur leaderboard:', err);
  }
}

async function checkAdmin() {
  const token = localStorage.getItem('token');
  if (!token) return;
  try {
    const res = await fetch(`${API_URL}/users/me`, {
      headers: { Authorization: 'Bearer ' + token }
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data && data.isAdmin) {
      const navAdmin = document.getElementById('nav-admin');
      if (navAdmin) navAdmin.style.display = 'flex';
    }
  } catch (e) {}
}
