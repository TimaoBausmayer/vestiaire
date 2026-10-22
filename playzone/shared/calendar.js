// CALENDRIER DES ÉVÉNEMENTS (partagé client / serveur, donc identique pour tout le monde).
// Chaque entrée est configurable : jours (0 = lundi), heures de jeu, lieu, prix, places, récompenses.
// Récurrence : `days` (chaque semaine), `monthDay` (une fois par mois de jeu, 0..27) ou `chance`
// (événement rare : tiré au sort de façon déterministe pour chaque jour, donc annoncé à l'avance).
import { gameDay, gameHour, realAt, weekday, dayOfMonth, DAYS_LONG, formatHour, HOUR_MS } from './clock.js';
import { hashString, mulberry32 } from './rng.js';
import { MINIGAME_SPOTS } from './world-layout.js';
import { PLAYGROUND } from './playground.js';

// Lieux (sur la carte) où se tiennent les événements.
export const VENUES = {
  place: { name: 'Grande Place', x: 0, z: 0 },
  circuit: { name: 'Circuit Turbo-Mamie', x: 175, z: -360 },
  stand: { name: 'Stand de tir Dédé la Gâchette', building: 'stand-tir' },
  tartes: { name: 'Stand de la Bataille de tartes (parc)', x: MINIGAME_SPOTS.pieToss.x, z: MINIGAME_SPOTS.pieToss.z },
  parcours: { name: 'Départ du parcours d\'obstacles (parc)', x: MINIGAME_SPOTS.obstacle.x, z: MINIGAME_SPOTS.obstacle.z },
  cour: { name: 'Parc des Tilleuls (jeux de cour)', x: PLAYGROUND.x - 8, z: PLAYGROUND.z - PLAYGROUND.d / 2 - 2 },
  poulets: { name: 'Enclos de la course de poulets (parc)', x: MINIGAME_SPOTS.chickenRace.x, z: MINIGAME_SPOTS.chickenRace.z },
};

// kind : public (événement de la Grande Place), range (concours de tir), minigame (tournoi d'un mini-jeu),
// karting, market, hide (cache-cache), laser, combat. Seules les activités réellement disponibles
// dans cette version sont listées (voir READY_KINDS).
export const CALENDAR = [
  { id: 'fete-poulets', kind: 'public', event: 'invasion', name: 'Pluie de poulets du dimanche', emoji: '🐔', days: [6], start: 15, end: 16, venue: 'place', price: 0,
    desc: 'Des dizaines de poulets tombent du ciel sur la Grande Place. Attrape-en le plus possible : les PNJ du quartier participent aussi !', rewards: { podium: [120, 70, 40] } },
  { id: 'dj-vendredi', kind: 'public', event: 'soiree-dj', name: 'Soirée DJ Patate', emoji: '🎧', days: [4, 5], start: 21, end: 22, venue: 'place', price: 0,
    desc: 'DJ Patate mixe sur la scène de la Place. Danse sur la piste (touches 1, 2, 3) : réputation et PlayCoins pour les meilleurs danseurs.', rewards: { podium: [60, 40, 20] } },
  { id: 'tir-du-soir', kind: 'range', name: 'Concours de tir du soir', emoji: '🎯', days: [0, 1, 2, 3, 4, 5, 6], start: 18, end: 20, venue: 'stand', price: 100,
    desc: 'Compétition au stand de tir : 40 secondes, 7 tireurs PNJ dont le niveau suit le tien. Prix 400 / 200 / 120 PC.', rewards: { podium: [400, 200, 120] } },
  { id: 'tournoi-tartes', kind: 'minigame', minigame: 'tartes', name: 'Tournoi de la Bataille de tartes', emoji: '🥧', days: [0, 2, 4, 6], start: 10, end: 13, venue: 'tartes', price: 0, register: true, places: 16,
    desc: 'Le meilleur score réalisé pendant le tournoi gagne. Classement du tournoi affiché en direct, prix à la fin.', rewards: { podium: [250, 120, 60] } },
  { id: 'tournoi-parcours', kind: 'minigame', minigame: 'parcours', name: 'Championnat du parcours d\'obstacles', emoji: '🏃', days: [1, 3, 5], start: 14, end: 17, venue: 'parcours', price: 0, register: true, places: 16,
    desc: 'Le meilleur chrono du créneau gagne. Les PNJ athlètes posent leurs temps aussi.', rewards: { podium: [250, 120, 60] } },
  { id: 'kart-promo', kind: 'karting', name: 'Karting : lundi à moitié prix', emoji: '🏎️', days: [0], start: 9, end: 18, venue: 'circuit', price: 0,
    desc: 'Karting libre gratuit et entraînements à −50 % (cumulable avec l\'adhésion). Idéal pour apprendre le circuit et battre ton meilleur tour.' },
  { id: 'course-jour', kind: 'karting', race: 'course-jour', name: 'Course de karting du jour', emoji: '🏁', days: [0, 1, 2, 3, 4, 5, 6], start: 12, end: 14, venue: 'circuit', price: 60,
    desc: '4 tours contre 5 pilotes PNJ (débutants à confirmés). Engagement 60 PC à l\'accueil, prix 150 / 80 / 40 PC.', rewards: { podium: [150, 80, 40] } },
  { id: 'kart-gp', kind: 'karting', race: 'kart-gp', name: 'Grand Prix de karting', emoji: '🏆', days: [4], start: 17, end: 21, venue: 'circuit', price: 150, register: true, places: 10,
    desc: '5 tours, grille de 7 pilotes PNJ dont un expert. Inscription 150 PC, podium 900 / 450 / 220 PC et titre de vainqueur.', rewards: { podium: [900, 450, 220] } },
  { id: 'kart-champ', kind: 'karting', race: 'kart-champ', name: 'Championnat de karting du mois', emoji: '🥇', monthDay: 20, start: 14, end: 20, venue: 'circuit', price: 250, register: true, places: 10,
    desc: 'Réservé aux adhérents (mensuelle ou premium). 6 tours contre l\'élite PNJ. Prix 2 000 / 1 000 / 500 PC.', rewards: { podium: [2000, 1000, 500] } },
  { id: 'marche-mardi', kind: 'market', market: 'alimentaire', name: 'Marché alimentaire', emoji: '🥕', days: [1], start: 7, end: 13, venue: 'place', price: 0,
    desc: 'Fruits, légumes, fromages, pain chaud : les maraîchers s\'installent sur la Grande Place. On peut négocier (poliment).' },
  { id: 'marche-mercredi', kind: 'market', market: 'vetements', name: 'Marché aux vêtements', emoji: '👕', days: [2], start: 9, end: 17, venue: 'place', price: 0,
    desc: 'Casquettes, lunettes, fins de série à petits prix. Les fripiers adorent marchander.' },
  { id: 'marche-nocturne', kind: 'market', market: 'nocturne', name: 'Marché nocturne', emoji: '🏮', days: [4], start: 20, end: 24, venue: 'place', price: 0,
    desc: 'Lampions, glaces, cocktails et quelques objets rares... sous les étoiles.' },
  { id: 'marche-samedi', kind: 'market', market: 'occasion', name: 'Marché d\'occasion', emoji: '🪑', days: [5], start: 8, end: 14, venue: 'place', price: 0,
    desc: 'Meubles, objets, accessoires auto d\'occasion : jusqu\'à −55 %. Mme Paillettes passe avec ses pièces rares.' },
  { id: 'grande-brocante', kind: 'market', market: 'brocante', name: 'Grande brocante du mois', emoji: '🧺', monthDay: 13, start: 8, end: 18, venue: 'place', price: 0,
    desc: 'Une fois par mois : huit stands, les meilleures affaires de la ville, et des objets rares.' },
  { id: 'cache-cache-jeudi', kind: 'minigame', minigame: 'cour-cachette', name: 'Grand cache-cache du jeudi', emoji: '🙈', days: [3], start: 14, end: 18, venue: 'cour', price: 0, register: true, places: 12,
    desc: 'Au parc des Tilleuls : celui ou celle qui tient le plus longtemps caché·e gagne. Les PNJ du quartier jouent aussi.', rewards: { podium: [300, 150, 80] } },
  { id: 'loup-du-dimanche', kind: 'minigame', minigame: 'cour-loup', name: 'Tournoi du loup', emoji: '🐺', days: [6], start: 10, end: 13, venue: 'cour', price: 0, register: true, places: 12,
    desc: 'Attrape le plus d\'habitants possible en 75 secondes. Meilleur score du créneau.', rewards: { podium: [250, 120, 60] } },
  { id: 'poulets-surprise', kind: 'minigame', minigame: 'poulets', name: 'Rodéo des poulets (surprise)', emoji: '🐓', chance: 0.25, start: 16, end: 18, venue: 'poulets', price: 0, register: true, places: 12,
    desc: 'Événement rare : la ferme lâche ses poulets. Ramène-en le plus possible dans l\'enclos pendant le créneau.', rewards: { podium: [300, 150, 80] } },
];
export const READY_KINDS = new Set(['public', 'range', 'minigame', 'karting', 'market']);
export const CAL_BY_ID = Object.fromEntries(CALENDAR.map((e) => [e.id, e]));

function happensOn(ev, day) {
  if (ev.days) return ev.days.includes(weekday(day));
  if (ev.monthDay !== undefined) return dayOfMonth(day) === ev.monthDay;
  if (ev.chance) return mulberry32(hashString(`${ev.id}#${day}`))() < ev.chance;
  return false;
}

// Occurrences entre deux instants réels : { occ, id, day, start, end (ms réels) }.
export function occurrences(fromMs, toMs, list = CALENDAR) {
  const out = [];
  for (let day = gameDay(fromMs) - 1; day <= gameDay(toMs); day++) {
    for (const ev of list) {
      if (!READY_KINDS.has(ev.kind) || !happensOn(ev, day)) continue;
      const start = realAt(day, ev.start), end = realAt(day, ev.end);
      if (end <= fromMs || start >= toMs) continue;
      out.push({ occ: `${ev.id}@${day}`, id: ev.id, day, start, end });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

export const parseOcc = (occ) => { const [id, d] = String(occ).split('@'); const day = Number(d); return CAL_BY_ID[id] && Number.isInteger(day) ? { ev: CAL_BY_ID[id], day, start: realAt(day, CAL_BY_ID[id].start), end: realAt(day, CAL_BY_ID[id].end) } : null; };
// Occurrence en cours pour une entrée (ou null).
export function liveOcc(id, now) {
  const ev = CAL_BY_ID[id];
  if (!ev) return null;
  return occurrences(now, now + 1, [ev]).find((o) => o.start <= now && now < o.end) || null;
}
// Occurrences en cours d'un type d'activité (ex. le tournoi du mini-jeu « tartes »).
export const liveOf = (pred, now) => occurrences(now, now + 1).filter((o) => o.start <= now && now < o.end && pred(CAL_BY_ID[o.id]));

export const occLabel = (o) => `${DAYS_LONG[weekday(o.day)]} ${formatHour(CAL_BY_ID[o.id].start)}–${formatHour(CAL_BY_ID[o.id].end % 24)}`;
export const minutesUntil = (ms, now) => Math.max(0, Math.round((ms - now) / 60_000));
export { HOUR_MS, gameHour };
