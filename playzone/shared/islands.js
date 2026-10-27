// ÎLES ET BEAUX PAYSAGES : 5 îles au large (plage, îlot des amoureux, phare, jungle et cascade,
// volcan endormi), une navette en bateau depuis le ponton de la plage, et 8 merveilles à découvrir
// (récompense à la première visite, petit bonheur à chaque retour). Règles pures partagées.

export const ISLANDS = [
  { id: 'mouettes', name: 'Île aux Mouettes', x: -150, z: 220, r: 36, top: 2.4, kind: 'plage', desc: 'Sable blanc, palmiers et eau turquoise. La plage secrète des habitants.' },
  { id: 'amoureux', name: 'Îlot des Amoureux', x: 230, z: 250, r: 22, top: 1.8, kind: 'amour', desc: 'Une arche en forme de cœur et un banc face au coucher de soleil.' },
  { id: 'phare', name: 'Île du Phare', x: 760, z: 225, r: 40, top: 5, kind: 'phare', desc: 'Falaises, rochers et le vieux phare rayé : la plus belle vue sur la ville.' },
  { id: 'tortue', name: 'Île de la Tortue', x: -1300, z: 340, r: 50, top: 6, kind: 'jungle', desc: 'Jungle, cascade et bassin naturel. On dit qu\'un trésor y est caché.' },
  { id: 'volcan', name: 'Île du Volcan Endormi', x: 1500, z: 345, r: 55, top: 26, kind: 'volcan', desc: 'Un volcan qui ronfle doucement. Du cratère, on voit toute la côte.' },
];
export const ISLAND_BY_ID = Object.fromEntries(ISLANDS.map((i) => [i.id, i]));

const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
// Rayon de la côte selon l'angle (côte découpée, différente pour chaque île).
export function coastR(I, x, z) {
  const a = Math.atan2(z - I.z, x - I.x), k = I.x * 0.013 + I.z * 0.007;
  return I.r * (1 + 0.13 * Math.sin(a * 3 + k) + 0.07 * Math.sin(a * 7 + k * 2.3) + 0.04 * Math.sin(a * 13 + k));
}
// Hauteur du sol d'une île (ou null loin des îles). water = niveau de la mer.
export function islandHeight(x, z, water = -0.35) {
  let best = null;
  for (const I of ISLANDS) {
    const d = Math.hypot(x - I.x, z - I.z);
    if (d > I.r * 1.6) continue;
    const R = coastR(I, x, z), t = 1 - d / R;
    let h;
    if (t < 0) h = water - 0.3 + Math.max(-1, t / 0.35) * 4.2;                 // talus sous l'eau
    else if (I.kind === 'volcan') {
      h = 0.25 + I.top * Math.pow(smooth((t - 0.08) / 0.92), 1.25);
      if (t > 0.86) h -= (t - 0.86) * 55;                                       // cratère
    } else {
      h = 0.25 + I.top * smooth((t - 0.14) / 0.7) * (0.85 + 0.15 * Math.sin(x * 0.21) * Math.cos(z * 0.17));
    }
    best = best === null ? h : Math.max(best, h);
  }
  return best;
}
export const islandAt = (x, z, m = 0) => ISLANDS.find((I) => Math.hypot(x - I.x, z - I.z) < coastR(I, x, z) + m) || null;
// Ponton d'arrivée de la navette : côté ville (nord) de chaque île.
export const islandDock = (I) => ({ x: I.x, z: I.z - I.r * 0.72 });

// Navette des îles : départ du bout du ponton de la Plage des Orteils.
export const FERRY = { price: 60, dock: { x: 52, z: 118 }, r: 6 };

// Merveilles à découvrir (r = rayon pour la valider).
export const SIGHTS = [
  { id: 'ponton', name: 'Coucher de soleil sur le ponton', x: 52, z: 122, r: 6, emoji: '🌅' },
  { id: 'plage-secrete', name: 'Plage secrète de l\'Île aux Mouettes', x: -150, z: 238, r: 10, emoji: '🏝️' },
  { id: 'arche-coeur', name: 'Arche du cœur (Îlot des Amoureux)', x: 230, z: 254, r: 6, emoji: '💗' },
  { id: 'phare', name: 'Sommet du vieux phare', x: 768, z: 222, r: 6, emoji: '🗼' },
  { id: 'cascade-tortue', name: 'Cascade de l\'Île de la Tortue', x: -1300, z: 352, r: 9, emoji: '💧' },
  { id: 'cratere', name: 'Cratère du Volcan Endormi', x: 1500, z: 345, r: 14, emoji: '🌋' },
  { id: 'cascade-geants', name: 'Cascade des Géants', x: 0, z: -2952, r: 12, emoji: '🏞️' },
  { id: 'lavande', name: 'Champ de lavande', x: -1200, z: -500, r: 34, emoji: '💜' },
];
export const SIGHT_BY_ID = Object.fromEntries(SIGHTS.map((s) => [s.id, s]));
export const SIGHT_REWARD = { coins: 200, xp: 60, all: 3000, again: 8, againCd: 10 * 60_000 };
