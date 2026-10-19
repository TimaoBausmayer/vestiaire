import * as THREE from 'three';
import { BUILDINGS } from '../../shared/world-layout.js';
import { makeSign } from './signs.js';

// Génère les bâtiments (façades, fenêtres, toits, auvents, enseignes) à partir du plan partagé.

const ROT = { S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 };

function shade(hex, f) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return `#${c.getHexString()}`;
}

export function buildingFrame(b) {
  const th = ROT[b.facing];
  const cos = Math.cos(th), sin = Math.sin(th);
  const W = b.facing === 'N' || b.facing === 'S' ? b.w : b.d;
  const D = b.facing === 'N' || b.facing === 'S' ? b.d : b.w;
  const L = (lx, lz) => [b.x + lx * cos + lz * sin, b.z - lx * sin + lz * cos];
  return { th, W, D, L };
}

export function buildBuildings(sb, collision, scene) {
  for (const b of BUILDINGS) buildOne(sb, collision, scene, b);
}

function buildOne(sb, collision, scene, b) {
  const { th, W, D, L } = buildingFrame(b);
  const box = (lx, y, lz, w, h, d, color, mat) => { const [x, z] = L(lx, lz); sb.box(x, y, z, w, h, d, color, th, mat); };
  const h = b.h;
  const trim = shade(b.color, 0.75);

  // Corps + soubassement + corniche
  box(0, 0, 0, W, h, D, b.color);
  box(0, 0, 0, W + 0.3, 0.6, D + 0.3, trim);
  box(0, h - 0.4, 0, W + 0.4, 0.4, D + 0.4, shade(b.color, 0.88));
  collision.addBoxC(b.x, b.z, b.w, b.d, 0, h + (b.roof === 'gable' ? 3 : 0.6));

  // Toit
  if (b.roof === 'gable') {
    const along = W >= D; // faîte le long du côté le plus long
    const rh = Math.min(4, Math.max(W, D) * 0.25);
    const [x, z] = L(0, 0);
    if (along) sb.gable(x, h, z, W + 1.2, rh, D + 1.2, b.roofColor, th);
    else sb.gable(x, h, z, D + 1.2, rh, W + 1.2, b.roofColor, th + Math.PI / 2);
    if (b.kind === 'house') { const [cx, cz] = L(W * 0.25, -D * 0.15); sb.box(cx, h, cz, 0.9, rh + 0.8, 0.9, '#8a5a44', th); }
  } else {
    box(0, h, 0, W + 0.2, 0.25, D + 0.2, b.roofColor);
    box(0, h, D / 2 - 0.15, W + 0.2, 0.8, 0.3, shade(b.roofColor, 1.1));
    box(0, h, -D / 2 + 0.15, W + 0.2, 0.8, 0.3, shade(b.roofColor, 1.1));
    box(W / 2 - 0.15, h, 0, 0.3, 0.8, D, shade(b.roofColor, 1.1));
    box(-W / 2 + 0.15, h, 0, 0.3, 0.8, D, shade(b.roofColor, 1.1));
    // climatiseurs
    if (W > 12) { box(-W * 0.25, h + 0.25, -D * 0.2, 1.6, 1, 1.2, '#c7ccd4'); box(W * 0.2, h + 0.25, -D * 0.1, 1.2, 0.8, 1.2, '#b4bac4'); }
  }

  // Fenêtres
  const floors = b.floors || Math.max(1, Math.floor(h / 3.2));
  const fh = h / floors;
  const doorW = b.garageDoors ? 0 : 2.2;
  const winRow = (len, place) => {
    const n = Math.max(1, Math.floor((len - 1.5) / 3));
    const step = len / n;
    for (let i = 0; i < n; i++) place(-len / 2 + step * (i + 0.5));
  };
  for (let f = 0; f < (b.barn ? 0 : floors); f++) {
    const y = f * fh + fh * 0.32;
    const wh = Math.min(1.6, fh * 0.5);
    // façade avant
    if (f === 0 && (b.kind === 'shop' || b.kind === 'job' || b.id === 'cafe' || b.id === 'boulangerie' || b.id === 'arcade')) {
      // vitrines de chaque côté de la porte
      const vw = W / 2 - 2.6;
      if (!b.garageDoors) {
        box(-(W / 4 + 0.6), 0.7, D / 2 + 0.02, vw, 2.4, 0.15, '#cfe8ff', 'windows');
        box(W / 4 + 0.6, 0.7, D / 2 + 0.02, vw, 2.4, 0.15, '#cfe8ff', 'windows');
      }
    } else if (!(f === 0 && b.kind === 'house')) {
      winRow(W, (lx) => {
        if (f === 0 && Math.abs(lx) < doorW) return;
        box(lx, y, D / 2 + 0.02, 1.2, wh, 0.15, '#ffe9a8', 'windows');
        box(lx, y - 0.15, D / 2 + 0.12, 1.5, 0.15, 0.25, '#f4f1ea');
      });
    }
    if (f === 0 && b.kind === 'house') {
      box(-W * 0.3, 1.1, D / 2 + 0.02, 1.4, 1.3, 0.15, '#ffe9a8', 'windows');
      box(W * 0.3, 1.1, D / 2 + 0.02, 1.4, 1.3, 0.15, '#ffe9a8', 'windows');
      box(-W * 0.3, 0.95, D / 2 + 0.15, 1.7, 0.15, 0.3, '#f4f1ea');
      box(W * 0.3, 0.95, D / 2 + 0.15, 1.7, 0.15, 0.3, '#f4f1ea');
      // jardinières
      box(-W * 0.3, 0.7, D / 2 + 0.3, 1.5, 0.25, 0.35, '#7a4b2a');
      box(-W * 0.3, 0.95, D / 2 + 0.3, 1.3, 0.2, 0.25, '#e05780');
    }
    // côtés et arrière (on évite le rez-de-chaussée des grands bâtiments, souvent aveugle)
    if (f > 0 || b.kind === 'house' || h < 7) {
      winRow(D, (lz) => {
        box(W / 2 + 0.02, y, lz, 0.15, wh, 1.2, '#ffe9a8', 'windows');
        box(-W / 2 - 0.02, y, lz, 0.15, wh, 1.2, '#ffe9a8', 'windows');
      });
      winRow(W, (lx) => box(lx, y, -D / 2 - 0.02, 1.2, wh, 0.15, '#ffe9a8', 'windows'));
    }
    // bandeaux entre étages (immeuble) + balcons
    if (b.floors && f > 0) {
      box(0, f * fh - 0.15, 0, W + 0.15, 0.3, D + 0.15, shade(b.color, 0.85));
      winRow(W, (lx) => {
        box(lx, f * fh, D / 2 + 0.7, 2.2, 0.15, 1.4, '#e8e8e8');
        box(lx, f * fh + 0.15, D / 2 + 1.35, 2.2, 0.8, 0.08, '#ffffff', 'windows');
      });
    }
  }

  // Porte(s)
  if (b.garageDoors) {
    const n = b.garageDoors;
    for (let i = 0; i < n; i++) {
      const lx = n === 1 ? 0 : (i - (n - 1) / 2) * (W / n);
      box(lx, 0, D / 2 + 0.03, Math.min(5, W / n - 1.2), 4, 0.15, '#d9dde3');
      for (let k = 1; k < 6; k++) box(lx, k * 0.66, D / 2 + 0.1, Math.min(5, W / n - 1.2), 0.06, 0.06, '#9aa1ab');
    }
  } else {
    box(0, 0, D / 2 + 0.02, 2.2, 2.7, 0.2, '#f4f1ea');
    box(0, 0, D / 2 + 0.06, 1.7, 2.45, 0.2, b.kind === 'house' ? shade(b.roofColor, 1.2) : '#4a3328');
    box(0.55, 1.2, D / 2 + 0.2, 0.15, 0.15, 0.12, '#ffd23f');
    // marche
    box(0, 0, D / 2 + 0.6, 2.8, 0.18, 1.1, '#c9c3b6');
  }

  // Auvent rayé
  if (b.awning) {
    const aw = W - 1.5;
    const n = Math.max(4, Math.floor(aw / 1.2));
    for (let i = 0; i < n; i++) {
      const lx = -aw / 2 + (aw / n) * (i + 0.5);
      const [x, z] = L(lx, D / 2 + 0.9);
      sb.add(SHAPE_BOX(), { x, y: 3.1, z, sx: aw / n, sy: 0.12, sz: 1.9, rx: -0.35, ry: th, color: i % 2 ? b.awning : '#ffffff' });
    }
  }

  // Colonnes (banque)
  if (b.columns) {
    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue;
      const [x, z] = L(i * 2.6, D / 2 + 1.1);
      sb.cyl(x, 0, z, 0.4, h - 0.5, '#f8f3e3', 10);
      collision.addCyl(x, z, 0.45, 0, h);
    }
    box(0, h - 1.1, D / 2 + 0.7, W, 0.7, 1.6, '#f8f3e3');
  }

  // Tour de l'horloge (mairie)
  if (b.tower) {
    box(0, h, -1, 5, 6, 5, b.color);
    const [x, z] = L(0, -1);
    sb.add(SHAPE_CONE4(), { x, y: h + 6, z, sx: 5.6 * 1.414, sy: 4, sz: 5.6 * 1.414, ry: th + Math.PI / 4, color: b.roofColor });
    const [cx, cz] = L(0, 1.55);
    sb.add(SHAPE_CYL(), { x: cx, y: h + 3.3, z: cz, sx: 3, sy: 0.2, sz: 3, rx: Math.PI / 2, ry: th, color: '#ffffff' });
    // aiguilles
    const [hx, hz] = L(0, 1.72);
    sb.add(SHAPE_BOX(), { x: hx, y: h + 3.3, z: hz, sx: 0.15, sy: 1.1, sz: 0.06, ry: th, color: '#222' });
    sb.add(SHAPE_BOX(), { x: hx, y: h + 3.3, z: hz, sx: 0.8, sy: 0.12, sz: 0.06, ry: th, rz: 0.5, color: '#222' });
    // drapeau
    const [fx, fz] = L(-W / 2 + 1.5, D / 2 - 1);
    sb.cyl(fx, h, fz, 0.08, 5, '#dddddd', 6);
    box(-W / 2 + 2.3, h + 3.8, D / 2 - 1, 1.6, 1, 0.05, '#ff5a5f');
  }

  // Néons (arcade)
  if (b.neon) {
    box(0, h - 1.2, D / 2 + 0.1, W - 1, 0.15, 0.1, '#ff3fa4', 'glow');
    box(0, 3.4, D / 2 + 0.1, W - 1, 0.15, 0.1, '#29e6ff', 'glow');
    box(-W / 2 + 0.6, 0.5, D / 2 + 0.1, 0.15, h - 1.5, 0.1, '#ffe14d', 'glow');
    box(W / 2 - 0.6, 0.5, D / 2 + 0.1, 0.15, h - 1.5, 0.1, '#ffe14d', 'glow');
  }

  // Grange : croisillons blancs
  if (b.barn) {
    box(0, 0, D / 2 + 0.05, 6, 6, 0.15, '#7a1d17');
    const [x, z] = L(0, D / 2 + 0.15);
    sb.add(SHAPE_BOX(), { x, y: 0.2, z, sx: 0.35, sy: 8.2, sz: 0.1, ry: th, rz: 0.78, color: '#ffffff' });
    sb.add(SHAPE_BOX(), { x, y: 0.2, z, sx: 0.35, sy: 8.2, sz: 0.1, ry: th, rz: -0.78, color: '#ffffff' });
    box(0, 7, D / 2 + 0.05, 2.4, 2, 0.15, '#f4f1ea');
    // silo
    const [sx, sz] = L(W / 2 + 3.5, -2);
    sb.cyl(sx, 0, sz, 2.6, 13, '#c9ccd2', 14);
    sb.add(SHAPE_SPHERE(), { x: sx, y: 13, z: sz, sx: 5.2, sy: 3.2, sz: 5.2, color: '#8b95a5' });
    collision.addCyl(sx, sz, 2.7, 0, 14);
  }

  // Petit portail + boîte aux lettres + haie pour les maisons
  if (b.kind === 'house') {
    const [mx, mz] = L(1.8, D / 2 + 2.4);
    sb.cyl(mx, 0, mz, 0.06, 1.1, '#555', 6);
    sb.box(mx, 1.1, mz, 0.5, 0.4, 0.35, '#3c78d8', th);
    for (const side of [-1, 1]) {
      box(side * (W / 2 - 1.2), 0, D / 2 + 3.2, W / 2 - 1.6, 0.9, 0.7, '#3f8f3a');
    }
  }

  // Enseigne
  if (b.sign) {
    const sw = Math.min(W - 1, Math.max(6, b.sign.length * 0.62));
    const signColors = b.neon ? { bg: '#14102b', fg: '#29e6ff', border: '#ff3fa4' } : { bg: '#2b2350', fg: '#ffffff', border: '#ffd23f' };
    const sign = makeSign(b.sign, sw, 1.3, signColors);
    const sy = b.awning ? 4.3 : b.garageDoors ? 4.8 : Math.min(h - 1.2, 3.6);
    const [x, z] = L(0, D / 2 + 0.12);
    sign.position.set(x, sy + 0.65, z);
    sign.rotation.y = th;
    scene.add(sign);
  }
}

// Formes de base (import paresseux pour éviter un cycle).
import { SHAPES } from '../core/static-builder.js';
const SHAPE_BOX = () => SHAPES.box();
const SHAPE_CYL = () => SHAPES.cyl(16);
const SHAPE_CONE4 = () => SHAPES.cone(4);
const SHAPE_SPHERE = () => SHAPES.sphere(12);
