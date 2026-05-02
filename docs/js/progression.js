const API_URL_P = 'https://titu-games2.onrender.com/api';

async function loadProgression() {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_URL_P}/progression/status`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();

    const levelEl = document.getElementById('prog-level');
    const creditsEl = document.getElementById('prog-credits');
    const costEl = document.getElementById('prog-cost');
    const dailyEl = document.getElementById('prog-daily');
    const btnLevelup = document.getElementById('btn-levelup');
    const btnDaily = document.getElementById('btn-daily');

    if (levelEl) levelEl.textContent = data.level ?? 1;
    if (creditsEl) creditsEl.textContent = data.credits ?? 0;
    if (costEl) costEl.textContent = data.costNextLevel ?? '?';
    if (dailyEl) dailyEl.textContent = data.dailyReward ?? '?';

    if (btnLevelup) btnLevelup.disabled = !data.canLevelUp;
    if (btnDaily) btnDaily.disabled = !data.dailyAvailable;
  } catch(e) {
    console.error(e);
  }
}

async function levelUp() {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_URL_P}/progression/levelup`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    const msg = document.getElementById('levelup-msg');
    if (res.ok) {
      if (msg) msg.textContent = data.message || 'Niveau augmenté !';
      loadProgression();
    } else {
      if (msg) msg.textContent = data.error || 'Erreur';
    }
  } catch(e) {
    alert('Erreur serveur.');
  }
}

async function claimDaily() {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_URL_P}/progression/daily`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    const msg = document.getElementById('daily-msg');
    if (res.ok) {
      if (msg) msg.textContent = `+${data.reward} crédits récupérés !`;
      loadProgression();
    } else {
      if (msg) msg.textContent = data.error || 'Erreur';
    }
  } catch(e) {
    alert('Erreur serveur.');
  }
}
