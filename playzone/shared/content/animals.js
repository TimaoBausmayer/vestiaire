// Les 20 espèces de PLAYZONE et leur comportement. `area` = rectangle [x1, z1, x2, z2] où elles vivent.
// behavior : wander (se promène), graze (broute), peck (picore), flee (fuit le joueur), flock (groupe qui
// s'envole), fly (vole en cercles), swim (nage), bask (se dore au soleil, attaque si on approche),
// prowl (rôde en meute), follow (animal de compagnie).

// Animaux supplémentaires dans les nouveaux quartiers : [espèce, nombre, zone].
// Enclos du Zoo de PLAYZONE (x 15..165, z -1195..-1085) : [espèce, nombre, enclos, nom de l'enclos]
export const ZOO_PENS = [
  ['lion', 3, [30, -1190, 68, -1150], 'Savane des lions'], ['elephant', 2, [74, -1190, 112, -1150], 'Plaine des éléphants'], ['girafe', 3, [118, -1190, 160, -1150], 'Coin des girafes'],
  ['zebre', 4, [30, -1130, 68, -1090], 'Prairie des zèbres'], ['singe', 5, [74, -1130, 112, -1090], 'Île aux singes'], ['pingouin', 6, [118, -1130, 160, -1090], 'Banquise des pingouins'],
];
export const EXTRA_HERDS = [
  ...ZOO_PENS.map(([sp, n, [x1, z1, x2, z2]]) => [sp, n, [x1 + 2.5, z1 + 2.5, x2 - 2.5, z2 - 2.5]]),
  ['vache', 4, [-280, 12, -232, 46]], ['mouton', 5, [-280, 12, -232, 46]], ['cheval', 2, [-280, 12, -232, 46]],
  ['poulet', 5, [-258, -38, -236, -30]], ['cochon', 2, [-258, -38, -236, -30]],
  ['pigeon', 8, [-56, -226, -14, -202]], ['pigeon', 6, [150, 33, 198, 50]],
  ['chat', 3, [-128, -330, 128, -150]],
  ['rat', 3, [-284, -330, -150, -150]], ['lapin', 4, [-130, -415, 130, -345]], ['renard', 2, [-298, -134, -150, 50]],
  ['tortue', 2, [-290, 76, -150, 90]], ['requin', 1, [150, 110, 290, 135]],
];

export const SPECIES = {
  chien: { name: 'Chien', emoji: '🐕', behavior: 'wander', speed: 3.2, count: 0, area: [-22, -22, 22, 22], adoptable: true, sound: 'Wouf !', flee: 0 },
  chat: { name: 'Chat', emoji: '🐈', behavior: 'wander', speed: 2.2, count: 3, area: [60, -55, 125, 55], adoptable: true, sound: 'Miaou.', flee: 3 },
  pigeon: { name: 'Pigeon', emoji: '🐦', behavior: 'flock', speed: 1.4, count: 10, area: [-20, -20, 20, 20], sound: 'Rou-rou ?', flee: 4 },
  rat: { name: 'Rat', emoji: '🐀', behavior: 'flee', speed: 4, count: 4, area: [62, -124, 126, -64], adoptable: true, sound: 'Couic !', flee: 6 },
  lapin: { name: 'Lapin', emoji: '🐇', behavior: 'flee', speed: 4.5, count: 5, area: [-55, -124, 55, -66], adoptable: true, sound: '...', flee: 7 },
  renard: { name: 'Renard', emoji: '🦊', behavior: 'flee', speed: 5, count: 2, area: [-124, -124, -66, -66], sound: 'Ya-ya-ya !', flee: 9 },
  loup: { name: 'Loup', emoji: '🐺', behavior: 'prowl', speed: 3, count: 3, area: [-124, -124, -80, -80], sound: 'Aouuuh !', flee: 5 },
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
  // zoo de PLAYZONE (uniquement dans leurs enclos)
  lion: { name: 'Lion', emoji: '🦁', behavior: 'wander', speed: 1.6, count: 0, area: [0, 0, 1, 1], sound: 'ROAAAR ! (il bâille, en fait)', flee: 0 },
  elephant: { name: 'Éléphant', emoji: '🐘', behavior: 'graze', speed: 0.9, count: 0, area: [0, 0, 1, 1], sound: 'Pouuuuh ! 🎺', flee: 0 },
  girafe: { name: 'Girafe', emoji: '🦒', behavior: 'graze', speed: 1.1, count: 0, area: [0, 0, 1, 1], sound: '... (les girafes ne disent rien)', flee: 0 },
  zebre: { name: 'Zèbre', emoji: '🦓', behavior: 'graze', speed: 1.6, count: 0, area: [0, 0, 1, 1], sound: 'Hiii ! (en noir et blanc)', flee: 2 },
  singe: { name: 'Singe', emoji: '🐒', behavior: 'wander', speed: 3, count: 0, area: [0, 0, 1, 1], sound: 'Hou hou ha ha !', flee: 2 },
  pingouin: { name: 'Pingouin', emoji: '🐧', behavior: 'wander', speed: 0.8, count: 0, area: [0, 0, 1, 1], sound: 'Coin ? (non, ça c\'est le canard)', flee: 0 },
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
