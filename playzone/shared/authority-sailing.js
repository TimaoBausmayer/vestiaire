// AUTORITÉ — VOILE ET KITESURF (Club du Cap Venteux) : essai gratuit par support, location, licence
// du club, bateaux possédés (navigation partout), sauts de kite notés, dessalages comptés.
import { BOATS, SAIL_MEMBER, SAIL_JUMP_MUL, defaultSail, ownsBoat } from './sailing.js';
import { windAtPos, maxJump, jumpPoints } from './wingfoil.js';
import { BUILDING_BY_ID, groundHeight, WATER_LEVEL } from './world-layout.js';
import { calTime } from './authority-calendar.js';
import { levelFromXp } from './rules.js';

const err = (error) => ({ ok: false, error });
const sailOf = (p) => { p.sports.sail = { ...defaultSail(), ...(p.sports.sail || {}) }; return p.sports.sail; };
const atClub = (self, ctx) => self.atBuilding(ctx, BUILDING_BY_ID['club-voile'], 8);

export const SAILING_HANDLERS = {
  'sail.member'(ctx) {
    const p = ctx.profile, S = sailOf(p);
    if (!atClub(this, ctx)) return err('La licence se prend au club-house du Cap Venteux.');
    const cost = p.admin ? 0 : SAIL_MEMBER.price;
    if (p.coins < cost) return err(`La licence coûte ${cost} PC.`);
    this.addCoins(p, -cost);
    S.member = { until: Math.max(ctx.now, S.member?.until || 0) + SAIL_MEMBER.days * 24 * 3600_000 };
    return { ok: true, changed: true, data: { until: S.member.until } };
  },
  // at : mise à l'eau sur place (au club ou, avec son propre bateau, n'importe où au bord de l'eau)
  'sail.start'(ctx, { boat, at }) {
    const p = ctx.profile, B = BOATS[boat], S = sailOf(p);
    if (!B) return err('Support inconnu.');
    if (p.body?.injury) return err('Tu es blessé·e : repos d\'abord.');
    if (p.justice?.jail) return err('Pas depuis la prison !');
    if (B.level && levelFromXp(p.xp) < B.level) return err(`Niveau ${B.level} requis pour le ${B.name}.`);
    const own = ownsBoat(p, boat), club = atClub(this, ctx);
    if (!club && !own) return err('Va au club du Cap Venteux (ou achète ton bateau à la voilerie).');
    if (!at || typeof at.x !== 'number' || typeof at.z !== 'number' || groundHeight(at.x, at.z) > WATER_LEVEL - 1) return err('Il faut de l\'eau profonde pour naviguer.');
    if (ctx.pos && Math.hypot(ctx.pos.x - at.x, ctx.pos.z - at.z) > 180) return err('Approche-toi de l\'eau.');
    let mode = 'own', paid = 0;
    if (!own) {
      const member = S.member && S.member.until > ctx.now;
      if (member || p.admin) mode = 'club';
      else if (!S.trials.includes(boat)) { S.trials.push(boat); mode = 'trial'; }
      else { if (p.coins < B.rent) return err(`Location du ${B.name} : ${B.rent} PC.`); this.addCoins(p, -B.rent); paid = B.rent; mode = 'rent'; }
    }
    if (ctx.pos) { ctx.pos.x = at.x; ctx.pos.z = at.z; }
    S.sessions++;
    const wind = windAtPos(calTime(ctx), at.x, at.z);
    ctx.session.sail = { boat, at: ctx.now, lastJump: 0, kts: wind.kts };
    return { ok: true, changed: true, data: { mode, paid, wind, skill: S.skill } };
  },
  'sail.jump'(ctx, { height, air, spins, flips }) {
    const p = ctx.profile, S = sailOf(p), s = ctx.session.sail;
    if (!s || !BOATS[s.boat]?.kite) return err('Pas en kite.');
    if (ctx.now - s.lastJump < 1200) return err('Trop rapide.');
    s.lastJump = ctx.now;
    height = Math.max(0, Math.min(maxJump(s.kts) * SAIL_JUMP_MUL, Number(height) || 0));
    air = Math.max(0, Math.min(2 * Math.sqrt((2 * height) / 9.8) + 0.6, Number(air) || 0));
    spins = Math.max(0, Math.min(Math.floor(air * 1.6), Math.floor(Number(spins) || 0)));
    flips = Math.max(0, Math.min(Math.floor(air * 1.2), Math.floor(Number(flips) || 0)));
    const pts = jumpPoints(height, spins, flips);
    S.jumps++;
    S.skill = Math.min(100, Math.round((S.skill + 0.3 + spins * 0.4 + flips * 0.6) * 10) / 10);
    const rec = height > S.best;
    if (rec) S.best = Math.round(height * 10) / 10;
    if (pts > S.bestPoints) S.bestPoints = pts;
    const rank = ctx.leaderboard ? ctx.leaderboard.submit('kite', p, pts, false) : null;
    return { ok: true, changed: true, data: { height, spins, flips, pts, record: rec, rank } };
  },
  // fin de session : progression (temps passé sur l'eau), dessalages
  'sail.end'(ctx, { capsizes }) {
    const p = ctx.profile, S = sailOf(p), s = ctx.session.sail;
    ctx.session.sail = null;
    if (!s) return { ok: true, changed: false, data: {} };
    const minutes = Math.min(30, (ctx.now - s.at) / 60_000);
    S.skill = Math.min(100, Math.round((S.skill + minutes * 0.8) * 10) / 10);
    S.capsizes += Math.max(0, Math.min(20, Math.floor(Number(capsizes) || 0)));
    p.body.endurance = Math.min(100, (p.body.endurance ?? 15) + minutes * 0.2);
    return { ok: true, changed: true, data: { skill: S.skill } };
  },
};
