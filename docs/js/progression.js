const API_URL_P = 'https://titu-games2.onrender.com/api';

async function loadProgression() {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_URL_P}/users/me`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    const profile = data?.user ?? data;

    document.getElementById('prog-level').textContent = profile.level ?? 1;
    document.getElementById('prog-xp').textContent = profile.xp ?? 0;
    document.getElementById('prog-coins').textContent = profile.coins ?? 0;

    const xpNeeded = (profile.level ?? 1) * 100;
    const xpCurrent = profile.xp ?? 0;
    const percent = Math.min(100, Math.floor((xpCurrent / xpNeeded) * 100));
    document.getElementById('prog-bar').style.width = percent + '%';
    document.getElementById('prog-xp-needed').textContent = xpNeeded;
  } catch(e) {
    console.error(e);
  }
}

async function claimDaily() {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_URL_P}/users/daily`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    alert(data.message || 'Récompense réclamée !');
    loadProgression();
  } catch(e) {
    alert('Erreur serveur.');
  }
}
