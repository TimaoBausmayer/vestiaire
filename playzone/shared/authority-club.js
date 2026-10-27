// AUTORITÉ — BOÎTES DE NUIT : danser (score de rythme), cocktails sans alcool, carré VIP, DJ.
import { BUILDINGS } from './world-layout.js';
import { applyNeeds, needsStatus } from './needs.js';

const err = (error) => ({ ok: false, error });
const atClub = (self, ctx) => BUILDINGS.some((b) => b.interior === 'club' && self.atBuilding(ctx, b, 1));
export const CLUB = { cocktail: 12, vip: 200, danceMax: 30 };
export const COCKTAILS = ['PLAYZONE Sunrise', 'Mojito sans rhum (donc limonade menthe)', 'Pina Colada des Mouettes', 'Bubble Tea Disco', 'Smoothie Banane-Paillettes', 'Diabolo Fraise Royal'];
const CD = { cocktail: 20_000, vip: 10 * 60_000, dj: 15_000, dance: 15_000 };

export const CLUB_HANDLERS = {
  'club.do'(ctx, { kind, score }) {
    const p = ctx.profile;
    if (!CD[kind]) return err('Action inconnue.');
    if (!atClub(this, ctx)) return err('Il faut être dans une boîte de nuit.');
    const key = `club:${kind}`, wait = (p.cooldowns[key] || 0) + CD[kind] - ctx.now;
    if (wait > 0 && !p.admin) return err(`Encore ${Math.ceil(wait / 1000)} s.`);
    const data = {};
    if (kind === 'cocktail' || kind === 'vip') {
      const cost = p.admin ? 0 : CLUB[kind];
      if (p.coins < cost) return err(`Il faut ${CLUB[kind]} PC.`);
      this.addCoins(p, -cost); data.cost = cost;
    }
    p.cooldowns[key] = ctx.now;
    if (kind === 'cocktail') { applyNeeds(p.needs, ctx.now, { humeur: 8, faim: 4, energie: 6 }); data.drink = COCKTAILS[Math.floor(ctx.rand() * COCKTAILS.length)]; }
    else if (kind === 'vip') { applyNeeds(p.needs, ctx.now, { humeur: 30, energie: 10 }); p.stats.vip = (p.stats.vip || 0) + 1; p.rep = (p.rep || 0) + 2; }
    else if (kind === 'dj') applyNeeds(p.needs, ctx.now, { humeur: 3 });
    else {
      const sc = Math.max(0, Math.min(CLUB.danceMax, Math.floor(Number(score) || 0)));
      applyNeeds(p.needs, ctx.now, { humeur: 5 + sc * 0.6, energie: -6, hygiene: -6, faim: -3 });
      if (sc > 0) this.addXp?.(p, sc);
      if (sc >= 22) p.rep = (p.rep || 0) + 1;
      p.stats.danceBest = Math.max(p.stats.danceBest || 0, sc);
      Object.assign(data, { score: sc, best: p.stats.danceBest, star: sc >= 22 });
    }
    data.needs = needsStatus(p.needs, ctx.now);
    return { ok: true, changed: true, data };
  },
};
