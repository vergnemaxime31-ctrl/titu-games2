const API_URL_N = 'https://titu-games2.onrender.com/api';

async function loadNotifBadge() {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_URL_N}/notifications`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const notifs = await res.json();
    const unread = notifs.filter(n => !n.read).length;
    const badge = document.getElementById('notif-badge');
    if (badge) {
      badge.textContent = unread;
      badge.style.display = unread > 0 ? 'inline-block' : 'none';
    }
  } catch(e) {
    console.error(e);
  }
}

async function loadNotifications() {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_URL_N}/notifications`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const notifs = await res.json();
    const container = document.getElementById('notif-list');
    container.innerHTML = '';

    if (notifs.length === 0) {
      container.innerHTML = '<p>Aucune notification.</p>';
      return;
    }

    notifs.forEach(n => {
      container.innerHTML += `
        <div class="notif-card ${n.read ? '' : 'unread'}">
          <p>${n.message}</p>
          <small>${new Date(n.createdAt).toLocaleString()}</small>
        </div>
      `;
    });

    // Marquer comme lues
    await fetch(`${API_URL_N}/notifications/read`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    loadNotifBadge();
  } catch(e) {
    console.error(e);
  }
}

