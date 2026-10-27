import * as THREE from 'three';
import { h, fmt } from '../ui/dom.js';
import { SHAPES } from '../core/static-builder.js';
import { groundHeight, WATER_LEVEL } from '../../shared/world-layout.js';
import { ISLANDS, ISLAND_BY_ID, islandAt, islandDock, coastR, FERRY, SIGHTS, SIGHT_BY_ID } from '../../shared/islands.js';
import { mulberry32 } from '../../shared/rng.js';
import { tree } from './props.js';

// ÎLES ET MERVEILLES (décor + système) : palmiers, pontons, phare (faisceau la nuit), arche en cœur,
// jungle et cascade, volcan qui fume, cascade des Géants, champ de lavande ; navette des îles depuis
// le ponton de la plage ; « 📸 Admirer » sur chaque merveille (récompense à la découverte).
const LAVENDER = { x: -1200, z: -500, w: 64, d: 44 };
const GIANTS_FALL = { x: 0, zTop: -2976, zPool: -2956, top: 24 };

// ------------------------------------------------------------------ décor statique
export function buildIslands(sb, col) {
  for (const I of ISLANDS) {
    const r = mulberry32(Math.abs(I.x * 7 + I.z * 13));
    // palmiers près des plages, arbres plus à l'intérieur (jungle : forêt dense)
    const n = I.kind === 'jungle' ? 70 : I.kind === 'volcan' ? 26 : Math.round(I.r * 0.7);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, R = coastR(I, I.x + Math.cos(a), I.z + Math.sin(a));
      const d = (I.kind === 'jungle' ? Math.sqrt(r()) * 0.85 : 0.35 + r() * 0.5) * R;
      const x = I.x + Math.cos(a) * d, z = I.z + Math.sin(a) * d;
      if (groundHeight(x, z) < 0.5 || Math.hypot(x - islandDock(I).x, z - islandDock(I).z) < 7) continue;
      if (I.kind === 'volcan' && d > 0.5 * R) continue;
      if (I.kind === 'phare' && Math.hypot(x - 768, z - 222) < 8) continue;
      tree(sb, col, x, z, I.kind === 'jungle' && r() < 0.6 ? 'round' : 'palm', 0.9 + r() * 0.5);
    }
    // rochers sur la côte
    for (let i = 0; i < (I.kind === 'phare' ? 30 : 14); i++) {
      const a = r() * Math.PI * 2, R = coastR(I, I.x + Math.cos(a), I.z + Math.sin(a)), d = R * (0.92 + r() * 0.14);
      const x = I.x + Math.cos(a) * d, z = I.z + Math.sin(a) * d;
      sb.blob(x, groundHeight(x, z) - 0.3, z, 0.8 + r() * 1.6, ['#8d8173', '#6c757d', '#7d6e5a', '#5c677d'][Math.floor(r() * 4)], 0.7);
    }
    // ponton de la navette (vers la ville)
    const D = islandDock(I);
    for (let k = 0; k < 7; k++) {
      const z = D.z - 1 - k * 2;
      sb.box(D.x, WATER_LEVEL + 0.55, z, 3, 0.18, 2, '#9c6b3c');
      for (const sx of [-1.4, 1.4]) sb.cyl(D.x + sx, WATER_LEVEL - 2, z, 0.12, 2.8, '#6b4a2b', 6);
    }
    col.addBox(D.x - 1.5, WATER_LEVEL - 3, D.z - 15, D.x + 1.5, WATER_LEVEL + 0.73, D.z);
    sb.box(D.x + 2.2, groundHeight(D.x + 2.2, D.z + 1) , D.z + 1, 0.12, 2.2, 0.12, '#6b4a2b');
    sb.box(D.x + 2.2, groundHeight(D.x + 2.2, D.z + 1) + 1.8, D.z + 1, 1.5, 0.5, 0.08, '#ffd166');
  }
  mouettes(sb, col); amoureux(sb, col); phare(sb, col); tortue(sb, col); volcan(sb, col);
  giantsFall(sb, col); lavender(sb, col);
}

function mouettes(sb, col) {
  const I = ISLAND_BY_ID.mouettes, r = mulberry32(5);
  for (let i = 0; i < 5; i++) {   // parasols et transats
    const x = I.x - 12 + i * 6, z = I.z + 18 + (i % 2) * 2, y = groundHeight(x, z);
    sb.cyl(x, y, z, 0.05, 2.2, '#f1f1f1', 6); sb.cone(x, y + 2, z, 1.4, 0.5, ['#ff5a5f', '#ffd166', '#2ec4b6'][i % 3], 10);
    sb.box(x + 1, y + 0.2, z + 0.4, 0.7, 0.12, 1.8, '#ffffff');
  }
  for (let i = 0; i < 8; i++) { const x = I.x - 20 + r() * 40, z = I.z - 10 + r() * 30; sb.sphere(x, groundHeight(x, z) + 0.3, z, 0.25, '#ffffff', 8); }   // mouettes posées
  sb.box(I.x + 9, groundHeight(I.x + 9, I.z + 4), I.z + 4, 3, 2.4, 2.4, '#e9c46a'); sb.add(SHAPES.cone(4), { x: I.x + 9, y: groundHeight(I.x + 9, I.z + 4) + 2.4, z: I.z + 4, sx: 4.4, sy: 1.6, sz: 3.6, ry: Math.PI / 4, color: '#b08850' });   // paillote
  col.addBox(I.x + 7.5, 0, I.z + 2.8, I.x + 10.5, 2.4, I.z + 5.2);
}

function amoureux(sb, col) {
  const I = ISLAND_BY_ID.amoureux, x0 = 230, z0 = 254, y = groundHeight(x0, z0);
  // arche en forme de cœur (courbe paramétrique)
  for (let k = 0; k < 64; k++) {
    const t = (k / 64) * Math.PI * 2, hx = 16 * Math.sin(t) ** 3, hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    sb.sphere(x0 + hx * 0.17, y + 2.6 + hy * 0.17, z0, 0.28, k % 2 ? '#ff4d6d' : '#ff8fab', 8);
  }
  for (const sx of [-1, 1]) col.addCyl(x0 + sx * 2.4, z0, 0.3, 0, 3);
  sb.box(x0, y, z0 + 3.5, 2, 0.45, 0.6, '#9c6b3c'); sb.box(x0, y + 0.45, z0 + 3.75, 2, 0.5, 0.1, '#9c6b3c');   // banc face au large
  const r = mulberry32(11);
  for (let i = 0; i < 40; i++) { const a = r() * 6.28, d = 3 + r() * 10, x = I.x + Math.cos(a) * d, z = I.z + Math.sin(a) * d; if (groundHeight(x, z) > 0.4) sb.sphere(x, groundHeight(x, z) + 0.12, z, 0.14, ['#ff4d6d', '#ffd166', '#c77dff', '#ffffff'][i % 4], 6); }
  for (const [lx, lz] of [[-5, 1], [5, 1], [-4, -5], [4, -5]]) { const x = x0 + lx, z = z0 + lz, yy = groundHeight(x, z); sb.cyl(x, yy, z, 0.05, 1.6, '#2b2d42', 6); sb.sphere(x, yy + 1.7, z, 0.18, '#ffe8a3', 8); }
}

function phare(sb, col) {
  const x = 768, z = 222, y = groundHeight(x, z) - 0.2;
  for (let i = 0; i < 7; i++) sb.add(SHAPES.frustum(18, 1.12), { x, y: y + i * 2, z, sx: 3.4 - i * 0.18, sy: 2, sz: 3.4 - i * 0.18, color: i % 2 ? '#ffffff' : '#d62828' });
  sb.cyl(x, y + 14, z, 2.1, 0.25, '#2b2d42', 18);                         // galerie
  sb.cyl(x, y + 14.25, z, 1.3, 1.8, '#bde0fe', 14, 'windows');            // lanterne vitrée
  sb.cone(x, y + 16.05, z, 1.6, 1.4, '#d62828', 14);
  col.addCyl(x, z, 1.8, 0, 16);
  sb.box(x - 6, y, z + 3, 4, 3, 4, '#f1faee'); sb.add(SHAPES.gable(), { x: x - 6, y: y + 3, z: z + 3, sx: 4.4, sy: 1.6, sz: 4.4, color: '#264653' });   // maison du gardien
  col.addBox(x - 8, 0, z + 1, x - 4, 4, z + 5);
}

function tortue(sb, col) {
  const x = -1300, z = 352, y = groundHeight(x, z);
  // falaise de la cascade, bassin et statues tiki
  sb.blob(x, y - 1, z + 9, 7, '#6b705c', 1.3); sb.blob(x - 6, y - 1, z + 8, 5, '#5c677d', 1.1); sb.blob(x + 6, y - 1, z + 8, 5, '#6c757d', 1.2);
  col.addCyl(x, z + 9, 6, 0, 10);
  sb.cyl(x, y - 0.2, z, 4.2, 0.3, '#3fb8e8', 24);
  for (const [dx, c] of [[-6, '#8d5a2b'], [6, '#a0703c']]) { const yy = groundHeight(x + dx, z - 4); sb.box(x + dx, yy, z - 4, 1.1, 2.6, 1.1, c); sb.box(x + dx, yy + 1.8, z - 3.42, 0.8, 0.25, 0.05, '#ffd166'); sb.box(x + dx, yy + 1.3, z - 3.42, 0.6, 0.18, 0.05, '#14141c'); col.addBox(x + dx - 0.6, 0, z - 4.6, x + dx + 0.6, 3, z - 3.4); }
}

function volcan(sb, col) {
  const I = ISLAND_BY_ID.volcan, r = mulberry32(77);
  const yC = groundHeight(I.x, I.z);
  sb.cyl(I.x, yC + 0.15, I.z, 5.2, 0.15, '#ff5400', 20, 'glow');          // lave au fond du cratère
  for (let i = 0; i < 24; i++) { const a = r() * 6.28, d = 8 + r() * 4, x = I.x + Math.cos(a) * d, z = I.z + Math.sin(a) * d; sb.blob(x, groundHeight(x, z) - 0.3, z, 0.6 + r(), '#3a2a26', 0.8); }
  // sentier de pierres jusqu'au cratère (depuis le ponton)
  const D = islandDock(I);
  for (let k = 0; k <= 30; k++) { const t = k / 30, x = D.x + Math.sin(t * 5) * 6, z = D.z + (I.z - 12 - D.z) * t; sb.box(x, groundHeight(x, z) + 0.02, z, 1.4, 0.08, 1.2, '#b5a89a'); }
}

function giantsFall(sb, col) {
  const F = GIANTS_FALL;
  sb.cyl(F.x, -0.15, F.zPool, 7, 0.25, '#3fb8e8', 28);          // bassin
  for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; sb.blob(F.x + Math.cos(a) * 7.3, -0.2, F.zPool + Math.sin(a) * 7.3, 0.9 + (i % 3) * 0.3, '#6c757d', 0.6); }
  for (const dx of [-7, 7]) sb.blob(F.x + dx, 0, F.zPool - 7, 3.2, '#6f6a64', 1.6);   // rochers qui encadrent la chute
  sb.box(F.x + 9, 0, F.zPool + 6, 2, 0.45, 0.6, '#8d5a2b'); sb.box(F.x + 9, 0.45, F.zPool + 6.25, 2, 0.5, 0.1, '#8d5a2b');
  col.addCyl(F.x, F.zPool, 6.6, 0, 0.3);
}

function lavender(sb, col) {
  const L = LAVENDER, r = mulberry32(31);
  for (let z = L.z - L.d / 2; z <= L.z + L.d / 2; z += 2.2) for (let x = L.x - L.w / 2; x <= L.x + L.w / 2; x += 1.1) {
    sb.blob(x + (r() - 0.5) * 0.3, 0, z, 0.55, r() < 0.15 ? '#9d4edd' : '#b388eb', 0.75);
  }
  for (const [dx, dz] of [[-L.w / 2 - 6, -6], [L.w / 2 + 5, 8]]) tree(sb, col, L.x + dx, L.z + dz, 'round', 1.2);
  for (let i = 0; i < 3; i++) { const x = L.x + L.w / 2 + 3, z = L.z - 8 + i * 2; sb.box(x, 0, z, 0.8, 0.7, 0.8, '#f1faee'); sb.box(x, 0.7, z, 0.9, 0.1, 0.9, '#ffd166'); }   // ruches
  sb.box(L.x, 0, L.z + L.d / 2 + 3, 2, 0.45, 0.6, '#8d5a2b');
}

// ------------------------------------------------------------------ système (vivant)
export class Islands {
  constructor(g) {
    this.g = g;
    this.here = null;
    const S = g.engine.scene;
    // faisceau du phare (la nuit)
    this.beam = new THREE.Mesh(new THREE.ConeGeometry(4, 60, 16, 1, true).rotateZ(Math.PI / 2).translate(30, 0, 0), new THREE.MeshBasicMaterial({ color: '#fff3b0', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
    this.beam.position.set(768, groundHeight(768, 222) + 15, 222);
    S.add(this.beam);
    // cascades : rideaux d'eau animés
    const tex = this.waterTex();
    const fall = (w, hgt, x, y, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hgt), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide })); m.position.set(x, y, z); S.add(m); return m; };
    // la cascade des Géants suit la pente de la falaise (du haut, z ≈ -2980, jusqu'au bassin)
    const top = { y: groundHeight(GIANTS_FALL.x, -2980), z: -2980 }, bot = { y: 0, z: GIANTS_FALL.zPool - 2 };
    const big = fall(9, Math.hypot(top.y - bot.y, top.z - bot.z), GIANTS_FALL.x, (top.y + bot.y) / 2 + 0.6, (top.z + bot.z) / 2 + 0.8);
    big.rotation.x = -Math.atan2(bot.z - top.z, top.y - bot.y);
    this.falls = [big, fall(3, 6, -1300, groundHeight(-1300, 352) + 3, 353.5)];
    this.tex = tex;
    // interactions : navette (ponton de la plage + pontons des îles), merveilles
    g.interactions.add({ x: FERRY.dock.x, z: FERRY.dock.z, r: FERRY.r, priority: 2, label: `⛴️ Navette des îles (${FERRY.price} PC)`, action: () => this.ferryMenu(null) });
    for (const I of ISLANDS) { const D = islandDock(I); g.interactions.add({ x: D.x, z: D.z - 1, r: 5, priority: 2, label: '⛴️ Navette : retour au port ou autre île', action: () => this.ferryMenu(I.id) }); }
    for (const s of SIGHTS) g.interactions.add({ x: s.x, z: s.z, r: s.r, priority: 1, label: `📸 Admirer : ${s.name}`, action: () => this.admire(s.id) });
  }

  waterTex() {
    const c = document.createElement('canvas'); c.width = 64; c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#9fe3ff'; x.fillRect(0, 0, 64, 128);
    for (let i = 0; i < 40; i++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.75)' : 'rgba(76,201,240,0.6)'; x.fillRect(Math.random() * 64, Math.random() * 128, 2 + Math.random() * 4, 14 + Math.random() * 30); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 3);
    return t;
  }

  ferryMenu(from) {
    const g = this.g;
    const dests = [...(from ? [{ id: 'port', name: 'Retour au port (ponton de la Plage des Orteils)', emoji: '🏖️' }] : []), ...ISLANDS.filter((I) => I.id !== from).map((I) => ({ id: I.id, name: I.name, emoji: { plage: '🏝️', amour: '💗', phare: '🗼', jungle: '🌴', volcan: '🌋' }[I.kind], desc: I.desc }))];
    g.ui.dialog({ name: 'Capitaine Marcel', role: 'Navette des îles', text: `Où on va, moussaillon ? Chaque traversée coûte ${g.profile.admin ? '0' : FERRY.price} PC. Tu peux aussi y aller à la nage, en jet ski, en voilier ou en sous-marin !`, choices: [
      ...dests.map((d) => ({ label: `${d.emoji} ${d.name}`, action: (m) => { m.close(); this.go(d.id); } })),
      { label: 'Plus tard', ghost: true, action: (m) => m.close() },
    ] });
  }

  async go(to) {
    const g = this.g;
    let r;
    try { r = await g.net.request('ferry.go', { to }); } catch (e) { g.ui.toast(e.message, 'bad', 4000); g.sfx('error'); return; }
    g.sfx('whoosh');
    const el = h('div.fade-ferry', '⛴️ Traversée...');
    g.ui.root.append(el);
    setTimeout(() => { g.player.teleport(r.x, r.z, r.yaw); g.sfx('splash'); }, 450);
    setTimeout(() => el.remove(), 1300);
    const I = ISLAND_BY_ID[to];
    g.ui.toast(I ? `🏝️ Bienvenue sur l'${I.name.replace(/^Île /, 'île ').replace(/^Îlot /, 'îlot ')} ! ${I.desc}${r.cost ? ` (-${fmt(r.cost)} PC)` : ''}` : '🏖️ De retour au port.', 'good', 5500);
  }

  async admire(id) {
    const g = this.g, s = SIGHT_BY_ID[id];
    let r;
    try { r = await g.net.request('sight.visit', { id }); } catch (e) { g.ui.toast(e.message, 'bad', 3500); return; }
    g.player.setPose('celebrate', 1.6);
    if (r.needs) g.emit('needs', r.needs);
    if (r.first) {
      g.sfx('secret');
      g.ui.toast(`${s.emoji} Nouvelle merveille découverte : ${s.name} ! +${fmt(r.coins)} PC, +${r.xp} XP (${r.found}/${SIGHTS.length})${r.all ? ` · 🏆 TOUTES découvertes : +${fmt(r.bonus)} PC !` : ''}`, 'good', 6500);
    } else g.ui.toast(`${s.emoji} Quelle vue... Ça fait du bien. ${r.humeur ? `🙂 +${r.humeur} humeur` : ''}`, 'good', 3500);
    if (r.love) g.ui.toast('💞 Moment romantique à deux : l\'affection monte !', 'good', 4000);
  }

  update(dt, t) {
    const g = this.g, P = g.player.pos;
    // faisceau qui tourne la nuit, cascades qui coulent
    const night = !!g.world?.dayNight?.night;
    this.beam.visible = night;
    this.beam.rotation.y = t * 0.9;
    this.tex.offset.y -= dt * 1.6;
    // arrivée sur une île : nom à l'écran
    if (P.z > 150) {
      const I = islandAt(P.x, P.z);
      if (I && I !== this.here) { this.here = I; g.hud?.zone?.(I.name); g.ui.toast(`🏝️ ${I.name}`, '', 2500); }
      else if (!I) this.here = null;
    } else this.here = null;
    // le volcan fume, la cascade fait de la brume
    if (Math.random() < dt * 3 && Math.hypot(P.x - 1500, P.z - 345) < 400) g.fx?.emit?.({ x: 1500 + (Math.random() - 0.5) * 6, y: groundHeight(1500, 345) + 1, z: 345 + (Math.random() - 0.5) * 6, n: 3, colors: ['#9a8c86', '#cfc4bd', '#6b5a50'], speed: 1.2, gravity: -2.2, life: 3.5, size: 0.9 });
    if (Math.random() < dt * 6 && Math.hypot(P.x - GIANTS_FALL.x, P.z - GIANTS_FALL.zPool) < 120) g.fx?.emit?.({ x: GIANTS_FALL.x + (Math.random() - 0.5) * 5, y: 0.3, z: GIANTS_FALL.zTop + 5, n: 3, colors: ['#ffffff', '#caf0f8'], speed: 1.8, gravity: -0.5, life: 1.4, size: 0.25 });
  }
}
