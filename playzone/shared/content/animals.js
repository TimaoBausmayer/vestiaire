// Les 20 espèces de PLAYZONE et leur comportement. `area` = rectangle [x1, z1, x2, z2] où elles vivent.
// behavior : wander (se promène), graze (broute), peck (picore), flee (fuit le joueur), flock (groupe qui
// s'envole), fly (vole en cercles), swim (nage), bask (se dore au soleil, attaque si on approche),
// prowl (rôde en meute), follow (animal de compagnie).

export const SPECIES = {
  chien: { name: 'Chien', emoji: '🐕', behavior: 'wander', speed: 3.2, count: 3, area: [-22, -22, 22, 22], adoptable: true, sound: 'Wouf !', flee: 0 },
  chat: { name: 'Chat', emoji: '🐈', behavior: 'wander', speed: 2.2, count: 3, area: [60, -55, 125, 55], adoptable: true, sound: 'Miaou.', flee: 3 },
  pigeon: { name: 'Pigeon', emoji: '🐦', behavior: 'flock', speed: 1.4, count: 10, area: [-20, -20, 20, 20], sound: 'Rou-rou ?', flee: 4 },
  rat: { name: 'Rat', emoji: '🐀', behavior: 'flee', speed: 4, count: 4, area: [62, -124, 126, -64], adoptable: true, sound: 'Couic !', flee: 6 },
  lapin: { name: 'Lapin', emoji: '🐇', behavior: 'flee', speed: 4.5, count: 5, area: [-55, -124, 55, -66], adoptable: true, sound: '...', flee: 7 },
  renard: { name: 'Renard', emoji: '🦊', behavior: 'flee', speed: 5, count: 2, area: [-124, -124, -66, -66], sound: 'Ya-ya-ya !', flee: 9 },
  loup: { name: 'Loup', emoji: '🐺', behavior: 'prowl', speed: 3, count: 3, area: [-124, -124, -80, -80], sound: 'Aouuuh !', flee: 0 },
  ours: { name: 'Ours', emoji: '🐻', behavior: 'wander', speed: 1.4, count: 1, area: [-124, -100, -96, -70], sound: 'Grmmmbl.', flee: 0 },
  corbeau: { name: 'Corbeau', emoji: '🐦‍⬛', behavior: 'fly', speed: 6, count: 3, area: [-124, -124, -60, -60], adoptable: true, sound: 'Croa !', flee: 0 },
  canard: { name: 'Canard', emoji: '🦆', behavior: 'swim', speed: 1.2, count: 5, area: [-38, -120, -22, -104], adoptable: true, sound: 'Coin !', flee: 0, water: true },
  cheval: { name: 'Cheval', emoji: '🐎', behavior: 'graze', speed: 1.6, count: 2, area: [-89, 9, -69, 35], sound: 'Hiiii !', flee: 0 },
  vache: { name: 'Vache', emoji: '🐄', behavior: 'graze', speed: 0.9, count: 3, area: [-89, 9, -69, 35], sound: 'Meuuuh.', flee: 0 },
  cochon: { name: 'Cochon', emoji: '🐖', behavior: 'graze', speed: 1.4, count: 3, area: [-89, 40, -73, 55], adoptable: true, sound: 'Groin !', flee: 0 },
  poulet: { name: 'Poulet', emoji: '🐓', behavior: 'peck', speed: 2.2, count: 6, area: [-79, -31, -67, -13], adoptable: true, sound: 'Cot cot !', flee: 2.5 },
  mouton: { name: 'Mouton', emoji: '🐑', behavior: 'graze', speed: 1.1, count: 4, area: [-89, 9, -69, 35], sound: 'Bêêê.', flee: 0 },
  requin: { name: 'Requin', emoji: '🦈', behavior: 'swim', speed: 4, count: 2, area: [-100, 108, 100, 126], sound: '(musique inquiétante)', flee: 0, water: true, deep: true },
  tortue: { name: 'Tortue', emoji: '🐢', behavior: 'wander', speed: 0.5, count: 3, area: [-90, 78, 40, 92], adoptable: true, sound: '...', flee: 0 },
  serpent: { name: 'Serpent', emoji: '🐍', behavior: 'wander', speed: 1.3, count: 2, area: [-124, -60, -100, -30], adoptable: true, sound: 'Sssss.', flee: 0 },
  aigle: { name: 'Aigle', emoji: '🦅', behavior: 'fly', speed: 9, count: 1, area: [-128, -128, 128, 0], sound: 'Kiiiii !', flee: 0, high: true },
  crocodile: { name: 'Crocodile', emoji: '🐊', behavior: 'bask', speed: 2.5, count: 1, area: [-38, -120, -22, -104], sound: 'Clac.', flee: 0, water: true },
};

export const SPECIES_IDS = Object.keys(SPECIES);

// Humeur d'un animal de compagnie (calculée à partir du temps, sans tâche de fond côté serveur).
export const PET_FOOD_DECAY_MS = 6 * 60 * 1000;   // -10 de satiété toutes les 6 minutes
export const PET_JOY_DECAY_MS = 4 * 60 * 1000;    // -10 de joie toutes les 4 minutes
export const TRICKS = [
  { id: 'assis', name: 'Assis !', trainings: 2 },
  { id: 'saute', name: 'Saute !', trainings: 4 },
  { id: 'tourne', name: 'Tourne !', trainings: 6 },
  { id: 'mort', name: 'Fais le mort !', trainings: 9 },
];

export function petStatus(pet, now) {
  const food = Math.max(0, Math.min(100, pet.food - Math.floor((now - pet.fedAt) / PET_FOOD_DECAY_MS) * 10));
  const joy = Math.max(0, Math.min(100, pet.joy - Math.floor((now - pet.joyAt) / PET_JOY_DECAY_MS) * 10));
  return { food, joy };
}
