const API_URL_A = 'https://titu-games2.onrender.com/api';

async function createChallenge() {
  const token = localStorage.getItem('token');
  const msg = document.getElementById('create-msg');

  const body = {
    title: document.getElementById('c-title').value.trim(),
    description: document.getElementById('c-desc').value.trim(),
    type: document.getElementById('c-type').value,
    target: parseInt(document.getElementById('c-target').value),
    rewardCredits: parseInt(document.getElementById('c-reward-credits').value) || 0,
    rewardItem: document.getElementById('c-reward-item').value.trim() || null,
    weekStart: document.getElementById('c-week-start').value,
    weekEnd: document.getElementById('c-week-end').value
  };

  if (!body.title || !body.target || !body.weekStart || !body.weekEnd) {
    if (msg) msg.textContent = 'Remplis tous les champs obligatoires';
    return;
  }

  try {
    const res = await fetch(`${API_URL_A}/challenges/admin/create`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (res.ok) {
      if (msg) msg.textContent = 'Défi créé !';
      msg.style.color = 'var(--accent-green)';
    } else {
      if (msg) msg.textContent = data.error || 'Erreur';
      msg.style.color = 'var(--accent-red)';
    }
  } catch (e) {
    if (msg) msg.textContent = 'Erreur serveur';
  }
}

async function createShopItem() {
  const token = localStorage.getItem('token');
  const msg = document.getElementById('shop-create-msg');

  const body = {
    name: document.getElementById('s-name').value.trim(),
    description: document.getElementById('s-desc').value.trim(),
    effect: document.getElementById('s-effect').value,
    price: parseInt(document.getElementById('s-price').value)
  };

  if (!body.name || !body.price) {
    if (msg) msg.textContent = 'Nom et prix requis';
    return;
  }

  try {
    const res = await fetch(`${API_URL_A}/shop/create`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (res.ok) {
      if (msg) msg.textContent = 'Item ajouté !';
      msg.style.color = 'var(--accent-green)';
    } else {
      if (msg) msg.textContent = data.error || 'Erreur';
      msg.style.color = 'var(--accent-red)';
    }
  } catch (e) {
    if (msg) msg.textContent = 'Erreur serveur';
  }
}

// ===== ANNOUNCE =====
async function sendAnnouncement() {
  const token = localStorage.getItem('token');
  const msg = document.getElementById('announce-msg');
  const title = document.getElementById('announce-title').value.trim();
  const message = document.getElementById('announce-message').value.trim();

  if (!title || !message) {
    if (msg) { msg.textContent = 'Titre et message requis'; msg.style.color = 'var(--accent-red)'; }
    return;
  }

  try {
    const res = await fetch(`${API_URL_A}/admin/notifications/announce`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, message })
    });
    const data = await res.json();
    if (res.ok) {
      if (msg) { msg.textContent = 'Annonce envoyée !'; msg.style.color = 'var(--accent-green)'; }
      document.getElementById('announce-title').value = '';
      document.getElementById('announce-message').value = '';
    } else {
      if (msg) { msg.textContent = data.error || 'Erreur'; msg.style.color = 'var(--accent-red)'; }
    }
  } catch (e) {
    if (msg) { msg.textContent = 'Erreur serveur'; msg.style.color = 'var(--accent-red)'; }
  }
}
