// AUTORITÉ — FONDS MARINS : location du sous-marin (Centre de plongée), coffre au trésor de l'épave
// (une fois par jour réel), découverte des spots de plongée (XP la première fois).
import { REEFS, TREASURE, SUBMARINE, DIVE_CENTER, treasureDay } from './sea.js';
import { BUILDING_BY_ID } from './world-layout.js';

const err = (error) => ({ ok: false, error });
const seaOf = (p) => { p.sea = { seen: [], treasure: -1, found: 0, dives: 0, ...(p.sea || {}) }; return p.sea; };
export const SUB_LAUNCH = { x: -380, z: 150 };

export const SEA_HANDLERS = {
  'sub.start'(ctx) {
    const p = ctx.profile, S = seaOf(p);
    if (p.justice?.jail) return err('Pas depuis la prison !');
    if (!this.atBuilding(ctx, BUILDING_BY_ID[DIVE_CENTER], 10)) return err('Le sous-marin se loue au Centre de plongée (plage ouest).');
    const cost = p.admin ? 0 : SUBMARINE.rent;
    if (p.coins < cost) return err(`Location : ${SUBMARINE.rent} PC.`);
    this.addCoins(p, -cost);
    S.dives++;
    ctx.session.sub = { at: ctx.now, until: ctx.now + SUBMARINE.minutes * 60_000 };
    if (ctx.pos) { ctx.pos.x = SUB_LAUNCH.x; ctx.pos.z = SUB_LAUNCH.z; }
    return { ok: true, changed: true, data: { cost, at: SUB_LAUNCH, until: ctx.session.sub.until } };
  },
  'sub.end'(ctx) { ctx.session.sub = null; return { ok: true, changed: false, data: {} }; },
  // premier passage sur un spot : XP et entrée dans le carnet de plongée
  'sea.discover'(ctx, { id }) {
    const p = ctx.profile, S = seaOf(p), reef = REEFS.find((r) => r.id === id);
    if (!reef) return err('Spot inconnu.');
    if (ctx.pos && Math.hypot(ctx.pos.x - reef.x, ctx.pos.z - reef.z) > reef.r * 1.6) return err('Trop loin du spot.');
    if (S.seen.includes(id)) return { ok: true, changed: false, data: { already: true } };
    S.seen.push(id);
    this.addXp(p, 25);
    return { ok: true, changed: true, data: { name: reef.name, count: S.seen.length, of: REEFS.length } };
  },
  'sea.treasure'(ctx) {
    const p = ctx.profile, S = seaOf(p), day = treasureDay(ctx.now);
    if (ctx.pos && Math.hypot(ctx.pos.x - TREASURE.x, ctx.pos.z - TREASURE.z) > 6) return err('Le coffre est au fond, près de l\'épave.');
    if (S.treasure === day) return err('Le coffre est vide... il se remplit chaque jour (mystère des abysses).');
    S.treasure = day;
    const gain = Math.round(TREASURE.min + ctx.rand() * (TREASURE.max - TREASURE.min));
    S.found += gain;
    this.addCoins(p, gain);
    this.addXp(p, 15);
    return { ok: true, changed: true, data: { gain } };
  },
};
