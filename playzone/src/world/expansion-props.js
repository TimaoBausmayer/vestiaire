import { SHAPES as B } from '../core/static-builder.js';
import { LAKE, MARINA, WATER_LEVEL } from '../../shared/world-layout.js';

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
