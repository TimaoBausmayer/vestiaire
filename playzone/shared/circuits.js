// GRANDS CIRCUITS DE F1 : trois tracés de 6 à 8 km (environ 3 à 4 minutes par tour en monoplace),
// larges (16 m) et lisses (courbes de Catmull-Rom), loin de la ville : désert à l'ouest, collines à
// l'est, plaine du nord. Règles pures (aucune dépendance) : utilisées par la carte, les courses et
// le décor.

// Serpentin : on monte une grande ligne droite, puis on redescend en lacets (lignes parallèles
// espacées, reliées par des épingles), avec des chicanes sur certaines lignes pour varier.
function rows({ xa, xb, zs, chic = [] }) {
  const out = [];
  zs.forEach((z, i) => {
    const [from, to] = i % 2 === 0 ? [xb, xa] : [xa, xb];
    out.push([from, z]);
    if (chic.includes(i)) { const m = (from + to) / 2, d = Math.sign(to - from); out.push([m - d * 70, z], [m, z + 38], [m + d * 70, z]); }
    out.push([to, z]);
  });
  return out;
}
const CTRL = {
  // ~10 km : la plus longue (environ 4 min au tour)
  dunes: { name: 'Grand Prix des Dunes', place: 'Désert de l\'Ouest', width: 16, pts: [
    [-1890, -1350], [-1890, -2790],
    ...rows({ xa: -2080, xb: -2800, zs: [-2790, -2630, -2470, -2310, -2150, -1990, -1830, -1670], chic: [2, 5] }).slice(1),
    [-2080, -1510], [-2450, -1510], [-2450, -1350]] },
  // ~8,5 km
  collines: { name: 'Circuit des Collines', place: 'Collines de l\'Est', width: 16, pts: [
    [2810, -1150], [2810, -2210],
    ...rows({ xa: 2640, xb: 1960, zs: [-2210, -2050, -1890, -1730, -1570, -1410, -1250], chic: [1, 4] }).slice(1),
    [1960, -1150]] },
  // ~6,5 km : le plus technique (lacets nord-sud)
  nord: { name: 'Anneau du Nord', place: 'Plaine du Nord', width: 16, pts: [
    [-1700, -2845], [-760, -2845], [-760, -2100], [-948, -2100], [-948, -2700], [-1136, -2700], [-1136, -2100], [-1324, -2100], [-1324, -2700],
    [-1512, -2700], [-1512, -2100], [-1700, -2100]] },
};

// tracé lissé : chaque angle devient un virage en arc de cercle (rayon jusqu'à `R`, jamais moins que
// ce que permettent les lignes droites voisines), puis un point tous les ~12 m
function sample(ctrl, R = 70, step = 12) {
  const P = ctrl.map(([x, z]) => ({ x, z })), n = P.length, arcs = [];
  for (let i = 0; i < n; i++) {
    const A = P[(i - 1 + n) % n], B = P[i], C = P[(i + 1) % n];
    const la = Math.hypot(A.x - B.x, A.z - B.z), lc = Math.hypot(C.x - B.x, C.z - B.z);
    const u = { x: (A.x - B.x) / la, z: (A.z - B.z) / la }, v = { x: (C.x - B.x) / lc, z: (C.z - B.z) / lc };
    const th = Math.acos(Math.max(-1, Math.min(1, u.x * v.x + u.z * v.z)));      // angle intérieur
    if (th > Math.PI - 0.02) { arcs.push({ p: B, q: B, c: null }); continue; }
    let t = R / Math.tan(th / 2);
    t = Math.min(t, 0.48 * Math.min(la, lc));
    const r = t * Math.tan(th / 2);
    const p = { x: B.x + u.x * t, z: B.z + u.z * t }, q = { x: B.x + v.x * t, z: B.z + v.z * t };
    const bx = u.x + v.x, bz = u.z + v.z, bl = Math.hypot(bx, bz) || 1, dc = r / Math.sin(th / 2);
    arcs.push({ p, q, c: { x: B.x + bx / bl * dc, z: B.z + bz / bl * dc }, r });
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = arcs[i], b = arcs[(i + 1) % n];
    if (a.c) {   // arc de p à q autour de c
      let a0 = Math.atan2(a.p.z - a.c.z, a.p.x - a.c.x), a1 = Math.atan2(a.q.z - a.c.z, a.q.x - a.c.x);
      let d = a1 - a0; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      const k = Math.max(2, Math.ceil(Math.abs(d) * a.r / step));
      for (let j = 0; j < k; j++) { const ang = a0 + d * (j / k); out.push({ x: a.c.x + Math.cos(ang) * a.r, z: a.c.z + Math.sin(ang) * a.r }); }
    } else out.push(a.p);
    // ligne droite de q (fin du virage) à p du virage suivant
    const L = Math.hypot(b.p.x - a.q.x, b.p.z - a.q.z), k = Math.max(1, Math.ceil(L / step));
    for (let j = 0; j < k; j++) out.push({ x: a.q.x + (b.p.x - a.q.x) * (j / k), z: a.q.z + (b.p.z - a.q.z) * (j / k) });
  }
  return out.map((p) => ({ x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10 }));
}

// la ligne de départ est au milieu de la grande ligne droite (entre les 2 premiers points de contrôle)
function startOnStraight(pts, c) {
  const m = { x: (c[0][0] + c[1][0]) / 2, z: (c[0][1] + c[1][1]) / 2 };
  let best = 0, bd = Infinity;
  pts.forEach((p, i) => { const d = Math.hypot(p.x - m.x, p.z - m.z); if (d < bd) { bd = d; best = i; } });
  return [...pts.slice(best), ...pts.slice(0, best)];
}
export const CIRCUITS = Object.fromEntries(Object.entries(CTRL).map(([id, c]) => [id, { id, name: c.name, place: c.place, width: c.width, pts: startOnStraight(sample(c.pts), c.pts) }]));

// Est-on sur le bitume d'un grand circuit ? (grille de segments pour aller vite)
const SEG = new Map(), CELL = 64;
for (const c of Object.values(CIRCUITS)) {
  const n = c.pts.length, hw = c.width / 2 + 3;
  for (let i = 0; i < n; i++) {
    const a = c.pts[i], b = c.pts[(i + 1) % n];
    const x0 = Math.floor((Math.min(a.x, b.x) - hw) / CELL), x1 = Math.floor((Math.max(a.x, b.x) + hw) / CELL);
    const z0 = Math.floor((Math.min(a.z, b.z) - hw) / CELL), z1 = Math.floor((Math.max(a.z, b.z) + hw) / CELL);
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) { const k = `${cx},${cz}`; if (!SEG.has(k)) SEG.set(k, []); SEG.get(k).push([a.x, a.z, b.x, b.z, hw]); }
  }
}
export function onCircuit(x, z) {
  const L = SEG.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`);
  if (!L) return false;
  for (const [ax, az, bx, bz, hw] of L) {
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
    if (Math.hypot(ax + dx * t - x, az + dz * t - z) < hw) return true;
  }
  return false;
}
