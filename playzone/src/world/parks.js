import { SHAPES } from '../core/static-builder.js';
import { PARKS, ZOO } from '../../shared/city.js';
import { ZOO_PENS, SPECIES } from '../../shared/content/animals.js';
import { mulberry32 } from '../../shared/rng.js';
import { tree } from './props.js';

// PARCS ET ZOO (décor + activités) : pelouses, allées, haies, arbres, bancs où s'asseoir, aires de
// jeux (balançoires, toboggan, bac à sable), terrains de basket, fontaines à vœux, kiosques à glaces ;
// le Zoo de PLAYZONE et ses enclos (lions, éléphants, girafes, zèbres, singes, pingouins).
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const FACTS = {
  lion: ['Le lion dort jusqu\'à 20 heures par jour. Un modèle.', 'Son rugissement s\'entend à 8 km. Celui-ci rugit surtout à l\'heure du repas.'],
  elephant: ['L\'éléphant n\'oublie jamais. Surtout pas qui lui a piqué ses cacahuètes.', 'Sa trompe compte 40 000 muscles. Toi, combien ?'],
  girafe: ['La girafe dort 30 minutes par jour, debout. Respect.', 'Sa langue est violette et mesure 50 cm.'],
  zebre: ['Chaque zèbre a des rayures uniques, comme une empreinte digitale.', 'Blanc à rayures noires ou noir à rayures blanches ? Le débat fait rage.'],
  singe: ['Les singes s\'épouillent pour se faire des amis. Ne le fais pas au bureau.', 'Celui-là t\'imite. Fais coucou !'],
  pingouin: ['Ce sont des manchots, en vrai. Mais « pingouin », c\'est plus rigolo.', 'Ils offrent un caillou à l\'élu·e de leur cœur.'],
};

// ------------------------------------------------------------------ décor statique
export function buildParks(sb, col) {
  PARKS.forEach((P, i) => buildPark(sb, col, P, i));
  buildZoo(sb, col);
}

function buildPark(sb, col, P, i) {
  const r = mulberry32(1000 + i);
  const { x, z, w, d } = P;
  sb.box(x, 0, z, w, 0.05, d, '#79c95a');                                  // pelouse
  sb.box(x, 0.01, z, w, 0.06, 2.4, '#d6c7a1'); sb.box(x, 0.01, z, 2.4, 0.06, d, '#d6c7a1');   // allées en croix
  // haie basse avec quatre entrées
  const hedge = (cx, cz, hw, hd) => { sb.box(cx, 0, cz, hw, 0.8, hd, '#2d6a4f'); col.addBox(cx - hw / 2, 0, cz - hd / 2, cx + hw / 2, 0.8, cz + hd / 2); };
  for (const s of [-1, 1]) {
    hedge(x - w / 4 - 0.8, z + s * d / 2, w / 2 - 3.4, 0.6); hedge(x + w / 4 + 0.8, z + s * d / 2, w / 2 - 3.4, 0.6);
    hedge(x + s * w / 2, z - d / 4 - 0.8, 0.6, d / 2 - 3.4); hedge(x + s * w / 2, z + d / 4 + 0.8, 0.6, d / 2 - 3.4);
  }
  for (const [sx, sz] of [[-1, -1], [1, 1], [-1, 1]]) tree(sb, col, x + sx * (w / 2 - 3.5), z + sz * (d / 2 - 3.5), r() < 0.5 ? 'round' : 'pine', 1 + r() * 0.3);
  // lampadaires et massifs de fleurs
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const lx = x + sx * 4, lz = z + sz * 4;
    sb.cyl(lx, 0, lz, 0.07, 3.2, '#2b2d42', 6); sb.sphere(lx, 3.3, lz, 0.22, '#fff3c4', 8, 'glow');
    for (let k = 0; k < 6; k++) sb.sphere(x + sx * (7 + r() * 3), 0.15, z + sz * (2 + r() * 2), 0.18, ['#ff4d6d', '#ffd166', '#c77dff', '#ffffff', '#ff9f1c'][k % 5], 6);
  }
  // bancs (au bord des allées)
  for (const [bx, bz, yaw] of [[x - 7, z - 2, 0], [x + 7, z + 2, Math.PI], [x - 2, z + 7, -Math.PI / 2], [x + 2, z - 7, Math.PI / 2]]) bench(sb, col, bx, bz, yaw);
  if (P.kind === 'jeux') {
    // balançoires
    const bx = x - 11, bz = z + 8;
    for (const s of [-1, 1]) { sb.add(SHAPES.box(), { x: bx + s * 2.2, y: 0, z: bz, sx: 0.12, sy: 2.6, sz: 0.12, rz: s * 0.12, color: '#e63946' }); }
    sb.box(bx, 2.5, bz, 4.6, 0.12, 0.12, '#e63946');
    for (const s of [-0.8, 0.8]) { sb.box(bx + s, 0.5, bz, 0.6, 0.06, 0.3, '#ffd166'); sb.box(bx + s - 0.25, 0.55, bz, 0.02, 1.95, 0.02, '#adb5bd'); sb.box(bx + s + 0.25, 0.55, bz, 0.02, 1.95, 0.02, '#adb5bd'); }
    col.addCyl(bx - 2.2, bz, 0.15, 0, 2.6); col.addCyl(bx + 2.2, bz, 0.15, 0, 2.6);
    // toboggan
    const tx = x + 11, tz = z + 8;
    sb.box(tx - 1.6, 0, tz, 1.2, 2, 1.2, '#3a86ff'); sb.box(tx - 1.6, 2, tz, 1.4, 0.1, 1.4, '#ffd166');
    sb.add(SHAPES.box(), { x: tx + 0.4, y: 0.2, z: tz, sx: 3.2, sy: 0.1, sz: 0.9, rz: 0.55, color: '#ff5a5f' });
    col.addBox(tx - 2.2, 0, tz - 0.6, tx - 1, 2, tz + 0.6);
    // bac à sable et tourniquet
    sb.box(x - 11, 0, z - 8, 4, 0.3, 4, '#c9a46a'); sb.box(x - 11, 0.05, z - 8, 3.6, 0.3, 3.6, '#f2d59b');
    sb.cyl(x + 11, 0, z - 8, 1.6, 0.2, '#8338ec', 16); sb.cyl(x + 11, 0, z - 8, 0.08, 1.1, '#adb5bd', 6);
  } else if (P.kind === 'basket') {
    const cx = x - 9, cz = z + 7;
    sb.box(cx, 0.02, cz, 14, 0.05, 9, '#c0562f'); sb.box(cx, 0.03, cz, 0.12, 0.05, 9, '#ffffff'); sb.cyl(cx, 0.03, cz, 1.8, 0.05, '#e9edf2', 24);
    for (const s of [-1, 1]) {
      const hx = cx + s * 6.4;
      sb.cyl(hx + s * 0.6, 0, cz, 0.1, 3.4, '#495057', 8); sb.box(hx + s * 0.4, 3.0, cz, 0.08, 1.1, 1.7, '#ffffff');
      sb.add(SHAPES.ring(), { x: hx, y: 3.05, z: cz, sx: 0.9, sy: 0.9, sz: 0.9, color: '#ff6b35' });
      col.addCyl(hx + s * 0.6, cz, 0.15, 0, 3.4);
    }
  } else {
    // grande fontaine à vœux
    sb.cyl(x, 0, z, 3.6, 0.7, '#d8cfc4', 28); sb.cyl(x, 0.6, z, 3.2, 0.12, '#4cc9f0', 28);
    sb.cyl(x, 0.6, z, 0.4, 1.8, '#d8cfc4', 10); sb.cyl(x, 2.3, z, 1.3, 0.18, '#d8cfc4', 18); sb.sphere(x, 2.7, z, 0.35, '#4cc9f0', 10);
    col.addCyl(x, z, 3.6, 0, 0.7);
  }
  // kiosque à glaces (bâtiment) : parasol et petites tables devant
  const kx = x + w / 2 - 4, kz = z - d / 2 + 4;
  for (const t of [-1, 1]) { sb.cyl(kx - 5, 0, kz + t * 2.5, 0.5, 0.75, '#ffffff', 10); sb.cyl(kx - 5, 0, kz + t * 2.5, 0.05, 2.2, '#adb5bd', 6); sb.cone(kx - 5, 2.1, kz + t * 2.5, 1.3, 0.45, t > 0 ? '#ff5a5f' : '#2ec4b6', 10); }
}

function bench(sb, col, x, z, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  sb.add(SHAPES.box(), { x, y: 0.4, z, sx: 1.8, sy: 0.08, sz: 0.5, ry: yaw, color: '#9c6b3c' });
  sb.add(SHAPES.box(), { x: x - s * 0.24, y: 0.48, z: z - c * 0.24, sx: 1.8, sy: 0.5, sz: 0.06, ry: yaw, color: '#9c6b3c' });
  for (const k of [-0.75, 0.75]) sb.add(SHAPES.box(), { x: x + c * k, y: 0, z: z - s * k, sx: 0.08, sy: 0.4, sz: 0.45, ry: yaw, color: '#2b2d42' });
}

function buildZoo(sb, col) {
  const Z = ZOO, x1 = Z.x - Z.w / 2, x2 = Z.x + Z.w / 2, z1 = Z.z - Z.d / 2, z2 = Z.z + Z.d / 2;
  sb.box(Z.x + 6, 0, Z.z, Z.w - 12, 0.05, Z.d, '#8fcf6a');                 // pelouse du parc zoologique
  sb.box(Z.x + 2, 0.01, Z.z, Z.w - 4, 0.06, 7, '#d6c7a1');                  // allée centrale
  for (const ax of [71, 115]) sb.box(ax, 0.01, Z.z, 5, 0.06, Z.d - 6, '#d6c7a1');
  // clôture extérieure (entrée côté route, à l'ouest)
  const wall = (ax1, az1, ax2, az2) => { const cx = (ax1 + ax2) / 2, cz = (az1 + az2) / 2, w = Math.abs(ax2 - ax1) || 0.3, d = Math.abs(az2 - az1) || 0.3; sb.box(cx, 0, cz, w, 1.6, d, '#5c3d24'); col.addBox(cx - w / 2, 0, cz - d / 2, cx + w / 2, 1.6, cz + d / 2); };
  wall(x1 + 12, z1, x2, z1); wall(x1 + 12, z2, x2, z2); wall(x2, z1, x2, z2);
  wall(x1 + 12, z1, x1 + 12, Z.z - 5); wall(x1 + 12, Z.z + 5, x1 + 12, z2);
  // arche d'entrée
  for (const s of [-1, 1]) sb.box(x1 + 12, 0, Z.z + s * 5, 0.8, 4.5, 0.8, '#2d6a4f');
  sb.box(x1 + 12, 4.5, Z.z, 0.8, 1.2, 11, '#2d6a4f'); sb.box(x1 + 11.55, 4.65, Z.z, 0.05, 0.9, 9, '#ffd166');
  // enclos : sol, clôture fermée, décor selon l'animal
  for (const [sp, , [ex1, ez1, ex2, ez2]] of ZOO_PENS) {
    const cx = (ex1 + ex2) / 2, cz = (ez1 + ez2) / 2, w = ex2 - ex1, d = ez2 - ez1;
    const ground = { lion: '#e2c290', elephant: '#b08850', girafe: '#a7c957', zebre: '#c5d86d', singe: '#6a994e', pingouin: '#eaf4fb' }[sp];
    sb.box(cx, 0.02, cz, w, 0.05, d, ground);
    // clôture : poteaux + deux lisses
    for (const [ax, az, bx, bz] of [[ex1, ez1, ex2, ez1], [ex1, ez2, ex2, ez2], [ex1, ez1, ex1, ez2], [ex2, ez1, ex2, ez2]]) {
      const len = Math.hypot(bx - ax, bz - az), n = Math.ceil(len / 3);
      for (let k = 0; k <= n; k++) sb.cyl(ax + (bx - ax) * k / n, 0, az + (bz - az) * k / n, 0.09, 1.5, '#7a5230', 6);
      for (const y of [0.6, 1.3]) sb.box((ax + bx) / 2, y, (az + bz) / 2, Math.max(0.08, Math.abs(bx - ax)), 0.08, Math.max(0.08, Math.abs(bz - az)), '#9c6b3c');
      col.addBox(Math.min(ax, bx) - 0.15, 0, Math.min(az, bz) - 0.15, Math.max(ax, bx) + 0.15, 1.5, Math.max(az, bz) + 0.15, { noCamera: true });
    }
    const r = mulberry32(cx * 3 + cz);
    if (sp === 'lion') { sb.blob(cx + 6, 0, cz - 4, 3, '#b08968', 0.9); sb.blob(cx + 8, 0, cz - 1, 2, '#9c7a5a', 0.8); tree(sb, col, cx - 10, cz - 8, 'round', 1.2); }
    else if (sp === 'elephant') { sb.cyl(cx + 7, 0, cz + 6, 4, 0.12, '#4cc9f0', 20); for (let k = 0; k < 3; k++) tree(sb, col, cx - 12 + k * 6, cz - 12, 'round', 1.4); }
    else if (sp === 'girafe') { for (let k = 0; k < 4; k++) tree(sb, col, cx - 14 + r() * 28, cz - 12 + r() * 24, 'round', 1.8); }
    else if (sp === 'zebre') { for (let k = 0; k < 3; k++) sb.blob(cx - 12 + r() * 24, 0, cz - 12 + r() * 24, 0.8, '#8d8173', 0.6); }
    else if (sp === 'singe') {   // île aux singes : arbres, cordes, plateformes
      sb.cyl(cx, 0, cz, 7, 0.4, '#4f772d', 18);
      for (let k = 0; k < 3; k++) { const a = k * 2.1, tx = cx + Math.cos(a) * 4, tz = cz + Math.sin(a) * 4; tree(sb, col, tx, tz, 'round', 1.5); sb.box(tx, 2.4, tz, 2, 0.15, 2, '#9c6b3c'); }
      sb.box(cx, 3.5, cz, 8, 0.05, 0.05, '#c9a46a');
    } else {   // banquise : rochers blancs et bassin bleu
      sb.cyl(cx + 6, 0, cz + 4, 5.5, 0.1, '#3fa9f5', 22);
      for (let k = 0; k < 6; k++) sb.blob(cx - 10 + r() * 12, 0, cz - 10 + r() * 12, 1 + r() * 1.5, '#ffffff', 0.7);
    }
    // panneau devant l'enclos (côté allée)
    const pz = cz < Z.z ? ez2 + 1.2 : ez1 - 1.2;
    sb.box(cx, 0, pz, 0.1, 1.2, 0.1, '#5c3d24'); sb.box(cx, 1.2, pz, 2.2, 0.9, 0.1, '#ffd166');
  }
  // bancs et kiosque le long de l'allée
  for (const bx of [50, 95, 140]) { bench(sb, col, bx, Z.z - 3, 0); bench(sb, col, bx, Z.z + 3, Math.PI); }
}

// ------------------------------------------------------------------ système : activités
export class Parks {
  constructor(g) {
    this.g = g;
    const I = g.interactions;
    const play = async (kind, extra = {}) => {
      let r;
      try { r = await g.net.request('park.play', { kind }); } catch (e) { g.ui.toast(e.message, 'bad', 3000); return null; }
      if (r.needs) g.emit('needs', r.needs);
      return r;
    };
    for (const P of PARKS) {
      const { x, z, w, d } = P;
      // bancs
      for (const [bx, bz, yaw] of [[x - 7, z - 2, 0], [x + 7, z + 2, Math.PI], [x - 2, z + 7, -Math.PI / 2], [x + 2, z - 7, Math.PI / 2]]) {
        I.add({ x: bx + Math.sin(yaw) * 0.6, z: bz + Math.cos(yaw) * 0.6, r: 1.3, label: '🪑 S\'asseoir sur le banc', action: () => g.player.sit({ x: bx, z: bz, yaw, y: 0.45 }) });
      }
      I.add({ x: x + w / 2 - 6.5, z: z - d / 2 + 4, r: 2.2, priority: 2, label: '🍦 Acheter une glace (4 PC)', action: async () => { const r = await play('glace'); if (r) { g.sfx('cash'); g.ui.toast(`🍦 ${pick(['Vanille-fraise, le classique.', 'Pistache : excellent choix.', 'Chocolat triple : tu ne regrettes rien.', 'Parfum mystère... c\'est du chou-fleur ?!'])}`, 'good', 3500); } } });
      if (P.kind === 'jeux') {
        for (const s of [-0.8, 0.8]) I.add({ x: x - 11 + s, z: z + 8.8, r: 1.1, label: '🎠 Faire de la balançoire', action: async () => { const r = await play('balancoire'); if (r) { g.player.sit({ x: x - 11 + s, z: z + 8, yaw: Math.PI, y: 0.55, swing: true }); this.swing = { t: 0, base: { x: x - 11 + s, z: z + 8 } }; g.ui.toast('🎠 Wiiiii ! (bouge pour descendre)', 'good', 2500); } } });
        I.add({ x: x + 9.4, z: z + 9.4, r: 1.6, label: '🛝 Glisser sur le toboggan', action: async () => { const r = await play('toboggan'); if (r) this.slide(x + 11, z + 8); } });
      } else if (P.kind === 'basket') {
        I.add({ x: x - 12, z: z + 7, r: 3.5, label: '🏀 Tirer au panier', action: async () => { const r = await play('basket'); if (r) this.shoot(x - 15.4, z + 7, r.made); } });
      } else {
        I.add({ x, z: z + 4.4, r: 2.2, label: '🪙 Lancer une pièce dans la fontaine (vœu)', action: async () => { const r = await play('voeu'); if (r) { g.sfx(r.jackpot ? 'levelup' : 'pop'); g.ui.toast(r.jackpot ? `✨ Ton vœu est exaucé : +${r.jackpot} PC !` : pick(['🪙 Plouf. Ton vœu est enregistré.', '🪙 Un canard imaginaire approuve ton vœu.', '🪙 Le vœu sera traité sous 3 à 5 jours ouvrés.']), 'good', 3500); } } });
      }
    }
    // zoo : observer chaque enclos (anecdote + bonne humeur)
    for (const [sp, , [ex1, ez1, ex2, ez2], name] of ZOO_PENS) {
      const cx = (ex1 + ex2) / 2, cz = (ez1 + ez2) / 2, pz = cz < ZOO.z ? ez2 + 2.2 : ez1 - 2.2;
      I.add({ x: cx, z: pz, r: 3, label: `🔎 Observer : ${name}`, action: async () => {
        const r = await play(`zoo:${sp}`);
        if (r) g.ui.dialog({ name: `${SPECIES[sp].emoji} ${name}`, role: 'Zoo de PLAYZONE', text: `${pick(FACTS[sp])} ${r.first ? `(+${r.xp} XP, nouvel animal découvert !)` : ''}`, choices: [{ label: 'Trop mignon !', ghost: true, action: (m) => m.close() }] });
      } });
    }
  }

  // ballon de basket : petite parabole vers le panier, panier ou pas
  shoot(hx, hz, made) {
    const g = this.g, P = g.player;
    P.yaw = Math.atan2(hx - P.pos.x, hz - P.pos.z);
    P.setPose('throw', 0.5);
    const from = { x: P.pos.x, y: P.pos.y + 2, z: P.pos.z }, to = { x: hx + (made ? 0 : (Math.random() - 0.5) * 1.4), y: 3.05, z: hz + (made ? 0 : 0.6) };
    let t = 0;
    const iv = setInterval(() => {
      t += 0.06;
      const k = Math.min(1, t), y = from.y + (to.y - from.y) * k + Math.sin(k * Math.PI) * 2.2;
      g.fx?.emit?.({ x: from.x + (to.x - from.x) * k, y, z: from.z + (to.z - from.z) * k, n: 1, colors: ['#ff6b35'], speed: 0, gravity: 0, life: 0.15, size: 0.24 });
      if (k >= 1) { clearInterval(iv); g.sfx(made ? 'success' : 'bump'); g.ui.toast(made ? '🏀 PANIER ! Swish !' : pick(['🏀 Raté... sur le cercle !', '🏀 Air ball. On ne dira rien.', '🏀 Presque !']), made ? 'good' : '', 2200); }
    }, 30);
  }

  slide(tx, tz) {
    const g = this.g, P = g.player;
    let t = 0;
    P.teleport(tx - 1.6, tz, Math.PI / 2, 2.05);
    const iv = setInterval(() => {
      t += 0.05;
      if (t >= 1) { clearInterval(iv); P.teleport(tx + 2.3, tz, Math.PI / 2); g.sfx('pop'); return; }
      P.pos.set(tx - 1.2 + t * 3.4, 2.05 - t * 1.9, tz); P.vel.set(0, 0, 0);
    }, 30);
    g.sfx('whoosh');
  }

  update(dt) {
    // balançoire : le joueur oscille tant qu'il reste assis
    const s = this.swing, P = this.g.player;
    if (!s) return;
    if (!P.seated?.swing) { this.swing = null; return; }
    s.t += dt;
    const a = Math.sin(s.t * 2.6) * 0.55;
    P.seated.z = s.base.z + Math.sin(a) * 1.6;
    P.seated.y = 0.55 + (1 - Math.cos(a)) * 1.6;
  }
}
