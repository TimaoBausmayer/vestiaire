// AUTORITÉ — ATHLÈTE ET CARRIÈRES : choix de la spécialité (sprint / endurance / polyvalent),
// progression en courant en ville (mètres plafonnés par le temps réel), salaire de sponsor du jour.
import { PROFILS, runGain, RUN_CAP } from './athlete.js';
import { dailySalary, salaryClaimable, careerDiv } from './career.js';
import { SPORT_CLUBS, STARS, CLUB_WEEK, clubOf, myClub } from './clubs.js';
import { todayKey } from './rules.js';
import { applyNeeds, needsStatus, NEED_KEYS } from './needs.js';
export const RESTORE_PRICE = { faim: 1.5, energie: 2, humeur: 1.5, hygiene: 1, sante: 2 };   // PC par point manquant
import { taxiPrice } from './taxi.js';
import { BUILDINGS } from './world-layout.js';
export const CLAW = { price: 5, prizes: { 'peluche-coeur': { name: 'Peluche cœur (cadeau d\'amour +12)', coins: 0 }, 'peluche-poulet': { name: 'Peluche poulet géante (meuble)', coins: 0 }, ticket: { name: 'Capsule jackpot', coins: 120 } } };
import { inBounds, groundHeight, WATER_LEVEL } from './world-layout.js';

const err = (error) => ({ ok: false, error });
const MAX_RUN_SPEED = 12;   // m/s : personne ne court plus vite

export const ATHLETE_HANDLERS = {
  'athle.profil'(ctx, { profil }) {
    const p = ctx.profile, b = p.body;
    if (!PROFILS[profil]) return err('Spécialité inconnue.');
    if (b.profil === profil) return err('C\'est déjà ta spécialité.');
    // on peut changer une fois par jour de jeu (le corps a besoin de temps pour s'adapter)
    const day = todayKey(ctx.now);
    if (b.profilDay === day && !p.admin) return err('Tu as déjà changé de spécialité aujourd\'hui. Reviens demain !');
    b.profil = profil; b.profilDay = day;
    return { ok: true, changed: true, data: { profil } };
  },

  // mètres courus depuis le dernier envoi (le sprint compte double côté client, plafonné ici)
  'athle.run'(ctx, { meters }) {
    const p = ctx.profile, b = p.body, s = ctx.session;
    const last = s.lastRun || ctx.now - 10_000;
    s.lastRun = ctx.now;
    const secs = Math.max(0, (ctx.now - last) / 1000);
    const m = Math.max(0, Math.min(RUN_CAP, secs * MAX_RUN_SPEED * 2, Number(meters) || 0));
    if (m < 20) return { ok: true, changed: false, data: { meters: 0 } };
    if (b.injury) return { ok: true, changed: false, data: { meters: 0 } };
    const gn = runGain(b, m);
    b.endurance = Math.min(100, (b.endurance ?? 15) + gn.endurance);
    b.vitesse = Math.min(100, (b.vitesse ?? 10) + gn.vitesse);
    b.weight = Math.max(45, b.weight - m / 1000 * 0.12);             // courir fait maigrir
    const f = p.sports?.foot;
    if (f?.skills) f.skills.vitesse = Math.min(100, Math.round((f.skills.vitesse + gn.vitesse * 0.4) * 100) / 100);
    applyNeeds(p.needs, ctx.now, { energie: -m / 250, faim: -m / 400, hygiene: -m / 300 });
    p.stats.runMeters = (p.stats.runMeters || 0) + m;
    return { ok: true, changed: true, data: { meters: m, endurance: b.endurance, vitesse: b.vitesse } };
  },

  // CLUBS : rejoindre (ou renouveler la cotisation d'une semaine) un club d'un sport ; le quitter
  'club.join'(ctx, { sport, club }) {
    const p = ctx.profile, c = clubOf(sport, club);
    if (!c) return err('Club inconnu.');
    const S = STARS[c.stars], div = careerDiv(p, sport);
    if (div.i < S.need && !p.admin) return err(`${c.name} ne recrute qu'à partir de la division ${['Amateur', 'Régional', 'National', 'Pro'][S.need]} (tu es ${div.name}). Gagne des compétitions !`);
    const fee = p.admin ? 0 : S.fee;
    if (p.coins < fee) return err(`La cotisation coûte ${fee} PC par semaine.`);
    this.addCoins(p, -fee);
    p.clubs = p.clubs || {};
    const cur = p.clubs[sport];
    const from = cur && cur.id === club && cur.until > ctx.now ? cur.until : ctx.now;
    p.clubs[sport] = { id: club, until: from + CLUB_WEEK, since: cur?.id === club ? cur.since : ctx.now };
    return { ok: true, changed: true, data: { club: c.name, fee, until: p.clubs[sport].until } };
  },
  'club.leave'(ctx, { sport }) {
    const p = ctx.profile;
    if (!p.clubs?.[sport]) return err('Tu n\'as pas de club dans ce sport.');
    delete p.clubs[sport];
    return { ok: true, changed: true, data: {} };
  },

  // TAXI : on est déposé tout de suite (pas depuis la prison ni pendant une poursuite)
  'taxi.ride'(ctx, { x, z }) {
    const p = ctx.profile;
    if (typeof x !== 'number' || typeof z !== 'number' || !inBounds(x, z) || groundHeight(x, z) < WATER_LEVEL) return err('Le taxi ne va pas là-bas.');
    if (p.justice?.jail) return err('Pas de taxi depuis la prison !');
    if ((p.justice?.stars || 0) > 0 && !p.admin) return err('Recherché·e par la police : aucun taxi ne veut te prendre !');
    const dist = ctx.pos ? Math.hypot(ctx.pos.x - x, ctx.pos.z - z) : 0;
    const price = p.admin ? 0 : taxiPrice(dist);
    if (p.coins < price) return err(`La course coûte ${price} PC.`);
    this.addCoins(p, -price);
    if (ctx.pos) { ctx.pos.x = x; ctx.pos.z = z; }
    return { ok: true, changed: true, data: { price } };
  },

  // RESTAURER ses jauges en payant (faim, énergie, humeur, propreté, santé) — gratuit pour l'admin
  'needs.restore'(ctx, { need }) {
    const p = ctx.profile, st = needsStatus(p.needs, ctx.now);
    const list = need === 'all' ? [...NEED_KEYS, 'sante'] : [need];
    if (!list.every((k) => RESTORE_PRICE[k])) return err('Jauge inconnue.');
    let cost = 0;
    const missing = {};
    for (const k of list) { const v = k === 'sante' ? p.body.health : st[k]; const m = Math.max(0, 100 - v); missing[k] = m; cost += m * RESTORE_PRICE[k]; }
    cost = p.admin ? 0 : Math.ceil(cost);
    if (cost <= 0 && !p.admin && Object.values(missing).every((m) => m < 0.5)) return err('Déjà au maximum !');
    if (p.coins < cost) return err(`Il faut ${cost} PC.`);
    this.addCoins(p, -cost);
    const delta = {};
    for (const k of list) { if (k === 'sante') p.body.health = Math.max(p.body.health, 100 - (p.body.injury ? 30 : 0)); else delta[k] = missing[k]; }
    applyNeeds(p.needs, ctx.now, delta);
    return { ok: true, changed: true, data: { cost, needs: needsStatus(p.needs, ctx.now) } };
  },

  // JEU DE PINCE (salles d'arcade) : une partie payée, le client joue, l'autorité valide le lot
  'claw.start'(ctx) {
    const p = ctx.profile;
    if (!BUILDINGS.some((b) => b.interior === 'arcade' && this.atBuilding(ctx, b, 2))) return err('Il faut être dans une salle d\'arcade.');
    const cost = p.admin ? 0 : CLAW.price;
    if (p.coins < cost) return err(`Une partie coûte ${CLAW.price} PC.`);
    this.addCoins(p, -cost);
    ctx.session.claw = { at: ctx.now };
    return { ok: true, changed: true, data: { cost } };
  },
  'claw.end'(ctx, { prize }) {
    const p = ctx.profile, s = ctx.session.claw;
    if (!s) return err('Aucune partie.');
    ctx.session.claw = null;
    const secs = (ctx.now - s.at) / 1000;
    if (!prize || !CLAW.prizes[prize] || secs < 2.5) { applyNeeds(p.needs, ctx.now, { humeur: 2 }); return { ok: true, changed: true, data: { prize: null } }; }
    const P = CLAW.prizes[prize];
    if (P.coins) this.addCoins(p, P.coins); else p.inventory[prize] = (p.inventory[prize] || 0) + 1;
    applyNeeds(p.needs, ctx.now, { humeur: 15 });
    p.stats.claw = (p.stats.claw || 0) + 1;
    return { ok: true, changed: true, data: { prize, name: P.name } };
  },

  'career.salary'(ctx) {
    const p = ctx.profile;
    if (!salaryClaimable(p, ctx.now)) return err(dailySalary(p, ctx.now) ? 'Salaire du jour déjà touché. Reviens demain !' : 'Pas encore de sponsor : monte en division Régionale dans un sport.');
    const amount = dailySalary(p, ctx.now);
    p.career = p.career || {};
    p.career.salaryDay = todayKey(ctx.now);
    this.addCoins(p, amount);
    return { ok: true, changed: true, data: { amount } };
  },
};
