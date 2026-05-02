const API_URL_C = 'https://titu-games2.onrender.com/api';

async function loadChallenges() {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_URL_C}/challenges`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const challenges = await res.json();
    const container = document.getElementById('challenges-list');
    container.innerHTML = '';

    challenges.forEach(c => {
      container.innerHTML += `
        <div class="challenge-card">
          <h3>${c.title}</h3>
          <p>${c.description ?? ''}</p>
          <p>Récompense : <strong>${c.reward} XP</strong></p>
          <p>Statut : ${c.completed ? '✅ Complété' : '⏳ En cours'}</p>
        </div>
      `;
    });
  } catch(e) {
    console.error(e);
  }
}
