import { SHAPES } from '../core/static-builder.js';
import { REEFS, WRECK, TREASURE } from '../../shared/sea.js';
import { groundHeight, WATER_LEVEL } from '../../shared/world-layout.js';
import { mulberry32 } from '../../shared/rng.js';

// FONDS MARINS (décor) : coraux cerveaux, branchus, tables et éventails, anémones, algues, rochers,
// étoiles de mer et coquillages sur les récifs ; herbiers épars le long de la côte ; épave et coffre.
const CORAL = ['#ff6f91', '#ff9671', '#ffc75f', '#f9f871', '#c34a36', '#d65db1', '#845ec2', '#ff8066', '#4ffbdf', '#ffb5c2'];
const ALGAE = ['#2f8f46', '#3c9d5a', '#6a994e', '#386641', '#8ab17d'];

export function buildSeabed(sb, col) {
  for (const reef of REEFS) {
    const r = mulberry32(reef.x * 31 + reef.z * 17);
    const pk = (a) => a[Math.floor(r() * a.length)];
    const n = reef.wreck ? 40 : 110;
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * reef.r * 1.25;
      const x = reef.x + Math.cos(a) * d, z = reef.z + Math.sin(a) * d, y = groundHeight(x, z) - 0.05;
      if (y > WATER_LEVEL - 1.2) continue;   // jamais au ras de la surface
      const k = r();
      if (k < 0.18) sb.blob(x, y, z, 0.5 + r() * 0.8, pk(CORAL), 0.55);                       // corail cerveau
      else if (k < 0.36) {                                                                     // corail branchu
        const c = pk(CORAL);
        for (let j = 0; j < 5; j++) { const bx = x + (r() - 0.5) * 0.9, bz = z + (r() - 0.5) * 0.9, hh = 0.5 + r() * 1.1; sb.add(SHAPES.cyl(6), { x: bx, y, z: bz, sx: 0.14, sy: hh, sz: 0.14, rx: (r() - 0.5) * 0.6, rz: (r() - 0.5) * 0.6, color: c }); sb.sphere(bx, y + hh, bz, 0.1, c, 6); }
      } else if (k < 0.46) { const c = pk(CORAL); sb.cyl(x, y, z, 0.12, 0.7, c, 6); sb.cyl(x, y + 0.7, z, 0.9 + r() * 0.6, 0.12, c, 12); }   // corail table
      else if (k < 0.56) sb.add(SHAPES.box(), { x, y, z, sx: 1.3, sy: 1.1 + r() * 0.6, sz: 0.06, ry: r() * Math.PI, rx: (r() - 0.5) * 0.3, color: pk(['#d65db1', '#ff6f91', '#845ec2', '#ffc75f']) });   // gorgone
      else if (k < 0.64) { const c = pk(['#ff8066', '#f9f871', '#4ffbdf', '#ff9671']); sb.cyl(x, y, z, 0.25, 0.3, '#8b5e3c', 8); for (let j = 0; j < 7; j++) { const aa = j / 7 * Math.PI * 2; sb.add(SHAPES.cyl(5), { x: x + Math.cos(aa) * 0.15, y: y + 0.3, z: z + Math.sin(aa) * 0.15, sx: 0.06, sy: 0.35, sz: 0.06, rx: Math.sin(aa) * 0.5, rz: -Math.cos(aa) * 0.5, color: c }); } }   // anémone
      else if (k < 0.78) { const c = pk(ALGAE); for (let j = 0; j < 3; j++) sb.add(SHAPES.box(), { x: x + (r() - 0.5) * 0.6, y, z: z + (r() - 0.5) * 0.6, sx: 0.12, sy: 1.2 + r() * Math.min(3.5, -y - 1.5), sz: 0.04, ry: r() * Math.PI, rx: (r() - 0.5) * 0.25, color: c }); }   // algues
      else if (k < 0.9) sb.blob(x, y, z, 0.6 + r() * 1.4, pk(['#6c757d', '#7d6e5a', '#5c677d', '#8d8173']), 0.6);   // rocher
      else if (k < 0.96) { const c = pk(['#ff7b00', '#e63946', '#ffd23f']); for (let j = 0; j < 5; j++) sb.add(SHAPES.box(), { x, y: y + 0.03, z, sx: 0.09, sy: 0.04, sz: 0.42, ry: j / 5 * Math.PI * 2, color: c }); }   // étoile de mer
      else sb.add(SHAPES.cone(8), { x, y, z, sx: 0.3, sy: 0.25, sz: 0.3, rx: 0.4, color: pk(['#f4f1ea', '#ffc8dd', '#ffd8a8']) });   // coquillage
    }
  }
  // herbiers et rochers épars le long de toute la côte sud
  const r = mulberry32(4242);
  for (let i = 0; i < 520; i++) {
    const x = -2900 + r() * 5800, z = 110 + r() * 280, y = groundHeight(x, z) - 0.05;
    if (y > WATER_LEVEL - 1.6) continue;
    if (r() < 0.6) { const c = ALGAE[Math.floor(r() * ALGAE.length)]; for (let j = 0; j < 4; j++) sb.add(SHAPES.box(), { x: x + (r() - 0.5), y, z: z + (r() - 0.5), sx: 0.1, sy: 0.8 + r() * 2.2, sz: 0.04, ry: r() * Math.PI, color: c }); }
    else sb.blob(x, y, z, 0.4 + r() * 1.2, '#7d6e5a', 0.5);
  }
  buildWreck(sb, col);
}

// Épave du Sardine-Express : coque couchée, mât brisé, cabine, coffre au trésor.
function buildWreck(sb) {
  const { x, z } = WRECK, y = groundHeight(x, z) - 0.4, ry = 0.5, c = Math.cos(ry), s = Math.sin(ry);
  const L = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const box = (lx, ly, lz, w, h, d, color, extra = {}) => { const [px, pz] = L(lx, lz); sb.add(SHAPES.box(), { x: px, y: y + ly, z: pz, sx: w, sy: h, sz: d, ry, rz: 0.22, color, ...extra }); };
  box(0, 0, 0, 5, 2.2, 18, '#5a3d2b');                    // coque
  box(0, 2.2, 0, 4.4, 0.25, 16, '#7a5230');               // pont
  box(0, 0.4, 8.6, 3.2, 1.8, 2, '#5a3d2b');               // proue
  box(-1.4, 2.4, -1, 0.3, 0.9, 12, '#3a2a1c');            // bastingage
  box(0.4, 2.4, -5, 2.6, 1.8, 3, '#8a6a4a');              // cabine
  box(0.4, 3.3, -5, 2.4, 0.3, 2.8, '#4a3020');
  { const [px, pz] = L(0.3, 2); sb.add(SHAPES.cyl(8), { x: px, y: y + 2.3, z: pz, sx: 0.4, sy: 6, sz: 0.4, rx: 0.9, ry, color: '#3a2a1c' }); }   // mât brisé
  { const [px, pz] = L(0, -8.4); sb.cyl(px, y + 0.6, pz, 0.5, 0.2, '#b08d57', 10); }                                                            // hélice
  // algues et coraux qui ont colonisé l'épave
  const r = mulberry32(99);
  for (let i = 0; i < 18; i++) { const [px, pz] = L((r() - 0.5) * 4, (r() - 0.5) * 16); sb.blob(px, y + 2.3 + r() * 0.3, pz, 0.3 + r() * 0.3, CORAL[Math.floor(r() * CORAL.length)], 0.6); }
  // coffre au trésor
  const ty = groundHeight(TREASURE.x, TREASURE.z);
  sb.box(TREASURE.x, ty, TREASURE.z, 1.2, 0.7, 0.8, '#7a4b2a', 0.3);
  sb.add(SHAPES.cyl(10), { x: TREASURE.x, y: ty + 0.7, z: TREASURE.z, sx: 1.2, sy: 0.8, sz: 0.8, rz: Math.PI / 2, ry: 0.3, color: '#8d5a34' });
  sb.box(TREASURE.x, ty + 0.3, TREASURE.z, 1.25, 0.12, 0.85, '#ffd23f', 0.3);
  sb.sphere(TREASURE.x + 0.5, ty + 0.75, TREASURE.z + 0.4, 0.12, '#ffd23f', 8);
}
