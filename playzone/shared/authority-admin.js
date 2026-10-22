// AUTORITÉ — MODE ADMIN : un code tapé au guichet spécial de la mairie donne tous les pouvoirs.
// En solo, le code ci-dessous suffit. En ligne, le serveur n'accepte un code que s'il a été configuré
// (variable d'environnement PLAYZONE_ADMIN_CODE) : un joueur ne peut pas s'en servir pour tricher.
import { BUILDING_BY_ID } from './world-layout.js';
import { MAX_COINS, levelFromXp, xpForLevel, MAX_LEVEL } from './rules.js';

export const SOLO_ADMIN_CODE = 'PZ-ADMIN-2026';
const err = (error) => ({ ok: false, error });
const norm = (c) => String(c || '').trim().toUpperCase();

// Remet l'argent au maximum (« argent illimité ») ; appelé après chaque action d'un admin.
export function adminTopUp(p) {
  if (!p?.admin) return;
  p.coins = MAX_COINS;
  p.cash = Math.max(p.cash || 0, 100_000);
  p.debt = 0;
}

export const ADMIN_HANDLERS = {
  'admin.unlock'(ctx, { code }) {
    const p = ctx.profile;
    if (!this.atBuilding(ctx, BUILDING_BY_ID.mairie, 1)) return err('Le guichet spécial est à la mairie.');
    const expected = ctx.adminCode !== undefined ? ctx.adminCode : SOLO_ADMIN_CODE;
    if (!expected || norm(code) !== norm(expected)) return err('Code incorrect.');
    p.admin = true;
    if (levelFromXp(p.xp) < MAX_LEVEL) p.xp = xpForLevel(MAX_LEVEL);
    p.justice.licence = { ...p.justice.licence, code: true, permis: true, points: 12 };
    adminTopUp(p);
    return { ok: true, changed: true, data: { admin: true } };
  },
  'admin.lock'(ctx) { ctx.profile.admin = false; return { ok: true, changed: true, data: {} }; },
  // Pouvoirs : tout débloquer, effacer les recherches, sortir de prison, soigner, remplir les besoins.
  'admin.power'(ctx, { power }) {
    const p = ctx.profile;
    if (!p.admin) return err('Réservé à l\'admin.');
    if (power === 'items') { for (const [id, it] of Object.entries(this.content.items)) if (!it.consumable && !it.pet && !it.vehicle && !it.special) p.inventory[id] = Math.max(p.inventory[id] || 0, 1); }
    else if (power === 'clean') { p.justice.stars = 0; p.justice.jail = null; ctx.session.stolen = null; }
    else if (power === 'heal') { p.body.health = 100; p.body.injury = null; for (const k of ['faim', 'energie', 'humeur', 'hygiene']) if (p.needs[k] !== undefined) p.needs[k] = 100; }
    else return err('Pouvoir inconnu.');
    adminTopUp(p);
    return { ok: true, changed: true, data: { power } };
  },
};
