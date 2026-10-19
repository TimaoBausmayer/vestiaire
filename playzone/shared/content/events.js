// Événements publics de base. Les packs saisonniers peuvent en ajouter (voir packs/halloween-2026.js).
export const BASE_EVENTS = [
  {
    id: 'invasion', name: 'Invasion de poulets', emoji: '🐔', duration: 90, triggerPrice: 150,
    desc: 'Des dizaines de poulets tombent du ciel sur la Grande Place ! Attrape-les (E / bouton main) avant les autres.',
    reward: { perCatch: 8, golden: 25, podium: [120, 70, 40] }, rep: { perCatch: 1, podium: [15, 10, 5] },
  },
  {
    id: 'soiree-dj', name: 'Soirée DJ Patate', emoji: '🎧', duration: 120, triggerPrice: 100,
    desc: 'DJ Patate mixe sur la scène de la Place. Danse sur la piste (touches 1, 2, 3) pour gagner de la réputation.',
    reward: { perTick: 5, maxTicks: 18 }, rep: { perTick: 1 }, tick: 6,
  },
];

export const EVENT_RULES = {
  autoEveryMs: 8 * 60 * 1000,   // un événement automatique toutes les 8 minutes environ
  cooldownMs: 3 * 60 * 1000,    // délai minimum entre deux événements déclenchés à la main
};
