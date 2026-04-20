const API_URL = 'http://localhost:3000/api';

// ===== SWITCH TABS LOGIN / REGISTER =====
function switchTab(tab) {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
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
  const errorEl = document.getElementById('login-error');

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
  const username = document.getElementById('register-username').value.trim();
  const password = document.getElementById('register-password').value.trim();
  const confirm = document.getElementById('register-confirm').value.trim();
  const errorEl = document.getElementById('register-error');

  errorEl.textContent = '';

  if (!username || !password || !confirm) {
    errorEl.textContent = 'Remplis tous les champs.';
    return;
  }

  if (password !== confirm) {
    errorEl.textContent = 'Les mots de passe ne correspondent pas.';
    return;
  }

  if (password.length < 6) {
    errorEl.textContent = 'Mot de passe trop court (6 caractères min).';
    return;
  }

  try {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (!res.ok) {
      errorEl.textContent = data.message || 'Erreur inscription.';
      return;
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    enterApp(data.user);

  } catch (err) {
    errorEl.textContent = 'Serveur inaccessible.';
  }
}

// ===== ENTER APP =====
function enterApp(user) {
  document.getElementById('navbar').classList.remove('hidden');
  goTo('home');
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
  }
});
