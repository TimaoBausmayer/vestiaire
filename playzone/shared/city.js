// PLAN DE LA GRANDE VILLE (mise à jour "monde ouvert") — données pures partagées client / serveur.
// Le centre historique (place, parc, ferme Bidoche, quartier des Mouettes, plage) est conservé ;
// autour : quartier d'affaires, port, zone commerciale, quartier résidentiel des Tilleuls, zone
// industrielle, campagne, plage sauvage, parc de loisirs, circuit et prison.
// Repère : X vers l'est, Z vers le sud. Unité ≈ 1 m.

export const BOUNDS = { minX: -300, maxX: 300, minZ: -500, maxZ: 140 };

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
];
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
    n.light = n.degree >= 3 && mains >= 1 && n.streets.size >= 2;
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
  { id: 'paillettes', name: 'Quartier des Paillettes', rect: [-300, -500, 300, -420] },
];

// ---------------------------------------------------------------------------------------------
// BÂTIMENTS DES NOUVEAUX QUARTIERS. Champs : id, name, kind (shop | job | home | house | decor | service),
// x, z (centre), w (largeur X), d (profondeur Z), h (hauteur), facing (N | S | E | W = côté de la porte),
// style (rendu), color, roof (flat | gable), roofColor, sign, floors, interior (modèle d'intérieur visitable),
// shop (catalogue vendu), district.
const B = [];
const add = (o) => { B.push({ roof: 'flat', floors: 1, ...o }); };

// --- Quartier Lumière (affaires)
add({ id: 'pizzeria', name: 'Pizzeria Mamma Mia-ou', kind: 'shop', shop: 'pizzeria', interior: 'restaurant', x: 158, z: 18, w: 16, d: 16, h: 7, facing: 'N', color: '#f6e7c8', roofColor: '#b5562d', sign: 'PIZZERIA MAMMA MIA-OU', awning: '#2a9d3a', district: 'affaires' });
add({ id: 'tacos', name: 'Tacos Tornade', kind: 'shop', shop: 'tacos', interior: 'fastfood', x: 179, z: 18, w: 16, d: 16, h: 7, facing: 'N', color: '#ffb703', roofColor: '#9c2c13', sign: 'TACOS TORNADE', awning: '#e63946', district: 'affaires' });
add({ id: 'immo', name: 'Agence Immo Pas Cher', kind: 'shop', shop: 'immo', interior: 'agency', x: 196.5, z: 18, w: 11, d: 14, h: 7, facing: 'N', color: '#dfe7fd', roofColor: '#3d5a80', sign: 'IMMO PAS CHER', district: 'affaires' });
add({ id: 'tour', name: 'Tour PlayCorp', kind: 'service', interior: 'office', x: 240, z: 25, w: 24, d: 24, h: 40, floors: 10, facing: 'N', style: 'tower', color: '#9bb7d4', roofColor: '#34495e', sign: 'PLAYCORP', district: 'affaires' });
add({ id: 'cinema', name: 'Ciné Pop-Corn Mou', kind: 'service', shop: 'cinema', interior: 'cinema', x: 270, z: 25, w: 22, d: 26, h: 11, facing: 'N', style: 'cinema', color: '#5b2a86', roofColor: '#2a0f45', sign: 'CINÉ POP-CORN MOU', neon: true, district: 'affaires' });
add({ id: 'police', name: 'Commissariat Central', kind: 'service', interior: 'police', x: 165, z: -22, w: 28, d: 22, h: 9, floors: 2, facing: 'S', style: 'police', color: '#e9edf2', roofColor: '#1d3557', sign: 'POLICE', district: 'affaires' });
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
