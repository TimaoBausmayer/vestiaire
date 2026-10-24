// ÉQUIPEMENT DE GLISSE (wingfoil) : ailes, planches, foils et couleurs au choix. Chaque pièce change
// la façon de naviguer (vent minimum, vitesse, décollage du foil, hauteur des sauts, rotations,
// stabilité). Partagé client / autorité : l'autorité vérifie la propriété et plafonne les sauts.
import { groundHeight, WATER_LEVEL, WORLD_BOUNDS } from './world-layout.js';

// lowWind : nœuds gagnés sur le vent minimum · speed / jump / spin / turn : multiplicateurs
export const WINGS = {
  'aile-2': { name: 'Aile Tempête 2,5 m²', emoji: '🌪️', price: 1900, lowWind: -9, speed: 1.2, jump: 1.1, spin: 1.3, turn: 1.3, level: 4, desc: 'Pour le très gros temps : dès 19 nœuds, et ça décoiffe jusqu\'à 40.' },
  'aile-3': { name: 'Aile Fusée 3 m²', emoji: '🔺', price: 1400, lowWind: -4, speed: 1.12, jump: 0.95, spin: 1.25, turn: 1.25, desc: 'Petite et nerveuse : pour les jours de gros vent (14 nœuds minimum).' },
  'aile-4': { name: 'Aile Sprint 4 m²', emoji: '🪁', price: 1600, lowWind: -2, speed: 1.08, jump: 1, spin: 1.12, turn: 1.12, desc: 'Vive et rapide dès 12 nœuds.' },
  'aile-5': { name: 'Aile Polyvalente 5 m²', emoji: '🪁', price: 1800, lowWind: 0, speed: 1, jump: 1, spin: 1, turn: 1, desc: 'Celle du pack de base : fait tout bien, à partir de 10 nœuds.' },
  'aile-6': { name: 'Aile Brise Légère 6 m²', emoji: '🌬️', price: 2100, lowWind: 2, speed: 0.95, jump: 1.05, spin: 0.9, turn: 0.92, desc: 'Grande surface : vole dès 8 nœuds, un peu moins vive.' },
  'aile-7': { name: 'Aile Pétole 7 m²', emoji: '🍃', price: 2500, lowWind: 4, speed: 0.9, jump: 1.08, spin: 0.82, turn: 0.85, desc: 'Pour les jours sans vent : vole dès 6 nœuds !' },
  'aile-free': { name: 'Aile Freestyle Twister 4,5 m²', emoji: '🌀', price: 3200, lowWind: -1, speed: 1.02, jump: 1.25, spin: 1.45, turn: 1.15, level: 5, desc: 'Sauts plus hauts, rotations ultra-rapides : la reine des figures.' },
  'aile-race': { name: 'Aile Carbone Racing 5 m²', emoji: '⚡', price: 4800, lowWind: 0, speed: 1.28, jump: 1, spin: 0.95, turn: 1.05, level: 8, desc: 'Lattes en carbone : la plus rapide du plan d\'eau.' },
  'aile-8': { name: 'Aile Pétole XXL 8 m²', emoji: '🎈', price: 3400, lowWind: 5, speed: 0.88, jump: 1.1, spin: 0.75, turn: 0.8, level: 3, desc: 'Énorme : décolle dès 5 nœuds (en pompant un peu).' },
  'aile-mamie': { name: 'Aile Parapluie de Mamie', emoji: '☂️', price: 600, lowWind: -3, speed: 0.8, jump: 0.8, spin: 1.6, turn: 1.3, desc: 'Ça ne devrait pas voler. Et pourtant. Tourne comme une toupie.' },
};
export const BOARDS = {
  'planche-95': { name: 'Planche Stable 95 L', emoji: '🏄', price: 0, speed: 1, jump: 1, stability: 1.25, desc: 'Large et rassurante (fournie avec le pack).' },
  'planche-75': { name: 'Planche Sport 75 L', emoji: '🏄', price: 900, speed: 1.06, jump: 1.06, stability: 1, desc: 'Plus vive, pardonne un peu moins.' },
  'planche-55': { name: 'Planche Pro 55 L', emoji: '🏄‍♂️', price: 1500, speed: 1.12, jump: 1.12, stability: 0.8, level: 6, desc: 'Minuscule et rapide : pour les experts.' },
  'planche-sup': { name: 'Planche Géante 130 L', emoji: '🛶', price: 700, speed: 0.92, jump: 0.85, stability: 1.6, desc: 'Impossible de tomber. Presque.' },
};
// takeoff : vitesse (m/s) à partir de laquelle la planche décolle sur son foil
export const FOILS = {
  'foil-1500': { name: 'Foil Portant 1500 cm²', emoji: '🛩️', price: 0, takeoff: 4.6, speed: 0.95, desc: 'Décolle tout seul, à basse vitesse (fourni avec le pack).' },
  'foil-1100': { name: 'Foil Polyvalent 1100 cm²', emoji: '🛩️', price: 800, takeoff: 5.5, speed: 1.05, desc: 'Le bon compromis entre portance et vitesse.' },
  'foil-800': { name: 'Foil Course 800 cm²', emoji: '🚀', price: 1600, takeoff: 6.5, speed: 1.18, level: 6, desc: 'Il faut de la vitesse pour décoller, mais ensuite... ça file !' },
  'foil-surf': { name: 'Foil Vague 1300 cm²', emoji: '🌊', price: 1100, takeoff: 5, speed: 1, jumpBonus: 1.1, desc: 'Taillé pour les sauts et les virages serrés.' },
};
export const GEAR_COLORS = ['#ff3fa4', '#ff9f1c', '#2ec4b6', '#3a86ff', '#e63946', '#ffd23f', '#7ac74f', '#8338ec', '#f8f9fa', '#14141c', '#06d6a0', '#ff70a6'];
export const DEFAULT_GEAR = { wing: 'aile-5', board: 'planche-95', foil: 'foil-1500', wingColor: '#ff3fa4', boardColor: '#ff9f1c' };
export const GEAR_SLOTS = { wing: WINGS, board: BOARDS, foil: FOILS };

// Articles vendus au Surf Shop (le pack « wingfoil » donne l'aile 5 m², la planche 95 L et le foil 1500).
export const GEAR_ITEMS = [
  ...Object.entries(WINGS).filter(([id]) => id !== 'aile-5'),
  ...Object.entries(BOARDS).filter(([, d]) => d.price),
  ...Object.entries(FOILS).filter(([, d]) => d.price),
].map(([id, d]) => ({ id, name: d.name, shop: 'surf', special: true, gear: true, price: d.price, emoji: d.emoji, desc: d.desc, max: 1, ...(d.level ? { level: d.level } : {}) }));

// Pièces possédées : celles achetées, plus le pack de base si on a le wingfoil complet.
export function ownsGear(p, id) {
  if ((p.inventory?.[id] || 0) > 0) return true;
  return (p.inventory?.wingfoil || 0) > 0 && (id === 'aile-5' || id === 'planche-95' || id === 'foil-1500');
}
export function equipped(p) {
  const g = { ...DEFAULT_GEAR, ...(p.gear || {}) };
  for (const [slot, table] of Object.entries(GEAR_SLOTS)) if (!table[g[slot]] || !ownsGear(p, g[slot])) g[slot] = DEFAULT_GEAR[slot];
  return g;
}
// Caractéristiques de navigation d'un équipement.
export function gearStats(g) {
  const W = WINGS[g.wing] || WINGS['aile-5'], Bd = BOARDS[g.board] || BOARDS['planche-95'], F = FOILS[g.foil] || FOILS['foil-1500'];
  return {
    minWind: 10 - W.lowWind,
    speed: W.speed * Bd.speed * F.speed,
    jump: W.jump * Bd.jump * (F.jumpBonus || 1),
    spin: W.spin,
    turn: W.turn,
    takeoff: F.takeoff,
    stability: Bd.stability,
  };
}
// Mise à l'eau « où on veut » : point d'eau profonde le plus proche (rayon r), ou null.
export function deepWaterNear(x, z, r = 40) {
  const deep = (px, pz) => groundHeight(px, pz) < WATER_LEVEL - 1.2;
  if (deep(x, z)) return { x, z };
  // anneaux de plus en plus larges : le premier point d'eau profonde trouvé est le plus proche
  for (let d = 4; d <= r; d += 4) for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
    if (deep(px, pz)) return { x: px, z: pz };
  }
  return null;
}
// Zone navigable : toute l'eau profonde de la carte (mer, lac, marinas), avec une marge au large.
export const inNavZone = (x, z) => x > WORLD_BOUNDS.minX - 300 && x < WORLD_BOUNDS.maxX + 300 && z > WORLD_BOUNDS.minZ && z < WORLD_BOUNDS.maxZ + 400;
