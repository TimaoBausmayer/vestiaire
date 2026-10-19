// Pack saisonnier Halloween 2026 : actif automatiquement du 15 octobre au 8 novembre 2026.
// Exemple concret du système de mises à jour : ce fichier ajoute objets, décorations, un événement
// et des répliques de PNJ, sans modifier le moteur. Les objets achetés restent utilisables après la saison.
export default {
  id: 'halloween-2026',
  name: 'Halloween à PLAYZONE',
  version: '0.1.1',
  start: '2026-10-15T00:00:00Z',
  end: '2026-11-08T00:00:00Z',
  items: [
    { id: 'citrouille', name: 'Tête de Citrouille', shop: 'clothes', slot: 'hat', price: 300, emoji: '🎃', desc: 'Édition limitée Halloween. Sent légèrement la soupe.' },
    { id: 'sorciere', name: 'Chapeau de Sorcière', shop: 'clothes', slot: 'hat', price: 350, emoji: '🧙‍♀️', desc: 'Sortilèges non garantis.' },
    { id: 'cape-vampire', name: 'Cape de Vampire', shop: 'clothes', slot: 'back', price: 450, emoji: '🧛', desc: 'Pour faire "Mouhahaha" avec crédibilité.' },
    { id: 'citrouille-deco', name: 'Citrouille Lanterne', shop: 'furniture', furniture: true, price: 100, emoji: '🎃', desc: 'Elle sourit. Un peu trop.' },
    { id: 'cercueil', name: 'Canapé Cercueil', shop: 'furniture', furniture: true, price: 700, emoji: '⚰️', desc: 'Étonnamment confortable.' },
  ],
  events: [
    {
      id: 'chasse-citrouilles', name: 'Chasse aux citrouilles', emoji: '🎃', duration: 150, triggerPrice: 120, pumpkins: 12,
      desc: 'Des citrouilles lumineuses sont apparues partout en ville. Trouve-les avant les autres (regarde la carte du téléphone !).',
      reward: { perPumpkin: 15, podium: [100, 60, 30] }, rep: { perPumpkin: 2, podium: [12, 8, 4] },
    },
  ],
  // Décorations ajoutées au monde pendant la saison (citrouilles, toiles...).
  decorations: [
    { type: 'pumpkin', at: [[-8, 18], [8, 18], [-20, -20], [20, -20], [-3, -14], [3, -14], [-12.5, 10], [14, -15]] },
    { type: 'pumpkin', at: [[-18, 36.5], [18, 36.5], [-36.5, 18], [36.5, 18], [70, 12.5], [74, 12.5], [-4, -62], [4, -62]] },
    { type: 'ghost', at: [[-112, -106], [15, -116], [60, 80]] },
  ],
  npcLines: [
    'Tu as vu les citrouilles ? Je jure qu\'une m\'a fait un clin d\'œil.',
    'Cette année je me déguise en impôt. Ça fait peur à tout le monde.',
    'Un fantôme m\'a demandé l\'heure. Je lui ai dit "l\'heure de partir".',
  ],
};
