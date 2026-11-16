import * as THREE from 'three';
import { buildMergedGeometry, SHAPES } from '../core/static-builder.js';
import { actorMaterial } from '../core/materials.js';
import { DEFAULT_APPEARANCE } from '../../shared/appearance.js';

// Personnage réaliste construit en code : tronc, tête, bras / avant-bras, cuisses / tibias articulés,
// couleurs dans les sommets (1 seul matériau), animations procédurales.

const BODY_W = { mince: 0.88, moyen: 1, costaud: 1.22 };
const B = SHAPES;

function darker(hex, f = 0.75) { const c = new THREE.Color(hex); c.multiplyScalar(f); return `#${c.getHexString()}`; }

// Proportions humaines réalistes (≈ 7 têtes, 1,72 m) : hanches à 0,85 m, genou à mi-jambe, épaules à
// 1,33 m, tête de 25 cm. Le squelette (hanches, cou, bras, avant-bras, jambes, tibias) garde ses noms.
const HIP = 0.85, NECK = 0.55, SHOULDER = 0.48, ELBOW = -0.29, HAND = -0.26, KNEE = -0.43, SOLE = -0.85;
const HEAD_SCALE = [0.385, 0.42, 0.39], HEAD_Y = 0.07;
const mix = (a, b, t) => `#${new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()}`;
// silhouette féminine : coiffures longues / jupe (ou choix explicite)
const isFem = (a, extra) => (extra.fem ?? a.fem) ?? (['long', 'chignon', 'couettes'].includes(a.hair) || a.bottom === 'jupe');

// largeur du buste selon la hauteur (hanches → taille → poitrine → épaules)
function profile(fem) {
  const P = fem ? [0.37, 0.27, 0.35, 0.3] : [0.35, 0.31, 0.41, 0.35];
  return (y) => (y <= 0.2 ? P[0] + (P[1] - P[0]) * Math.max(0, y) / 0.2 : y <= 0.42 ? P[1] + (P[2] - P[1]) * (y - 0.2) / 0.22 : P[2] + (P[3] - P[2]) * Math.min(1, (y - 0.42) / 0.1));
}

// ---------- Tronc (pivot aux hanches)
function buildTorso(sb, a, w, extra) {
  const top = extra.top || a.top;
  const tc = top === 'torse' ? a.skin : extra.topColor || a.topColor;
  const fem = isFem(a, extra);
  const pr = profile(fem), wd = 0.5 + 0.5 * w, fat = Math.max(0, extra.fat || 0);
  const W = (y) => pr(y) * w, D = (y) => pr(y) * 0.6 * wd, FZ = (y) => D(y) / 2;
  const band = (y, t, color, grow = 0.012) => sb.add(B.cyl(20), { y, sx: W(y) + grow, sy: t, sz: D(y) + grow, color });
  const seg = (y0, y1, color) => sb.add(B.frustum(24, +(W(y0) / W(y1)).toFixed(3)), { y: y0, sx: W(y1), sy: y1 - y0, sz: D(y1), color });
  // bassin (couleur du bas)
  sb.add(B.sphere(16), { y: 0.0, sx: W(0) * 1.0, sy: 0.2, sz: D(0) * 0.98, color: a.bottomColor });
  sb.add(B.sphere(12), { y: -0.03, z: -0.05, sx: W(0) * 0.92, sy: 0.22, sz: 0.2 * wd, color: a.bottomColor });   // fessier
  if (a.bottom === 'jupe') sb.add(B.frustum(18, 1.5), { y: -0.38, sx: W(0) * 1.04, sy: 0.42, sz: D(0) * 1.15, color: a.bottomColor });
  // buste : taille, poitrine, épaules tombantes
  seg(0, 0.2, tc); seg(0.2, 0.42, tc); seg(0.42, 0.52, tc);
  sb.add(B.sphere(20), { y: 0.5, sx: W(0.52) * 1.0, sy: 0.1, sz: D(0.52) * 0.96, color: tc });   // dessus des épaules
  sb.add(B.sphere(16), { y: 0.38, z: -0.03, sx: W(0.4) * 0.9, sy: 0.26, sz: D(0.4) * 0.9, color: tc });   // dos arrondi
  for (const sx of [-1, 1]) sb.add(B.sphere(14), { x: sx * W(0.5) * 0.5, y: 0.475, sx: 0.13, sy: 0.11, sz: 0.14 * wd, color: top === 'debardeur' ? a.skin : tc });   // raccord buste / bras
  if (fem) for (const sx of [-1, 1]) sb.add(B.sphere(14), { x: sx * 0.075 * w, y: 0.355, z: FZ(0.36) - 0.05, sx: 0.12 * w, sy: 0.1, sz: 0.085, color: tc });   // poitrine
  if (fat > 0.15) sb.add(B.sphere(16), { y: 0.16, z: 0.04, sx: W(0.15) * 1.05, sy: 0.3, sz: D(0.15) + fat * 0.22, color: tc });   // ventre
  band(-0.005, 0.04, '#2b2d42'); // ceinture
  sb.add(B.box(), { y: 0.0, z: FZ(0) + 0.004, sx: 0.045, sy: 0.035, sz: 0.012, color: '#d9b24a' });
  sb.add(B.cyl(14), { y: 0.5, sx: fem ? 0.095 : 0.115, sy: 0.14, sz: fem ? 0.1 : 0.12, color: a.skin }); // cou
  if (top !== 'torse') sb.add(B.frustum(14, 0.72), { y: 0.495, sx: 0.2, sy: 0.05, sz: 0.19, color: a.skin });   // base du cou (trapèzes)
  if (top === 'tshirt' || top === 'sweat' || top === 'debardeur' || top === 'raye') sb.add(B.torus(), { y: 0.52, z: 0.008, sx: 0.15, sy: 0.14, sz: 0.12, rx: Math.PI / 2 - 0.2, color: darker(tc, 0.82) });   // col
  if (top !== 'torse') band(0.045, 0.018, darker(tc, 0.86), 0.006);   // ourlet du haut
  if (top === 'sweat') {
    sb.add(B.sphere(12), { y: 0.5, z: -0.1, sx: 0.24, sy: 0.16, sz: 0.14, color: darker(tc, 0.85) }); // capuche
    sb.add(B.box(), { y: 0.07, z: FZ(0.1) - 0.004, sx: 0.2 * w, sy: 0.09, sz: 0.012, color: darker(tc, 0.85) });   // poche kangourou
    for (const sx of [-1, 1]) sb.add(B.cyl(6), { x: sx * 0.03, y: 0.38, z: FZ(0.42) - 0.005, sx: 0.008, sy: 0.12, sz: 0.008, color: '#f1f1f1' });   // cordons
  }
  if (top === 'chemise' || top === 'hawai' || top === 'costume' || top === 'veste-luxe') {
    for (const sx of [-1, 1]) sb.add(B.box(), { y: 0.5, z: 0.075, x: sx * 0.045, sx: 0.085, sy: 0.05, sz: 0.035, rz: sx * -0.55, rx: 0.3, color: top === 'hawai' ? tc : '#ffffff' });   // col de chemise
  }
  if (top === 'chemise' || top === 'hawai') {
    sb.add(B.box(), { y: 0.06, z: FZ(0.3) - 0.012, sx: 0.022, sy: 0.44, sz: 0.012, color: darker(tc, 0.9) });   // patte de boutonnage
    for (let i = 0; i < 4; i++) sb.add(B.sphere(6), { y: 0.44 - i * 0.1, z: FZ(0.44 - i * 0.1) + 0.002, sx: 0.018, sy: 0.018, sz: 0.01, color: '#ffffff' });
  }
  if (top === 'hawai') {
    const cols = ['#ffd23f', '#ff5a5f', '#ffffff', '#7ac74f'];
    for (let i = 0; i < 14; i++) {
      const ang = (i / 14) * Math.PI * 2 + 0.3, yy = 0.08 + ((i * 37) % 10) / 26;
      sb.add(B.sphere(6), { x: Math.sin(ang) * W(yy) * 0.5, y: yy, z: Math.cos(ang) * D(yy) * 0.5, sx: 0.045, sy: 0.045, sz: 0.045, color: cols[i % 4] });
    }
  }
  if (top === 'raye') for (let i = 0; i < 6; i++) band(0.08 + i * 0.07, 0.028, '#ffffff', 0.008);
  if (top === 'costume') {
    sb.add(B.box(), { y: 0.3, z: FZ(0.4) - 0.01, sx: 0.09, sy: 0.2, sz: 0.012, color: '#ffffff' });   // plastron
    sb.add(B.box(), { y: 0.16, z: FZ(0.3) + 0.002, sx: 0.04, sy: 0.32, sz: 0.012, color: '#c0392b' }); // cravate
    for (const sx of [-1, 1]) sb.add(B.box(), { x: sx * 0.07, y: 0.24, z: FZ(0.35) + 0.002, sx: 0.07, sy: 0.27, sz: 0.012, rz: sx * 0.22, color: darker(tc, 0.82) });   // revers
  }
  if (top === 'veste-luxe') {
    for (const sx of [-1, 1]) sb.add(B.box(), { x: sx * 0.065, y: 0.24, z: FZ(0.35) + 0.002, sx: 0.06, sy: 0.27, sz: 0.012, rz: sx * 0.22, color: '#fca311' });
    for (let i = 0; i < 2; i++) sb.add(B.sphere(6), { y: 0.16 - i * 0.08, z: FZ(0.15) + 0.006, x: 0.025, sx: 0.025, sy: 0.025, sz: 0.012, color: '#fca311' });
    sb.add(B.box(), { y: 0.38, z: FZ(0.42) - 0.012, sx: 0.08, sy: 0.1, sz: 0.012, color: '#ffffff' });
  }
  if (top === 'torse') {
    const m = extra.strong || 0;
    if (!fem) for (const sx of [-1, 1]) sb.add(B.sphere(12), { x: sx * 0.085 * w, y: 0.37, z: FZ(0.37) - 0.04, sx: 0.17 * w, sy: 0.12, sz: 0.09 + m * 0.04, color: darker(a.skin, 0.95) }); // pectoraux
    if (m > 0.4) for (let r = 0; r < 3; r++) for (const sx of [-1, 1]) sb.add(B.sphere(8), { x: sx * 0.036, y: 0.25 - r * 0.058, z: FZ(0.25 - r * 0.058) - 0.014, sx: 0.06, sy: 0.048, sz: 0.035, color: darker(a.skin, 0.92) }); // abdos
    sb.add(B.sphere(6), { y: 0.085, z: FZ(0.09) - 0.004, sx: 0.016, sy: 0.02, sz: 0.01, color: darker(a.skin, 0.7) });   // nombril
    if (fem) band(0.33, 0.1, extra.topColor || a.topColor, 0.01);   // brassière
  }
  if (top === 'tablier') {
    sb.add(B.box(), { y: -0.38, z: FZ(0.1) + 0.008, sx: 0.3 * w, sy: 0.74, sz: 0.014, color: '#ffffff' });
    for (const sx of [-1, 1]) sb.add(B.box(), { y: 0.3, z: FZ(0.42), sx: 0.03, sy: 0.22, sz: 0.012, x: sx * 0.08, color: '#eeeeee' });
  }
  if (top === 'uniforme-pompier') for (const yy of [0.08, 0.26]) band(yy, 0.035, '#ffe14d');
  if (top === 'gilet-livreur') band(0.24, 0.07, '#2d3a8c');
  // dos
  const back = extra.back || a.back, BZ = -D(0.35) / 2;
  if (back === 'sac-a-dos' || back === 'sac-livreur') {
    const col = back === 'sac-livreur' ? '#ffd23f' : '#3d8ee8';
    sb.add(B.box(), { y: 0.1, z: BZ - 0.08, sx: 0.28, sy: 0.38, sz: 0.16, color: col });
    sb.add(B.box(), { y: 0.13, z: BZ - 0.17, sx: 0.2, sy: 0.16, sz: 0.04, color: darker(col) });
    for (const sx of [-1, 1]) sb.add(B.box(), { x: sx * 0.11 * w, y: 0.16, z: FZ(0.4) - 0.01, sx: 0.035, sy: 0.36, sz: 0.014, color: darker(col, 0.85) });   // bretelles
  }
  if (back === 'cape' || back === 'cape-vampire') sb.add(B.box(), { y: -0.6, z: BZ - 0.04, sx: 0.44 * w, sy: 1.1, sz: 0.03, rx: 0.1, color: back === 'cape' ? '#c0392b' : '#1d1029' });
  if (back === 'ailes') for (const s of [-1, 1]) sb.add(B.sphere(10), { x: s * 0.26, y: 0.36, z: BZ - 0.08, sx: 0.09, sy: 0.5, sz: 0.3, rz: s * -0.6, color: '#ffffff' });
  if (back === 'bouee') sb.add(B.ring(), { y: 0.05, sx: 0.72 * w, sy: 0.7, sz: 0.6, color: '#ffd23f' });
  if (back === 'guitare') {
    sb.add(B.sphere(12), { y: 0.05, z: BZ - 0.06, sx: 0.3, sy: 0.36, sz: 0.09, rz: 0.4, color: '#b5562d' });
    sb.add(B.box(), { y: 0.32, z: BZ - 0.06, x: 0.12, sx: 0.045, sy: 0.5, sz: 0.035, rz: 0.4, color: '#5b3a1e' });
  }
  if (back === 'echarpe') { sb.add(B.ring(), { y: 0.55, sx: 0.24, sy: 0.4, sz: 0.24, color: '#ff5a5f' }); sb.add(B.box(), { x: 0.06, y: 0.28, z: FZ(0.4) + 0.005, sx: 0.07, sy: 0.26, sz: 0.02, color: '#ff5a5f' }); }
  if (back === 'sac-luxe') { sb.add(B.box(), { x: 0.24 * w, y: -0.18, z: 0.0, sx: 0.07, sy: 0.2, sz: 0.24, color: '#7f5539' }); sb.add(B.box(), { x: 0.24 * w, y: -0.06, z: 0.12, sx: 0.075, sy: 0.035, sz: 0.012, color: '#fca311' }); sb.add(B.box(), { x: 0.215 * w, y: 0.0, sx: 0.016, sy: 0.5, sz: 0.03, color: '#7f5539' }); }
}

// ---------- Tête (pivot au cou ; construite dans un repère « large », puis réduite à 30 cm)
function buildHead(sb, a, extra) {
  const s = a.skin, fem = isFem(a, extra);
  const lip = mix(s, fem ? '#c2415a' : '#a8544e', fem ? 0.62 : 0.4);
  sb.add(B.sphere(32), { y: 0.3, sx: 0.56, sy: 0.6, sz: 0.58, color: s });   // crâne
  sb.add(B.sphere(24), { y: 0.14, z: 0.035, sx: fem ? 0.44 : 0.47, sy: 0.38, sz: 0.48, color: s });   // mâchoire
  sb.add(B.sphere(16), { y: 0.04, z: 0.17, sx: fem ? 0.2 : 0.24, sy: 0.12, sz: 0.12, color: s });   // menton
  for (const sx of [-1, 1]) {
    sb.add(B.sphere(14), { x: sx * 0.15, y: 0.22, z: 0.16, sx: 0.17, sy: 0.12, sz: 0.1, color: s });   // pommettes
    sb.add(B.sphere(16), { x: sx * 0.275, y: 0.27, z: -0.01, sx: 0.06, sy: 0.14, sz: 0.085, rz: sx * 0.12, color: s });   // oreille
    sb.add(B.sphere(10), { x: sx * 0.292, y: 0.275, z: 0.0, sx: 0.03, sy: 0.08, sz: 0.045, color: darker(s, 0.8) });   // creux de l'oreille
  }
  // yeux en amande, à mi-hauteur du visage
  const ey = 0.29, ez = 0.258, ex = 0.097;
  const brow = darker(a.hairColor, 0.72);
  for (const sx of [-ex, ex]) {
    sb.add(B.sphere(12), { x: sx, y: ey + 0.005, z: ez - 0.012, sx: 0.125, sy: 0.085, sz: 0.04, color: darker(s, 0.93) });   // orbite
    if (a.eyes === 'joyeux') {
      for (const k of [-1, 1]) sb.add(B.box(), { x: sx + k * 0.02, y: ey - 0.004, z: ez + 0.018, sx: 0.046, sy: 0.011, sz: 0.012, rz: k * -0.45, color: '#1b1b24' });
    } else {
      const sleepy = a.eyes === 'endormi', hgt = sleepy ? 0.026 : 0.044;
      sb.add(B.sphere(16), { x: sx, y: ey, z: ez, sx: 0.088, sy: hgt, sz: 0.04, color: '#f3f0ea' });
      sb.add(B.sphere(14), { x: sx * 1.03, y: ey, z: ez + 0.013, sx: 0.043, sy: Math.min(hgt, 0.043), sz: 0.022, color: a.eyeColor || '#5b3a1e' });   // iris
      sb.add(B.sphere(10), { x: sx * 1.03, y: ey, z: ez + 0.02, sx: 0.02, sy: Math.min(hgt * 0.6, 0.021), sz: 0.014, color: '#0b0b10' });   // pupille
      sb.add(B.sphere(6), { x: sx * 1.03 + 0.01, y: ey + 0.009, z: ez + 0.027, sx: 0.008, sy: 0.008, sz: 0.004, color: '#ffffff' });   // reflet
      sb.add(B.hemi(16), { x: sx, y: ey + (sleepy ? 0.0 : 0.009), z: ez - 0.004, sx: 0.096, sy: 0.05, sz: 0.052, rx: -0.2, color: darker(s, 0.9) });   // paupière
      sb.add(B.sphere(8), { x: sx, y: ey + (sleepy ? 0.006 : 0.021), z: ez + 0.016, sx: 0.09, sy: fem ? 0.012 : 0.008, sz: 0.012, rz: sx > 0 ? -0.08 : 0.08, color: '#1b1b24' });   // ligne des cils
      if (fem) sb.add(B.box(), { x: sx * 1.42, y: ey + 0.024, z: ez + 0.004, sx: 0.022, sy: 0.007, sz: 0.008, rz: sx > 0 ? 0.5 : -0.5, color: '#1b1b24' });   // cils extérieurs
    }
    const ang = a.eyes === 'serieux' ? 0.3 : 0.1;
    sb.add(B.sphere(10), { x: sx * 1.06, y: ey + (a.eyes === 'serieux' ? 0.052 : 0.064), z: ez + 0.012, sx: fem ? 0.095 : 0.105, sy: fem ? 0.014 : 0.022, sz: 0.026, rz: sx > 0 ? ang : -ang, color: brow });   // sourcil
  }
  sb.add(B.sphere(12), { y: 0.25, z: 0.275, sx: 0.05, sy: 0.14, sz: 0.06, rx: -0.22, color: s });   // arête du nez
  sb.add(B.sphere(12), { y: 0.19, z: 0.305, sx: fem ? 0.055 : 0.066, sy: 0.05, sz: 0.058, color: s }); // bout du nez
  for (const nx of [-1, 1]) {
    sb.add(B.sphere(8), { x: nx * 0.03, y: 0.182, z: 0.283, sx: 0.036, sy: 0.032, sz: 0.04, color: s });   // ailes du nez
    sb.add(B.sphere(6), { x: nx * 0.017, y: 0.17, z: 0.3, sx: 0.014, sy: 0.008, sz: 0.012, color: darker(s, 0.55) });   // narines
  }
  // bouche : lèvres dessinées, léger sourire
  sb.add(B.sphere(12), { y: 0.128, z: 0.272, sx: 0.105, sy: 0.024, sz: 0.034, color: lip });   // lèvre supérieure
  sb.add(B.sphere(12), { y: 0.106, z: 0.27, sx: 0.09, sy: fem ? 0.034 : 0.028, sz: 0.036, color: mix(lip, '#ffffff', 0.08) });   // lèvre inférieure
  sb.add(B.box(), { y: 0.114, z: 0.284, sx: 0.088, sy: 0.005, sz: 0.008, color: darker(lip, 0.5) });   // commissure
  for (const k of [-1, 1]) sb.add(B.sphere(6), { x: k * 0.055, y: 0.122, z: 0.266, sx: 0.016, sy: 0.012, sz: 0.012, color: darker(lip, 0.6) });

  const hat = extra.hat !== undefined ? extra.hat : a.hat;
  const hc = a.hairColor;
  const hairUnderHat = !!hat && !['couronne', 'hélice', 'oreilles-lapin', 'bandeau'].includes(hat);
  // calotte de cheveux légèrement plus grande que le crâne, inclinée vers l'arrière
  const cap = (sx, sy, sz, rx) => sb.add(B.hemi(14), { y: 0.3, sx, sy, sz, rx, color: hc });
  switch (a.hair) {
    case 'court':
      cap(0.63, 0.66, 0.62, -0.3);
      if (!hairUnderHat) {
        sb.add(B.sphere(20), { y: 0.5, z: 0.16, sx: 0.54, sy: 0.13, sz: 0.24, rx: 0.35, color: hc });   // frange lisse
        sb.add(B.sphere(14), { x: 0.1, y: 0.49, z: 0.22, sx: 0.22, sy: 0.08, sz: 0.12, rx: 0.5, rz: -0.25, color: hc });   // mèche
        sb.add(B.sphere(18), { y: 0.36, z: -0.13, sx: 0.6, sy: 0.4, sz: 0.4, color: hc });   // volume à l'arrière (nuque)
        for (const sx of [-1, 1]) sb.add(B.sphere(12), { x: sx * 0.27, y: 0.38, z: 0.06, sx: 0.1, sy: 0.18, sz: 0.16, color: hc });   // tempes
      }
      break;
    case 'meche':
      cap(0.63, 0.68, 0.62, -0.25);
      if (!hairUnderHat) {
        sb.add(B.sphere(16), { x: 0.1, y: 0.52, z: 0.22, sx: 0.32, sy: 0.12, sz: 0.18, rz: -0.4, color: hc });
        sb.add(B.sphere(14), { x: 0.2, y: 0.42, z: 0.24, sx: 0.12, sy: 0.2, sz: 0.1, rz: -0.25, color: hc });   // mèche qui tombe sur le front
        sb.add(B.sphere(16), { y: 0.36, z: -0.13, sx: 0.6, sy: 0.38, sz: 0.4, color: hc });
      }
      break;
    case 'herisse':
      cap(0.62, 0.64, 0.61, -0.25);
      if (!hairUnderHat) {
        for (let i = 0; i < 7; i++) { const ang = (i / 7) * Math.PI * 2; sb.add(B.cone(8), { x: Math.cos(ang) * 0.14, y: 0.54, z: Math.sin(ang) * 0.14 - 0.03, sx: 0.14, sy: 0.25, sz: 0.14, rx: Math.sin(ang) * 0.5, rz: -Math.cos(ang) * 0.5, color: hc }); }
        for (let i = 0; i < 9; i++) { const ang = (i / 9) * Math.PI * 2 + 0.3; sb.add(B.cone(6), { x: Math.cos(ang) * 0.24, y: 0.47, z: Math.sin(ang) * 0.22 - 0.04, sx: 0.11, sy: 0.18, sz: 0.11, rx: Math.sin(ang) * 0.9, rz: -Math.cos(ang) * 0.9, color: hc }); }
      }
      break;
    case 'long':
      cap(0.62, 0.68, 0.62, -0.2);
      // longue chevelure qui tombe dans le dos jusqu'aux omoplates, mèches devant les épaules, raie au milieu
      sb.add(B.sphere(22), { y: 0.12, z: -0.17, sx: 0.66, sy: 0.9, sz: 0.36, color: hc });
      sb.add(B.sphere(18), { y: -0.42, z: -0.22, sx: 0.6, sy: 0.75, sz: 0.24, color: hc });
      sb.add(B.sphere(14), { y: -0.8, z: -0.24, sx: 0.48, sy: 0.4, sz: 0.18, color: darker(hc, 0.92) });
      for (const sx of [-1, 1]) {
        sb.add(B.sphere(16), { x: sx * 0.26, y: 0.1, z: 0.04, sx: 0.14, sy: 0.6, sz: 0.2, rz: sx * 0.06, color: hc });
        sb.add(B.sphere(14), { x: sx * 0.27, y: -0.3, z: 0.1, sx: 0.13, sy: 0.55, sz: 0.16, rz: sx * -0.08, color: hc });
        sb.add(B.sphere(10), { x: sx * 0.25, y: -0.6, z: 0.13, sx: 0.09, sy: 0.22, sz: 0.11, color: darker(hc, 0.9) });
      }
      break;
    case 'chignon':
      cap(0.63, 0.66, 0.62, -0.25);
      if (!hairUnderHat) { sb.add(B.sphere(16), { y: 0.66, z: -0.08, sx: 0.28, sy: 0.25, sz: 0.28, color: hc }); sb.add(B.torus(), { y: 0.6, z: -0.07, sx: 0.24, sy: 0.24, sz: 0.24, rx: Math.PI / 2, color: '#e63946' }); }   // chignon et élastique
      break;
    case 'afro': if (!hairUnderHat) { sb.add(B.ico1(), { y: 0.5, z: -0.13, sx: 0.84, sy: 0.74, sz: 0.72, color: hc }); cap(0.64, 0.7, 0.62, -0.35); } else cap(0.66, 0.66, 0.64, -0.2); break;
    case 'crete':
      if (!hairUnderHat) for (let i = 0; i < 5; i++) sb.add(B.box(), { y: 0.52 + Math.sin((i / 4) * Math.PI) * 0.06, z: 0.2 - i * 0.11, sx: 0.08, sy: 0.22, sz: 0.1, color: hc });
      break;
    case 'couettes':
      cap(0.63, 0.66, 0.62, -0.25);
      for (const sx of [-1, 1]) {
        sb.add(B.sphere(14), { x: sx * 0.35, y: 0.22, z: -0.05, sx: 0.18, sy: 0.36, sz: 0.18, rz: sx * 0.2, color: hc });
        sb.add(B.sphere(10), { x: sx * 0.31, y: 0.4, z: -0.05, sx: 0.09, sy: 0.07, sz: 0.09, color: '#ff70a6' });   // élastiques
      }
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
      for (const sx of [-0.1, 0.1]) sb.add(B.torus(), { x: sx, y: 0.29, z: 0.29, sx: 0.2, sy: 0.2, sz: 0.2, color: '#1b1b24' });
      sb.add(B.box(), { y: 0.3, z: 0.29, sx: 0.06, sy: 0.015, sz: 0.015, color: '#1b1b24' });
      break;
    case 'lunettes-soleil':
      for (const sx of [-0.1, 0.1]) sb.add(B.box(), { x: sx, y: 0.29, z: 0.29, sx: 0.16, sy: 0.09, sz: 0.03, color: '#14141c' });
      sb.add(B.box(), { y: 0.32, z: 0.29, sx: 0.4, sy: 0.02, sz: 0.02, color: '#14141c' });
      break;
    case 'lunettes-coeur':
      for (const sx of [-0.1, 0.1]) { sb.add(B.sphere(8), { x: sx - 0.025, y: 0.3, z: 0.29, sx: 0.08, sy: 0.08, sz: 0.03, color: '#ff3f7f' }); sb.add(B.sphere(8), { x: sx + 0.025, y: 0.3, z: 0.29, sx: 0.08, sy: 0.08, sz: 0.03, color: '#ff3f7f' }); sb.add(B.cone(4), { x: sx, y: 0.28, z: 0.29, sx: 0.12, sy: 0.07, sz: 0.03, rx: Math.PI, color: '#ff3f7f' }); }
      break;
    case 'lunettes-luxe':
      for (const sx of [-1, 1]) sb.add(B.box(), { x: sx * 0.12, y: 0.27, z: 0.29, sx: 0.2, sy: 0.11, sz: 0.03, color: '#111111' });
      sb.add(B.box(), { y: 0.29, z: 0.29, sx: 0.46, sy: 0.025, sz: 0.03, color: '#fca311' });
      break;
    case 'monocle': sb.add(B.torus(), { x: 0.1, y: 0.29, z: 0.29, sx: 0.2, sy: 0.2, sz: 0.2, color: '#ffd23f' }); sb.add(B.box(), { x: 0.17, y: 0.15, z: 0.27, sx: 0.01, sy: 0.3, sz: 0.01, color: '#ffd23f' }); break;
    case 'masque-plongee':
      sb.add(B.box(), { y: 0.29, z: 0.28, sx: 0.36, sy: 0.16, sz: 0.06, color: '#2ec4b6' });
      sb.add(B.box(), { y: 0.29, z: 0.31, sx: 0.3, sy: 0.11, sz: 0.02, color: '#bfefff' });
      sb.add(B.cyl(6), { x: 0.25, y: 0.31, z: 0.15, sx: 0.05, sy: 0.4, sz: 0.05, color: '#ffd23f' });
      break;
    case 'moustache': sb.add(B.sphere(8), { x: -0.06, y: 0.15, z: 0.29, sx: 0.13, sy: 0.05, sz: 0.04, rz: 0.2, color: '#3a2a1e' }); sb.add(B.sphere(8), { x: 0.06, y: 0.15, z: 0.29, sx: 0.13, sy: 0.05, sz: 0.04, rz: -0.2, color: '#3a2a1e' }); break;
    default: break;
  }
}

// ---------- Bras : haut (pivot à l'épaule) et avant-bras + main (pivot au coude)
function armStyle(a, extra) {
  const top = extra.top || a.top;
  const tc = extra.topColor || a.topColor;
  const long = ['sweat', 'chemise', 'costume', 'uniforme-pompier', 'raye', 'veste-luxe'].includes(top);
  const bare = top === 'debardeur' || top === 'torse';
  const fem = isFem(a, extra);
  const m = (fem ? 0.86 : 1) * (1 + (extra.strong || 0) * 0.4 + Math.max(0, extra.fat || 0) * 0.3);
  return { top, tc, long, bare, m };
}
function buildUpperArm(sb, a, extra) {
  const { top, tc, long, bare, m } = armStyle(a, extra);
  sb.add(B.sphere(18), { y: -0.04, sx: 0.125 * m, sy: 0.15, sz: 0.125 * m, color: bare ? a.skin : tc });   // deltoïde
  sb.add(B.frustum(18, 0.8), { y: ELBOW, sx: 0.105 * m, sy: -ELBOW - 0.02, sz: 0.11 * m, color: long ? tc : a.skin });   // bras
  sb.add(B.sphere(12), { y: -0.17, z: 0.012, sx: 0.09 * m, sy: 0.14, sz: 0.085 * m, color: long ? tc : a.skin });   // biceps
  if (!bare && !long) {
    sb.add(B.frustum(18, 1.06), { y: -0.15, sx: 0.13 * m, sy: 0.15, sz: 0.135 * m, color: tc });   // manche courte
    sb.add(B.cyl(18), { y: -0.155, sx: 0.134 * m, sy: 0.016, sz: 0.139 * m, color: darker(tc, 0.85) });
  }
  if (top === 'uniforme-pompier') sb.add(B.cyl(10), { y: -0.2, sx: 0.112 * m, sy: 0.03, sz: 0.115 * m, color: '#ffe14d' });
  sb.add(B.sphere(12), { y: ELBOW, sx: 0.084 * m, sy: 0.07, sz: 0.086 * m, color: long ? tc : a.skin });   // coude
}
function buildForearm(sb, a, extra) {
  const { tc, long, m } = armStyle(a, extra);
  const s = a.skin, L = HAND;
  sb.add(B.sphere(12), { y: 0, sx: 0.084 * m, sy: 0.07, sz: 0.086 * m, color: long ? tc : s });   // rotule du coude
  sb.add(B.frustum(16, 0.62), { y: L + 0.01, sx: 0.086 * m, sy: -L - 0.01, sz: 0.088 * m, color: long ? tc : s });   // avant-bras
  if (long) sb.add(B.cyl(14), { y: L + 0.02, sx: 0.072, sy: 0.04, sz: 0.068, color: darker(tc, 0.82) });   // poignet de manche
  // main : paume, quatre doigts légèrement repliés, pouce, ongles
  sb.add(B.sphere(14), { y: L - 0.045, sx: 0.07, sy: 0.1, sz: 0.035, color: s });
  for (let i = 0; i < 4; i++) {
    const fx = -0.026 + i * 0.0175, len = [0.06, 0.075, 0.07, 0.055][i];
    sb.add(B.sphere(8), { x: fx, y: L - 0.1 - len * 0.4, z: 0.006, sx: 0.016, sy: len, sz: 0.018, rx: 0.2, color: s });
  }
  sb.add(B.sphere(8), { x: 0.032, y: L - 0.05, z: 0.022, sx: 0.02, sy: 0.055, sz: 0.022, rx: 0.4, rz: -0.45, color: s });   // pouce
}

// ---------- Jambes : cuisse (pivot à la hanche) et tibia + pied (pivot au genou)
function buildThigh(sb, a, extra) {
  const short = a.bottom === 'short', skirt = a.bottom === 'jupe', fem = isFem(a, extra);
  const t = fem ? 0.95 : 1;
  const c = skirt ? a.skin : a.bottomColor;
  sb.add(B.frustum(18, 0.62), { y: KNEE, sx: 0.175 * t, sy: -KNEE, sz: 0.18 * t, color: c });   // cuisse
  sb.add(B.sphere(14), { y: -0.04, sx: 0.165 * t, sy: 0.12, sz: 0.16 * t, color: skirt ? a.skin : a.bottomColor });   // haut de cuisse
  if (short) sb.add(B.cyl(16), { y: -0.27, sx: 0.162, sy: 0.02, sz: 0.168, color: darker(a.bottomColor, 0.85) });   // ourlet du short
  if (short) sb.add(B.frustum(16, 0.75), { y: KNEE, sx: 0.125, sy: 0.2, sz: 0.13, color: a.skin });
  sb.add(B.sphere(12), { y: KNEE, z: 0.01, sx: 0.11, sy: 0.09, sz: 0.11, color: short || skirt ? a.skin : a.bottomColor });   // genou
}
function buildShin(sb, a) {
  const short = a.bottom === 'short', skirt = a.bottom === 'jupe';
  const c = short || skirt ? a.skin : a.bottomColor, H = SOLE - KNEE;   // longueur du tibia (négative)
  sb.add(B.sphere(12), { y: 0, z: 0.012, sx: 0.11, sy: 0.09, sz: 0.11, color: c });   // rotule
  sb.add(B.frustum(16, 0.62), { y: H + 0.07, sx: 0.112, sy: -H - 0.07, sz: 0.115, color: c });   // jambe
  sb.add(B.sphere(12), { y: H * 0.35, z: -0.022, sx: 0.1, sy: 0.18, sz: 0.09, color: c });   // mollet
  if (!short && !skirt) sb.add(B.cyl(14), { y: H + 0.07, sx: 0.088, sy: 0.03, sz: 0.09, color: darker(a.bottomColor, 0.85) });   // bas du pantalon
  const f = a.feet, y0 = H;
  if (f === 'bottes-cuir' || f === 'bottes-pluie') {
    const col = f === 'bottes-pluie' ? '#ffd23f' : '#5c3d2e';
    sb.add(B.cyl(12), { y: y0 + 0.03, sx: 0.1, sy: 0.24, sz: 0.11, color: col });
    sb.add(B.sphere(14), { y: y0 + 0.045, z: 0.045, sx: 0.105, sy: 0.09, sz: 0.26, color: col });
    sb.add(B.box(), { y: y0, z: 0.04, sx: 0.105, sy: 0.022, sz: 0.27, color: darker(col, 0.6) });
  } else if (f === 'mocassins-cuir' || f === 'talons-or') {
    const col = f === 'talons-or' ? '#fca311' : '#6f1d1b';
    sb.add(B.sphere(14), { y: y0 + 0.035, z: 0.05, sx: 0.09, sy: 0.07, sz: 0.24, rx: f === 'talons-or' ? 0.25 : 0, color: col });
    sb.add(B.sphere(10), { y: y0 + 0.06, z: 0.0, sx: 0.08, sy: 0.07, sz: 0.1, color: a.skin });
    if (f === 'talons-or') sb.add(B.cyl(6), { y: y0, z: -0.06, sx: 0.02, sy: 0.07, sz: 0.02, color: col });
    else sb.add(B.box(), { y: y0 + 0.06, z: 0.11, sx: 0.06, sy: 0.01, sz: 0.03, color: '#fca311' });
  } else if (f === 'tongs') {
    sb.add(B.sphere(12), { y: y0 + 0.03, z: 0.05, sx: 0.085, sy: 0.05, sz: 0.23, color: a.skin });
    sb.add(B.box(), { y: y0, z: 0.05, sx: 0.1, sy: 0.015, sz: 0.26, color: '#2ec4b6' });
    sb.add(B.box(), { y: y0 + 0.02, z: 0.1, sx: 0.012, sy: 0.04, sz: 0.06, color: '#2ec4b6' });
  } else {
    // baskets : tige arrondie, semelle épaisse, lacets, virgule
    const lux = f === 'baskets-luxe', white = f === 'baskets-blanches';
    const sc = lux || white ? '#f4f5f7' : a.shoes;
    sb.add(B.sphere(16), { y: y0 + 0.055, z: 0.04, sx: 0.112, sy: 0.1, sz: 0.27, color: sc });
    sb.add(B.sphere(12), { y: y0 + 0.075, z: -0.035, sx: 0.105, sy: 0.12, sz: 0.13, color: sc });   // talon / cheville
    sb.add(B.sphere(16), { y: y0 + 0.018, z: 0.04, sx: 0.122, sy: 0.045, sz: 0.285, color: lux ? '#fca311' : '#ece7dc' });   // semelle
    for (let i = 0; i < 3; i++) sb.add(B.box(), { y: y0 + 0.098 - i * 0.012, z: 0.06 + i * 0.03, sx: 0.05, sy: 0.006, sz: 0.008, rx: -0.4, color: lux || white ? '#c9ced6' : '#f2f2f2' });   // lacets
    for (const sx of [-1, 1]) sb.add(B.box(), { x: sx * 0.056, y: y0 + 0.055, z: 0.03, sx: 0.004, sy: 0.02, sz: 0.1, rx: 0.25, color: lux ? '#fca311' : white ? '#2b2d42' : '#ffffff' });   // virgule
  }
}

export class Avatar {
  constructor(appearance = DEFAULT_APPEARANCE, extra = {}) {
    this.root = new THREE.Group();     // aux pieds, orienté selon le lacet
    this.body = new THREE.Group();     // rebond, inclinaison
    this.root.add(this.body);
    this.hips = new THREE.Group(); this.hips.position.y = HIP; this.body.add(this.hips);
    this.neck = new THREE.Group(); this.neck.position.y = NECK; this.hips.add(this.neck);
    this.armL = new THREE.Group(); this.armR = new THREE.Group();
    this.legL = new THREE.Group(); this.legR = new THREE.Group();
    this.hips.add(this.armL, this.armR, this.legL, this.legR);
    // avant-bras et tibias articulés (coudes, genoux)
    this.foreL = new THREE.Group(); this.foreR = new THREE.Group(); this.shinL = new THREE.Group(); this.shinR = new THREE.Group();
    this.foreL.position.y = this.foreR.position.y = ELBOW; this.shinL.position.y = this.shinR.position.y = KNEE;
    this.armL.add(this.foreL); this.armR.add(this.foreR); this.legL.add(this.shinL); this.legR.add(this.shinR);
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
    const head = add(this.neck, buildMergedGeometry((sb) => buildHead(sb, a, extra)));
    head.scale.set(...HEAD_SCALE); head.position.y = HEAD_Y;
    const armUp = buildMergedGeometry((sb) => buildUpperArm(sb, a, extra)), armLow = buildMergedGeometry((sb) => buildForearm(sb, a, extra));
    add(this.armL, armUp); add(this.armR, armUp.clone()); add(this.foreL, armLow); add(this.foreR, armLow.clone());
    const legUp = buildMergedGeometry((sb) => buildThigh(sb, a, extra)), legLow = buildMergedGeometry((sb) => buildShin(sb, a));
    add(this.legL, legUp); add(this.legR, legUp.clone()); add(this.shinL, legLow); add(this.shinR, legLow.clone());
    const fem = isFem(a, extra), sw = profile(fem)(0.5) * w;
    this.armL.position.set(sw / 2 + 0.05, SHOULDER, 0); this.armR.position.set(-(sw / 2 + 0.05), SHOULDER, 0);
    const hx = (fem ? 0.095 : 0.088) * Math.max(0.9, w);
    this.legL.position.set(hx, -0.02, 0); this.legR.position.set(-hx, -0.02, 0);
    this.root.scale.setScalar(a.height || 1);
  }

  // gants de boxe (couleur) ou null pour les retirer
  gloves(color) {
    for (const g of this._gloves || []) g.removeFromParent();
    this._gloves = [];
    if (!color) return;
    for (const fore of [this.foreL, this.foreR]) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), new THREE.MeshStandardMaterial({ color, roughness: 0.35 }));
      m.position.set(0, HAND - 0.04, 0.02); m.scale.set(0.75, 0.85, 0.85);
      fore.add(m); this._gloves.push(m);
    }
  }

  hold(obj) {
    if (this.held) this.foreR.remove(this.held);
    this.held = obj;
    if (obj) { obj.position.set(0, HAND - 0.07, 0.05); this.foreR.add(obj); }
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
      set(AL, -Math.sin(ph) * amp * 0.7, 0, 0.08 + run * 0.1); set(AR, Math.sin(ph) * amp * 0.7, 0, -0.08 - run * 0.1);
      bob = moving ? Math.abs(Math.sin(ph)) * (0.05 + run * 0.06) : Math.sin(t * 2) * 0.01;
      lean = run * 0.18;
      if (!moving) { set(AL, Math.sin(t * 1.5) * 0.04, 0, 0.1); set(AR, -Math.sin(t * 1.5) * 0.04, 0, -0.1); headY = Math.sin(t * 0.4) * 0.25; }
    }

    // poses du haut du corps (par-dessus la marche)
    if (pose === 'carry') { set(AL, -1.25, 0, 0.25); set(AR, -1.25, 0, -0.25); }
    else if (pose === 'spray' || pose === 'hold-forward') { set(AL, -1.45, 0, -0.25); set(AR, -1.45, 0, 0.25); }
    else if (pose === 'wave') { set(AR, 0, 0, -2.7 + Math.sin(t * 10) * 0.35); }
    else if (pose === 'throw') { set(AR, -2.6, 0, -0.2); }
    // salle de sport : rameur, tractions, haltères, squats, cordes, abdos, yoga
    else if (pose === 'row') { const k2 = Math.sin(t * 3.2); set(AL, -1.5 + k2 * 0.4, 0, 0.15); set(AR, -1.5 + k2 * 0.4, 0, -0.15); set(L, -1.3 - k2 * 0.3, 0, 0.05); set(R, -1.3 - k2 * 0.3, 0, -0.05); lean = -0.2 - k2 * 0.25; bodyY = -0.4; }
    else if (pose === 'pullup') { const k2 = Math.max(0, Math.sin(t * 2.4)); set(AL, -3.0, 0, 0.25); set(AR, -3.0, 0, -0.25); set(L, 0.25, 0, 0); set(R, 0.25, 0, 0); bodyY = 0.35 + k2 * 0.45; }
    else if (pose === 'curl') { set(AL, -0.2, 0, 0.12); set(AR, -0.2, 0, -0.12); }
    else if (pose === 'squat') { const k2 = Math.max(0, Math.sin(t * 2.6)); set(L, -k2 * 1.2, 0, 0.1); set(R, -k2 * 1.2, 0, -0.1); set(AL, -1.2, 0, 0.1); set(AR, -1.2, 0, -0.1); bodyY = -k2 * 0.42; lean = k2 * 0.3; }
    else if (pose === 'ropes') { set(AL, -1.2 + Math.sin(t * 14) * 0.45, 0, 0.2); set(AR, -1.2 - Math.sin(t * 14) * 0.45, 0, -0.2); set(L, -0.35, 0, 0.12); set(R, -0.35, 0, -0.12); bodyY = -0.15; lean = 0.25; }
    else if (pose === 'situp') { const k2 = Math.max(0, Math.sin(t * 2.4)); bodyRotX = -1.4 + k2 * 1.0; bodyY = -0.62; set(L, -1.0, 0, 0.1); set(R, -1.0, 0, -0.1); set(AL, -2.6, 0, 0.5); set(AR, -2.6, 0, -0.5); }
    else if (pose === 'yoga') { bodyY = -0.6; set(L, -1.45, 0, 0.9); set(R, -1.45, 0, -0.9); set(AL, 0, 0, 2.9 + Math.sin(t) * 0.05); set(AR, 0, 0, -2.9 - Math.sin(t) * 0.05); }
    // exercices partout : burpees, jumping jacks, corde à sauter, étirements
    else if (pose === 'burpee') { const c = (t * 1.1) % 1; if (c < 0.33) { bodyY = -0.45; set(L, -1.3, 0, 0.1); set(R, -1.3, 0, -0.1); set(AL, -0.8, 0, 0.1); set(AR, -0.8, 0, -0.1); } else if (c < 0.66) { bodyRotX = 1.35; bodyY = -0.75; set(AL, -1.5, 0, 0.2); set(AR, -1.5, 0, -0.2); } else { bob = Math.sin((c - 0.66) / 0.34 * Math.PI) * 0.5; set(AL, 0, 0, 2.8); set(AR, 0, 0, -2.8); } }
    else if (pose === 'jacks') { const o = (Math.sin(t * 7) + 1) / 2; set(AL, 0, 0, 0.2 + o * 2.6); set(AR, 0, 0, -0.2 - o * 2.6); set(L, 0, 0, 0.05 + o * 0.35); set(R, 0, 0, -0.05 - o * 0.35); bob = Math.abs(Math.sin(t * 7)) * 0.12; }
    else if (pose === 'rope') { bob = Math.abs(Math.sin(t * 6.3)) * 0.2; set(AL, -0.5 + Math.sin(t * 12.6) * 0.3, 0, 0.5); set(AR, -0.5 + Math.sin(t * 12.6) * 0.3, 0, -0.5); set(L, 0.1, 0, 0.04); set(R, 0.1, 0, -0.04); }
    else if (pose === 'stretch') { const s2 = Math.sin(t * 0.9); set(AL, 0, 0, 2.9); set(AR, 0, 0, -2.9); lean = 0; headY = s2 * 0.35; lean = s2 * 0.15; }
    // boxe : garde, direct droit / gauche, crochet, coup encaissé
    else if (pose === 'guard') { set(AL, -1.95, 0, 0.42); set(AR, -1.95, 0, -0.42); headX = 0.15; }
    else if (pose === 'jab') { set(AR, -1.6, 0, 0.12); set(AL, -1.95, 0, 0.42); lean = 0.12; headY = -0.15; }
    else if (pose === 'jabL') { set(AL, -1.6, 0, -0.12); set(AR, -1.95, 0, -0.42); lean = 0.12; headY = 0.15; }
    else if (pose === 'hook') { set(AR, -1.45, -0.9, -1.1); set(AL, -1.95, 0, 0.42); lean = 0.18; headY = -0.35; }
    else if (pose === 'hit') { set(AL, -1.8, 0, 0.5); set(AR, -1.8, 0, -0.5); lean = -0.3; headX = -0.45; }
    else if (pose === 'celebrate') { set(AL, 0, 0, 2.7 + Math.sin(t * 12) * 0.2); set(AR, 0, 0, -2.7 - Math.sin(t * 12) * 0.2); bob = Math.abs(Math.sin(t * 8)) * 0.25; }
    else if (pose === 'cook') { set(AL, -1.1 + Math.sin(t * 12) * 0.2, 0, 0.2); set(AR, -1.1 - Math.sin(t * 12) * 0.2, 0, -0.2); }
    else if (pose === 'phone') { set(AR, -2.0, 0, 0.55); set(AL, -0.5, 0, -0.1); headX = 0.38; }
    else if (pose === 'pet') { set(AR, -0.9 + Math.sin(t * 6) * 0.15, 0, -0.2); bodyRotX = 0.35; }
    // gestes sportifs : frappe, tacle glissé, joueur au sol
    else if (pose === 'kick') { set(R, -1.75, 0, 0); set(L, 0.3, 0, 0); set(AL, -0.6, 0, 0.7); set(AR, -0.2, 0, -0.7); lean = -0.2; }
    else if (pose === 'slide') { set(L, -1.55, 0, 0.12); set(R, -1.25, 0, -0.12); set(AL, -0.2, 0, 1.3); set(AR, -0.2, 0, -1.3); bodyRotX = -1.05; bodyY = -0.5; }
    else if (pose === 'down') { set(L, -0.2, 0, 0.3); set(R, 0.1, 0, -0.3); set(AL, 0, 0, 2.2); set(AR, 0, 0, -2.2); bodyRotX = -1.45; bodyY = -0.62; headX = 0.3; }

    // coudes (avant-bras : négatif = plié vers l'avant) et genoux (tibias : positif = plié vers l'arrière)
    let eL = -0.14, eR = -0.14, kL = 0.04, kR = 0.04;
    if (m.swimming) { eL = eR = -0.3; kL = 0.25 + Math.max(0, Math.sin(t * 9)) * 0.4; kR = 0.25 + Math.max(0, -Math.sin(t * 9)) * 0.4; }
    else if (pose === 'sit' || pose === 'sit-eat') { kL = kR = 1.45; eL = eR = -0.5; }
    else if (pose === 'pedal') { kL = 1.5 + Math.sin(t * 8) * 0.45; kR = 1.5 - Math.sin(t * 8) * 0.45; eL = eR = -0.3; }
    else if (pose === 'bench') { kL = kR = 1.3; eL = eR = -0.6 - Math.sin(t * 2.6) * 0.5; }
    else if (pose === 'pushup') { kL = kR = 0; const pp = Math.sin(t * 3) * 0.5 + 0.5; eL = eR = -0.2 - pp * 0.8; }
    else if (pose === 'dance') { kL = 0.2 + Math.max(0, Math.sin(t * 7.5)) * 0.5; kR = 0.2 + Math.max(0, -Math.sin(t * 7.5)) * 0.5; eL = eR = -0.6; }
    else if (!m.grounded) { kL = 0.95; kR = 0.35; eL = eR = -0.5; }
    else if (moving) {
      const amp = 0.55 + run * 0.4;
      kL = (0.1 + Math.max(0, -Math.sin(ph + 0.9))) * amp * (1.2 + run * 0.9);
      kR = (0.1 + Math.max(0, Math.sin(ph + 0.9))) * amp * (1.2 + run * 0.9);
      eL = eR = -(0.2 + run * 0.9);
    }
    if (pose === 'kick') { kR = 0.15; kL = 0.35; eL = eR = -0.4; }
    else if (pose === 'slide') { kL = 0.15; kR = 0.5; eL = eR = -0.2; }
    else if (pose === 'down') { kL = 0.3; kR = 0.9; eL = eR = -0.3; }
    else if (pose === 'carry') { eL = eR = -0.45; }
    else if (pose === 'spray' || pose === 'hold-forward') { eL = eR = -0.15; }
    else if (pose === 'wave') { eR = -0.55 + Math.sin(t * 10) * 0.25; }
    else if (pose === 'eat' || pose === 'sit-eat') { eR = -1.0; }
    else if (pose === 'phone') { eR = -0.9; eL = -1.2; }
    else if (pose === 'cook') { eL = eR = -0.7; }
    else if (pose === 'celebrate') { eL = eR = -0.2; }
    else if (pose === 'throw') { eR = -0.6; }
    else if (pose === 'guard' || pose === 'hit') { eL = eR = -2.0; }
    else if (pose === 'curl') { eL = -0.3 - Math.max(0, Math.sin(t * 3)) * 2.0; eR = -0.3 - Math.max(0, -Math.sin(t * 3)) * 2.0; }
    else if (pose === 'row') { eL = eR = -0.4 - Math.max(0, -Math.sin(t * 3.2)) * 1.4; kL = kR = 1.2 + Math.sin(t * 3.2) * 0.4; }
    else if (pose === 'pullup') { eL = eR = -0.4 - Math.max(0, Math.sin(t * 2.4)) * 1.6; }
    else if (pose === 'squat') { const k2 = Math.max(0, Math.sin(t * 2.6)); kL = kR = k2 * 2.0; eL = eR = -0.3; }
    else if (pose === 'situp') { kL = kR = 1.9; eL = eR = -2.2; }
    else if (pose === 'yoga') { kL = kR = 2.3; eL = eR = -0.1; }
    else if (pose === 'jab') { eR = -0.05; eL = -2.0; }
    else if (pose === 'jabL') { eL = -0.05; eR = -2.0; }
    else if (pose === 'hook') { eR = -1.4; eL = -2.0; }
    set(this.foreL.rotation, eL, 0, 0); set(this.foreR.rotation, eR, 0, 0);
    set(this.shinL.rotation, kL, 0, 0); set(this.shinR.rotation, kR, 0, 0);

    // démarche naturelle : bassin qui se balance d'un pied sur l'autre, épaules en contre-rotation,
    // tête stabilisée ; à l'arrêt, transfert du poids lent d'une jambe sur l'autre et respiration.
    const plain = !m.swimming && m.grounded !== false && (pose === 'idle' || pose === 'carry' || pose === 'phone' || pose === 'wave' || pose === 'hold-forward');
    let swayX = 0, roll = 0, twist = 0;
    if (plain && moving) { swayX = Math.sin(ph) * (0.03 - run * 0.015); roll = Math.sin(ph) * 0.035; twist = Math.sin(ph) * (0.07 + run * 0.06); }
    else if (plain) { const w8 = Math.sin(t * 0.45); swayX = w8 * 0.025; roll = -w8 * 0.02; headY += Math.sin(t * 0.23 + 1) * 0.12; }
    this.body.position.x += (swayX - this.body.position.x) * Math.min(1, k * 3);
    this.body.rotation.z += (roll - this.body.rotation.z) * Math.min(1, k * 3);
    this.hips.rotation.y += (twist - this.hips.rotation.y) * Math.min(1, k * 3);
    headY -= this.hips.rotation.y * 0.8;
    this.body.position.y += ((bob + bodyY) - this.body.position.y) * Math.min(1, k * 3);
    this.body.rotation.x += ((lean + bodyRotX) - this.body.rotation.x) * k * 1.5;
    this.neck.rotation.x += (headX - this.neck.rotation.x) * k;
    this.neck.rotation.y += (headY - this.neck.rotation.y) * k;
    this.hips.scale.y = 1 + (moving ? 0 : Math.sin(t * 1.7) * 0.008);   // respiration
  }

  dispose() {
    for (const m of this.meshes) m.geometry.dispose();
    this.root.removeFromParent();
  }
}

