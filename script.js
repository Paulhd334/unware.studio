// Sélectionner les éléments nécessaires
const themeToggleButton = document.getElementById('theme-toggle');
const sunIcon = document.getElementById('sun-icon');
const moonIcon = document.getElementById('moon-icon');

// Fonction pour basculer entre les modes clair et sombre
function toggleDarkMode() {
  const isDarkMode = document.body.classList.contains('dark-mode');
  
  if (isDarkMode) {
    document.body.classList.remove('dark-mode');
    localStorage.setItem('darkMode', 'disabled');
    sunIcon.style.display = 'none';  // Cache l'icône du soleil
    moonIcon.style.display = 'inline-block'; // Affiche l'icône de la lune
  } else {
    document.body.classList.add('dark-mode');
    localStorage.setItem('darkMode', 'enabled');
    moonIcon.style.display = 'none';  // Cache l'icône de la lune
    sunIcon.style.display = 'inline-block'; // Affiche l'icône du soleil
  }
}

// Ajouter un événement au clic sur le bouton
themeToggleButton.addEventListener('click', toggleDarkMode);

// Vérifier la préférence de l'utilisateur au démarrage et appliquer le mode
if (localStorage.getItem('darkMode') === 'enabled') {
  document.body.classList.add('dark-mode');
  sunIcon.style.display = 'inline-block';
  moonIcon.style.display = 'none';
} else {
  document.body.classList.remove('dark-mode');
  sunIcon.style.display = 'none';
  moonIcon.style.display = 'inline-block';
}
