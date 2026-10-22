// AUTORITÉ — KARTING : adhésions, sessions (libre / entraînement), courses (du jour, Grand Prix,
// championnat). Les tours sont validés ici à partir des positions (portes de chronométrage dans
// l'ordre, temps minimal), le classement est calculé contre les pilotes PNJ de la grille.
import { BUILDING_BY_ID } from './world-layout.js';
import { CYCLE_MS, gameWeek, gameDay } from './clock.js';
import { liveOcc, liveOf } from './calendar.js';
import { calTime } from './authority-calendar.js';
import { randInt } from './rng.js';
import { recordActivity } from './rules.js';
import {
  GATES, GATE_R, MIN_LAP, COUNTDOWN, KARTS, MEMBERSHIPS, FORMULAS, RACES, raceField, sessionPrice, memberOk,
} from './karting.js';

const err = (error) => ({ ok: false, error });
const RACES_PER_HOUR = 4;
export function defaultKarting() { return { member: null, best: null, laps: 0, races: 0, wins: 0, podiums: 0, history: [] }; }
const atStand = (self, ctx) => self.atBuilding(ctx, BUILDING_BY_ID['circuit-stand'], 2);
const member = (p, now) => (p.karting.member && p.karting.member.until > now ? p.karting.member : null);
const promoLive = (ctx) => !!liveOcc('kart-promo', calTime(ctx));

// Course du calendrier en cours pour cette formule de course (occurrence) ou null.
function raceOcc(ctx, raceId) { return liveOf((e) => e.kind === 'karting' && e.race === raceId, calTime(ctx))[0] || null; }

function newState(ctx, mode, extra) {
  return { mode, startedAt: ctx.now, next: 0, passed: 0, lapStart: null, laps: [], best: null, ...extra };
}

// Appelé à chaque position validée : progression dans les portes, tours chronométrés.
export function kartOnPosition(ctx) {
  const k = ctx.session.kart, pos = ctx.pos;
  if (!k || !pos || ctx.now < (k.green || 0)) return;
  if (k.until && ctx.now > k.until + 5000) return;
  const g = GATES[k.next];
  if (Math.hypot(pos.x - g.x, pos.z - g.z) > GATE_R) return;
  if (k.next === 0) {
    if (k.passed >= GATES.length - 1 && k.lapStart !== null) {
      const lap = (ctx.now - k.lapStart) / 1000;
      if (lap >= MIN_LAP) {
        k.laps.push(Math.round(lap * 100) / 100);
        if (k.best === null || lap < k.best) k.best = Math.round(lap * 100) / 100;
      }
    }
    // en course, le premier passage de la ligne (depuis la grille) ne remet pas le chrono à zéro
    if (!(k.mode === 'race' && k.laps.length === 0 && k.lapStart !== null && k.passed === 0)) k.lapStart = ctx.now;
    k.passed = 0;
    k.next = 1;
  } else {
    k.passed++;
    k.next = (k.next + 1) % GATES.length;
  }
}

export const KARTING_HANDLERS = {
  'kart.member'(ctx, { kind }) {
    const p = ctx.profile, M = MEMBERSHIPS[kind];
    if (!M) return err('Formule inconnue.');
    if (!atStand(this, ctx)) return err('Les adhésions se prennent à l\'accueil du circuit.');
    if (p.coins < M.price) return err(`Pas assez de PlayCoins (${M.price} PC).`);
    this.addCoins(p, -M.price);
    const cur = member(p, ctx.now);
    const from = cur && cur.kind === kind ? cur.until : ctx.now;
    p.karting.member = { kind, until: from + M.days * CYCLE_MS };
    return { ok: true, changed: true, data: { member: p.karting.member } };
  },

  'kart.start'(ctx, { formula, kart = 'kart' }) {
    const p = ctx.profile, F = FORMULAS[formula], K = KARTS[kart];
    if (!F || !K) return err('Formule inconnue.');
    if (!atStand(this, ctx)) return err('Inscris-toi à l\'accueil du circuit.');
    if (ctx.session.kart) return err('Une session est déjà en cours.');
    const m = member(p, ctx.now);
    if (K.need && !memberOk(m, K.need, ctx.now) && !K.extra) return err(`${K.name} : réservé aux adhérents ${MEMBERSHIPS[K.need].name.toLowerCase()}.`);
    const promo = promoLive(ctx);
    let price = formula === 'libre' && promo ? 0 : sessionPrice(F.price, m, promo);
    if (K.need && !memberOk(m, K.need, ctx.now)) price += K.extra;
    if (p.coins < price) return err(`Pas assez de PlayCoins (${price} PC).`);
    this.addCoins(p, -price);
    ctx.session.kart = newState(ctx, 'session', { formula, kart, until: ctx.now + F.minutes * 60_000, timed: F.timed });
    return { ok: true, changed: true, data: { price, minutes: F.minutes, promo, until: ctx.session.kart.until } };
  },

  'kart.race'(ctx, { race, kart = 'kart' }) {
    const p = ctx.profile, R = RACES[race], K = KARTS[kart];
    if (!R || !K) return err('Course inconnue.');
    if (!atStand(this, ctx)) return err('Inscris-toi à l\'accueil du circuit.');
    if (ctx.session.kart) return err('Une session est déjà en cours.');
    const o = raceOcc(ctx, race);
    if (!o) return err(`${R.name} : pas de départ en ce moment. Les horaires sont dans l'Agenda.`);
    const m = member(p, ctx.now);
    if (R.member && !memberOk(m, R.member, ctx.now)) return err(`${R.name} : réservé aux adhérents (adhésion mensuelle ou premium).`);
    if (K.need && !memberOk(m, K.need, ctx.now)) return err(`${K.name} : réservé aux adhérents.`);
    const needsReg = race !== 'course-jour';
    if (needsReg && !p.calendar.reg[o.occ]) return err('Inscription obligatoire (Agenda du téléphone ou accueil).');
    const recent = (p.activity['kart:race'] || []).filter((t) => ctx.now - t < 3600_000);
    if (recent.length >= RACES_PER_HOUR) return err('Les commissaires font une pause : pas plus de 4 courses par heure.');
    if (!needsReg) {
      if (p.coins < R.fee) return err(`Engagement : ${R.fee} PC.`);
      this.addCoins(p, -R.fee);
    }
    recordActivity(p, 'kart:race', ctx.now);
    const seed = randInt(ctx.rand, 1, 2 ** 31 - 2);
    const green = ctx.now + COUNTDOWN * 1000;
    ctx.session.kart = newState(ctx, 'race', { race, kart, seed, occ: o.occ, green, lapStart: green, until: green + 6 * 60_000 });
    return { ok: true, changed: true, data: { seed, green, countdown: COUNTDOWN, laps: R.laps, field: raceField(seed, race) } };
  },

  // Fin de session ou de course : chronos validés, classement, récompenses.
  'kart.finish'(ctx) {
    const p = ctx.profile, k = ctx.session.kart;
    if (!k) return err('Aucune session de karting.');
    ctx.session.kart = null;
    const st = p.karting;
    st.laps += k.laps.length;
    let record = false;
    if (k.best !== null && (st.best === null || k.best < st.best)) { st.best = k.best; record = true; }
    if (k.best !== null && ctx.leaderboard) {
      ctx.leaderboard.submit('kart', p, k.best, true);
      ctx.leaderboard.submit(`kart:w${gameWeek(gameDay(calTime(ctx)))}`, p, k.best, true);
    }
    if (k.mode !== 'race') return { ok: true, changed: true, data: { mode: 'session', laps: k.laps, best: k.best, record, bestEver: st.best } };
    const R = RACES[k.race];
    const field = raceField(k.seed, k.race);
    const finished = k.laps.length >= R.laps;
    const total = finished ? Math.round(k.laps.slice(0, R.laps).reduce((s, x) => s + x, 0) * 100) / 100 : null;
    const ranking = [...field.map((d) => ({ name: d.name, level: d.level, time: d.laps[R.laps - 1], npc: true })), { name: p.name, time: total, me: true }]
      .sort((a, b) => (a.time ?? 1e9) - (b.time ?? 1e9));
    const place = finished ? ranking.findIndex((x) => x.me) + 1 : null;
    const prize = place ? R.prizes[place - 1] || 0 : 0;
    st.races++;
    if (place === 1) { st.wins++; p.rep += 4; const t = `Vainqueur : ${R.name}`; if (!p.titles.includes(t)) p.titles.push(t); }
    if (place && place <= 3) st.podiums++;
    if (prize) this.addCoins(p, prize);
    st.history.push({ race: k.race, place, of: ranking.length, total, best: k.best, prize, at: ctx.now });
    if (st.history.length > 20) st.history.shift();
    if (k.occ && p.calendar.reg[k.occ]) p.calendar.claimed[k.occ] = true;
    if (k.occ) { p.calendar.history.push({ id: k.race, occ: k.occ, place, of: ranking.length, prize, at: ctx.now }); if (p.calendar.history.length > 30) p.calendar.history.shift(); }
    const lv = this.addXp(p, 15 + (place ? Math.max(0, 8 - place) * 5 : 0));
    return { ok: true, changed: true, data: { mode: 'race', race: k.race, place, prize, total, laps: k.laps, best: k.best, record, ranking, ...lv } };
  },
  'kart.cancel'(ctx) { ctx.session.kart = null; return { ok: true, data: {} }; },
};
