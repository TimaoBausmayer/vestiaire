// AUTORITÉ — CORPS ET SANTÉ : blessures, KO et hôpital, salle de sport (abonnements, machines),
// pompes, coiffeur, parfum, torse nu, clinique (âge). Fonctions appelées avec `this` = l'Authority.
import { BUILDING_BY_ID, BUILDINGS } from './world-layout.js';
import { HAIR_STYLES, HAIR_COLORS } from './appearance.js';
import { applyNeeds, needsStatus } from './needs.js';
import { INJURIES, GYM_PASSES, MACHINES, MACHINE_MAX_MIN, PUSHUP_GAIN, CLINIC, HAIR_PRICES } from './body.js';

const err = (error) => ({ ok: false, error });
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const SEVERITY = { bosse: 1, commotion: 2, entorse: 2, fracture: 3 };
const atKind = (self, ctx, interior) => BUILDINGS.some((b) => b.interior === interior && self.atBuilding(ctx, b, 1));

function injure(p, kind, now) {
  const inj = INJURIES[kind];
  p.body.health = Math.max(0, p.body.health - inj.health);
  if (!p.body.injury || SEVERITY[kind] >= SEVERITY[p.body.injury.kind]) p.body.injury = { kind, until: now + inj.minutes * 60_000 };
}

// Gains des machines (rendements décroissants quand on est déjà très musclé).
function train(p, gains, k, now) {
  const b = p.body;
  b.muscle = Math.min(100, b.muscle + gains.muscle * k * (1 - b.muscle / 130));
  b.weight = Math.max(45, b.weight + (gains.weight || 0) * k);
  applyNeeds(p.needs, now, { energie: (gains.energie || 0) * k, hygiene: (gains.hygiene || 0) * k, faim: (gains.faim || 0) * k, humeur: 2 });
}

export const BODY_HANDLERS = {
  // Chute, piéton renversé, gros choc en voiture (le client signale, l'autorité limite et décide).
  'body.hurt'(ctx, { cause, value }) {
    const p = ctx.profile, v = num(value);
    const last = p.cooldowns['body:hurt'] || 0;
    if (ctx.now - last < 4000) return { ok: true, changed: false, data: {} };
    let kind = null;
    if (cause === 'fall') kind = v >= 9 ? 'fracture' : v >= 6.5 ? 'entorse' : v >= 4.5 ? 'bosse' : null;
    else if (cause === 'car') kind = v >= 14 ? 'fracture' : v >= 9 ? 'commotion' : v >= 5 ? 'entorse' : null;
    else if (cause === 'crash') kind = v >= 22 ? 'commotion' : v >= 15 ? 'bosse' : null;
    else if (cause === 'fight') kind = v >= 2 ? 'commotion' : 'bosse';
    if (!kind) return { ok: true, changed: false, data: {} };
    p.cooldowns['body:hurt'] = ctx.now;
    injure(p, kind, ctx.now);
    return { ok: true, changed: true, data: { kind, health: p.body.health, ko: p.body.health <= 0 } };
  },

  // KO : on se réveille à l'hôpital (soins facturés, en dette si besoin).
  'body.ko'(ctx) {
    const p = ctx.profile;
    if (p.body.health > 0) return err('Tu tiens debout !');
    const bill = 300 + (p.body.injury ? INJURIES[p.body.injury.kind].care : 0);
    const paid = Math.min(bill, p.coins);
    this.addCoins(p, -paid);
    if (paid < bill) p.debt = (p.debt || 0) + (bill - paid);
    p.body.health = 60; p.body.injury = null; p.body.hospitalAt = ctx.now;
    applyNeeds(p.needs, ctx.now, { energie: 20 });
    const h = BUILDING_BY_ID.hopital || BUILDINGS.find((b) => b.interior === 'hospital');
    const at = h ? { x: h.door.x, z: h.door.z } : null;
    if (ctx.pos && at) { ctx.pos.x = at.x; ctx.pos.z = at.z; } // téléportation décidée par l'autorité
    return { ok: true, changed: true, data: { bill, paid, at } };
  },

  'hospital.treat'(ctx) {
    const p = ctx.profile, b = p.body;
    if (!atKind(this, ctx, 'hospital')) return err('Il faut être à l\'hôpital.');
    if (!b.injury && b.health >= 99) return err('Vous êtes en pleine forme ! (Le médecin est presque déçu.)');
    const cost = 40 + (b.injury ? INJURIES[b.injury.kind].care : 0) + Math.round((100 - b.health) * 2);
    if (p.coins < cost) return err(`Les soins coûtent ${cost} PC.`);
    this.addCoins(p, -cost);
    const had = b.injury?.kind || null;
    b.injury = null; b.health = 100; b.hospitalAt = ctx.now;
    return { ok: true, changed: true, data: { cost, healed: had } };
  },

  // ---------------------------------------------------------------- salle de sport
  'gym.pass'(ctx, { kind }) {
    const p = ctx.profile, pass = GYM_PASSES[kind];
    if (!pass) return err('Abonnement inconnu.');
    if (!atKind(this, ctx, 'gym')) return err('Abonnements à l\'accueil de la salle de sport.');
    if (p.coins < pass.price) return err('Pas assez de PlayCoins.');
    this.addCoins(p, -pass.price);
    p.body.gymUntil = Math.max(ctx.now, p.body.gymUntil || 0) + pass.ms;
    return { ok: true, changed: true, data: { until: p.body.gymUntil } };
  },

  'gym.start'(ctx, { machine }) {
    const p = ctx.profile;
    if (!MACHINES[machine]) return err('Machine inconnue.');
    if (!atKind(this, ctx, 'gym')) return err('Il faut être à la salle de sport.');
    if ((p.body.gymUntil || 0) < ctx.now) return err('Il faut un abonnement (accueil de la salle).');
    if (p.body.injury && p.body.injury.kind !== 'bosse') return err('Pas de sport avec une blessure ! Passe d\'abord à l\'hôpital.');
    ctx.session.machine = { id: machine, at: ctx.now };
    return { ok: true, changed: false, data: {} };
  },

  'gym.stop'(ctx) {
    const p = ctx.profile, m = ctx.session.machine;
    if (!m) return err('Aucune machine en marche.');
    ctx.session.machine = null;
    const mins = Math.min(MACHINE_MAX_MIN, (ctx.now - m.at) / 60_000);
    if (!atKind(this, ctx, 'gym')) return err('Tu as quitté la salle : séance perdue.');
    const st = needsStatus(p.needs, ctx.now);
    const k = Math.min(mins, st.energie / Math.abs(MACHINES[m.id].energie)); // on s'arrête quand on n'a plus d'énergie
    const before = { muscle: p.body.muscle, weight: p.body.weight };
    train(p, MACHINES[m.id], k, ctx.now);
    if (k >= 1) this.addXp(p, Math.round(k * 2));
    return { ok: true, changed: true, data: { minutes: Math.round(k * 10) / 10, muscle: p.body.muscle - before.muscle, weight: p.body.weight - before.weight, needs: needsStatus(p.needs, ctx.now) } };
  },

  // Pompes (partout) : le rythme est limité (une pompe toutes les 0,6 s au plus).
  'body.pushups'(ctx, { reps }) {
    const p = ctx.profile, s = ctx.session;
    const last = s.pushAt || ctx.now - 30_000;
    const k = Math.max(0, Math.min(30, Math.floor(num(reps)), Math.floor((ctx.now - last) / 600) + 1));
    s.pushAt = ctx.now;
    if (!k) return err('Pas si vite !');
    if (p.body.injury?.kind === 'fracture') return err('Avec un bras cassé ? Non.');
    train(p, PUSHUP_GAIN, k, ctx.now);
    p.stats.pushups = (p.stats.pushups || 0) + k;
    return { ok: true, changed: true, data: { reps: k, muscle: p.body.muscle, needs: needsStatus(p.needs, ctx.now) } };
  },

  // ---------------------------------------------------------------- apparence
  'hair.cut'(ctx, { hair, hairColor }) {
    const p = ctx.profile, a = p.appearance;
    if (!this.atBuilding(ctx, BUILDING_BY_ID.coiffeur, 1)) return err('Il faut être chez le coiffeur.');
    if (!HAIR_STYLES.includes(hair) || !HAIR_COLORS.includes(hairColor)) return err('Coupe inconnue.');
    const cut = hair !== a.hair, color = hairColor !== a.hairColor;
    const price = cut && color ? HAIR_PRICES.both : color ? HAIR_PRICES.couleur : HAIR_PRICES.coupe;
    if (p.coins < price) return err(`Il faut ${price} PC.`);
    this.addCoins(p, -price);
    a.hair = hair; a.hairColor = hairColor;
    p.body.haircutAt = ctx.now;
    return { ok: true, changed: true, data: { price } };
  },

  'perfume.use'(ctx, { itemId }) {
    const p = ctx.profile, it = this.content.items[itemId];
    if (!it?.perfume) return err('Ce n\'est pas un parfum.');
    if (!(p.inventory[itemId] > 0)) return err('Flacon vide !');
    p.inventory[itemId]--;
    p.body.perfumeUntil = Math.max(ctx.now, p.body.perfumeUntil || 0) + it.perfume * 60_000;
    if (it.antiAge) { p.body.ageMins = Math.max(0, p.body.ageMins - it.antiAge); }
    return { ok: true, changed: true, data: { until: p.body.perfumeUntil } };
  },

  // Soins sans ordonnance (pansements, antidouleurs).
  'body.heal'(ctx, { itemId }) {
    const p = ctx.profile, it = this.content.items[itemId];
    if (!it?.heal) return err('Ce n\'est pas un soin.');
    if (!(p.inventory[itemId] > 0)) return err('Tu n\'en as plus.');
    p.inventory[itemId]--;
    if (p.body.injury && it.cures?.includes(p.body.injury.kind)) p.body.injury = null;
    const cap = p.body.injury ? 100 - INJURIES[p.body.injury.kind].health : 100;
    p.body.health = Math.min(cap, p.body.health + it.heal);
    return { ok: true, changed: true, data: { health: p.body.health } };
  },

  'body.shirt'(ctx, { off }) {
    ctx.profile.body.shirtless = !!off;
    return { ok: true, changed: true, data: {} };
  },

  // Clinique (à l'hôpital) : figer son âge ou le choisir.
  'clinic.age'(ctx, { action, age }) {
    const p = ctx.profile, b = p.body;
    if (!atKind(this, ctx, 'hospital')) return err('La clinique est à l\'hôpital.');
    if (action === 'freeze') {
      if (b.ageFrozen) return err('Ton âge est déjà figé.');
      if (p.coins < CLINIC.freeze) return err(`Le traitement coûte ${CLINIC.freeze} PC.`);
      this.addCoins(p, -CLINIC.freeze); b.ageFrozen = true;
    } else if (action === 'unfreeze') b.ageFrozen = false;
    else if (action === 'choose') {
      const a = Math.floor(num(age));
      if (a < 18 || a > 70) return err('Âge entre 18 et 70 ans.');
      if (p.coins < CLINIC.choose) return err(`Le traitement coûte ${CLINIC.choose} PC.`);
      this.addCoins(p, -CLINIC.choose); b.age = a; b.ageMins = 0;
    } else return err('Action inconnue.');
    return { ok: true, changed: true, data: { age: b.age, frozen: b.ageFrozen } };
  },
};
