// SPORTS : règles pures partagées (client + autorité). Football d'abord : stade, club gratuit,
// entraînements gratuits, matchs contre des équipes PNJ, progression (compétences, endurance, niveau).
// Les compétences montent en pratiquant : plus on joue, meilleur on devient.

// Stade des Crampons (Les Hauts, au nord de l'Avenue de Prestige). Longueur le long de X.
export const PITCH = { x: 450, z: -560, w: 64, d: 40, goalW: 7.3, goalH: 2.44, box: 12 };
export const PITCH_RECT = [PITCH.x - PITCH.w / 2 - 16, PITCH.z - PITCH.d / 2 - 12, PITCH.x + PITCH.w / 2 + 16, PITCH.z + PITCH.d / 2 + 22];
export const inPitch = (x, z, m = 0) => Math.abs(x - PITCH.x) <= PITCH.w / 2 + m && Math.abs(z - PITCH.z) <= PITCH.d / 2 + m;

export const FOOT_SKILLS = { tir: 'Tir', dribble: 'Dribble', passe: 'Passe', vitesse: 'Vitesse' };
export const FOOT_LEVELS = [
  { id: 'debutant', name: 'Débutant', xp: 0 },
  { id: 'amateur', name: 'Amateur', xp: 150 },
  { id: 'regional', name: 'Régional', xp: 450 },
  { id: 'semipro', name: 'Semi-pro', xp: 1000 },
  { id: 'pro', name: 'Pro', xp: 2000 },
  { id: 'star', name: 'Star du ballon rond', xp: 3600 },
];
export function footLevel(xp = 0) {
  let i = 0;
  while (i + 1 < FOOT_LEVELS.length && xp >= FOOT_LEVELS[i + 1].xp) i++;
  return { i, ...FOOT_LEVELS[i], next: FOOT_LEVELS[i + 1] || null };
}
export const levelIndex = (id) => FOOT_LEVELS.findIndex((l) => l.id === id);

// Entraînements (gratuits). score : 0..max, gains selon le score.
export const DRILLS = {
  tirs: { name: 'Tirs au but', desc: '10 ballons face au gardien PNJ. Vise les coins !', max: 10, skill: 'tir', min: 15, icon: '🥅' },
  slalom: { name: 'Slalom balle au pied', desc: 'Passe les 8 portes sans perdre le ballon, le plus vite possible.', max: 10, skill: 'dribble', min: 12, icon: '🚧' },
  passes: { name: 'Passes en mouvement', desc: 'Passe le ballon aux coéquipiers qui s\'allument (12 passes).', max: 12, skill: 'passe', min: 15, icon: '🎯' },
  sprints: { name: 'Sprints et endurance', desc: 'Allers-retours sur la largeur du terrain (6 sprints chronométrés).', max: 10, skill: 'vitesse', min: 15, icon: '🏃' },
};

// Matchs. mins = durée en minutes réelles ; size = joueurs par équipe (toi compris).
export const MATCHES = {
  amical: { name: 'Petit match amical', mins: 3, size: 4, need: 'debutant', prize: 0, xp: [30, 18, 10], desc: 'Contre des joueurs PNJ de ton niveau. Gratuit.' },
  organise: { name: 'Match organisé par toi', mins: 3, size: 5, need: 'debutant', prize: 0, xp: [30, 18, 10], desc: 'Tu choisis le niveau des adversaires et tu invites du monde.' },
  championnat: { name: 'Match de championnat', mins: 4, size: 5, need: 'amateur', prize: 300, xp: [70, 40, 20], desc: 'Compte pour le classement du club. Prime de victoire.' },
  gros: { name: 'Gros match (tribunes pleines)', mins: 5, size: 5, need: 'semipro', prize: 1500, xp: [150, 80, 40], desc: 'Finale de coupe devant le public. Grosse prime.' },
};
export const TEAMS = ['FC Pigeons', 'Olympique Navets', 'Racing Croissant', 'AS Pantoufle', 'Sporting Tartiflette', 'Dynamo Camembert', 'Real Mamie', 'Inter Baguette'];

// Force des PNJ (0..1) : selon ton niveau et le type de match (ou le choix de l'organisateur).
export function aiStrength(levelI, kind, pick = null) {
  if (pick !== null && pick !== undefined) return Math.max(0.15, Math.min(1, pick));
  const base = 0.2 + levelI * 0.13;
  return Math.min(1, base + (kind === 'gros' ? 0.12 : kind === 'championnat' ? 0.06 : 0));
}

// Gains d'un entraînement ou d'un match : compétence (+), endurance (+), XP foot.
export function drillGain(drill, score) {
  const d = DRILLS[drill];
  const r = Math.max(0, Math.min(1, score / d.max));
  return { skill: d.skill, amount: 0.6 + r * 2.4, endurance: 0.8 + r * 0.8, xp: Math.round(6 + r * 14) };
}
export const SKILL_MAX = 100;
export function defaultFoot() {
  return { club: false, xp: 0, skills: { tir: 10, dribble: 10, passe: 10, vitesse: 10 }, matches: 0, wins: 0, draws: 0, losses: 0, goals: 0, trophies: 0, trainings: 0, history: [] };
}
