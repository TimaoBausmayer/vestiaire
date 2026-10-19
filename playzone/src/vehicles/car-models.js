import * as THREE from 'three';
import { VEHICLES } from '../../shared/content/vehicles.js';

// MODÈLES 3D DES VÉHICULES, construits en code (aucun fichier à télécharger).
// Carrosserie = profil latéral extrudé avec arrondis (passages de roues découpés), habitacle vitré,
// montants, rétroviseurs, pare-chocs, phares, feux, poignées, plaques, sièges et tableau de bord.
// Tout le véhicule tient dans UN maillage : les roues tournent / braquent et la portière conducteur
// s'ouvre dans le shader (attribut `cwheel`), les feux s'allument et la carrosserie se bosselle
// via des uniformes. Les vitres forment un 2e maillage (transparent).

// Matériaux : [peinture (0/1), rugosité, métal, code lumière]
// codes lumière : 1 phare · 2 feu arrière/stop · 3 recul · 4 gyrophare bleu · 5 gyrophare rouge · 6 clignotant · 7 enseigne
const M = {
  paint: [1, 0.32, 0.35, 0], paintMatte: [1, 0.62, 0.05, 0], plastic: [0, 0.72, 0, 0], trim: [0, 0.45, 0.25, 0],
  chrome: [0, 0.12, 1, 0], rubber: [0, 0.93, 0, 0], rim: [0, 0.26, 0.85, 0], interior: [0, 0.88, 0, 0],
  head: [0, 0.08, 0.2, 1], tail: [0, 0.18, 0.05, 2], reverse: [0, 0.2, 0.05, 3], blue: [0, 0.2, 0, 4], red: [0, 0.2, 0, 5],
  amber: [0, 0.3, 0, 6], sign: [0, 0.4, 0, 7], matte: [0, 0.8, 0, 0], skin: [0, 0.7, 0, 0], glassO: [0, 0.06, 0.55, 0],
};
export const CAR_MATS = M;

// ---------------------------------------------------------------------------------------------
// Assemblage : chaque pièce ajoute des sommets (position, normale, couleur, matériau, roue)
const _m = new THREE.Matrix4(), _nm = new THREE.Matrix3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

const baseCache = new Map();
function prim(key, make) {
  let g = baseCache.get(key);
  if (!g) {
    let geo = make();
    if (geo.index) geo = geo.toNonIndexed();
    if (!geo.attributes.normal) geo.computeVertexNormals();
    g = { pos: geo.attributes.position.array, nor: geo.attributes.normal.array };
    baseCache.set(key, g);
  }
  return g;
}
const P = {
  box: () => prim('box', () => new THREE.BoxGeometry(1, 1, 1)),
  // boîte aux arêtes arrondies (biseau) : pour pare-chocs, phares, coffres...
  rbox: (seg = 2) => prim(`rbox${seg}`, () => roundedBox(seg)),
  cyl: (n = 12) => prim(`cyl${n}`, () => new THREE.CylinderGeometry(0.5, 0.5, 1, n)),
  cone: (n = 10) => prim(`cone${n}`, () => new THREE.ConeGeometry(0.5, 1, n)),
  sph: (n = 10) => prim(`sph${n}`, () => new THREE.SphereGeometry(0.5, n, Math.max(4, (n * 0.6) | 0))),
  torus: (n = 16) => prim(`tor${n}`, () => new THREE.TorusGeometry(0.5, 0.09, 6, n)),
};

function roundedBox(seg) {
  // cube unité aux arêtes biseautées, obtenu en "gonflant" un cube subdivisé vers une forme arrondie
  const g = new THREE.BoxGeometry(1, 1, 1, seg + 2, seg + 2, seg + 2);
  const p = g.attributes.position;
  const r = 0.18, h = 0.5 - r, v = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    c.set(Math.max(-h, Math.min(h, v.x)), Math.max(-h, Math.min(h, v.y)), Math.max(-h, Math.min(h, v.z)));
    v.sub(c).normalize().multiplyScalar(r).add(c);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

class CarBuilder {
  constructor(detail = 1) {
    this.detail = detail;  // 1 = complet, 0 = version lointaine
    this.body = { P: [], N: [], C: [], A: [], W: [] };
    this.glass = { P: [], N: [] };
  }

  // Ajoute des sommets bruts (Float32Array) transformés par la matrice.
  raw(pos, nor, matrix, color, mat = M.plastic, wheel = null, target = this.body) {
    _nm.getNormalMatrix(matrix);
    const e = matrix.elements, ne = _nm.elements;
    _c.set(color || '#ffffff');
    const w = wheel || [0, 0, 0, 0];
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i], y = pos[i + 1], z = pos[i + 2];
      const px = e[0] * x + e[4] * y + e[8] * z + e[12], py = e[1] * x + e[5] * y + e[9] * z + e[13], pz = e[2] * x + e[6] * y + e[10] * z + e[14];
      target.P.push(px, py, pz);
      const nx = nor[i], ny = nor[i + 1], nz = nor[i + 2];
      const tx = ne[0] * nx + ne[3] * ny + ne[6] * nz, ty = ne[1] * nx + ne[4] * ny + ne[7] * nz, tz = ne[2] * nx + ne[5] * ny + ne[8] * nz;
      const l = Math.hypot(tx, ty, tz) || 1;
      target.N.push(tx / l, ty / l, tz / l);
      if (target === this.body) {
        target.C.push(_c.r, _c.g, _c.b);
        target.A.push(mat[0], mat[1], mat[2], mat[3]);
        target.W.push(w[0], w[1], w[2], w[3]);
      }
    }
  }

  // o = { x,y,z (centre), sx,sy,sz, rx,ry,rz, color, mat, wheel, glass }
  add(shape, o) {
    _e.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ');
    _q.setFromEuler(_e);
    _s.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1);
    _p.set(o.x || 0, o.y || 0, o.z || 0);
    _m.compose(_p, _q, _s);
    this.raw(shape.pos, shape.nor, _m, o.color, o.mat, o.wheel, o.glass ? this.glass : this.body);
  }

  box(x, y, z, sx, sy, sz, color, mat = M.plastic, extra = {}) { this.add(P.box(), { x, y, z, sx, sy, sz, color, mat, ...extra }); }
  rbox(x, y, z, sx, sy, sz, color, mat = M.plastic, extra = {}) { this.add(this.detail ? P.rbox() : P.box(), { x, y, z, sx, sy, sz, color, mat, ...extra }); }
  // Bande entre deux points du profil (z,y) sur un côté x : montants de pare-brise, liserés...
  strip(x, a, b, width, thick, color, mat, extra = {}) {
    const dz = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dz, dy);
    this.add(P.box(), { x, y: (a[1] + b[1]) / 2, z: (a[0] + b[0]) / 2, sx: thick, sy: len, sz: width, rx: Math.atan2(dz, dy), color, mat, ...extra });
  }

  // Pavé aux arêtes arrondies d'un rayon fixe (pour les grosses pièces : caisse de camion...).
  slab(x, y, z, w, hgt, d, color, mat = M.plastic, bevel = 0.06) {
    const g = extrudeSide([[d / 2, -hgt / 2], [d / 2, hgt / 2], [-d / 2, hgt / 2], [-d / 2, -hgt / 2]], w, { bevel: this.detail ? bevel : 0, seg: 2, detail: this.detail });
    g.translate(x, y, z);
    this.geo(g, color, mat);
  }

  geo(geometry, color, mat, target) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    creaseNormals(g, 0.75);
    _m.identity();
    this.raw(g.attributes.position.array, g.attributes.normal.array, _m, color, mat, null, target);
  }

  // Déformation douce de la caisse (sauf roues) : coins arrondis vus du dessus, flancs qui rentrent
  // vers le toit. Donne des formes plus organiques qu'une simple extrusion.
  deform(fn) {
    const b = this.body;
    for (let i = 0, v = 0; i < b.P.length; i += 3, v += 4) {
      if (b.W[v + 3] > 0.5 && b.W[v + 3] < 2.5) continue;
      b.P[i] *= fn(b.P[i + 1], b.P[i + 2]);
    }
    const g = this.glass;
    for (let i = 0; i < g.P.length; i += 3) g.P[i] *= fn(g.P[i + 1], g.P[i + 2]);
  }

  build() {
    const b = this.body;
    const body = new THREE.BufferGeometry();
    body.setAttribute('position', new THREE.Float32BufferAttribute(b.P, 3));
    body.setAttribute('normal', new THREE.Float32BufferAttribute(b.N, 3));
    body.setAttribute('color', new THREE.Float32BufferAttribute(b.C, 3));
    body.setAttribute('cpart', new THREE.Float32BufferAttribute(b.A, 4));
    body.setAttribute('cwheel', new THREE.Float32BufferAttribute(b.W, 4));
    body.computeBoundingSphere();
    body.computeBoundingBox();
    let glass = null;
    if (this.glass.P.length) {
      glass = new THREE.BufferGeometry();
      glass.setAttribute('position', new THREE.Float32BufferAttribute(this.glass.P, 3));
      glass.setAttribute('normal', new THREE.Float32BufferAttribute(this.glass.N, 3));
      glass.computeBoundingSphere();
    }
    return { body, glass };
  }
}

// Normales lissées sauf sur les arêtes vives (angle > seuil) : carrosserie arrondie mais flancs nets.
function creaseNormals(g, angle) {
  const pos = g.attributes.position.array;
  const n = pos.length / 9;
  const faceN = new Float32Array(n * 3);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let f = 0; f < n; f++) {
    a.fromArray(pos, f * 9); b.fromArray(pos, f * 9 + 3); c.fromArray(pos, f * 9 + 6);
    b.sub(a); c.sub(a); b.cross(c);
    const l = b.length() || 1;
    faceN[f * 3] = b.x / l; faceN[f * 3 + 1] = b.y / l; faceN[f * 3 + 2] = b.z / l;
  }
  const key = (i) => `${Math.round(pos[i] * 1000)},${Math.round(pos[i + 1] * 1000)},${Math.round(pos[i + 2] * 1000)}`;
  const groups = new Map();
  for (let v = 0; v < n * 3; v++) {
    const k = key(v * 3);
    let arr = groups.get(k);
    if (!arr) { arr = []; groups.set(k, arr); }
    arr.push(v);
  }
  const cos = Math.cos(angle);
  const out = new Float32Array(n * 9);
  for (const arr of groups.values()) {
    for (const v of arr) {
      const f = (v / 3) | 0;
      let x = 0, y = 0, z = 0;
      for (const w of arr) {
        const g2 = (w / 3) | 0;
        const d = faceN[f * 3] * faceN[g2 * 3] + faceN[f * 3 + 1] * faceN[g2 * 3 + 1] + faceN[f * 3 + 2] * faceN[g2 * 3 + 2];
        if (d >= cos) { x += faceN[g2 * 3]; y += faceN[g2 * 3 + 1]; z += faceN[g2 * 3 + 2]; }
      }
      const l = Math.hypot(x, y, z) || 1;
      out[v * 3] = x / l; out[v * 3 + 1] = y / l; out[v * 3 + 2] = z / l;
    }
  }
  g.setAttribute('normal', new THREE.BufferAttribute(out, 3));
}

// Profil latéral (z vers l'avant, y vers le haut) extrudé sur la largeur, centré en x.
// top : contour de l'avant-bas vers l'arrière-bas en passant par le dessus. arches : passages de roues.
function extrudeSide(top, width, { bottom = null, arches = [], bevel = 0.06, seg = 3, curve = 12, detail = 1 } = {}) {
  const s = new THREE.Shape();
  s.moveTo(top[0][0], top[0][1]);
  for (let i = 1; i < top.length; i++) s.lineTo(top[i][0], top[i][1]);
  if (bottom !== null) {
    for (const a of [...arches].sort((u, v) => u.z - v.z)) {
      const dy = bottom - a.y;
      const dz = Math.sqrt(Math.max(0.0001, a.R * a.R - dy * dy));
      s.lineTo(a.z - dz, bottom);
      s.absarc(a.z, a.y, a.R, Math.atan2(dy, -dz), Math.atan2(dy, dz), true);
    }
  }
  const bt = detail ? bevel : 0;
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: width - 2 * bt, bevelEnabled: !!detail && bevel > 0, bevelThickness: bt, bevelSize: bt * 0.8,
    bevelSegments: detail ? seg : 1, curveSegments: detail ? curve : 4, steps: 1,
  });
  geo.deleteAttribute('uv');
  geo.rotateY(-Math.PI / 2);
  geo.translate((width - 2 * bt) / 2, 0, 0);
  return geo;
}

// ---------------------------------------------------------------------------------------------
// Roues : pneu (profil arrondi tourné), jante à branches, moyeu, disque de frein.
function addWheel(cb, x, y, z, r, w, kind, style = 'spokes', rimColor = '#c9ced6') {
  const side = Math.sign(x) || 1;
  const wheel = [x, y, z, kind];
  const n = cb.detail ? 18 : 9;
  const tire = prim(`tire${n}`, () => {
    const pts = [[0.62, -0.5], [0.86, -0.5], [0.96, -0.4], [1, -0.2], [1, 0.2], [0.96, 0.4], [0.86, 0.5], [0.62, 0.5]].map(([a, b]) => new THREE.Vector2(a * 0.5, b));
    return new THREE.LatheGeometry(pts, n).rotateZ(Math.PI / 2);
  });
  cb.add(tire, { x, y, z, sx: w, sy: r * 2, sz: r * 2, color: '#17171c', mat: M.rubber, wheel });
  // flanc intérieur / disque de frein
  cb.add(P.cyl(n), { x: x - side * w * 0.1, y, z, sx: r * 1.25, sy: w * 0.7, sz: r * 1.25, rz: Math.PI / 2, color: '#3a3c42', mat: M.trim, wheel });
  if (!cb.detail) { cb.add(P.cyl(8), { x: x + side * w * 0.42, y, z, sx: r * 1.2, sy: 0.02, sz: r * 1.2, rz: Math.PI / 2, color: rimColor, mat: M.rim, wheel }); return; }
  const fx = x + side * w * 0.36;
  cb.add(P.cyl(16), { x: fx, y, z, sx: r * 1.24, sy: 0.03, sz: r * 1.24, rz: Math.PI / 2, color: '#2a2c31', mat: M.trim, wheel });
  cb.add(P.torus(18), { x: fx + side * 0.01, y, z, sx: r * 1.18, sy: r * 1.18, sz: 0.25, ry: Math.PI / 2, color: rimColor, mat: M.rim, wheel });
  const spokes = style === 'steel' ? 0 : style === 'sport' ? 10 : 5;
  if (style === 'steel') cb.add(P.cyl(14), { x: fx + side * 0.012, y, z, sx: r * 1.05, sy: 0.02, sz: r * 1.05, rz: Math.PI / 2, color: '#8e939b', mat: M.rim, wheel });
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    cb.add(P.box(), { x: fx + side * 0.015, y: y + Math.cos(a) * r * 0.3, z: z + Math.sin(a) * r * 0.3, sx: 0.03, sy: r * 0.6, sz: style === 'sport' ? 0.035 : 0.08, rx: -a, color: rimColor, mat: M.rim, wheel });
  }
  cb.add(P.cyl(10), { x: fx + side * 0.025, y, z, sx: r * 0.32, sy: 0.04, sz: r * 0.32, rz: Math.PI / 2, color: '#e3e6ea', mat: M.chrome, wheel });
}

// ---------------------------------------------------------------------------------------------
// Gabarits de carrosserie (dimensions en mètres)
//  top : profil supérieur (avant-bas -> arrière-bas) · gh : habitacle vitré · zF/zR : essieux
const BODIES = {
  micro: {
    L: 2.8, W: 1.6, r: 0.28, ww: 0.2, track: 0.66, zF: 0.92, zR: -0.88, clear: 0.2, rim: 'steel',
    top: [[1.28, 0.2], [1.4, 0.33], [1.4, 0.62], [1.32, 0.76], [1.0, 0.88], [0.72, 0.95], [-1.2, 0.98], [-1.38, 0.95], [-1.4, 0.4], [-1.3, 0.2]],
    gh: [[0.74, 0.92], [0.12, 1.52], [-0.75, 1.56], [-1.26, 1.5], [-1.34, 0.95]],
    doors: 2, seat: { x: 0.36, z: -0.18, y: 0.04, s: 0.82 }, bPillar: -0.45,
  },
  hatch: {
    L: 3.95, W: 1.74, r: 0.31, ww: 0.21, track: 0.7, zF: 1.32, zR: -1.22, clear: 0.2, rim: 'spokes',
    top: [[1.85, 0.2], [1.97, 0.34], [1.98, 0.6], [1.9, 0.72], [1.4, 0.83], [0.9, 0.94], [-1.7, 0.98], [-1.93, 0.96], [-1.98, 0.85], [-1.98, 0.4], [-1.88, 0.2]],
    gh: [[0.92, 0.91], [0.1, 1.42], [-0.9, 1.46], [-1.6, 1.4], [-1.88, 0.95]],
    doors: 2, seat: { x: 0.38, z: -0.1, y: 0.02, s: 0.84 }, bPillar: -0.5,
  },
  sedan: {
    L: 4.6, W: 1.82, r: 0.33, ww: 0.22, track: 0.74, zF: 1.45, zR: -1.38, clear: 0.22, rim: 'spokes',
    top: [[2.17, 0.22], [2.29, 0.36], [2.31, 0.62], [2.23, 0.74], [1.5, 0.85], [0.92, 0.94], [-1.5, 0.96], [-1.85, 0.99], [-2.22, 0.97], [-2.3, 0.86], [-2.3, 0.4], [-2.2, 0.22]],
    gh: [[0.94, 0.91], [0.12, 1.42], [-0.3, 1.45], [-0.92, 1.42], [-1.55, 0.93]],
    doors: 4, seat: { x: 0.4, z: -0.05, y: 0.02, s: 0.85 }, bPillar: -0.2,
  },
  wagon: {
    L: 4.75, W: 1.82, r: 0.33, ww: 0.22, track: 0.74, zF: 1.5, zR: -1.42, clear: 0.22, rim: 'spokes',
    top: [[2.25, 0.22], [2.36, 0.36], [2.38, 0.62], [2.3, 0.74], [1.55, 0.85], [0.95, 0.94], [-2.2, 1.0], [-2.36, 0.96], [-2.38, 0.4], [-2.28, 0.22]],
    gh: [[0.97, 0.91], [0.15, 1.44], [-1.0, 1.48], [-2.0, 1.46], [-2.3, 1.36], [-2.33, 0.96]],
    doors: 4, seat: { x: 0.4, z: -0.02, y: 0.02, s: 0.85 }, bPillar: -0.2, rails: true,
  },
  sport: {
    L: 4.45, W: 1.96, r: 0.34, ww: 0.27, track: 0.8, zF: 1.42, zR: -1.36, clear: 0.13, rim: 'sport',
    top: [[2.1, 0.14], [2.23, 0.26], [2.25, 0.42], [2.12, 0.55], [1.3, 0.7], [0.6, 0.8], [-0.95, 0.84], [-1.6, 0.86], [-2.12, 0.9], [-2.23, 0.82], [-2.24, 0.36], [-2.12, 0.14]],
    gh: [[0.62, 0.77], [-0.25, 1.16], [-0.75, 1.18], [-1.75, 0.86]],
    doors: 2, seat: { x: 0.42, z: -0.55, y: -0.06, s: 0.82 }, bPillar: -1.0, spoiler: true, scoop: true,
  },
  coupe: {
    L: 4.5, W: 1.86, r: 0.33, ww: 0.24, track: 0.76, zF: 1.45, zR: -1.35, clear: 0.17, rim: 'sport',
    top: [[2.13, 0.18], [2.25, 0.3], [2.27, 0.55], [2.18, 0.67], [1.4, 0.78], [0.72, 0.88], [-1.4, 0.92], [-2.0, 0.95], [-2.22, 0.9], [-2.26, 0.4], [-2.15, 0.18]],
    gh: [[0.74, 0.85], [-0.08, 1.3], [-0.7, 1.32], [-1.55, 0.9]],
    doors: 2, seat: { x: 0.4, z: -0.4, y: -0.02, s: 0.84 }, bPillar: -0.95,
  },
  suv: {
    L: 4.75, W: 1.96, r: 0.4, ww: 0.27, track: 0.8, zF: 1.5, zR: -1.42, clear: 0.42, rim: 'spokes', arch: 0.1,
    top: [[2.25, 0.42], [2.36, 0.55], [2.38, 0.95], [2.28, 1.08], [1.5, 1.18], [1.05, 1.26], [-2.15, 1.3], [-2.36, 1.26], [-2.38, 0.55], [-2.28, 0.42]],
    gh: [[1.07, 1.22], [0.3, 1.82], [-1.0, 1.86], [-2.0, 1.84], [-2.3, 1.7], [-2.33, 1.27]],
    doors: 4, seat: { x: 0.42, z: 0.12, y: 0.32, s: 0.88 }, bPillar: -0.05, rails: true, cladding: true, spare: true,
  },
  pickup: {
    L: 5.3, W: 1.98, r: 0.41, ww: 0.27, track: 0.8, zF: 1.85, zR: -1.65, clear: 0.42, rim: 'steel', arch: 0.1,
    top: [[2.53, 0.42], [2.64, 0.56], [2.66, 0.98], [2.56, 1.1], [1.8, 1.18], [1.15, 1.26], [-0.62, 1.28], [-0.66, 0.98], [-2.6, 0.98], [-2.66, 0.9], [-2.66, 0.55], [-2.56, 0.42]],
    gh: [[1.17, 1.22], [0.45, 1.86], [-0.35, 1.88], [-0.58, 1.84], [-0.6, 1.27]],
    doors: 4, seat: { x: 0.42, z: 0.38, y: 0.34, s: 0.88 }, bPillar: 0.22, bed: { z1: -0.66, z2: -2.62, floor: 0.98, top: 1.42 }, cladding: true,
  },
  van: {
    L: 5.1, W: 2.0, r: 0.36, ww: 0.24, track: 0.8, zF: 1.78, zR: -1.6, clear: 0.28, rim: 'steel',
    top: [[2.42, 0.28], [2.54, 0.42], [2.56, 0.85], [2.45, 0.98], [2.05, 1.08], [1.68, 1.18], [-2.52, 1.2], [-2.55, 1.15], [-2.56, 0.45], [-2.46, 0.28]],
    gh: [[1.7, 1.14], [1.0, 2.22], [-2.3, 2.3], [-2.5, 2.25], [-2.52, 1.18]],
    doors: 2, seat: { x: 0.42, z: 0.95, y: 0.2, s: 0.88 }, bPillar: 0.72, panelVan: 0.55,
  },
  box: {
    L: 6.3, W: 2.15, r: 0.43, ww: 0.28, track: 0.86, zF: 2.25, zR: -1.75, clear: 0.42, rim: 'steel', arch: 0.08,
    top: [[3.02, 0.42], [3.14, 0.56], [3.16, 1.0], [3.05, 1.14], [2.6, 1.22], [2.22, 1.3], [1.1, 1.32], [1.1, 0.95], [-3.1, 0.95], [-3.15, 0.5], [-3.05, 0.42]],
    gh: [[2.24, 1.26], [1.65, 2.28], [1.18, 2.32], [1.14, 1.3]],
    doors: 2, seat: { x: 0.45, z: 1.62, y: 0.36, s: 0.9 }, bPillar: null, cargo: { z1: 1.0, z2: -3.15, y1: 0.95, y2: 3.0 },
  },
  bus: {
    L: 10.6, W: 2.5, r: 0.5, ww: 0.3, track: 1.0, zF: 3.6, zR: -2.9, clear: 0.32, rim: 'steel',
    top: [[5.2, 0.32], [5.3, 0.5], [5.3, 1.0], [5.22, 1.12], [-5.24, 1.12], [-5.3, 1.0], [-5.3, 0.5], [-5.2, 0.32]],
    gh: [[5.24, 1.08], [5.12, 2.75], [5.0, 2.85], [-5.15, 2.85], [-5.25, 2.7], [-5.26, 1.08]],
    doors: 0, seat: { x: 0.6, z: 4.3, y: 0.3, s: 0.9 }, bus: true,
  },
};

// Apparence d'un modèle du catalogue : gabarit + éventuelle livrée.
export function bodyOf(model) { return BODIES[VEHICLES[model]?.body] || null; }

// Siège conducteur (pour asseoir le personnage) : { x, y, z, s (échelle), pose }
export function seatOf(model) {
  const spec = VEHICLES[model];
  if (!spec) return { x: 0, y: 0.5, z: 0, s: 1, pose: 'sit' };
  if (spec.kind === 'car') return { ...BODIES[spec.body].seat, pose: 'sit' };
  return {
    board: { x: 0, y: 0.18, z: -0.1, s: 1, pose: 'hold-forward' },
    caddie: { x: 0, y: 0.62, z: -0.05, s: 1, pose: 'sit' },
    bike: { x: 0, y: 0.62, z: -0.2, s: 1, pose: 'sit' },
    scooter: { x: 0, y: 0.6, z: -0.25, s: 1, pose: 'sit' },
    moto: { x: 0, y: 0.68, z: -0.2, s: 1, pose: 'sit' },
  }[spec.kind];
}

// Dimensions utiles à la physique et aux collisions.
export function dimsOf(model) {
  const spec = VEHICLES[model];
  if (spec?.kind === 'car') { const b = BODIES[spec.body]; return { L: b.L, W: b.W, r: b.r, zF: b.zF, zR: b.zR, track: b.track }; }
  return { board: { L: 1.1, W: 0.4, r: 0.11, zF: 0.5, zR: -0.45, track: 0 }, caddie: { L: 1.3, W: 0.8, r: 0.08, zF: 0.4, zR: -0.4, track: 0.3 }, bike: { L: 1.8, W: 0.6, r: 0.34, zF: 0.62, zR: -0.55, track: 0 }, scooter: { L: 1.8, W: 0.7, r: 0.25, zF: 0.62, zR: -0.55, track: 0 }, moto: { L: 2.1, W: 0.8, r: 0.32, zF: 0.75, zR: -0.68, track: 0 } }[spec?.kind] || { L: 2, W: 1, r: 0.3, zF: 0.6, zR: -0.6, track: 0.5 };
}

// ---------------------------------------------------------------------------------------------
function buildCar(cb, model, opts) {
  const spec = VEHICLES[model];
  const B = BODIES[spec.body];
  const det = cb.detail;
  const { L, W, r, zF, zR, clear } = B;
  const R = r + (B.arch ?? 0.07) + 0.03;
  const livery = spec.livery;
  const paintCol = '#ffffff';
  // --- caisse
  const lower = extrudeSide(B.top, W, { bottom: clear, arches: [{ z: zF, y: r, R }, { z: zR, y: r, R }], bevel: 0.07, detail: det });
  cb.geo(lower, paintCol, M.paint);
  // dessous de caisse et intérieur des passages de roues (sombres)
  cb.box(0, clear + 0.06, (zF + zR) / 2, W - 0.2, 0.1, Math.abs(zF - zR) - 2 * R + 0.1, '#202226', M.matte);
  for (const az of [zF, zR]) cb.box(0, r + 0.05, az, W - 2 * B.ww - 0.12, r * 1.6, R * 1.8, '#1c1d21', M.matte);

  // --- habitacle vitré + toit + montants
  const gh = B.gh;
  const ghW = W - (B.bus ? 0.06 : spec.body === 'van' || spec.body === 'box' ? 0.12 : 0.26);
  const ghGeo = extrudeSide(gh, ghW, { bevel: det ? 0.05 : 0, seg: 2, detail: det });
  if (det) cb.geo(ghGeo, '#ffffff', M.plastic, cb.glass); else cb.geo(ghGeo, '#24303c', M.glassO);
  const roofY = Math.max(...gh.map((p) => p[1]));
  const ghFront = gh[0][0], ghRear = gh[gh.length - 1][0];
  // toit : on suit les points hauts du profil
  const roofPts = gh.filter((p) => p[1] > roofY - 0.2);
  if (roofPts.length >= 2) {
    const rf = roofPts[0][0], rr = roofPts[roofPts.length - 1][0];
    const roofTop = roofPts.map(([z, y]) => [z, y + 0.035]);
    const roofShape = [...roofTop, [rr + 0.06, roofPts[roofPts.length - 1][1] - 0.05], [rf - 0.06, roofPts[0][1] - 0.05]];
    const roof = extrudeSide([...roofShape, roofShape[0]], ghW + 0.03, { bevel: det ? 0.03 : 0, seg: 2, detail: det });
    cb.geo(roof, paintCol, livery === 'police' || livery === 'taxi' ? M.paint : M.paint);
  }
  const sideX = ghW / 2 + (det ? 0.006 : 0.004);
  const pillarCol = B.bus || spec.body === 'van' || spec.body === 'box' ? '#ffffff' : '#ffffff';
  const pillarMat = M.paint;
  for (const sx of [-1, 1]) {
    // contour des fenêtres (montants A, C, bas de vitre)
    for (let i = 0; i < gh.length - 1; i++) cb.strip(sx * sideX, gh[i], gh[i + 1], 0.085, 0.03, pillarCol, pillarMat);
    cb.strip(sx * (sideX + 0.004), [ghRear, gh[gh.length - 1][1] + 0.03], [ghFront, gh[0][1] + 0.03], 0.05, 0.03, '#d0d4da', M.chrome);
    if (B.bPillar !== null && B.bPillar !== undefined) cb.strip(sx * sideX, [B.bPillar, gh[0][1]], [B.bPillar - 0.05, roofY], 0.11, 0.03, '#1b1c20', M.trim);
  }
  // montants des vans / bus : panneaux pleins sur l'arrière
  if (B.panelVan !== undefined) {
    for (const sx of [-1, 1]) cb.box(sx * (ghW / 2 + 0.01), (gh[0][1] + roofY) / 2, (B.panelVan + ghRear) / 2, 0.03, roofY - gh[0][1] + 0.02, B.panelVan - ghRear, paintCol, M.paint);
  }
  if (B.bus) {
    for (let z = 4.2; z > -5.0; z -= 1.3) for (const sx of [-1, 1]) cb.box(sx * (ghW / 2 + 0.01), (gh[0][1] + roofY) / 2, z, 0.04, roofY - gh[0][1], 0.12, '#f4f1ea', M.paint);
    for (const sx of [-1, 1]) cb.box(sx * (ghW / 2 + 0.015), 1.25, 0, 0.03, 0.25, L - 0.4, '#f4f1ea', M.paintMatte);
    // portes du bus (côté droit = -x)
    for (const dz of [4.2, -0.6]) cb.box(-(W / 2 + 0.01), 1.45, dz, 0.03, 2.5, 1.1, '#2b2d42', M.trim);
    cb.box(0, 2.6, 5.27, 1.6, 0.25, 0.04, '#111', M.matte); // girouette
    cb.box(0, 2.6, 5.29, 1.4, 0.16, 0.02, '#ffb703', M.sign);
  }

  // --- avant : calandre, phares, pare-chocs, plaque
  const front = B.top[2][0] + 0.06, rear = B.top[B.top.length - 3][0] - 0.06;
  const noseY = B.top[2][1], tailY = B.top[B.top.length - 3][1];
  const hfY = (B.top[1][1] + B.top[3][1]) / 2 + 0.06;
  const isTall = ['suv', 'pickup', 'van', 'box', 'bus'].includes(spec.body);
  cb.rbox(0, clear + 0.17, front - 0.02, W * 0.96, 0.22, 0.14, '#2a2b30', M.plastic);                // pare-chocs avant
  cb.rbox(0, clear + 0.17, rear + 0.02, W * 0.96, 0.22, 0.14, '#2a2b30', M.plastic);                 // pare-chocs arrière
  cb.rbox(0, hfY - 0.06, front + 0.005, W * (isTall ? 0.5 : 0.36), isTall ? 0.3 : 0.14, 0.04, '#141519', M.trim); // calandre
  if (det && isTall) for (let i = 0; i < 4; i++) cb.box(0, hfY - 0.16 + i * 0.07, front + 0.03, W * 0.48, 0.015, 0.01, '#9aa0a8', M.chrome);
  for (const sx of [-1, 1]) {
    cb.rbox(sx * (W / 2 - 0.27), hfY, front - 0.01, 0.36, isTall ? 0.2 : 0.13, 0.08, '#fffbe8', M.head);
    cb.box(sx * (W / 2 - 0.1), hfY - 0.02, front - 0.035, 0.1, 0.06, 0.06, '#ff9f1c', M.amber);
    cb.rbox(sx * (W / 2 - 0.22), tailY - 0.12, rear + 0.01, 0.34, isTall ? 0.24 : 0.13, 0.07, '#b3121f', M.tail);
    cb.box(sx * (W / 2 - 0.47), tailY - 0.12, rear + 0.025, 0.1, 0.08, 0.04, '#f4f4f4', M.reverse);
    cb.box(sx * (W / 2 - 0.05), tailY - 0.12, rear + 0.04, 0.06, 0.07, 0.03, '#ff9f1c', M.amber);
    if (det) cb.rbox(sx * (W / 2 - 0.3), clear + 0.1, front + 0.01, 0.14, 0.07, 0.04, '#e9edf2', M.head); // antibrouillards
  }
  cb.box(0, clear + 0.26, front + 0.06, 0.5, 0.12, 0.02, '#f4f4ef', M.plastic); // plaque avant
  cb.box(0, tailY - 0.3, rear - 0.02, 0.5, 0.12, 0.02, '#f4f4ef', M.plastic);   // plaque arrière
  if (det) {
    cb.box(-0.21, clear + 0.26, front + 0.072, 0.04, 0.1, 0.005, '#2448b8', M.plastic);
    cb.box(-0.21, tailY - 0.3, rear - 0.032, 0.04, 0.1, 0.005, '#2448b8', M.plastic);
    cb.add(P.cyl(8), { x: W / 2 - 0.45, y: clear + 0.08, z: rear - 0.05, sx: 0.08, sy: 0.2, sz: 0.08, rx: Math.PI / 2, color: '#8b9097', mat: M.chrome }); // échappement
  }
  // essuie-glaces
  if (det) for (const sx of [-0.3, 0.32]) cb.strip(sx, [ghFront - 0.06, gh[0][1] + 0.04], [ghFront - 0.25, gh[0][1] + 0.12], 0.03, 0.03, '#111', M.matte);

  // --- flancs : rétroviseurs, portes, poignées, liserés
  const doorF = zF - R - 0.06;
  const doorR = B.doors === 4 ? zR + R + 0.06 : doorF - (B.L > 4.3 ? 1.35 : 1.15);
  const mid = B.doors === 4 ? (B.bPillar ?? (doorF + doorR) / 2) : null;
  const beltY = gh[0][1];
  for (const sx of [-1, 1]) {
    const x = sx * (W / 2 + 0.005);
    if (B.doors) {
      // joints de portes
      for (const z of [doorF, doorR, ...(mid !== null ? [mid] : [])]) cb.box(x, (clear + beltY) / 2 + 0.06, z, 0.012, beltY - clear - 0.12, 0.015, '#15161a', M.matte);
      cb.box(x, clear + 0.14, (doorF + doorR) / 2, 0.012, 0.012, doorF - doorR, '#15161a', M.matte);
      for (const z of [doorF - 0.35, ...(mid !== null ? [mid - 0.35] : [])]) cb.box(x + sx * 0.01, beltY - 0.12, z, 0.03, 0.035, 0.16, '#d0d4da', M.chrome); // poignées
    }
    // rétroviseur
    cb.rbox(sx * (W / 2 + 0.11), beltY + 0.1, ghFront - 0.18, 0.2, 0.13, 0.1, '#ffffff', M.paint);
    cb.box(sx * (W / 2 + 0.11), beltY + 0.1, ghFront - 0.235, 0.16, 0.09, 0.01, '#b9c7d4', M.chrome);
    // bas de caisse / protections
    if (B.cladding) cb.box(sx * (W / 2 + 0.01), clear + 0.12, (zF + zR) / 2, 0.04, 0.16, Math.abs(zF - zR) - 2 * R, '#2a2b30', M.plastic);
  }
  // portière conducteur (gauche, x > 0) qui s'ouvre : panneau + vitre, pivot sur l'arête avant
  if (B.doors && det) {
    const dLen = doorF - (mid ?? doorR) - 0.04, dz = doorF - 0.02 - dLen / 2;
    const hinge = [W / 2, 0, doorF - 0.02, 3];
    cb.box(W / 2 + 0.018, (clear + beltY) / 2 + 0.08, dz, 0.025, beltY - clear - 0.14, dLen, '#ffffff', M.paint, { wheel: hinge });
    cb.box(W / 2 + 0.04, beltY - 0.12, doorF - 0.37, 0.03, 0.035, 0.16, '#d0d4da', M.chrome, { wheel: hinge });
    cb.box(W / 2 - 0.005, (clear + beltY) / 2 + 0.08, dz, 0.01, beltY - clear - 0.16, dLen - 0.04, '#26272c', M.interior); // garniture visible portière ouverte
  }

  // --- intérieur : sièges, tableau de bord, volant (visibles à travers les vitres)
  if (det) {
    const seat = B.seat;
    const sy = beltY - 0.52 + seat.y * 0.3;
    for (const sx of [-1, 1]) {
      cb.rbox(sx * seat.x, sy, seat.z, 0.48, 0.14, 0.5, '#2c2e35', M.interior);
      cb.rbox(sx * seat.x, sy + 0.35, seat.z - 0.27, 0.46, 0.62, 0.12, '#2c2e35', M.interior, { rx: -0.15 });
      cb.rbox(sx * seat.x, sy + 0.72, seat.z - 0.31, 0.24, 0.14, 0.1, '#2c2e35', M.interior);
    }
    if (B.doors === 4 || spec.body === 'wagon') cb.rbox(0, sy + 0.05, seat.z - 1.0, W - 0.5, 0.2, 0.5, '#2c2e35', M.interior);
    cb.rbox(0, beltY - 0.02, ghFront - 0.3, ghW - 0.1, 0.22, 0.45, '#24262b', M.interior);   // tableau de bord
    cb.add(P.torus(14), { x: seat.x, y: beltY + 0.12, z: ghFront - 0.6, sx: 0.36, sy: 0.36, sz: 0.36, rx: -0.45, color: '#141518', mat: M.matte }); // volant
    if (opts.driver) addDriver(cb, seat.x, sy + 0.08, seat.z - 0.05, opts.driver, seat.s);
  }

  // --- spécificités par gabarit
  if (B.spoiler) {
    cb.rbox(0, tailY + 0.2, rear + 0.18, W * 0.86, 0.05, 0.28, '#1a1b1f', M.trim);
    for (const sx of [-1, 1]) cb.box(sx * 0.6, tailY + 0.09, rear + 0.2, 0.05, 0.16, 0.12, '#1a1b1f', M.trim);
    cb.rbox(0, clear + 0.08, front - 0.05, W * 0.9, 0.04, 0.2, '#1a1b1f', M.trim); // lame avant
  }
  if (B.scoop) cb.rbox(0, noseY + 0.12, 1.2, 0.5, 0.08, 0.6, '#1a1b1f', M.trim);
  if (B.rails) for (const sx of [-1, 1]) cb.box(sx * (ghW / 2 - 0.08), roofY + 0.08, (gh[1][0] + gh[gh.length - 2][0]) / 2, 0.05, 0.05, Math.abs(gh[1][0] - gh[gh.length - 2][0]) * 0.85, '#2a2b30', M.trim);
  if (B.spare) cb.add(P.cyl(14), { x: 0, y: 0.95, z: rear - 0.14, sx: 0.7, sy: 0.24, sz: 0.7, rx: Math.PI / 2, color: '#17171c', mat: M.rubber });
  if (B.bed) {
    const bd = B.bed;
    for (const sx of [-1, 1]) cb.box(sx * (W / 2 - 0.04), (bd.floor + bd.top) / 2, (bd.z1 + bd.z2) / 2, 0.08, bd.top - bd.floor, bd.z1 - bd.z2, '#ffffff', M.paint);
    cb.box(0, (bd.floor + bd.top) / 2, bd.z2 + 0.04, W - 0.04, bd.top - bd.floor, 0.08, '#ffffff', M.paint);
    cb.box(0, bd.floor + 0.01, (bd.z1 + bd.z2) / 2, W - 0.16, 0.02, bd.z1 - bd.z2 - 0.1, '#3b3d44', M.matte);
    if (!livery && det) { // quelques objets dans la benne
      cb.rbox(0.4, bd.floor + 0.2, -1.4, 0.5, 0.4, 0.5, '#a0703c', M.matte);
      cb.add(P.cyl(10), { x: -0.4, y: bd.floor + 0.25, z: -1.9, sx: 0.4, sy: 0.5, sz: 0.4, color: '#2a9d8f', mat: M.plastic });
    }
  }
  if (B.cargo) {
    const cg = B.cargo;
    const cargoCol = livery === 'icecream' ? '#ffc8dd' : '#ffffff';
    cb.slab(0, (cg.y1 + cg.y2) / 2, (cg.z1 + cg.z2) / 2, W, cg.y2 - cg.y1, cg.z1 - cg.z2, cargoCol, livery === 'icecream' || livery === 'fire' ? M.paint : M.paintMatte, 0.08);
    cb.box(0, cg.y1 + 0.02, cg.z2 + 0.05, W - 0.2, 0.06, 0.2, '#2a2b30', M.trim);
    for (const sx of [-1, 1]) {
      cb.rbox(sx * (W / 2 - 0.22), cg.y1 + 0.3, cg.z2 - 0.09, 0.3, 0.16, 0.06, '#b3121f', M.tail);
      cb.rbox(sx * (W / 2 - 0.22), cg.y2 - 0.16, cg.z2 - 0.09, 0.12, 0.08, 0.05, '#ff9f1c', M.amber);
    }
    cb.box(0, (cg.y1 + cg.y2) / 2, cg.z2 - 0.07, 0.03, cg.y2 - cg.y1 - 0.15, 0.02, '#8e939b', M.chrome);
  }

  // --- livrées et équipements de service
  if (livery === 'taxi') {
    for (const sx of [-1, 1]) for (let i = 0; i < 9; i++) cb.box(sx * (W / 2 + 0.008), clear + 0.42 + (i % 2) * 0.06, doorF - 0.15 - i * 0.12, 0.01, 0.06, 0.12, '#14141a', M.plastic);
    cb.rbox(0, roofY + 0.14, -0.3, 0.7, 0.18, 0.3, '#ffe066', M.sign);
    cb.box(0, roofY + 0.14, -0.3, 0.5, 0.08, 0.31, '#2b2d42', M.plastic);
  }
  if (livery === 'police' || livery === 'ambulance' || livery === 'fire') {
    const stripe = livery === 'police' ? '#1d4fd8' : livery === 'ambulance' ? '#e63946' : '#f4f1ea';
    const yS = livery === 'fire' ? 1.15 : clear + 0.42;
    for (const sx of [-1, 1]) {
      cb.box(sx * (W / 2 + 0.008), yS, (front + rear) / 2, 0.01, 0.16, (front - rear) * 0.92, stripe, M.paintMatte);
      if (livery === 'police') cb.box(sx * (W / 2 + 0.008), yS + 0.13, (front + rear) / 2, 0.01, 0.04, (front - rear) * 0.9, '#e63946', M.paintMatte);
      if (livery === 'ambulance') for (let i = 0; i < 8; i++) cb.box(sx * (W / 2 + 0.012), yS + 0.18, -1.5 + i * 0.3, 0.01, 0.12, 0.15, i % 2 ? '#2a9d8f' : '#ffd23f', M.paintMatte);
    }
    // rampe lumineuse
    const lz = livery === 'fire' ? B.gh[1][0] - 0.2 : -0.1;
    const ly = (livery === 'fire' ? Math.max(...B.gh.map((p) => p[1])) : roofY) + 0.1;
    cb.rbox(0, ly, lz, 1.2, 0.08, 0.28, '#2a2b30', M.trim);
    cb.rbox(0.32, ly + 0.08, lz, 0.5, 0.12, 0.24, livery === 'fire' ? '#ff4040' : '#3a7bff', livery === 'fire' ? M.red : M.blue);
    cb.rbox(-0.32, ly + 0.08, lz, 0.5, 0.12, 0.24, livery === 'police' ? '#3a7bff' : '#ff4040', livery === 'police' ? M.blue : M.red);
    if (livery === 'police') for (const sx of [-1, 1]) cb.box(sx * (W / 2 + 0.008), clear + 0.6, (doorF + doorR) / 2, 0.01, 0.1, 0.9, '#ffffff', M.paintMatte);
  }
  if (livery === 'fire' && B.cargo) {
    const cg = B.cargo;
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) cb.box(sx * (W / 2 + 0.01), 1.95, cg.z1 - 0.7 - i * 1.35, 0.02, 1.4, 1.15, '#b9bec6', M.chrome);
    // échelle
    cb.box(0, cg.y2 + 0.1, (cg.z1 + cg.z2) / 2 + 0.3, 0.12, 0.12, 4.6, '#c0c4ca', M.chrome);
    for (const sx of [-0.35, 0.35]) cb.box(sx, cg.y2 + 0.22, (cg.z1 + cg.z2) / 2 + 0.3, 0.06, 0.08, 4.4, '#d0d4da', M.chrome);
    for (let i = 0; i < 12; i++) cb.box(0, cg.y2 + 0.22, cg.z1 - 0.2 - i * 0.36, 0.7, 0.04, 0.04, '#d0d4da', M.chrome);
  }
  if (livery === 'icecream' && B.cargo) {
    const cg = B.cargo;
    cb.box(-(W / 2 + 0.01), 1.9, -0.9, 0.04, 0.9, 1.8, '#2b2d42', M.trim);  // guichet
    cb.box(-(W / 2 + 0.2), 2.4, -0.9, 0.4, 0.04, 2.0, '#ff5a5f', M.paintMatte); // auvent
    for (let i = 0; i < 6; i++) cb.box(-(W / 2 + 0.012), 1.2, cg.z1 - 0.4 - i * 0.65, 0.01, 0.25, 0.3, ['#ffd23f', '#7ac74f', '#ff70a6'][i % 3], M.paintMatte);
    cb.add(P.cone(12), { y: cg.y2 + 0.55, z: -1.2, sx: 0.7, sy: 1.1, sz: 0.7, rx: Math.PI, color: '#e9a23b', mat: M.matte });
    cb.add(P.sph(12), { y: cg.y2 + 1.15, z: -1.2, sx: 0.9, sy: 0.75, sz: 0.9, color: '#fff3f8', mat: M.plastic });
    cb.add(P.sph(10), { y: cg.y2 + 1.55, z: -1.2, sx: 0.55, sy: 0.45, sz: 0.55, color: '#ff8fab', mat: M.plastic });
    cb.add(P.sph(6), { y: cg.y2 + 1.86, z: -1.2, sx: 0.2, sy: 0.2, sz: 0.2, color: '#d00000', mat: M.plastic });
  }
  if (livery === 'tow' && B.bed) {
    const bd = B.bed;
    cb.rbox(0, roofY + 0.1, -0.1, 1.1, 0.08, 0.25, '#2a2b30', M.trim);
    for (const sx of [-0.3, 0.3]) cb.rbox(sx, roofY + 0.18, -0.1, 0.4, 0.1, 0.2, '#ffb703', M.amber);
    cb.box(0, bd.top + 0.5, (bd.z1 + bd.z2) / 2 - 0.3, 0.25, 0.25, 2.6, '#ffb703', M.paintMatte, { rx: -0.25 });
    cb.box(0, bd.top + 0.1, bd.z2 - 0.4, 0.1, 0.9, 0.1, '#30343f', M.trim);
    cb.add(P.torus(10), { x: 0, y: bd.top - 0.4, z: bd.z2 - 0.42, sx: 0.25, sy: 0.25, sz: 0.25, color: '#30343f', mat: M.chrome });
  }

  // --- roues
  for (const az of [zF, zR]) for (const sx of [-1, 1]) addWheel(cb, sx * (B.W / 2 - B.ww / 2 - 0.03), r, az, r, B.ww, az === zF ? 2 : 1, B.rim, spec.body === 'sport' ? '#2b2d33' : '#c9ced6');
  if (spec.body === 'bus' || spec.body === 'box') for (const sx of [-1, 1]) addWheel(cb, sx * (B.W / 2 - B.ww / 2 - 0.03 - B.ww - 0.02), r, zR, r, B.ww, 1, 'steel');
}

// Conducteur stylisé (PNJ) assis au volant : buste, bras, tête, cheveux.
function addDriver(cb, x, y, z, d, s = 0.85) {
  const k = s;
  cb.rbox(x, y + 0.35 * k, z, 0.48 * k, 0.55 * k, 0.32 * k, d.top || '#3d8ee8', M.interior);
  for (const sx of [-1, 1]) cb.rbox(x + sx * 0.2 * k, y + 0.45 * k, z + 0.25 * k, 0.12 * k, 0.12 * k, 0.45 * k, d.top || '#3d8ee8', M.interior, { rx: 0.5 });
  cb.add(P.sph(10), { x, y: y + 0.88 * k, z, sx: 0.5 * k, sy: 0.54 * k, sz: 0.48 * k, color: d.skin || '#f1c27d', mat: M.skin });
  cb.add(P.sph(10), { x, y: y + 1.02 * k, z: z - 0.03, sx: 0.52 * k, sy: 0.32 * k, sz: 0.5 * k, color: d.hair || '#3b2a1e', mat: M.matte });
  if (d.hat) cb.add(P.cyl(12), { x, y: y + 1.13 * k, z, sx: 0.5 * k, sy: 0.14 * k, sz: 0.5 * k, color: d.hat, mat: M.matte });
}

// ---------------------------------------------------------------------------------------------
// Deux-roues et petits véhicules
function buildSmall(cb, model) {
  const spec = VEHICLES[model];
  const det = cb.detail;
  const metal = '#30343f';
  if (spec.kind === 'board') {
    cb.rbox(0, 0.13, 0, 0.32, 0.06, 1.05, '#ffffff', M.paint);
    cb.box(0, 0.165, 0, 0.26, 0.01, 0.9, '#1b1b1f', M.rubber);
    const steer = [0, 0, 0.52, 4];
    cb.add(P.cyl(8), { y: 0.65, z: 0.55, sx: 0.06, sy: 1.0, sz: 0.06, rx: -0.12, color: metal, mat: M.trim, wheel: steer });
    cb.add(P.cyl(8), { y: 1.12, z: 0.61, sx: 0.04, sy: 0.6, sz: 0.04, rz: Math.PI / 2, color: metal, mat: M.trim, wheel: steer });
    for (const sx of [-1, 1]) cb.add(P.cyl(8), { x: sx * 0.26, y: 1.12, z: 0.61, sx: 0.06, sy: 0.12, sz: 0.06, rz: Math.PI / 2, color: '#17171c', mat: M.rubber, wheel: steer });
    addWheel(cb, 0, 0.1, 0.5, 0.1, 0.07, 2, 'steel'); addWheel(cb, 0, 0.1, -0.45, 0.1, 0.07, 1, 'steel');
    return;
  }
  if (spec.kind === 'caddie') {
    const m = '#c7ccd4';
    for (const x of [-0.35, 0.35]) cb.box(x, 0.65, 0, 0.03, 0.6, 1.0, m, M.chrome);
    cb.box(0, 0.65, -0.48, 0.72, 0.6, 0.03, m, M.chrome); cb.box(0, 0.65, 0.48, 0.72, 0.6, 0.03, m, M.chrome); cb.box(0, 0.36, 0, 0.72, 0.03, 1.0, m, M.chrome);
    if (det) for (let i = 0; i < 5; i++) for (const x of [-0.36, 0.36]) cb.box(x, 0.45 + i * 0.1, 0, 0.04, 0.02, 1.0, '#ffffff', M.paint);
    cb.rbox(0, 1.02, -0.62, 0.8, 0.06, 0.06, '#ffffff', M.paint);
    for (const [x, z] of [[-0.3, -0.4], [0.3, -0.4], [-0.3, 0.4], [0.3, 0.4]]) { cb.box(x, 0.24, z, 0.03, 0.25, 0.03, m, M.chrome); addWheel(cb, x, 0.08, z, 0.08, 0.05, z > 0 ? 2 : 1, 'steel'); }
    cb.add(P.cone(10), { y: 0.55, z: -0.72, sx: 0.28, sy: 0.4, sz: 0.28, rx: -Math.PI / 2, color: '#ff9f1c', mat: M.chrome });
    cb.add(P.cyl(10), { y: 0.55, z: -0.95, sx: 0.2, sy: 0.05, sz: 0.2, rx: Math.PI / 2, color: '#ffd23f', mat: M.amber });
    return;
  }
  // vélo, scooter, moto
  const D = dimsOf(model);
  const steer = [0, 0, D.zF - 0.15, 4];
  if (spec.kind === 'bike') {
    cb.strip(0, [-0.55, 0.34], [0.05, 0.75], 0.05, 0.05, '#ffffff', M.paint);
    cb.strip(0, [0.05, 0.75], [0.5, 0.82], 0.05, 0.05, '#ffffff', M.paint);
    cb.strip(0, [-0.55, 0.34], [0.0, 0.36], 0.05, 0.05, '#ffffff', M.paint);
    cb.strip(0, [0.0, 0.36], [0.05, 0.75], 0.05, 0.05, '#ffffff', M.paint);
    cb.strip(0, [0.0, 0.36], [-0.2, 0.8], 0.05, 0.05, '#ffffff', M.paint);
    cb.rbox(0, 0.86, -0.22, 0.16, 0.06, 0.28, '#1b1b1f', M.matte);
    cb.strip(0, [D.zF, 0.34], [0.52, 1.0], 0.04, 0.04, metal, M.chrome, { wheel: steer });
    cb.add(P.cyl(8), { y: 1.02, z: 0.5, sx: 0.035, sy: 0.6, sz: 0.035, rz: Math.PI / 2, color: metal, mat: M.trim, wheel: steer });
    cb.rbox(0, 0.95, 0.72, 0.36, 0.22, 0.26, '#a0703c', M.matte, { wheel: steer }); // panier
    addWheel(cb, 0, 0.34, D.zF, 0.34, 0.05, 2, 'sport', '#d0d4da'); addWheel(cb, 0, 0.34, D.zR, 0.34, 0.05, 1, 'sport', '#d0d4da');
    return;
  }
  if (spec.kind === 'scooter') {
    cb.rbox(0, 0.32, -0.05, 0.42, 0.22, 1.25, '#ffffff', M.paint);
    cb.rbox(0, 0.55, -0.35, 0.44, 0.35, 0.65, '#ffffff', M.paint);
    cb.rbox(0, 0.76, -0.33, 0.36, 0.1, 0.6, '#2b2d42', M.interior);
    cb.rbox(0, 0.58, 0.5, 0.46, 0.8, 0.22, '#ffffff', M.paint, { rx: -0.2 });
    cb.add(P.cyl(8), { y: 1.06, z: 0.6, sx: 0.04, sy: 0.7, sz: 0.04, rz: Math.PI / 2, color: metal, mat: M.trim, wheel: steer });
    cb.rbox(0, 1.02, 0.62, 0.3, 0.14, 0.12, '#ffffff', M.paint, { wheel: steer });
    cb.rbox(0, 0.98, 0.69, 0.18, 0.1, 0.04, '#fffbe8', M.head, { wheel: steer });
    cb.rbox(0, 0.62, -0.7, 0.2, 0.08, 0.04, '#b3121f', M.tail);
    cb.rbox(0, 0.92, -0.55, 0.4, 0.3, 0.32, '#2b2d42', M.plastic); // top-case
    for (const sx of [-1, 1]) cb.box(sx * 0.2, 1.17, 0.42, 0.06, 0.1, 0.03, '#d0d4da', M.chrome, { wheel: steer });
    addWheel(cb, 0, 0.25, D.zF, 0.25, 0.12, 2, 'spokes'); addWheel(cb, 0, 0.25, D.zR, 0.25, 0.12, 1, 'spokes');
    return;
  }
  // moto sportive
  cb.rbox(0, 0.62, 0.05, 0.36, 0.3, 1.0, '#ffffff', M.paint);              // réservoir / carénage
  cb.rbox(0, 0.85, 0.15, 0.4, 0.22, 0.6, '#ffffff', M.paint);
  cb.rbox(0, 0.8, 0.6, 0.5, 0.46, 0.3, '#ffffff', M.paint, { rx: -0.5 });  // tête de fourche
  cb.rbox(0, 1.02, 0.7, 0.36, 0.18, 0.05, '#9fb6c8', M.glassO, { rx: -0.6 });
  cb.rbox(0, 0.78, 0.76, 0.24, 0.1, 0.06, '#fffbe8', M.head);
  cb.rbox(0, 0.84, -0.35, 0.3, 0.1, 0.55, '#1b1b1f', M.interior);          // selle
  cb.rbox(0, 0.78, -0.75, 0.26, 0.12, 0.3, '#ffffff', M.paint);
  cb.rbox(0, 0.76, -0.9, 0.14, 0.06, 0.04, '#b3121f', M.tail);
  cb.rbox(0, 0.42, -0.05, 0.34, 0.32, 0.5, '#2b2d33', M.trim);             // moteur
  cb.add(P.cyl(8), { x: 0.2, y: 0.45, z: -0.7, sx: 0.12, sy: 0.6, sz: 0.12, rx: Math.PI / 2 - 0.2, color: '#c0c4ca', mat: M.chrome }); // échappement
  for (const sx of [-1, 1]) cb.strip(sx * 0.1, [D.zF, 0.32], [0.55, 0.95], 0.05, 0.04, '#c0c4ca', M.chrome, { wheel: steer });
  cb.add(P.cyl(8), { y: 1.0, z: 0.52, sx: 0.035, sy: 0.62, sz: 0.035, rz: Math.PI / 2, color: metal, mat: M.trim, wheel: steer });
  cb.strip(0, [D.zR, 0.32], [-0.1, 0.45], 0.06, 0.08, '#2b2d33', M.trim);
  addWheel(cb, 0, 0.32, D.zF, 0.32, 0.14, 2, 'sport', '#2b2d33'); addWheel(cb, 0, 0.32, D.zR, 0.32, 0.17, 1, 'sport', '#2b2d33');
}

// ---------------------------------------------------------------------------------------------
const geoCache = new Map();
const lodCache = new Map();
// Géométries d'un modèle : { body, glass, lod } (mises en cache). driver = apparence du conducteur PNJ.
export function vehicleGeometries(model, { driver = null, driverKey = '' } = {}) {
  const key = `${model}|${driverKey}`;
  let g = geoCache.get(key);
  if (g) return g;
  const spec = VEHICLES[model];
  const make = (detail) => {
    const cb = new CarBuilder(detail);
    if (spec.kind === 'car') {
      buildCar(cb, model, { driver: detail ? driver : null });
      const B = BODIES[spec.body];
      const belt = B.gh[0][1], roof = Math.max(...B.gh.map((p) => p[1]));
      const boxy = ['van', 'box', 'bus'].includes(spec.body);
      const tumble = boxy ? 0.04 : spec.body === 'suv' || spec.body === 'pickup' ? 0.09 : 0.15;
      const pinch = boxy ? 0.04 : 0.11;
      cb.deform((y, z) => {
        const e = Math.min(1, Math.abs(z) / (B.L / 2));
        const t = Math.max(0, Math.min(1, (y - belt + 0.08) / (roof - belt + 0.08)));
        return (1 - pinch * e ** 5) * (1 - tumble * t * t * (3 - 2 * t));
      });
    } else buildSmall(cb, model);
    return cb.build();
  };
  const hi = make(1);
  let lod = lodCache.get(model);
  if (!lod) { lod = spec.kind === 'car' ? make(0).body : hi.body; lodCache.set(model, lod); }
  g = { body: hi.body, glass: hi.glass, lod };
  geoCache.set(key, g);
  return g;
}

// ---------------------------------------------------------------------------------------------
// Matériau carrosserie (PBR) : roues animées, portière, bosses, peinture, feux, dégâts.
const VERT_HEAD = /* glsl */`
attribute vec4 cpart;
attribute vec4 cwheel;
uniform float uSpin; uniform float uSteer; uniform float uDoor;
uniform vec4 uDents[4];
varying vec4 vCPart;
varying vec3 vLocal;
vec3 carRot(vec3 p, bool isDir) {
  float k = cwheel.w;
  if (k < 0.5) return p;
  vec3 c = isDir ? vec3(0.0) : cwheel.xyz;
  vec3 q = p - c;
  if (k < 2.5) { float s = sin(uSpin), co = cos(uSpin); q = vec3(q.x, q.y * co - q.z * s, q.y * s + q.z * co); }
  float yaw = (k > 1.5 && k < 2.5) || k > 3.5 ? uSteer : (k > 2.5 && k < 3.5 ? -uDoor : 0.0);
  if (yaw != 0.0) { float s = sin(yaw), co = cos(yaw); q = vec3(q.x * co + q.z * s, q.y, -q.x * s + q.z * co); }
  return q + c;
}
`;
const FRAG_HEAD = /* glsl */`
uniform vec3 uPaint; uniform float uBrake; uniform float uLights; uniform float uRev; uniform float uSiren;
uniform float uTime; uniform float uBlink; uniform float uDamage; uniform float uDirt;
varying vec4 vCPart;
varying vec3 vLocal;
float carHash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
`;

export function makeCarMaterial() {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 1, envMapIntensity: 1.1 });
  const u = {
    uPaint: { value: new THREE.Color('#e63946') }, uSpin: { value: 0 }, uSteer: { value: 0 }, uDoor: { value: 0 },
    uDents: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] },
    uBrake: { value: 0 }, uLights: { value: 0 }, uRev: { value: 0 }, uSiren: { value: 0 }, uTime: { value: 0 },
    uBlink: { value: 0 }, uDamage: { value: 0 }, uDirt: { value: 0 },
  };
  mat.userData.u = u;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = VERT_HEAD + sh.vertexShader
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nobjectNormal = carRot(objectNormal, true);')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed = carRot(transformed, false);
        if (cwheel.w < 0.5 || cwheel.w > 2.5) {
          for (int i = 0; i < 4; i++) {
            vec4 d = uDents[i];
            if (d.w <= 0.0) continue;
            vec3 dv = transformed - d.xyz;
            float f = max(0.0, 1.0 - dot(dv, dv) / 0.7);
            float n = 0.7 + 0.3 * sin(transformed.x * 17.0 + transformed.z * 11.0 + transformed.y * 7.0);
            transformed -= normalize(vec3(transformed.x, transformed.y - 0.75, transformed.z * 0.35) + 1e-4) * f * f * d.w * 0.28 * n;
          }
        }
        vCPart = cpart; vLocal = transformed;`);
    sh.fragmentShader = FRAG_HEAD + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb *= mix(vec3(1.0), uPaint, vCPart.x);
        float grime = carHash(floor(vLocal * 2.5));
        float scratch = smoothstep(0.93, 1.0, carHash(floor(vLocal * vec3(30.0, 3.0, 30.0)))) * smoothstep(0.25, 0.7, uDamage);
        diffuseColor.rgb *= 1.0 - (uDamage * (0.18 + 0.22 * grime) + uDirt * 0.25 * grime * smoothstep(0.9, 0.2, vLocal.y)) * vCPart.x;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.55), scratch * vCPart.x * 0.7);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(vCPart.y, 0.9, max(uDamage, uDirt * 0.6) * vCPart.x);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vCPart.z * (1.0 - uDamage * 0.6 * vCPart.x);')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float lc = vCPart.w;
        if (lc > 0.5) {
          float e = 0.0;
          if (lc < 1.5) e = 0.12 + uLights * 2.6;
          else if (lc < 2.5) e = 0.06 + uLights * 0.7 + uBrake * 2.4;
          else if (lc < 3.5) e = uRev * 2.2;
          else if (lc < 4.5) e = uSiren * step(0.5, fract(uTime * 2.4)) * 5.0;
          else if (lc < 5.5) e = uSiren * step(0.5, fract(uTime * 2.4 + 0.5)) * 5.0;
          else if (lc < 6.5) e = uBlink * step(0.5, fract(uTime * 1.6)) * 3.0;
          else e = 0.25 + uLights * 1.6;
          totalEmissiveRadiance += diffuseColor.rgb * e;
        }`);
  };
  mat.customProgramCacheKey = () => 'playzone-car-1';
  return mat;
}

// Vitres : un seul matériau partagé (reflets de l'environnement, légère transparence).
export const glassMaterial = new THREE.MeshStandardMaterial({ color: '#16202b', roughness: 0.03, metalness: 0.15, transparent: true, opacity: 0.72, depthWrite: false, envMapIntensity: 2.4 });

// Faisceau des phares au sol (la nuit) : trapèze additif dégradé, partagé par modèle.
const beamCache = new Map();
function beamGeometry(model) {
  let g = beamCache.get(model);
  if (g) return g;
  const d = dimsOf(model);
  const z0 = d.L / 2 + 0.1, len = VEHICLES[model].kind === 'car' ? 14 : 9, w0 = Math.max(0.5, d.W * 0.8), w1 = w0 + 5;
  const pos = [], col = [];
  const steps = 6;
  for (let i = 0; i < steps; i++) {
    const a = i / steps, b = (i + 1) / steps;
    const za = z0 + a * len, zb = z0 + b * len, wa = (w0 + (w1 - w0) * a) / 2, wb = (w0 + (w1 - w0) * b) / 2;
    const ia = (1 - a) ** 1.5, ib = (1 - b) ** 1.5;
    pos.push(-wa, 0.04, za, wa, 0.04, za, wb, 0.04, zb, -wa, 0.04, za, wb, 0.04, zb, -wb, 0.04, zb);
    col.push(ia, ia, ia * 0.85, ia, ia, ia * 0.85, ib, ib, ib * 0.85, ia, ia, ia * 0.85, ib, ib, ib * 0.85, ib, ib, ib * 0.85);
  }
  g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  beamCache.set(model, g);
  return g;
}
export const beamMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });

// ---------------------------------------------------------------------------------------------
// Un véhicule affichable : maillage carrosserie (+ vitres) avec niveau de détail selon la distance.
export class CarVisual {
  constructor(model, { paint = '#e63946', driver = null, driverKey = '' } = {}) {
    this.model = model;
    this.spec = VEHICLES[model];
    this.dims = dimsOf(model);
    const g = vehicleGeometries(model, { driver, driverKey });
    this.geos = g;
    this.material = makeCarMaterial();
    this.u = this.material.userData.u;
    this.u.uPaint.value.set(this.spec.livery && this.spec.paint ? this.spec.paint : paint);
    this.root = new THREE.Group();
    this.tilt = new THREE.Group();     // roulis / tangage de la caisse
    this.root.add(this.tilt);
    this.body = new THREE.Mesh(g.body, this.material);
    this.body.castShadow = true;
    this.tilt.add(this.body);
    if (g.glass) { this.glass = new THREE.Mesh(g.glass, glassMaterial); this.glass.renderOrder = 1; this.tilt.add(this.glass); }
    this.beam = new THREE.Mesh(beamGeometry(model), beamMaterial);
    this.beam.visible = false;
    this.beam.renderOrder = 2;
    this.root.add(this.beam);
    this.spin = 0;
    this.lod = 0;
    this.dents = 0;
  }

  // Phares : allumés (0..1) — le faisceau au sol n'est dessiné que de près, la nuit.
  setLights(k) {
    this.u.uLights.value = k;
    this.beam.visible = k > 0.35 && this.lod === 0;
  }

  setPaint(c) { this.u.uPaint.value.set(c); }

  // Distance à la caméra -> détail (0 : complet, 1 : simplifié, 2 : caché)
  setDetail(level) {
    if (level === this.lod) return;
    this.lod = level;
    this.root.visible = level < 2;
    this.body.geometry = level === 0 ? this.geos.body : this.geos.lod;
    if (this.glass) this.glass.visible = level === 0;
    this.body.castShadow = level === 0;
  }

  // Roues : avance de `dist` mètres, braquage `steer` (rad).
  roll(dist, steer) {
    this.spin = (this.spin + dist / Math.max(0.05, this.dims.r)) % (Math.PI * 2000);
    this.u.uSpin.value = this.spin;
    this.u.uSteer.value = steer;
  }

  // Bosse à l'impact (coordonnées locales du véhicule), intensité 0..1
  dent(lx, ly, lz, k) {
    const d = this.u.uDents.value;
    // on renforce une bosse proche, sinon on remplace la plus faible
    let best = 0, bestD = 1e9;
    for (let i = 0; i < 4; i++) {
      const dd = (d[i].x - lx) ** 2 + (d[i].y - ly) ** 2 + (d[i].z - lz) ** 2;
      if (d[i].w > 0 && dd < 0.5) { d[i].w = Math.min(1.6, d[i].w + k); return; }
      if (d[i].w < bestD) { bestD = d[i].w; best = i; }
    }
    d[best].set(lx, ly, lz, Math.min(1.6, k));
  }

  clearDents() { for (const v of this.u.uDents.value) v.set(0, 0, 0, 0); }

  dispose() { this.material.dispose(); }
}

export const BODY_INFO = BODIES;
