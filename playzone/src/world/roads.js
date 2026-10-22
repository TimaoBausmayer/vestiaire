import * as THREE from 'three';
import { STREETS, STREET_BY_ID, ROAD_GRAPH, streetRect } from '../../shared/city.js';
import { BUILDINGS, PARKINGS, GAS_STATIONS } from '../../shared/world-layout.js';
import { PALETTE } from '../core/materials.js';

// RÉSEAU ROUTIER : chaussées, marquages (lignes, passages piétons, lignes d'arrêt), trottoirs avec
// bordures, lampadaires, et feux tricolores (ampoules instanciées dont la couleur change en direct).

const OLD = new Set(['place-n', 'place-s', 'place-w', 'place-e', 'av-nord', 'av-sud']); // bordées par le décor historique
const nodeHalf = (n) => Math.max(...[...n.streets].map((id) => STREET_BY_ID[id].w)) / 2;

// Rectangles où l'on ne pose pas de trottoir (bâtiments, parkings, stations, place).
const holes = [
  ...BUILDINGS.map((b) => [b.x - b.w / 2 - 0.2, b.z - b.d / 2 - 0.2, b.x + b.w / 2 + 0.2, b.z + b.d / 2 + 0.2]),
  ...PARKINGS.map((p) => [p.x1, p.z1, p.x2, p.z2]),
  ...GAS_STATIONS.map((g) => [g.x - g.w / 2 - 2, g.z - g.d / 2 - 2, g.x + g.w / 2 + 2, g.z + g.d / 2 + 2]),
  [-32, -32, 32, 32],
];

// Intervalles [a, b] le long d'un axe, privés des trous qui coupent la bande transversale [c1, c2].
function subtract(a, b, axis, c1, c2, extra = []) {
  let segs = [[a, b]];
  const cut = (lo, hi) => {
    const out = [];
    for (const [s, e] of segs) {
      if (hi <= s || lo >= e) { out.push([s, e]); continue; }
      if (lo > s) out.push([s, lo]);
      if (hi < e) out.push([hi, e]);
    }
    segs = out;
  };
  for (const [x1, z1, x2, z2] of [...holes, ...extra]) {
    if (axis === 'h') { if (z2 > c1 && z1 < c2) cut(x1, x2); } else if (x2 > c1 && x1 < c2) cut(z1, z2);
  }
  return segs.filter(([s, e]) => e - s > 1);
}

export function buildRoads(sb, col, scene) {
  const G = ROAD_GRAPH;
  const nodeBoxes = G.nodes.map((n) => { const h = nodeHalf(n); return [n.x - h, n.z - h, n.x + h, n.z + h]; });
  // --- chaussées
  for (const s of STREETS) {
    const [x1, z1, x2, z2] = streetRect(s);
    sb.quad((x1 + x2) / 2, 0.03, (z1 + z2) / 2, x2 - x1, z2 - z1, s.kind === 'country' ? '#5c5a55' : s.kind === 'highway' ? '#3f4247' : PALETTE.road, 0, 'ground');
  }
  // --- marquages au sol le long de chaque tronçon
  const line = '#f5f1e3';
  for (const e of G.edges) {
    const a = G.nodes[e.a], b = G.nodes[e.b], s = STREET_BY_ID[e.street];
    const horiz = s.axis === 'h';
    const ha = a.degree > 1 ? nodeHalf(a) + 1 : 0, hb = b.degree > 1 ? nodeHalf(b) + 1 : 0;
    const p0 = (horiz ? a.x : a.z) + ha + (a.light ? 5 : 0), p1 = (horiz ? b.x : b.z) - hb - (b.light ? 5 : 0);
    const c = horiz ? s.z : s.x;
    // ligne centrale en tirets
    for (let t = p0 + 1; t + 3 < p1; t += 7) {
      if (horiz) sb.quad(t + 1.5, 0.05, c, 3, 0.2, line, 0, 'ground'); else sb.quad(c, 0.05, t + 1.5, 0.2, 3, line, 0, 'ground');
    }
    // lignes de rive des grands axes
    if ((s.kind === 'main' || s.kind === 'highway') && !OLD.has(s.id) && p1 - p0 > 2) {
      for (const side of [-1, 1]) {
        const o = c + side * (s.w / 2 - 0.45);
        if (horiz) sb.quad((p0 + p1) / 2, 0.05, o, p1 - p0, 0.15, line, 0, 'ground'); else sb.quad(o, 0.05, (p0 + p1) / 2, 0.15, p1 - p0, line, 0, 'ground');
      }
    }
  }
  // --- passages piétons et lignes d'arrêt aux carrefours à feux
  for (const n of G.nodes) {
    if (!n.light) continue;
    const half = nodeHalf(n);
    for (const eid of n.edges) {
      const e = G.edges[eid], s = STREET_BY_ID[e.street];
      const o = G.nodes[e.a === n.id ? e.b : e.a];
      const dx = Math.sign(o.x - n.x), dz = Math.sign(o.z - n.z); // direction de la branche
      const dist = half + 2.2;
      const cx = n.x + dx * dist, cz = n.z + dz * dist;
      for (let k = -s.w / 2 + 0.6; k < s.w / 2 - 0.3; k += 1) {
        if (dx) sb.quad(cx, 0.055, n.z + k + 0.25, 2.6, 0.5, line, 0, 'ground'); else sb.quad(n.x + k + 0.25, 0.055, cz, 0.5, 2.6, line, 0, 'ground');
      }
      // ligne d'arrêt (voie entrante = côté droit en arrivant vers le carrefour)
      // droite du conducteur qui arrive (il roule vers -d) : (dz, -dx)
      const rx = dz, rz = -dx;
      const sx = n.x + dx * (dist + 1.8) + rx * s.w / 4, sz = n.z + dz * (dist + 1.8) + rz * s.w / 4;
      if (dx) sb.quad(sx, 0.055, sz, 0.35, s.w / 2 - 0.3, line, 0, 'ground');
      else sb.quad(sx, 0.055, sz, s.w / 2 - 0.3, 0.35, line, 0, 'ground');
    }
  }
  // --- trottoirs (rues urbaines) avec bordures + lampadaires
  const sw = 2.6;
  const lampSpots = [];
  for (const s of STREETS) {
    if (s.kind === 'country' || s.kind === 'highway' || OLD.has(s.id)) continue;
    const horiz = s.axis === 'h';
    const [a, b] = horiz ? [s.x1, s.x2] : [s.z1, s.z2];
    for (const side of [-1, 1]) {
      const off = (horiz ? s.z : s.x) + side * (s.w / 2 + sw / 2);
      const c1 = off - sw / 2, c2 = off + sw / 2;
      const crossings = nodeBoxes.map(([x1, z1, x2, z2]) => [x1 - 0.5, z1 - 0.5, x2 + 0.5, z2 + 0.5]);
      for (const [p, q] of subtract(a - s.w / 2, b + s.w / 2, s.axis, c1, c2, crossings)) {
        const mid = (p + q) / 2, len = q - p;
        if (horiz) {
          sb.box(mid, 0, off, len, 0.15, sw, PALETTE.sidewalk, 0, 'ground');
          sb.box(mid, 0, off - side * (sw / 2 - 0.12), len, 0.17, 0.24, '#a8a294', 0, 'ground');
        } else {
          sb.box(off, 0, mid, sw, 0.15, len, PALETTE.sidewalk, 0, 'ground');
          sb.box(off - side * (sw / 2 - 0.12), 0, mid, 0.24, 0.17, len, '#a8a294', 0, 'ground');
        }
        // lampadaires régulièrement espacés (côtés alternés)
        for (let t = p + 4 + (side > 0 ? 16 : 0); t < q - 3; t += 32) {
          const lx = horiz ? t : off + side * 0.6, lz = horiz ? off + side * 0.6 : t;
          lampSpots.push([lx, lz, horiz ? (side > 0 ? Math.PI : 0) : (side > 0 ? -Math.PI / 2 : Math.PI / 2)]);
        }
      }
    }
  }
  for (const [x, z, ry] of lampSpots) if (!BUILDINGS.some((b) => Math.hypot(b.door.x - x, b.door.z - z) < 4)) streetLamp(sb, col, x, z, ry);
  return buildTrafficLights(sb, col, scene);
}

// Lampadaire moderne : mât, crosse vers la chaussée, lanterne (s'allume la nuit).
function streetLamp(sb, col, x, z, ry) {
  const fx = Math.sin(ry), fz = Math.cos(ry);
  sb.cyl(x, 0, z, 0.1, 5.6, '#3a3f4b', 8);
  sb.cyl(x, 0, z, 0.18, 0.5, '#3a3f4b', 8);
  sb.add(SHAPES_BOX(), { x: x + fx * 0.6, y: 5.5, z: z + fz * 0.6, sx: 0.12, sy: 0.12, sz: 1.3, ry, color: '#3a3f4b' });
  sb.add(SHAPES_BOX(), { x: x + fx * 1.2, y: 5.3, z: z + fz * 1.2, sx: 0.5, sy: 0.18, sz: 0.8, ry, color: '#3a3f4b' });
  sb.add(SHAPES_BOX(), { x: x + fx * 1.2, y: 5.22, z: z + fz * 1.2, sx: 0.42, sy: 0.08, sz: 0.7, ry, color: '#fff3c4', mat: 'glow' });
  col.addCyl(x, z, 0.15, 0, 5.6, { noCamera: true });
}

// Feux tricolores : un mât par branche entrante (à droite), trois ampoules instanciées par feu.
function buildTrafficLights(sb, col, scene) {
  const G = ROAD_GRAPH;
  const heads = [];
  for (const n of G.nodes) {
    if (!n.light) continue;
    const half = nodeHalf(n);
    for (const eid of n.edges) {
      const e = G.edges[eid], s = STREET_BY_ID[e.street];
      const o = G.nodes[e.a === n.id ? e.b : e.a];
      const dx = Math.sign(o.x - n.x), dz = Math.sign(o.z - n.z);
      // le conducteur qui arrive roule en direction (-dx, -dz) ; sa droite est (dz, -dx)
      const rx = dz, rz = -dx;
      const px = n.x + dx * (half + 4.2) + rx * (s.w / 2 + 0.9), pz = n.z + dz * (half + 4.2) + rz * (s.w / 2 + 0.9);
      const face = Math.atan2(dx, dz); // la tête regarde vers le conducteur (direction +d)
      sb.cyl(px, 0, pz, 0.09, 3.4, '#2b2d33', 8);
      sb.add(SHAPES_BOX(), { x: px, y: 2.6, z: pz, sx: 0.38, sy: 1.15, sz: 0.3, ry: face, color: '#1d1f24' });
      col.addCyl(px, pz, 0.15, 0, 3.4, { noCamera: true });
      heads.push({ node: n.id, axis: s.axis, x: px + Math.sin(face) * 0.17, z: pz + Math.cos(face) * 0.17 });
    }
  }
  // ampoules : rouge (haut), orange, vert (bas)
  const geo = new THREE.SphereGeometry(0.13, 10, 6);
  const mat = new THREE.MeshBasicMaterial({ toneMapped: false });
  const mesh = new THREE.InstancedMesh(geo, mat, heads.length * 3);
  const m = new THREE.Matrix4();
  heads.forEach((hd, i) => {
    for (let k = 0; k < 3; k++) { m.makeTranslation(hd.x, 3.0 - k * 0.36, hd.z); mesh.setMatrixAt(i * 3 + k, m); mesh.setColorAt(i * 3 + k, new THREE.Color('#222')); }
  });
  mesh.frustumCulled = false;
  scene.add(mesh);
  return { heads, bulbs: mesh };
}

import { SHAPES } from '../core/static-builder.js';
const SHAPES_BOX = () => SHAPES.box();
