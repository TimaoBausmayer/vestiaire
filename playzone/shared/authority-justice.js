// AUTORITÉ — POLICE ET JUSTICE : délits signalés (avec ou sans témoin), étoiles, vol à la tire, recel
// à la casse, braquage, amendes et points, semer la police, arrestation, prison (minutes réelles),
// travail et évasion, code de la route et permis. Fonctions appelées avec `this` = l'Authority.
import { BUILDING_BY_ID, BUILDINGS } from './world-layout.js';
import { VEHICLES } from './content/vehicles.js';
import { CRIMES, FINES, MAX_STARS, sentence, loseTime, LICENCE, CODE_QUESTIONS, codeTest, CODE_PASS, EXAM_ROUTE, EXAM_MIN_SECONDS, EXAM_MAX_ERRORS } from './justice.js';

const err = (error) => ({ ok: false, error });
// Téléportation décidée par l'autorité : la position validée suit (sinon l'anti-triche la refuserait).
export const moveTo = (ctx, at) => { if (ctx.pos && at) { ctx.pos.x = at.x; ctx.pos.z = at.z; } };
const PRISON = BUILDING_BY_ID.prison;
export const PRISON_YARD = PRISON?.wall ? { x1: PRISON.wall.x1, z1: PRISON.wall.z1, x2: PRISON.wall.x2, z2: PRISON.wall.z2 } : null;
export const PRISON_CELL = PRISON ? { x: PRISON.x + 3, z: PRISON.z + 1 } : { x: 0, z: 0 }; // salle commune
export const PRISON_GATE = PRISON?.wall ? { x: PRISON.wall.gateX, z: PRISON.wall.z1 - 4 } : { x: 0, z: 0 };
export const inPrison = (pos) => !!(PRISON_YARD && pos && pos.x > PRISON_YARD.x1 - 1 && pos.x < PRISON_YARD.x2 + 1 && pos.z > PRISON_YARD.z1 - 1 && pos.z < PRISON_YARD.z2 + 1);
const gameHourAt = (now) => (7 + (now % (24 * 600_000)) / 600_000) % 24;
const police = () => BUILDING_BY_ID.police;

function addCrime(p, type, now, witnessed = true) {
  const j = p.justice;
  if (!witnessed) return;
  j.crimes.push({ type, at: now });
  if (j.crimes.length > 20) j.crimes.shift();
  j.stars = Math.min(MAX_STARS, j.stars + CRIMES[type].stars);
  j.lastCrimeAt = now;
}

export const JUSTICE_HANDLERS = {
  // Délit constaté côté client (coups, vol de voiture, piéton renversé, sans permis...).
  'crime.report'(ctx, { type, witnessed, model }) {
    const p = ctx.profile, c = CRIMES[type];
    if (!c || ['braquage', 'evasion', 'recel', 'vol-tire'].includes(type)) return err('Délit inconnu.');
    if (p.justice.jail) return err('Tu es en prison.');
    if (type === 'vol-voiture' && VEHICLES[model]) ctx.session.stolen = { model, at: ctx.now };
    addCrime(p, type, ctx.now, !!witnessed);
    return { ok: true, changed: true, data: { stars: p.justice.stars } };
  },

  // Vol à la tire sur un passant : réussite au hasard, l'autorité décide du butin.
  'crime.pickpocket'(ctx) {
    const p = ctx.profile, j = p.justice;
    if (j.jail) return err('Tu es en prison.');
    if (ctx.now - (p.cooldowns['crime:pick'] || 0) < 6000) return err('Doucement, on va te repérer...');
    p.cooldowns['crime:pick'] = ctx.now;
    const ok = ctx.rand() < 0.62;
    const data = { success: ok };
    if (ok) { const loot = 5 + Math.floor(ctx.rand() * 55); p.cash = (p.cash || 0) + loot; j.loot = (j.loot || 0) + loot; data.loot = loot; }
    if (!ok || ctx.rand() < 0.2) { addCrime(p, 'vol-tire', ctx.now); data.caught = true; }
    data.stars = j.stars;
    return { ok: true, changed: true, data };
  },

  // Revendre une voiture volée à la casse (en liquide).
  'crime.fence'(ctx) {
    const p = ctx.profile, st = ctx.session.stolen;
    const casse = BUILDING_BY_ID.casse;
    const yard = casse?.yard;
    const atYard = ctx.pos && yard && ctx.pos.x > yard.x1 - 4 && ctx.pos.x < yard.x2 + 4 && ctx.pos.z > yard.z1 - 4 && ctx.pos.z < yard.z2 + 4;
    if (!st) return err('« Elle est pas volée, ta voiture. Dégage. »');
    if (!atYard && !this.atBuilding(ctx, casse, 4)) return err('Amène la voiture dans la cour de la casse.');
    const gain = Math.max(150, Math.round((VEHICLES[st.model]?.price || 8000) * 0.12));
    p.cash = (p.cash || 0) + gain;
    p.justice.loot = (p.justice.loot || 0) + gain;
    ctx.session.stolen = null;
    if (ctx.rand() < 0.25) addCrime(p, 'recel', ctx.now);
    return { ok: true, changed: true, data: { gain, stars: p.justice.stars } };
  },

  // Braquage : l'alarme sonne (4 étoiles) ; il faut tenir 20 s au coffre pour repartir avec le butin.
  'crime.robStart'(ctx) {
    const p = ctx.profile, bank = BUILDING_BY_ID.banque;
    if (p.justice.jail) return err('Tu es en prison.');
    if (!this.atBuilding(ctx, bank, 0)) return err('Il faut être dans la banque.');
    if (ctx.now - (p.cooldowns['crime:rob'] || 0) < 10 * 60_000) return err('La banque a renforcé sa sécurité : reviens plus tard.');
    p.cooldowns['crime:rob'] = ctx.now;
    ctx.session.robbery = { at: ctx.now };
    addCrime(p, 'braquage', ctx.now);
    return { ok: true, changed: true, data: { stars: p.justice.stars } };
  },
  'crime.robLoot'(ctx) {
    const p = ctx.profile, r = ctx.session.robbery;
    if (!r) return err('Aucun braquage en cours.');
    if (ctx.now - r.at < 20_000) return err('Le coffre résiste encore...');
    if (!this.atBuilding(ctx, BUILDING_BY_ID.banque, 0)) { ctx.session.robbery = null; return err('Tu as quitté le coffre : braquage raté.'); }
    ctx.session.robbery = null;
    const loot = 2500 + Math.floor(ctx.rand() * 4000);
    p.cash = (p.cash || 0) + loot;
    p.justice.loot = (p.justice.loot || 0) + loot;
    return { ok: true, changed: true, data: { loot } };
  },

  // Amende (radar, feu rouge, contrôle) : prélevée sur le compte, points retirés du permis.
  'police.fine'(ctx, { type }) {
    const p = ctx.profile, f = FINES[type], j = p.justice;
    if (!f) return err('Amende inconnue.');
    const key = `fine:${type}`;
    if (ctx.now - (p.cooldowns[key] || 0) < 20_000) return { ok: true, changed: false, data: { skipped: true } };
    p.cooldowns[key] = ctx.now;
    const paid = Math.min(f.amount, p.coins);
    this.addCoins(p, -paid);
    if (paid < f.amount) p.debt = (p.debt || 0) + (f.amount - paid);
    j.fines.push({ type, amount: f.amount, at: ctx.now });
    if (j.fines.length > 20) j.fines.shift();
    let suspended = false;
    if (f.points && j.licence.permis) {
      j.points = Math.max(0, j.points - f.points);
      if (j.points === 0) { j.licence.permis = false; suspended = true; }
    }
    if (type === 'sans-permis') addCrime(p, 'sans-permis', ctx.now);
    return { ok: true, changed: true, data: { amount: f.amount, points: j.points, suspended, stars: j.stars } };
  },

  // On a semé la police (pas vu depuis assez longtemps).
  'police.lose'(ctx) {
    const j = ctx.profile.justice;
    if (!j.stars) return { ok: true, changed: false, data: {} };
    if (ctx.now - j.lastCrimeAt < loseTime(j.stars) * 1000 - 2000) return err('La police te cherche encore.');
    for (const c of j.crimes) j.record.push({ ...c, end: 'impuni' });
    j.crimes = []; j.stars = 0;
    return { ok: true, changed: true, data: {} };
  },

  // Arrestation : prison (minutes réelles selon le barème), argent liquide saisi.
  'police.arrest'(ctx) {
    const p = ctx.profile;
    const res = arrest(this, p, ctx.now);
    if (!res) return err('Personne ne te recherche.');
    ctx.session.stolen = null; ctx.session.robbery = null; ctx.session.shift = null;
    moveTo(ctx, res.at);
    return { ok: true, changed: true, data: res };
  },

  // ---------------------------------------------------------------- prison
  'jail.release'(ctx) {
    const p = ctx.profile, jl = p.justice.jail;
    if (!jl) return err('Tu n\'es pas en prison.');
    if (ctx.now < jl.until) return err(`Encore ${Math.ceil((jl.until - ctx.now) / 60_000)} min.`);
    p.justice.jail = null;
    moveTo(ctx, PRISON_GATE);
    return { ok: true, changed: true, data: { at: PRISON_GATE } };
  },
  'jail.work'(ctx) {
    const p = ctx.profile, jl = p.justice.jail;
    if (!jl) return err('Tu n\'es pas en prison.');
    if (ctx.now - (p.cooldowns['jail:work'] || 0) < 30_000) return err('Pause obligatoire (30 s).');
    p.cooldowns['jail:work'] = ctx.now;
    this.addCoins(p, 6);
    jl.until -= 15_000; // bonne conduite : 15 s de remise de peine
    return { ok: true, changed: true, data: { coins: 6, until: jl.until } };
  },
  'jail.escape'(ctx) {
    const p = ctx.profile, jl = p.justice.jail;
    if (!jl) return err('Tu n\'es pas en prison.');
    if (ctx.now - (p.cooldowns['jail:escape'] || 0) < 20_000) return err('Un gardien passe dans le couloir... attends un peu.');
    p.cooldowns['jail:escape'] = ctx.now;
    const h = gameHourAt(ctx.now), night = h >= 21 || h < 6;
    // le tunnel se creuse en plusieurs fois ; à chaque fois, un risque de se faire surprendre
    if (ctx.rand() < (night ? 0.08 : 0.15)) {
      jl.tunnel = Math.max(0, (jl.tunnel || 0) - 30);
      jl.until += 3 * 60_000;
      return { ok: true, changed: true, data: { escaped: false, caught: true, tunnel: jl.tunnel, until: jl.until } };
    }
    jl.tunnel = Math.min(100, (jl.tunnel || 0) + (night ? 40 : 30));
    if (jl.tunnel >= 100) {
      p.justice.jail = null;
      addCrime(p, 'evasion', ctx.now);
      const at = { x: PRISON.wall.x2 + 6, z: PRISON.wall.z1 - 6 };
      moveTo(ctx, at);
      return { ok: true, changed: true, data: { escaped: true, at, stars: p.justice.stars } };
    }
    return { ok: true, changed: true, data: { escaped: false, caught: false, tunnel: jl.tunnel } };
  },

  // ---------------------------------------------------------------- code de la route et permis
  'licence.code'(ctx, { seed, answers }) {
    const p = ctx.profile, L = p.justice.licence;
    if (!this.atBuilding(ctx, police(), 1)) return err('Le code se passe au commissariat (auto-école).');
    if (L.code) return err('Tu as déjà le code !');
    if (p.coins < LICENCE.code) return err(`Il faut ${LICENCE.code} PC.`);
    const qs = codeTest(Number(seed) || 0);
    if (!Array.isArray(answers) || answers.length !== qs.length) return err('Copie incomplète.');
    this.addCoins(p, -LICENCE.code);
    const score = qs.reduce((n, qi, i) => n + (answers[i] === CODE_QUESTIONS[qi][2] ? 1 : 0), 0);
    if (score >= CODE_PASS) L.code = true;
    return { ok: true, changed: true, data: { score, passed: score >= CODE_PASS, need: CODE_PASS } };
  },
  'licence.examStart'(ctx) {
    const p = ctx.profile, L = p.justice.licence;
    if (!this.atBuilding(ctx, police(), 2)) return err('L\'examen part du commissariat.');
    if (!L.code) return err('Il faut d\'abord réussir le code.');
    if (L.permis) return err('Tu as déjà ton permis !');
    if (p.coins < LICENCE.permis) return err(`L'examen coûte ${LICENCE.permis} PC.`);
    this.addCoins(p, -LICENCE.permis);
    ctx.session.exam = { at: ctx.now };
    return { ok: true, changed: true, data: { route: EXAM_ROUTE } };
  },
  'licence.examEnd'(ctx, { checkpoints, errors }) {
    const p = ctx.profile, ex = ctx.session.exam;
    if (!ex) return err('Aucun examen en cours.');
    ctx.session.exam = null;
    const secs = (ctx.now - ex.at) / 1000;
    const passed = checkpoints === EXAM_ROUTE.length && secs >= EXAM_MIN_SECONDS && typeof errors === 'number' && errors <= EXAM_MAX_ERRORS;
    if (passed) { p.justice.licence.permis = true; p.justice.points = LICENCE.points; this.addXp(p, 60); }
    return { ok: true, changed: true, data: { passed } };
  },

  // ---------------------------------------------------------------- policiers joueurs (en ligne)
  'police.arrestPlayer'(ctx, { targetId }) {
    const p = ctx.profile;
    if (ctx.session.shift?.job !== 'policier') return err('Il faut être policier·ère en service.');
    if (!ctx.players) return err('En ligne seulement.');
    const res = ctx.players.arrest(targetId, ctx.pos);
    if (!res.ok) return err(res.error);
    const reward = 80 * res.stars;
    this.addCoins(p, reward);
    p.stats.arrests = (p.stats.arrests || 0) + 1;
    return { ok: true, changed: true, data: { reward, name: res.name, minutes: res.minutes } };
  },
};

// Applique une arrestation au profil p (aussi utilisé par le serveur quand un policier joueur arrête p).
export function arrest(self, p, now) {
  const j = p.justice;
  if (!j.stars && !j.crimes.length) return null;
  const minutes = Math.max(2, sentence(j.crimes));
  const seized = Math.round(p.cash || 0);
  p.cash = 0; j.loot = 0;
  for (const c of j.crimes) j.record.push({ ...c, end: 'condamné' });
  if (j.record.length > 40) j.record.splice(0, j.record.length - 40);
  j.jail = { since: now, until: now + minutes * 60_000, minutes, crimes: j.crimes.map((c) => c.type) };
  j.crimes = []; j.stars = 0; j.arrests++;
  // un policier qui se fait arrêter perd son poste
  let fired = false;
  if (p.career?.job?.id === 'policier') { p.career.history.push({ id: 'policier', building: p.career.job.building, from: p.career.job.since, to: now, end: 'renvoi (condamnation)' }); p.career.job = null; fired = true; }
  p.record = j.record.filter((c) => c.end === 'condamné').map((c) => c.type);
  return { minutes, seized, at: PRISON_CELL, crimes: j.jail.crimes, fired };
}

export { BUILDINGS };
