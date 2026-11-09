// AUTORITÉ — BOÎTES DE NUIT : danser (score de rythme), cocktails sans alcool, carré VIP, DJ.
import { BUILDINGS } from './world-layout.js';
import { applyNeeds, needsStatus } from './needs.js';

const err = (error) => ({ ok: false, error });
const atClub = (self, ctx) => BUILDINGS.some((b) => (b.interior === 'club' || b.interior === 'megaclub') && self.atBuilding(ctx, b, 1));
export const CLUB = { cocktail: 12, vip: 200, danceMax: 30, vipMs: 10 * 60_000 };
// Service bouteilles du carré VIP (bulles SANS alcool, comme tout le bar) : plus elle est grosse,
// plus le spectacle est beau (cierges magiques) et plus les fêtardes qui te rejoignent craquent pour toi.
export const BOTTLES = {
  bulles: { name: 'Bouteille de bulles (sans alcool)', emoji: '🍾', price: 150, aff: 8, girls: 2 },
  magnum: { name: 'Magnum de bulles avec cierges magiques', emoji: '✨', price: 500, aff: 15, girls: 3 },
  jeroboam: { name: 'Jéroboam géant, show lumière et confettis', emoji: '🎆', price: 2000, aff: 25, girls: 4 },
};
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
    else if (kind === 'vip') { applyNeeds(p.needs, ctx.now, { humeur: 30, energie: 10 }); p.stats.vip = (p.stats.vip || 0) + 1; p.rep = (p.rep || 0) + 2; p.vipUntil = ctx.now + CLUB.vipMs; data.until = p.vipUntil; }
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
  // bouteille au carré VIP : les fêtardes (ids envoyés par le client, préfixe « club: ») te rejoignent
  'club.bottle'(ctx, { size, girls }) {
    const p = ctx.profile, B = BOTTLES[size];
    if (!B) return err('Bouteille inconnue.');
    if (!atClub(this, ctx)) return err('Il faut être dans une boîte de nuit.');
    if (!(p.vipUntil > ctx.now) && !p.admin) return err('Réserve d\'abord le carré VIP.');
    const cost = p.admin ? 0 : B.price;
    if (p.coins < cost) return err(`Il faut ${B.price} PC.`);
    const wait = (p.cooldowns['club:bottle'] || 0) + 30_000 - ctx.now;
    if (wait > 0 && !p.admin) return err(`Encore ${Math.ceil(wait / 1000)} s.`);
    p.cooldowns['club:bottle'] = ctx.now;
    this.addCoins(p, -cost);
    p.love = { aff: {}, partner: null, married: false, since: 0, dates: 0, cd: {}, ...(p.love || {}) };
    const ids = (Array.isArray(girls) ? girls : []).map((x) => String(x).slice(0, 60)).filter((x) => x.startsWith('club:')).slice(0, B.girls);
    const affs = {};
    for (const id of ids) { p.love.aff[id] = Math.min(100, (p.love.aff[id] || 0) + B.aff); affs[id] = p.love.aff[id]; }
    applyNeeds(p.needs, ctx.now, { humeur: 20 });
    p.rep = (p.rep || 0) + (size === 'jeroboam' ? 5 : 1);
    return { ok: true, changed: true, data: { cost, affs, bottle: B.name } };
  },
};
