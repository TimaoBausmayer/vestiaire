// AUTORITÉ — ENTREPRISES, MARQUE DE VÊTEMENTS, BOURSE, INVESTISSEMENTS.
// Fonctions appelées avec `this` = l'Authority. En ligne, ctx.companies (fourni par le serveur) permet
// d'investir dans les entreprises des autres joueurs ; en solo, on investit en bourse.
import { BUILDING_BY_ID } from './world-layout.js';
import { isClean } from './chat-filter.js';
import { COLORS } from './appearance.js';
import {
  SECTORS, COMPANY_MIN_CAPITAL, COMPANY_FEE, BANKRUPT_AT, MAX_STAFF, MAX_FLOAT, upgradeCost, companyHour, companyValue, sharePrice,
  STOCK_BY_SYM, STOCK_FEE, stockPrice, BRAND_STYLES, BRAND_COST,
} from './business.js';

const err = (error) => ({ ok: false, error });
const int = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : 0);
const NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9 '&.-]{3,24}$/;

// Fait tourner l'entreprise pendant `mins` minutes de jeu du patron (appelé par bills.tick).
export function companyTick(self, ctx, mins) {
  const p = ctx.profile, c = p.company;
  if (!c || c.bankrupt || mins <= 0) return null;
  const h = companyHour(c, ctx.now);
  const delta = (h.profit * mins) / 10; // une heure de jeu = 10 minutes
  c.cash = Math.round((c.cash + delta) * 100) / 100;
  c.revenue = (c.revenue || 0) + (h.revenue * mins) / 10;
  c.rep = Math.max(-60, Math.min(90, c.rep + (h.profit > 0 ? 0.03 : -0.05) * mins + (h.clients > 15 + c.staff * 30 - 1 ? -0.02 * mins : 0)));
  c.acc = (c.acc || 0) + mins;
  if (c.acc >= 10) { c.acc -= 10; c.history.push({ at: ctx.now, profit: h.profit, cash: Math.round(c.cash), clients: h.clients }); if (c.history.length > 24) c.history.shift(); }
  ctx.companies?.update(c, p);
  if (c.cash < BANKRUPT_AT) {
    c.bankrupt = true;
    c.closedAt = ctx.now;
    p.rep = Math.max(0, p.rep - 20);
    p.career.history.push({ id: 'patron', building: c.name, from: c.created, to: ctx.now, end: 'faillite' });
    ctx.companies?.update(c, p);
    return { bankrupt: true };
  }
  return { profit: Math.round(delta) };
}

const company = (p) => (p.company && !p.company.bankrupt ? p.company : null);

export const BUSINESS_HANDLERS = {
  // ---------------------------------------------------------------- créer et gérer son entreprise
  'company.create'(ctx, { name, sector, capital }) {
    const p = ctx.profile;
    if (company(p)) return err('Tu diriges déjà une entreprise.');
    if (!SECTORS[sector]) return err('Secteur inconnu.');
    const n = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
    if (!NAME_RE.test(n) || !isClean(n)) return err('Nom d\'entreprise invalide (3 à 24 caractères).');
    const cap = int(capital);
    if (cap < COMPANY_MIN_CAPITAL) return err(`Capital minimum : ${COMPANY_MIN_CAPITAL} PC.`);
    const mairie = BUILDING_BY_ID.mairie;
    if (!this.atBuilding(ctx, mairie, 2)) return err('L\'immatriculation se fait à la mairie.');
    if (p.coins < cap + COMPANY_FEE) return err(`Il faut ${cap + COMPANY_FEE} PC (capital + ${COMPANY_FEE} PC de frais).`);
    this.addCoins(p, -(cap + COMPANY_FEE));
    p.company = { id: ctx.newId(), name: n, sector, cash: cap, capital: cap, staff: 1, quality: 0, marketing: 1, rep: 0, created: ctx.now, bankrupt: false, history: [], collections: [], float: 0, sold: 0, revenue: 0 };
    ctx.companies?.update(p.company, p);
    return { ok: true, changed: true, data: { company: p.company } };
  },

  'company.manage'(ctx, { action, value }) {
    const p = ctx.profile, c = company(p);
    if (!c) return err('Tu n\'as pas d\'entreprise.');
    const v = int(value);
    switch (action) {
      case 'staff': {
        const n = Math.max(0, Math.min(MAX_STAFF, c.staff + (v > 0 ? 1 : -1)));
        if (n === c.staff) return err(v > 0 ? 'Effectif maximum.' : 'Plus personne à licencier.');
        if (v < 0) c.cash -= SECTORS[c.sector].wage * 2; // indemnités de départ
        c.staff = n; break;
      }
      case 'marketing': if (v < 0 || v > 5) return err('Niveau 0 à 5.'); c.marketing = v; break;
      case 'quality': {
        if (c.quality >= 5) return err('Qualité maximale.');
        const cost = upgradeCost(c.quality);
        if (c.cash < cost) return err(`Il faut ${cost} PC dans la trésorerie.`);
        c.cash -= cost; c.quality++; break;
      }
      case 'inject': {
        if (v < 1 || p.coins < v) return err('Montant invalide.');
        this.addCoins(p, -v); c.cash += v; c.capital = (c.capital || 0) + v; break;
      }
      case 'withdraw': {
        if (v < 1 || c.cash - v < 0) return err('Trésorerie insuffisante (elle ne peut pas passer sous 0).');
        c.cash -= v; this.addCoins(p, v); break;
      }
      case 'float': {
        if (!ctx.companies) return err('L\'entrée en bourse n\'existe qu\'en ligne (d\'autres joueurs investissent).');
        if (v < c.sold || v > MAX_FLOAT) return err(`Entre ${c.sold} et ${MAX_FLOAT} actions (49 % max).`);
        c.float = v; break;
      }
      default: return err('Action inconnue.');
    }
    ctx.companies?.update(c, p);
    return { ok: true, changed: true, data: { company: c } };
  },

  // Fermer (vendre) son entreprise : valeur estimée moins la part des investisseurs.
  'company.close'(ctx) {
    const p = ctx.profile, c = p.company;
    if (!c) return err('Tu n\'as pas d\'entreprise.');
    if (c.bankrupt) { p.company = null; return { ok: true, changed: true, data: { gain: 0 } }; }
    if (c.sold > 0) return err('Des investisseurs ont des parts : rachète-les (ou garde l\'entreprise).');
    const gain = Math.round(companyValue(c, ctx.now) * 0.85);
    this.addCoins(p, gain);
    p.career.history.push({ id: 'patron', building: c.name, from: c.created, to: ctx.now, end: 'vente' });
    c.bankrupt = true; c.closedAt = ctx.now; ctx.companies?.update(c, p);
    p.company = null;
    return { ok: true, changed: true, data: { gain } };
  },

  // ---------------------------------------------------------------- marque de vêtements (secteur mode)
  'company.design'(ctx, { name, style, color }) {
    const p = ctx.profile, c = company(p);
    if (!c || c.sector !== 'mode') return err('Il faut diriger une marque de vêtements.');
    const n = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
    if (!NAME_RE.test(n) || !isClean(n)) return err('Nom de modèle invalide.');
    if (!BRAND_STYLES.includes(style) || !COLORS.includes(color)) return err('Modèle invalide.');
    if (c.collections.length >= 8) return err('Collection complète (8 modèles).');
    if (c.cash < BRAND_COST) return err(`Il faut ${BRAND_COST} PC dans la trésorerie (atelier, prototype).`);
    c.cash -= BRAND_COST;
    c.collections.push({ name: n, style, color, at: ctx.now });
    ctx.companies?.update(c, p);
    return { ok: true, changed: true, data: { company: c } };
  },

  'company.wear'(ctx, { index }) {
    const p = ctx.profile, c = company(p);
    const d = c?.collections?.[int(index)];
    if (!d) return err('Modèle introuvable.');
    p.appearance.top = d.style; p.appearance.topColor = d.color;
    p.brandWorn = { brand: c.name, name: d.name };
    return { ok: true, changed: true, data: { appearance: p.appearance } };
  },

  // ---------------------------------------------------------------- bourse
  'stock.buy'(ctx, { sym, n }) {
    const p = ctx.profile, s = STOCK_BY_SYM[sym], k = int(n);
    if (!s || k < 1 || k > 10_000) return err('Ordre invalide.');
    const price = stockPrice(sym, ctx.now);
    const cost = Math.ceil(price * k * (1 + STOCK_FEE));
    if (p.coins < cost) return err('Pas assez de PlayCoins.');
    this.addCoins(p, -cost);
    p.stocks ||= {};
    const pos = p.stocks[sym] ||= { n: 0, cost: 0 };
    pos.n += k; pos.cost += cost;
    return { ok: true, changed: true, data: { price, cost } };
  },

  'stock.sell'(ctx, { sym, n }) {
    const p = ctx.profile, k = int(n), pos = p.stocks?.[sym];
    if (!pos || k < 1 || k > pos.n) return err('Tu n\'as pas autant d\'actions.');
    const price = stockPrice(sym, ctx.now);
    const gain = Math.floor(price * k * (1 - STOCK_FEE));
    pos.cost = Math.round(pos.cost * (1 - k / pos.n));
    pos.n -= k;
    if (!pos.n) delete p.stocks[sym];
    this.addCoins(p, gain);
    return { ok: true, changed: true, data: { price, gain } };
  },

  // ---------------------------------------------------------------- investir dans les entreprises des joueurs (en ligne)
  'invest.buy'(ctx, { companyId, n }) {
    const p = ctx.profile, k = int(n);
    if (!ctx.companies) return err('Investir dans les entreprises des joueurs se fait en ligne.');
    const info = ctx.companies.get(companyId);
    if (!info || info.company.bankrupt) return err('Entreprise introuvable ou fermée.');
    if (info.ownerId === p.id) return err('C\'est ta propre entreprise !');
    const c = info.company;
    if (k < 1 || c.sold + k > c.float) return err(`Il reste ${Math.max(0, c.float - c.sold)} action(s) à vendre.`);
    const price = sharePrice(c, ctx.now), cost = Math.ceil(price * k);
    if (p.coins < cost) return err('Pas assez de PlayCoins.');
    this.addCoins(p, -cost);
    ctx.companies.adjust(companyId, cost, k);
    p.investments ||= {};
    const pos = p.investments[companyId] ||= { n: 0, cost: 0, name: c.name };
    pos.n += k; pos.cost += cost;
    return { ok: true, changed: true, data: { price, cost } };
  },

  'invest.sell'(ctx, { companyId, n }) {
    const p = ctx.profile, k = int(n), pos = p.investments?.[companyId];
    if (!pos || k < 1 || k > pos.n) return err('Tu n\'as pas autant de parts.');
    if (!ctx.companies) return err('En ligne seulement.');
    const info = ctx.companies.get(companyId);
    if (!info || info.company.bankrupt) { delete p.investments[companyId]; return { ok: true, changed: true, data: { gain: 0, bankrupt: true } }; }
    const price = sharePrice(info.company, ctx.now), gain = Math.floor(price * k);
    if (info.company.cash < gain) return err('La trésorerie de l\'entreprise ne peut pas racheter tes parts pour le moment.');
    ctx.companies.adjust(companyId, -gain, -k);
    pos.cost = Math.round(pos.cost * (1 - k / pos.n));
    pos.n -= k;
    if (!pos.n) delete p.investments[companyId];
    this.addCoins(p, gain);
    return { ok: true, changed: true, data: { price, gain } };
  },
};
