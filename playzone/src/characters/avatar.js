import * as THREE from 'three';
import { buildMergedGeometry, SHAPES } from '../core/static-builder.js';
import { actorMaterial } from '../core/materials.js';
import { DEFAULT_APPEARANCE } from '../../shared/appearance.js';

// Personnage stylisé construit en code : 6 maillages (tronc, tête, 2 bras, 2 jambes) articulés,
// couleurs dans les sommets (1 seul matériau), animations procédurales.

const BODY_W = { mince: 0.88, moyen: 1, costaud: 1.22 };
const B = SHAPES;

function darker(hex, f = 0.75) { const c = new THREE.Color(hex); c.multiplyScalar(f); return `#${c.getHexString()}`; }

// ---------- Tronc (pivot aux hanches, y = 0.85)
function buildTorso(sb, a, w, extra) {
  const top = extra.top || a.top;
  const tc = top === 'torse' ? a.skin : extra.topColor || a.topColor;
  const skinArms = top === 'debardeur' || top === 'torse';
  // bassin (couleur du bas)
  sb.add(B.sphere(12), { y: 0.06, sx: 0.5 * w, sy: 0.28, sz: 0.36, color: a.bottomColor });
  if (a.bottom === 'jupe') sb.add(B.cone(12), { y: -0.32, sx: 0.78 * w, sy: 0.5, sz: 0.62, rx: Math.PI, color: a.bottomColor });
  // buste
  sb.add(B.cyl(18), { y: 0.06, sx: 0.54 * w, sy: 0.42, sz: 0.38, color: tc });
  sb.add(B.sphere(18), { y: 0.48, sx: 0.62 * w, sy: 0.3, sz: 0.4, color: tc });
  sb.add(B.cyl(12), { y: 0.04, sx: 0.55 * w, sy: 0.07, sz: 0.39, color: '#2b2d42' }); // ceinture
  sb.add(B.box(), { y: 0.045, z: 0.19, sx: 0.08, sy: 0.06, sz: 0.03, color: '#ffd23f' });
  sb.add(B.cyl(12), { y: 0.55, sx: 0.16, sy: 0.12, sz: 0.16, color: a.skin }); // cou
  if (top === 'tshirt' || top === 'sweat' || top === 'debardeur') sb.add(B.cyl(14), { y: 0.6, sx: 0.22, sy: 0.035, sz: 0.2, color: darker(tc, 0.8) });   // col
  if (top !== 'torse') sb.add(B.cyl(14), { y: 0.13, sx: 0.555 * w, sy: 0.03, sz: 0.385, color: darker(tc, 0.88) });   // ourlet du haut
  if (top === 'debardeur') { sb.add(B.box(), { y: 0.5, x: 0.17 * w, z: 0.01, sx: 0.08, sy: 0.12, sz: 0.36, color: tc }); }
  if (top === 'sweat') {
    sb.add(B.sphere(10), { y: 0.56, z: -0.16, sx: 0.36, sy: 0.22, sz: 0.2, color: darker(tc, 0.85) }); // capuche
    sb.add(B.box(), { y: 0.14, z: 0.19, sx: 0.32 * w, sy: 0.14, sz: 0.02, color: darker(tc, 0.85) });
  }
  if (top === 'chemise' || top === 'hawai') {
    sb.add(B.box(), { y: 0.56, z: 0.12, x: -0.06, sx: 0.12, sy: 0.08, sz: 0.06, rz: 0.5, color: '#ffffff' });
    sb.add(B.box(), { y: 0.56, z: 0.12, x: 0.06, sx: 0.12, sy: 0.08, sz: 0.06, rz: -0.5, color: '#ffffff' });
    for (let i = 0; i < 3; i++) sb.add(B.sphere(5), { y: 0.42 - i * 0.12, z: 0.2, sx: 0.035, sy: 0.035, sz: 0.02, color: '#ffffff' });
  }
  if (top === 'hawai') {
    const cols = ['#ffd23f', '#ff5a5f', '#ffffff', '#7ac74f'];
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2 + 0.3, yy = 0.12 + ((i * 37) % 10) / 24;
      sb.add(B.sphere(5), { x: Math.sin(ang) * 0.27 * w, y: yy, z: Math.cos(ang) * 0.19, sx: 0.07, sy: 0.07, sz: 0.04, color: cols[i % 4] });
    }
  }
  if (top === 'raye') for (let i = 0; i < 4; i++) sb.add(B.cyl(14), { y: 0.1 + i * 0.1, sx: 0.555 * w, sy: 0.035, sz: 0.385, color: '#ffffff' });
  if (top === 'costume') {
    sb.add(B.box(), { y: 0.2, z: 0.19, sx: 0.06, sy: 0.32, sz: 0.02, color: '#c0392b' }); // cravate
    sb.add(B.box(), { y: 0.48, z: 0.19, sx: 0.14, sy: 0.12, sz: 0.02, color: '#ffffff' });
  }
  if (top === 'veste-luxe') {
    for (const sx of [-1, 1]) sb.add(B.box(), { x: sx * 0.09, y: 0.36, z: 0.2, sx: 0.1, sy: 0.34, sz: 0.02, rz: sx * 0.25, color: '#fca311' });
    for (let i = 0; i < 2; i++) sb.add(B.sphere(5), { y: 0.22 - i * 0.12, z: 0.21, x: 0.04, sx: 0.04, sy: 0.04, sz: 0.02, color: '#fca311' });
    sb.add(B.box(), { y: 0.5, z: 0.18, sx: 0.12, sy: 0.12, sz: 0.02, color: '#ffffff' });
  }
  if (top === 'torse') {
    const m = extra.strong || 0;
    if (m > 0.3) for (const sx of [-1, 1]) sb.add(B.sphere(10), { x: sx * 0.12 * w, y: 0.4, z: 0.15, sx: 0.24 * w, sy: 0.16, sz: 0.1 + m * 0.06, color: darker(a.skin, 0.93) }); // pectoraux
    if (m > 0.55) for (let r = 0; r < 3; r++) for (const sx of [-1, 1]) sb.add(B.sphere(6), { x: sx * 0.055, y: 0.24 - r * 0.075, z: 0.18, sx: 0.08, sy: 0.06, sz: 0.04, color: darker(a.skin, 0.9) }); // abdos
    sb.add(B.box(), { y: 0.04, sx: 0.4 * w, sy: 0.05, sz: 0.39, color: '#2b2d42' });
  }
  if (top === 'tablier') {
    sb.add(B.box(), { y: -0.25, z: 0.2, sx: 0.46 * w, sy: 0.75, sz: 0.03, color: '#ffffff' });
    sb.add(B.box(), { y: 0.3, z: 0.18, sx: 0.04, sy: 0.4, sz: 0.02, x: 0.12, color: '#eeeeee' });
    sb.add(B.box(), { y: 0.3, z: 0.18, sx: 0.04, sy: 0.4, sz: 0.02, x: -0.12, color: '#eeeeee' });
  }
  if (top === 'uniforme-pompier') {
    for (const yy of [0.12, 0.34]) sb.add(B.cyl(14), { y: yy, sx: 0.56 * w, sy: 0.05, sz: 0.395, color: '#ffe14d' });
  }
  if (top === 'gilet-livreur') {
    sb.add(B.box(), { y: 0.28, z: 0.19, sx: 0.4 * w, sy: 0.1, sz: 0.02, color: '#2d3a8c' });
  }
  // dos
  const back = extra.back || a.back;
  if (back === 'sac-a-dos' || back === 'sac-livreur') {
    const col = back === 'sac-livreur' ? '#ffd23f' : '#3d8ee8';
    sb.add(B.box(), { y: 0.12, z: -0.3, sx: 0.42, sy: 0.46, sz: 0.24, color: col });
    sb.add(B.box(), { y: 0.14, z: -0.42, sx: 0.32, sy: 0.22, sz: 0.06, color: darker(col) });
  }
  if (back === 'cape') sb.add(B.box(), { y: -0.55, z: -0.22, sx: 0.62 * w, sy: 1.1, sz: 0.04, rx: 0.12, color: '#c0392b' });
  if (back === 'ailes') {
    for (const s of [-1, 1]) sb.add(B.sphere(8), { x: s * 0.35, y: 0.35, z: -0.28, sx: 0.12, sy: 0.6, sz: 0.4, rz: s * -0.6, color: '#ffffff' });
  }
  if (back === 'bouee') sb.add(B.ring(), { y: 0.0, sx: 1.05 * w, sy: 1.0, sz: 0.85, color: '#ffd23f' });
  if (back === 'guitare') {
    sb.add(B.sphere(10), { y: 0.0, z: -0.3, sx: 0.4, sy: 0.45, sz: 0.12, rz: 0.4, color: '#b5562d' });
    sb.add(B.box(), { y: 0.35, z: -0.3, x: 0.15, sx: 0.06, sy: 0.6, sz: 0.05, rz: 0.4, color: '#5b3a1e' });
  }
  if (back === 'echarpe') sb.add(B.ring(), { y: 0.58, sx: 0.4, sy: 0.6, sz: 0.4, color: '#ff5a5f' });
  if (back === 'sac-luxe') { sb.add(B.box(), { x: 0.3 * w, y: -0.2, z: 0.02, sx: 0.12, sy: 0.3, sz: 0.34, color: '#7f5539' }); sb.add(B.box(), { x: 0.3 * w, y: -0.12, z: 0.2, sx: 0.13, sy: 0.05, sz: 0.02, color: '#fca311' }); sb.add(B.ring(), { x: 0.22 * w, y: 0.22, rz: 0.4, sx: 0.16, sy: 0.7, sz: 0.16, color: '#7f5539' }); }
  if (back === 'cape-vampire') sb.add(B.box(), { y: -0.55, z: -0.22, sx: 0.66 * w, sy: 1.1, sz: 0.04, rx: 0.12, color: '#1d1029' });
}

// ---------- Tête (pivot au cou, y = 1.43)
function buildHead(sb, a, extra) {
  const s = a.skin;
  sb.add(B.sphere(24), { y: 0.3, sx: 0.58, sy: 0.6, sz: 0.56, color: s });
  sb.add(B.sphere(12), { y: 0.13, z: 0.04, sx: 0.46, sy: 0.3, sz: 0.46, color: s });   // mâchoire arrondie
  for (const sx of [-1, 1]) {
    sb.add(B.sphere(12), { x: sx * 0.29, y: 0.29, sx: 0.09, sy: 0.14, sz: 0.08, color: s });
    sb.add(B.sphere(8), { x: sx * 0.31, y: 0.29, z: 0.01, sx: 0.04, sy: 0.08, sz: 0.04, color: darker(s, 0.82) });   // creux de l'oreille
  }
  // yeux
  const ey = 0.33, ez = 0.245;
  for (const sx of [-0.1, 0.1]) {
    if (a.eyes === 'joyeux') {
      sb.add(B.box(), { x: sx - 0.025, y: ey, z: ez + 0.02, sx: 0.07, sy: 0.022, sz: 0.02, rz: 0.6, color: '#1b1b24' });
      sb.add(B.box(), { x: sx + 0.025, y: ey, z: ez + 0.02, sx: 0.07, sy: 0.022, sz: 0.02, rz: -0.6, color: '#1b1b24' });
    } else {
      sb.add(B.sphere(14), { x: sx, y: ey, z: ez, sx: 0.12, sy: a.eyes === 'endormi' ? 0.06 : 0.13, sz: 0.06, color: '#ffffff' });
      // iris coloré + pupille + reflet de lumière
      sb.add(B.sphere(12), { x: sx * 1.05, y: ey - (a.eyes === 'endormi' ? 0.005 : 0), z: ez + 0.024, sx: 0.075, sy: a.eyes === 'endormi' ? 0.04 : 0.085, sz: 0.03, color: a.eyeColor || '#5b3a1e' });
      sb.add(B.sphere(10), { x: sx * 1.05, y: ey - (a.eyes === 'endormi' ? 0.005 : 0), z: ez + 0.034, sx: 0.04, sy: a.eyes === 'endormi' ? 0.025 : 0.05, sz: 0.024, color: '#0e0e14' });
      if (a.eyes !== 'endormi') sb.add(B.sphere(6), { x: sx * 1.05 + 0.018, y: ey + 0.022, z: ez + 0.046, sx: 0.018, sy: 0.018, sz: 0.01, color: '#ffffff' });
      sb.add(B.hemi(10), { x: sx, y: ey + 0.012, z: ez - 0.005, sx: 0.125, sy: 0.07, sz: 0.065, rx: -0.15, color: darker(s, 0.95) });   // paupière
      if (a.eyes === 'endormi') sb.add(B.box(), { x: sx, y: ey + 0.03, z: ez + 0.02, sx: 0.13, sy: 0.04, sz: 0.03, color: s });
    }
    if (a.eyes === 'serieux') sb.add(B.box(), { x: sx, y: ey + 0.1, z: ez + 0.02, sx: 0.12, sy: 0.03, sz: 0.02, rz: sx > 0 ? 0.25 : -0.25, color: darker(a.hairColor, 0.8) });
    else sb.add(B.box(), { x: sx, y: ey + 0.11, z: ez + 0.0, sx: 0.1, sy: 0.022, sz: 0.02, rz: sx > 0 ? -0.15 : 0.15, color: darker(a.hairColor, 0.8) });
  }
  sb.add(B.sphere(8), { y: 0.26, z: 0.29, sx: 0.07, sy: 0.07, sz: 0.07, color: darker(s, 0.92) }); // nez
  // bouche : sourire arrondi (petits segments en arc) et lèvre inférieure
  for (let i = 0; i < 9; i++) { const t = (i - 4) / 4; sb.add(B.sphere(8), { x: t * 0.07, y: 0.17 + t * t * 0.02, z: 0.263 - t * t * 0.012, sx: 0.034, sy: 0.02, sz: 0.018, color: '#7a2e2e' }); }
  sb.add(B.sphere(6), { x: -0.17, y: 0.22, z: 0.22, sx: 0.08, sy: 0.04, sz: 0.03, color: '#ff9aa2' });
  sb.add(B.sphere(6), { x: 0.17, y: 0.22, z: 0.22, sx: 0.08, sy: 0.04, sz: 0.03, color: '#ff9aa2' });

  const hat = extra.hat !== undefined ? extra.hat : a.hat;
  const hc = a.hairColor;
  const hairUnderHat = !!hat && !['couronne', 'hélice', 'oreilles-lapin', 'bandeau'].includes(hat);
  // calotte de cheveux légèrement plus grande que le crâne, inclinée vers l'arrière
  const cap = (sx, sy, sz, rx) => sb.add(B.hemi(14), { y: 0.3, sx, sy, sz, rx, color: hc });
  switch (a.hair) {
    case 'court':
      cap(0.63, 0.66, 0.62, -0.3);
      if (!hairUnderHat) for (let i = 0; i < 6; i++) sb.add(B.sphere(8), { x: -0.18 + i * 0.072, y: 0.53 - Math.abs(i - 2.5) * 0.01, z: 0.17, sx: 0.1, sy: 0.06, sz: 0.09, rx: 0.5, color: hc });   // petite frange
      break;
    case 'meche':
      cap(0.63, 0.68, 0.62, -0.25);
      if (!hairUnderHat) sb.add(B.sphere(8), { x: 0.1, y: 0.52, z: 0.22, sx: 0.32, sy: 0.12, sz: 0.18, rz: -0.4, color: hc });
      break;
    case 'herisse':
      cap(0.62, 0.64, 0.61, -0.25);
      if (!hairUnderHat) for (let i = 0; i < 7; i++) { const ang = (i / 7) * Math.PI * 2; sb.add(B.cone(5), { x: Math.cos(ang) * 0.14, y: 0.54, z: Math.sin(ang) * 0.14 - 0.03, sx: 0.14, sy: 0.25, sz: 0.14, rx: Math.sin(ang) * 0.5, rz: -Math.cos(ang) * 0.5, color: hc }); }
      break;
    case 'long':
      cap(0.64, 0.68, 0.63, -0.2);
      sb.add(B.box(), { y: -0.05, z: -0.15, sx: 0.58, sy: 0.55, sz: 0.25, color: hc });
      break;
    case 'chignon':
      cap(0.63, 0.66, 0.62, -0.25);
      if (!hairUnderHat) sb.add(B.sphere(10), { y: 0.66, z: -0.08, sx: 0.26, sy: 0.24, sz: 0.26, color: hc });
      break;
    case 'afro': if (!hairUnderHat) { sb.add(B.ico1(), { y: 0.5, z: -0.13, sx: 0.84, sy: 0.74, sz: 0.72, color: hc }); cap(0.64, 0.7, 0.62, -0.35); } else cap(0.66, 0.66, 0.64, -0.2); break;
    case 'crete':
      if (!hairUnderHat) for (let i = 0; i < 5; i++) sb.add(B.box(), { y: 0.52 + Math.sin((i / 4) * Math.PI) * 0.06, z: 0.2 - i * 0.11, sx: 0.08, sy: 0.22, sz: 0.1, color: hc });
      break;
    case 'couettes':
      cap(0.63, 0.66, 0.62, -0.25);
      sb.add(B.sphere(8), { x: -0.33, y: 0.28, z: -0.05, sx: 0.18, sy: 0.3, sz: 0.18, color: hc });
      sb.add(B.sphere(8), { x: 0.33, y: 0.28, z: -0.05, sx: 0.18, sy: 0.3, sz: 0.18, color: hc });
      break;
    default: break;
  }

  // chapeaux
  switch (hat) {
    case 'casquette': case 'casquette-livreur': {
      const c = hat === 'casquette-livreur' ? '#ffd23f' : '#ff5a5f';
      sb.add(B.hemi(14), { y: 0.42, sx: 0.64, sy: 0.5, sz: 0.63, color: c });
      sb.add(B.box(), { y: 0.43, z: 0.33, sx: 0.4, sy: 0.04, sz: 0.24, rx: -0.12, color: darker(c) });
      if (hat === 'casquette-livreur') sb.add(B.box(), { y: 0.5, z: 0.31, sx: 0.14, sy: 0.09, sz: 0.02, rx: -0.4, color: '#2d3a8c' });
      break;
    }
    case 'bonnet': sb.add(B.hemi(14), { y: 0.33, sx: 0.67, sy: 0.74, sz: 0.65, color: '#2ec4b6' }); sb.add(B.cyl(14), { y: 0.3, sx: 0.68, sy: 0.12, sz: 0.66, color: '#25a99c' }); sb.add(B.sphere(8), { y: 0.72, sx: 0.14, sy: 0.14, sz: 0.14, color: '#ffffff' }); break;
    case 'haut-de-forme': sb.add(B.cyl(14), { y: 0.5, sx: 0.7, sy: 0.04, sz: 0.7, color: '#1b1b24' }); sb.add(B.cyl(14), { y: 0.5, sx: 0.44, sy: 0.45, sz: 0.44, color: '#1b1b24' }); sb.add(B.cyl(14), { y: 0.56, sx: 0.45, sy: 0.07, sz: 0.45, color: '#c0392b' }); break;
    case 'cowboy': sb.add(B.cyl(16), { y: 0.5, sx: 0.95, sy: 0.04, sz: 0.85, color: '#a0703c' }); sb.add(B.sphere(12), { y: 0.55, sx: 0.48, sy: 0.36, sz: 0.46, color: '#a0703c' }); sb.add(B.cyl(14), { y: 0.53, sx: 0.49, sy: 0.05, sz: 0.47, color: '#3a2a1e' }); break;
    case 'couronne':
      sb.add(B.cyl(10), { y: 0.56, sx: 0.42, sy: 0.12, sz: 0.42, color: '#ffd23f' });
      for (let i = 0; i < 5; i++) { const ang = (i / 5) * Math.PI * 2; sb.add(B.cone(4), { x: Math.cos(ang) * 0.19, y: 0.68, z: Math.sin(ang) * 0.19, sx: 0.08, sy: 0.12, sz: 0.08, color: '#ffd23f' }); }
      sb.add(B.sphere(6), { y: 0.62, z: 0.21, sx: 0.06, sy: 0.06, sz: 0.04, color: '#e63946' });
      break;
    case 'casque-pompier':
      sb.add(B.hemi(14), { y: 0.36, sx: 0.68, sy: 0.7, sz: 0.66, color: '#d62828' });
      sb.add(B.cyl(16), { y: 0.36, sx: 0.8, sy: 0.04, sz: 0.88, color: '#b0231f' });
      sb.add(B.box(), { y: 0.5, z: 0.32, sx: 0.16, sy: 0.18, sz: 0.04, rx: -0.3, color: '#ffd23f' });
      break;
    case 'casque-moto':
      sb.add(B.sphere(14), { y: 0.36, sx: 0.74, sy: 0.74, sz: 0.74, color: '#e63946' });
      sb.add(B.box(), { y: 0.3, z: 0.3, sx: 0.5, sy: 0.18, sz: 0.06, color: '#14141c' });
      sb.add(B.box(), { y: 0.62, sx: 0.1, sy: 0.06, sz: 0.6, color: '#ffffff' });
      break;
    case 'toque': sb.add(B.cyl(12), { y: 0.48, sx: 0.5, sy: 0.22, sz: 0.5, color: '#ffffff' }); sb.add(B.blob ? B.ico1() : B.sphere(10), { y: 0.82, sx: 0.62, sy: 0.38, sz: 0.62, color: '#ffffff' }); break;
    case 'paille': sb.add(B.cyl(16), { y: 0.5, sx: 1.0, sy: 0.04, sz: 1.0, color: '#e9c46a' }); sb.add(B.cyl(14), { y: 0.5, sx: 0.48, sy: 0.22, sz: 0.48, color: '#e9c46a' }); sb.add(B.cyl(14), { y: 0.52, sx: 0.49, sy: 0.06, sz: 0.49, color: '#e63946' }); break;
    case 'sombrero': sb.add(B.cyl(18), { y: 0.5, sx: 1.4, sy: 0.05, sz: 1.4, color: '#e9c46a' }); sb.add(B.cone(14), { y: 0.5, sx: 0.5, sy: 0.5, sz: 0.5, color: '#e9c46a' }); sb.add(B.cyl(18), { y: 0.53, sx: 1.2, sy: 0.04, sz: 1.2, color: '#2ec4b6' }); break;
    case 'hélice':
      sb.add(B.hemi(14), { y: 0.36, sx: 0.65, sy: 0.6, sz: 0.64, color: '#3d8ee8' });
      sb.add(B.cyl(6), { y: 0.62, sx: 0.04, sy: 0.1, sz: 0.04, color: '#ffd23f' });
      sb.add(B.box(), { y: 0.72, sx: 0.6, sy: 0.02, sz: 0.08, color: '#ff5a5f' });
      sb.add(B.box(), { y: 0.72, sx: 0.08, sy: 0.02, sz: 0.6, color: '#7ac74f' });
      break;
    case 'oreilles-lapin':
      sb.add(B.box(), { y: 0.55, sx: 0.5, sy: 0.04, sz: 0.06, color: '#ffffff' });
      for (const s of [-1, 1]) { sb.add(B.sphere(8), { x: s * 0.13, y: 0.78, sx: 0.12, sy: 0.4, sz: 0.06, rz: s * -0.2, color: '#ffffff' }); sb.add(B.sphere(8), { x: s * 0.13, y: 0.78, z: 0.02, sx: 0.06, sy: 0.3, sz: 0.04, rz: s * -0.2, color: '#ffb3c6' }); }
      break;
    case 'bandeau': sb.add(B.cyl(14), { y: 0.42, sx: 0.62, sy: 0.08, sz: 0.6, color: '#ff5a5f' }); break;
    case 'chapeau-luxe': sb.add(B.cyl(16), { y: 0.5, sx: 0.86, sy: 0.04, sz: 0.8, color: '#22223b' }); sb.add(B.cyl(14), { y: 0.5, sx: 0.5, sy: 0.32, sz: 0.48, color: '#22223b' }); sb.add(B.cyl(14), { y: 0.55, sx: 0.51, sy: 0.06, sz: 0.49, color: '#fca311' }); break;
    case 'citrouille':
      sb.add(B.sphere(12), { y: 0.55, sx: 0.85, sy: 0.65, sz: 0.8, color: '#ff8c1a' });
      sb.add(B.cyl(6), { y: 0.86, sx: 0.08, sy: 0.15, sz: 0.08, color: '#3f8f3a' });
      sb.add(B.box(), { x: -0.14, y: 0.6, z: 0.38, sx: 0.1, sy: 0.08, sz: 0.04, color: '#1b1b24' });
      sb.add(B.box(), { x: 0.14, y: 0.6, z: 0.38, sx: 0.1, sy: 0.08, sz: 0.04, color: '#1b1b24' });
      break;
    case 'sorciere':
      sb.add(B.cyl(16), { y: 0.48, sx: 1.0, sy: 0.04, sz: 1.0, color: '#2a1840' });
      sb.add(B.cone(12), { y: 0.48, sx: 0.5, sy: 0.75, sz: 0.5, rx: -0.15, color: '#2a1840' });
      sb.add(B.cyl(14), { y: 0.5, sx: 0.51, sy: 0.07, sz: 0.51, color: '#7ac74f' });
      break;
    default: break;
  }

  const glasses = extra.glasses !== undefined ? extra.glasses : a.glasses;
  switch (glasses) {
    case 'lunettes-rondes':
      for (const sx of [-0.1, 0.1]) sb.add(B.torus(), { x: sx, y: 0.33, z: 0.29, sx: 0.2, sy: 0.2, sz: 0.2, color: '#1b1b24' });
      sb.add(B.box(), { y: 0.34, z: 0.29, sx: 0.06, sy: 0.015, sz: 0.015, color: '#1b1b24' });
      break;
    case 'lunettes-soleil':
      for (const sx of [-0.1, 0.1]) sb.add(B.box(), { x: sx, y: 0.33, z: 0.29, sx: 0.16, sy: 0.09, sz: 0.03, color: '#14141c' });
      sb.add(B.box(), { y: 0.36, z: 0.29, sx: 0.4, sy: 0.02, sz: 0.02, color: '#14141c' });
      break;
    case 'lunettes-coeur':
      for (const sx of [-0.1, 0.1]) { sb.add(B.sphere(8), { x: sx - 0.025, y: 0.34, z: 0.29, sx: 0.08, sy: 0.08, sz: 0.03, color: '#ff3f7f' }); sb.add(B.sphere(8), { x: sx + 0.025, y: 0.34, z: 0.29, sx: 0.08, sy: 0.08, sz: 0.03, color: '#ff3f7f' }); sb.add(B.cone(4), { x: sx, y: 0.32, z: 0.29, sx: 0.12, sy: 0.07, sz: 0.03, rx: Math.PI, color: '#ff3f7f' }); }
      break;
    case 'lunettes-luxe':
      for (const sx of [-1, 1]) sb.add(B.box(), { x: sx * 0.12, y: 0.3, z: 0.29, sx: 0.2, sy: 0.11, sz: 0.03, color: '#111111' });
      sb.add(B.box(), { y: 0.33, z: 0.29, sx: 0.46, sy: 0.025, sz: 0.03, color: '#fca311' });
      break;
    case 'monocle': sb.add(B.torus(), { x: 0.1, y: 0.33, z: 0.29, sx: 0.2, sy: 0.2, sz: 0.2, color: '#ffd23f' }); sb.add(B.box(), { x: 0.17, y: 0.15, z: 0.27, sx: 0.01, sy: 0.3, sz: 0.01, color: '#ffd23f' }); break;
    case 'masque-plongee':
      sb.add(B.box(), { y: 0.33, z: 0.28, sx: 0.36, sy: 0.16, sz: 0.06, color: '#2ec4b6' });
      sb.add(B.box(), { y: 0.33, z: 0.31, sx: 0.3, sy: 0.11, sz: 0.02, color: '#bfefff' });
      sb.add(B.cyl(6), { x: 0.25, y: 0.35, z: 0.15, sx: 0.05, sy: 0.4, sz: 0.05, color: '#ffd23f' });
      break;
    case 'moustache': sb.add(B.sphere(8), { x: -0.06, y: 0.21, z: 0.28, sx: 0.13, sy: 0.05, sz: 0.04, rz: 0.2, color: '#3a2a1e' }); sb.add(B.sphere(8), { x: 0.06, y: 0.21, z: 0.28, sx: 0.13, sy: 0.05, sz: 0.04, rz: -0.2, color: '#3a2a1e' }); break;
    default: break;
  }
}

// ---------- Bras (pivot à l'épaule)
function buildArm(sb, a, extra) {
  const top = extra.top || a.top;
  const tc = extra.topColor || a.topColor;
  const long = ['sweat', 'chemise', 'costume', 'uniforme-pompier', 'raye', 'veste-luxe'].includes(top);
  const bare = top === 'debardeur' || top === 'torse';
  const m = 1 + (extra.strong || 0) * 0.45 + Math.max(0, extra.fat || 0) * 0.3;
  sb.add(B.sphere(12), { y: -0.02, sx: 0.21 * m, sy: 0.21, sz: 0.21 * m, color: bare ? a.skin : tc });   // épaule
  sb.add(B.cyl(12), { y: -0.3, sx: 0.17 * m, sy: 0.3, sz: 0.17 * m, color: bare ? a.skin : tc });
  if (!bare && !long) sb.add(B.cyl(12), { y: -0.17, sx: 0.185 * m, sy: 0.05, sz: 0.185 * m, color: darker(tc, 0.85) });   // ourlet de manche courte
  sb.add(B.sphere(10), { y: -0.44, sx: 0.155 * m, sy: 0.12, sz: 0.155 * m, color: long ? tc : a.skin });   // coude
  sb.add(B.cyl(12), { y: -0.56, sx: 0.145 * m, sy: 0.24, sz: 0.145 * m, color: long ? tc : a.skin });
  if (long) sb.add(B.cyl(12), { y: -0.66, sx: 0.155 * m, sy: 0.05, sz: 0.155 * m, color: darker(tc, 0.82) });   // poignet de manche
  if (top === 'uniforme-pompier') sb.add(B.cyl(8), { y: -0.45, sx: 0.16, sy: 0.04, sz: 0.16, color: '#ffe14d' });
  // main + pouce
  sb.add(B.sphere(12), { y: -0.73, sx: 0.15, sy: 0.17, sz: 0.12, color: a.skin });
  sb.add(B.sphere(8), { y: -0.7, z: 0.07, x: 0.02, sx: 0.06, sy: 0.09, sz: 0.06, rx: 0.4, color: a.skin });
}

// ---------- Jambe (pivot à la hanche)
function buildLeg(sb, a) {
  const short = a.bottom === 'short';
  const skirt = a.bottom === 'jupe';
  sb.add(B.cyl(12), { y: -0.42, sx: 0.23, sy: 0.42, sz: 0.23, color: skirt ? a.skin : a.bottomColor });
  sb.add(B.sphere(10), { y: -0.6, z: 0.01, sx: 0.2, sy: 0.12, sz: 0.2, color: short || skirt ? a.skin : a.bottomColor });   // genou
  sb.add(B.cyl(12), { y: -0.76, sx: 0.19, sy: 0.36, sz: 0.19, color: short || skirt ? a.skin : a.bottomColor });
  if (short) sb.add(B.cyl(12), { y: -0.6, sx: 0.235, sy: 0.04, sz: 0.235, color: darker(a.bottomColor, 0.85) });   // ourlet du short
  if (!skirt && a.bottom === 'jean') { sb.add(B.box(), { x: 0.115, y: -0.45, sx: 0.006, sy: 0.6, sz: 0.04, color: darker(a.bottomColor, 0.8) }); sb.add(B.box(), { y: -0.2, z: -0.11, sx: 0.12, sy: 0.12, sz: 0.01, color: darker(a.bottomColor, 0.85) }); }   // couture + poche
  const f = a.feet;
  if (f === 'bottes-cuir' || f === 'bottes-pluie') {
    const c = f === 'bottes-pluie' ? '#ffd23f' : '#5c3d2e';
    sb.add(B.cyl(8), { y: -0.74, sx: 0.21, sy: 0.24, sz: 0.21, color: c });
    sb.add(B.box(), { y: -0.86, z: 0.06, sx: 0.22, sy: 0.12, sz: 0.36, color: c });
  } else if (f === 'mocassins-cuir') {
    sb.add(B.box(), { y: -0.87, z: 0.06, sx: 0.2, sy: 0.09, sz: 0.34, color: '#6f1d1b' }); sb.add(B.box(), { y: -0.82, z: 0.16, sx: 0.12, sy: 0.02, sz: 0.06, color: '#fca311' });
  } else if (f === 'talons-or') {
    sb.add(B.box(), { y: -0.84, z: 0.08, sx: 0.18, sy: 0.08, sz: 0.3, rx: 0.25, color: '#fca311' }); sb.add(B.cyl(6), { y: -0.9, z: -0.08, sx: 0.04, sy: 0.12, sz: 0.04, color: '#fca311' });
  } else if (f === 'tongs') {
    sb.add(B.box(), { y: -0.9, z: 0.05, sx: 0.22, sy: 0.03, sz: 0.34, color: '#2ec4b6' }); sb.add(B.box(), { y: -0.86, z: 0.1, sx: 0.03, sy: 0.05, sz: 0.1, color: '#2ec4b6' }); sb.add(B.box(), { y: -0.86, z: 0.05, sx: 0.18, sy: 0.05, sz: 0.25, color: a.skin });
  } else {
    // baskets (couleur au choix), version luxe : blanches et dorées, ou blanches
    const lux = f === 'baskets-luxe', white = f === 'baskets-blanches';
    const sc = lux || white ? '#f8f9fa' : a.shoes;
    sb.add(B.sphere(12), { y: -0.84, z: 0.08, sx: 0.23, sy: 0.15, sz: 0.38, color: sc });                  // chaussure arrondie
    sb.add(B.box(), { y: -0.905, z: 0.06, sx: 0.24, sy: 0.04, sz: 0.38, color: lux ? '#fca311' : '#f4f1ea' });   // semelle
    for (let i = 0; i < 3; i++) sb.add(B.box(), { y: -0.775 + i * 0.012, z: 0.13 + i * 0.035, sx: 0.1, sy: 0.012, sz: 0.012, color: lux || white ? '#d0d4da' : '#ffffff' });   // lacets
    if (lux) sb.add(B.box(), { x: 0.115, y: -0.83, z: 0.02, sx: 0.01, sy: 0.05, sz: 0.16, color: '#fca311' });
  }
}

export class Avatar {
  constructor(appearance = DEFAULT_APPEARANCE, extra = {}) {
    this.root = new THREE.Group();     // aux pieds, orienté selon le lacet
    this.body = new THREE.Group();     // rebond, inclinaison
    this.root.add(this.body);
    this.hips = new THREE.Group(); this.hips.position.y = 0.85; this.body.add(this.hips);
    this.neck = new THREE.Group(); this.neck.position.y = 0.58; this.hips.add(this.neck);
    this.armL = new THREE.Group(); this.armR = new THREE.Group();
    this.legL = new THREE.Group(); this.legR = new THREE.Group();
    this.hips.add(this.armL, this.armR, this.legL, this.legR);
    this.phase = 0;
    this.time = Math.random() * 10;
    this.meshes = [];
    this.held = null; // objet tenu en main (Object3D)
    this.setAppearance(appearance, extra);
  }

  setAppearance(appearance, extra = {}) {
    this.appearance = { ...DEFAULT_APPEARANCE, ...appearance };
    this.extra = extra;
    for (const m of this.meshes) { m.parent.remove(m); m.geometry.dispose(); }
    this.meshes = [];
    const a = this.appearance;
    const w = (BODY_W[a.body] || 1) * (1 + Math.max(-0.12, Math.min(0.45, (extra.fat || 0) * 0.45)) + (extra.strong || 0) * 0.1);
    const add = (parent, geo) => {
      const m = new THREE.Mesh(geo, actorMaterial);
      m.castShadow = true;
      parent.add(m);
      this.meshes.push(m);
      return m;
    };
    add(this.hips, buildMergedGeometry((sb) => buildTorso(sb, a, w, extra)));
    add(this.neck, buildMergedGeometry((sb) => buildHead(sb, a, extra)));
    const armGeo = buildMergedGeometry((sb) => buildArm(sb, a, extra));
    add(this.armL, armGeo); add(this.armR, armGeo.clone());
    const legGeo = buildMergedGeometry((sb) => buildLeg(sb, a));
    add(this.legL, legGeo); add(this.legR, legGeo.clone());
    this.armL.position.set(0.33 * w + 0.07, 0.5, 0); this.armR.position.set(-(0.33 * w + 0.07), 0.5, 0);
    this.legL.position.set(0.13 * w, 0, 0); this.legR.position.set(-0.13 * w, 0, 0);
    this.root.scale.setScalar(a.height || 1);
  }

  hold(obj) {
    if (this.held) this.armR.remove(this.held);
    this.held = obj;
    if (obj) { obj.position.set(0, -0.7, 0.12); this.armR.add(obj); }
  }

  // m = { speed (m/s), grounded, swimming, vy, pose, dance }
  update(dt, m) {
    this.time += dt;
    const t = this.time;
    const sp = m.speed || 0;
    const run = Math.min(1, sp / 9);
    const moving = sp > 0.4;
    this.phase += dt * (moving ? 3 + sp * 1.05 : 0);
    const ph = this.phase;
    const L = this.legL.rotation, R = this.legR.rotation, AL = this.armL.rotation, AR = this.armR.rotation;
    const k = 1 - Math.pow(0.0001, dt); // lissage
    const set = (rot, x, y, z) => { rot.x += (x - rot.x) * k * 1.6; rot.y += ((y || 0) - rot.y) * k * 1.6; rot.z += ((z || 0) - rot.z) * k * 1.6; };
    let bob = 0, lean = 0, bodyRotX = 0, bodyY = 0, headX = 0, headY = 0;
    const pose = m.pose || 'idle';

    if (m.swimming) {
      bodyRotX = 1.15; bodyY = 0.55;
      set(AL, -Math.PI + Math.sin(t * 5) * 1.6, 0, 0.2);
      set(AR, -Math.PI + Math.sin(t * 5 + Math.PI) * 1.6, 0, -0.2);
      set(L, Math.sin(t * 9) * 0.35, 0, 0); set(R, -Math.sin(t * 9) * 0.35, 0, 0);
      headX = -0.9;
    } else if (pose === 'eat') {
      bodyY = 0;
      set(AR, -2.3 + Math.sin(t * 7) * 0.35, 0, -0.35); set(AL, -0.3, 0, 0.1);
      headX = Math.sin(t * 7) * 0.08;
    } else if (pose === 'pushup') {
      set(AL, -Math.PI / 2, 0, 0.25); set(AR, -Math.PI / 2, 0, -0.25); set(L, 0, 0, 0.04); set(R, 0, 0, -0.04); headX = -0.4;
    } else if (pose === 'bench') {
      const k2 = Math.sin(t * 2.6) * 0.35;
      set(AL, -Math.PI / 2 + k2, 0, 0.3); set(AR, -Math.PI / 2 + k2, 0, -0.3); set(L, -1.2, 0, 0.1); set(R, -1.2, 0, -0.1);
    } else if (pose === 'pedal') {
      bodyY = -0.35;
      set(L, -1.45 + Math.sin(t * 8) * 0.4, 0, 0.05); set(R, -1.45 - Math.sin(t * 8) * 0.4, 0, -0.05);
      set(AL, -1.2, 0, 0.1); set(AR, -1.2, 0, -0.1);
    } else if (pose === 'sit' || pose === 'sit-eat') {
      bodyY = -0.35;
      set(L, -1.45, 0, 0.05); set(R, -1.45, 0, -0.05);
      if (pose === 'sit-eat') { set(AR, -2.3 + Math.sin(t * 7) * 0.35, 0, -0.35); set(AL, -0.9, 0, 0.1); headX = Math.sin(t * 7) * 0.08; }
      else { set(AL, -0.9, 0, 0.1); set(AR, -0.9, 0, -0.1); }
    } else if (pose === 'dance') {
      const d = m.dance || 0, b = t * 7.5;
      bob = Math.abs(Math.sin(b)) * 0.12;
      if (d === 0) { set(AL, 0, 0, 2.6 + Math.sin(b) * 0.4); set(AR, 0, 0, -2.6 - Math.sin(b) * 0.4); set(L, Math.sin(b) * 0.3, 0, 0); set(R, -Math.sin(b) * 0.3, 0, 0); headY = Math.sin(b * 0.5) * 0.3; }
      else if (d === 1) { set(AL, -1.4 + Math.sin(b) * 0.8, 0, 0.3); set(AR, -1.4 - Math.sin(b) * 0.8, 0, -0.3); lean = Math.sin(b * 0.5) * 0.15; set(L, 0, 0, 0.15 + Math.sin(b) * 0.1); set(R, 0, 0, -0.15 + Math.sin(b) * 0.1); }
      else { this.root.rotation.y += dt * 4; set(AL, 0, 0, 1.4); set(AR, 0, 0, -1.4); set(L, Math.max(0, Math.sin(b)) * -0.8, 0, 0); set(R, Math.max(0, -Math.sin(b)) * -0.8, 0, 0); }
    } else if (!m.grounded) {
      set(L, -0.5, 0, 0.08); set(R, 0.35, 0, -0.08);
      set(AL, -0.4, 0, 1.9); set(AR, -0.4, 0, -1.9);
    } else {
      const amp = moving ? 0.55 + run * 0.4 : 0;
      set(L, Math.sin(ph) * amp, 0, 0); set(R, -Math.sin(ph) * amp, 0, 0);
      set(AL, -Math.sin(ph) * amp * 0.9, 0, 0.08 + run * 0.1); set(AR, Math.sin(ph) * amp * 0.9, 0, -0.08 - run * 0.1);
      bob = moving ? Math.abs(Math.sin(ph)) * (0.05 + run * 0.06) : Math.sin(t * 2) * 0.01;
      lean = run * 0.18;
      if (!moving) { set(AL, Math.sin(t * 1.5) * 0.04, 0, 0.1); set(AR, -Math.sin(t * 1.5) * 0.04, 0, -0.1); headY = Math.sin(t * 0.4) * 0.25; }
    }

    // poses du haut du corps (par-dessus la marche)
    if (pose === 'carry') { set(AL, -1.25, 0, 0.25); set(AR, -1.25, 0, -0.25); }
    else if (pose === 'spray' || pose === 'hold-forward') { set(AL, -1.45, 0, -0.25); set(AR, -1.45, 0, 0.25); }
    else if (pose === 'wave') { set(AR, 0, 0, -2.7 + Math.sin(t * 10) * 0.35); }
    else if (pose === 'throw') { set(AR, -2.6, 0, -0.2); }
    else if (pose === 'celebrate') { set(AL, 0, 0, 2.7 + Math.sin(t * 12) * 0.2); set(AR, 0, 0, -2.7 - Math.sin(t * 12) * 0.2); bob = Math.abs(Math.sin(t * 8)) * 0.25; }
    else if (pose === 'cook') { set(AL, -1.1 + Math.sin(t * 12) * 0.2, 0, 0.2); set(AR, -1.1 - Math.sin(t * 12) * 0.2, 0, -0.2); }
    else if (pose === 'phone') { set(AR, -2.0, 0, 0.55); set(AL, -0.5, 0, -0.1); headX = 0.38; }
    else if (pose === 'pet') { set(AR, -0.9 + Math.sin(t * 6) * 0.15, 0, -0.2); bodyRotX = 0.35; }
    // gestes sportifs : frappe, tacle glissé, joueur au sol
    else if (pose === 'kick') { set(R, -1.75, 0, 0); set(L, 0.3, 0, 0); set(AL, -0.6, 0, 0.7); set(AR, -0.2, 0, -0.7); lean = -0.2; }
    else if (pose === 'slide') { set(L, -1.55, 0, 0.12); set(R, -1.25, 0, -0.12); set(AL, -0.2, 0, 1.3); set(AR, -0.2, 0, -1.3); bodyRotX = -1.05; bodyY = -0.5; }
    else if (pose === 'down') { set(L, -0.2, 0, 0.3); set(R, 0.1, 0, -0.3); set(AL, 0, 0, 2.2); set(AR, 0, 0, -2.2); bodyRotX = -1.45; bodyY = -0.62; headX = 0.3; }

    this.body.position.y += ((bob + bodyY) - this.body.position.y) * Math.min(1, k * 3);
    this.body.rotation.x += ((lean + bodyRotX) - this.body.rotation.x) * k * 1.5;
    this.neck.rotation.x += (headX - this.neck.rotation.x) * k;
    this.neck.rotation.y += (headY - this.neck.rotation.y) * k;
    this.hips.scale.y = 1 + (moving ? 0 : Math.sin(t * 2.2) * 0.012);
  }

  dispose() {
    for (const m of this.meshes) m.geometry.dispose();
    this.root.removeFromParent();
  }
}
