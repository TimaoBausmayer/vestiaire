import { SHAPES as B } from '../core/static-builder.js';
import { LAKE, MARINA, WATER_LEVEL, groundHeight } from '../../shared/world-layout.js';
import { tree } from './props.js';
import { isFree, block } from './city-props.js';
import { ROUTES } from '../../shared/courses.js';

// DÉCOR DE LA TRÈS GRANDE CARTE : aéroport (piste, tour de contrôle, avions garés), port du Grand-Large
// (pontons, yachts), Lac des Grenouilles (ponton, barques), panneaux d'autoroute.

// avion orienté le long de l'axe X (nez vers +X)
function plane(sb, x, z, k, livery) {
  sb.add(B.cyl(14), { x, y: 2.6 * k, z, sx: 3 * k, sy: 30 * k, sz: 3 * k, rz: Math.PI / 2, color: '#f4f4f4' });     // fuselage
  sb.add(B.cyl(14), { x: x - 2 * k, y: 2.6 * k, z, sx: 3.05 * k, sy: 6 * k, sz: 3.05 * k, rz: Math.PI / 2, color: livery });   // bande de couleur
  sb.add(B.sphere(12), { x: x + 15 * k, y: 2.6 * k, z, sx: 4 * k, sy: 3 * k, sz: 3 * k, color: '#f4f4f4' });         // nez
  sb.add(B.box(), { x: x + 16 * k, y: 3.2 * k, z, sx: 0.8 * k, sy: 0.5 * k, sz: 1.6 * k, color: '#1b263b' });       // cockpit
  sb.add(B.cone(10), { x: x - 17 * k, y: 2.8 * k, z, sx: 3 * k, sy: 5 * k, sz: 3 * k, rz: Math.PI / 2, color: '#f4f4f4' });   // queue
  sb.add(B.box(), { x: x + 1 * k, y: 2.2 * k, z, sx: 5 * k, sy: 0.35 * k, sz: 34 * k, color: '#dfe3e8' });            // ailes
  sb.add(B.box(), { x: x - 15 * k, y: 3 * k, z, sx: 2.6 * k, sy: 0.3 * k, sz: 11 * k, color: '#dfe3e8' });            // stabilisateur
  sb.add(B.box(), { x: x - 15.5 * k, y: 5.5 * k, z, sx: 3.6 * k, sy: 5 * k, sz: 0.4 * k, color: livery });            // dérive
  for (const sz of [-1, 1]) sb.add(B.cyl(12), { x: x + 2.5 * k, y: 1.6 * k, z: z + sz * 6.5 * k, sx: 1.6 * k, sy: 3.6 * k, sz: 1.6 * k, rz: Math.PI / 2, color: '#adb5bd' });   // réacteurs
  for (const [lx, lz] of [[12, 0], [0, -2.5], [0, 2.5]]) sb.cyl(x + lx * k, 0, z + lz * k, 0.35 * k, 1.1 * k, '#2b2d33', 8);   // trains
}

function yacht(sb, x, z, yaw, L, color) {
  const y = WATER_LEVEL;
  sb.add(B.sphere(14), { x, y: y + 0.4, z, sx: L * 0.32, sy: 1.6, sz: L, ry: yaw, color: '#ffffff' });
  sb.add(B.box(), { x, y: y + 1.0, z, sx: L * 0.28, sy: 0.25, sz: L * 0.8, ry: yaw, color: color });
  sb.add(B.box(), { x, y: y + 1.6, z: z - Math.cos(yaw) * L * 0.08, sx: L * 0.2, sy: 1.1, sz: L * 0.38, ry: yaw, color: '#f8f9fa' });
  sb.add(B.box(), { x, y: y + 1.7, z: z - Math.cos(yaw) * L * 0.08, sx: L * 0.205, sy: 0.4, sz: L * 0.3, ry: yaw, color: '#1b263b' });
  if (L > 14) sb.cyl(x, y + 1.6, z + Math.cos(yaw) * L * 0.1, 0.08, L * 0.9, '#d0d4da', 6);   // mât des voiliers
}

export function buildExpansionProps(sb, col) {
  // --- Aéroport : piste (900 m), marquages, voie de circulation, tour de contrôle, avions
  sb.quad(1325, 0.04, -1550, 850, 50, '#3e4148', 0, 'ground');
  for (let x = 920; x < 1730; x += 40) sb.quad(x, 0.05, -1550, 20, 1.2, '#f4f1ea', 0, 'ground');
  for (const z of [-1572, -1528]) sb.quad(1325, 0.05, z, 850, 0.8, '#f4f1ea', 0, 'ground');
  for (let k = 0; k < 8; k++) for (const ex of [910, 1740]) sb.quad(ex, 0.05, -1568 + k * 5, 6, 2.2, '#f4f1ea', 0, 'ground');
  sb.quad(1300, 0.04, -1450, 30, 160, '#4a4e57', 0, 'ground');                       // voie de circulation
  sb.quad(1300, 0.04, -1395, 260, 40, '#55595f', 0, 'ground');                       // tarmac
  sb.box(1480, 0, -1420, 8, 26, 8, '#e9ecef'); sb.box(1480, 26, -1420, 12, 5, 12, '#1b263b'); sb.box(1480, 31, -1420, 13, 0.5, 13, '#adb5bd');   // tour de contrôle
  col.addBox(1476, 0, -1424, 1484, 31, -1416);
  plane(sb, 1200, -1395, 1, '#d00000');
  plane(sb, 1380, -1395, 1, '#1d4ed8');
  plane(sb, 1600, -1440, 0.55, '#ffd23f');   // jet privé devant le hangar
  for (const [x, z] of [[1200, -1395], [1380, -1395]]) col.addBox(x - 17, 0, z - 2, x + 17, 6, z + 2);
  // --- Port du Grand-Large : quai, pontons, yachts et voiliers
  sb.quad((MARINA.x1 + MARINA.x2) / 2, 0.05, 98, MARINA.x2 - MARINA.x1, 8, '#b3aea4', 0, 'ground');
  for (let x = MARINA.x1 + 40; x < MARINA.x2 - 20; x += 70) {
    sb.box(x, WATER_LEVEL + 0.3, 140, 3, 0.3, 76, '#a0703c');
    col.addBox(x - 1.5, 0, 102, x + 1.5, 0.6, 178);
    for (const [dx, dz, L, c] of [[-9, 120, 16, '#1d3557'], [9, 135, 12, '#e63946'], [-9, 158, 20, '#14213d'], [9, 165, 14, '#2a9d8f']]) yacht(sb, x + dx, dz, 0, L, c);
  }
  // --- Lac des Grenouilles : ponton et barques
  sb.box(LAKE.x, WATER_LEVEL + 0.3, LAKE.z - LAKE.r / 1.3 + 14, 3, 0.3, 30, '#a0703c');
  col.addBox(LAKE.x - 1.5, 0, LAKE.z - LAKE.r / 1.3 - 2, LAKE.x + 1.5, 0.6, LAKE.z - LAKE.r / 1.3 + 29);
  for (const [dx, dz] of [[-40, 10], [30, -20], [60, 40]]) { sb.add(B.sphere(10), { x: LAKE.x + dx, y: WATER_LEVEL + 0.15, z: LAKE.z + dz, sx: 1.6, sy: 0.7, sz: 4, color: '#8d5a2b' }); }
  // --- grands panneaux d'autoroute (directions)
  for (const [x, z, txt] of [[-30, -925, 'A3 → NORDVILLE · AÉROPORT'], [870, -925, 'A1 → PORT GRAND-LARGE'], [-870, -925, 'A1 → LAC · VILLAGE DES MARMOTTES']]) {
    sb.box(x, 0, z, 0.4, 6, 0.4, '#6c757d'); sb.box(x + 9, 0, z, 0.4, 6, 0.4, '#6c757d'); sb.box(x + 4.5, 6, z, 11, 2.4, 0.3, '#0b6e4f');
    void txt;
  }
}

// ---------- CARTE GÉANTE : désert (mesas, cactus), Palmeraie (palmiers, plage), alpages (sapins, chalets)
let seed = 4242;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const R = (a, b) => a + rnd() * (b - a);

function cactus(sb, x, z, s) {
  const y = groundHeight(x, z), c = rnd() > 0.5 ? '#4f7d3a' : '#5e8f45';
  sb.add(B.cyl(8), { x, y, z, sx: 0.55 * s, sy: 3.2 * s, sz: 0.55 * s, color: c });
  sb.add(B.sphere(8), { x, y: y + 3.2 * s, z, sx: 0.55 * s, sy: 0.4 * s, sz: 0.55 * s, color: c });
  for (const side of [-1, 1]) {
    if (rnd() < 0.25) continue;
    const ay = y + R(1.1, 2) * s;
    sb.add(B.cyl(8), { x: x + side * 0.55 * s, y: ay, z, sx: 0.8 * s, sy: 0.32 * s, sz: 0.32 * s, rz: Math.PI / 2, color: c });
    sb.add(B.cyl(8), { x: x + side * 0.85 * s, y: ay, z, sx: 0.34 * s, sy: 1.2 * s, sz: 0.34 * s, color: c });
  }
}

// mesa : butte de roche rouge à flancs abrupts, strates horizontales
function mesa(sb, col, x, z, r, h) {
  const cols = ['#b5523b', '#c8693f', '#a44a3f', '#d08159'];
  let y = 0;
  for (let i = 0; i < 4; i++) {
    const hh = h / 4, rr = r * (1 - i * 0.07);
    sb.add(B.cyl(14), { x, y, z, sx: rr * 2, sy: hh, sz: rr * 1.7, ry: x * 0.01, color: cols[i] });
    y += hh;
  }
  sb.add(B.cyl(14), { x, y, z, sx: r * 1.65, sy: 0.6, sz: r * 1.4, ry: x * 0.01, color: '#c2a074' });
  col.addBox(x - r * 0.8, 0, z - r * 0.7, x + r * 0.8, h, z + r * 0.7);
}

// Tracé d'un parcours : bandes posées segment par segment (+ disques aux virages), et zone sans arbres.
function paintRoute(sb, r, color, edge) {
  for (let i = 0; i < r.pts.length; i++) {
    const a = r.pts[i], b = r.pts[(i + 1) % r.pts.length], len = Math.hypot(b.x - a.x, b.z - a.z), yaw = Math.atan2(b.x - a.x, b.z - a.z);
    const cx = (a.x + b.x) / 2, cz = (a.z + b.z) / 2;
    if (edge) sb.quad(cx, 0.035, cz, r.width + 1.6, len, edge, yaw, 'ground');
    sb.quad(cx, 0.045, cz, r.width, len, color, yaw, 'ground');
    sb.add(B.cyl(16), { x: a.x, y: 0.046, z: a.z, sx: r.width, sy: 0.01, sz: r.width, color });   // virage arrondi
    block(Math.min(a.x, b.x) - r.width, Math.min(a.z, b.z) - r.width, Math.max(a.x, b.x) + r.width, Math.max(a.z, b.z) + r.width);
  }
}

// Bike Park des Géants : sentier VTT (terre, bosses, virages relevés, passerelles), Route des Cols
// (asphalte, ligne médiane), piste de bosses (pump track) devant le magasin.
function bikePark(sb, col) {
  const V = ROUTES.vtt, C = ROUTES.cols;
  paintRoute(sb, V, '#8d6e4f', '#6b8f3a');
  paintRoute(sb, C, '#3e4148', '#c9c3b6');
  // ligne médiane pointillée de la Route des Cols
  for (let i = 0; i < C.pts.length; i++) {
    const a = C.pts[i], b = C.pts[(i + 1) % C.pts.length], len = Math.hypot(b.x - a.x, b.z - a.z), yaw = Math.atan2(b.x - a.x, b.z - a.z);
    for (let d = 6; d < len - 6; d += 12) sb.quad(a.x + (b.x - a.x) * d / len, 0.05, a.z + (b.z - a.z) * d / len, 0.25, 5, '#f4f1ea', yaw, 'ground');
  }
  // bosses du sentier : petites buttes de terre franchissables (le vélo monte dessus)
  for (let i = 0; i < V.pts.length; i++) {
    const a = V.pts[i], b = V.pts[(i + 1) % V.pts.length], len = Math.hypot(b.x - a.x, b.z - a.z), yaw = Math.atan2(b.x - a.x, b.z - a.z);
    for (let d = 18; d < len - 12; d += 22) {
      const x = a.x + (b.x - a.x) * d / len, z = a.z + (b.z - a.z) * d / len;
      sb.add(B.sphere(12), { x, y: -0.05, z, sx: V.width * 0.9, sy: 0.8, sz: 3.2, ry: yaw, color: '#7a5c3e' });
      const hx = Math.abs(Math.cos(yaw)) * V.width * 0.4 + Math.abs(Math.sin(yaw)) * 1.2, hz = Math.abs(Math.sin(yaw)) * V.width * 0.4 + Math.abs(Math.cos(yaw)) * 1.2;
      col.addBox(x - hx, 0, z - hz, x + hx, 0.32, z + hz);
    }
    // virage relevé (berme) à l'extérieur de chaque virage, et quelques rochers
    sb.add(B.sphere(12), { x: a.x, y: 0, z: a.z, sx: V.width * 1.6, sy: 1.2, sz: V.width * 1.6, color: '#6f5236' });
    sb.blob(a.x + V.width, 0, a.z + 2, 1.1, '#8d8f8a', 0.6);
  }
  // panneaux de départ (arche) du sentier et de la Route des Cols
  for (const [r, c] of [[V, '#ff6b35'], [C, '#1d4ed8']]) {
    const p = r.pts[0], q = r.pts[1], yaw = Math.atan2(q.x - p.x, q.z - p.z), ox = Math.cos(yaw) * (r.width / 2 + 3), oz = -Math.sin(yaw) * (r.width / 2 + 3);
    sb.box(p.x + ox, 0, p.z + oz, 0.4, 5, 0.4, c); sb.box(p.x - ox, 0, p.z - oz, 0.4, 5, 0.4, c);
    sb.add(B.box(), { x: p.x, y: 5, z: p.z, sx: r.width + 6.4, sy: 1, sz: 0.4, ry: yaw + Math.PI / 2, color: c });
    col.addCyl(p.x + ox, p.z + oz, 0.25, 0, 5); col.addCyl(p.x - ox, p.z - oz, 0.25, 0, 5);
  }
  // pump track (ovale de bosses) devant le magasin, au sud de la route des Cimes
  const pt = { x: 760, z: -2468, rx: 34, rz: 14 };
  for (let k = 0; k < 40; k++) {
    const a0 = (k / 40) * Math.PI * 2, x = pt.x + Math.cos(a0) * pt.rx, z = pt.z + Math.sin(a0) * pt.rz;
    sb.add(B.sphere(10), { x, y: -0.1, z, sx: 6, sy: k % 2 ? 1.2 : 0.5, sz: 6, color: k % 2 ? '#8d6e4f' : '#7a5c3e' });
    if (k % 2) col.addBox(x - 1.5, 0, z - 1.5, x + 1.5, 0.45, z + 1.5);
  }
  block(pt.x - pt.rx - 4, pt.z - pt.rz - 4, pt.x + pt.rx + 4, pt.z + pt.rz + 4);
  // râteliers à vélos devant le magasin
  for (let i = 0; i < 6; i++) sb.add(B.torus(), { x: 912 + i * 1.6, y: 0.5, z: -2511, sx: 1, sy: 1, sz: 1, color: '#adb5bd' });
}

export function buildGiantProps(sb, col) {
  bikePark(sb, col);
  // --- désert des Sablons
  let n = 0;
  for (let i = 0; i < 400 && n < 16; i++) {
    const x = R(-2960, -1950), z = R(-1950, 0), r = R(14, 34);
    if (Math.abs(z + 700) < r + 25 || Math.abs(x + 2400) < r + 200 || Math.abs(x + 2900) < r + 20) continue;
    if (!isFree(x, z, r + 6)) continue;
    mesa(sb, col, x, z, r, R(18, 46)); n++;
  }
  for (let i = 0; i < 1400; i++) {
    const x = R(-2990, -1880), z = R(-1990, 50);
    if (!isFree(x, z, 1.5)) continue;
    if (i % 4) cactus(sb, x, z, R(0.7, 1.3));
    else sb.blob(x, groundHeight(x, z), z, R(0.5, 1.6), i % 8 ? '#a98467' : '#7f6a4f', 0.55);
  }
  // château d'eau des Sablons
  sb.cyl(-2460, 0, -660, 0.4, 14, '#6c584c', 6); sb.cyl(-2452, 0, -660, 0.4, 14, '#6c584c', 6); sb.cyl(-2456, 0, -654, 0.4, 14, '#6c584c', 6);
  sb.cyl(-2456, 14, -658, 4, 6, '#9c6644', 16); sb.cone(-2456, 20, -658, 4.6, 2.5, '#582f0e', 16);
  col.addBox(-2462, 0, -664, -2450, 22, -652);
  // --- côte des Palmiers et Palmeraie
  for (let i = 0; i < 1600; i++) {
    const beach = i < 500;
    const x = beach ? R(2900, 2960) : R(1880, 2960), z = R(-1990, 50);
    if (!isFree(x, z, 1.5)) continue;
    tree(sb, col, x, z, beach || x > 2280 || i % 3 === 0 ? 'palm' : 'round', R(0.9, 1.35));
  }
  const parasol = ['#ff6b6b', '#ffd166', '#06d6a0', '#118ab2', '#ef476f'];
  for (let z = -980; z < 40; z += 22) {
    const x = R(2965, 2985);
    sb.cyl(x, 0, z, 0.06, 2.4, '#f8f9fa', 6);
    sb.cone(x, 2.2, z, 2.4, 0.7, parasol[(z / 22 | 0) & 3], 10);
    sb.quad(x + 2, 0.05, z + 1, 1, 2, parasol[((z / 22 | 0) + 2) % 5], 0, 'ground');
  }
  // --- hauts plateaux, alpages et pentes du Massif des Géants : sapins
  for (let i = 0; i < 2600; i++) {
    const x = R(-2990, 2990), z = i < 1700 ? R(-2950, -2010) : R(-3250, -2970);
    if (z > -2950 && !isFree(x, z, 1.5)) continue;
    if (x > -720 && x < 720 && z > -2640 && z < -2080 && rnd() < 0.85) continue;   // village dégagé
    const y = groundHeight(x, z);
    if (y > 70) continue;   // au-dessus de la limite des arbres
    tree(sb, col, x, z, rnd() > 0.15 ? 'pine' : 'round', R(1, 1.8));
  }
  // rochers dans les alpages
  for (let i = 0; i < 240; i++) {
    const x = R(-2990, 2990), z = R(-2950, -2020);
    if (isFree(x, z, 2)) sb.blob(x, groundHeight(x, z), z, R(0.8, 2.6), '#8d8f8a', 0.6);
  }
  // fontaine du village de Glacier-sur-Alpe
  sb.cyl(0, 0, -2400, 4, 0.8, '#adb5bd', 16); sb.cyl(0, 0.8, -2400, 0.5, 2.2, '#adb5bd', 8); sb.sphere(0, 3.1, -2400, 0.6, '#90e0ef', 10);
  col.addBox(-4, 0, -2404, 4, 1, -2396);
}
