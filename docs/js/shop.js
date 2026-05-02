const API_URL_S = 'https://titu-games2.onrender.com/api';

async function loadShop() {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_URL_S}/shop`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const items = await res.json();
    const container = document.getElementById('shop-items');
    container.innerHTML = '';

    items.forEach(item => {
      container.innerHTML += `
        <div class="shop-card">
          <h3>${item.name}</h3>
          <p>${item.description ?? ''}</p>
          <p><strong>${item.price} crédits</strong></p>
          <button onclick="buyItem('${item._id}')">Acheter</button>
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
    alert(data.message || 'Achat effectué !');
    loadShop();
  } catch(e) {
    alert('Erreur serveur.');
  }
}
