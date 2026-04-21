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

// ===== ENTER APP =====
async function enterApp(user) {
  document.querySelector('.username').textContent = user.username;
  document.querySelector('.credits').textContent = '...';

  document.getElementById('page-auth').classList.remove('active');
  document.getElementById('navbar').classList.remove('hidden');
  goTo('home');

  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/users/me`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    console.log('profil:', data);

    // data peut être l'objet directement ou dans data.user
    const profile = data?.user ?? data;
    const coins = profile?.coins ?? profile?.credits ?? user?.coins ?? user?.credits ?? 0;
    document.querySelector('.credits').textContent = coins + ' crédits';
  } catch(e) {
    console.error(e);
    document.querySelector('.credits').textContent = '0 crédits';
  }

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
  const user = JSON.parse(localStorage.getItem('user'));
  if (token && user) {
    enterApp(user);
  } else {
    // S'assurer que la navbar est cachée
    document.getElementById('navbar').classList.add('hidden');
  }
});
