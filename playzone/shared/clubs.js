// CLUBS SPORTIFS : pour chaque sport (sauf la F1, qui a son Académie), 4 clubs de réputations
// différentes (★ à ★★★★★). Un petit club accueille tout le monde gratuitement ; un grand club exige
// une division de carrière et une cotisation hebdomadaire, mais rapporte bien plus : points de
// carrière, primes, prime de club quotidienne, coéquipiers plus forts au foot.
import { CYCLE_MS } from './clock.js';

export const CLUB_WEEK = CYCLE_MS * 7;
// conditions et avantages selon la réputation (étoiles)
export const STARS = {
  1: { need: 0, fee: 0, pts: 1, prize: 1, daily: 0, mate: 0 },
  2: { need: 0, fee: 40, pts: 1.1, prize: 1.05, daily: 0, mate: 0.04 },
  3: { need: 1, fee: 150, pts: 1.25, prize: 1.15, daily: 60, mate: 0.08 },
  4: { need: 2, fee: 400, pts: 1.4, prize: 1.3, daily: 150, mate: 0.13 },
  5: { need: 3, fee: 900, pts: 1.6, prize: 1.5, daily: 350, mate: 0.2 },
};

const C = (id, name, stars, site = null, desc = '') => ({ id, name, stars, site, desc });
export const SPORT_CLUBS = {
  foot: [
    C('mouettes', 'FC des Mouettes', 1, 'club-foot-mouettes', 'Club de quartier convivial, on joue pour le plaisir.'),
    C('desert', 'Dunes Sporting Club', 2, 'club-foot-desert', 'Petit club ambitieux du désert.'),
    C('nordville', 'Olympique de Nordville', 3, 'club-foot-nordville', 'Club formateur réputé du nord.'),
    C('arena', 'Racing Club de l\'Arène', 4, 'club-foot-arena', 'Habitué des premières places.'),
    C('crampons', 'FC Crampons (Stade des Crampons)', 5, 'club-foot', 'Le grand club de la ville : tribunes pleines, champions.'),
  ],
  course: [
    C('foulees', 'Les Foulées du Port', 1, null, 'Footings du dimanche entre amis.'),
    C('gazelles', 'Les Gazelles des Hauts', 2, null, 'Club de quartier sérieux.'),
    C('ac-crampons', 'Athlétic Club des Crampons', 4, 'club-foot', 'Piste officielle, entraîneurs diplômés.'),
    C('elite-run', 'PLAYZONE Running Élite', 5, null, 'Les meilleurs marathoniens et sprinteurs.'),
  ],
  velo: [
    C('pedale-douce', 'Vélo Club Pédale Douce', 1, 'club-foot', 'Sorties tranquilles.'),
    C('mollets', 'Les Mollets d\'Acier', 2, null, 'On roule vite le samedi.'),
    C('peloton', 'Peloton des Hauts', 3, null, 'Équipe régionale.'),
    C('team-pz', 'Team PLAYZONE Pro Cycling', 5, null, 'Équipe pro, maillots brillants.'),
  ],
  route: [
    C('cols-loisir', 'Cyclo des Cols', 1, 'bike-park', 'Balades en montagne.'),
    C('grimpeurs', 'Les Grimpeurs Fous', 3, null, 'Spécialistes des cols.'),
    C('route-elite', 'Route Élite Géants', 4, null, 'Course sur route de haut niveau.'),
    C('maillot-jaune', 'Équipe Maillot Jaune', 5, null, 'Les rois de la route.'),
  ],
  vtt: [
    C('boue', 'Les Pieds dans la Boue', 1, 'bike-park', 'VTT du dimanche.'),
    C('enduro', 'Enduro des Géants', 2, null, 'Descentes engagées.'),
    C('freeride', 'Freeride Crew', 3, null, 'Sauts et figures.'),
    C('vtt-pro', 'Géants VTT Factory', 5, null, 'Équipe usine.'),
  ],
  karting: [
    C('kart-loisir', 'Kart Loisir', 1, 'circuit-stand', 'Pour découvrir.'),
    C('kart-club', 'Karting Club PLAYZONE', 2, 'circuit-stand', 'Le club du circuit.'),
    C('kart-racing', 'Racing Kart Team', 4, null, 'Écurie de compétition.'),
    C('kart-elite', 'Futurs Champions F1', 5, null, 'L\'antichambre de la F1.'),
  ],
  ski: [
    C('chasse-neige', 'Club Chasse-Neige', 1, null, 'Pour les débutants.'),
    C('mont-pinard', 'Ski Club du Mont-Pinard', 3, null, 'Club historique de la station.'),
    C('freestyle', 'Freestyle Pinard', 4, null, 'Snowpark et big air.'),
    C('equipe-ski', 'Équipe Nationale de Ski', 5, null, 'Slalom et descente de haut niveau.'),
  ],
  jetski: [
    C('vagues', 'Les Vagues Tranquilles', 1, 'surf-shop', 'Balades en mer.'),
    C('jet-club', 'Jet Club des Villas', 2, 'surf-shop', 'Courses du dimanche.'),
    C('aqua-racing', 'Aqua Racing', 4, null, 'Équipe de course.'),
    C('jet-pro', 'Jet Pro Tour', 5, null, 'Circuit professionnel.'),
  ],
  tennis: [
    C('tilleuls', 'Tennis des Tilleuls', 1, 'tennis-3', 'Gazon et bonne humeur.'),
    C('affaires', 'Tennis Club des Affaires', 3, 'tennis-1', 'Club des cadres sportifs.'),
    C('roland', 'Roland-Gros-Pull', 4, 'tennis-2', 'Terre battue et tradition.'),
    C('academie-tennis', 'Académie Grand Chelem', 5, null, 'Les futurs champions.'),
  ],
  natation: [
    C('canards', 'Les Canards du Port', 1, 'piscine', 'Nage loisir.'),
    C('dauphins', 'Les Dauphins', 2, 'piscine', 'Club de compétition jeunes.'),
    C('olympique', 'Cercle Olympique de Natation', 4, 'piscine', 'Nageurs nationaux.'),
    C('requins', 'Les Requins Élite', 5, null, 'Champions de 50 m.'),
  ],
  golf: [
    C('trou-rigolo', 'Les Amis du Trou Rigolo', 1, 'minigolf', 'Pour rigoler.'),
    C('putt', 'Putt Club', 2, 'minigolf', 'Joueurs réguliers.'),
    C('green', 'Green Masters', 3, null, 'Concours mensuels.'),
    C('golf-pro', 'Mini-Golf Pro Tour', 5, null, 'Circuit professionnel.'),
  ],
  surf: [
    C('orteils', 'Surf Club des Orteils', 1, 'surf-school', 'L\'école de la plage : on apprend en rigolant.'),
    C('mouettes-surf', 'Les Mouettes Surfeuses', 2, null, 'Les locaux du spot.'),
    C('reef', 'Reef Riders', 4, null, 'Spécialistes du récif et des tubes.'),
    C('pro-surf', 'PLAYZONE Pro Surf Team', 5, null, 'Les champions du tour mondial.'),
  ],
  boxe: [
    C('punching', 'Le Punching-Ball', 1, 'boxe-6', 'Boxe loisir.'),
    C('gants-or', 'Les Gants d\'Or', 3, 'boxe-2', 'Champions régionaux.'),
    C('nordville-box', 'Ring de Nordville', 4, 'boxe-3', 'Combattants aguerris.'),
    C('prestige-box', 'Prestige Boxing', 5, 'boxe-4', 'Écurie des champions.'),
  ],
};
export const clubOf = (sport, id) => SPORT_CLUBS[sport]?.find((c) => c.id === id) || null;
// club actif (cotisation à jour) d'un joueur pour un sport
export function myClub(p, sport, now) {
  const m = p.clubs?.[sport];
  if (!m) return null;
  const c = clubOf(sport, m.id);
  if (!c) return null;
  if (STARS[c.stars].fee && m.until < now && !p.admin) return null;
  return c;
}
export const clubPerks = (p, sport, now) => STARS[myClub(p, sport, now)?.stars || 0] || { pts: 1, prize: 1, daily: 0, mate: 0, need: 0, fee: 0 };
export const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
