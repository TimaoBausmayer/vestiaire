// AUTORITÉ — MODE ADMIN : un code tapé dans l'appli Carte du téléphone (ou au guichet de la mairie)
// donne tous les pouvoirs, partout, même en prison.
// En solo, le code ci-dessous suffit. En ligne, le serveur n'accepte un code que s'il a été configuré
// (variable d'environnement PLAYZONE_ADMIN_CODE) : un joueur ne peut pas s'en servir pour tricher.
import { MAX_COINS, levelFromXp, xpForLevel, MAX_LEVEL } from './rules.js';
import { WORLD_BOUNDS } from './world-layout.js';
import { teleportCost } from './teleport.js';

export const SOLO_ADMIN_CODE = 'Timao3049Bausmayer';
const err = (error) => ({ ok: false, error });
const norm = (c) => String(c || '').trim().toUpperCase();

// Remet l'argent au maximum (« argent illimité ») ; appelé après chaque action d'un admin.
export function adminTopUp(p, now = Date.now()) {
  if (!p?.admin) return;
  p.coins = MAX_COINS;
  p.cash = Math.max(p.cash || 0, 100_000);
  p.debt = 0;
  // ni faim, ni fatigue, ni blessure : toujours en pleine forme
  if (p.needs) p.needs = { ...p.needs, faim: 100, energie: 100, humeur: 100, hygiene: 100, at: now };
  if (p.body) { p.body.health = 100; p.body.injury = null; }
}

export const ADMIN_HANDLERS = {
  // Téléportation payante (gratuite pour l'admin). Interdite en prison, recherché·e par la police, ou au tribunal.
  'teleport'(ctx, { x, z }) {
    const p = ctx.profile, B = WORLD_BOUNDS;
    if (typeof x !== 'number' || typeof z !== 'number' || !Number.isFinite(x) || !Number.isFinite(z)) return err('Destination invalide.');
    if (x < B.minX || x > B.maxX || z < B.minZ || z > B.maxZ) return err('Hors de la carte !');
    if (p.justice?.jail && !p.admin) return err('Pas de téléportation depuis la prison (essaie le gardien...).');
    if (p.justice?.court) return err('L\'audience n\'est pas finie !');
    if ((p.justice?.stars || 0) > 0 && !p.admin) return err('La police te recherche : la téléportation est bloquée.');
    const cost = p.admin ? 0 : teleportCost(ctx.pos, { x, z });
    if (p.coins < cost) return err(`La téléportation coûte ${cost} PC.`);
    this.addCoins(p, -cost);
    if (ctx.pos) { ctx.pos.x = x; ctx.pos.z = z; }
    if (ctx.session) { ctx.session.stolen = null; }
    return { ok: true, changed: true, data: { cost, at: { x, z } } };
  },
  'admin.unlock'(ctx, { code }) {
    const p = ctx.profile;
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
    else if (power === 'clean' || power === 'escape') { p.justice.stars = 0; p.justice.jail = null; ctx.session.stolen = null; }
    else if (power === 'heal') { p.body.health = 100; p.body.injury = null; for (const k of ['faim', 'energie', 'humeur', 'hygiene']) if (p.needs[k] !== undefined) p.needs[k] = 100; }
    else return err('Pouvoir inconnu.');
    adminTopUp(p);
    return { ok: true, changed: true, data: { power } };
  },
};
