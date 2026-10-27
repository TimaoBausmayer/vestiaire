// AUTORITÉ — ÎLES : navette en bateau (depuis un ponton), merveilles découvertes (récompenses).
import { ISLANDS, ISLAND_BY_ID, islandDock, FERRY, SIGHTS, SIGHT_BY_ID, SIGHT_REWARD } from './islands.js';
import { applyNeeds, needsStatus } from './needs.js';

const err = (error) => ({ ok: false, error });
const near = (pos, x, z, r) => pos && Math.hypot(pos.x - x, pos.z - z) <= r;
const atAnyDock = (pos) => near(pos, FERRY.dock.x, FERRY.dock.z, FERRY.r + 3) || ISLANDS.some((I) => { const D = islandDock(I); return near(pos, D.x, D.z - 1, 8); });

export const ISLAND_HANDLERS = {
  'ferry.go'(ctx, { to }) {
    const p = ctx.profile;
    if (!atAnyDock(ctx.pos)) return err('La navette part des pontons (bout du ponton de la Plage des Orteils, ou ponton de chaque île).');
    if (p.justice?.jail) return err('Pas de croisière en prison.');
    let dest;
    if (to === 'port') dest = { x: FERRY.dock.x, z: FERRY.dock.z - 6, yaw: Math.PI };
    else { const I = ISLAND_BY_ID[to]; if (!I) return err('Destination inconnue.'); const D = islandDock(I); dest = { x: D.x, z: D.z + 2, yaw: 0 }; }
    const cost = p.admin ? 0 : FERRY.price;
    if (p.coins < cost) return err(`La traversée coûte ${FERRY.price} PC.`);
    this.addCoins(p, -cost);
    return { ok: true, changed: true, data: { ...dest, cost } };
  },

  'sight.visit'(ctx, { id }) {
    const p = ctx.profile, s = SIGHT_BY_ID[id];
    if (!s) return err('Lieu inconnu.');
    if (!near(ctx.pos, s.x, s.z, s.r + 4)) return err('Approche-toi pour admirer la vue.');
    p.wonders = Array.isArray(p.wonders) ? p.wonders : [];
    const data = { found: p.wonders.length };
    if (!p.wonders.includes(id)) {
      p.wonders.push(id);
      this.addCoins(p, SIGHT_REWARD.coins); this.addXp?.(p, SIGHT_REWARD.xp);
      Object.assign(data, { first: true, coins: SIGHT_REWARD.coins, xp: SIGHT_REWARD.xp, found: p.wonders.length });
      if (p.wonders.length === SIGHTS.length) { this.addCoins(p, SIGHT_REWARD.all); data.all = true; data.bonus = SIGHT_REWARD.all; }
    } else {
      const key = `wonder:${id}`, wait = (p.cooldowns[key] || 0) + SIGHT_REWARD.againCd - ctx.now;
      if (wait <= 0) { p.cooldowns[key] = ctx.now; applyNeeds(p.needs, ctx.now, { humeur: SIGHT_REWARD.again }); data.humeur = SIGHT_REWARD.again; }
    }
    // à deux, devant l'arche du cœur ou le coucher de soleil : l'amour grandit
    const L = p.love;
    if (L?.partner && ['arche-coeur', 'ponton'].includes(id)) {
      const key = 'wonder:love', wait = (p.cooldowns[key] || 0) + SIGHT_REWARD.againCd - ctx.now;
      if (wait <= 0) { p.cooldowns[key] = ctx.now; L.aff[L.partner.id] = Math.min(100, (L.aff[L.partner.id] || 0) + 5); applyNeeds(p.needs, ctx.now, { humeur: 10 }); data.love = true; }
    }
    data.needs = needsStatus(p.needs, ctx.now);
    return { ok: true, changed: true, data };
  },
};
