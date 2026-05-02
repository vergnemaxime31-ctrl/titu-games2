const API_URL = 'https://titu-games2.onrender.com/api';

// ===== SWITCH TABS LOGIN / REGISTER =====
function switchTab(tab) {
  const loginForm = document.getElementById('form-login');
  const registerForm = document.getElementById('form-register');
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');


  if (tab === 'login') {
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
    tabLogin.style.background = '#3a3a3a';
    tabLogin.style.color = '#fff';
    tabRegister.style.background = 'transparent';
    tabRegister.style.color = '#888';
  } else {
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
    tabRegister.style.background = '#3a3a3a';
    tabRegister.style.color = '#fff';
    tabLogin.style.background = 'transparent';
    tabLogin.style.color = '#888';
  }
}

// ===== LOGIN =====
async function login() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value.trim();
  const errorEl = document.getElementById('auth-error');

  errorEl.textContent = '';

  if (!username || !password) {
    errorEl.textContent = 'Remplis tous les champs.';
    return;
  }

  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (!res.ok) {
      errorEl.textContent = data.message || 'Erreur de connexion.';
      return;
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    enterApp(data.user);

  } catch (err) {
    errorEl.textContent = 'Serveur inaccessible.';
  }
}

// ===== REGISTER =====
async function register() {
  const username = document.getElementById('reg-username').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value.trim();
  const errorEl = document.getElementById('auth-error');

  errorEl.textContent = '';

  if (!username || !password) {
    errorEl.textContent = 'Remplis tous les champs.';
    return;
  }

  errorEl.style.color = '#888';
  errorEl.textContent = 'Connexion au serveur... (peut prendre 30s)';

  try {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });

    const data = await res.json();
    errorEl.style.color = 'var(--accent-red)';

    if (!res.ok) {
      errorEl.textContent = data.message || 'Erreur inscription.';
      return;
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    enterApp(data.user);

  } catch (err) {
    errorEl.style.color = 'var(--accent-red)';
    errorEl.textContent = 'Serveur inaccessible : ' + err.message;
  }
}

// ===== HELPER: authenticated fetch with 401 handling =====
async function authFetch(url, options = {}) {
  const token = localStorage.getItem('token');
  if (!token) {
    logout();
    return null;
  }

  const headers = {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    // Token expired or invalid — clear and redirect to login
    logout();
    return null;
  }

  return res;
}

// ===== ENTER APP =====
async function enterApp(user) {
  document.querySelector('.username').textContent = user.username;
  document.querySelector('.credits').textContent = user.credits ? user.credits + ' crédits' : '...';

  document.getElementById('page-auth').classList.remove('active');
  document.getElementById('navbar').classList.remove('hidden');
  goTo('home');

  // Verify token is still valid by fetching fresh profile
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      logout();
      return;
    }

    const res = await fetch(`${API_URL}/users/me`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });

    if (!res.ok) {
      if (res.status === 401) {
        // Token expired or invalid
        logout();
        return;
      }
      // Other server errors — use cached data
      console.warn('Profile fetch failed:', res.status);
      document.querySelector('.credits').textContent = (user.credits ?? 0) + ' crédits';
      return;
    }

    const data = await res.json();
    console.log('profil:', data);

    if (!data || (!data._id && !data.id && !data.username)) {
      // Invalid response, use cached user data
      document.querySelector('.credits').textContent = (user.credits ?? 0) + ' crédits';
      return;
    }

    // data is the user object directly (from /api/users/me)
    const profile = data;
    const credits = profile.credits ?? user.credits ?? 0;
    document.querySelector('.credits').textContent = credits + ' crédits';

    // Update cached user with fresh data
    localStorage.setItem('user', JSON.stringify({
      id: profile._id || profile.id,
      username: profile.username,
      credits: profile.credits
    }));

  } catch(e) {
    console.error('Profile fetch error:', e);
    // Network error (server cold start) — use cached data, don't logout
    document.querySelector('.credits').textContent = (user.credits ?? 0) + ' crédits';
  }

  loadNotifBadge();
  checkAdmin();
  loadLeaderboard();
}



// ===== LOGOUT =====
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  document.getElementById('navbar').classList.add('hidden');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-auth').classList.add('active');
}

// ===== AUTO LOGIN =====
window.addEventListener('load', () => {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');

  if (!token || !userStr) {
    // No stored session — show login
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    document.getElementById('navbar').classList.add('hidden');
    return;
  }

  try {
    const user = JSON.parse(userStr);
    if (!user || !user.username) {
      throw new Error('Invalid cached user');
    }
    enterApp(user);
  } catch(e) {
    // Corrupted localStorage data
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    document.getElementById('navbar').classList.add('hidden');
  }
});
