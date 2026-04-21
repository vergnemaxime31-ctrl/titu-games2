// ===== NAVIGATION =====
function goTo(page) {
  // Cache toutes les pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  
  // Affiche la bonne page
  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');

  // Met à jour la navbar
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navItem = document.getElementById('nav-' + page);
  if (navItem) navItem.classList.add('active');
}

const API_URL = 'https://titu-games2.onrender.com/api';

async function loadLeaderboard() {
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/users/leaderboard`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();

    const table = document.querySelector('.ranking-table');
    // Garde le header
    const header = table.querySelector('.ranking-row.header');
    table.innerHTML = '';
    table.appendChild(header);

    data.forEach((user, index) => {
      const row = document.createElement('div');
      row.className = 'ranking-row';
      row.innerHTML = `
        <span class="rank-score">${user.coins}</span>
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

