const API_URL_C = 'https://titu-games2.onrender.com/api';

async function loadChallenges() {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_URL_C}/challenges`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    const challenges = data.challenges || data || [];
    const container = document.getElementById('challenges-list');
    if (!container) return;
    container.innerHTML = '';

    if (!Array.isArray(challenges) || challenges.length === 0) {
      container.innerHTML = '<p class="no-data">Aucun défi cette semaine.</p>';
      return;
    }

    challenges.forEach(c => {
      const progressPercent = c.target > 0 ? Math.min(100, Math.floor((c.progress / c.target) * 100)) : 0;
      container.innerHTML += `
        <div class="card">
          <h3>${c.title}</h3>
          <p style="color:var(--text-secondary); font-size:14px;">${c.description ?? ''}</p>
          <p style="font-size:13px;">Progression : ${c.progress ?? 0} / ${c.target ?? '?'} (${progressPercent}%)</p>
          <p style="font-size:13px;">Récompense : <strong>${c.rewardCredits ? c.rewardCredits + ' crédits' : ''}${c.rewardItem ? ' + ' + c.rewardItem : ''}</strong></p>
          <p style="font-size:13px;">Statut : ${c.claimed ? '🎁 Réclamé' : c.completed ? '✅ Complété' : '⏳ En cours'}</p>
          ${c.completed && !c.claimed ? `<button onclick="claimChallenge('${c._id}')" class="btn btn-success" style="margin-top:8px;">Réclamer</button>` : ''}
        </div>
      `;
    });
  } catch(e) {
    console.error(e);
  }
}

async function claimChallenge(challengeId) {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_URL_C}/challenges/claim/${challengeId}`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    if (res.ok) {
      alert('Récompense réclamée !');
      loadChallenges();
    } else {
      alert(data.error || 'Erreur');
    }
  } catch(e) {
    alert('Erreur serveur.');
  }
}
