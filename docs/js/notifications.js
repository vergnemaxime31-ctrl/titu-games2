const API_URL_N = 'https://titu-games2.onrender.com/api';

const NOTIF_ICONS = {
  blackjack_attacked: '⚔️',
  blackjack_defended: '🛡️',
  bet_new_custom: '🎲',
  bet_result_win: '✅',
  bet_result_lose: '❌',
  admin_announcement: '📢'
};

// ===== PANEL TOGGLE =====
function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  const overlay = document.getElementById('notif-overlay');
  if (!panel || !overlay) return;

  const isOpen = panel.classList.contains('open');
  if (isOpen) {
    closeNotifPanel();
  } else {
    openNotifPanel();
  }
}

function openNotifPanel() {
  const panel = document.getElementById('notif-panel');
  const overlay = document.getElementById('notif-overlay');
  if (!panel || !overlay) return;

  panel.classList.remove('hidden');
  overlay.classList.remove('hidden');
  // Trigger reflow for animation
  void panel.offsetWidth;
  panel.classList.add('open');
  overlay.classList.add('open');

  loadNotifications();
}

function closeNotifPanel() {
  const panel = document.getElementById('notif-panel');
  const overlay = document.getElementById('notif-overlay');
  if (!panel || !overlay) return;

  panel.classList.remove('open');
  overlay.classList.remove('open');

  setTimeout(() => {
    panel.classList.add('hidden');
    overlay.classList.add('hidden');
  }, 300);
}

// ===== LOAD NOTIFICATIONS =====
async function loadNotifications() {
  const token = localStorage.getItem('token');
  if (!token) return;

  const container = document.getElementById('notif-list');
  if (!container) return;

  try {
    const res = await fetch(`${API_URL_N}/notifications`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) throw new Error('Erreur ' + res.status);
    const data = await res.json();
    const notifs = data.notifications || [];

    if (notifs.length === 0) {
      container.innerHTML = '<div class="notif-empty">Aucune notification</div>';
      return;
    }

    container.innerHTML = notifs.map(n => {
      const icon = NOTIF_ICONS[n.type] || '🔔';
      const timeAgo = formatTimeAgo(n.createdAt);
      return `
        <div class="notif-item ${n.isRead ? '' : 'unread'}" onclick="markOneRead('${n._id}', this)">
          <div class="notif-item-header">
            <span class="notif-item-icon">${icon}</span>
            <span class="notif-item-title">${n.title || ''}</span>
          </div>
          <div class="notif-item-message">${n.message}</div>
          <div class="notif-item-time">${timeAgo}</div>
        </div>
      `;
    }).join('');
  } catch (e) {
    console.error('Erreur notifications:', e);
    container.innerHTML = '<div class="notif-empty">Erreur de chargement</div>';
  }
}

// ===== BADGE =====
async function loadNotifBadge() {
  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    const res = await fetch(`${API_URL_N}/notifications`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) return;
    const data = await res.json();
    const count = data.unreadCount || 0;
    updateBadge(count);
  } catch (e) {}
}

function updateBadge(count) {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : count;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

// ===== MARK AS READ =====
async function markAllRead() {
  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    const res = await fetch(`${API_URL_N}/notifications/read-all`, {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (res.ok) {
      // Update UI
      document.querySelectorAll('.notif-item.unread').forEach(el => {
        el.classList.remove('unread');
      });
      updateBadge(0);
    }
  } catch (e) {
    console.error('Erreur mark all read:', e);
  }
}

async function markOneRead(notifId, element) {
  const token = localStorage.getItem('token');
  if (!token) return;

  if (element && element.classList.contains('unread')) {
    try {
      await fetch(`${API_URL_N}/notifications/${notifId}/read`, {
        method: 'PATCH',
        headers: { 'Authorization': 'Bearer ' + token }
      });
      element.classList.remove('unread');
      // Decrement badge
      const badge = document.getElementById('notif-badge');
      if (badge && !badge.classList.contains('hidden')) {
        const current = parseInt(badge.textContent) || 0;
        updateBadge(Math.max(0, current - 1));
      }
    } catch (e) {}
  }
}

// ===== HELPERS =====
function formatTimeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "A l'instant";
  if (diffMin < 60) return `Il y a ${diffMin}min`;
  if (diffH < 24) return `Il y a ${diffH}h`;
  if (diffD < 7) return `Il y a ${diffD}j`;
  return date.toLocaleDateString('fr-FR');
}
