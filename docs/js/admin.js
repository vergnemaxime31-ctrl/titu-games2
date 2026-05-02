const API_URL_A = 'https://titu-games2.onrender.com/api';

async function checkAdmin() {
  const user = JSON.parse(localStorage.getItem('user'));
  if (user?.role === 'admin') {
    const adminLink = document.getElementById('admin-link');
    if (adminLink) adminLink.style.display = 'block';
  }
}

async function loadAdminPanel() {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_URL_A}/admin/users`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const users = await res.json();
    const container = document.getElementById('admin-users');
    container.innerHTML = '';

    users.forEach(u => {
      container.innerHTML += `
        <div class="admin-user-card">
          <p><strong>${u.username}</strong> — ${u.email} — Rôle : ${u.role}</p>
          <p>Coins : ${u.coins} | Level : ${u.level} | XP : ${u.xp}</p>
          <button onclick="banUser('${u._id}')">Bannir</button>
        </div>
      `;
    });
  } catch(e) {
    console.error(e);
  }
}

async function banUser(userId) {
  const token = localStorage.getItem('token');
  if (!confirm('Confirmer le ban ?')) return;
  try {
    const res = await fetch(`${API_URL_A}/admin/ban/${userId}`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    alert(data.message || 'Utilisateur banni.');
    loadAdminPanel();
  } catch(e) {
    alert('Erreur serveur.');
  }
}
