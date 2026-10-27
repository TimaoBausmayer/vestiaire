// AUTORITÉ — PARCS, ZOO ET MUSÉE : petites activités qui font du bien (balançoire, toboggan, basket,
// glace, vœu à la fontaine, observer les animaux, admirer les œuvres).
import { PARKS, ZOO } from './city.js';
import { BUILDING_BY_ID } from './world-layout.js';
import { ZOO_PENS } from './content/animals.js';
import { applyNeeds, needsStatus } from './needs.js';

const err = (error) => ({ ok: false, error });
const inRect = (pos, R, m) => pos && Math.abs(pos.x - R.x) <= R.w / 2 + m && Math.abs(pos.z - R.z) <= R.d / 2 + m;
const PARK_KINDS = { balancoire: 'jeux', toboggan: 'jeux', basket: 'basket', voeu: 'fontaine', glace: null };
export const ARTWORKS = ['joconde', 'cri', 'nympheas', 'dino', 'statue', 'baguette', 'nuit', 'pigeon'];

export const PARK_HANDLERS = {
  'park.play'(ctx, { kind, art }) {
    const p = ctx.profile;
    kind = String(kind || '');
    const zooSp = kind.startsWith('zoo:') ? kind.slice(4) : null;
    if (zooSp) { if (!ZOO_PENS.some((z) => z[0] === zooSp)) return err('Animal inconnu.'); if (!inRect(ctx.pos, ZOO, 4)) return err('Il faut être au zoo.'); }
    else if (kind === 'musee') { if (!this.atBuilding(ctx, BUILDING_BY_ID.musee, 1)) return err('Il faut être au musée.'); }
    else if (kind in PARK_KINDS) {
      const want = PARK_KINDS[kind];
      if (!PARKS.some((P) => (!want || P.kind === want) && inRect(ctx.pos, P, 4))) return err('Il faut être dans un parc qui a ce jeu.');
    } else return err('Activité inconnue.');
    const key = `park:${zooSp ? 'zoo' : kind}`, wait = (p.cooldowns[key] || 0) + (kind === 'glace' ? 20_000 : 8_000) - ctx.now;
    if (wait > 0 && !p.admin) return err(`Encore ${Math.ceil(wait / 1000)} s.`);
    const data = {};
    if (kind === 'glace' || kind === 'voeu') {
      const cost = p.admin ? 0 : kind === 'glace' ? 4 : 1;
      if (p.coins < cost) return err(`Il faut ${cost} PC.`);
      this.addCoins(p, -cost);
    }
    p.cooldowns[key] = ctx.now;
    if (kind === 'glace') applyNeeds(p.needs, ctx.now, { faim: 8, humeur: 7 });
    else if (kind === 'basket') { data.made = ctx.rand() < 0.3 + (p.body?.muscle || 0) / 250 + (p.body?.endurance || 0) / 400; applyNeeds(p.needs, ctx.now, { humeur: data.made ? 7 : 3, energie: -2 }); }
    else if (kind === 'voeu') { if (ctx.rand() < 0.02) { data.jackpot = 100; this.addCoins(p, 100); } applyNeeds(p.needs, ctx.now, { humeur: 5 }); }
    else applyNeeds(p.needs, ctx.now, { humeur: 6 });
    // découvertes : chaque animal du zoo, chaque œuvre du musée (XP la première fois)
    const disc = zooSp ? `zoo:${zooSp}` : kind === 'musee' && ARTWORKS.includes(art) ? `art:${art}` : null;
    if (disc) {
      p.discovered = Array.isArray(p.discovered) ? p.discovered : [];
      if (!p.discovered.includes(disc)) { p.discovered.push(disc); this.addXp?.(p, 20); data.first = true; data.xp = 20; }
    }
    data.needs = needsStatus(p.needs, ctx.now);
    return { ok: true, changed: true, data };
  },
};
