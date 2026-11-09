import * as THREE from 'three';
import { CIRCUITS } from '../../shared/circuits.js';
import { groundHeight } from '../../shared/world-layout.js';

// DÉCOR DES GRANDS CIRCUITS DE F1 : un ruban d'asphalte par circuit (une seule géométrie), lignes
// blanches de bord, vibreurs rouge et blanc dans les virages, ligne de départ en damier, portique
// des feux, tribunes et panneaux publicitaires le long de la ligne droite des stands.
const RED = new THREE.Color('#e63946'), WHITE = new THREE.Color('#f4f1ea');

function frames(pts) {
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
    // courbure locale (pour savoir où poser les vibreurs)
    const c = pts[(i + 3) % n], d = pts[(i - 3 + n) % n];
    const h1 = Math.atan2(pts[i].x - d.x, pts[i].z - d.z), h2 = Math.atan2(c.x - pts[i].x, c.z - pts[i].z);
    const turn = Math.abs(Math.atan2(Math.sin(h2 - h1), Math.cos(h2 - h1)));
    out.push({ x: pts[i].x, z: pts[i].z, tx: dx / l, tz: dz / l, nx: dz / l, nz: -dx / l, curve: turn > 0.12 });
  }
  return out;
}

// ruban fermé entre les décalages latéraux o1 et o2 (o > 0 = à droite) ; color(i) facultatif
function ribbon(F, o1, o2, y, color) {
  const n = F.length, pos = new Float32Array((n + 1) * 2 * 3), col = color ? new Float32Array((n + 1) * 2 * 3) : null, idx = [];
  for (let k = 0; k <= n; k++) {
    const f = F[k % n], g = groundHeight(f.x, f.z) + y;
    pos.set([f.x + f.nx * o1, g, f.z + f.nz * o1, f.x + f.nx * o2, g, f.z + f.nz * o2], k * 6);
    if (col) { const c = color(k % n); col.set([c.r, c.g, c.b, c.r, c.g, c.b], k * 6); }
    if (k < n) { const a = k * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  if (col) geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

export function buildCircuits(g) {
  const root = new THREE.Group();
  root.name = 'f1-circuits';
  const asph = new THREE.MeshStandardMaterial({ color: '#3a3d42', roughness: 0.92, side: THREE.DoubleSide });
  const runoff = new THREE.MeshStandardMaterial({ color: '#c9b48a', roughness: 1, side: THREE.DoubleSide });
  const white = new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.8, side: THREE.DoubleSide });
  const kerbMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide });
  const lights = [];
  for (const C of Object.values(CIRCUITS)) {
    const F = frames(C.pts), hw = C.width / 2;
    const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; root.add(m); return m; };
    add(ribbon(F, -hw - 6, hw + 6, 0.03), runoff);                     // dégagements (sable / gravier)
    add(ribbon(F, -hw, hw, 0.06), asph);                               // piste
    for (const s of [-1, 1]) add(ribbon(F, s * (hw - 0.9), s * (hw - 0.5), 0.075), white);   // lignes de bord
    // vibreurs : seulement dans les virages, rouge / blanc alterné
    const kc = (i) => (!F[i].curve ? new THREE.Color('#c9b48a') : Math.floor(i / 2) % 2 ? RED : WHITE);
    for (const s of [-1, 1]) add(ribbon(F, s * hw, s * (hw + 1.4), 0.08, kc), kerbMat);
    // ligne de départ (damier), portique et feux, tribunes et panneaux le long de la ligne droite
    const p0 = F[0], y0 = groundHeight(p0.x, p0.z), yaw = Math.atan2(p0.tx, p0.tz);
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 16;
    const x = cv.getContext('2d'); for (let i = 0; i < 32; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#111' : '#fff'; x.fillRect(i * 4, j * 4, 4, 4); }
    const line = new THREE.Mesh(new THREE.PlaneGeometry(C.width, 2).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(cv) }));
    line.position.set(p0.x, y0 + 0.09, p0.z); line.rotation.y = yaw + Math.PI / 2; root.add(line);
    const dark = new THREE.MeshStandardMaterial({ color: '#2b2d42', roughness: 0.6 });
    for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.6, 8, 0.6), dark); m.position.set(p0.x + p0.nx * s * (hw + 1.5), y0 + 4, p0.z + p0.nz * s * (hw + 1.5)); root.add(m); g.collision.addCyl(m.position.x, m.position.z, 0.4, y0, 8); }
    const gantry = new THREE.Mesh(new THREE.BoxGeometry(C.width + 3.6, 1.3, 0.9), dark);
    gantry.position.set(p0.x, y0 + 8, p0.z); gantry.rotation.y = yaw + Math.PI / 2; root.add(gantry);
    const set = [];
    for (let k = 0; k < 5; k++) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), new THREE.MeshStandardMaterial({ color: '#330000', emissive: '#ff0000', emissiveIntensity: 0 }));
      const o = -3 + k * 1.5; l.position.set(p0.x + p0.nx * o - p0.tx * 0.5, y0 + 8, p0.z + p0.nz * o - p0.tz * 0.5); root.add(l); set.push(l);
    }
    lights.push({ id: C.id, set });
    // tribunes à gauche de la ligne droite (avant la ligne), panneaux à droite
    const colors = ['#e63946', '#ffbe0b', '#3a86ff', '#8338ec', '#2ec4b6'];
    for (let k = 1; k <= 4; k++) {
      const f = F[(F.length - k * 9) % F.length], gy = groundHeight(f.x, f.z), fy = Math.atan2(f.tx, f.tz);
      const stand = new THREE.Group();
      for (let r = 0; r < 4; r++) { const st = new THREE.Mesh(new THREE.BoxGeometry(40, 0.6, 2), new THREE.MeshStandardMaterial({ color: r % 2 ? '#c9ced6' : colors[k % colors.length] })); st.position.set(0, 0.6 + r * 0.9, r * 2); stand.add(st); }
      const roof = new THREE.Mesh(new THREE.BoxGeometry(42, 0.4, 9), new THREE.MeshStandardMaterial({ color: '#f4f1ea' })); roof.position.set(0, 6, 3); stand.add(roof);
      stand.position.set(f.x - f.nx * (hw + 14), gy, f.z - f.nz * (hw + 14)); stand.rotation.y = fy + Math.PI / 2; root.add(stand);
      const ad = new THREE.Mesh(new THREE.BoxGeometry(12, 2.2, 0.3), new THREE.MeshStandardMaterial({ color: colors[(k + 2) % colors.length], emissive: colors[(k + 2) % colors.length], emissiveIntensity: 0.25 }));
      ad.position.set(f.x + f.nx * (hw + 9), gy + 1.6, f.z + f.nz * (hw + 9)); ad.rotation.y = fy; root.add(ad);
    }
  }
  g.engine.scene.add(root);
  return { root, lights };
}
