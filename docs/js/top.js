async function loadLeaderboardPage() {
  const token = localStorage.getItem('token');
  if (!token) return;

  const table = document.getElementById('full-ranking-table');

  try {
    const res = await fetch(`${API_URL}/users/leaderboard`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });

    if (!res.ok) throw new Error('Erreur ' + res.status);
    const data = await res.json();
    const users = Array.isArray(data) ? data : [];

    // Tableau classement
    if (table) {
      const header = table.querySelector('.ranking-row.header');
      table.innerHTML = '';
      if (header) table.appendChild(header);

      if (users.length === 0) {
        table.innerHTML += '<p class="no-data">Aucun joueur pour le moment.</p>';
      } else {
        users.forEach((user, index) => {
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
      }
    }

    // Statistiques
    const totalCredits = users.reduce((sum, u) => sum + (u.credits || 0), 0);
    const elUsers = document.getElementById('stat-active-users');
    const elCredits = document.getElementById('stat-credits');
    if (elUsers) elUsers.textContent = users.length;
    if (elCredits) elCredits.textContent = totalCredits.toLocaleString('fr-FR');

    // Total paris : appel séparé (route is /api/users/stats/bets-count)
    try {
      const res2 = await fetch(`${API_URL}/users/stats/bets-count`, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (res2.ok) {
        const stats = await res2.json();
        const elBets = document.getElementById('stat-total-bets');
        if (elBets) elBets.textContent = stats.total ?? 0;
      }
    } catch (e) {
      console.error('Erreur stats bets:', e);
    }

  } catch (err) {
    console.error('Erreur leaderboard page:', err);
    if (table) {
      table.innerHTML = '<p class="no-data">Erreur de chargement du classement.</p>';
    }
  }
}
