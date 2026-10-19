// Vérifie le plan de la ville : chevauchements bâtiments / routes / parkings, limites de la carte.
import { BUILDINGS, ROADS, WORLD_BOUNDS, PARKINGS, GAS_STATIONS, ROAD_GRAPH } from '../shared/world-layout.js';
const rect = (b, m = 0) => [b.x - b.w / 2 - m, b.z - b.d / 2 - m, b.x + b.w / 2 + m, b.z + b.d / 2 + m];
const inter = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
let n = 0;
const warn = (m) => { n++; console.log('⚠', m); };
for (let i = 0; i < BUILDINGS.length; i++) {
  const a = BUILDINGS[i];
  for (let j = i + 1; j < BUILDINGS.length; j++) if (inter(rect(a, 0.8), rect(BUILDINGS[j], 0.8))) warn(`bâtiments ${a.id} / ${BUILDINGS[j].id}`);
  ROADS.forEach((r, k) => { if (inter(rect(a, 1.5), r)) warn(`bâtiment ${a.id} sur la route #${k} ${r}`); });
  const [x1, z1, x2, z2] = rect(a);
  if (x1 < WORLD_BOUNDS.minX || x2 > WORLD_BOUNDS.maxX || z1 < WORLD_BOUNDS.minZ || z2 > WORLD_BOUNDS.maxZ) warn(`bâtiment ${a.id} hors carte`);
  for (const o of BUILDINGS) if (o !== a && Math.abs(a.door.x - o.x) < o.w / 2 && Math.abs(a.door.z - o.z) < o.d / 2) warn(`porte de ${a.id} dans ${o.id}`);
  if (a.lot || a.yard) { const l = a.lot || a.yard; const lr = [l.x1, l.z1, l.x2, l.z2]; for (const o of BUILDINGS) if (inter(lr, rect(o, 0.5))) warn(`cour de ${a.id} sur ${o.id}`); ROADS.forEach((r, k) => { if (inter(lr, r)) warn(`cour de ${a.id} sur route ${k}`); }); }
}
for (const p of [...PARKINGS, ...GAS_STATIONS.map((g) => ({ id: g.id, x1: g.x - g.w / 2, z1: g.z - g.d / 2, x2: g.x + g.w / 2, z2: g.z + g.d / 2 }))]) {
  const r = [p.x1, p.z1, p.x2, p.z2];
  for (const o of BUILDINGS) if (inter(r, rect(o, 0.5))) warn(`parking/station ${p.id} sur ${o.id}`);
  ROADS.forEach((rr, k) => { if (inter(r, rr)) warn(`parking/station ${p.id} sur route ${k} ${rr}`); });
}
console.log(`${BUILDINGS.length} bâtiments, ${ROAD_GRAPH.nodes.length} carrefours, ${n} problème(s)`);
