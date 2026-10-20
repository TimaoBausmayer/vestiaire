import * as THREE from 'three';
import { BUILDINGS, ROADS, POI, MINIGAME_SPOTS, POND, CAT_TREES, groundHeight } from '../../shared/world-layout.js';
import { mulberry32 } from '../../shared/rng.js';
import { PALETTE } from '../core/materials.js';
import { SHAPES } from '../core/static-builder.js';
import { makeSign } from './signs.js';

// Décor : routes, place, arbres, lampadaires, plage, ponton, ferme, parc, fontaine, scène...

const rand = mulberry32(1234);

// --- Zones occupées (pour ne pas planter un arbre au milieu d'une route ou d'un stand)
const blockers = [];
function block(x1, z1, x2, z2) { blockers.push([Math.min(x1, x2), Math.min(z1, z2), Math.max(x1, x2), Math.max(z1, z2)]); }
for (const r of ROADS) block(r[0] - 2, r[1] - 2, r[2] + 2, r[3] + 2);
for (const b of BUILDINGS) block(b.x - b.w / 2 - 3, b.z - b.d / 2 - 3, b.x + b.w / 2 + 3, b.z + b.d / 2 + 3);
block(-26, -26, 26, 26);
const mg = MINIGAME_SPOTS;
block(-46, -102, -14, -68); // tir aux tartes
block(-16, -114, 16, -84);  // enclos à poulets
block(16, -124, 56, -66);   // parcours d'obstacles
block(-60, -122, -40, -96); // grande roue
block(-128, 12, -66, 60);   // champs + enclos
block(-80, -34, -64, -10);  // poulailler
block(44, 80, 62, 128);     // ponton
function free(x, z, pad = 0) {
  for (const [x1, z1, x2, z2] of blockers) if (x > x1 - pad && x < x2 + pad && z > z1 - pad && z < z2 + pad) return false;
  if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 2) return false;
  return true;
}

// --- Arbres
export function tree(sb, col, x, z, kind = 'round', s = 1) {
  const y = groundHeight(x, z);
  if (kind === 'pine') {
    sb.cyl(x, y, z, 0.3 * s, 1.6 * s, PALETTE.trunk, 6);
    const c = rand() > 0.5 ? '#2f7a45' : '#3a8a4f';
    sb.cone(x, y + 1.2 * s, z, 2.2 * s, 3 * s, c, 7);
    sb.cone(x, y + 2.8 * s, z, 1.7 * s, 2.6 * s, c, 7);
    sb.cone(x, y + 4.2 * s, z, 1.1 * s, 2.2 * s, c, 7);
  } else if (kind === 'palm') {
    let px = x, pz = z, py = y;
    const lean = rand() * Math.PI * 2;
    for (let i = 0; i < 6; i++) {
      sb.cyl(px, py, pz, 0.28 - i * 0.02, 1.1, i % 2 ? '#9c7748' : '#b08a58', 7);
      py += 1.05; px += Math.cos(lean) * 0.18; pz += Math.sin(lean) * 0.18;
    }
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      sb.add(SHAPES.box(), { x: px + Math.cos(a) * 1.3, y: py - 0.2, z: pz + Math.sin(a) * 1.3, sx: 0.7, sy: 0.08, sz: 3, rx: 0.35, ry: -a + Math.PI / 2, color: i % 2 ? '#3f9b45' : '#57b04f' });
    }
    sb.sphere(px, py - 0.1, pz, 0.35, '#6b4a2a', 6);
  } else {
    const h = (1.8 + rand() * 0.8) * s;
    sb.cyl(x, y, z, 0.32 * s, h + 0.5, PALETTE.trunk, 7);
    const c1 = rand() > 0.5 ? PALETTE.leaf : PALETTE.leafAlt;
    sb.blob(x, y + h + 1.1 * s, z, 1.9 * s, c1, 0.9);
    sb.blob(x + 0.9 * s, y + h + 0.6 * s, z + 0.4 * s, 1.2 * s, c1, 0.9);
    sb.blob(x - 0.7 * s, y + h + 0.8 * s, z - 0.6 * s, 1.3 * s, c1, 0.9);
    if (rand() > 0.7) for (let i = 0; i < 4; i++) sb.sphere(x + (rand() - 0.5) * 3 * s, y + h + 0.5 + rand() * 1.6, z + (rand() - 0.5) * 3 * s, 0.16, '#e63946', 6);
  }
  col.addCyl(x, z, 0.45 * s, y, 6 * s);
}

function bush(sb, x, z, s = 1, color = '#4c9a3a') {
  sb.blob(x, groundHeight(x, z) + 0.3 * s, z, 0.8 * s, color, 0.75);
}

function flowers(sb, x, z, n = 6) {
  const cols = ['#ff5a5f', '#ffd23f', '#ffffff', '#c77dff', '#ff9f1c'];
  for (let i = 0; i < n; i++) {
    const fx = x + (rand() - 0.5) * 2.4, fz = z + (rand() - 0.5) * 2.4;
    sb.cyl(fx, 0, fz, 0.03, 0.4, '#3f8f3a', 4);
    sb.sphere(fx, 0.45, fz, 0.13, cols[i % cols.length], 5);
  }
}

function lamp(sb, col, x, z, ry = 0) {
  sb.cyl(x, 0, z, 0.12, 4.2, '#30343f', 6);
  sb.cyl(x, 0, z, 0.25, 0.4, '#30343f', 6);
  const dx = Math.cos(ry) * 0.6, dz = Math.sin(ry) * 0.6;
  sb.box(x + dx * 0.5, 4.1, z + dz * 0.5, 0.12, 0.12, 0.12, '#30343f');
  sb.box(x + dx, 3.85, z + dz, 0.55, 0.25, 0.55, '#fff3b0', 0, 'glow');
  sb.box(x + dx, 4.08, z + dz, 0.7, 0.12, 0.7, '#30343f');
  col.addCyl(x, z, 0.2, 0, 4.2);
}

function bench(sb, col, x, z, ry = 0) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const P = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  for (const lx of [-0.8, 0.8]) { const [px, pz] = P(lx, 0); sb.box(px, 0, pz, 0.12, 0.45, 0.5, '#30343f', ry); }
  let [px, pz] = P(0, 0); sb.box(px, 0.45, pz, 2, 0.1, 0.55, PALETTE.wood, ry);
  [px, pz] = P(0, -0.25); sb.box(px, 0.55, pz, 2, 0.5, 0.08, PALETTE.wood, ry);
  col.addBoxC(x, z, Math.abs(c) * 2 + Math.abs(s) * 0.6, Math.abs(s) * 2 + Math.abs(c) * 0.6, 0, 0.6);
}

function fence(sb, col, x1, z1, x2, z2, color = '#f4f1ea', h = 1.1, collide = true) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  const n = Math.max(1, Math.round(len / 2));
  const ang = Math.atan2(z2 - z1, x2 - x1);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    sb.box(x1 + (x2 - x1) * t, 0, z1 + (z2 - z1) * t, 0.15, h, 0.15, color);
  }
  const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
  sb.add(SHAPES.box(), { x: mx, y: h * 0.45, z: mz, sx: len, sy: 0.1, sz: 0.08, ry: -ang, color });
  sb.add(SHAPES.box(), { x: mx, y: h * 0.8, z: mz, sx: len, sy: 0.1, sz: 0.08, ry: -ang, color });
  if (collide) col.addBox(Math.min(x1, x2) - 0.15, 0, Math.min(z1, z2) - 0.15, Math.max(x1, x2) + 0.15, h, Math.max(z1, z2) + 0.15, { noCamera: true });
}

function stall(sb, col, x, z, color, ry = 0) {
  sb.box(x, 0, z, 3, 1, 1.6, PALETTE.wood, ry);
  for (const [lx, lz] of [[-1.4, -0.7], [1.4, -0.7], [-1.4, 0.7], [1.4, 0.7]]) {
    const c = Math.cos(ry), s = Math.sin(ry);
    sb.box(x + lx * c + lz * s, 0, z - lx * s + lz * c, 0.1, 2.6, 0.1, '#ddd', ry);
  }
  for (let i = 0; i < 5; i++) {
    const c = Math.cos(ry), s = Math.sin(ry);
    const lx = -1.4 + i * 0.7;
    sb.add(SHAPES.box(), { x: x + lx * c, y: 2.6, z: z - lx * s, sx: 0.7, sy: 0.12, sz: 2, rx: 0.15, ry, color: i % 2 ? color : '#ffffff' });
  }
  // marchandises
  for (let i = 0; i < 5; i++) sb.sphere(x + (rand() - 0.5) * 2.2, 1.15, z + (rand() - 0.5) * 0.8, 0.22, ['#ff5a5f', '#ffd23f', '#7ac74f', '#ff9f1c'][i % 4], 6);
  col.addBoxC(x, z, Math.abs(Math.cos(ry)) * 3 + Math.abs(Math.sin(ry)) * 1.6, Math.abs(Math.sin(ry)) * 3 + Math.abs(Math.cos(ry)) * 1.6, 0, 1.1);
}

export function buildProps(sb, col, scene) {
  // ---------- Place (les routes, marquages et passages piétons sont générés par roads.js)
  // trottoirs autour du boulevard (côté extérieur)
  const sw = PALETTE.sidewalk;
  sb.box(0, 0, -34.5, 70, 0.12, 5, sw, 0, 'ground'); sb.box(0, 0, 34.5, 70, 0.12, 5, sw, 0, 'ground');
  sb.box(-34.5, 0, 0, 5, 0.12, 60, sw, 0, 'ground'); sb.box(34.5, 0, 0, 5, 0.12, 60, sw, 0, 'ground');
  // place pavée en damier
  for (let i = -6; i < 6; i++) for (let j = -6; j < 6; j++) {
    sb.quad(i * 4 + 2, 0.04, j * 4 + 2, 4, 4, (i + j) % 2 ? PALETTE.plaza : PALETTE.plazaAlt, 0, 'ground');
  }

  // ---------- Fontaine
  const F = POI.fountain;
  sb.cyl(F.x, 0, F.z, F.r, 0.8, '#d6d0c4', 20);
  sb.cyl(F.x, 0.1, F.z, F.r - 0.4, 0.75, '#3fa7d6', 20);
  sb.cyl(F.x, 0, F.z, 0.7, 2.6, '#d6d0c4', 10);
  sb.cyl(F.x, 2.4, F.z, 1.6, 0.35, '#d6d0c4', 14);
  sb.sphere(F.x, 3.2, F.z, 0.55, '#ffd23f', 10); // une boule dorée... ou un œuf ? Personne ne sait.
  col.addCyl(F.x, F.z, F.r, 0, 0.8);
  col.addCyl(F.x, F.z, 0.8, 0, 3);

  // ---------- Place : bancs, lampadaires, jardinières, étals, arbre
  for (const [x, z, r] of [[-10, 18, 0], [10, 18, 0], [-18, -4, Math.PI / 2], [18, -4, -Math.PI / 2], [-18, 8, Math.PI / 2], [18, 8, -Math.PI / 2]]) bench(sb, col, x, z, r);
  for (const [x, z] of [[-21, -21], [21, -21], [-21, 21], [21, 21], [-21, 0], [21, 0]]) lamp(sb, col, x, z);
  for (const [x, z] of [[-6, 6], [6, -6], [-6, -6], [6, 6]]) { sb.box(x, 0, z, 2.6, 0.5, 2.6, '#b9a07a'); flowers(sb, x, z, 7); col.addBoxC(x, z, 2.6, 2.6, 0, 0.5); }
  stall(sb, col, 17, 4, '#ff5a5f', -Math.PI / 2);
  stall(sb, col, -18, -12, '#2ec4b6', Math.PI / 2);
  tree(sb, col, CAT_TREES[2].x, CAT_TREES[2].z, 'round', 1.2);
  // lampadaires des trottoirs (jamais devant une porte)
  const nearDoor = (x, z) => BUILDINGS.some((b) => Math.hypot(b.door.x - x, b.door.z - z) < 4);
  const lampIf = (x, z, ry) => { if (!nearDoor(x, z)) lamp(sb, col, x, z, ry); };
  for (let t = -30; t <= 30; t += 12) {
    lampIf(t, -33.2, Math.PI / 2); lampIf(t + 6, 33.2, -Math.PI / 2);
    lampIf(-33.2, t + 6, 0); lampIf(33.2, t, Math.PI);
  }

  // ---------- Scène DJ
  const S = POI.djStage;
  sb.box(S.x, 0, S.z - 1, 16, 1.2, 7, '#2b2d42');
  sb.box(S.x, 1.2, S.z - 4, 16, 6, 0.4, '#1d1e2c');
  for (const sx of [-8, 8]) { sb.box(S.x + sx, 0, S.z - 1, 0.4, 8, 0.4, '#8d99ae'); sb.box(S.x + sx * 0.82, 1.2, S.z + 1, 1.8, 2.8, 1.4, '#14141c'); sb.cyl(S.x + sx * 0.82, 2.0, S.z + 1.75, 0.55, 0.1, '#444', 12); }
  sb.box(S.x, 8, S.z - 1, 16.4, 0.4, 0.4, '#8d99ae');
  for (let i = -3; i <= 3; i++) sb.box(S.x + i * 2.2, 7.4, S.z - 0.6, 0.5, 0.5, 0.5, ['#ff3fa4', '#29e6ff', '#ffe14d'][(i + 3) % 3], 0, 'glow');
  sb.box(S.x, 1.2, S.z - 0.5, 3.2, 1.1, 1.2, '#30343f'); // platines
  col.addBoxC(S.x, S.z - 1, 16, 7, 0, 1.2);
  col.addBoxC(S.x, S.z - 4, 16, 0.5, 0, 8);
  const stageSign = makeSign('SCÈNE DE LA PLACE', 9, 1.4, { bg: '#14102b', fg: '#ffe14d', border: '#ff3fa4' });
  stageSign.position.set(S.x, 6, S.z - 3.75);
  scene.add(stageSign);
  // tableau des événements
  const E = POI.eventBoard;
  sb.box(E.x - 1.3, 0, E.z, 0.15, 2.6, 0.15, PALETTE.woodDark); sb.box(E.x + 1.3, 0, E.z, 0.15, 2.6, 0.15, PALETTE.woodDark);
  sb.box(E.x, 1.1, E.z, 2.8, 1.6, 0.15, '#7a5230');
  for (let i = 0; i < 4; i++) sb.box(E.x - 0.9 + i * 0.6, 1.4 + (i % 2) * 0.4, E.z + 0.09, 0.45, 0.55, 0.03, ['#fff3b0', '#ffd6e0', '#cdf0ea', '#ffffff'][i]);
  col.addBoxC(E.x, E.z, 2.9, 0.4, 0, 2.6);
  const boardSign = makeSign('ÉVÉNEMENTS', 2.8, 0.6, { bg: '#ff5a5f', fg: '#fff', border: null });
  boardSign.position.set(E.x, 2.95, E.z + 0.1);
  scene.add(boardSign);

  // ---------- Camion à burgers (métier cuisinier)
  const T = POI.foodTruck;
  sb.box(T.x, 0.6, T.z, 4.2, 3, 7, '#ffb547');
  sb.box(T.x, 3.6, T.z, 4.4, 0.25, 7.2, '#d62828');
  sb.box(T.x + 2.12, 1.8, T.z, 0.1, 1.4, 4.2, '#cfe8ff', 0, 'windows');
  sb.box(T.x + 2.5, 1.6, T.z, 0.9, 0.15, 4.4, '#e8e8e8'); // comptoir
  for (const [wx, wz] of [[-1.8, -2.4], [1.8, -2.4], [-1.8, 2.4], [1.8, 2.4]]) sb.add(SHAPES.cyl(12), { x: T.x + wx, y: 0.55, z: T.z + wz, sx: 1.1, sy: 0.4, sz: 1.1, rz: Math.PI / 2, color: '#222' });
  // burger géant sur le toit
  sb.sphere(T.x, 4.3, T.z, 1.3, '#e9a23b', 12, undefined, 0.45);
  sb.cyl(T.x, 4.35, T.z, 1.25, 0.35, '#5b3a1e', 14);
  sb.cyl(T.x, 4.65, T.z, 1.35, 0.12, '#7ac74f', 14);
  sb.cyl(T.x, 4.75, T.z, 1.3, 0.1, '#ffd23f', 14);
  sb.sphere(T.x, 5.05, T.z, 1.3, '#f4b860', 12, undefined, 0.55);
  col.addBoxC(T.x, T.z, 4.4, 7.2, 0, 4);
  const truckSign = makeSign('BURGER ABSURDE', 4.6, 0.9, { bg: '#d62828', fg: '#fff3b0', border: '#ffd23f' });
  truckSign.position.set(T.x + 2.23, 3.0, T.z);
  truckSign.rotation.y = Math.PI / 2;
  scene.add(truckSign);

  // ---------- Parc de loisirs
  const G = POI.parkGate;
  for (const sx of [-5.5, 5.5]) { sb.box(G.x + sx, 0, G.z, 1.2, 6, 1.2, '#ff5a5f'); col.addBoxC(G.x + sx, G.z, 1.2, 1.2, 0, 6); }
  sb.box(G.x, 6, G.z, 12.4, 1.4, 1.2, '#5b3fa6');
  const parkSign = makeSign('PARC DE LOISIRS', 10, 1.2, { bg: '#5b3fa6', fg: '#ffe14d', border: '#ffffff' });
  parkSign.position.set(G.x, 6.7, G.z + 0.62);
  scene.add(parkSign);
  const parkSignBack = parkSign.clone(); parkSignBack.position.z = G.z - 0.62; parkSignBack.rotation.y = Math.PI; scene.add(parkSignBack);
  // clôture du parc (avec ouverture à l'entrée)
  fence(sb, col, -58, -63, -7, -63, '#ffffff', 1.2);
  fence(sb, col, 7, -63, 58, -63, '#ffffff', 1.2);
  // étang + île
  sb.cyl(POND.x, -0.1, POND.z, 1.6, 0.3, PALETTE.sand, 10);
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; sb.blob(POND.x + Math.cos(a) * (POND.r + 0.6), 0, POND.z + Math.sin(a) * (POND.r + 0.6), 0.6 + rand() * 0.4, PALETTE.rock, 0.6); }
  const pondSign = makeSign('Baignade déconseillée. Le crocodile, lui, la recommande.', 4.2, 1.1, { bg: '#fff3b0', fg: '#3a2a1e', border: '#7a5230', size: 22 });
  pondSign.position.set(POND.x + 6, 1.6, POND.z + POND.r + 2.5);
  scene.add(pondSign);
  sb.box(POND.x + 6, 0, POND.z + POND.r + 2.45, 0.15, 1.1, 0.1, PALETTE.woodDark);
  // grande roue (support statique ; la roue elle-même est animée dans world.js)
  for (const sx of [-1.4, 1.4]) {
    sb.add(SHAPES.box(), { x: -50 + sx, y: 0, z: -110 - 1.8, sx: 0.4, sy: 12.5, sz: 0.4, rx: 0.15, color: '#8d99ae' });
    sb.add(SHAPES.box(), { x: -50 + sx, y: 0, z: -110 + 1.8, sx: 0.4, sy: 12.5, sz: 0.4, rx: -0.15, color: '#8d99ae' });
  }
  col.addBoxC(-50, -110, 4, 5, 0, 12);
  // arbres et bancs du parc
  for (let i = 0; i < 60; i++) {
    const x = -55 + rand() * 110, z = -124 + rand() * 56;
    if (free(x, z, 1.5)) tree(sb, col, x, z, rand() > 0.8 ? 'pine' : 'round', 0.9 + rand() * 0.4);
  }
  tree(sb, col, CAT_TREES[0].x, CAT_TREES[0].z, 'round', 1.3);
  tree(sb, col, CAT_TREES[1].x, CAT_TREES[1].z, 'round', 1.3);
  for (const [x, z, r] of [[-8, -80, Math.PI / 2], [8, -76, -Math.PI / 2], [-20, -120, 0], [12, -122, 0]]) bench(sb, col, x, z, r);

  // ---------- Forêt
  for (let i = 0; i < 140; i++) {
    const x = -126 + rand() * 62, z = -126 + rand() * 62;
    if (free(x, z, 1) && Math.hypot(x + 112, z + 112) > 6) tree(sb, col, x, z, rand() > 0.35 ? 'pine' : 'round', 0.9 + rand() * 0.7);
  }
  for (let i = 0; i < 30; i++) { const x = -126 + rand() * 62, z = -126 + rand() * 62; if (free(x, z)) sb.blob(x, 0, z, 0.5 + rand() * 0.8, PALETTE.rock, 0.6); }

  // ---------- Ferme : champs, enclos, foin, épouvantail, tracteur
  for (let x = -123; x < -96; x += 2.2) for (let z = 16; z < 56; z += 1.6) {
    const crop = x < -110 ? 'corn' : 'lettuce';
    if (crop === 'corn') { sb.cyl(x, 0, z, 0.08, 1.8, '#6a9f3a', 4); sb.cone(x, 1.2, z, 0.18, 0.6, '#f2c94c', 5); }
    else sb.blob(x, 0, z, 0.35, '#7ac74f', 0.6);
  }
  fence(sb, col, -90, 8, -68, 8, PALETTE.wood); fence(sb, col, -90, 36, -68, 36, PALETTE.wood);
  fence(sb, col, -90, 8, -90, 36, PALETTE.wood); fence(sb, col, -68, 8, -68, 19, PALETTE.wood); fence(sb, col, -68, 25, -68, 36, PALETTE.wood);
  fence(sb, col, -90, 39, -72, 39, PALETTE.wood); fence(sb, col, -90, 56, -72, 56, PALETTE.wood);
  fence(sb, col, -90, 39, -90, 56, PALETTE.wood); fence(sb, col, -72, 39, -72, 45, PALETTE.wood); fence(sb, col, -72, 50, -72, 56, PALETTE.wood);
  fence(sb, col, -80, -32, -66, -32, PALETTE.wood); fence(sb, col, -80, -12, -66, -12, PALETTE.wood); fence(sb, col, -80, -32, -80, -12, PALETTE.wood);
  fence(sb, col, -66, -32, -66, -25, PALETTE.wood); fence(sb, col, -66, -19, -66, -12, PALETTE.wood);
  // poulailler
  sb.box(-76, 0, -28, 4, 2.2, 3, '#e9c46a'); sb.gable(-76, 2.2, -28, 4.6, 1.3, 3.6, '#b5562d');
  col.addBoxC(-76, -28, 4, 3, 0, 3.5);
  // abreuvoir, bottes de foin
  sb.box(-80, 0, 22, 4, 0.7, 1.2, '#7a5230'); sb.box(-80, 0.5, 22, 3.6, 0.15, 0.9, '#3fa7d6');
  col.addBoxC(-80, 22, 4, 1.2, 0, 0.7);
  for (const [x, z] of [[-100, -12], [-102, -12], [-101, -12.1], [-86, -40], [-60, 10]]) { sb.add(SHAPES.cyl(12), { x, y: 0.7, z, sx: 1.4, sy: 1.6, sz: 1.4, rz: Math.PI / 2, color: '#e9c46a' }); col.addCyl(x, z, 0.8, 0, 1.4); }
  // épouvantail (il a l'air de juger)
  sb.cyl(-110, 0, 35, 0.08, 2.4, PALETTE.woodDark, 5); sb.box(-110, 1.7, 35, 2, 0.12, 0.12, PALETTE.woodDark);
  sb.box(-110, 1.2, 35, 0.8, 0.9, 0.4, '#d62828'); sb.sphere(-110, 2.45, 35, 0.35, '#f2d59b', 8); sb.cone(-110, 2.7, 35, 0.6, 0.6, '#c9a227', 8);
  // tracteur
  sb.box(-104, 0.8, -10, 3, 1.2, 1.8, '#2a9d3a'); sb.box(-103, 2, -10, 1.6, 1.4, 1.6, '#2a9d3a'); sb.box(-103, 2.2, -10, 1.4, 1, 1.65, '#cfe8ff', 0, 'windows');
  for (const [wx, wz, r] of [[-105, -11, 0.9], [-105, -9, 0.9], [-102.6, -11, 0.6], [-102.6, -9, 0.6]]) sb.add(SHAPES.cyl(12), { x: wx, y: r, z: wz, sx: r * 2, sy: 0.4, sz: r * 2, rx: Math.PI / 2, color: '#222' });
  col.addBoxC(-104, -10, 3.4, 2.4, 0, 3.4);
  for (let i = 0; i < 12; i++) { const x = -126 + rand() * 60, z = -58 + rand() * 120; if (free(x, z, 2)) tree(sb, col, x, z, 'round', 1); }

  // ---------- Quartier des Mouettes : arbres d'alignement, buissons
  for (let x = 60; x < 126; x += 9) { if (free(x, -6.5, 0) || true) { bush(sb, x + 3, -21); bush(sb, x - 2, 22); } }
  for (let i = 0; i < 26; i++) { const x = 58 + rand() * 68, z = -58 + rand() * 116; if (free(x, z, 1)) tree(sb, col, x, z, 'round', 0.8 + rand() * 0.4); }
  tree(sb, col, CAT_TREES[4].x, CAT_TREES[4].z, 'round', 1.25);

  // ---------- Zone des ateliers : conteneurs, caisses, barils
  const cont = ['#d62828', '#2a6f97', '#f77f00', '#2a9d8f'];
  for (let i = 0; i < 6; i++) { const x = 70 + (i % 3) * 8, z = -76 - Math.floor(i / 3) * 4; sb.box(x, 0, z, 6, 2.6, 2.4, cont[i % 4]); col.addBoxC(x, z, 6, 2.4, 0, 2.6); }
  sb.box(78, 2.6, -76, 6, 2.6, 2.4, cont[1]); col.addBoxC(78, -76, 6, 2.4, 0, 5.2);
  for (let i = 0; i < 10; i++) { const x = 100 + rand() * 20, z = -124 + rand() * 20; if (free(x, z)) { sb.box(x, 0, z, 1.2, 1.2, 1.2, '#b08a58', rand() * 3); col.addBoxC(x, z, 1.2, 1.2, 0, 1.2); } }
  for (let i = 0; i < 8; i++) { const x = 64 + rand() * 30, z = -124 + rand() * 16; if (free(x, z)) { sb.cyl(x, 0, z, 0.45, 1.2, ['#2a6f97', '#d62828', '#3a3a3a'][i % 3], 10); col.addCyl(x, z, 0.5, 0, 1.2); } }

  // ---------- Plage : palmiers, parasols, serviettes, filet, poste de secours, cabines
  for (let i = 0; i < 26; i++) { const x = -124 + rand() * 248, z = 66 + rand() * 8; if (free(x, z, 1) && Math.abs(x) > 6) tree(sb, col, x, z, 'palm', 1); }
  const umb = ['#ff5a5f', '#ffd23f', '#2ec4b6', '#c77dff', '#ff9f1c'];
  for (let i = 0; i < 18; i++) {
    const x = -110 + rand() * 150, z = 76 + rand() * 10;
    if (!free(x, z, 1) || Math.abs(x) < 8) continue;
    sb.cyl(x, 0, z, 0.06, 2.4, '#eeeeee', 5);
    sb.cone(x, 2.2, z, 1.6, 0.7, umb[i % umb.length], 8);
    sb.box(x + 1.2, 0, z + 0.4, 1, 0.05, 2, umb[(i + 2) % umb.length], rand());
  }
  // filet de volley
  for (const sz of [-4, 4]) sb.cyl(-50, 0, 78 + sz, 0.08, 2.6, '#eeeeee', 5);
  sb.box(-50, 1.6, 78, 0.05, 1, 8, '#f4f1ea');
  // poste de secours
  for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) sb.box(-20 + lx, 0, 80 + lz, 0.2, 3, 0.2, '#f4f1ea');
  sb.box(-20, 3, 80, 2.8, 0.2, 2.8, '#f4f1ea'); sb.box(-20, 3.2, 80, 2.4, 1.8, 2.4, '#ff5a5f'); sb.gable(-20, 5, 80, 3, 1, 3, '#f4f1ea');
  col.addBoxC(-20, 80, 2.8, 2.8, 0, 5);
  // cabine du gardien (adresse de livraison)
  sb.box(-20, 0, 70.5, 3, 2.6, 2.4, '#7fb7e6'); sb.gable(-20, 2.6, 70.5, 3.4, 1, 2.8, '#ffffff');
  col.addBoxC(-20, 70.5, 3, 2.4, 0, 3.6);
  // cabines de plage
  for (let i = 0; i < 5; i++) { const x = -90 + i * 4.2; sb.box(x, 0, 68, 3, 2.6, 2.4, i % 2 ? '#ffffff' : ['#2ec4b6', '#ff5a5f', '#ffd23f'][i % 3]); sb.gable(x, 2.6, 68, 3.3, 0.9, 2.7, '#3d5a80'); col.addBoxC(x, 68, 3, 2.4, 0, 3.5); }
  // château de sable
  sb.cyl(10, 0, 86, 1.2, 0.8, '#e6c27a', 8); sb.cyl(10, 0.8, 86, 0.8, 0.6, '#e6c27a', 8); sb.cone(10, 1.4, 86, 0.6, 0.6, '#e6c27a', 8);

  // ---------- Port : ponton praticable, bateaux, bornes
  const P = POI.pier;
  const deckY = 0.55;
  for (let z = P.z1; z < P.z2; z += 1) sb.box(P.x, deckY - 0.18, z + 0.5, P.w, 0.18, 0.92, z % 2 ? PALETTE.wood : '#b07d47');
  for (let z = P.z1; z <= P.z2; z += 4) for (const sx of [-P.w / 2, P.w / 2]) sb.cyl(P.x + sx, -4, z, 0.22, 4.9, PALETTE.woodDark, 6);
  col.addBox(P.x - P.w / 2, -5, P.z1, P.x + P.w / 2, deckY, P.z2, { noCamera: true });
  // garde-corps (sauf l'entrée)
  fence(sb, col, P.x - P.w / 2, P.z1 + 6, P.x - P.w / 2, P.z2, '#f4f1ea', 1);
  fence(sb, col, P.x + P.w / 2, P.z1 + 6, P.x + P.w / 2, P.z2 - 6, '#f4f1ea', 1);
  for (let i = 0; i < 3; i++) {
    const bx = P.x + 8, bz = 96 + i * 9;
    sb.box(bx, -0.4, bz, 2.6, 1, 6, ['#ffffff', '#ffd23f', '#2ec4b6'][i]);
    sb.box(bx, 0.6, bz - 0.5, 1.8, 1.1, 2.4, '#f4f1ea');
    sb.box(bx, 0.6, bz + 2.5, 2.7, 0.15, 1, '#d62828');
    sb.cyl(bx, 0.6, bz + 0.7, 0.07, 4, '#dddddd', 5);
    col.addBoxC(bx, bz, 2.6, 6, -2, 2.2);
  }
  // petit bateau au bout du ponton (canard caché)
  sb.box(P.x + 4.2, -0.3, P.z2 - 1, 2, 0.8, 4, '#c0392b'); col.addBoxC(P.x + 4.2, P.z2 - 1, 2, 4, -2, 0.5);
  // phare
  sb.blob(112, -1, 104, 6, '#8a8a8a', 0.5);
  sb.cyl(112, 0.5, 104, 2.2, 10, '#ffffff', 12); sb.cyl(112, 3.5, 104, 2.25, 1.5, '#e63946', 12); sb.cyl(112, 7.5, 104, 2.25, 1.5, '#e63946', 12);
  sb.cyl(112, 10.5, 104, 1.6, 1.5, '#fff3b0', 10, 'glow'); sb.cone(112, 12, 104, 2, 1.6, '#e63946', 10);
  col.addCyl(112, 104, 2.4, -1, 13);

  // ---------- Trampoline (mène au toit de l'arcade)
  const TR = POI.trampoline;
  sb.cyl(TR.x, 0, TR.z, 1.7, 0.55, '#2b2d42', 16);
  sb.cyl(TR.x, 0.5, TR.z, 1.5, 0.08, '#ff3fa4', 16);

  // ---------- Arbres et buissons en bordure du centre-ville + plage
  for (let i = 0; i < 40; i++) {
    const x = -62 + rand() * 124, z = -62 + rand() * 124;
    if (free(x, z, 1.5) && (Math.abs(x) > 55 || Math.abs(z) > 55)) tree(sb, col, x, z, 'round', 0.9 + rand() * 0.3);
  }
  for (let i = 0; i < 40; i++) { const x = -126 + rand() * 252, z = -126 + rand() * 190; if (free(x, z, 1)) bush(sb, x, z, 0.8 + rand() * 0.5, rand() > 0.5 ? '#4c9a3a' : '#5fae45'); }
  for (let i = 0; i < 25; i++) { const x = -60 + rand() * 120, z = -60 + rand() * 124; if (free(x, z, 0.5)) flowers(sb, x, z, 5); }

  // (les collines et les limites du monde sont dans city-props.js)
}
