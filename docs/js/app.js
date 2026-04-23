// ===== NAVIGATION =====
function goTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navItem = document.getElementById('nav-' + page);
  if (navItem) navItem.classList.add('active');

  if (page === 'leaderboard') loadLeaderboard();
  if (page === 'blackjack') initBlackjack();
  if (page === 'sports') initSports();
  if (page === 'custom') initCustom();
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

    data.forEach((user, index) => {
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
