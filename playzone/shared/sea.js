// FONDS MARINS : la mer s'approfondit au large (jusqu'à ~14 m), avec des récifs coralliens (hauts-fonds
// à ~5 m), une épave et des poissons. On plonge en nageant (C pour descendre, Espace pour remonter,
// réserve d'air), ou on loue un sous-marin au Centre de plongée. Règles partagées client / autorité.

export const REEFS = [
  { id: 'coraux', name: 'Récif des Coraux Rieurs', x: -380, z: 215, r: 42 },
  { id: 'jardin', name: 'Jardin de Corail', x: 560, z: 240, r: 38 },
  { id: 'merous', name: 'Tombant des Mérous', x: -900, z: 265, r: 44 },
  { id: 'lagon', name: 'Lagon Turquoise', x: 2250, z: 235, r: 52 },
  { id: 'arche', name: 'Arche du Cap', x: -1850, z: 300, r: 40 },
  { id: 'epave', name: 'Épave du Sardine-Express', x: 40, z: 300, r: 32, wreck: true },
];
export const WRECK = REEFS.find((r) => r.wreck);
export const TREASURE = { x: WRECK.x + 6, z: WRECK.z - 3, min: 150, max: 900 };   // coffre de l'épave (une fois par jour réel)
export const DIVE_CENTER = 'plongee';

// Profondeur du large (mètres sous le niveau 0, négatif) et hauts-fonds des récifs.
export function seaFloor(x, z, h) {
  if (z > 140) h -= Math.min(10, (z - 140) * 0.06);
  for (const r of REEFS) {
    if (r.wreck) continue;
    const d = Math.hypot(x - r.x, z - r.z) / (r.r * 1.4);
    if (d < 1) h = Math.max(h, -4.8 - 6 * d * d + Math.sin(x * 0.7) * Math.cos(z * 0.6) * 0.35);
  }
  return h;
}

// Air : secondes sous l'eau (masque et palmes du centre de plongée : plus longtemps et plus vite).
export const AIR = { base: 25, mask: 70 };
export const SUBMARINE = { name: 'Sous-marin jaune « Nautilus Junior »', rent: 250, minutes: 10, speed: 6, depth: 13 };
export const DIVE_ITEMS = [
  { id: 'masque-palmes', name: 'Masque, tuba et palmes', shop: 'plongee', price: 180, emoji: '🤿', desc: 'Plus d\'air sous l\'eau (70 s au lieu de 25) et on nage plus vite.', special: true, max: 1 },
];
export const ownsMask = (p) => (p.inventory?.['masque-palmes'] || 0) > 0;
export const treasureDay = (now) => Math.floor((now + 3600_000) / 86400_000);
