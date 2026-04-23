async function loadLeaderboardPage() {
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/users/leaderboard`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();

    // Tableau classement
    const table = document.getElementById('full-ranking-table');
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

    // Statistiques
    const totalCredits = data.reduce((sum, u) => sum + u.credits, 0);
    document.getElementById('stat-active-users').textContent = data.length;
    document.getElementById('stat-credits').textContent = totalCredits.toLocaleString('fr-FR');

    // Total paris : appel séparé
    const res2 = await fetch(`${API_URL}/stats/bets-count`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const stats = await res2.json();
    document.getElementById('stat-total-bets').textContent = stats.total;

  } catch (err) {
    console.error('Erreur leaderboard page:', err);
  }
}
