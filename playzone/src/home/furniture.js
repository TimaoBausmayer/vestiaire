import { buildMergedGeometry, SHAPES as B } from '../core/static-builder.js';

// Modèles des meubles (construits en code). fp = emprise au sol [largeur, profondeur] pour les collisions.
const DEFS = {
  canape: { fp: [2.4, 1.0], build: (sb) => { sb.box(0, 0, 0, 2.4, 0.45, 1.0, '#ff5a5f'); sb.box(0, 0.45, -0.38, 2.4, 0.6, 0.25, '#e04848'); for (const x of [-1.1, 1.1]) sb.box(x, 0.45, 0, 0.25, 0.35, 1.0, '#e04848'); for (const x of [-0.55, 0.55]) sb.box(x, 0.45, 0.05, 1.0, 0.12, 0.75, '#ff7a7f'); } },
  lit: { fp: [1.8, 2.3], build: (sb) => { sb.box(0, 0, 0, 1.8, 0.45, 2.3, '#a0703c'); sb.box(0, 0.45, 0.1, 1.7, 0.2, 2.0, '#f4f1ea'); sb.box(0, 0.62, 0.45, 1.68, 0.06, 1.3, '#3d8ee8'); sb.box(0, 0.62, -0.75, 1.2, 0.18, 0.4, '#ffffff'); sb.box(0, 0, -1.1, 1.8, 1.1, 0.12, '#7a5230'); } },
  table: { fp: [1.4, 0.9], build: (sb) => { sb.box(0, 0.38, 0, 1.4, 0.08, 0.9, '#a0703c'); for (const [x, z] of [[-0.6, -0.35], [0.6, -0.35], [-0.6, 0.35], [0.6, 0.35]]) sb.box(x, 0, z, 0.08, 0.38, 0.08, '#7a5230'); sb.cyl(0.3, 0.46, 0, 0.12, 0.12, '#ffffff', 10); } },
  chaise: { fp: [0.6, 0.6], build: (sb) => { sb.box(0, 0.45, 0, 0.55, 0.06, 0.55, '#d4a373'); for (const [x, z] of [[-0.24, -0.24], [0.24, -0.24], [-0.24, 0.24], [0.2, 0.24]]) sb.box(x, 0, z, 0.05, x > 0 && z > 0 ? 0.4 : 0.45, 0.05, '#7a5230'); sb.box(0, 0.5, -0.25, 0.55, 0.55, 0.05, '#d4a373'); } },
  lampe: { fp: [0.5, 0.5], build: (sb) => { sb.cyl(0, 0, 0, 0.18, 0.05, '#30343f', 10); sb.cyl(0, 0, 0, 0.04, 1.3, '#f4f1ea', 6); sb.add(B.hemi(12), { y: 1.25, sx: 0.8, sy: 0.6, sz: 0.8, color: '#ff5a5f' }); for (let i = 0; i < 5; i++) sb.sphere(Math.cos(i * 1.3) * 0.25, 1.45, Math.sin(i * 1.3) * 0.25, 0.05, '#ffffff', 5); }, glow: true },
  plante: { fp: [0.6, 0.6], build: (sb) => { sb.cyl(0, 0, 0, 0.25, 0.45, '#c2410c', 10); for (let i = 0; i < 6; i++) sb.add(B.sphere(6), { x: Math.cos(i) * 0.15, y: 0.75 + (i % 2) * 0.2, z: Math.sin(i) * 0.15, sx: 0.15, sy: 0.6, sz: 0.35, rx: Math.sin(i) * 0.6, rz: Math.cos(i) * 0.6, color: i % 2 ? '#3f8f3a' : '#57b04f' }); } },
  tapis: { fp: [0, 0], build: (sb) => { sb.cyl(0, 0, 0, 1.3, 0.03, '#8b5cf6', 24); sb.cyl(0, 0.01, 0, 0.9, 0.03, '#c4b5fd', 24); sb.cyl(0, 0.02, 0, 0.4, 0.03, '#8b5cf6', 24); } },
  tele: { fp: [1.6, 0.5], build: (sb) => { sb.box(0, 0, 0, 1.6, 0.5, 0.5, '#7a5230'); sb.box(0, 0.5, 0, 1.5, 0.9, 0.08, '#14141c'); sb.box(0, 0.55, 0.045, 1.38, 0.78, 0.02, '#2e9fd6'); } },
  etagere: { fp: [1.2, 0.4], build: (sb) => { sb.box(0, 0, 0, 1.2, 1.9, 0.4, '#a0703c'); const cols = ['#ff5a5f', '#2ec4b6', '#ffd23f', '#8b5cf6', '#7ac74f']; for (let r = 0; r < 4; r++) for (let i = 0; i < 6; i++) sb.box(-0.45 + i * 0.18, 0.1 + r * 0.45, 0.12, 0.13, 0.32, 0.22, cols[(r + i) % 5]); } },
  frigo: { fp: [0.8, 0.7], build: (sb) => { sb.box(0, 0, 0, 0.8, 1.9, 0.7, '#f4f1ea'); sb.box(0, 1.2, 0.36, 0.78, 0.02, 0.02, '#c7ccd4'); sb.box(0.3, 1.3, 0.37, 0.05, 0.4, 0.05, '#9aa5b1'); sb.sphere(-0.15, 1.55, 0.36, 0.06, '#ff5a5f', 6); sb.sphere(0.0, 1.6, 0.36, 0.06, '#ffd23f', 6); } },
  'nain-jardin': { fp: [0.4, 0.4], build: (sb) => { sb.cyl(0, 0, 0, 0.18, 0.4, '#3d8ee8', 10); sb.sphere(0, 0.5, 0, 0.16, '#f6cfa3', 10); sb.cone(0, 0.6, 0, 0.17, 0.4, '#e63946', 10); sb.add(B.cone(8), { y: 0.3, z: 0.1, sx: 0.25, sy: 0.3, sz: 0.15, rx: Math.PI, color: '#ffffff' }); } },
  aquarium: { fp: [1.3, 0.5], build: (sb) => { sb.box(0, 0, 0, 1.3, 0.7, 0.5, '#30343f'); sb.box(0, 0.7, 0, 1.25, 0.7, 0.45, '#7fd3f0'); sb.box(0, 0.72, 0, 1.2, 0.1, 0.4, '#e9c46a'); sb.add(B.sphere(8), { x: -0.2, y: 1.05, sx: 0.25, sy: 0.12, sz: 0.06, color: '#ff9f1c' }); sb.add(B.sphere(8), { x: 0.3, y: 0.95, sx: 0.2, sy: 0.1, sz: 0.05, color: '#ff5a5f' }); sb.box(0, 1.4, 0, 1.3, 0.06, 0.5, '#30343f'); } },
  baignoire: { fp: [1.8, 0.9], build: (sb) => { sb.box(0, 0.1, 0, 1.8, 0.6, 0.9, '#ffffff'); sb.box(0, 0.55, 0, 1.6, 0.1, 0.7, '#7fd3f0'); for (const x of [-0.7, 0.7]) sb.box(x, 0, 0, 0.12, 0.12, 0.7, '#ffd23f'); for (let i = 0; i < 3; i++) { sb.sphere(-0.4 + i * 0.4, 0.75, 0.05, 0.1, '#ffd23f', 8); sb.sphere(-0.33 + i * 0.4, 0.82, 0.05, 0.06, '#ffd23f', 6); } } },
  'boule-disco': { fp: [0.5, 0.5], build: (sb) => { sb.cyl(0, 0, 0, 0.2, 0.05, '#30343f', 10); sb.cyl(0, 0, 0, 0.03, 1.6, '#c7ccd4', 6); sb.add(B.ico1(), { y: 1.9, sx: 0.6, sy: 0.6, sz: 0.6, color: '#e5e7eb' }); }, glow: true },
  'borne-arcade': { fp: [0.8, 0.8], build: (sb) => { sb.box(0, 0, 0, 0.8, 1.8, 0.8, '#5b3fa6'); sb.box(0, 1.1, 0.35, 0.65, 0.5, 0.12, '#29e6ff'); sb.box(0, 0.85, 0.42, 0.7, 0.08, 0.3, '#2b2d42'); sb.sphere(-0.15, 0.95, 0.45, 0.05, '#ff5a5f', 6); sb.sphere(0.12, 0.95, 0.45, 0.05, '#ffd23f', 6); sb.box(0, 1.65, 0.38, 0.7, 0.15, 0.08, '#ff3fa4'); } },
  'statue-poulet': { fp: [0.8, 0.8], build: (sb) => { sb.box(0, 0, 0, 0.8, 0.5, 0.8, '#f4f1ea'); sb.add(B.sphere(10), { y: 0.95, sx: 0.55, sy: 0.55, sz: 0.75, color: '#ffd23f' }); sb.sphere(0, 1.4, 0.25, 0.22, '#ffd23f', 10); sb.box(0, 1.6, 0.25, 0.06, 0.18, 0.2, '#ff5a5f'); sb.add(B.cone(6), { y: 1.38, z: 0.48, sx: 0.12, sy: 0.15, sz: 0.1, rx: Math.PI / 2, color: '#ff9f1c' }); } },
  piano: { fp: [1.8, 1.5], build: (sb) => { sb.box(0, 0.6, 0, 1.6, 0.35, 1.4, '#14141c'); sb.box(0, 0.95, -0.55, 1.6, 0.6, 0.3, '#14141c'); for (let i = 0; i < 14; i++) sb.box(-0.7 + i * 0.108, 0.92, 0.62, 0.09, 0.04, 0.2, '#ffffff'); for (const [x, z] of [[-0.7, -0.6], [0.7, -0.6], [0, 0.55]]) sb.box(x, 0, z, 0.08, 0.6, 0.08, '#14141c'); } },
  trone: { fp: [1.2, 1.0], build: (sb) => { sb.box(0, 0, 0, 1.2, 0.5, 1.0, '#ffd23f'); sb.box(0, 0.5, -0.4, 1.2, 1.6, 0.2, '#ffd23f'); sb.box(0, 0.45, 0.05, 1.0, 0.15, 0.85, '#c0392b'); sb.box(0, 0.6, -0.28, 0.9, 1.1, 0.06, '#c0392b'); for (const x of [-0.6, 0.6]) sb.sphere(x, 2.15, -0.4, 0.12, '#e63946', 8); } },
  'citrouille-deco': { fp: [0.6, 0.6], build: (sb) => { sb.add(B.sphere(12), { y: 0.3, sx: 0.7, sy: 0.55, sz: 0.65, color: '#ff8c1a' }); sb.cyl(0, 0.55, 0, 0.05, 0.15, '#3f8f3a', 6); for (const x of [-0.12, 0.12]) sb.box(x, 0.36, 0.31, 0.1, 0.08, 0.04, '#ffe14d'); sb.box(0, 0.2, 0.32, 0.3, 0.05, 0.04, '#ffe14d'); }, glow: true },
  cercueil: { fp: [2.2, 0.9], build: (sb) => { sb.box(0, 0, 0, 2.2, 0.5, 0.9, '#3a2a1e'); sb.box(0, 0.5, 0, 2.0, 0.12, 0.8, '#8b0000'); sb.box(0, 0.5, -0.38, 2.2, 0.55, 0.15, '#3a2a1e'); sb.box(-0.6, 0.62, 0, 0.4, 0.06, 0.06, '#c7ccd4'); } },
};

const cache = new Map();
export function furnitureGeometry(id) {
  if (!cache.has(id)) cache.set(id, buildMergedGeometry(DEFS[id]?.build || ((sb) => sb.box(0, 0, 0, 0.6, 0.6, 0.6, '#cccccc'))));
  return cache.get(id);
}
export function furnitureFootprint(id, r) {
  const fp = DEFS[id]?.fp || [0.6, 0.6];
  return r % 2 ? [fp[1], fp[0]] : fp;
}
export const FURNITURE_IDS = Object.keys(DEFS);
