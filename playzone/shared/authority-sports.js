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
import { windAt, windAtPos, MIN_WIND, WING, maxJump, jumpPoints, windLabel } from './wingfoil.js';
import { calTime } from './authority-calendar.js';
const atSurf = (self, ctx) => Object.values(BUILDING_BY_ID).some((b) => b.shop === 'surf' && self.atBuilding(ctx, b, 6));   // tous les magasins de wingfoil
import { equipped, gearStats, ownsGear, GEAR_SLOTS, GEAR_COLORS } from './gear.js';
import { groundHeight, WATER_LEVEL } from './world-layout.js';

Object.assign(SPORTS_HANDLERS, {
  // mise à l'eau : il faut une aile (achetée), ou l'essai gratuit, ou une location ; et du vent
  // at : mise à l'eau « où on veut » (avec son propre matériel), sur un point d'eau profonde proche
  // pump : pumpfoil (sans aile, sans vent : on avance en pompant). Une planche de pumpfoil ou un
  // wingfoil complet suffit pour se mettre à l'eau partout.
  'wing.start'(ctx, { mode, at, pump }) {
    const p = ctx.profile, w = p.sports.wing;
    const own = ownsGear(p, 'aile-5') || Object.keys(GEAR_SLOTS.wing).some((id) => ownsGear(p, id)) || (pump && (p.inventory.pumpfoil || 0) > 0);
    if (at) {
      if (!own && !atSurf(this, ctx)) return err('Il te faut ton propre wingfoil pour te mettre à l\'eau où tu veux (Surf Shop).');
      if (typeof at.x !== 'number' || typeof at.z !== 'number' || groundHeight(at.x, at.z) > WATER_LEVEL - 1) return err('Il faut de l\'eau profonde pour mettre le foil à l\'eau.');
      if (ctx.pos && Math.hypot(ctx.pos.x - at.x, ctx.pos.z - at.z) > (own ? 60 : 180)) return err('Approche-toi de l\'eau.');
      if (ctx.pos) { ctx.pos.x = at.x; ctx.pos.z = at.z; }
    } else if (!atSurf(this, ctx)) return err('La mise à l\'eau se fait au Surf Shop de la Côte des Villas (ou n\'importe où au bord de l\'eau avec ton propre wingfoil).');
    const gear = own ? equipped(p) : equipped({ inventory: {} });
    const st = gearStats(gear);
    const wp = at || ctx.pos || {};
    const wind = typeof wp.x === 'number' ? windAtPos(calTime(ctx), wp.x, wp.z) : windAt(calTime(ctx));
    if (!pump && wind.kts < st.minWind) return err(`Pas assez de vent : ${wind.kts} nœuds (${windLabel(wind.kts)}). Avec cette aile, il en faut au moins ${st.minWind}. ${st.minWind > 6 ? 'Une aile plus grande vole avec moins de vent !' : 'Reviens plus tard !'}`);
    if (p.body.injury) return err('Tu es blessé·e : repos d\'abord.');
    let paid = 0;
    if ((p.inventory.wingfoil || 0) > 0 || (pump && (p.inventory.pumpfoil || 0) > 0)) mode = 'own';
    else if (mode === 'trial') { if (w.trial) return err('Ton essai gratuit est déjà utilisé : loue ou achète une aile.'); w.trial = true; }
    else { if (p.coins < WING.rental) return err(`La location coûte ${WING.rental} PC.`); this.addCoins(p, -WING.rental); paid = WING.rental; mode = 'rent'; }
    w.sessions++;
    ctx.session.wing = { at: ctx.now, lastJump: 0, kts: wind.kts, jump: st.jump, pump: !!pump };
    return { ok: true, changed: true, data: { mode, paid, wind, gear, stats: st } };
  },
  'wing.jump'(ctx, { height, air, spins, flips }) {
    const p = ctx.profile, w = p.sports.wing, s = ctx.session.wing;
    if (!s) return err('Pas sur l\'eau.');
    if (ctx.now - s.lastJump < 1200) return err('Trop rapide.');
    s.lastJump = ctx.now;
    const kts = Math.max(s.kts, ctx.pos ? windAtPos(calTime(ctx), ctx.pos.x, ctx.pos.z).kts : windAt(calTime(ctx)).kts);
    height = Math.max(0, Math.min(maxJump(kts) * (s.jump || 1), Number(height) || 0));
    air = Math.max(0, Math.min(2 * Math.sqrt((2 * height) / 9.8) + 0.6, Number(air) || 0));
    spins = Math.max(0, Math.min(Math.floor(air * 1.6), Math.floor(Number(spins) || 0)));
    flips = Math.max(0, Math.min(Math.floor(air * 1.2), Math.floor(Number(flips) || 0)));
    const pts = jumpPoints(height, spins, flips);
    w.jumps++;
    w.skill = Math.min(100, Math.round((w.skill + 0.3 + spins * 0.4 + flips * 0.6) * 10) / 10);
    p.body.endurance = Math.min(100, (p.body.endurance ?? 15) + 0.15);
    const rec = height > w.best;
    if (rec) w.best = Math.round(height * 10) / 10;
    if (pts > w.bestPoints) w.bestPoints = pts;
    const rank = ctx.leaderboard ? ctx.leaderboard.submit('wing', p, pts, false) : null;
    return { ok: true, changed: true, data: { height, spins, flips, pts, record: rec, rank } };
  },
  'wing.end'(ctx) { ctx.session.wing = null; return { ok: true, changed: false, data: {} }; },
  // Pumpfoil : plus long vol (secondes sur le foil sans toucher l'eau) ; on progresse en pompant.
  'wing.pump'(ctx, { seconds }) {
    const p = ctx.profile, w = p.sports.wing, s = ctx.session.wing;
    if (!s?.pump) return err('Pas en pumpfoil.');
    const max = (ctx.now - s.at) / 1000 + 1;
    seconds = Math.max(0, Math.min(max, 600, Number(seconds) || 0));
    const record = seconds > (w.pumpBest || 0);
    if (record) w.pumpBest = Math.round(seconds * 10) / 10;
    w.skill = Math.min(100, Math.round(((w.skill || 5) + Math.min(3, seconds / 20)) * 10) / 10);
    const rank = ctx.leaderboard ? ctx.leaderboard.submit('pumpfoil', p, Math.round(seconds * 10), false) : null;
    return { ok: true, changed: true, data: { seconds, record, best: w.pumpBest, skill: w.skill, rank } };
  },
  // Réglage de l'équipement : pièce possédée dans chaque emplacement, couleurs libres.
  'gear.equip'(ctx, { slot, id, wingColor, boardColor }) {
    const p = ctx.profile;
    p.gear = { ...equipped(p) };
    if (slot) {
      if (!GEAR_SLOTS[slot]?.[id]) return err('Équipement inconnu.');
      if (!ownsGear(p, id)) return err('Tu ne possèdes pas cet équipement (Surf Shop).');
      p.gear[slot] = id;
    }
    if (wingColor) { if (!GEAR_COLORS.includes(wingColor)) return err('Couleur inconnue.'); p.gear.wingColor = wingColor; }
    if (boardColor) { if (!GEAR_COLORS.includes(boardColor)) return err('Couleur inconnue.'); p.gear.boardColor = boardColor; }
    return { ok: true, changed: true, data: { gear: p.gear } };
  },
});

// ------------------------------------------------------------------------------ course à pied, vélo, F1, ski
import { DISC, ROUTES, SKI, BIGAIR_MAX, discLen, npcField, defaultDisc } from './courses.js';
import { CYCLE_MS } from './clock.js';
const SKI_HUT = { x: SKI.hut.x, z: SKI.hut.z };
function atDiscPlace(self, ctx, disc) {
  const D = DISC[disc];
  if (D.place === 'ski-hut') return self.near(ctx, SKI_HUT.x, SKI_HUT.z, 14);
  const st = ROUTES[D.route]?.pts[0];
  return self.atBuilding(ctx, BUILDING_BY_ID[D.place], 4) || (st && self.near(ctx, st.x, st.z, 45));
}
const memberOf = (d, now) => (d.member && d.member.until > now ? d.member : null);
export function discOf(p, disc) { p.sports[disc] = { ...defaultDisc(), ...(p.sports[disc] || {}) }; return p.sports[disc]; }

Object.assign(SPORTS_HANDLERS, {
  'sport.member'(ctx, { disc, kind }) {
    const p = ctx.profile, D = DISC[disc];
    if (!D || !D.member) return err('Pas d\'adhésion pour ce sport : c\'est gratuit !');
    if (!atDiscPlace(this, ctx, disc)) return err('L\'adhésion se prend sur place.');
    const d = discOf(p, disc);
    const day = kind === 'day' && D.day;
    const price = day ? D.day : D.member.price;
    if (p.coins < price) return err(`Il faut ${price} PC.`);
    this.addCoins(p, -price);
    const base = Math.max(ctx.now, d.member?.until || 0);
    d.member = { kind: day ? 'jour' : 'saison', until: base + (day ? 1 : D.member.days) * CYCLE_MS };
    return { ok: true, changed: true, data: { until: d.member.until, price } };
  },
  'sport.start'(ctx, { disc, mode, at }) {
    const p = ctx.profile, D = DISC[disc], M = D?.modes[mode];
    if (!M) return err('Épreuve inconnue.');
    // balade en jet ski « où on veut » avec son propre jet ski (eau profonde, tout près)
    const anywhere = at && disc === 'jetski' && M.free && (p.inventory.jetski || 0) > 0;
    if (at && !anywhere) return err('Seule la balade libre avec ton propre jet ski peut partir d\'ici.');
    if (anywhere) {
      if (typeof at.x !== 'number' || typeof at.z !== 'number' || groundHeight(at.x, at.z) > WATER_LEVEL - 1) return err('Il faut de l\'eau profonde.');
      if (ctx.pos && Math.hypot(ctx.pos.x - at.x, ctx.pos.z - at.z) > 60) return err('Approche-toi de l\'eau.');
      if (ctx.pos) { ctx.pos.x = at.x; ctx.pos.z = at.z; }
    } else if (!atDiscPlace(this, ctx, disc)) return err('Ça se lance depuis le club (accueil).');
    if (p.body.injury) return err('Tu es blessé·e : repos d\'abord.');
    if (p.justice?.jail) return err('Pas depuis la prison !');
    const d = discOf(p, disc);
    let trial = false;
    if (D.member && !memberOf(d, ctx.now) && !(D.item && (p.inventory[D.item] || 0) > 0)) {
      if (d.trial) return err(`Ton essai gratuit est passé : prends ${D.day ? `un forfait journée (${D.day} PC) ou ` : ''}l'adhésion « ${D.member.name} » (${D.member.price} PC).`);
      d.trial = true; trial = true;
    }
    const fee = trial ? 0 : M.fee;
    if (p.coins < fee) return err(`Inscription : ${fee} PC.`);
    if (fee) this.addCoins(p, -fee);
    const seed = randInt(ctx.rand, 1, 2 ** 31 - 2);
    const field = npcField(disc, mode, seed, d.skill);
    ctx.session.race = { disc, mode, at: ctx.now, go: ctx.now + 3000, field };
    d.sessions++;
    return { ok: true, changed: true, data: { seed, field, trial, fee, laps: M.laps, go: ctx.now + 3000, grid: mode === 'course' ? d.grid : null } };
  },
  'sport.finish'(ctx, { time, laps, gates, abandon, score }) {
    const p = ctx.profile, s = ctx.session.race;
    if (!s) return err('Aucune épreuve en cours.');
    ctx.session.race = null;
    const D = DISC[s.disc], M = D.modes[s.mode], d = discOf(p, s.disc);
    if (abandon) return { ok: true, changed: true, data: { abandon: true } };
    const elapsed = (ctx.now - s.go) / 1000;
    time = Math.min(Number(time) || 0, elapsed + 1);
    const minT = discLen(s.disc, s.mode) / D.vmax;
    if (!(time >= minT)) return err('Temps impossible : course non validée.');
    // arrivée : il faut être sur la ligne (bas de la piste pour le ski)
    if (ctx.pos) {
      const fin = D.how === 'ski' ? { x: (SKI.x1 + SKI.x2) / 2, z: SKI.bottom } : ROUTES[D.route].pts[0];
      const tol = D.how === 'ski' ? 120 : 45;
      if (Math.hypot(ctx.pos.x - fin.x, ctx.pos.z - fin.z) > tol) return err('Tu n\'es pas sur la ligne d\'arrivée.');
    }
    // ski : portes manquées = +5 s chacune
    const missed = M.gates ? Math.max(0, 10 - Math.max(0, Math.min(10, Math.floor(Number(gates) || 0)))) : 0;
    const total = Math.round((time + missed * 5) * 100) / 100;
    const minLap = D.route ? ROUTES[D.route].len / D.vmax : 0;
    const lapTimes = Array.isArray(laps) ? laps.map(Number).filter((x) => x >= minLap) : [];
    const bestLap = lapTimes.length ? Math.min(...lapTimes) : null;
    let rank = null, prize = 0, grid = null;
    const pts = M.score ? Math.max(0, Math.min(BIGAIR_MAX, Math.floor(Number(score) || 0))) : null;
    if (M.npcs && M.score) {
      rank = 1 + s.field.filter((n) => n.score > pts).length;
      prize = M.prizes[rank - 1] || 0;
      d.races++; if (rank === 1) d.wins++; if (rank <= 3) d.podiums++;
    } else if (M.npcs) {
      rank = 1 + s.field.filter((n) => n.total < total).length;
      prize = M.prizes[rank - 1] || 0;
      d.races++; if (rank === 1) d.wins++; if (rank <= 3) d.podiums++;
      d.grid = null;
    }
    if (M.qualif && bestLap) {
      // grille : on compare au meilleur tour typique des pilotes PNJ de ton niveau
      const field = npcField(s.disc, 'course', 7, d.skill);
      grid = 1 + field.filter((n) => n.total / 5 * 0.985 < bestLap).length;
      d.grid = grid;
    }
    if (prize) this.addCoins(p, prize);
    const key = s.mode;
    const prev = d.best[key];
    const record = M.score ? (prev == null || pts > prev) : (prev == null || total < prev);
    if (record) d.best[key] = M.score ? pts : total;
    // progression : la compétence du sport et l'endurance montent en pratiquant
    const g = (1.2 + M.laps * 0.4) * (M.npcs ? 1.3 : 1) * (1 - d.skill / 125);
    d.skill = Math.min(100, Math.round((d.skill + g) * 10) / 10);
    const endu = { foot: 2.6, bike: 2.0, ski: 0.9, f1: 0.4, jet: 0.5 }[D.how] || 0.3;
    p.body.endurance = Math.min(100, (p.body.endurance ?? 15) + endu);
    if (D.how === 'foot' || D.how === 'bike') p.body.muscle = Math.min(100, p.body.muscle + endu * 0.25);
    p.rep = (p.rep || 0) + (rank === 1 ? 2 : 0);
    return { ok: true, changed: true, data: { total, missed, score: pts, rank, of: M.npcs + 1, prize, record, best: d.best[key], skill: d.skill, endurance: Math.round(p.body.endurance), grid, bestLap } };
  },
});
