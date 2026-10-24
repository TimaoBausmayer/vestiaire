// PLAN DE LA GRANDE VILLE (mise à jour "monde ouvert") — données pures partagées client / serveur.
// Le centre historique (place, parc, ferme Bidoche, quartier des Mouettes, plage) est conservé ;
// autour : quartier d'affaires, port, zone commerciale, quartier résidentiel des Tilleuls, zone
// industrielle, campagne, plage sauvage, parc de loisirs, circuit et prison.
// Repère : X vers l'est, Z vers le sud. Unité ≈ 1 m.

export const BOUNDS = { minX: -3000, maxX: 3000, minZ: -3400, maxZ: 400 };

// ---------------------------------------------------------------------------------------------
// RUES : segments horizontaux (h : z fixe, de x1 à x2) ou verticaux (v : x fixe, de z1 à z2).
// w = largeur de chaussée ; kind : main (boulevard), street (rue), country (route de campagne).
export const STREETS = [
  // centre historique (boulevard autour de la place + avenues)
  { id: 'place-n', name: 'Boulevard de la Place', axis: 'h', z: -28, x1: -28, x2: 28, w: 8, kind: 'main' },
  { id: 'place-s', name: 'Boulevard de la Place', axis: 'h', z: 28, x1: -28, x2: 28, w: 8, kind: 'main' },
  { id: 'place-w', name: 'Boulevard de la Place', axis: 'v', x: -28, z1: -28, z2: 28, w: 8, kind: 'main' },
  { id: 'place-e', name: 'Boulevard de la Place', axis: 'v', x: 28, z1: -28, z2: 28, w: 8, kind: 'main' },
  { id: 'av-nord', name: 'Avenue du Parc', axis: 'v', x: 0, z1: -60, z2: -28, w: 8, kind: 'street' },
  { id: 'av-sud', name: 'Avenue de la Plage', axis: 'v', x: 0, z1: 28, z2: 60, w: 8, kind: 'street' },
  { id: 'av-est', name: 'Avenue des Mouettes', axis: 'h', z: 0, x1: 28, x2: 140, w: 8, kind: 'main' },
  { id: 'av-ouest', name: 'Avenue de la Ferme', axis: 'h', z: 0, x1: -140, x2: -28, w: 8, kind: 'main' },
  { id: 'crapaud', name: 'Rue du Crapaud', axis: 'v', x: 96, z1: -140, z2: 60, w: 6, kind: 'street' },
  { id: 'foret', name: 'Chemin de la Forêt', axis: 'v', x: -62, z1: -140, z2: 0, w: 7, kind: 'country' },
  // grands axes
  { id: 'corniche', name: 'Route de la Corniche', axis: 'h', z: 60, x1: -290, x2: 290, w: 8, kind: 'main' },
  { id: 'bd-est', name: 'Boulevard Lumière', axis: 'h', z: 0, x1: 140, x2: 290, w: 9, kind: 'main' },
  { id: 'campagne', name: 'Route des Navets', axis: 'h', z: 0, x1: -290, x2: -140, w: 7, kind: 'country' },
  { id: 'affaires', name: 'Rue des Affaires', axis: 'h', z: -70, x1: 140, x2: 290, w: 7, kind: 'street' },
  { id: 'chemin-navets', name: 'Chemin des Vaches', axis: 'h', z: -70, x1: -290, x2: -140, w: 7, kind: 'country' },
  { id: 'bd-nord', name: 'Boulevard du Nord', axis: 'h', z: -140, x1: -290, x2: 290, w: 10, kind: 'main' },
  { id: 'lilas', name: 'Rue des Lilas', axis: 'h', z: -190, x1: -290, x2: 290, w: 7, kind: 'street' },
  { id: 'tilleuls', name: 'Avenue des Tilleuls', axis: 'h', z: -240, x1: -290, x2: 290, w: 9, kind: 'main' },
  { id: 'glycines', name: 'Rue des Glycines', axis: 'h', z: -290, x1: -290, x2: 290, w: 7, kind: 'street' },
  { id: 'loisirs', name: 'Route des Loisirs', axis: 'h', z: -335, x1: -290, x2: 290, w: 9, kind: 'main' },
  { id: 'ouest', name: 'Route de l\'Ouest', axis: 'v', x: -290, z1: -335, z2: 60, w: 8, kind: 'main' },
  { id: 'moulin', name: 'Rue du Moulin', axis: 'v', x: -220, z1: -335, z2: 60, w: 7, kind: 'street' },
  { id: 'periph-o', name: 'Boulevard Périphérique Ouest', axis: 'v', x: -140, z1: -335, z2: 60, w: 9, kind: 'main' },
  { id: 'ecoles', name: 'Rue des Écoles', axis: 'v', x: -70, z1: -335, z2: -140, w: 7, kind: 'street' },
  { id: 'centrale', name: 'Avenue Centrale', axis: 'v', x: 0, z1: -335, z2: -140, w: 9, kind: 'main' },
  { id: 'platanes', name: 'Rue des Platanes', axis: 'v', x: 70, z1: -335, z2: -140, w: 7, kind: 'street' },
  { id: 'periph-e', name: 'Boulevard Périphérique Est', axis: 'v', x: 140, z1: -335, z2: 60, w: 9, kind: 'main' },
  { id: 'av-affaires', name: 'Avenue du Commerce', axis: 'v', x: 210, z1: -335, z2: 60, w: 8, kind: 'main' },
  { id: 'est', name: 'Route de l\'Est', axis: 'v', x: 290, z1: -335, z2: 60, w: 8, kind: 'main' },
  // Quartier des Paillettes (loisirs du soir : casino, stand de tir, laser game...)
  { id: 'paillettes', name: 'Boulevard des Paillettes', axis: 'h', z: -430, x1: -290, x2: 140, w: 10, kind: 'main' },
  { id: 'ouest-nord', name: 'Route de l\'Ouest', axis: 'v', x: -290, z1: -430, z2: -335, w: 8, kind: 'main' },
  { id: 'periph-o-nord', name: 'Boulevard Périphérique Ouest', axis: 'v', x: -140, z1: -430, z2: -335, w: 9, kind: 'main' },
  { id: 'periph-e-nord', name: 'Boulevard Périphérique Est', axis: 'v', x: 140, z1: -430, z2: -335, w: 9, kind: 'main' },
  // --- GRANDE CARTE : autoroute en anneau (nord, ouest, est), corniche prolongée et nouveaux quartiers
  { id: 'a1-nord', name: 'Autoroute A1 du Soleil', axis: 'h', z: -940, x1: -840, x2: 840, w: 16, kind: 'highway' },
  { id: 'a1-ouest', name: 'Autoroute A1 du Soleil', axis: 'v', x: -840, z1: -940, z2: 60, w: 16, kind: 'highway' },
  { id: 'a1-est', name: 'Autoroute A1 du Soleil', axis: 'v', x: 840, z1: -940, z2: 60, w: 16, kind: 'highway' },
  { id: 'corniche-o', name: 'Route de la Corniche', axis: 'h', z: 60, x1: -840, x2: -290, w: 8, kind: 'main' },
  { id: 'corniche-e', name: 'Route de la Corniche', axis: 'h', z: 60, x1: 290, x2: 840, w: 8, kind: 'main' },
  { id: 'nationale-o', name: 'Route Nationale 7', axis: 'h', z: -140, x1: -840, x2: -290, w: 9, kind: 'main' },
  { id: 'nationale-e', name: 'Route Nationale 7', axis: 'h', z: -140, x1: 290, x2: 840, w: 10, kind: 'main' },
  { id: 'prestige', name: 'Avenue de Prestige', axis: 'h', z: -335, x1: 290, x2: 840, w: 9, kind: 'main' },
  { id: 'vignes', name: 'Route des Vignes', axis: 'h', z: -335, x1: -840, x2: -290, w: 7, kind: 'country' },
  { id: 'paillettes-e', name: 'Boulevard des Paillettes', axis: 'h', z: -430, x1: 140, x2: 840, w: 10, kind: 'main' },
  { id: 'paillettes-o', name: 'Route des Collines', axis: 'h', z: -430, x1: -840, x2: -290, w: 8, kind: 'country' },
  { id: 'hauts', name: 'Avenue des Hauts', axis: 'h', z: -700, x1: -840, x2: 840, w: 9, kind: 'main' },
  { id: 'vignobles', name: 'Route des Vignobles', axis: 'v', x: -560, z1: -940, z2: 60, w: 7, kind: 'country' },
  { id: 'emploi', name: 'Boulevard de l\'Emploi', axis: 'v', x: 560, z1: -940, z2: 60, w: 9, kind: 'main' },
  { id: 'ouest-haut', name: 'Route de l\'Ouest', axis: 'v', x: -290, z1: -940, z2: -430, w: 8, kind: 'main' },
  { id: 'periph-o-haut', name: 'Boulevard Périphérique Ouest', axis: 'v', x: -140, z1: -940, z2: -430, w: 9, kind: 'main' },
  { id: 'periph-e-haut', name: 'Boulevard Périphérique Est', axis: 'v', x: 140, z1: -940, z2: -430, w: 9, kind: 'main' },
  { id: 'est-haut', name: 'Route de l\'Est', axis: 'v', x: 290, z1: -940, z2: -430, w: 8, kind: 'main' },
  // --- TRÈS GRANDE CARTE : 2e anneau d'autoroute (A2), autoroute A3 vers Nordville et l'aéroport, villages
  { id: 'a1-nord-o', name: 'Autoroute A1 du Soleil', axis: 'h', z: -940, x1: -1800, x2: -840, w: 16, kind: 'highway' },
  { id: 'a1-nord-e', name: 'Autoroute A1 du Soleil', axis: 'h', z: -940, x1: 840, x2: 1800, w: 16, kind: 'highway' },
  { id: 'a2-nord', name: 'Autoroute A2 des Sommets', axis: 'h', z: -1900, x1: -1800, x2: 1800, w: 16, kind: 'highway' },
  { id: 'a2-ouest', name: 'Autoroute A2 des Sommets', axis: 'v', x: -1800, z1: -1900, z2: 60, w: 16, kind: 'highway' },
  { id: 'a2-est', name: 'Autoroute A2 des Sommets', axis: 'v', x: 1800, z1: -1900, z2: 60, w: 16, kind: 'highway' },
  { id: 'a3', name: 'Autoroute A3 du Nord', axis: 'v', x: 0, z1: -1900, z2: -940, w: 16, kind: 'highway' },
  { id: 'corniche-oo', name: 'Route de la Corniche', axis: 'h', z: 60, x1: -1800, x2: -840, w: 8, kind: 'main' },
  { id: 'corniche-ee', name: 'Route de la Corniche', axis: 'h', z: 60, x1: 840, x2: 1800, w: 8, kind: 'main' },
  // Nordville : la ville du nord
  { id: 'nord-o', name: 'Avenue du Nord-Ouest', axis: 'v', x: -400, z1: -1900, z2: -940, w: 10, kind: 'main' },
  { id: 'nord-e', name: 'Avenue du Nord-Est', axis: 'v', x: 400, z1: -1900, z2: -940, w: 10, kind: 'main' },
  { id: 'nv-1', name: 'Boulevard de Nordville', axis: 'h', z: -1250, x1: -400, x2: 400, w: 10, kind: 'main' },
  { id: 'nv-2', name: 'Rue des Sapins', axis: 'h', z: -1350, x1: -400, x2: 400, w: 8, kind: 'street' },
  { id: 'nv-3', name: 'Rue de la Mairie', axis: 'h', z: -1450, x1: -400, x2: 400, w: 8, kind: 'street' },
  { id: 'nv-4', name: 'Boulevard Polaire', axis: 'h', z: -1550, x1: -400, x2: 400, w: 10, kind: 'main' },
  { id: 'nv-v1', name: 'Rue des Pingouins', axis: 'v', x: -200, z1: -1550, z2: -1250, w: 8, kind: 'street' },
  { id: 'nv-v2', name: 'Rue des Morses', axis: 'v', x: 200, z1: -1550, z2: -1250, w: 8, kind: 'street' },
  // route du lac et de l'aéroport
  { id: 'rn10-o', name: 'Route Nationale 10 (route du Lac)', axis: 'h', z: -1150, x1: -1800, x2: -400, w: 9, kind: 'country' },
  { id: 'rn10-e', name: 'Route de l\'Aéroport', axis: 'h', z: -1400, x1: 400, x2: 1800, w: 10, kind: 'main' },
  // Village des Marmottes (ouest) et Port Grand-Large (est)
  { id: 'rd12', name: 'Route Départementale 12', axis: 'h', z: -300, x1: -1800, x2: -840, w: 8, kind: 'country' },
  { id: 'marmottes-v', name: 'Grande Rue des Marmottes', axis: 'v', x: -1350, z1: -500, z2: 60, w: 8, kind: 'street' },
  { id: 'marmottes-h', name: 'Rue du Fromage', axis: 'h', z: -420, x1: -1500, x2: -1200, w: 7, kind: 'street' },
  { id: 'rd14', name: 'Route du Grand-Large', axis: 'h', z: -300, x1: 840, x2: 1800, w: 8, kind: 'country' },
  { id: 'port-gl', name: 'Quai du Grand-Large', axis: 'v', x: 1400, z1: -300, z2: 60, w: 9, kind: 'main' },
  // --- CARTE GÉANTE : anneau A4, désert des Sablons, Palmeraie, Glacier-sur-Alpe
  { id: 'a4-nord', name: 'Autoroute A4 des Géants', axis: 'h', z: -2900, x1: -2900, x2: 2900, w: 16, kind: 'highway' },
  { id: 'a4-ouest', name: 'Autoroute A4 des Géants', axis: 'v', x: -2900, z1: -2900, z2: 60, w: 16, kind: 'highway' },
  { id: 'a4-est', name: 'Autoroute A4 des Géants', axis: 'v', x: 2900, z1: -2900, z2: 60, w: 16, kind: 'highway' },
  { id: 'a3-nord', name: 'Autoroute A3 du Nord', axis: 'v', x: 0, z1: -2900, z2: -1900, w: 16, kind: 'highway' },
  { id: 'corniche-o4', name: 'Route de la Corniche', axis: 'h', z: 60, x1: -2900, x2: -1800, w: 8, kind: 'main' },
  { id: 'corniche-e4', name: 'Route de la Corniche', axis: 'h', z: 60, x1: 1800, x2: 2900, w: 8, kind: 'main' },
  { id: 'rd-sablons', name: 'Route du Désert', axis: 'h', z: -700, x1: -2900, x2: -1800, w: 9, kind: 'country' },
  { id: 'sablons-v', name: 'Rue Principale des Sablons', axis: 'v', x: -2400, z1: -1000, z2: -400, w: 9, kind: 'street' },
  { id: 'rd-palmiers', name: 'Route des Palmiers', axis: 'h', z: -600, x1: 1800, x2: 2900, w: 9, kind: 'country' },
  { id: 'palmeraie-v', name: 'Boulevard de la Palmeraie', axis: 'v', x: 2600, z1: -1000, z2: 60, w: 10, kind: 'main' },
  { id: 'palmeraie-h', name: 'Allée des Cocotiers', axis: 'h', z: -300, x1: 2300, x2: 2900, w: 8, kind: 'street' },
  { id: 'alpe-h', name: 'Grande Rue de Glacier-sur-Alpe', axis: 'h', z: -2350, x1: -700, x2: 700, w: 10, kind: 'main' },
  { id: 'alpe-v1', name: 'Chemin des Edelweiss', axis: 'v', x: -350, z1: -2600, z2: -2350, w: 8, kind: 'street' },
  { id: 'alpe-v2', name: 'Chemin des Chamois', axis: 'v', x: 350, z1: -2600, z2: -2350, w: 8, kind: 'street' },
  { id: 'route-cimes', name: 'Route des Cimes', axis: 'h', z: -2500, x1: 0, x2: 1000, w: 9, kind: 'main' },
];
// Chaussées élargies (plus confortables en voiture) : autoroutes +4 m, routes +2 m, rues +1,5 m.
const WIDEN = { highway: 4, main: 2, country: 2, street: 1.5 };
for (const s of STREETS) if (s.id !== 'crapaud') s.w += WIDEN[s.kind] || 0;   // la rue du Crapaud est bordée de maisons
export const STREET_BY_ID = Object.fromEntries(STREETS.map((s) => [s.id, s]));

// Rectangle de chaussée [x1, z1, x2, z2] d'une rue (prolongée d'une demi-largeur aux extrémités
// pour couvrir les carrefours).
export function streetRect(s) {
  const h = s.w / 2;
  return s.axis === 'h' ? [s.x1 - h, s.z - h, s.x2 + h, s.z + h] : [s.x - h, s.z1 - h, s.x + h, s.z2 + h];
}

// ---------------------------------------------------------------------------------------------
// GRAPHE ROUTIER : carrefours (nœuds) et tronçons (arêtes), calculé à partir des rues.
// Sert à la circulation, au GPS et aux poursuites.
export const ROAD_GRAPH = (() => {
  const nodes = [];
  const key = (x, z) => `${Math.round(x)},${Math.round(z)}`;
  const byKey = new Map();
  const node = (x, z) => {
    const k = key(x, z);
    let n = byKey.get(k);
    if (!n) { n = { id: nodes.length, x, z, edges: [], streets: new Set() }; nodes.push(n); byKey.set(k, n); }
    return n;
  };
  const edges = [];
  for (const s of STREETS) {
    const pts = [];
    const along = s.axis === 'h' ? [s.x1, s.x2] : [s.z1, s.z2];
    pts.push(along[0], along[1]);
    for (const o of STREETS) {
      if (o === s || o.axis === s.axis) continue;
      if (s.axis === 'h') { if (o.x >= s.x1 - 0.5 && o.x <= s.x2 + 0.5 && s.z >= o.z1 - 0.5 && s.z <= o.z2 + 0.5) pts.push(o.x); }
      else if (o.z >= s.z1 - 0.5 && o.z <= s.z2 + 0.5 && s.x >= o.x1 - 0.5 && s.x <= o.x2 + 0.5) pts.push(o.z);
    }
    const sorted = [...new Set(pts.map((v) => Math.round(v)))].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = s.axis === 'h' ? node(sorted[i], s.z) : node(s.x, sorted[i]);
      const b = s.axis === 'h' ? node(sorted[i + 1], s.z) : node(s.x, sorted[i + 1]);
      a.streets.add(s.id); b.streets.add(s.id);
      const e = { id: edges.length, a: a.id, b: b.id, street: s.id, w: s.w, kind: s.kind, len: Math.hypot(b.x - a.x, b.z - a.z) };
      edges.push(e);
      a.edges.push(e.id); b.edges.push(e.id);
    }
  }
  // feux tricolores : carrefours d'au moins 3 branches sur un axe principal
  for (const n of nodes) {
    n.degree = n.edges.length;
    const mains = [...n.streets].filter((id) => STREET_BY_ID[id].kind === 'main').length;
    n.light = n.degree >= 3 && mains >= 1 && n.streets.size >= 2 && ![...n.streets].some((id) => STREET_BY_ID[id].kind === 'highway');
  }
  return { nodes, edges };
})();

// Nœud le plus proche d'un point.
export function nearestNode(x, z) {
  let best = null, bd = Infinity;
  for (const n of ROAD_GRAPH.nodes) { const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd) { bd = d; best = n; } }
  return best;
}

// Point le plus proche sur le réseau routier : { edge, t (0..1 depuis a), x, z, dist }
export function nearestRoadPoint(x, z) {
  let best = null;
  for (const e of ROAD_GRAPH.edges) {
    const a = ROAD_GRAPH.nodes[e.a], b = ROAD_GRAPH.nodes[e.b];
    const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2));
    const px = a.x + dx * t, pz = a.z + dz * t;
    const d = Math.hypot(px - x, pz - z);
    if (!best || d < best.dist) best = { edge: e, t, x: px, z: pz, dist: d };
  }
  return best;
}

// Itinéraire (A*) entre deux points du monde : liste de points {x, z} le long des routes.
export function findRoute(fx, fz, tx, tz) {
  const G = ROAD_GRAPH;
  const s = nearestRoadPoint(fx, fz), t = nearestRoadPoint(tx, tz);
  if (!s || !t) return null;
  if (s.edge.id === t.edge.id) return [{ x: s.x, z: s.z }, { x: t.x, z: t.z }];
  const startIds = [s.edge.a, s.edge.b], goalIds = new Set([t.edge.a, t.edge.b]);
  const g = new Map(), prev = new Map(), open = new Set();
  const h = (n) => Math.hypot(G.nodes[n].x - t.x, G.nodes[n].z - t.z);
  for (const id of startIds) { g.set(id, Math.hypot(G.nodes[id].x - s.x, G.nodes[id].z - s.z)); open.add(id); }
  let found = null;
  while (open.size) {
    let cur = null, cf = Infinity;
    for (const id of open) { const f = g.get(id) + h(id); if (f < cf) { cf = f; cur = id; } }
    open.delete(cur);
    if (goalIds.has(cur)) { found = cur; break; }
    for (const eid of G.nodes[cur].edges) {
      const e = G.edges[eid];
      const nb = e.a === cur ? e.b : e.a;
      const ng = g.get(cur) + e.len;
      if (ng < (g.get(nb) ?? Infinity)) { g.set(nb, ng); prev.set(nb, cur); open.add(nb); }
    }
  }
  if (found === null) return null;
  const path = [];
  for (let n = found; n !== undefined; n = prev.get(n)) path.unshift({ x: G.nodes[n].x, z: G.nodes[n].z });
  path.unshift({ x: s.x, z: s.z });
  path.push({ x: t.x, z: t.z });
  return path;
}

// ---------------------------------------------------------------------------------------------
// QUARTIERS (affichés à l'écran quand on y entre ; le premier qui contient le point gagne).
export const CITY_ZONES = [
  { id: 'affaires', name: 'Quartier Lumière (affaires)', rect: [136, -136, 300, 56] },
  { id: 'port-est', name: 'Port des Embruns', rect: [136, 56, 300, 140] },
  { id: 'commerce', name: 'Zone des Bonnes Affaires', rect: [136, -335, 300, -136] },
  { id: 'tilleuls', name: 'Quartier des Tilleuls', rect: [-136, -335, 136, -136] },
  { id: 'boulons', name: 'Zone industrielle des Boulons', rect: [-300, -335, -136, -136] },
  { id: 'campagne', name: 'Campagne des Navets', rect: [-300, -136, -136, 56] },
  { id: 'plage-ouest', name: 'Plage Sauvage', rect: [-300, 56, -136, 140] },
  { id: 'prison', name: 'Prison de la Pomme Pourrie', rect: [-300, -420, -136, -335] },
  { id: 'loisirs', name: 'Parc des Loisirs Fous', rect: [-136, -420, 136, -335] },
  { id: 'circuit', name: 'Circuit Turbo-Mamie', rect: [136, -420, 300, -335] },
  { id: 'paillettes', name: 'Quartier des Paillettes', rect: [-300, -520, 300, -420] },
  { id: 'prestige', name: 'Avenue de Prestige (luxe, emploi, auto-école)', rect: [300, -430, 900, -140] },
  { id: 'villas', name: 'Côte des Villas', rect: [300, -140, 900, 140] },
  { id: 'vignobles', name: 'Vignobles du Pinard', rect: [-900, -430, -300, 140] },
  { id: 'hauts', name: 'Les Hauts de PLAYZONE', rect: [-900, -880, 900, -430] },
  { id: 'autoroute', name: 'Autoroute A1 du Soleil', rect: [-900, -1000, 900, -880] },
  { id: 'nordville', name: 'Nordville', rect: [-420, -1570, 420, -1230] },
  { id: 'lac', name: 'Lac des Grenouilles', rect: [-1350, -1650, -850, -1150] },
  { id: 'aeroport', name: 'Aéroport International de PLAYZONE', rect: [900, -1750, 1750, -1300] },
  { id: 'foret-noire', name: 'Forêt Noire', rect: [-1850, -1900, -420, -1000] },
  { id: 'marmottes', name: 'Village des Marmottes', rect: [-1550, -520, -1150, 80] },
  { id: 'campagne-ouest', name: 'Campagne Profonde', rect: [-1850, -1000, -900, 400] },
  { id: 'grand-large', name: 'Port Grand-Large', rect: [1150, -320, 1650, 400] },
  { id: 'campagne-est', name: 'Plaines de l\'Est', rect: [900, -1300, 1850, 400] },
  { id: 'grand-nord', name: 'Le Grand Nord', rect: [-1850, -2000, 1850, -1000] },
  { id: 'cap-venteux', name: 'Port du Cap Venteux (club de voile)', rect: [-2720, 40, -1990, 400] },
  { id: 'sablons', name: 'Les Sablons', rect: [-2560, -1020, -2240, -380] },
  { id: 'palmeraie', name: 'La Palmeraie', rect: [2280, -1020, 2920, 80] },
  { id: 'alpe', name: 'Glacier-sur-Alpe', rect: [-720, -2640, 720, -2080] },
  { id: 'massif', name: 'Massif des Géants', rect: [-3000, -3400, 3000, -2950] },
  { id: 'desert', name: 'Désert des Sablons', rect: [-3000, -2000, -1850, 400] },
  { id: 'cote-palmiers', name: 'Côte des Palmiers', rect: [1850, -2000, 3000, 400] },
  { id: 'bike-park', name: 'Bike Park des Géants', rect: [500, -2890, 990, -2440] },
  { id: 'cols', name: 'Route des Cols', rect: [1040, -2800, 2480, -2280] },
  { id: 'cimes', name: 'Zone commerciale des Cimes', rect: [80, -2490, 820, -2440] },
  { id: 'hauts-plateaux', name: 'Hauts Plateaux', rect: [-3000, -2950, 3000, -2000] },
];

// ---------------------------------------------------------------------------------------------
// BÂTIMENTS DES NOUVEAUX QUARTIERS. Champs : id, name, kind (shop | job | home | house | decor | service),
// x, z (centre), w (largeur X), d (profondeur Z), h (hauteur), facing (N | S | E | W = côté de la porte),
// style (rendu), color, roof (flat | gable), roofColor, sign, floors, interior (modèle d'intérieur visitable),
// shop (catalogue vendu), district.
const B = [];
const HOUSE_COLORS0 = ['#f4d35e', '#ee964b', '#83c5be', '#e5989b', '#b5e48c', '#a2d2ff', '#ffc8dd', '#cdb4db'];
const add = (o) => { B.push({ roof: 'flat', floors: 1, ...o }); };

// --- Quartier Lumière (affaires)
add({ id: 'pizzeria', name: 'Pizzeria Mamma Mia-ou', kind: 'shop', shop: 'pizzeria', interior: 'restaurant', x: 158, z: 18, w: 16, d: 16, h: 7, facing: 'N', color: '#f6e7c8', roofColor: '#b5562d', sign: 'PIZZERIA MAMMA MIA-OU', awning: '#2a9d3a', district: 'affaires' });
add({ id: 'tacos', name: 'Tacos Tornade', kind: 'shop', shop: 'tacos', interior: 'fastfood', x: 179, z: 18, w: 16, d: 16, h: 7, facing: 'N', color: '#ffb703', roofColor: '#9c2c13', sign: 'TACOS TORNADE', awning: '#e63946', district: 'affaires' });
add({ id: 'immo', name: 'Agence Immo Pas Cher', kind: 'shop', shop: 'immo', interior: 'agency', x: 196.5, z: 18, w: 11, d: 14, h: 7, facing: 'N', color: '#dfe7fd', roofColor: '#3d5a80', sign: 'IMMO PAS CHER', district: 'affaires' });
add({ id: 'tour', name: 'Tour PlayCorp', kind: 'service', interior: 'office', x: 240, z: 25, w: 24, d: 24, h: 40, floors: 10, facing: 'N', style: 'tower', color: '#9bb7d4', roofColor: '#34495e', sign: 'PLAYCORP', district: 'affaires' });
add({ id: 'cinema', name: 'Ciné Pop-Corn Mou', kind: 'service', shop: 'cinema', interior: 'cinema', x: 270, z: 25, w: 22, d: 26, h: 11, facing: 'N', style: 'cinema', color: '#5b2a86', roofColor: '#2a0f45', sign: 'CINÉ POP-CORN MOU', neon: true, district: 'affaires' });
add({ id: 'police', name: 'Commissariat Central', kind: 'service', interior: 'police', x: 165, z: -22, w: 28, d: 22, h: 9, floors: 2, facing: 'S', style: 'police', color: '#e9edf2', roofColor: '#1d3557', sign: 'POLICE', district: 'affaires' });
add({ id: 'tribunal', name: 'Palais de Justice', kind: 'service', interior: 'court', x: 165, z: -50, w: 30, d: 24, h: 12, floors: 2, facing: 'N', columns: true, color: '#efe6d2', roofColor: '#5c5346', sign: 'PALAIS DE JUSTICE', district: 'affaires' });
add({ id: 'station-lumiere', name: 'Station Pleins Gaz', kind: 'shop', shop: 'station', interior: 'minimarket', x: 194, z: -52, w: 14, d: 9, h: 4.5, facing: 'N', style: 'station', color: '#f4f1ea', roofColor: '#e63946', sign: 'PLEINS GAZ', district: 'affaires', gas: { x: 194, z: -30, w: 16, d: 14 } });
add({ id: 'hopital', name: 'Hôpital Saint-Bobo', kind: 'service', interior: 'hospital', x: 250, z: -35, w: 44, d: 34, h: 16, floors: 4, facing: 'S', style: 'hospital', color: '#f7f7f2', roofColor: '#4ea8de', sign: 'HÔPITAL SAINT-BOBO', district: 'affaires' });
add({ id: 'homard', name: 'Le Homard Hilarant', kind: 'shop', shop: 'homard', interior: 'restaurant', x: 160, z: -96, w: 18, d: 16, h: 7, facing: 'S', color: '#e5989b', roofColor: '#6d2e46', sign: 'LE HOMARD HILARANT', awning: '#1d3557', district: 'affaires' });
add({ id: 'pixel', name: 'Pixel & Câbles', kind: 'shop', shop: 'electronics', interior: 'shop', x: 186, z: -96, w: 16, d: 14, h: 7, facing: 'S', color: '#2b2d42', roofColor: '#00b4d8', sign: 'PIXEL & CÂBLES', neon: true, district: 'affaires' });
add({ id: 'gym', name: 'Salle Muscles Mous', kind: 'service', interior: 'gym', x: 240, z: -98, w: 22, d: 20, h: 8, facing: 'S', color: '#ff70a6', roofColor: '#3a0ca3', sign: 'MUSCLES MOUS', district: 'affaires' });
add({ id: 'cafe-bureaux', name: 'Café des Bureaux', kind: 'shop', shop: 'cafe2', interior: 'cafe', x: 270, z: -95, w: 14, d: 12, h: 6.5, facing: 'S', color: '#a3c4bc', roofColor: '#3d405b', sign: 'CAFÉ DES BUREAUX', awning: '#3d405b', district: 'affaires' });

// --- Port des Embruns
add({ id: 'poissonnerie', name: 'Poissonnerie Le Thon Rigolo', kind: 'shop', shop: 'poisson', interior: 'restaurant', x: 180, z: 82, w: 20, d: 14, h: 6.5, facing: 'N', color: '#90e0ef', roofColor: '#023e8a', sign: 'LE THON RIGOLO', awning: '#0077b6', district: 'port-est' });
add({ id: 'entrepot-port', name: 'Entrepôt du Port', kind: 'decor', interior: 'warehouse', x: 225, z: 84, w: 26, d: 18, h: 10, facing: 'N', style: 'warehouse', color: '#8d99ae', roofColor: '#4a5568', sign: 'DOCKS', garageDoors: 2, district: 'port-est' });
add({ id: 'capitainerie', name: 'Capitainerie', kind: 'decor', interior: 'office', x: 266, z: 80, w: 12, d: 10, h: 8, floors: 2, facing: 'N', color: '#f4f1ea', roofColor: '#c1121f', sign: 'CAPITAINERIE', district: 'port-est' });

// --- Zone des Bonnes Affaires (commerces, concessions, occasions)
add({ id: 'concession', name: 'Concession Auto Paillettes', kind: 'shop', shop: 'cars-new', interior: 'showroom', x: 172, z: -166, w: 40, d: 26, h: 9, facing: 'S', style: 'showroom', color: '#e9ecef', roofColor: '#212529', sign: 'AUTO PAILLETTES', district: 'commerce' });
add({ id: 'occasions', name: 'Occaz\' du Siècle', kind: 'shop', shop: 'cars-used', interior: 'agency', x: 272, z: -166, w: 14, d: 12, h: 5, facing: 'W', color: '#ffd166', roofColor: '#ef476f', sign: 'OCCAZ\' DU SIÈCLE', district: 'commerce', lot: { x1: 220, z1: -182, x2: 262, z2: -150 } });
add({ id: 'deux-roues', name: 'Deux-Roues Express', kind: 'shop', shop: 'bikes', interior: 'shop', x: 161, z: -215, w: 18, d: 16, h: 7, facing: 'W', color: '#06d6a0', roofColor: '#073b4c', sign: 'DEUX-ROUES EXPRESS', district: 'commerce' });
add({ id: 'piston', name: 'Garage du Piston Fou', kind: 'shop', shop: 'repair', interior: 'workshop', x: 189, z: -215, w: 20, d: 18, h: 8, facing: 'E', style: 'warehouse', color: '#adb5bd', roofColor: '#495057', sign: 'GARAGE DU PISTON FOU', garageDoors: 2, district: 'commerce' });
add({ id: 'grenier', name: 'Le Grenier de Mamie', kind: 'shop', shop: 'furniture-used', interior: 'shop', x: 234, z: -215, w: 20, d: 16, h: 7, facing: 'W', color: '#ddb892', roofColor: '#7f5539', sign: 'LE GRENIER DE MAMIE', awning: '#b08968', district: 'commerce' });
add({ id: 'croquette', name: 'Croquette Center', kind: 'shop', shop: 'pet-acc', interior: 'shop', x: 268, z: -215, w: 18, d: 16, h: 7, facing: 'E', color: '#cdeac0', roofColor: '#386641', sign: 'CROQUETTE CENTER', district: 'commerce' });
add({ id: 'hyper', name: 'Hyper Bazar', kind: 'shop', shop: 'supermarket', interior: 'supermarket', x: 175, z: -266, w: 46, d: 30, h: 9, facing: 'S', style: 'big-box', color: '#f8f9fa', roofColor: '#d00000', sign: 'HYPER BAZAR', district: 'commerce' });
add({ id: 'fripes', name: 'Fripes & Frissons', kind: 'shop', shop: 'clothes-used', interior: 'shop', x: 230, z: -266, w: 16, d: 14, h: 7, facing: 'S', color: '#cdb4db', roofColor: '#6d597a', sign: 'FRIPES & FRISSONS', awning: '#b5838d', district: 'commerce' });
add({ id: 'troc', name: 'Troc Ta Vie (dépôt-vente)', kind: 'shop', shop: 'depot', interior: 'shop', x: 253, z: -266, w: 16, d: 14, h: 7, facing: 'S', color: '#ffe5d9', roofColor: '#9d8189', sign: 'TROC TA VIE', district: 'commerce' });
add({ id: 'brocante', name: 'Bric à Broc', kind: 'shop', shop: 'brocante', interior: 'shop', x: 274, z: -266, w: 12, d: 14, h: 6, facing: 'S', color: '#e9c46a', roofColor: '#264653', sign: 'BRIC À BROC', district: 'commerce' });
add({ id: 'station-pompe', name: 'Station Super Pompe', kind: 'shop', shop: 'station', interior: 'minimarket', x: 186, z: -323, w: 14, d: 9, h: 4.5, facing: 'N', style: 'station', color: '#f4f1ea', roofColor: '#2a9d8f', sign: 'SUPER POMPE', district: 'commerce', gas: { x: 186, z: -306, w: 16, d: 14 } });
add({ id: 'location', name: 'Location Rapido', kind: 'shop', shop: 'rental', interior: 'agency', x: 250, z: -311, w: 16, d: 12, h: 6, facing: 'S', color: '#90be6d', roofColor: '#277da1', sign: 'LOCATION RAPIDO', district: 'commerce' });

// --- Quartier des Tilleuls (résidentiel)
add({ id: 'superette', name: 'Supérette du Coin', kind: 'shop', shop: 'superette', interior: 'supermarket', x: -36, z: -160, w: 20, d: 16, h: 6.5, facing: 'S', color: '#fefae0', roofColor: '#bc6c25', sign: 'SUPÉRETTE DU COIN', awning: '#606c38', district: 'tilleuls' });
add({ id: 'boulangerie-tilleuls', name: 'Boulangerie des Tilleuls', kind: 'shop', shop: 'bakery', interior: 'bakery', x: -16, z: -160, w: 12, d: 12, h: 6.5, facing: 'S', color: '#f6d6a8', roofColor: '#9c6644', roof: 'gable', sign: 'BOULANGERIE', awning: '#7b3f00', district: 'tilleuls' });
add({ id: 'coiffeur', name: 'Salon Tifs & Brushing', kind: 'shop', shop: 'hair', interior: 'salon', x: -53.5, z: -160, w: 10, d: 12, h: 6.5, facing: 'S', color: '#ffafcc', roofColor: '#6d597a', sign: 'TIFS & BRUSHING', awning: '#cdb4db', district: 'tilleuls' });
add({ id: 'luxe', name: 'Maison Paillettes (luxe)', kind: 'shop', shop: 'luxury', interior: 'shop', x: -36, z: -204, w: 16, d: 14, h: 7, facing: 'S', color: '#14213d', roofColor: '#fca311', sign: 'MAISON PAILLETTES', awning: '#fca311', neon: true, district: 'tilleuls' });
add({ id: 'ecole', name: 'École des Petits Génies', kind: 'service', interior: 'school', x: 35, z: -214, w: 40, d: 26, h: 8, facing: 'N', color: '#ffc8dd', roofColor: '#5390d9', sign: 'ÉCOLE DES PETITS GÉNIES', district: 'tilleuls' });
add({ id: 'villa', name: 'Villa Paillettes (à vendre)', kind: 'home-buy', interior: 'house', x: 105, z: -312, w: 18, d: 14, h: 7, facing: 'N', roof: 'gable', color: '#ffffff', roofColor: '#264653', sign: 'À VENDRE', district: 'tilleuls' });
for (const [i, [x, z, facing]] of [[100, -158, 'S'], [118, -158, 'S'], [-118, -270, 'N'], [-96, -270, 'N'], [-118, -306, 'S']].entries()) {
  add({ id: `immeuble${i + 1}`, name: `Résidence des Tilleuls ${String.fromCharCode(65 + i)}`, kind: 'decor', interior: 'lobby', x, z, w: 16, d: 18, h: 19, floors: 6, facing, style: 'apartment', color: ['#a2d2ff', '#ffafcc', '#bde0fe', '#cdb4db', '#ffc8dd'][i], roofColor: '#3d405b', district: 'tilleuls' });
}

// --- Zone industrielle des Boulons
add({ id: 'usine-chaussettes', name: 'Usine à Chaussettes', kind: 'decor', interior: 'factory', x: -255, z: -166, w: 40, d: 26, h: 12, facing: 'S', style: 'factory', color: '#b08968', roofColor: '#7f5539', sign: 'USINE À CHAUSSETTES', garageDoors: 2, district: 'boulons' });
add({ id: 'logistique', name: 'Entrepôt Logistique Tétris', kind: 'decor', interior: 'warehouse', x: -181, z: -166, w: 44, d: 26, h: 11, facing: 'S', style: 'warehouse', color: '#8d99ae', roofColor: '#2b2d42', sign: 'LOGISTIQUE TÉTRIS', garageDoors: 3, district: 'boulons' });
add({ id: 'casse', name: 'Casse Ferraille & Fils', kind: 'shop', shop: 'scrapyard', interior: 'agency', x: -268, z: -215, w: 12, d: 10, h: 4.5, facing: 'E', color: '#6c757d', roofColor: '#343a40', sign: 'CASSE FERRAILLE & FILS', district: 'boulons', yard: { x1: -258, z1: -232, x2: -230, z2: -198 } });
add({ id: 'recyclerie', name: 'Recyclerie Deuxième Vie', kind: 'decor', interior: 'warehouse', x: -181, z: -215, w: 30, d: 20, h: 9, facing: 'N', style: 'warehouse', color: '#52b788', roofColor: '#1b4332', sign: 'RECYCLERIE', garageDoors: 1, district: 'boulons' });
add({ id: 'cle-molette', name: 'Garage Clé à Molette', kind: 'shop', shop: 'repair', interior: 'workshop', x: -258, z: -266, w: 22, d: 18, h: 8, facing: 'E', style: 'warehouse', color: '#e5e5e5', roofColor: '#fca311', sign: 'GARAGE CLÉ À MOLETTE', garageDoors: 2, district: 'boulons' });
add({ id: 'usine-crepes', name: 'Usine de Pâte à Crêpes', kind: 'decor', interior: 'factory', x: -181, z: -266, w: 40, d: 26, h: 12, facing: 'S', style: 'factory', color: '#ffe8d6', roofColor: '#cb997e', sign: 'PÂTE À CRÊPES', garageDoors: 1, district: 'boulons' });
add({ id: 'depot-bus', name: 'Dépôt des Bus Bringuebalants', kind: 'decor', interior: 'warehouse', x: -255, z: -313, w: 40, d: 24, h: 9, facing: 'N', style: 'warehouse', color: '#4ea8de', roofColor: '#023047', sign: 'DÉPÔT DES BUS', garageDoors: 3, district: 'boulons' });
add({ id: 'frigo', name: 'Entrepôt Frigorifique Brrr', kind: 'decor', interior: 'warehouse', x: -181, z: -313, w: 36, d: 22, h: 9, facing: 'N', style: 'warehouse', color: '#caf0f8', roofColor: '#0077b6', sign: 'FRIGO BRRR', garageDoors: 1, district: 'boulons' });

// --- Prison
add({ id: 'prison', name: 'Prison de la Pomme Pourrie', kind: 'service', interior: 'prison', x: -220, z: -383, w: 50, d: 24, h: 10, floors: 2, facing: 'S', style: 'prison', color: '#9a8c98', roofColor: '#4a4e69', sign: 'PRISON', district: 'prison', wall: { x1: -282, z1: -412, x2: -158, z2: -350, gateX: -220 } });

// --- Parc des Loisirs Fous + circuit
add({ id: 'bowling', name: 'Bowling Strike-Moi', kind: 'service', interior: 'bowling', x: 95, z: -372, w: 30, d: 20, h: 8, facing: 'S', color: '#3a86ff', roofColor: '#ff006e', sign: 'BOWLING STRIKE-MOI', neon: true, district: 'loisirs' });
add({ id: 'arcade2', name: 'Salle d\'arcade Mégapixel', kind: 'service', interior: 'arcade', x: -95, z: -372, w: 24, d: 18, h: 7, facing: 'S', color: '#2b2d6e', roofColor: '#ff3fa4', sign: 'MÉGAPIXEL', neon: true, district: 'loisirs' });
add({ id: 'circuit-stand', name: 'Karting du Circuit Turbo-Mamie', kind: 'service', interior: 'karting', x: 175, z: -352, w: 16, d: 10, h: 6, facing: 'S', color: '#f72585', roofColor: '#3a0ca3', sign: 'TURBO-MAMIE', district: 'circuit' });

// --- Quartier des Paillettes (au nord du parc des loisirs, le long du boulevard des Paillettes)
add({ id: 'casino', name: 'Casino Royal Pomme', kind: 'service', interior: 'casino', x: 0, z: -452, w: 40, d: 28, h: 12, facing: 'S', style: 'cinema', color: '#1b1446', roofColor: '#d4a017', sign: 'CASINO ROYAL POMME', neon: true, district: 'paillettes' });
add({ id: 'stand-tir', name: 'Stand de tir Dédé la Gâchette', kind: 'service', interior: 'range', x: -60, z: -453, w: 26, d: 30, h: 7, facing: 'S', style: 'warehouse', color: '#6b705c', roofColor: '#3a3a3a', sign: 'STAND DE TIR', district: 'paillettes' });

// --- Avenue de Prestige : concession de luxe, auto-école, Pôle emploi, armurerie, high-tech
add({ id: 'concession-luxe', name: 'Prestige Motors (concession de luxe)', kind: 'shop', shop: 'cars-luxe', interior: 'showroom', x: 372, z: -175, w: 72, d: 38, h: 11, facing: 'S', style: 'showroom', color: '#111318', roofColor: '#d4a017', sign: 'PRESTIGE MOTORS', neon: true, district: 'prestige' });
add({ id: 'auto-ecole', name: 'Auto-École Pas de Panique', kind: 'shop', shop: 'auto-ecole', interior: 'agency', x: 450, z: -166, w: 24, d: 18, h: 7, facing: 'S', color: '#ffffff', roofColor: '#e63946', sign: 'AUTO-ÉCOLE PAS DE PANIQUE', awning: '#e63946', district: 'prestige' });
add({ id: 'pole-emploi', name: 'Pôle Emploi (France Boulot)', kind: 'shop', shop: 'pole-emploi', interior: 'agency', x: 512, z: -166, w: 32, d: 18, h: 9, floors: 2, facing: 'S', color: '#dfe7fd', roofColor: '#1d3557', sign: 'PÔLE EMPLOI', district: 'prestige' });
add({ id: 'armurerie', name: 'Armurerie Le Chasseur Distrait', kind: 'shop', shop: 'armurerie', interior: 'shop', x: 336, z: -310, w: 24, d: 16, h: 7, facing: 'N', color: '#4a4e3a', roofColor: '#1b1b1b', sign: 'ARMURERIE', district: 'prestige' });
add({ id: 'hightech', name: 'MégaTech (high-tech)', kind: 'shop', shop: 'hightech', interior: 'shop', x: 420, z: -305, w: 60, d: 28, h: 10, facing: 'N', style: 'big-box', color: '#0b132b', roofColor: '#00b4d8', sign: 'MÉGATECH', neon: true, district: 'prestige' });
add({ id: 'station-a1', name: 'Aire de l\'Autoroute du Soleil', kind: 'shop', shop: 'station', interior: 'minimarket', x: 0, z: -905, w: 14, d: 9, h: 4.5, facing: 'N', style: 'station', color: '#f4f1ea', roofColor: '#1d3557', sign: 'AIRE DU SOLEIL', district: 'autoroute', gas: { x: 0, z: -922, w: 16, d: 12 } });
add({ id: 'station-prestige', name: 'Station Prestige', kind: 'shop', shop: 'station', interior: 'minimarket', x: 620, z: -300, w: 14, d: 9, h: 4.5, facing: 'N', style: 'station', color: '#f4f1ea', roofColor: '#d4a017', sign: 'STATION PRESTIGE', district: 'prestige', gas: { x: 620, z: -318, w: 16, d: 12 } });

// --- Stade des Crampons (football) : club-house au bord du boulevard des Paillettes, terrain au nord
add({ id: 'club-foot', name: 'Club-house du Stade des Crampons', kind: 'shop', shop: 'foot-club', interior: 'agency', x: 450, z: -470, w: 24, d: 12, h: 7, facing: 'S', color: '#2a9d3a', roofColor: '#ffffff', sign: 'STADE DES CRAMPONS · FOOT', district: 'hauts' });

// --- Académie F1 : paddock au bord du boulevard de l'Emploi, circuit à l'est
add({ id: 'f1-paddock', name: 'Paddock de l\'Académie F1', kind: 'shop', shop: 'f1', interior: 'agency', x: 585, z: -775, w: 20, d: 16, h: 8, facing: 'W', color: '#d00000', roofColor: '#14141c', sign: 'ACADÉMIE F1', neon: true, district: 'hauts' });

// --- PORT DU CAP VENTEUX : club de voile (spot toujours venté), voilerie, magasin de wingfoil, port de commerce
{
  const CP = [
    ['club-voile', 'Club de Voile du Cap Venteux', 'shop', 'voile-club', 'agency', -2380, 30, '#f8f9fa', '#0077b6', 'CLUB DE VOILE · CAP VENTEUX', 9],
    ['voilerie', 'Voilerie du Cap (dériveurs, kites)', 'shop', 'voile', 'shop', -2335, 24, '#e0fbfc', '#1d3557', 'VOILERIE DU CAP', 8],
    ['wing-cap', 'Wing Shop du Cap', 'shop', 'surf', 'shop', -2295, 20, '#ffd6ec', '#ff3fa4', 'WING SHOP', 7],
    ['capitainerie-cap', 'Capitainerie du Cap', 'decor', null, 'office', -2440, 16, '#f4f1ea', '#c1121f', 'CAPITAINERIE', 11],
    ['cabane-port', 'La Cabane du Port (fruits de mer)', 'shop', 'poisson', 'restaurant', -2490, 22, '#a0703c', '#3a2a1e', 'LA CABANE DU PORT', 7],
    ['shipchandler', 'Shipchandler Le Nœud de Chaise', 'shop', 'surf', 'shop', -2540, 20, '#caf0f8', '#023e8a', 'SHIPCHANDLER', 7],
  ];
  for (const [id, name, kind, shop, interior, x, w, color, roofColor, sign, h] of CP) add({ id, name, kind, ...(shop ? { shop } : {}), interior, x, z: 86, w, d: 18, h, facing: 'S', color, roofColor, sign, neon: kind === 'shop', district: 'cap-venteux' });
  for (const [k, x] of [[1, -2150], [2, -2090], [3, -2030]]) add({ id: `entrepot-cap${k}`, name: `Entrepôt portuaire ${k}`, kind: 'decor', interior: 'warehouse', x, z: 86, w: 44, d: 20, h: 12, facing: 'S', style: 'warehouse', color: ['#8d99ae', '#adb5bd', '#6c757d'][k - 1], roofColor: '#495057', sign: 'PORT DE COMMERCE', garageDoors: 3, district: 'cap-venteux' });
}

// --- Surf Shop (wingfoil) sur la corniche, face à la mer
add({ id: 'surf-shop', name: 'Surf Shop Vent Debout', kind: 'shop', shop: 'surf', interior: 'shop', x: 430, z: 38, w: 16, d: 12, h: 6, facing: 'S', roof: 'gable', style: 'hut', color: '#90e0ef', roofColor: '#ff9f1c', sign: 'SURF SHOP · WINGFOIL', district: 'villas' });

// --- Campus des Métiers (formations) et zone commerciale de l'Avenue de Prestige
add({ id: 'campus', name: 'Campus des Métiers (formations)', kind: 'service', interior: 'school', x: 460, z: -245, w: 56, d: 26, h: 12, floors: 3, facing: 'E', color: '#e9f5db', roofColor: '#1d4ed8', sign: 'CAMPUS DES MÉTIERS', district: 'prestige' });
add({ id: 'maison-deco', name: 'Maison & Déco Géante', kind: 'shop', shop: 'maison', interior: 'shop', x: 650, z: -176, w: 56, d: 30, h: 10, facing: 'S', style: 'big-box', color: '#fff1e6', roofColor: '#e76f51', sign: 'MAISON & DÉCO GÉANTE', district: 'prestige' });
add({ id: 'bricolage', name: 'Bricolage Marteau-Pilon', kind: 'shop', shop: 'brico', interior: 'shop', x: 730, z: -174, w: 40, d: 26, h: 9, facing: 'S', style: 'big-box', color: '#ffb703', roofColor: '#023047', sign: 'MARTEAU-PILON', district: 'prestige' });
add({ id: 'jardinerie', name: 'Jardinerie La Main Verte', kind: 'shop', shop: 'jardin', interior: 'shop', x: 798, z: -174, w: 36, d: 26, h: 8, facing: 'S', color: '#d8f3dc', roofColor: '#2d6a4f', sign: 'LA MAIN VERTE', district: 'prestige' });
add({ id: 'sport-shop', name: 'Sport Mollets d\'Acier', kind: 'shop', shop: 'sport', interior: 'shop', x: 690, z: -246, w: 30, d: 20, h: 8, facing: 'S', color: '#caf0f8', roofColor: '#0077b6', sign: 'SPORT MOLLETS D\'ACIER', district: 'prestige' });
add({ id: 'pharmacie', name: 'Pharmacie de la Croix Verte', kind: 'shop', shop: 'pharmacie', interior: 'shop', x: 750, z: -246, w: 16, d: 14, h: 6, facing: 'S', color: '#ffffff', roofColor: '#2a9d3a', sign: 'PHARMACIE', neon: true, district: 'prestige' });
add({ id: 'bijouterie', name: 'Bijouterie Diamant Brillant', kind: 'shop', shop: 'bijoux', interior: 'shop', x: 792, z: -246, w: 18, d: 14, h: 7, facing: 'S', color: '#14213d', roofColor: '#fca311', sign: 'DIAMANT BRILLANT', neon: true, district: 'prestige' });

// --- Côte des Villas : grandes villas face à la mer (à visiter)
const VILLA_COLORS = ['#ffffff', '#f4f1ea', '#e9f5db', '#fde2e4', '#e2ece9', '#fff1e6'];
[340, 400, 460, 520, 610, 670, 730, 790].forEach((x, i) => {
  add({ id: `villa-cote${i + 1}`, name: `Villa des Embruns ${i + 1}`, kind: 'house', interior: 'house', x, z: -112, w: 18, d: 14, h: 8, floors: 2, facing: 'N', roof: i % 2 ? 'flat' : 'gable', color: VILLA_COLORS[i % 6], roofColor: '#264653', district: 'villas' });
  add({ id: `villa-mer${i + 1}`, name: `Villa Pieds-dans-l'eau ${i + 1}`, kind: 'house', interior: 'house', x, z: 38, w: 18, d: 14, h: 8, floors: 2, facing: 'S', roof: i % 2 ? 'gable' : 'flat', color: VILLA_COLORS[(i + 3) % 6], roofColor: '#3d5a80', district: 'villas' });
});

// --- Vignobles du Pinard (campagne ouest)
for (const [i, [x, z]] of [[-700, -60], [-420, -230], [-700, -380], [-420, 20]].entries()) {
  add({ id: `domaine${i + 1}`, name: ['Domaine du Pinard', 'Château Piquette', 'Mas des Grappes', 'Ferme du Bouchon'][i], kind: 'house', interior: 'house', x, z, w: 14, d: 11, h: 7, facing: 'E', roof: 'gable', color: '#efe3c2', roofColor: '#7a4b2a', district: 'vignobles' });
  add({ id: `chai${i + 1}`, name: `Chai ${i + 1}`, kind: 'decor', interior: 'barn', x: x + 30, z: z - 24, w: 20, d: 14, h: 8, facing: 'E', roof: 'gable', style: 'barn', color: '#9c2a24', roofColor: '#4a2620', barn: true, district: 'vignobles' });
}

// --- Les Hauts de PLAYZONE : lotissement le long de l'avenue des Hauts
{
  const roadsX = [-840, -560, -290, -140, 140, 290, 560, 840];
  let k = 0;
  for (let x = -810; x <= 810; x += 44) {
    if (roadsX.some((r) => Math.abs(r - x) < 16)) continue;
    for (const [z, facing] of [[-714, 'S'], [-686, 'N']]) {
      k++;
      add({ id: `maison-h${k}`, name: `${k} avenue des Hauts`, kind: 'house', interior: 'house', x, z, w: 11, d: 10, h: 5.5, facing, roof: 'gable', color: HOUSE_COLORS0[k % HOUSE_COLORS0.length], roofColor: ['#8c3b2f', '#3d5a80', '#6b4226', '#2a6f4e'][k % 4], district: 'hauts' });
    }
  }
}

// --- NORDVILLE : immeubles, commerces, mairie annexe, gare routière
{
  const NV = [
    ['nv-super', 'Hyper Nordique', 'shop', 'supermarket', 'supermarket', -300, -1300, 44, 28, 'S', 'big-box', '#e9f5db', '#1d4ed8', 'HYPER NORDIQUE'],
    ['nv-boulangerie', 'Boulangerie du Pôle', 'shop', 'bakery', 'bakery', -110, -1295, 14, 12, 'N', null, '#fefae0', '#9c6644', 'BOULANGERIE'],
    ['nv-cafe', 'Café Igloo', 'shop', 'cafe2', 'cafe', -80, -1295, 14, 12, 'N', null, '#caf0f8', '#0077b6', 'CAFÉ IGLOO'],
    ['nv-resto', 'Restaurant Le Morse Gourmand', 'shop', 'homard', 'restaurant', 110, -1295, 20, 14, 'N', null, '#ffe5d9', '#9d0208', 'LE MORSE GOURMAND'],
    ['nv-vetements', 'Doudounes & Co', 'shop', 'clothes', 'shop', 290, -1300, 22, 16, 'S', null, '#ffc8dd', '#5e3c58', 'DOUDOUNES & CO'],
    ['nv-hotel', 'Grand Hôtel de Nordville', 'decor', null, 'lobby', -300, -1400, 36, 22, 'S', 'apartment', '#f4f1ea', '#14213d', 'GRAND HÔTEL'],
    ['nv-mairie', 'Mairie annexe de Nordville', 'service', null, 'office', 0 + 110, -1400, 30, 22, 'S', null, '#f8f9fa', '#1d3557', 'MAIRIE ANNEXE'],
    ['nv-ecole', 'Lycée Polaire', 'service', null, 'school', 300, -1400, 40, 24, 'S', null, '#ffd6a5', '#3a86ff', 'LYCÉE POLAIRE'],
    ['nv-garage', 'Garage des Glaciers', 'shop', 'repair', 'workshop', -300, -1500, 24, 18, 'N', 'warehouse', '#adb5bd', '#495057', 'GARAGE DES GLACIERS'],
    ['nv-cinema', 'Ciné Aurore Boréale', 'service', 'cinema', 'cinema', 110, -1500, 26, 24, 'N', 'cinema', '#3a0ca3', '#7209b7', 'CINÉ AURORE'],
    ['nv-station', 'Station du Nord', 'shop', 'station', 'minimarket', 300, -1500, 14, 9, 'N', 'station', '#f4f1ea', '#2a9d8f', 'STATION DU NORD'],
  ]
  for (const [id, name, kind, shop, interior, x, z, w, d, facing, style, color, roofColor, sign] of NV) add({ id, name, kind, ...(shop ? { shop } : {}), interior, x, z, w, d, h: style === 'apartment' ? 22 : 8, floors: style === 'apartment' ? 7 : 1, facing, ...(style ? { style } : {}), color, roofColor, sign, district: 'nordville' });
  // immeubles et maisons de Nordville
  let k = 0;
  for (const [x, z, facing] of [[-150, -1300, 'S'], [150, -1300, 'S'], [-150, -1500, 'N'], [-100, -1400, 'S'], [232, -1470, 'N']]) { k++; add({ id: `nv-immeuble${k}`, name: `Résidence Polaire ${k}`, kind: 'decor', interior: 'lobby', x, z, w: 18, d: 18, h: 25, floors: 8, facing, style: 'apartment', color: ['#bde0fe', '#a2d2ff', '#cdb4db', '#ffc8dd', '#e2ece9'][k % 5], roofColor: '#3d405b', district: 'nordville' }); }
  let m = 0;
  for (let x = -380; x <= 380; x += 38) for (const [z, facing] of [[-1590, 'S'], [-1212, 'N']]) {
    if (Math.abs(x) < 16 || Math.abs(Math.abs(x) - 200) < 14 || Math.abs(Math.abs(x) - 400) < 14) continue;
    m++; add({ id: `maison-nv${m}`, name: `${m} boulevard ${z < -1400 ? 'Polaire' : 'de Nordville'}`, kind: 'house', interior: 'house', x, z, w: 12, d: 10, h: 6, facing, roof: 'gable', color: HOUSE_COLORS0[m % HOUSE_COLORS0.length], roofColor: ['#8c3b2f', '#3d5a80', '#6b4226'][m % 3], district: 'nordville' });
  }
}

// --- AÉROPORT, LAC, VILLAGE DES MARMOTTES, PORT GRAND-LARGE
add({ id: 'aeroport', name: 'Aéroport International de PLAYZONE', kind: 'service', interior: 'lobby', x: 1300, z: -1360, w: 90, d: 30, h: 14, floors: 2, facing: 'S', style: 'big-box', color: '#e9ecef', roofColor: '#0b132b', sign: 'AÉROPORT PLAYZONE', neon: true, district: 'aeroport' });
add({ id: 'hangar', name: 'Hangar des jets privés', kind: 'decor', interior: 'warehouse', x: 1600, z: -1360, w: 50, d: 30, h: 14, facing: 'S', style: 'warehouse', color: '#adb5bd', roofColor: '#495057', sign: 'JETS PRIVÉS', garageDoors: 3, district: 'aeroport' });
add({ id: 'chalet-lac', name: 'Chalet du Lac (restaurant)', kind: 'shop', shop: 'poisson', interior: 'restaurant', x: -1100, z: -1250, w: 18, d: 12, h: 7, facing: 'S', roof: 'gable', color: '#a0703c', roofColor: '#3a2a1e', sign: 'CHALET DU LAC', district: 'lac' });
{
  const MV = [
    ['mv-epicerie', 'Épicerie des Marmottes', 'shop', 'superette', 'supermarket', -1325, -460, 14, 10, 'W'],
    ['mv-fromager', 'Fromagerie Ça Sent Bon', 'shop', 'farm', 'bakery', -1325, -380, 12, 10, 'W'],
    ['mv-bistrot', 'Bistrot de la Marmotte', 'shop', 'cafe', 'cafe', -1375, -380, 14, 10, 'E'],
    ['mv-mairie', 'Mairie du village', 'service', null, 'office', -1375, -460, 14, 12, 'E'],
  ]
  for (const [id, name, kind, shop, interior, x, z, w, d, facing] of MV) add({ id, name, kind, ...(shop ? { shop } : {}), interior, x, z, w, d, h: 7, facing, roof: 'gable', color: '#f6e7c8', roofColor: '#8c3b2f', sign: name.toUpperCase(), district: 'marmottes' });
  let q = 0;
  for (let z = -340; z <= 20; z += 30) if (z !== -310) for (const [x, facing] of [[-1325, 'W'], [-1375, 'E']]) { q++; add({ id: `maison-mv${q}`, name: `${q} Grande Rue des Marmottes`, kind: 'house', interior: 'house', x, z, w: 11, d: 10, h: 6, facing, roof: 'gable', color: HOUSE_COLORS0[q % HOUSE_COLORS0.length], roofColor: '#6b4226', district: 'marmottes' }); }
}
add({ id: 'capitainerie-gl', name: 'Capitainerie du Grand-Large', kind: 'decor', interior: 'office', x: 1430, z: -40, w: 14, d: 12, h: 9, floors: 2, facing: 'W', color: '#f4f1ea', roofColor: '#c1121f', sign: 'CAPITAINERIE', district: 'grand-large' });
add({ id: 'yacht-club', name: 'Yacht Club du Grand-Large', kind: 'shop', shop: 'homard', interior: 'restaurant', x: 1370, z: -40, w: 18, d: 14, h: 8, facing: 'E', color: '#ffffff', roofColor: '#1d3557', sign: 'YACHT CLUB', neon: true, district: 'grand-large' });
add({ id: 'hotel-gl', name: 'Hôtel Grand-Large', kind: 'decor', interior: 'lobby', x: 1370, z: -160, w: 24, d: 20, h: 24, floors: 7, facing: 'E', style: 'apartment', color: '#e2ece9', roofColor: '#0077b6', sign: 'HÔTEL GRAND-LARGE', district: 'grand-large' });
add({ id: 'station-a2', name: 'Aire des Sommets (A2)', kind: 'shop', shop: 'station', interior: 'minimarket', x: 40, z: -1865, w: 14, d: 9, h: 4.5, facing: 'N', style: 'station', color: '#f4f1ea', roofColor: '#d00000', sign: 'AIRE DES SOMMETS', district: 'grand-nord', gas: { x: 40, z: -1882, w: 16, d: 12 } });

// --- LES SABLONS (désert) : petite ville de western le long de la rue principale
{
  const SB = [
    ['sb-saloon', 'Saloon du Cactus Assoiffé', 'shop', 'cafe2', 'cafe', -2425, -940, 18, 14, 'E', '#c08552', '#5c3d2e', 'SALOON'],
    ['sb-epicerie', 'Bazar des Sablons', 'shop', 'superette', 'supermarket', -2375, -940, 16, 12, 'W', '#e9c46a', '#9c6644', 'BAZAR'],
    ['sb-garage', 'Garage du Coyote', 'shop', 'repair', 'workshop', -2425, -860, 22, 16, 'E', '#adb5bd', '#6c584c', 'GARAGE DU COYOTE'],
    ['sb-sherif', 'Bureau du Shérif', 'decor', null, 'office', -2375, -860, 16, 12, 'W', '#ddb892', '#7f5539', 'SHÉRIF'],
    ['sb-motel', 'Motel Mirage', 'decor', null, 'lobby', -2425, -560, 30, 14, 'E', '#ffafcc', '#3d405b', 'MOTEL MIRAGE'],
    ['sb-tacos', 'Tacos du Désert', 'shop', 'tacos', 'fastfood', -2375, -560, 14, 12, 'W', '#ffd166', '#ef476f', 'TACOS'],
    ['sb-brocante', 'Brocante de la Ruée vers l\'Or', 'shop', 'brocante', 'shop', -2425, -480, 18, 12, 'E', '#b08968', '#582f0e', 'BROCANTE'],
  ]
  for (const [id, name, kind, shop, interior, x, z, w, d, facing, color, roofColor, sign] of SB) add({ id, name, kind, ...(shop ? { shop } : {}), interior, x, z, w, d, h: 7, facing, color, roofColor, sign, district: 'sablons' });
  add({ id: 'sb-station', name: 'Station du Désert', kind: 'shop', shop: 'station', interior: 'minimarket', x: -2150, z: -735, w: 14, d: 9, h: 4.5, facing: 'N', style: 'station', color: '#f4f1ea', roofColor: '#e76f51', sign: 'STATION DU DÉSERT', district: 'sablons', gas: { x: -2150, z: -722, w: 16, d: 10 } });
  let q = 0;
  for (const z of [-780, -740, -660, -620]) for (const [x, facing] of [[-2425, 'E'], [-2375, 'W']]) { q++; add({ id: `maison-sb${q}`, name: `${q} rue Principale des Sablons`, kind: 'house', interior: 'house', x, z, w: 12, d: 11, h: 5, facing, color: ['#e9c46a', '#f4a261', '#e76f51', '#ddb892'][q % 4], roofColor: '#7f5539', district: 'sablons' }); }
  add({ id: 'ranch', name: 'Ranch du Grand Canyon', kind: 'shop', shop: 'farm', interior: 'barn', x: -2650, z: -1300, w: 30, d: 20, h: 9, facing: 'S', style: 'barn', color: '#9b2226', roofColor: '#3a2a1e', sign: 'RANCH', district: 'desert' });
}

// --- LA PALMERAIE : station balnéaire de luxe sur la côte est
{
  const PM = [
    ['pm-hotel1', 'Palace des Cocotiers', 'decor', null, 'lobby', 2565, -880, 30, 24, 'E', 'apartment', '#ffffff', '#2a9d8f', 'PALACE DES COCOTIERS', 36, 10],
    ['pm-hotel2', 'Hôtel Lagon Bleu', 'decor', null, 'lobby', 2637, -880, 30, 24, 'W', 'apartment', '#caf0f8', '#0077b6', 'HÔTEL LAGON BLEU', 30, 9],
    ['pm-casino', 'Casino des Palmiers', 'service', null, 'casino', 2565, -760, 30, 24, 'E', null, '#ffd166', '#7209b7', 'CASINO', 10, 1],
    ['pm-surf', 'Surf Shack de la Palmeraie', 'shop', 'surf', 'shop', 2637, -760, 18, 14, 'W', null, '#90e0ef', '#ff6b6b', 'SURF SHACK', 7, 1],
    ['pm-resto', 'Langouste Royale', 'shop', 'homard', 'restaurant', 2565, -160, 22, 16, 'E', null, '#ffe5d9', '#9d0208', 'LANGOUSTE ROYALE', 8, 1],
    ['pm-paillote', 'Paillote Tiki', 'shop', 'paillote', 'cafe', 2637, -160, 16, 12, 'W', 'hut', '#e9c46a', '#8d5a2b', 'TIKI', 6, 1],
    ['pm-bijoux', 'Joaillerie des Îles', 'shop', 'bijoux', 'shop', 2565, -60, 16, 12, 'E', null, '#fefae0', '#c9a227', 'JOAILLERIE', 7, 1],
    ['pm-immo', 'Agence Palmeraie Prestige', 'shop', 'immo', 'agency', 2637, -60, 16, 12, 'W', null, '#e2ece9', '#264653', 'IMMOBILIER', 7, 1],
  ]
  for (const [id, name, kind, shop, interior, x, z, w, d, facing, style, color, roofColor, sign, h, floors] of PM) add({ id, name, kind, ...(shop ? { shop } : {}), interior, x, z, w, d, h, floors, facing, ...(style ? { style } : {}), color, roofColor, sign, neon: kind !== 'decor', district: 'palmeraie' });
  let v = 0;
  for (let x = 2330; x <= 2870; x += 45) {
    if (Math.abs(x - 2600) < 30) continue;
    for (const [z, facing] of [[-265, 'N'], [-335, 'S']]) { v++; add({ id: `villa-pm${v}`, name: `Villa ${v} allée des Cocotiers`, kind: 'house', interior: 'house', x, z, w: 16, d: 13, h: 7, facing, color: ['#ffffff', '#fefae0', '#e0fbfc', '#ffe5ec'][v % 4], roofColor: ['#2a9d8f', '#e76f51', '#264653'][v % 3], district: 'palmeraie' }); }
  }
}

// --- GLACIER-SUR-ALPE : village de montagne (chalets, fondue, location de skis)
{
  const AL = [
    ['al-fondue', 'La Fondue qui Fond', 'shop', 'bakery', 'restaurant', -120, -2375, 20, 14, 'S', '#a0703c', '#3a2a1e', 'FONDUE'],
    ['al-skis', 'Glisse & Raclette (location de skis)', 'shop', 'sport', 'shop', 120, -2375, 20, 14, 'S', '#bc6c25', '#283618', 'LOCATION DE SKIS'],
    ['al-hotel', 'Hôtel du Mont Géant', 'decor', null, 'lobby', -240, -2325, 30, 20, 'N', '#dda15e', '#283618', 'HÔTEL DU MONT GÉANT'],
    ['al-superette', 'Épicerie des Cimes', 'shop', 'superette', 'supermarket', 240, -2325, 18, 14, 'N', '#fefae0', '#9b2226', 'ÉPICERIE DES CIMES'],
  ]
  for (const [id, name, kind, shop, interior, x, z, w, d, facing, color, roofColor, sign] of AL) add({ id, name, kind, ...(shop ? { shop } : {}), interior, x, z, w, d, h: 9, facing, roof: 'gable', color, roofColor, sign, district: 'alpe' });
  let c = 0;
  for (let x = -660; x <= 660; x += 40) {
    if (Math.abs(x) < 300 || Math.abs(Math.abs(x) - 350) < 22) continue;
    for (const [z, facing] of [[-2375, 'S'], [-2325, 'N']]) { c++; add({ id: `chalet-al${c}`, name: `Chalet ${c} Grande Rue`, kind: 'house', interior: 'house', x, z, w: 13, d: 11, h: 7, facing, roof: 'gable', color: ['#a0703c', '#8d5a2b', '#bc6c25'][c % 3], roofColor: '#3a2a1e', district: 'alpe' }); }
  }
  // Bike Park des Géants : magasin de vélos et départ des parcours VTT et vélo de route
  add({ id: 'bike-park', name: 'Bike Park des Géants', kind: 'shop', shop: 'bikepark', interior: 'agency', x: 930, z: -2522, w: 26, d: 14, h: 8, facing: 'S', roof: 'gable', color: '#ff6b35', roofColor: '#283618', sign: 'BIKE PARK DES GÉANTS', neon: true, district: 'bike-park' });
  // zone commerciale des Cimes, le long de la route du Bike Park
  {
    const ZC = [
      ['zc-sport', 'Sport Géant (tout pour le sport)', 'sport', 'shop', 140, 30, '#0082c3', '#ffffff', 'SPORT GÉANT'],
      ['zc-brico', 'Brico des Cimes', 'brico', 'warehouse', 230, 36, '#f77f00', '#3d405b', 'BRICO DES CIMES'],
      ['zc-meubles', 'Meubles du Chalet', 'maison', 'shop', 440, 30, '#bc6c25', '#283618', 'MEUBLES DU CHALET'],
      ['zc-velos', 'Cycles des Cimes', 'bikes', 'shop', 520, 20, '#06d6a0', '#073b4c', 'CYCLES DES CIMES'],
      ['zc-burger', 'Burger des Cimes', 'tacos', 'fastfood', 600, 18, '#e63946', '#ffd166', 'BURGER DES CIMES'],
      ['zc-garage', 'Garage Alpin', 'repair', 'workshop', 680, 26, '#adb5bd', '#495057', 'GARAGE ALPIN'],
      ['zc-super', 'Hyper des Cimes', 'supermarket', 'supermarket', 770, 36, '#e9f5db', '#1d4ed8', 'HYPER DES CIMES'],
    ]
    for (const [id, name, shop, interior, x, w, color, roofColor, sign] of ZC) add({ id, name, kind: 'shop', shop, interior, x, z: -2474, w, d: 16, h: 8, facing: 'N', ...(w >= 30 ? { style: 'big-box' } : {}), color, roofColor, sign, district: 'cimes' });
  }
  add({ id: 'station-a4', name: 'Aire des Géants (A4)', kind: 'shop', shop: 'station', interior: 'minimarket', x: 40, z: -2865, w: 14, d: 9, h: 4.5, facing: 'N', style: 'station', color: '#f4f1ea', roofColor: '#0077b6', sign: 'AIRE DES GÉANTS', district: 'hauts-plateaux', gas: { x: 40, z: -2882, w: 16, d: 12 } });
}

// --- Campagne des Navets
add({ id: 'ferme-navets', name: 'Maison de la Ferme des Navets', kind: 'house', interior: 'house', x: -265, z: -25, w: 12, d: 10, h: 6, facing: 'E', roof: 'gable', color: '#efe3c2', roofColor: '#7a4b2a', district: 'campagne' });
add({ id: 'grange-navets', name: 'Grange des Navets', kind: 'decor', interior: 'barn', x: -245, z: -48, w: 20, d: 16, h: 9, facing: 'E', roof: 'gable', style: 'barn', color: '#9c2a24', roofColor: '#4a2620', barn: true, district: 'campagne' });
add({ id: 'boutique-ferme', name: 'Boutique de la Ferme', kind: 'shop', shop: 'farm', interior: 'bakery', x: -180, z: -16, w: 12, d: 10, h: 6, facing: 'S', roof: 'gable', color: '#fefae0', roofColor: '#bc4749', sign: 'PRODUITS DE LA FERME', awning: '#6a994e', district: 'campagne' });
add({ id: 'station-navets', name: 'Station des Navets', kind: 'shop', shop: 'station', interior: 'minimarket', x: -180, z: 38, w: 14, d: 9, h: 4.5, facing: 'N', style: 'station', color: '#f4f1ea', roofColor: '#ffb703', sign: 'STATION DES NAVETS', district: 'campagne', gas: { x: -180, z: 22, w: 16, d: 12 } });
add({ id: 'ferme-pres', name: 'Maison des Prés Fleuris', kind: 'house', interior: 'house', x: -265, z: -112, w: 12, d: 10, h: 6, facing: 'E', roof: 'gable', color: '#ffe5b4', roofColor: '#6b4226', district: 'campagne' });

// --- Plage Sauvage
add({ id: 'paillote', name: 'Paillote Coco Loco', kind: 'shop', shop: 'paillote', interior: 'cafe', x: -205, z: 76, w: 14, d: 10, h: 5, facing: 'N', roof: 'gable', style: 'hut', color: '#e9c46a', roofColor: '#bc6c25', sign: 'COCO LOCO', district: 'plage-ouest' });

// --- Maisons individuelles des Tilleuls (rangées le long des rues). Rues nord/sud de chaque îlot.
const HOUSE_COLORS = ['#f4d35e', '#ee964b', '#83c5be', '#e5989b', '#b5e48c', '#a2d2ff', '#ffc8dd', '#cdb4db', '#f6bd60', '#84a59d'];
const ROOF_COLORS = ['#8c3b2f', '#3d5a80', '#6b4226', '#2a6f4e', '#5e3c58'];
const STREET_NAMES = { lilas: 'rue des Lilas', tilleuls: 'avenue des Tilleuls', glycines: 'rue des Glycines', 'bd-nord': 'boulevard du Nord' };
let houseN = 0;
function houseRow(x1, x2, z, facing, street, num0 = 1) {
  const n = Math.max(1, Math.floor((x2 - x1) / 16));
  const step = (x2 - x1) / n;
  for (let i = 0; i < n; i++) {
    const x = x1 + step * (i + 0.5);
    houseN++;
    add({
      id: `maison-t${houseN}`, name: `${num0 + i * 2} ${STREET_NAMES[street]}`, kind: 'house', interior: 'house', x, z, w: 10, d: 10, h: 5.5,
      facing, roof: 'gable', color: HOUSE_COLORS[houseN % HOUSE_COLORS.length], roofColor: ROOF_COLORS[houseN % ROOF_COLORS.length], district: 'tilleuls',
    });
  }
}
// Îlots de maisons : deux rangées dos à dos par îlot, façade côté rue (S = rue au sud, N = rue au nord).
const XB = [[-130, -79], [-61, -10], [10, 61], [79, 130]];
const ROWS = [
  [-157, 'S', 'bd-nord', [0, 2]], [-175, 'N', 'lilas', [0, 1, 2]],
  [-205.5, 'S', 'lilas', [0, 3]], [-223.5, 'N', 'tilleuls', [0, 3]],
  [-256.5, 'S', 'tilleuls', [1, 2, 3]], [-274.5, 'N', 'glycines', [1, 2, 3]],
  [-305.5, 'S', 'glycines', [1, 2]], [-318.5, 'N', 'loisirs', [1, 2]],
];
STREET_NAMES.loisirs = 'route des Loisirs';
for (const [z, facing, street, blocks] of ROWS) for (const k of blocks) houseRow(XB[k][0], XB[k][1], z, facing, street, 1 + k * 20 + (facing === 'N' ? 1 : 0));
houseRow(-105, -79, -305.5, 'S', 'glycines', 3); houseRow(-105, -79, -318.5, 'N', 'loisirs', 4);

export const CITY_BUILDINGS = B;

// ---------------------------------------------------------------------------------------------
// Parkings (places de stationnement : voitures garées, certaines ouvertes...). Rectangles + orientation des places.
export const PARKINGS = [
  { id: 'p-lumiere', name: 'Parking Lumière', x1: 150, z1: 32, x2: 200, z2: 51, rows: 'z' },
  { id: 'p-hopital', name: 'Parking de l\'hôpital', x1: 222, z1: -14, x2: 280, z2: -9, rows: 'x' },
  { id: 'p-homard', name: 'Parking des Affaires', x1: 150, z1: -128, x2: 200, z2: -108, rows: 'z' },
  { id: 'p-hyper2', name: 'Parking Hyper Bazar', x1: 150, z1: -327, x2: 172, z2: -297, rows: 'z' },
  { id: 'p-bowling', name: 'Parking des Loisirs', x1: 60, z1: -355, x2: 130, z2: -343, rows: 'x' },
  { id: 'p-tilleuls', name: 'Parking des Tilleuls', x1: 80, z1: -183, x2: 130, z2: -175, rows: 'x' },
  { id: 'p-port', name: 'Parking du Port', x1: 150, z1: 66, x2: 168, z2: 96, rows: 'z' },
  { id: 'p-prestige', name: 'Parking Prestige', x1: 460, z1: -326, x2: 540, z2: -314, rows: 'x' },
  { id: 'p-luxe', name: 'Parking de Prestige Motors', x1: 300, z1: -228, x2: 440, z2: -210, rows: 'x' },
];

// Stations-service (pompes) : position de l'auvent.
export const GAS_STATIONS = CITY_BUILDINGS.filter((b) => b.gas).map((b) => ({ id: b.id, name: b.name, ...b.gas }));

// Lieux spéciaux des nouveaux quartiers.
export const CITY_POI = {
  arena: { x: 0, z: -385, r: 26 },
  funfair: { x: -45, z: -385 },
  circuit: { x: 220, z: -385, rx: 62, rz: 26 },
  skatepark: { x: 40, z: -400 },
  windmill: { x: -195, z: -100 },
  tilleulsPark: { x: -35, z: -214 },
  port: { quayZ: 100 },
  spawnCity: { x: 150, z: 8 },
};
