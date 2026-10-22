import * as THREE from 'three';

// Fusionne tout le décor immobile en quelques gros maillages (un par "chunk" de la carte et par matériau),
// avec la couleur stockée dans chaque sommet. Résultat : très peu d'appels de dessin, donc un jeu fluide
// même sur un ordinateur modeste, tout en gardant le découpage par chunk pour le "frustum culling".

const baseCache = new Map();
const _m = new THREE.Matrix4();
const _n = new THREE.Matrix3();
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();
const _c = new THREE.Color();

function base(key, make) {
  let g = baseCache.get(key);
  if (!g) {
    const geo = make();
    const ni = geo.index ? geo.toNonIndexed() : geo;
    if (!ni.attributes.normal) ni.computeVertexNormals();
    g = { pos: ni.attributes.position.array, nor: ni.attributes.normal.array };
    baseCache.set(key, g);
  }
  return g;
}

// Prisme triangulaire (toit à deux pans) de base 1x1x1, faîte le long de X.
function gableGeometry() {
  const g = new THREE.BufferGeometry();
  const p = [
    // pignons
    -0.5, 0, 0.5, -0.5, 0, -0.5, -0.5, 1, 0,
    0.5, 0, -0.5, 0.5, 0, 0.5, 0.5, 1, 0,
    // pans
    -0.5, 0, 0.5, -0.5, 1, 0, 0.5, 1, 0, -0.5, 0, 0.5, 0.5, 1, 0, 0.5, 0, 0.5,
    -0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 1, 0, -0.5, 0, -0.5, 0.5, 1, 0, -0.5, 1, 0,
    // dessous
    -0.5, 0, -0.5, -0.5, 0, 0.5, 0.5, 0, 0.5, -0.5, 0, -0.5, 0.5, 0, 0.5, 0.5, 0, -0.5,
  ];
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  return g;
}

export const SHAPES = {
  box: () => base('box', () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)),
  cyl: (seg = 10) => base(`cyl${seg}`, () => new THREE.CylinderGeometry(0.5, 0.5, 1, seg).translate(0, 0.5, 0)),
  cone: (seg = 10) => base(`cone${seg}`, () => new THREE.ConeGeometry(0.5, 1, seg).translate(0, 0.5, 0)),
  sphere: (seg = 10) => base(`sph${seg}`, () => new THREE.SphereGeometry(0.5, seg, Math.max(4, seg * 0.6 | 0))),
  ico: () => base('ico', () => new THREE.IcosahedronGeometry(0.5, 0)),
  ico1: () => base('ico1', () => new THREE.IcosahedronGeometry(0.5, 1)),
  gable: () => base('gable', gableGeometry),
  plane: () => base('plane', () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)),
  torus: () => base('torus', () => new THREE.TorusGeometry(0.5, 0.08, 6, 20)),
  ring: () => base('ring', () => new THREE.TorusGeometry(0.5, 0.18, 8, 18).rotateX(Math.PI / 2)),
  // tronc de cône (haut 0.5, bas 0.5 * ratio) : buste, mollets, avant-bras
  frustum: (seg = 16, ratio = 0.8) => base(`fru${seg}_${ratio}`, () => new THREE.CylinderGeometry(0.5, 0.5 * ratio, 1, seg).translate(0, 0.5, 0)),
  hemi: (seg = 12) => base(`hemi${seg}`, () => new THREE.SphereGeometry(0.5, seg, seg / 2, 0, Math.PI * 2, 0, Math.PI / 2)),
};

export class StaticBuilder {
  constructor(chunkSize = 64) {
    this.chunkSize = chunkSize;
    this.groups = new Map(); // clé "materiau|chunk" -> { pos:[], nor:[], col:[], cut:[] }
    this.cut = 0;            // code "escamotable" courant (bâtiment visitable : toit / murs), 0 = jamais caché
  }

  // Ajoute une forme de base transformée. o = { x,y,z, sx,sy,sz, rx,ry,rz, color, mat }
  add(shape, o) {
    _e.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ'); // lacet en dernier : on incline puis on oriente
    _q.setFromEuler(_e);
    _s.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1);
    _v.set(o.x || 0, o.y || 0, o.z || 0);
    _m.compose(_v, _q, _s);
    this.addMatrix(shape, _m, o.color, o.mat || 'main', o.x || 0, o.z || 0);
  }

  addMatrix(shape, matrix, color, mat = 'main', cx = 0, cz = 0) {
    _n.getNormalMatrix(matrix);
    _c.set(color);
    const cs = this.chunkSize;
    const key = cs === Infinity ? `${mat}|0` : `${mat}|${Math.floor(cx / cs)},${Math.floor(cz / cs)}`;
    let g = this.groups.get(key);
    if (!g) { g = { mat, pos: [], nor: [], col: [], cut: [], hasCut: false }; this.groups.set(key, g); }
    const cut = this.cut;
    if (cut) g.hasCut = true;
    const { pos, nor } = shape;
    const e = matrix.elements;
    const ne = _n.elements;
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i], y = pos[i + 1], z = pos[i + 2];
      g.pos.push(e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]);
      const nx = nor[i], ny = nor[i + 1], nz = nor[i + 2];
      let tx = ne[0] * nx + ne[3] * ny + ne[6] * nz, ty = ne[1] * nx + ne[4] * ny + ne[7] * nz, tz = ne[2] * nx + ne[5] * ny + ne[8] * nz;
      const l = Math.hypot(tx, ty, tz) || 1;
      g.nor.push(tx / l, ty / l, tz / l);
      g.col.push(_c.r, _c.g, _c.b);
      g.cut.push(cut);
    }
  }

  // Copie une géométrie déjà colorée (meuble, objet...) avec une transformation (x, y, z, ry, échelle).
  addColored(geo, x, y, z, ry = 0, scale = 1, mat = 'main') {
    _e.set(0, ry, 0, 'YXZ'); _q.setFromEuler(_e); _s.set(scale, scale, scale); _v.set(x, y, z);
    _m.compose(_v, _q, _s);
    _n.getNormalMatrix(_m);
    const cs = this.chunkSize;
    const key = cs === Infinity ? `${mat}|0` : `${mat}|${Math.floor(x / cs)},${Math.floor(z / cs)}`;
    let g = this.groups.get(key);
    if (!g) { g = { mat, pos: [], nor: [], col: [], cut: [], hasCut: false }; this.groups.set(key, g); }
    const P = geo.attributes.position.array, N = geo.attributes.normal.array, C = geo.attributes.color.array;
    const e = _m.elements, ne = _n.elements, cut = this.cut;
    if (cut) g.hasCut = true;
    for (let i = 0; i < P.length; i += 3) {
      const px = P[i], py = P[i + 1], pz = P[i + 2];
      g.pos.push(e[0] * px + e[4] * py + e[8] * pz + e[12], e[1] * px + e[5] * py + e[9] * pz + e[13], e[2] * px + e[6] * py + e[10] * pz + e[14]);
      const nx = N[i], ny = N[i + 1], nz = N[i + 2];
      g.nor.push(ne[0] * nx + ne[3] * ny + ne[6] * nz, ne[1] * nx + ne[4] * ny + ne[7] * nz, ne[2] * nx + ne[5] * ny + ne[8] * nz);
      g.col.push(C[i], C[i + 1], C[i + 2]);
      g.cut.push(cut);
    }
  }

  // Raccourcis pratiques (y = base de l'objet).
  box(x, y, z, w, h, d, color, ry = 0, mat) { this.add(SHAPES.box(), { x, y, z, sx: w, sy: h, sz: d, ry, color, mat }); }
  cyl(x, y, z, r, h, color, seg = 10, mat) { this.add(SHAPES.cyl(seg), { x, y, z, sx: r * 2, sy: h, sz: r * 2, color, mat }); }
  cone(x, y, z, r, h, color, seg = 10, mat) { this.add(SHAPES.cone(seg), { x, y, z, sx: r * 2, sy: h, sz: r * 2, color, mat }); }
  sphere(x, y, z, r, color, seg = 10, mat, sy = 1) { this.add(SHAPES.sphere(seg), { x, y, z, sx: r * 2, sy: r * 2 * sy, sz: r * 2, color, mat }); }
  blob(x, y, z, r, color, sy = 1, mat) { this.add(SHAPES.ico1(), { x, y, z, sx: r * 2, sy: r * 2 * sy, sz: r * 2, color, mat }); }
  gable(x, y, z, w, h, d, color, ry = 0, mat) { this.add(SHAPES.gable(), { x, y, z, sx: w, sy: h, sz: d, ry, color, mat }); }
  quad(x, y, z, w, d, color, ry = 0, mat) { this.add(SHAPES.plane(), { x, y, z, sx: w, sy: 1, sz: d, ry, color, mat }); }

  // Construit les maillages ; materials = { main: Material, windows: Material, ... }
  build(materials, { shadows = true } = {}) {
    const group = new THREE.Group();
    group.name = 'static';
    for (const g of this.groups.values()) {
      if (!g.pos.length) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.nor, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(g.col, 3));
      if (g.hasCut) geo.setAttribute('cut', new THREE.Float32BufferAttribute(g.cut, 1));
      geo.computeBoundingSphere();
      geo.computeBoundingBox();
      const mesh = new THREE.Mesh(geo, materials[g.mat] || materials.main);
      mesh.matrixAutoUpdate = false;
      if (g.hasCut && materials.cutDepth) mesh.customDepthMaterial = materials.cutDepth;
      if (shadows && g.mat === 'main') { mesh.castShadow = true; mesh.receiveShadow = true; }
      if (g.mat === 'ground') mesh.receiveShadow = shadows;
      group.add(mesh);
    }
    this.groups.clear();
    return group;
  }
}

// Construit une géométrie fusionnée unique (pour des objets mobiles : personnages, animaux, véhicules).
export function buildMergedGeometry(fn) {
  const sb = new StaticBuilder(Infinity);
  fn(sb);
  const pos = [], nor = [], col = [];
  for (const g of sb.groups.values()) { pos.push(...g.pos); nor.push(...g.nor); col.push(...g.col); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeBoundingSphere();
  return geo;
}
