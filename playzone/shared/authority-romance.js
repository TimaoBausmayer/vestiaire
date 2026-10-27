// AUTORITÉ — AMOUR : drague, cadeaux, rendez-vous, couple, mariage, câlin à la maison.
import { LOVE, DATES, GIFTS, defaultLove, flirtChance } from './romance.js';
import { attractiveness } from './body.js';
import { applyNeeds, needsStatus } from './needs.js';

const err = (error) => ({ ok: false, error });
const clean = (s, n = 40) => String(s || '').replace(/[<>]/g, '').slice(0, n).trim();
function love(p) {
  p.love = { ...defaultLove(), ...(p.love || {}) };
  return p.love;
}
function bump(L, id, d) {
  L.aff[id] = Math.max(0, Math.min(100, (L.aff[id] || 0) + d));
  const keys = Object.keys(L.aff);
  if (keys.length > LOVE.maxKnown) { keys.sort((a, b) => L.aff[a] - L.aff[b]); for (const k of keys.slice(0, keys.length - LOVE.maxKnown)) if (k !== L.partner?.id) delete L.aff[k]; }
  return L.aff[id];
}
function cool(L, key, ms, now, admin = false) {
  if (admin) return null;   // l'admin n'attend jamais
  const wait = (L.cd[key] || 0) + ms - now;
  if (wait > 0) return `Encore ${Math.ceil(wait / 1000)} s.`;
  L.cd[key] = now;
  return null;
}
const person = (id, name, role) => ({ id: clean(id, 60), name: clean(name), role: clean(role, 60) });

export const ROMANCE_HANDLERS = {
  'love.flirt'(ctx, { id, name }) {
    const p = ctx.profile, L = love(p);
    id = clean(id, 60); if (!id) return err('Personne à qui parler.');
    const w = cool(L, `flirt:${id}`, LOVE.flirtCd, ctx.now, p.admin); if (w) return err(w);
    const att = attractiveness(p, this.content.items, ctx.now, needsStatus(p.needs, ctx.now).hygiene).total;
    const chance = p.admin ? 1 : flirtChance(att, L.aff[id] || 0);
    const yes = ctx.rand() < chance;
    const aff = bump(L, id, yes ? 6 + Math.floor(ctx.rand() * 7) : -3);
    if (yes) applyNeeds(p.needs, ctx.now, { humeur: 4 });
    return { ok: true, changed: true, data: { yes, aff, chance: Math.round(chance * 100), name: clean(name) } };
  },

  'love.gift'(ctx, { id, itemId }) {
    const p = ctx.profile, L = love(p);
    id = clean(id, 60);
    const v = GIFTS[itemId];
    if (!v) return err('Ce n\'est pas un cadeau.');
    if ((p.inventory[itemId] || 0) < 1) return err('Tu n\'as pas cet objet.');
    const w = cool(L, `gift:${id}`, 15_000, ctx.now, p.admin); if (w) return err(w);
    p.inventory[itemId] -= 1;
    if (p.inventory[itemId] <= 0) delete p.inventory[itemId];
    return { ok: true, changed: true, data: { aff: bump(L, id, v), gain: v } };
  },

  'love.date'(ctx, { id, kind }) {
    const p = ctx.profile, L = love(p), D = DATES[kind];
    id = clean(id, 60);
    if (!D) return err('Rendez-vous inconnu.');
    if ((L.aff[id] || 0) < LOVE.dateMin) return err('Faites d\'abord un peu connaissance (complimente, offre un cadeau).');
    const cost = p.admin ? 0 : D.price;
    if (p.coins < cost) return err(`Il faut ${D.price} PC.`);
    const w = cool(L, `date:${id}`, LOVE.dateCd, ctx.now, p.admin); if (w) return err(w);
    this.addCoins(p, -cost);
    L.dates += 1;
    applyNeeds(p.needs, ctx.now, { humeur: D.humeur, ...(kind === 'resto' ? { faim: 40 } : kind === 'cafe' ? { energie: 10 } : {}) });
    return { ok: true, changed: true, data: { aff: bump(L, id, D.aff), cost, needs: needsStatus(p.needs, ctx.now) } };
  },

  'love.ask'(ctx, { id, name, role }) {
    const p = ctx.profile, L = love(p);
    id = clean(id, 60);
    if (L.partner?.id === id) return err('Vous êtes déjà ensemble 💞');
    if (L.partner) return err(`Tu es déjà en couple avec ${L.partner.name} !`);
    if ((L.aff[id] || 0) < LOVE.couple) return { ok: true, changed: false, data: { yes: false, aff: L.aff[id] || 0 } };
    L.partner = person(id, name, role); L.since = ctx.now; L.married = false;
    applyNeeds(p.needs, ctx.now, { humeur: 30 });
    return { ok: true, changed: true, data: { yes: true, partner: L.partner } };
  },

  'love.propose'(ctx) {
    const p = ctx.profile, L = love(p);
    if (!L.partner) return err('Il faut d\'abord être en couple.');
    if (L.married) return err('Vous êtes déjà marié·es 💍');
    if ((p.inventory['bague-diamant'] || 0) < 1) return err('Il te faut une bague en diamant (bijouterie).');
    if ((L.aff[L.partner.id] || 0) < LOVE.marry) return { ok: true, changed: false, data: { yes: false, aff: L.aff[L.partner.id] || 0 } };
    p.inventory['bague-diamant'] -= 1;
    if (p.inventory['bague-diamant'] <= 0) delete p.inventory['bague-diamant'];
    L.married = true;
    applyNeeds(p.needs, ctx.now, { humeur: 50 });
    return { ok: true, changed: true, data: { yes: true } };
  },

  'love.breakup'(ctx) {
    const p = ctx.profile, L = love(p);
    if (!L.partner) return err('Tu n\'es pas en couple.');
    const was = L.partner;
    bump(L, was.id, -40);
    L.partner = null; L.married = false; L.since = 0;
    return { ok: true, changed: true, data: { was } };
  },

  // Moment à deux (câlin, discussion sur le canapé...) : la meilleure détente du jeu.
  'love.cuddle'(ctx) {
    const p = ctx.profile, L = love(p);
    if (!L.partner) return err('Tu n\'es pas en couple.');
    const w = cool(L, 'cuddle', LOVE.cuddleCd, ctx.now, p.admin); if (w) return err(w);
    applyNeeds(p.needs, ctx.now, { humeur: 25, energie: 5 });
    return { ok: true, changed: true, data: { aff: bump(L, L.partner.id, 3), needs: needsStatus(p.needs, ctx.now) } };
  },
};
