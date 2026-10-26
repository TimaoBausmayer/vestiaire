// INTÉRIEURS DES LOISIRS : casino, stand de tir, laser game, accueil du paintball.
// Même outil `t` que les autres modèles (repère local : porte côté +z, fond côté -z).
import { rangeLayout } from '../leisure/range.js';
import { RANGE } from '../../shared/leisure.js';

function chandelier(t, lx, lz, y) {
  t.box(lx, y + 0.6, lz, 0.05, 0.6, 0.05, '#d4a017');
  t.cyl(lx, y, lz, 0.6, 0.15, '#d4a017', 12);
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; t.sphere(lx + Math.cos(a) * 0.55, y - 0.05, lz + Math.sin(a) * 0.55, 0.09, '#fff3c4'); }
}
function slotMachine(t, lx, lz, ry, color) {
  t.box(lx, 0, lz, 0.9, 1.1, 0.7, color, 'main', ry);
  t.box(lx, 1.1, lz, 0.85, 0.8, 0.6, '#1b1446', 'main', ry);
  t.box(lx, 1.2, lz, 0.7, 0.5, 0.62, '#ffd23f', 'glow', ry);
  t.box(lx, 1.9, lz, 0.9, 0.25, 0.7, '#ff3fa4', 'glow', ry);
  t.solid(lx, lz, 0.9, 0.7, 2.1, ry);
}

export const LEISURE_TEMPLATES = {
  casino(t) {
    const I = t.inner, H = t.gH;
    // moquette à motifs, colonnes dorées, lustres
    for (let x = I.x1 + 3; x < I.x2 - 2; x += 6) for (let z = I.z1 + 3; z < I.z2 - 3; z += 6) t.box(x, 0.01, z, 1.6, 0.02, 1.6, '#a4133c');
    for (const x of [I.x1 + 8, I.x2 - 8]) for (const z of [I.z1 + 7, I.z2 - 7]) { t.cyl(x, 0, z, 0.35, H, '#d4a017', 12); t.solid(x, z, 0.7, 0.7, H); }
    for (let x = I.x1 + 6; x < I.x2 - 4; x += 9) chandelier(t, x, 0, H - 1.3);
    // accueil (à gauche de l'entrée) + vigile
    const ax = I.x1 + 4, az = I.z2 - 3;
    t.box(ax, 0, az, 3.2, 1.1, 0.9, '#3a0ca3'); t.box(ax, 1.1, az, 3.3, 0.06, 1.0, '#d4a017'); t.solid(ax, az, 3.2, 0.9, 1.2);
    t.staff(ax, az - 0.9, 0, 'hotesse');
    t.spot(ax, az + 1.1, { label: '🎩 Accueil : limites de jeu, auto-exclusion', action: 'casino-desk', r: 1.8, priority: 2 });
    t.staff(t.door.x + 2.2, I.z2 - 1.2, Math.PI, 'vigile');
    // machines à sous le long du mur gauche (deux rangées)
    const colors = ['#c1121f', '#3a0ca3', '#0077b6', '#d4a017'];
    let k = 0;
    for (let z = I.z1 + 2; z < I.z2 - 6; z += 1.3) {
      slotMachine(t, I.x1 + 0.6, z, Math.PI / 2, colors[k++ % 4]);
      t.spot(I.x1 + 1.6, z, { label: '🎰 Machine à sous', action: 'casino-slots', r: 0.75 });
    }
    // tables de roulette (au centre)
    for (const [i, x] of [[0, -4.5], [1, 4.5]]) {
      const z = -2.5;
      t.box(x, 0, z, 4.2, 0.85, 2.0, '#14532d'); t.box(x, 0.85, z, 4.3, 0.06, 2.1, '#1f8a3b'); t.solid(x, z, 4.2, 2.0, 1);
      t.cyl(x - 1.3, 0.9, z, 0.6, 0.12, '#5a3416', 18); t.cyl(x - 1.3, 1.0, z, 0.45, 0.05, '#c1121f', 18); t.cyl(x - 1.3, 1.04, z, 0.12, 0.08, '#d4a017', 8);
      t.staff(x - 1.3, z - 1.5, 0, 'croupier');
      t.spot(x + 0.8, z + 1.6, { label: '🎡 Table de roulette', action: 'casino-roulette', r: 1.5 });
      void i;
    }
    // tables de blackjack (en demi-lune, à droite)
    for (const z of [I.z1 + 4, I.z1 + 9.5]) {
      const x = I.x2 - 6;
      t.cyl(x, 0, z, 1.6, 0.85, '#14532d', 20); t.cyl(x, 0.85, z, 1.7, 0.06, '#1f8a3b', 20); t.solid(x, z, 3.0, 3.0, 1);
      t.staff(x, z - 2.0, 0, 'croupier');
      t.spot(x, z + 2.1, { label: '🃏 Table de blackjack', action: 'casino-bj', r: 1.5 });
    }
    // bornes de vidéo poker au fond
    for (let x = -3; x <= 3; x += 1.5) {
      t.box(x, 0, I.z1 + 0.6, 1.0, 1.0, 0.7, '#2b2d42'); t.box(x, 1.0, I.z1 + 0.6, 0.9, 0.6, 0.65, '#29e6ff', 'glow'); t.solid(x, I.z1 + 0.6, 1.0, 0.7, 1.7);
      t.spot(x, I.z1 + 1.6, { label: '🂡 Vidéo poker', action: 'casino-poker', r: 0.75 });
    }
    // salle des jeux : un comptoir par catégorie au Grand Casino (40 jeux), un seul dans les autres (16 jeux)
    const cats = t.b.grand ? ['Cartes', 'Dés & pièces', 'Roues & loteries', 'Arcade', 'Courses', 'Machines'] : [null];
    const icons = { Cartes: '🃏', 'Dés & pièces': '🎲', 'Roues & loteries': '🎡', Arcade: '🕹️', Courses: '🏇', Machines: '🎰' };
    const tz = t.b.grand ? I.z2 - 9.5 : I.z2 - 6.5, span = t.b.grand ? (I.x2 - I.x1) - 24 : 0;
    cats.forEach((cat, i) => {
      const x = t.b.grand ? I.x1 + 12 + (span / (cats.length - 1)) * i : 1.5;
      const col = ['#14532d', '#3a0ca3', '#7a1027', '#0077b6', '#5a3416', '#d4a017'][i % 6];
      t.box(x, 0, tz, 2.6, 0.9, 1.4, col); t.box(x, 0.9, tz, 2.7, 0.06, 1.5, '#1f8a3b'); t.solid(x, tz, 2.6, 1.4, 1);
      t.box(x, 2.2, tz - 0.6, 2.4, 0.5, 0.08, '#ffd23f', 'glow');
      t.staff(x, tz - 1.1, 0, 'croupier');
      t.spot(x, tz + 1.2, { label: cat ? `${icons[cat]} ${cat} (jeux)` : '🎲 Salle des jeux (16 jeux)', action: 'casino-hall', cat, r: 1.6, priority: 2 });
    });
    if (t.b.grand) t.spot(t.door.x, I.z2 - 1.5, { label: '🌟 Les 40 jeux du Grand Casino', action: 'casino-hall', r: 1.8, priority: 1 });
    // bar
    const bx = I.x2 - 4, bz = I.z2 - 3.2;
    t.box(bx, 0, bz, 5, 1.1, 0.9, '#5a3416'); t.box(bx, 1.1, bz, 5.1, 0.06, 1.0, '#d4a017'); t.solid(bx, bz, 5, 0.9, 1.2);
    t.staff(bx, bz - 0.9, 0, 'serveur');
    for (let x = bx - 2; x <= bx + 2; x += 1) t.seat(x, bz + 0.9, Math.PI, 0.7);
    t.box(I.x2 - 0.2, 1.6, 0, 0.05, 1.2, 8, '#ffd23f', 'glow', 0);
  },

  range(t) {
    const L = rangeLayout(t.F.W, t.F.D), I = L.I;
    // séparations des couloirs, tablettes des postes, fond pare-balles
    for (let k = 0; k <= RANGE.lanes; k++) {
      const x = I.x1 + 1 + L.laneW * k;
      t.box(x, 0, L.boothZ, 0.12, 2.0, 1.4, '#5b6770'); t.solid(x, L.boothZ, 0.15, 1.4, 2);
    }
    for (let k = 0; k < RANGE.lanes; k++) {
      t.box(L.laneX(k), 0, L.boothZ - 0.2, L.laneW - 0.3, 1.05, 0.5, '#8d6e63');
      t.box(L.laneX(k), 0.02, (L.boothZ + L.backZ) / 2, 0.06, 0.02, L.boothZ - L.backZ - 1, '#ffd23f');
    }
    t.solid(0, L.boothZ - 0.2, I.x2 - I.x1, 0.5, 1.05); // on ne passe pas dans les couloirs
    t.box(0, 0, L.backZ - 0.6, I.x2 - I.x1, 4, 0.6, '#3a3a3a');
    for (let x = I.x1 + 1; x < I.x2; x += 2) t.box(x, 0.2, L.backZ - 0.25, 1.6, 3.4, 0.1, '#4a4a4a');
    for (let z = L.boothZ - 3; z > L.backZ; z -= 4) t.box(0, t.gH - 0.4, z, I.x2 - I.x1 - 1, 0.12, 0.3, '#fff3c4', 'glow');
    // accueil : moniteur, armurerie (armes de location, qui ne sortent pas d'ici), bancs
    const cx = I.x1 + 3, cz = I.z2 - 2;
    t.box(cx, 0, cz, 3.4, 1.1, 0.9, '#2b2d42'); t.box(cx, 1.1, cz, 3.5, 0.06, 1.0, '#e63946'); t.solid(cx, cz, 3.4, 0.9, 1.2);
    t.box(I.x1 + 0.4, 1.0, cz - 0.6, 0.1, 1.2, 3, '#6b4f3a', 'main', 0);
    t.staff(cx, cz - 1.0, 0, 'moniteur');
    t.spot(cx, cz + 1.1, { label: '🎯 Stand de tir : séance ou compétition', action: 'range', r: 2.4, priority: 2 });
    for (let x = 1; x < I.x2 - 1; x += 2.2) t.seat(x, I.z2 - 1.2, Math.PI, 0.45);
    t.box(I.x2 - 0.15, 1.4, cz - 1, 0.04, 1, 2.4, '#ffffff', 'main', 0);
  },

  laser(t) {
    const I = t.inner;
    // arène sombre : murets néon, piliers, labyrinthe
    for (let x = I.x1 + 3; x < I.x2 - 2; x += 5) for (let z = I.z1 + 3; z < I.z2 - 6; z += 5) {
      const horiz = ((x + z) | 0) % 2 === 0;
      t.box(x, 0, z, horiz ? 2.6 : 0.4, 1.4, horiz ? 0.4 : 2.6, '#14102b'); t.solid(x, z, horiz ? 2.6 : 0.4, horiz ? 0.4 : 2.6, 1.4);
      t.box(x, 1.4, z, horiz ? 2.6 : 0.42, 0.06, horiz ? 0.42 : 2.6, ['#29e6ff', '#ff3fa4', '#7ac74f'][(x * 7 + z) & 1 ? 0 : 1], 'glow');
    }
    // accueil : gilets et pistolets laser (ne sortent pas de l'arène)
    const cx = I.x2 - 3, cz = I.z2 - 2;
    t.box(cx, 0, cz, 3.2, 1.1, 0.9, '#2b2d6e'); t.box(cx, 1.1, cz, 3.3, 0.06, 1.0, '#29e6ff', 'glow'); t.solid(cx, cz, 3.2, 0.9, 1.2);
    t.staff(cx, cz - 1.0, 0, 'gerant');
    t.spot(cx, cz + 1.1, { label: '🔴 Laser Galaxy : lancer une partie', action: 'laser', r: 2.2, priority: 2 });
  },

  karting(t) {
    const I = t.inner;
    const cx = 0, cz = I.z1 + 1.8;
    t.box(cx, 0, cz, 4.2, 1.1, 0.9, '#f72585'); t.box(cx, 1.1, cz, 4.3, 0.06, 1.0, '#3a0ca3'); t.solid(cx, cz, 4.2, 0.9, 1.2);
    t.staff(cx, cz - 1.0, 0, 'commissaire');
    t.spot(cx, cz + 1.1, { label: '🏎️ Accueil du karting : sessions, courses, adhésions', action: 'karting', r: 2.4, priority: 2 });
    // karts exposés, râtelier de casques, damier
    t.vehicleDisplay('kart', I.x1 + 1.6, I.z2 - 2.2, Math.PI / 2);
    t.vehicleDisplay('kart', I.x2 - 1.6, I.z2 - 2.2, -Math.PI / 2);
    for (let i = 0; i < 6; i++) t.sphere(I.x1 + 0.5, 1.2 + (i % 2) * 0.45, I.z1 + 1.5 + Math.floor(i / 2) * 0.6, 0.17, ['#e63946', '#3a86ff', '#ffd23f'][i % 3]);
    for (let i = 0; i < 8; i++) for (let k = 0; k < 2; k++) t.box(I.x2 - 0.15, 1.6 + k * 0.25, I.z1 + 1 + i * 0.25, 0.03, 0.25, 0.25, (i + k) % 2 ? '#111111' : '#ffffff', 'main', 0);
  },

  paintball(t) {
    const I = t.inner;
    const cx = 0, cz = I.z1 + 2;
    t.box(cx, 0, cz, 3.6, 1.1, 0.9, '#386641'); t.box(cx, 1.1, cz, 3.7, 0.06, 1.0, '#a7c957'); t.solid(cx, cz, 3.6, 0.9, 1.2);
    t.staff(cx, cz - 1.0, 0, 'moniteur');
    t.spot(cx, cz + 1.1, { label: '🟢 Paintball : lancer une partie', action: 'paintball', r: 2.2, priority: 2 });
    for (let x = I.x1 + 1; x < I.x2 - 1; x += 1.2) { t.box(x, 1.0, I.z1 + 0.25, 0.5, 0.9, 0.12, ['#2a9d8f', '#e9c46a', '#e76f51'][Math.round(x) & 1 ? 0 : 2], 'main', 0); }
  },
};

export const LEISURE_STAFF_LINES = {
  croupier: ['Faites vos jeux... Rien ne va plus !', 'La maison gagne toujours. C\'est écrit sur ma cravate.', 'Joue pour t\'amuser, pas pour te refaire.'],
  vigile: ['Pièce d\'identité ? 18 ans minimum, même pour les pigeons.', 'Ici, on joue avec des PlayCoins. Rien d\'autre.'],
  hotesse: ['Bienvenue au Casino Royal Pomme ! Pensez à fixer votre limite de jeu.', 'Une limite de pertes, c\'est la ceinture de sécurité du joueur.'],
  commissaire: ['Drapeau bleu : laisse passer le plus rapide !', 'Le casque, c\'est obligatoire. Même pour Mamie Turbo.', 'Record du circuit ? Dédé l\'a battu en 2019... en trottinette.'],
  moniteur: ['Le canon toujours vers les cibles. Toujours.', 'Les armes ne quittent JAMAIS le stand. Règle n°1.', 'L\'otage, on l\'épargne. Ça coûte 15 points.'],
};
