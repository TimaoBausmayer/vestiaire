import * as THREE from 'three';
import { buildMergedGeometry, SHAPES as B } from '../core/static-builder.js';
import { actorMaterial } from '../core/materials.js';

// Modèles des 20 espèces, construits en code. Chaque animal regarde vers +Z, pieds au sol.
// Retour : { root, body, head, legs[], wings[], tail, segs[] } (parties articulées pour l'animation).

const geoCache = new Map();
function cached(key, fn) { if (!geoCache.has(key)) geoCache.set(key, buildMergedGeometry(fn)); return geoCache.get(key); }
function mesh(geo) { const m = new THREE.Mesh(geo, actorMaterial); m.castShadow = true; return m; }

// ---------- Quadrupède paramétrique
const QUADS = {
  chien: { L: 0.75, H: 0.42, W: 0.34, y: 0.5, leg: 0.42, legW: 0.11, col: '#c68642', belly: '#f1d3a5', head: 0.3, headCol: '#c68642', snout: [0.16, 0.14, 0.22], snoutCol: '#f1d3a5', ears: 'floppy', earCol: '#7a4a24', tail: 'up', nose: '#222' },
  chat: { L: 0.62, H: 0.32, W: 0.26, y: 0.36, leg: 0.32, legW: 0.08, col: '#9aa5b1', belly: '#e5e7eb', head: 0.27, headCol: '#9aa5b1', snout: [0.1, 0.08, 0.06], snoutCol: '#e5e7eb', ears: 'pointy', earCol: '#9aa5b1', tail: 'long', nose: '#ff8fab', stripes: '#6b7280' },
  renard: { L: 0.7, H: 0.32, W: 0.26, y: 0.4, leg: 0.36, legW: 0.08, col: '#e8742c', belly: '#ffffff', head: 0.27, headCol: '#e8742c', snout: [0.1, 0.1, 0.25], snoutCol: '#ffffff', ears: 'pointy', earCol: '#5a2a10', tail: 'fluffy', tailTip: '#ffffff', nose: '#222', legCol: '#3a2a1e' },
  loup: { L: 0.95, H: 0.45, W: 0.36, y: 0.6, leg: 0.52, legW: 0.12, col: '#7d8590', belly: '#d1d5db', head: 0.34, headCol: '#7d8590', snout: [0.13, 0.13, 0.3], snoutCol: '#d1d5db', ears: 'pointy', earCol: '#4b5563', tail: 'fluffy', nose: '#111' },
  ours: { L: 1.5, H: 0.95, W: 0.95, y: 0.95, leg: 0.6, legW: 0.28, col: '#6b4226', belly: '#8a5a3b', head: 0.55, headCol: '#6b4226', snout: [0.24, 0.2, 0.25], snoutCol: '#c49a6c', ears: 'round', earCol: '#6b4226', tail: 'short', nose: '#111' },
  cheval: { L: 1.5, H: 0.7, W: 0.55, y: 1.2, leg: 1.1, legW: 0.15, col: '#8b5a2b', belly: '#8b5a2b', head: 0.32, headCol: '#8b5a2b', snout: [0.2, 0.22, 0.45], snoutCol: '#6b4226', ears: 'pointy', earCol: '#8b5a2b', tail: 'horse', mane: '#2b1d10', nose: '#2b1d10', neck: 0.55, hoof: '#2b1d10' },
  vache: { L: 1.5, H: 0.85, W: 0.75, y: 1.0, leg: 0.85, legW: 0.17, col: '#ffffff', belly: '#ffffff', head: 0.42, headCol: '#ffffff', snout: [0.24, 0.2, 0.18], snoutCol: '#ffb3c6', ears: 'side', earCol: '#ffffff', horns: '#eeeeee', tail: 'cow', spots: '#222222', nose: '#ff8fab', hoof: '#333' },
  cochon: { L: 0.95, H: 0.6, W: 0.6, y: 0.55, leg: 0.35, legW: 0.12, col: '#ffb3c6', belly: '#ffc8dd', head: 0.36, headCol: '#ffb3c6', snout: [0.18, 0.14, 0.1], snoutCol: '#ff8fab', ears: 'floppy', earCol: '#ff8fab', tail: 'curly', nose: '#d65f86' },
  mouton: { L: 0.95, H: 0.65, W: 0.7, y: 0.7, leg: 0.5, legW: 0.1, col: '#f4f1ea', belly: '#f4f1ea', head: 0.28, headCol: '#2b2d42', snout: [0.12, 0.12, 0.12], snoutCol: '#2b2d42', ears: 'side', earCol: '#2b2d42', tail: 'short', wool: true, legCol: '#2b2d42', nose: '#111' },
  rat: { L: 0.32, H: 0.16, W: 0.15, y: 0.12, leg: 0.1, legW: 0.04, col: '#7d7d7d', belly: '#bdbdbd', head: 0.13, headCol: '#7d7d7d', snout: [0.05, 0.05, 0.1], snoutCol: '#9a9a9a', ears: 'round', earCol: '#ff8fab', tail: 'rat', nose: '#ff8fab', small: true },
  // ---- animaux du zoo
  lion: { L: 1.6, H: 0.72, W: 0.62, y: 0.95, leg: 0.75, legW: 0.17, col: '#d4a056', belly: '#e9c48a', head: 0.42, headCol: '#d4a056', snout: [0.16, 0.14, 0.16], snoutCol: '#f1d3a5', ears: 'round', earCol: '#b07d3a', tail: 'long', nose: '#5a2a10', lionMane: '#7a4a1c', scale: 1.35 },
  elephant: { L: 2.5, H: 1.6, W: 1.55, y: 1.75, leg: 1.25, legW: 0.48, col: '#8d939b', belly: '#7d838b', head: 0.85, headCol: '#8d939b', snout: [0.18, 0.18, 0.1], snoutCol: '#8d939b', ears: 'elephant', earCol: '#a0a6ad', tail: 'cow', nose: '#6c757d', trunk: '#8d939b', tusks: '#fffaf0', scale: 1.3 },
  girafe: { L: 1.5, H: 0.8, W: 0.6, y: 2.0, leg: 1.8, legW: 0.13, col: '#e9b44c', belly: '#f4d58d', head: 0.3, headCol: '#e9b44c', snout: [0.12, 0.12, 0.2], snoutCol: '#f4d58d', ears: 'side', earCol: '#e9b44c', horns: '#7a4a1c', tail: 'cow', spots: '#8b4513', nose: '#3a2a1e', hoof: '#3a2a1e', longNeck: 1.7, headUp: 1.55, headFwd: 0.45, scale: 1.25 },
  zebre: { L: 1.45, H: 0.68, W: 0.52, y: 1.15, leg: 1.05, legW: 0.14, col: '#f8f9fa', belly: '#f8f9fa', head: 0.3, headCol: '#f8f9fa', snout: [0.18, 0.2, 0.42], snoutCol: '#2b2d42', ears: 'pointy', earCol: '#f8f9fa', tail: 'horse', mane: '#111111', nose: '#111', neck: 0.55, hoof: '#111', zebra: '#111111' },
  singe: { L: 0.5, H: 0.45, W: 0.36, y: 0.5, leg: 0.45, legW: 0.09, col: '#7a4a24', belly: '#d4a373', head: 0.3, headCol: '#7a4a24', snout: [0.12, 0.1, 0.06], snoutCol: '#e9c49a', ears: 'round', earCol: '#d4a373', tail: 'long', nose: '#3a2a1e' },
  lapin: { L: 0.36, H: 0.3, W: 0.3, y: 0.2, leg: 0.12, legW: 0.06, col: '#e8e0d0', belly: '#ffffff', head: 0.18, headCol: '#e8e0d0', snout: [0.06, 0.06, 0.05], snoutCol: '#ffffff', ears: 'long', earCol: '#e8e0d0', tail: 'pompon', nose: '#ff8fab', small: true },
};

function buildQuad(o) {
  const body = (sb) => {
    sb.add(B.sphere(12), { y: o.y, sx: o.W, sy: o.H, sz: o.L, color: o.col });
    sb.add(B.sphere(10), { y: o.y - o.H * 0.18, sx: o.W * 0.85, sy: o.H * 0.7, sz: o.L * 0.8, color: o.belly });
    if (o.spots) for (const [x, y, z, s] of [[0.2, 0.15, 0.2, 0.3], [-0.25, 0.1, -0.3, 0.35], [0.1, 0.3, -0.1, 0.25], [-0.15, 0.25, 0.35, 0.22]]) sb.add(B.sphere(8), { x: x * o.W * 2, y: o.y + y * o.H, z: z * o.L, sx: s, sy: s * 0.6, sz: s, color: o.spots });
    if (o.stripes) for (let i = 0; i < 3; i++) sb.add(B.box(), { y: o.y + o.H * 0.42, z: -o.L * 0.2 + i * o.L * 0.15, sx: o.W * 0.7, sy: 0.03, sz: 0.04, color: o.stripes });
    if (o.wool) for (let i = 0; i < 10; i++) { const a = i * 2.4; sb.add(B.ico1(), { x: Math.cos(a) * o.W * 0.35, y: o.y + 0.08 + (i % 3) * 0.1, z: Math.sin(a * 1.3) * o.L * 0.35, sx: 0.4, sy: 0.35, sz: 0.4, color: '#ffffff' }); }
    if (o.zebra) for (let i = 0; i < 7; i++) sb.add(B.torus(), { y: o.y, z: -o.L * 0.36 + i * o.L * 0.12, sx: o.W * 1.02, sy: o.H * 1.02, sz: 0.6, color: o.zebra });
    if (o.longNeck) { sb.add(B.cyl(8), { y: o.y + o.H * 0.2, z: o.L * 0.38, sx: 0.24, sy: o.longNeck, sz: 0.28, rx: 0.35, color: o.col }); for (let i = 0; i < 4; i++) sb.add(B.sphere(6), { x: 0.1, y: o.y + 0.5 + i * 0.35, z: o.L * 0.45 + i * 0.12, sx: 0.12, sy: 0.12, sz: 0.06, color: o.spots }); }
    if (o.mane) for (let i = 0; i < 5; i++) sb.add(B.box(), { y: o.y + o.H * 0.4 + i * 0.12, z: o.L * 0.35 + i * 0.06, sx: 0.06, sy: 0.18, sz: 0.18, color: o.mane });
    // queue
    const tz = -o.L / 2;
    switch (o.tail) {
      case 'up': sb.add(B.cyl(6), { y: o.y + 0.05, z: tz - 0.05, sx: 0.06, sy: 0.3, sz: 0.06, rx: -0.6, color: o.col }); break;
      case 'long': sb.add(B.cyl(6), { y: o.y, z: tz, sx: 0.05, sy: 0.45, sz: 0.05, rx: -1.0, color: o.stripes || o.col }); break;
      case 'fluffy': sb.add(B.sphere(8), { y: o.y - 0.05, z: tz - 0.25, sx: 0.18, sy: 0.18, sz: 0.5, rx: 0.4, color: o.col }); if (o.tailTip) sb.add(B.sphere(6), { y: o.y - 0.18, z: tz - 0.48, sx: 0.12, sy: 0.12, sz: 0.15, color: o.tailTip }); break;
      case 'horse': sb.add(B.box(), { y: o.y - 0.5, z: tz - 0.1, sx: 0.12, sy: 0.7, sz: 0.1, rx: 0.2, color: o.mane }); break;
      case 'cow': sb.add(B.cyl(5), { y: o.y - 0.55, z: tz, sx: 0.04, sy: 0.6, sz: 0.04, color: o.col }); sb.add(B.sphere(5), { y: o.y - 0.58, z: tz, sx: 0.1, sy: 0.14, sz: 0.1, color: '#222' }); break;
      case 'curly': sb.add(B.torus(), { y: o.y + 0.05, z: tz - 0.02, sx: 0.15, sy: 0.15, sz: 0.15, ry: Math.PI / 2, color: o.col }); break;
      case 'rat': sb.add(B.cyl(5), { y: 0.05, z: tz - 0.18, sx: 0.025, sy: 0.4, sz: 0.025, rx: -1.45, color: '#ff8fab' }); break;
      case 'pompon': sb.add(B.sphere(6), { y: o.y + 0.02, z: tz, sx: 0.1, sy: 0.1, sz: 0.1, color: '#ffffff' }); break;
      default: sb.add(B.sphere(6), { y: o.y, z: tz, sx: 0.1, sy: 0.1, sz: 0.1, color: o.col });
    }
    if (o.small) { // petites pattes fusionnées au corps
      for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) sb.add(B.cyl(5), { x: x * o.W * 0.3, y: 0, z: z * o.L * 0.3, sx: o.legW, sy: o.y, sz: o.legW, color: o.col });
    }
  };
  const head = (sb) => {
    const hs = o.head;
    if (o.neck) sb.add(B.box(), { y: -0.1, z: -0.12, sx: 0.26, sy: o.neck, sz: 0.3, rx: -0.5, color: o.headCol });
    if (o.lionMane) sb.add(B.ico1(), { y: 0.02, z: -hs * 0.2, sx: hs * 2.1, sy: hs * 2.0, sz: hs * 1.3, color: o.lionMane });
    sb.add(B.sphere(12), { y: 0, sx: hs, sy: hs * 0.95, sz: hs * 1.05, color: o.headCol });
    if (o.trunk) { for (let i = 0; i < 5; i++) sb.add(B.sphere(8), { y: -hs * 0.2 - i * 0.22, z: hs * 0.6 + Math.sin(i * 0.5) * 0.15, sx: 0.26 - i * 0.025, sy: 0.3, sz: 0.26 - i * 0.025, color: o.trunk }); }
    if (o.tusks) for (const t of [-1, 1]) sb.add(B.cone(6), { x: t * hs * 0.32, y: -hs * 0.45, z: hs * 0.55, sx: 0.09, sy: 0.55, sz: 0.09, rx: 1.9, color: o.tusks });
    const [sw, sh, sl] = o.snout;
    sb.add(B.sphere(10), { y: -hs * 0.15, z: hs * 0.4 + sl * 0.35, sx: sw * 2, sy: sh * 2, sz: sl * 2 + 0.05, color: o.snoutCol });
    sb.add(B.sphere(6), { y: -hs * 0.05, z: hs * 0.45 + sl * 0.75 + 0.02, sx: 0.06 + sw * 0.3, sy: 0.05 + sh * 0.2, sz: 0.04, color: o.nose });
    for (const s of [-1, 1]) {
      sb.add(B.sphere(6), { x: s * hs * 0.24, y: hs * 0.12, z: hs * 0.42, sx: hs * 0.16, sy: hs * 0.18, sz: hs * 0.08, color: '#ffffff' });
      sb.add(B.sphere(6), { x: s * hs * 0.25, y: hs * 0.12, z: hs * 0.47, sx: hs * 0.09, sy: hs * 0.11, sz: hs * 0.05, color: '#111111' });
      switch (o.ears) {
        case 'pointy': sb.add(B.cone(4), { x: s * hs * 0.28, y: hs * 0.4, z: -hs * 0.05, sx: hs * 0.35, sy: hs * 0.45, sz: hs * 0.2, rz: -s * 0.25, color: o.earCol }); break;
        case 'floppy': sb.add(B.sphere(6), { x: s * hs * 0.48, y: hs * 0.0, z: -hs * 0.05, sx: hs * 0.18, sy: hs * 0.6, sz: hs * 0.3, rz: s * 0.3, color: o.earCol }); break;
        case 'round': sb.add(B.sphere(6), { x: s * hs * 0.36, y: hs * 0.42, sx: hs * 0.3, sy: hs * 0.3, sz: hs * 0.12, color: o.earCol }); break;
        case 'long': sb.add(B.sphere(6), { x: s * hs * 0.18, y: hs * 0.9, z: -hs * 0.1, sx: hs * 0.22, sy: hs * 1.1, sz: hs * 0.12, rz: -s * 0.12, color: o.earCol }); break;
        case 'elephant': sb.add(B.sphere(8), { x: s * hs * 0.85, y: hs * 0.05, z: -hs * 0.2, sx: hs * 0.12, sy: hs * 1.1, sz: hs * 0.9, color: o.earCol }); break;
        case 'side': sb.add(B.sphere(6), { x: s * hs * 0.6, y: hs * 0.15, sx: hs * 0.4, sy: hs * 0.14, sz: hs * 0.2, color: o.earCol }); break;
        default: break;
      }
      if (o.horns) sb.add(B.cone(5), { x: s * hs * 0.35, y: hs * 0.45, sx: 0.08, sy: 0.22, sz: 0.08, rz: -s * 0.6, color: o.horns });
    }
  };
  const leg = (sb) => {
    sb.add(B.cyl(6), { y: -o.leg, sx: o.legW, sy: o.leg, sz: o.legW, color: o.legCol || o.col });
    if (o.hoof) sb.add(B.cyl(6), { y: -o.leg, sx: o.legW * 1.15, sy: 0.08, sz: o.legW * 1.15, color: o.hoof });
  };
  return { body, head, leg };
}

// ---------- Oiseaux
const BIRDS = {
  pigeon: { s: 0.22, col: '#8d99ae', head: '#5c677d', belly: '#b8c0cc', beak: '#e9c46a', neck: '#6d9c8a', legs: '#ff8fab' },
  corbeau: { s: 0.3, col: '#1d1d26', head: '#1d1d26', belly: '#2b2b38', beak: '#333', legs: '#333' },
  canard: { s: 0.3, col: '#f4f1ea', head: '#2a7a4a', belly: '#ffffff', beak: '#ffb000', legs: '#ff9f1c', neck: '#ffffff', swim: true },
  poulet: { s: 0.3, col: '#ffffff', head: '#ffffff', belly: '#f4f1ea', beak: '#ffb000', legs: '#ffb000', comb: '#e63946' },
  pingouin: { s: 0.34, col: '#1b1b24', head: '#1b1b24', belly: '#ffffff', beak: '#ffb000', legs: '#ffb000' },
  aigle: { s: 0.6, col: '#5b3a1e', head: '#ffffff', belly: '#6b4226', beak: '#ffd23f', legs: '#ffd23f' },
};

function buildBird(o) {
  const s = o.s;
  const body = (sb) => {
    sb.add(B.sphere(12), { y: s * 1.1, sx: s * 1.4, sy: s * 1.3, sz: s * 2, color: o.col });
    sb.add(B.sphere(10), { y: s * 0.95, z: s * 0.2, sx: s * 1.2, sy: s * 1.05, sz: s * 1.3, color: o.belly });
    sb.add(B.box(), { y: s * 1.25, z: -s * 1.05, sx: s * 0.9, sy: s * 0.15, sz: s * 0.7, rx: -0.4, color: o.col }); // queue
    if (!o.swim) for (const x of [-1, 1]) {
      sb.add(B.cyl(4), { x: x * s * 0.3, y: 0, sx: s * 0.12, sy: s * 0.6, sz: s * 0.12, color: o.legs });
      sb.add(B.box(), { x: x * s * 0.3, y: 0, z: s * 0.15, sx: s * 0.35, sy: s * 0.06, sz: s * 0.4, color: o.legs });
    }
  };
  const head = (sb) => {
    if (o.neck) sb.add(B.cyl(8), { y: -s * 0.4, sx: s * 0.7, sy: s * 0.5, sz: s * 0.7, color: o.neck });
    sb.add(B.sphere(10), { y: 0, sx: s * 0.85, sy: s * 0.85, sz: s * 0.9, color: o.head });
    sb.add(B.cone(6), { y: -s * 0.05, z: s * 0.55, sx: s * 0.35, sy: s * (o === BIRDS.aigle ? 0.6 : 0.5), sz: s * 0.25, rx: Math.PI / 2, color: o.beak });
    if (o.swim) sb.add(B.box(), { y: -s * 0.12, z: s * 0.55, sx: s * 0.4, sy: s * 0.1, sz: s * 0.5, color: o.beak });
    for (const x of [-1, 1]) { sb.add(B.sphere(6), { x: x * s * 0.28, y: s * 0.12, z: s * 0.3, sx: s * 0.2, sy: s * 0.22, sz: s * 0.1, color: '#ffffff' }); sb.add(B.sphere(5), { x: x * s * 0.3, y: s * 0.12, z: s * 0.35, sx: s * 0.11, sy: s * 0.12, sz: s * 0.06, color: '#111' }); }
    if (o.comb) { sb.add(B.box(), { y: s * 0.48, z: s * 0.05, sx: s * 0.12, sy: s * 0.35, sz: s * 0.5, color: o.comb }); sb.add(B.sphere(5), { y: -s * 0.4, z: s * 0.4, sx: s * 0.15, sy: s * 0.3, sz: s * 0.12, color: o.comb }); }
  };
  const wing = (sb) => sb.add(B.sphere(8), { x: s * 0.75, y: 0, z: -s * 0.1, sx: s * 1.6, sy: s * 0.15, sz: s * 1.2, color: o.col });
  return { body, head, wing };
}

// ---------- Construction d'un animal
export function buildAnimal(species, opts = {}) {
  const root = new THREE.Group();
  const out = { root, legs: [], wings: [], segs: [] };
  if (QUADS[species]) {
    const o = QUADS[species];
    const q = buildQuad(o);
    out.body = mesh(cached(`${species}:body`, q.body));
    root.add(out.body);
    out.head = mesh(cached(`${species}:head`, q.head));
    out.head.position.set(0, o.y + o.H * 0.45 + (o.neck ? o.neck * 0.4 : 0) + (o.headUp || 0), o.L / 2 + o.head * 0.15 + (o.neck ? 0.25 : 0) + (o.headFwd || 0));
    out.headBase = out.head.position.clone();
    root.add(out.head);
    if (!o.small) {
      const lg = cached(`${species}:leg`, q.leg);
      for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const l = mesh(lg);
        l.position.set(x * o.W * 0.3, o.leg, z * o.L * 0.32);
        root.add(l);
        out.legs.push(l);
      }
    }
    out.height = (o.y + o.H) * (o.scale || 1);
    if (o.scale) root.scale.setScalar(o.scale);
  } else if (BIRDS[species]) {
    const o = BIRDS[species];
    const bd = buildBird(o);
    out.body = mesh(cached(`${species}:body`, bd.body));
    root.add(out.body);
    out.head = mesh(cached(`${species}:head`, bd.head));
    out.head.position.set(0, o.s * 2.1, o.s * 0.9);
    out.headBase = out.head.position.clone();
    root.add(out.head);
    const wg = cached(`${species}:wing`, bd.wing);
    for (const x of [1, -1]) {
      const w = mesh(wg);
      w.position.set(x * o.s * 0.55, o.s * 1.35, 0);
      w.scale.x = x;
      root.add(w);
      out.wings.push(w);
    }
    out.height = o.s * 2.6;
  } else if (species === 'serpent') {
    const col = opts.color || '#3f8f3a';
    const seg = cached('serpent:seg', (sb) => { sb.add(B.sphere(8), { y: 0.12, sx: 0.24, sy: 0.2, sz: 0.34, color: col }); sb.add(B.sphere(6), { y: 0.2, sx: 0.12, sy: 0.06, sz: 0.2, color: '#ffd23f' }); });
    const head = cached('serpent:head', (sb) => {
      sb.add(B.sphere(10), { y: 0.14, sx: 0.3, sy: 0.22, sz: 0.42, color: col });
      for (const x of [-1, 1]) sb.add(B.sphere(5), { x: x * 0.1, y: 0.22, z: 0.12, sx: 0.07, sy: 0.07, sz: 0.05, color: '#111' });
      sb.add(B.box(), { y: 0.1, z: 0.26, sx: 0.03, sy: 0.02, sz: 0.16, color: '#e63946' });
    });
    for (let i = 0; i < 9; i++) { const m = mesh(i === 0 ? head : seg); const s = 1 - i * 0.07; m.scale.setScalar(s); root.parent; out.segs.push(m); }
    out.height = 0.3;
  } else if (species === 'requin') {
    out.body = mesh(cached('requin', (sb) => {
      sb.add(B.sphere(12), { sx: 1.0, sy: 0.9, sz: 3.2, color: '#6c7a89' });
      sb.add(B.sphere(10), { y: -0.2, sx: 0.85, sy: 0.55, sz: 2.8, color: '#e5e7eb' });
      sb.add(B.cone(4), { y: 0.45, z: 0.1, sx: 0.12, sy: 1.1, sz: 0.9, color: '#6c7a89' }); // aileron dorsal
      sb.add(B.cone(4), { z: -1.75, sx: 0.12, sy: 1.0, sz: 0.6, rx: -0.6, color: '#6c7a89' });
      sb.add(B.cone(4), { z: -1.75, y: -0.1, sx: 0.12, sy: 0.8, sz: 0.5, rx: Math.PI + 0.6, color: '#6c7a89' });
      for (const x of [-1, 1]) { sb.add(B.box(), { x: x * 0.55, y: -0.25, z: 0.4, sx: 0.8, sy: 0.06, sz: 0.4, rz: x * -0.4, color: '#6c7a89' }); sb.add(B.sphere(5), { x: x * 0.33, y: 0.12, z: 1.25, sx: 0.08, sy: 0.08, sz: 0.06, color: '#111' }); }
      sb.add(B.box(), { y: -0.18, z: 1.35, sx: 0.4, sy: 0.04, sz: 0.2, color: '#ffffff' });
    }));
    root.add(out.body);
    out.height = 0.9;
  } else if (species === 'tortue') {
    out.body = mesh(cached('tortue', (sb) => {
      sb.add(B.hemi(10), { y: 0.08, sx: 0.6, sy: 0.4, sz: 0.75, color: '#5a7d3a' });
      for (let i = 0; i < 5; i++) { const a = i * 1.25; sb.add(B.hemi(6), { x: Math.cos(a) * 0.12, y: 0.15, z: Math.sin(a) * 0.15, sx: 0.18, sy: 0.12, sz: 0.18, color: '#7a9a4a' }); }
      sb.add(B.cyl(10), { y: 0.04, sx: 0.62, sy: 0.06, sz: 0.77, color: '#c9b37a' });
      for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) sb.add(B.sphere(6), { x: x * 0.25, y: 0.05, z: z * 0.28, sx: 0.13, sy: 0.09, sz: 0.16, color: '#8fb36a' });
    }));
    out.head = mesh(cached('tortue:head', (sb) => { sb.add(B.sphere(8), { sx: 0.16, sy: 0.14, sz: 0.2, color: '#8fb36a' }); for (const x of [-1, 1]) sb.add(B.sphere(5), { x: x * 0.05, y: 0.03, z: 0.07, sx: 0.04, sy: 0.04, sz: 0.03, color: '#111' }); }));
    out.head.position.set(0, 0.1, 0.42);
    out.headBase = out.head.position.clone();
    root.add(out.body, out.head);
    out.height = 0.4;
  } else if (species === 'crocodile') {
    out.body = mesh(cached('crocodile', (sb) => {
      sb.add(B.sphere(10), { y: 0.25, sx: 0.8, sy: 0.4, sz: 2.2, color: '#3f6b35' });
      for (let i = 0; i < 7; i++) sb.add(B.cone(4), { y: 0.42, z: 0.8 - i * 0.3, sx: 0.12, sy: 0.12, sz: 0.12, color: '#2f5228' });
      sb.add(B.cone(6), { y: 0.25, z: -0.95, sx: 0.5, sy: 1.7, sz: 0.3, rx: -Math.PI / 2, color: '#3f6b35' });
      for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) sb.add(B.box(), { x: x * 0.42, y: 0, z: z * 0.6, sx: 0.18, sy: 0.25, sz: 0.25, color: '#2f5228' });
    }));
    out.head = mesh(cached('crocodile:head', (sb) => {
      sb.add(B.box(), { y: 0, z: 0.45, sx: 0.5, sy: 0.16, sz: 0.95, color: '#3f6b35' });
      for (const x of [-1, 1]) { sb.add(B.sphere(6), { x: x * 0.14, y: 0.15, z: 0.1, sx: 0.14, sy: 0.14, sz: 0.14, color: '#3f6b35' }); sb.add(B.sphere(5), { x: x * 0.15, y: 0.2, z: 0.15, sx: 0.07, sy: 0.07, sz: 0.05, color: '#ffd23f' }); }
      for (let i = 0; i < 6; i++) for (const x of [-1, 1]) sb.add(B.cone(3), { x: x * 0.22, y: -0.1, z: 0.15 + i * 0.13, sx: 0.04, sy: 0.07, sz: 0.04, rx: Math.PI, color: '#ffffff' });
    }));
    out.jaw = mesh(cached('crocodile:jaw', (sb) => sb.add(B.box(), { y: -0.08, z: 0.42, sx: 0.46, sy: 0.08, sz: 0.88, color: '#e9d5a0' })));
    out.head.position.set(0, 0.3, 1.0);
    out.jaw.position.set(0, 0.3, 1.0);
    out.headBase = out.head.position.clone();
    root.add(out.body, out.head, out.jaw);
    out.height = 0.6;
  }
  root.userData.species = species;
  return out;
}

export const MODEL_SPECIES = [...Object.keys(QUADS), ...Object.keys(BIRDS), 'serpent', 'requin', 'tortue', 'crocodile'];

// Collier coloré (animaux de compagnie)
export function addCollar(model, color) {
  const species = model.root.userData.species;
  const o = QUADS[species];
  if (!o || !model.head) return null;
  const g = buildMergedGeometry((sb) => sb.add(B.ring(), { sx: o.head * 1.1, sy: 0.6, sz: o.head * 1.1, color }));
  const c = mesh(g);
  c.position.y = -o.head * 0.45;
  model.head.add(c);
  return c;
}
