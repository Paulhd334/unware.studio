const menuBtn = document.getElementById("menu-btn");
const navLinks = document.getElementById("nav-links");
const menuBtnIcon = menuBtn.querySelector("i");

// Masquer le menu par défaut en haut de la page
navLinks.classList.remove("open");
navLinks.classList.add("closing");

// Fonction pour ouvrir/fermer le menu
menuBtn.addEventListener("click", () => {
  // Si le menu est ouvert, on le ferme avec une animation fluide
  if (navLinks.classList.contains("open")) {
    navLinks.classList.add("closing"); // Ajouter l'animation de fermeture
    setTimeout(() => {
      navLinks.classList.remove("open", "closing"); // Enlever les classes après l'animation
      menuBtnIcon.setAttribute("class", "ri-menu-3-line"); // Remettre l'icône du menu
    }, 500); // Délai correspondant à la durée de l'animation de fermeture
  } else {
    // Si le menu est fermé, on l'ouvre avec une animation fluide
    navLinks.classList.add("open"); // Ajouter la classe pour ouvrir le menu
    menuBtnIcon.setAttribute("class", "ri-close-line"); // Changer l'icône en fermeture
  }
});

// Fermer le menu lorsque l'on clique à l'intérieur du menu
navLinks.addEventListener("click", () => {
  // Ajouter une animation de fermeture
  navLinks.classList.add("closing");
  setTimeout(() => {
    navLinks.classList.remove("open", "closing");
    menuBtnIcon.setAttribute("class", "ri-menu-3-line");
  }, 500); // Délai pour correspondre à la durée de l'animation
});


