const API_URL_S = 'https://titu-games2.onrender.com/api';

async function loadShop() {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_URL_S}/shop`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    const items = data.items || data || [];
    const container = document.getElementById('shop-list');
    if (!container) return;
    container.innerHTML = '';

    if (!Array.isArray(items) || items.length === 0) {
      container.innerHTML = '<p class="no-data">Aucun item disponible.</p>';
      return;
    }

    items.forEach(item => {
      container.innerHTML += `
        <div class="shop-card card">
          <h3>${item.name}</h3>
          <p>${item.description ?? ''}</p>
          <p><strong>${item.price} crédits</strong></p>
          <button onclick="buyItem('${item._id}')" class="btn btn-primary">Acheter</button>
        </div>
      `;
    });

    // Also load inventory
    loadInventory();
  } catch(e) {
    console.error(e);
  }
}

async function loadInventory() {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_URL_S}/users/me`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    const inventory = data.inventory || [];
    const container = document.getElementById('inventory-list');
    if (!container) return;
    container.innerHTML = '';

    if (inventory.length === 0) {
      container.innerHTML = '<p class="no-data">Inventaire vide.</p>';
      return;
    }

    inventory.forEach(item => {
      container.innerHTML += `
        <div class="card">
          <strong>${item.name}</strong> x${item.quantity}
          <button onclick="useItem('${item.itemId}')" class="btn btn-secondary" style="margin-left:8px; padding:4px 10px; font-size:12px;">Utiliser</button>
        </div>
      `;
    });
  } catch(e) {
    console.error(e);
  }
}

async function buyItem(itemId) {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_URL_S}/shop/buy`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ itemId })
    });
    const data = await res.json();
    if (res.ok) {
      alert(data.success ? 'Achat effectué !' : 'Erreur');
      loadShop();
    } else {
      alert(data.error || 'Erreur');
    }
  } catch(e) {
    alert('Erreur serveur.');
  }
}

async function useItem(itemId) {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_URL_S}/shop/use`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ itemId })
    });
    const data = await res.json();
    if (res.ok) {
      alert(data.message || 'Item utilisé !');
      loadShop();
    } else {
      alert(data.error || 'Erreur');
    }
  } catch(e) {
    alert('Erreur serveur.');
  }
}
