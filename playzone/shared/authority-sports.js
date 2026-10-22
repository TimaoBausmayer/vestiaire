// AUTORITÉ — SPORTS (football) : club gratuit, entraînements gratuits, matchs contre des PNJ.
// Les résultats sont plafonnés selon la durée réelle (pas de score impossible), les gains vont
// aux compétences, à l'endurance (corps) et à l'XP foot ; primes en PlayCoins pour les matchs officiels.
import { BUILDING_BY_ID } from './world-layout.js';
import { randInt } from './rng.js';
import { PITCH, inPitch, DRILLS, MATCHES, footLevel, levelIndex, drillGain, defaultFoot, SKILL_MAX, aiStrength, TEAMS } from './sports.js';

const err = (error) => ({ ok: false, error });
const atClub = (self, ctx) => self.atBuilding(ctx, BUILDING_BY_ID['club-foot'], 3) || (ctx.pos && inPitch(ctx.pos.x, ctx.pos.z, 10));
const atPitch = (ctx) => ctx.pos && inPitch(ctx.pos.x, ctx.pos.z, 12);
export function defaultSports() { return { foot: defaultFoot() }; }

function gainEndurance(p, v) { p.body.endurance = Math.min(100, (p.body.endurance ?? 15) + v); }

export const SPORTS_HANDLERS = {
  'foot.join'(ctx) {
    const f = ctx.profile.sports.foot;
    if (!atClub(this, ctx)) return err('L\'inscription se fait au club-house du Stade des Crampons.');
    if (f.club) return err('Tu es déjà licencié·e au club !');
    f.club = true;
    return { ok: true, changed: true, data: { club: true } };
  },

  'foot.drillStart'(ctx, { drill }) {
    const f = ctx.profile.sports.foot;
    if (!DRILLS[drill]) return err('Exercice inconnu.');
    if (!atPitch(ctx)) return err('Les entraînements ont lieu sur le terrain du Stade des Crampons.');
    if (ctx.profile.body.injury) return err('Tu es blessé·e : soigne-toi avant de t\'entraîner.');
    ctx.session.foot = { kind: 'drill', drill, at: ctx.now, seed: randInt(ctx.rand, 1, 2 ** 31 - 2) };
    return { ok: true, changed: false, data: { seed: ctx.session.foot.seed, free: true, trial: !f.club } };
  },
  'foot.drillEnd'(ctx, { score }) {
    const s = ctx.session.foot, p = ctx.profile, f = p.sports.foot;
    if (!s || s.kind !== 'drill') return err('Aucun entraînement en cours.');
    ctx.session.foot = null;
    const d = DRILLS[s.drill];
    const secs = (ctx.now - s.at) / 1000;
    if (secs < d.min) return err('Entraînement trop court.');
    const sc = Math.max(0, Math.min(d.max, Math.floor(Number(score) || 0)));
    const g = drillGain(s.drill, sc);
    // pratique répétée : gains un peu réduits si on enchaîne (fatigue), jamais nuls
    const recent = (f.history || []).filter((h) => h.t === 'drill' && ctx.now - h.at < 5 * 60_000).length;
    const k = recent >= 3 ? 0.5 : 1;
    f.skills[g.skill] = Math.min(SKILL_MAX, Math.round((f.skills[g.skill] + g.amount * k) * 10) / 10);
    gainEndurance(p, g.endurance * k);
    p.body.muscle = Math.min(100, p.body.muscle + 0.3 * k);
    f.xp += Math.round(g.xp * k);
    f.trainings++;
    f.history = [...(f.history || []), { t: 'drill', d: s.drill, score: sc, at: ctx.now }].slice(-20);
    return { ok: true, changed: true, data: { score: sc, skill: g.skill, value: f.skills[g.skill], endurance: Math.round(p.body.endurance), xp: f.xp, tired: k < 1 } };
  },

  'foot.matchStart'(ctx, { kind, strength }) {
    const p = ctx.profile, f = p.sports.foot, M = MATCHES[kind];
    if (!M) return err('Match inconnu.');
    if (!atClub(this, ctx)) return err('Les matchs se lancent au club-house ou sur le terrain.');
    if (!f.club && kind !== 'amical') return err('Inscris-toi au club (gratuit) pour jouer ce match. Le petit match amical est un essai gratuit.');
    if (!f.club && f.matches >= 1) return err('Ton match d\'essai est passé : inscris-toi au club (c\'est gratuit !).');
    const lv = footLevel(f.xp);
    if (lv.i < levelIndex(M.need)) return err(`Niveau requis : ${FOOT_LEVELS_NAME(M.need)}. Entraîne-toi et joue des petits matchs !`);
    if (p.body.injury) return err('Tu es blessé·e : pas de match aujourd\'hui.');
    const seed = randInt(ctx.rand, 1, 2 ** 31 - 2);
    const str = aiStrength(lv.i, kind, kind === 'organise' ? Number(strength) : null);
    const opp = TEAMS[seed % TEAMS.length];
    ctx.session.foot = { kind: 'match', match: kind, at: ctx.now, seed, str };
    return { ok: true, changed: false, data: { seed, strength: str, opponent: opp, mins: M.mins, size: M.size } };
  },
  'foot.matchEnd'(ctx, { gf, ga, goals, abandon }) {
    const s = ctx.session.foot, p = ctx.profile, f = p.sports.foot;
    if (!s || s.kind !== 'match') return err('Aucun match en cours.');
    ctx.session.foot = null;
    const M = MATCHES[s.match];
    const secs = (ctx.now - s.at) / 1000;
    const cap = Math.max(0, Math.floor(secs / 7));      // au plus un but toutes les 7 secondes
    gf = Math.max(0, Math.min(cap, Math.floor(Number(gf) || 0)));
    ga = Math.max(0, Math.min(cap, Math.floor(Number(ga) || 0)));
    goals = Math.max(0, Math.min(gf, Math.floor(Number(goals) || 0)));
    if (abandon || secs < M.mins * 60 * 0.8) { f.losses++; f.matches++; return { ok: true, changed: true, data: { result: 'forfait', gf, ga, prize: 0, xp: 0 } }; }
    const result = gf > ga ? 'victoire' : gf === ga ? 'nul' : 'defaite';
    const xp = M.xp[result === 'victoire' ? 0 : result === 'nul' ? 1 : 2] + goals * 5;
    const prize = result === 'victoire' ? M.prize : result === 'nul' ? Math.floor(M.prize / 3) : 0;
    f.matches++; f.goals += goals; f.xp += xp;
    if (result === 'victoire') { f.wins++; if (s.match === 'gros') f.trophies++; } else if (result === 'nul') f.draws++; else f.losses++;
    // un match fait progresser un peu tout le monde (et beaucoup l'endurance)
    for (const k of Object.keys(f.skills)) f.skills[k] = Math.min(SKILL_MAX, Math.round((f.skills[k] + 0.6 + (k === 'tir' ? goals * 0.5 : 0)) * 10) / 10);
    gainEndurance(p, 2.5);
    if (prize) this.addCoins(p, prize);
    p.rep = (p.rep || 0) + (result === 'victoire' ? (s.match === 'gros' ? 8 : 2) : 0);
    f.history = [...(f.history || []), { t: 'match', m: s.match, gf, ga, goals, at: ctx.now }].slice(-20);
    return { ok: true, changed: true, data: { result, gf, ga, goals, prize, xp, level: footLevel(f.xp).name } };
  },
};

function FOOT_LEVELS_NAME(id) { return { debutant: 'Débutant', amateur: 'Amateur', regional: 'Régional', semipro: 'Semi-pro', pro: 'Pro', star: 'Star' }[id]; }
export { PITCH };

// ------------------------------------------------------------------------------ wingfoil
import { windAt, MIN_WIND, WING, maxJump, jumpPoints, windLabel } from './wingfoil.js';
import { calTime } from './authority-calendar.js';
const atSurf = (self, ctx) => self.atBuilding(ctx, BUILDING_BY_ID['surf-shop'], 4);

Object.assign(SPORTS_HANDLERS, {
  // mise à l'eau : il faut une aile (achetée), ou l'essai gratuit, ou une location ; et du vent
  'wing.start'(ctx, { mode }) {
    const p = ctx.profile, w = p.sports.wing;
    if (!atSurf(this, ctx)) return err('La mise à l\'eau se fait au Surf Shop de la Côte des Villas.');
    const wind = windAt(calTime(ctx));
    if (wind.kts < MIN_WIND) return err(`Pas assez de vent : ${wind.kts} nœuds (${windLabel(wind.kts)}). Il en faut au moins ${MIN_WIND}. Regarde les prévisions et reviens plus tard !`);
    if (p.body.injury) return err('Tu es blessé·e : repos d\'abord.');
    let paid = 0;
    if ((p.inventory.wingfoil || 0) > 0) mode = 'own';
    else if (mode === 'trial') { if (w.trial) return err('Ton essai gratuit est déjà utilisé : loue ou achète une aile.'); w.trial = true; }
    else { if (p.coins < WING.rental) return err(`La location coûte ${WING.rental} PC.`); this.addCoins(p, -WING.rental); paid = WING.rental; mode = 'rent'; }
    w.sessions++;
    ctx.session.wing = { at: ctx.now, lastJump: 0, kts: wind.kts };
    return { ok: true, changed: true, data: { mode, paid, wind } };
  },
  'wing.jump'(ctx, { height, air, spins }) {
    const p = ctx.profile, w = p.sports.wing, s = ctx.session.wing;
    if (!s) return err('Pas sur l\'eau.');
    if (ctx.now - s.lastJump < 1200) return err('Trop rapide.');
    s.lastJump = ctx.now;
    const kts = Math.max(s.kts, windAt(calTime(ctx)).kts);
    height = Math.max(0, Math.min(maxJump(kts), Number(height) || 0));
    air = Math.max(0, Math.min(2 * Math.sqrt((2 * height) / 9.8) + 0.6, Number(air) || 0));
    spins = Math.max(0, Math.min(Math.floor(air * 1.6), Math.floor(Number(spins) || 0)));
    const pts = jumpPoints(height, spins);
    w.jumps++;
    w.skill = Math.min(100, Math.round((w.skill + 0.3 + spins * 0.4) * 10) / 10);
    p.body.endurance = Math.min(100, (p.body.endurance ?? 15) + 0.15);
    const rec = height > w.best;
    if (rec) w.best = Math.round(height * 10) / 10;
    if (pts > w.bestPoints) w.bestPoints = pts;
    const rank = ctx.leaderboard ? ctx.leaderboard.submit('wing', p, pts, false) : null;
    return { ok: true, changed: true, data: { height, spins, pts, record: rec, rank } };
  },
  'wing.end'(ctx) { ctx.session.wing = null; return { ok: true, changed: false, data: {} }; },
});
