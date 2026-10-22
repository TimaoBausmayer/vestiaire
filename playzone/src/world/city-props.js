import * as THREE from 'three';
import { PITCH_RECT } from '../../shared/sports.js';
import { SKI } from '../../shared/courses.js';
import { LAKE } from '../../shared/world-layout.js';
import { BUILDINGS, ROADS, PARKINGS, GAS_STATIONS, CITY_POI, WORLD_BOUNDS, STREETS, PORT_QUAY } from '../../shared/world-layout.js';
import { BUILDING_BY_ID } from '../../shared/world-layout.js';
import { mulberry32 } from '../../shared/rng.js';
import { PALETTE } from '../core/materials.js';
import { SHAPES } from '../core/static-builder.js';
import { tree } from './props.js';

// DÉCOR DES NOUVEAUX QUARTIERS : arbres d'alignement, parkings, stations-service, port, campagne
// (champs, moulin, clôtures), zone industrielle, prison, parc des loisirs (arène, fête foraine),
// circuit, plage sauvage, collines au nord et limites du monde.

const rand = mulberry32(4242);
const R = (a, b) => a + rand() * (b - a);

// zones déjà occupées (routes + bâtiments + parkings...) pour placer le décor sans chevauchement
const busy = [];
for (const r of ROADS) busy.push([r[0] - 3, r[1] - 3, r[2] + 3, r[3] + 3]);
for (const b of BUILDINGS) busy.push([b.x - b.w / 2 - 2.5, b.z - b.d / 2 - 2.5, b.x + b.w / 2 + 2.5, b.z + b.d / 2 + 4.5]);
for (const p of PARKINGS) busy.push([p.x1 - 1, p.z1 - 1, p.x2 + 1, p.z2 + 1]);
busy.push(PITCH_RECT, [SKI.x1 - 30, SKI.top - 22, SKI.x2 + 30, SKI.hut.z + 2], [600, -912, 830, -726]);
for (const g of GAS_STATIONS) busy.push([g.x - g.w / 2 - 3, g.z - g.d / 2 - 3, g.x + g.w / 2 + 3, g.z + g.d / 2 + 3]);
for (const b of BUILDINGS) { const l = b.lot || b.yard || b.wall; if (l) busy.push([l.x1 - 1, l.z1 - 1, l.x2 + 1, l.z2 + 1]); }
export function block(x1, z1, x2, z2) { busy.push([Math.min(x1, x2), Math.min(z1, z2), Math.max(x1, x2), Math.max(z1, z2)]); }
export function isFree(x, z, pad = 0) {
  if (x < WORLD_BOUNDS.minX + 2 || x > WORLD_BOUNDS.maxX - 2 || z < WORLD_BOUNDS.minZ + 2 || z > WORLD_BOUNDS.maxZ) return false;
  for (const [x1, z1, x2, z2] of busy) if (x > x1 - pad && x < x2 + pad && z > z1 - pad && z < z2 + pad) return false;
  return true;
}
const inOldCenter = (x, z) => x > -136 && x < 136 && z > -136 && z < 56;

// Places de stationnement (utilisées par les voitures garées) : { x, z, yaw, lot }
export const PARKING_SPOTS = [];

export function buildCityProps(sb, col, scene, world) {
  // ---------- parkings : enrobé, places peintes, bordures
  for (const p of PARKINGS) {
    const w = p.x2 - p.x1, d = p.z2 - p.z1;
    sb.quad((p.x1 + p.x2) / 2, 0.035, (p.z1 + p.z2) / 2, w, d, '#55595f', 0, 'ground');
    if (p.rows === 'z') {
      // rangées de places perpendiculaires à x (voitures orientées nord/sud)
      for (let x = p.x1 + 1.5; x + 2.6 <= p.x2; x += 2.9) {
        for (const [z0, yaw] of [[p.z1 + 2.8, 0], [p.z2 - 2.8, Math.PI]]) {
          if (d < 12 && yaw) continue;
          sb.quad(x, 0.05, z0, 0.12, 5, '#f5f1e3', 0, 'ground');
          PARKING_SPOTS.push({ x: x + 1.45, z: z0, yaw, lot: p.id });
        }
      }
    } else {
      for (let z = p.z1 + 1.5; z + 2.6 <= p.z2; z += 2.9) {
        sb.quad(p.x1 + 2.8, 0.05, z, 5, 0.12, '#f5f1e3', 0, 'ground');
        PARKING_SPOTS.push({ x: p.x1 + 2.8, z: z + 1.45, yaw: Math.PI / 2, lot: p.id });
      }
      for (let x = p.x1 + 8; x + 2.6 <= p.x2; x += 2.9) {
        sb.quad(x, 0.05, (p.z1 + p.z2) / 2, 0.12, Math.min(5, d - 1), '#f5f1e3', 0, 'ground');
        PARKING_SPOTS.push({ x: x + 1.45, z: (p.z1 + p.z2) / 2, yaw: rand() < 0.5 ? 0 : Math.PI, lot: p.id });
      }
    }
    // panneau P
    const sx = p.x1 + 0.8, sz = p.z1 + 0.8;
    sb.cyl(sx, 0, sz, 0.06, 2.6, '#9aa0a8', 6);
    sb.box(sx, 2.4, sz, 0.8, 0.8, 0.08, '#1d4fd8');
    sb.box(sx, 2.6, sz + 0.05, 0.25, 0.42, 0.02, '#ffffff');
  }
  // ---------- stations-service : auvent, îlots de pompes
  for (const g of GAS_STATIONS) {
    sb.quad(g.x, 0.04, g.z, g.w + 4, g.d + 4, '#6b6f76', 0, 'ground');
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const x = g.x + dx * (g.w / 2 - 1), z = g.z + dz * (g.d / 2 - 1);
      sb.box(x, 0, z, 0.5, 5, 0.5, '#e9ecef');
      col.addBoxC(x, z, 0.5, 0.5, 0, 5);
    }
    sb.box(g.x, 5, g.z, g.w + 1, 0.7, g.d + 1, '#f4f1ea');
    sb.box(g.x, 5.05, g.z, g.w + 1.05, 0.25, g.d + 1.05, BUILDING_BY_ID[g.id].roofColor);
    sb.box(g.x, 4.9, g.z, g.w - 1, 0.1, g.d - 1, '#fff3c4', 0, 'glow');
    col.addBoxC(g.x, g.z, g.w + 1, g.d + 1, 5, 0.7);
    for (const ox of [-g.w / 4, g.w / 4]) {
      sb.box(g.x + ox, 0, g.z, 1.4, 0.25, g.d - 5, '#c9c3b6');
      for (const oz of [-(g.d - 7) / 2, (g.d - 7) / 2]) {
        sb.box(g.x + ox, 0.25, g.z + oz, 0.9, 1.7, 0.6, '#e63946');
        sb.box(g.x + ox, 1.3, g.z + oz, 0.7, 0.45, 0.62, '#1d1f24', 0, 'windows');
        sb.box(g.x + ox + 0.48, 0.9, g.z + oz, 0.08, 0.6, 0.12, '#2b2d33');
        col.addBoxC(g.x + ox, g.z + oz, 0.9, 0.6, 0, 1.95);
      }
    }
    // totem des prix
    const tx = g.x + g.w / 2 + 2.5, tz = g.z - g.d / 2 - 1;
    sb.box(tx, 0, tz, 0.5, 5.5, 1.6, '#2b2d42');
    sb.box(tx + 0.27, 3.6, tz, 0.04, 1.6, 1.3, '#fff3c4', 0, 'glow');
    col.addBoxC(tx, tz, 0.5, 1.6, 0, 5.5);
  }

  // ---------- arbres d'alignement (quartiers urbains) entre trottoir et façades
  for (const s of STREETS) {
    if (s.kind === 'country' || inOldCenter(s.axis === 'h' ? (s.x1 + s.x2) / 2 : s.x, s.axis === 'h' ? s.z : (s.z1 + s.z2) / 2)) continue;
    const horiz = s.axis === 'h';
    const [a, b] = horiz ? [s.x1, s.x2] : [s.z1, s.z2];
    for (const side of [-1, 1]) {
      const off = (horiz ? s.z : s.x) + side * (s.w / 2 + 4);
      for (let t = a + 9; t < b - 9; t += 13) {
        const x = horiz ? t : off, z = horiz ? off : t;
        if (BUILDINGS.some((bb) => Math.abs(x - bb.x) < bb.w / 2 + 3 && Math.abs(z - bb.z) < bb.d / 2 + 3)) continue;
        if (ROADS.some((r) => x > r[0] - 1 && x < r[2] + 1 && z > r[1] - 1 && z < r[3] + 1)) continue;
        tree(sb, col, x, z, 'round', R(0.8, 1.05));
      }
    }
  }

  // ---------- Port des Embruns : quai, bittes d'amarrage, grues, conteneurs, bateaux
  const qx1 = PORT_QUAY.x, qz = PORT_QUAY.z;
  sb.quad((qx1 + 300) / 2, 0.02, (64 + qz) / 2, 300 - qx1, qz - 64, '#a9a59c', 0, 'ground');
  sb.box((qx1 + 300) / 2, -4.6, qz - 0.4, 300 - qx1, 4.6, 0.8, '#7d7a72');
  sb.box((qx1 + 300) / 2, 0, qz - 0.6, 300 - qx1, 0.25, 0.5, '#f4d35e', 0, 'ground');
  col.addBox(qx1, -5, qz - 0.2, 300, 1.2, qz + 0.4, { noCamera: true });
  for (let x = qx1 + 6; x < 296; x += 10) { sb.cyl(x, 0, qz - 1.4, 0.3, 0.7, '#2b2d33', 10); sb.sphere(x, 0.7, qz - 1.4, 0.35, '#2b2d33', 8); col.addCyl(x, qz - 1.4, 0.35, 0, 1); }
  for (const cx of [205, 255]) crane(sb, col, cx, qz - 6);
  const cont = ['#d62828', '#2a6f97', '#f77f00', '#2a9d8f', '#6a4c93'];
  for (let i = 0; i < 14; i++) {
    const x = 196 + (i % 7) * 7, z = 92 + Math.floor(i / 7) * 3.2, lv = i % 3 === 0 ? 2 : 1;
    for (let k = 0; k < lv; k++) sb.box(x, k * 2.6, z, 6, 2.6, 2.5, cont[(i + k) % 5]);
    col.addBoxC(x, z, 6, 2.5, 0, 2.6 * lv);
  }
  for (const [bx, bz, len, color] of [[180, 116, 18, '#ffffff'], [235, 120, 26, '#1d3557'], [282, 114, 12, '#e63946']]) boat(sb, bx, bz, len, color);
  // ---------- lampadaires du quai
  for (let x = qx1 + 12; x < 296; x += 24) { sb.cyl(x, 0, 66, 0.1, 5, '#3a3f4b', 8); sb.box(x, 5, 66, 0.5, 0.2, 0.5, '#fff3c4', 0, 'glow'); col.addCyl(x, 66, 0.15, 0, 5, { noCamera: true }); }

  // ---------- Campagne des Navets : champs, clôtures, moulin, foin, vergers
  const fields = [[-283, -63, -228, -14, '#a47148', 'corn'], [-212, -132, -150, -78, '#8a6a3a', 'wheat'], [-283, -132, -228, -78, '#7a5a35', 'cabbage'], [-212, 10, -150, 50, '#9c6b3a', 'sunflower'], [-283, 8, -228, 50, '#6a8f3a', 'pasture']];
  for (const [x1, z1, x2, z2, color, crop] of fields) {
    block(x1, z1, x2, z2);
    if (crop === 'pasture') {
      fenceLine(sb, col, x1, z1, x2, z1); fenceLine(sb, col, x1, z2, x2, z2); fenceLine(sb, col, x1, z1, x1, z2); fenceLine(sb, col, x2, z1, x2, z1 + 16); fenceLine(sb, col, x2, z1 + 22, x2, z2);
      sb.box(x2 - 6, 0, z2 - 4, 4, 0.7, 1.2, '#7a5230'); sb.box(x2 - 6, 0.5, z2 - 4, 3.6, 0.15, 0.9, '#3fa7d6'); col.addBoxC(x2 - 6, z2 - 4, 4, 1.2, 0, 0.7);
      continue;
    }
    sb.quad((x1 + x2) / 2, 0.025, (z1 + z2) / 2, x2 - x1, z2 - z1, color, 0, 'ground');
    for (let x = x1 + 1; x < x2 - 0.5; x += 2) {
      sb.quad(x, 0.03, (z1 + z2) / 2, 0.5, z2 - z1 - 1, '#6b4a2a', 0, 'ground');
      for (let z = z1 + 1.2; z < z2 - 0.8; z += crop === 'sunflower' ? 2.2 : 1.8) {
        if (crop === 'corn') { sb.cyl(x + 1, 0, z, 0.07, 1.9, '#6a9f3a', 4); sb.cone(x + 1, 1.3, z, 0.17, 0.6, '#f2c94c', 5); }
        else if (crop === 'wheat') sb.cone(x + 1, 0, z, 0.35, 1.0, '#e9c46a', 5);
        else if (crop === 'cabbage') sb.blob(x + 1, 0, z, 0.35, '#7ac74f', 0.6);
        else { sb.cyl(x + 1, 0, z, 0.06, 1.7, '#5f8f2f', 4); sb.add(SHAPES.cyl(8), { x: x + 1, y: 1.75, z: z + 0.05, sx: 0.6, sy: 0.08, sz: 0.6, rx: 1.2, color: '#ffd23f' }); sb.add(SHAPES.cyl(8), { x: x + 1, y: 1.78, z: z + 0.09, sx: 0.28, sy: 0.08, sz: 0.28, rx: 1.2, color: '#6b4226' }); }
      }
    }
    fenceLine(sb, col, x1, z1, x2, z1, false); fenceLine(sb, col, x1, z2, x2, z2, false);
  }
  // moulin (les ailes tournent : objet animé)
  const M = CITY_POI.windmill;
  block(M.x - 6, M.z - 6, M.x + 6, M.z + 6);
  sb.cyl(M.x, 0, M.z, 3.4, 9, '#f4f1ea', 12); sb.cone(M.x, 9, M.z, 3.8, 3.5, '#7a4b2a', 12);
  sb.box(M.x, 0, M.z + 3.2, 1.5, 2.3, 0.3, '#5a3d2b');
  col.addCyl(M.x, M.z, 3.5, 0, 12);
  if (world) {
    const blades = new THREE.Mesh(bladesGeometry(), world.actorMaterial);
    blades.position.set(M.x, 9.5, M.z + 3.7);
    blades.castShadow = true;
    scene.add(blades);
    world.animated.push((dt, t) => { blades.rotation.z = t * 0.6; });
  }
  // bottes de foin et tracteur garé
  for (let i = 0; i < 10; i++) { const x = R(-284, -150), z = R(-135, 50); if (isFree(x, z, 2)) { sb.add(SHAPES.cyl(12), { x, y: 0.7, z, sx: 1.4, sy: 1.6, sz: 1.4, rz: Math.PI / 2, color: '#e9c46a' }); col.addCyl(x, z, 0.8, 0, 1.4); } }
  // verger / bosquets
  for (let i = 0; i < 90; i++) { const x = R(-298, -146), z = R(-134, 54); if (isFree(x, z, 1.5)) tree(sb, col, x, z, rand() > 0.7 ? 'pine' : 'round', R(0.9, 1.4)); }

  // ---------- Zone industrielle : cour de la casse (épaves), conteneurs, palettes, clôtures
  const casse = BUILDING_BY_ID.casse.yard;
  sb.quad((casse.x1 + casse.x2) / 2, 0.03, (casse.z1 + casse.z2) / 2, casse.x2 - casse.x1, casse.z2 - casse.z1, '#7d6e5d', 0, 'ground');
  fenceLine(sb, col, casse.x1, casse.z1, casse.x2, casse.z1, true, '#7d838b', 2.2);
  fenceLine(sb, col, casse.x1, casse.z2, casse.x2, casse.z2, true, '#7d838b', 2.2);
  fenceLine(sb, col, casse.x2, casse.z1, casse.x2, casse.z2, true, '#7d838b', 2.2);
  for (let i = 0; i < 12; i++) {
    const x = casse.x1 + 4 + (i % 4) * 7, z = casse.z1 + 5 + Math.floor(i / 4) * 10;
    for (let k = 0; k < (i % 3 === 0 ? 2 : 1); k++) {
      const c = ['#7f5539', '#6c757d', '#9c6644', '#495057'][(i + k) % 4];
      sb.box(x, k * 1.4, z, 4.2, 1.0, 1.9, c, k * 0.3); sb.box(x - 0.3, k * 1.4 + 1.0, z, 2.2, 0.5, 1.7, c, k * 0.3);
    }
    col.addBoxC(x, z, 4.2, 1.9, 0, i % 3 === 0 ? 2.9 : 1.5);
  }
  for (let i = 0; i < 16; i++) { const x = R(-285, -150), z = R(-330, -150); if (isFree(x, z, 1.5)) { if (rand() < 0.5) { sb.box(x, 0, z, 6, 2.6, 2.4, cont[i % 5], rand() < 0.5 ? 0 : Math.PI / 2); col.addBoxC(x, z, 6.2, 6.2, 0, 2.6); } else { for (let k = 0; k < 3; k++) sb.box(x, k * 0.15, z, 1.2, 0.12, 1.0, '#b08a58'); sb.box(x, 0.45, z, 1.0, 0.8, 0.9, '#d4a373'); col.addBoxC(x, z, 1.2, 1.0, 0, 1.3); } } }

  // ---------- Prison : mur d'enceinte, miradors, portail, cour
  const pw = BUILDING_BY_ID.prison.wall;
  const wallC = '#8d8d8d';
  const pwall = (x1, z1, x2, z2) => { const len = Math.hypot(x2 - x1, z2 - z1); sb.box((x1 + x2) / 2, 0, (z1 + z2) / 2, x1 === x2 ? 0.8 : len, 5.5, x1 === x2 ? len : 0.8, wallC); col.addBox(Math.min(x1, x2) - 0.4, 0, Math.min(z1, z2) - 0.4, Math.max(x1, x2) + 0.4, 5.5, Math.max(z1, z2) + 0.4); };
  pwall(pw.x1, pw.z1, pw.x2, pw.z1); pwall(pw.x1, pw.z1, pw.x1, pw.z2); pwall(pw.x2, pw.z1, pw.x2, pw.z2);
  pwall(pw.x1, pw.z2, pw.gateX - 4, pw.z2); pwall(pw.gateX + 4, pw.z2, pw.x2, pw.z2);
  sb.box(pw.gateX, 4.2, pw.z2, 8.8, 1.3, 1.2, '#5c5c5c');
  for (let i = -3; i <= 3; i++) sb.box(pw.gateX + i * 1.1, 0, pw.z2 - 1.5, 0.08, 4.2, 0.08, '#3a3a3a');
  for (const [x, z] of [[pw.x1, pw.z1], [pw.x2, pw.z1], [pw.x1, pw.z2], [pw.x2, pw.z2]]) {
    sb.box(x, 0, z, 2.6, 9, 2.6, '#7a7a7a'); sb.box(x, 9, z, 3.6, 2, 3.6, '#5c5c5c'); sb.box(x, 9.3, z, 3.65, 1.2, 3.65, '#9fc4e8', 0, 'windows'); sb.cone(x, 11, z, 2.8, 1.6, '#4a4e69', 4);
    col.addBoxC(x, z, 2.6, 2.6, 0, 11);
  }
  sb.quad((pw.x1 + pw.x2) / 2, 0.03, (pw.z1 + pw.z2) / 2 + 12, pw.x2 - pw.x1 - 2, 22, '#b5a48c', 0, 'ground');
  for (const sx of [-1, 1]) { const x = pw.gateX + sx * 14; sb.cyl(x, 0, -362, 0.1, 3, '#555', 6); sb.box(x, 3, -362, 1.2, 0.8, 0.1, '#ffffff'); col.addCyl(x, -362, 0.15, 0, 3); }

  // ---------- Parc des Loisirs Fous : arène gonflable, fête foraine, skatepark
  const A = CITY_POI.arena;
  block(A.x - A.r - 4, A.z - A.r - 4, A.x + A.r + 4, A.z + A.r + 4);
  sb.cyl(A.x, 0, A.z, A.r, 0.05, '#e9d8a6', 32, 'ground');
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    if (Math.abs(Math.sin(a) - 1) < 0.08) continue; // entrée au sud
    const x = A.x + Math.cos(a) * (A.r + 2), z = A.z + Math.sin(a) * (A.r + 2);
    sb.add(SHAPES.box(), { x, y: 0, z, sx: 4.8, sy: 3.2, sz: 3.5, ry: -a + Math.PI / 2, color: i % 2 ? '#ff5a5f' : '#ffd23f' });
    sb.add(SHAPES.box(), { x: x + Math.cos(a) * 1.6, y: 3.2, z: z + Math.sin(a) * 1.6, sx: 4.8, sy: 1.6, sz: 1.5, ry: -a + Math.PI / 2, color: i % 2 ? '#2ec4b6' : '#c77dff' });
    col.addCyl(x, z, 2.2, 0, 4.5);
  }
  // ring de sumo central (coussin gonflable)
  sb.cyl(A.x, 0, A.z, 7, 0.6, '#ff70a6', 28); sb.cyl(A.x, 0.6, A.z, 6.6, 0.05, '#ffe5ec', 28);
  // fête foraine : tentes rayées, stands
  const FF = CITY_POI.funfair;
  for (let i = 0; i < 6; i++) {
    const x = FF.x - 20 + (i % 3) * 18, z = FF.z - 10 + Math.floor(i / 3) * 22;
    stand(sb, col, x, z, ['#e63946', '#2a9d8f', '#ffb703', '#8338ec', '#fb8500', '#3a86ff'][i]);
  }
  block(FF.x - 30, FF.z - 18, FF.x + 30, FF.z + 22);
  // carrousel (tourne)
  if (world) {
    const cx = -60, cz = -400;
    block(cx - 8, cz - 8, cx + 8, cz + 8);
    sb.cyl(cx, 0, cz, 6.5, 0.5, '#f4f1ea', 20); col.addCyl(cx, cz, 6.6, 0, 0.5);
    const top = new THREE.Mesh(carouselGeometry(), world.actorMaterial);
    top.position.set(cx, 0.5, cz);
    scene.add(top);
    world.animated.push((dt, t) => { top.rotation.y = t * 0.5; });
  }
  // skatepark : rampes
  const SK = CITY_POI.skatepark;
  sb.quad(SK.x, 0.03, SK.z, 30, 18, '#b0b5bb', 0, 'ground');
  for (const [dx, ry] of [[-12, Math.PI / 2], [12, -Math.PI / 2]]) { sb.add(SHAPES.gable(), { x: SK.x + dx, y: 0, z: SK.z, sx: 3, sy: 2.2, sz: 8, ry, color: '#9aa0a8' }); col.addBoxC(SK.x + dx, SK.z, 1.6, 8, 0, 1.1); }
  sb.box(SK.x, 0, SK.z, 6, 0.6, 3, '#9aa0a8'); col.addBoxC(SK.x, SK.z, 6, 3, 0, 0.6);
  block(SK.x - 16, SK.z - 10, SK.x + 16, SK.z + 10);

  // ---------- Circuit Turbo-Mamie : piste, vibreurs, tribune, ligne d'arrivée
  const C = CITY_POI.circuit;
  block(C.x - C.rx - 8, C.z - C.rz - 8, C.x + C.rx + 8, C.z + C.rz + 8);
  const N = 72;
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
    const p0 = circuitPoint(C, a0), p1 = circuitPoint(C, a1);
    const len = Math.hypot(p1.x - p0.x, p1.z - p0.z), ang = Math.atan2(p1.x - p0.x, p1.z - p0.z);
    sb.add(SHAPES.plane(), { x: (p0.x + p1.x) / 2, y: 0.035, z: (p0.z + p1.z) / 2, sx: 10, sz: len + 0.4, ry: ang, color: '#4a4e5a', mat: 'ground' });
    for (const side of [-1, 1]) {
      const ox = Math.cos(ang) * side * 5.3, oz = -Math.sin(ang) * side * 5.3;
      sb.add(SHAPES.box(), { x: (p0.x + p1.x) / 2 + ox, y: 0, z: (p0.z + p1.z) / 2 + oz, sx: 0.7, sy: 0.08, sz: len, ry: ang, color: i % 2 ? '#e63946' : '#ffffff', mat: 'ground' });
      // pneus de protection à l'extérieur
      if (side === 1 && i % 2 === 0) { const ex = (p0.x + p1.x) / 2 + Math.cos(ang) * 7.4, ez = (p0.z + p1.z) / 2 - Math.sin(ang) * 7.4; sb.cyl(ex, 0, ez, 0.45, 0.9, '#1b1b1f', 10); col.addCyl(ex, ez, 0.5, 0, 0.9); }
    }
  }
  // ligne de départ (damier) + portique
  const s0 = circuitPoint(C, Math.PI / 2);
  for (let i = 0; i < 10; i++) for (let k = 0; k < 2; k++) sb.quad(s0.x - 0.6 + k * 0.6, 0.045, s0.z - 4.5 + i, 0.6, 1, (i + k) % 2 ? '#111111' : '#ffffff', 0, 'ground');
  for (const sz of [-6.2, 6.2]) { sb.box(s0.x, 0, s0.z + sz, 0.5, 5.5, 0.5, '#2b2d42'); col.addBoxC(s0.x, s0.z + sz, 0.5, 0.5, 0, 5.5); }
  sb.box(s0.x, 5.2, s0.z, 0.8, 0.8, 12.9, '#f72585');
  // tribune
  const tb = { x: C.x + 20, z: C.z + C.rz + 8 };
  for (let k = 0; k < 4; k++) sb.box(tb.x, k * 0.8, tb.z + k * 1.2, 30, 0.8, 1.2, k % 2 ? '#c0c4ca' : '#a9b1bd');
  sb.box(tb.x, 3.2, tb.z + 3.5, 30, 0.2, 6, '#3a0ca3');
  col.addBoxC(tb.x, tb.z + 1.8, 30, 4.8, 0, 3.2);

  // ---------- square des Tilleuls : aire de jeux, bancs, arbres
  const TP = CITY_POI.tilleulsPark;
  sb.quad(TP.x, 0.03, TP.z, 50, 30, '#8ccf6a', 0, 'ground');
  for (let i = 0; i < 10; i++) { const x = TP.x + R(-22, 22), z = TP.z + R(-12, 12); if (Math.hypot(x - TP.x, z - TP.z) > 7 && !BUILDINGS.some((b) => Math.abs(x - b.x) < b.w / 2 + 2 && Math.abs(z - b.z) < b.d / 2 + 2)) tree(sb, col, x, z, 'round', R(0.9, 1.2)); }
  // toboggan + balançoires
  sb.box(TP.x - 3, 0, TP.z, 1.2, 2.2, 1.2, '#ff5a5f'); sb.add(SHAPES.box(), { x: TP.x - 1.1, y: 1.0, z: TP.z, sx: 3.4, sy: 0.1, sz: 0.9, rz: -0.6, color: '#ffd23f' }); col.addBoxC(TP.x - 3, TP.z, 1.2, 1.2, 0, 2.2);
  for (const sx of [2, 6]) { sb.cyl(TP.x + sx, 0, TP.z - 1, 0.06, 2.6, '#2b2d42', 6); sb.cyl(TP.x + sx, 0, TP.z + 1, 0.06, 2.6, '#2b2d42', 6); }
  sb.box(TP.x + 4, 2.55, TP.z, 4.2, 0.1, 0.1, '#2b2d42');
  for (const sx of [3, 5]) sb.box(TP.x + sx, 0.6, TP.z, 0.7, 0.08, 0.4, '#2ec4b6');
  block(TP.x - 25, TP.z - 15, TP.x + 25, TP.z + 15);

  // ---------- Plage Sauvage : palmiers, parasols
  for (let i = 0; i < 30; i++) { const x = R(-296, -140), z = R(66, 74); if (isFree(x, z, 1)) tree(sb, col, x, z, 'palm', R(0.9, 1.2)); }
  for (let i = 0; i < 14; i++) { const x = R(-290, -150), z = R(76, 86); if (!isFree(x, z, 1)) continue; sb.cyl(x, 0, z, 0.06, 2.4, '#eeeeee', 5); sb.cone(x, 2.2, z, 1.6, 0.7, ['#ff5a5f', '#ffd23f', '#2ec4b6', '#c77dff'][i % 4], 8); }

  // ---------- Quartiers nord : bosquets dans les espaces libres, buissons
  for (let i = 0; i < 160; i++) {
    const x = R(-298, 298), z = R(-418, -146);
    if (isFree(x, z, 1.2)) tree(sb, col, x, z, z < -340 ? (rand() > 0.5 ? 'pine' : 'round') : 'round', R(0.85, 1.25));
  }
  for (let i = 0; i < 60; i++) { const x = R(140, 298), z = R(-134, 54); if (isFree(x, z, 1.2)) tree(sb, col, x, z, 'round', R(0.85, 1.1)); }

  // ---------- collines au-delà de la limite nord, falaises est/ouest et limites invisibles
  // ---------- grande carte : forêts et bosquets des nouveaux quartiers, vignes, haies le long de l'autoroute
  const B0 = WORLD_BOUNDS;
  for (let i = 0; i < 2600; i++) {
    // forêt noire très dense, campagnes plus clairsemées
    const forest = i < 1300;
    const x = forest ? R(-1845, -425) : R(B0.minX + 5, B0.maxX - 5), z = forest ? R(-1890, -1005) : R(B0.minZ + 5, 55);
    if (x > -300 && x < 300 && z > -520) continue;
    if (Math.hypot(x - LAKE.x, (z - LAKE.z) * 1.3) < LAKE.r + 6) continue;
    if (x > 880 && x < 1770 && z < -1280 && z > -1770) continue;   // aéroport
    if (isFree(x, z, 2)) tree(sb, col, x, z, i % 3 ? 'round' : 'pine', R(0.9, 1.3));
  }
  for (let z = -425; z < 45; z += 9) for (let x = -830; x < -310; x += 26) if (isFree(x, z, 1) && isFree(x + 18, z, 1)) sb.box(x + 9, 0, z, 18, 0.9, 0.5, '#3e6b2a');
  for (let i = 0; i < Math.round((WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX) / 26) + 2; i++) {
    const x = WORLD_BOUNDS.minX - 20 + i * 26 + R(-6, 6);
    sb.blob(x, -8, WORLD_BOUNDS.minZ - 30 - R(0, 30), R(30, 50), i % 2 ? '#6aa84f' : '#5b9a45', 0.6);
  }
  const B = WORLD_BOUNDS;
  col.addBox(B.minX - 20, -10, B.minZ - 20, B.maxX + 20, 60, B.minZ, { noCamera: true });
  col.addBox(B.minX - 20, -10, B.maxZ, B.maxX + 20, 60, B.maxZ + 20, { noCamera: true });
  col.addBox(B.minX - 20, -10, B.minZ, B.minX, 60, B.maxZ, { noCamera: true });
  col.addBox(B.maxX, -10, B.minZ, B.maxX + 20, 60, B.maxZ, { noCamera: true });
}

function fenceLine(sb, col, x1, z1, x2, z2, collide = true, color = '#a0703c', h = 1.1) {
  const len = Math.hypot(x2 - x1, z2 - z1), n = Math.max(1, Math.round(len / 2.4));
  for (let i = 0; i <= n; i++) { const t = i / n; sb.box(x1 + (x2 - x1) * t, 0, z1 + (z2 - z1) * t, 0.15, h, 0.15, color); }
  const ry = Math.atan2(x2 - x1, z2 - z1);
  for (const y of [h * 0.4, h * 0.85]) sb.add(SHAPES.box(), { x: (x1 + x2) / 2, y, z: (z1 + z2) / 2, sx: 0.08, sy: 0.12, sz: len, ry, color });
  if (collide) col.addBox(Math.min(x1, x2) - 0.15, 0, Math.min(z1, z2) - 0.15, Math.max(x1, x2) + 0.15, h, Math.max(z1, z2) + 0.15);
}

function crane(sb, col, x, z) {
  for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) { sb.box(x + dx, 0, z + dz, 0.6, 14, 0.6, '#ffb703'); col.addBoxC(x + dx, z + dz, 0.6, 0.6, 0, 14); }
  sb.box(x, 14, z, 7, 1.2, 7, '#ffb703');
  sb.box(x, 15.2, z + 6, 1.4, 1.2, 26, '#ffb703');
  sb.box(x, 16.4, z - 2, 4, 3, 4, '#e85d04');
  sb.box(x, 16.4, z - 1.95, 3.6, 1.2, 4.05, '#9fc4e8', 0, 'windows');
  sb.box(x, 8, z + 16, 0.1, 7, 0.1, '#333333');
  sb.box(x, 7, z + 16, 2.4, 1, 1.2, '#2b2d33');
}

function boat(sb, x, z, len, color) {
  sb.box(x, -1.2, z, len * 0.3, 2, len, color);
  sb.add(SHAPES.cone(4), { x, y: -1.2, z: z + len / 2, sx: len * 0.42, sy: 2, sz: len * 0.42 * 0.4, ry: Math.PI / 4, color });
  sb.box(x, 0.8, z - len * 0.15, len * 0.22, 2.2, len * 0.3, '#f4f1ea');
  sb.box(x, 1.8, z - len * 0.15 + 0.02, len * 0.23, 0.6, len * 0.31, '#9fc4e8', 0, 'windows');
  sb.box(x, 0.8, z, len * 0.31, 0.25, len * 1.01, '#d62828');
}

function stand(sb, col, x, z, color) {
  sb.box(x, 0, z, 8, 1.1, 4, '#f4f1ea');
  for (const [dx, dz] of [[-3.8, -1.8], [3.8, -1.8], [-3.8, 1.8], [3.8, 1.8]]) sb.box(x + dx, 0, z + dz, 0.2, 3.2, 0.2, '#ffffff');
  for (let i = 0; i < 8; i++) sb.add(SHAPES.box(), { x: x - 3.5 + i, y: 3.2, z, sx: 1, sy: 0.12, sz: 4.6, rx: 0, color: i % 2 ? color : '#ffffff' });
  sb.add(SHAPES.gable(), { x, y: 3.25, z, sx: 8.2, sy: 1.2, sz: 4.6, color });
  for (let i = 0; i < 5; i++) sb.sphere(x - 2.4 + i * 1.2, 1.4, z - 1.2, 0.25, ['#ffd23f', '#ff5a5f', '#2ec4b6'][i % 3], 8);
  col.addBoxC(x, z, 8, 4, 0, 1.1);
}

function circuitPoint(C, a) {
  // ovale arrondi ("stade")
  const c = Math.cos(a), s = Math.sin(a);
  const k = 1 / Math.pow(Math.abs(c) ** 4 + Math.abs(s) ** 4, 0.25);
  return { x: C.x + c * k * C.rx, z: C.z + s * k * C.rz };
}
export { circuitPoint };

import { buildMergedGeometry } from '../core/static-builder.js';
function bladesGeometry() {
  return buildMergedGeometry((sb) => {
    sb.add(SHAPES.cyl(10), { y: 0, sx: 0.8, sy: 0.6, sz: 0.8, rx: Math.PI / 2, color: '#5a3d2b' });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      sb.add(SHAPES.box(), { x: Math.cos(a) * 3.2, y: Math.sin(a) * 3.2, z: 0.3, sx: 6, sy: 0.2, sz: 0.15, rz: a, color: '#6e4a26' });
      sb.add(SHAPES.box(), { x: Math.cos(a) * 3.6, y: Math.sin(a) * 3.6, z: 0.35, sx: 4.4, sy: 1.2, sz: 0.06, rz: a, color: '#f4f1ea' });
    }
  });
}

function carouselGeometry() {
  return buildMergedGeometry((sb) => {
    sb.cyl(0, 0, 0, 0.4, 4.5, '#ffd23f', 10);
    sb.cone(0, 4.5, 0, 6.8, 2, '#ff5a5f', 20);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, x = Math.cos(a) * 4.6, z = Math.sin(a) * 4.6;
      sb.cyl(x, 0, z, 0.06, 4.5, '#f4f1ea', 6);
      sb.box(x, 1.0 + (i % 2) * 0.4, z, 0.5, 0.7, 1.4, ['#ffffff', '#c77dff', '#2ec4b6', '#ffd23f'][i % 4], -a);
      sb.sphere(x + Math.cos(a + Math.PI / 2) * 0.7, 1.7 + (i % 2) * 0.4, z + Math.sin(a + Math.PI / 2) * 0.7, 0.3, '#ffffff', 8);
    }
  });
}
