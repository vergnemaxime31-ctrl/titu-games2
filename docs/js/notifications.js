const API_URL_N = 'https://titu-games2.onrender.com/api';

async function loadNotifBadge() {
  const token = localStorage.getItem('token');
  if (!token) return;
  try {
    const res = await fetch(`${API_URL_N}/notifications`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    const unreadCount = data.unreadCount ?? 0;
    const badge = document.getElementById('notif-badge');
    if (badge) {
      badge.textContent = unreadCount;
      badge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
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
    const data = await res.json();
    const notifs = data.notifications || data || [];
    const container = document.getElementById('notif-list');
    if (!container) return;
    container.innerHTML = '';

    if (!Array.isArray(notifs) || notifs.length === 0) {
      container.innerHTML = '<p class="no-data">Aucune notification.</p>';
      return;
    }

    notifs.forEach(n => {
      container.innerHTML += `
        <div class="card ${n.read ? '' : 'unread'}" style="${!n.read ? 'border-left: 3px solid var(--accent);' : ''}">
          <p>${n.message}</p>
          <small style="color:var(--text-muted);">${new Date(n.createdAt).toLocaleString()}</small>
        </div>
      `;
    });
  } catch(e) {
    console.error(e);
  }
}

async function markAllRead() {
  const token = localStorage.getItem('token');
  try {
    await fetch(`${API_URL_N}/notifications/read`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    loadNotifBadge();
    loadNotifications();
  } catch(e) {
    console.error(e);
  }
}
