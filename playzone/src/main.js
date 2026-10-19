import { Game } from './game.js';

// Point d'entrée : vérifie WebGL puis lance le jeu.
const bootMsg = document.getElementById('boot-msg');

function webglOk() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

if (!webglOk()) {
  bootMsg.textContent = 'Ton navigateur ne supporte pas WebGL : impossible d\'afficher PLAYZONE en 3D.';
} else {
  const game = new Game(document.getElementById('game'), document.getElementById('ui'));
  window.playzone = game; // pratique pour déboguer et pour les tests automatiques
  game.boot().catch((e) => {
    console.error(e);
    bootMsg.textContent = `Erreur au démarrage : ${e.message}`;
  });
}
