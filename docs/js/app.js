// ===== NAVIGATION =====
function goTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  document.getElementById('page-' + page).classList.add('active');
  const navItem = document.getElementById('nav-' + page);
  if (navItem) navItem.classList.add('active');

  // Charger les données selon la page
  if (page === 'progression') loadProgression();
  if (page === 'shop') loadShop();
  if (page === 'challenges') loadChallenges();
  if (page === 'notifications') loadNotifications();
}
 // ← goTo se ferme ici

// ===== HOME CUSTOM BETS =====
async function loadHomeCustomBets() {
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/custom-bets`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    const container = document.getElementById('home-custom-bets');
    container.innerHTML = '';

    data.slice(0, 3).forEach(bet => {
      container.innerHTML += `
        <div class="card">
          <div style="font-size:15px; font-weight:500;">${bet.description}</div>
          <div style="color:var(--text-secondary); margin-top:4px; font-size:14px;">
            Proposé par ${bet.creatorId?.username || '?'}
          </div>
        </div>
      `;
    });

    if (data.length === 0) {
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
    const res = await fetch(`${API_URL}/users/leaderboard`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();

    const table = document.querySelector('.ranking-table');
    const header = table.querySelector('.ranking-row.header');
    table.innerHTML = '';
    table.appendChild(header);

    data.slice(0, 3).forEach((user, index) => {
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

async function loadNotifBadge() {
  const token = localStorage.getItem('token');
  if (!token) return;
  try {
    const res = await fetch('https://titu-games2.onrender.com/api/notifications', {
      headers: { Authorization: 'Bearer ' + token }
    });
    const data = await res.json();
    const badge = document.getElementById('notif-badge');
    if (badge && data.unreadCount > 0) {
      badge.textContent = data.unreadCount;
      badge.style.display = 'inline';
    } else if (badge) {
      badge.style.display = 'none';
    }
  } catch (e) {}
}

async function checkAdmin() {
  const token = localStorage.getItem('token');
  if (!token) return;
  try {
    const res = await fetch('https://titu-games2.onrender.com/api/app/me', {
      headers: { Authorization: 'Bearer ' + token }
    });
    const data = await res.json();
    if (data.isAdmin) {
      document.getElementById('nav-admin').style.display = 'flex';
    }
  } catch (e) {}
}
