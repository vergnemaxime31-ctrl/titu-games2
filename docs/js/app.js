// ===== NAVIGATION =====
function goTo(page) {
  // Cache toutes les pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  
  // Affiche la bonne page
  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');

  // Met à jour la navbar
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navItem = document.getElementById('nav-' + page);
  if (navItem) navItem.classList.add('active');
}
