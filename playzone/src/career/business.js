import { h, clear } from '../ui/dom.js';
import { COLORS } from '../../shared/appearance.js';
import {
  SECTORS, COMPANY_MIN_CAPITAL, COMPANY_FEE, BANKRUPT_AT, MAX_FLOAT, upgradeCost, marketingCost, companyHour, companyValue, sharePrice,
  STOCKS, STOCK_FEE, stockPrice, marketNews, BRAND_STYLES, BRAND_COST,
} from '../../shared/business.js';
import { TOP_LABELS } from '../../shared/appearance.js';

// BUSINESS (côté client) : créer son entreprise à la mairie, la gérer depuis l'appli Business
// (personnel, qualité, publicité, trésorerie, marque de vêtements), bourse avec actualités, investir
// dans les entreprises des autres joueurs (en ligne).

const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
const pct = (a, b) => (b ? ((a - b) / b) * 100 : 0);

async function req(g, type, payload, ok) {
  try { const r = await g.net.request(type, payload); g.sfx('cash'); if (ok) g.ui.toast(ok(r), 'money', 3500); return r; } catch (e) { g.sfx('error'); g.ui.toast(e.message, 'bad', 4000); return null; }
}

// Petit graphique de cours (canvas).
function spark(values, w = 110, hgt = 30) {
  const c = h('canvas', { width: w * 2, height: hgt * 2, style: { width: `${w}px`, height: `${hgt}px` } });
  const x = c.getContext('2d');
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  x.lineWidth = 3;
  x.strokeStyle = values.at(-1) >= values[0] ? '#7ac74f' : '#ff5a5f';
  x.beginPath();
  values.forEach((v, i) => { const px = (i / (values.length - 1)) * (w * 2 - 4) + 2, py = hgt * 2 - 4 - ((v - min) / span) * (hgt * 2 - 8); if (i) x.lineTo(px, py); else x.moveTo(px, py); });
  x.stroke();
  return c;
}

// Immatriculation à la mairie.
export function createCompanyPanel(g) {
  let sector = 'restaurant', name = '', capital = COMPANY_MIN_CAPITAL;
  const m = g.ui.modal({
    title: '🏢 Registre du commerce', sub: `Deviens patron·ne : capital minimum ${fmt(COMPANY_MIN_CAPITAL)} PC + ${COMPANY_FEE} PC de frais. L'entreprise tourne pendant que tu joues. Attention à la faillite (trésorerie sous ${fmt(BANKRUPT_AT)} PC) !`,
    build: (body) => {
      if (g.profile.company && !g.profile.company.bankrupt) { body.append(h('p', `Tu diriges déjà ${g.profile.company.name}. Gère-la depuis l'appli Business du téléphone.`)); return; }
      const input = h('input', { type: 'text', maxLength: 24, placeholder: 'Nom de l\'entreprise', value: name, oninput: (e) => { name = e.target.value; } });
      body.append(h('div.field', h('label', 'Nom'), input));
      body.append(h('div.field', h('label', 'Secteur'), h('div.row', { style: { gap: '6px', flexWrap: 'wrap' } }, Object.entries(SECTORS).map(([k, s]) => h(`button.btn.small${sector === k ? '' : '.ghost'}`, { onclick: () => { sector = k; name = input.value; m.refresh(); } }, `${s.emoji} ${s.name}`)))));
      const s = SECTORS[sector];
      body.append(h('p.muted', `${s.name} : panier moyen ${s.ticket} PC, marge ${Math.round(s.margin * 100)} %, salaire d'un employé ${s.wage} PC/h de jeu, loyer ${s.rent} PC/h de jeu.${sector === 'mode' ? ' Tu pourras créer tes propres modèles de vêtements !' : ''}`));
      body.append(h('div.field', h('label', 'Capital de départ'), h('div.row', { style: { gap: '6px', flexWrap: 'wrap' } }, [5000, 10000, 25000, 50000].map((v) => h(`button.btn.small${capital === v ? '' : '.ghost'}`, { onclick: () => { capital = v; name = input.value; m.refresh(); } }, `${fmt(v)} PC`)))));
      body.append(h('button.btn', { onclick: async () => { name = input.value; if (await req(g, 'company.create', { name, sector, capital }, (r) => `🏢 ${r.company.name} est née ! Gère-la depuis l'appli Business.`)) m.close(); } }, `Créer (${fmt(capital + COMPANY_FEE)} PC)`));
    },
  });
}

// Appli Business du téléphone.
export function businessApp(g, b, refresh) {
  const tab = g.phone.businessTab || 'company';
  const go = (t) => { g.phone.businessTab = t; refresh(); };
  b.append(h('div.tabs', [['company', 'Mon entreprise'], ['stocks', 'Bourse'], ['invest', 'Investir']].map(([k, v]) => h(`button.tab${tab === k ? '.active' : ''}`, { onclick: () => go(k) }, v))));
  if (tab === 'company') companyTab(g, b, refresh);
  else if (tab === 'stocks') stocksTab(g, b, refresh);
  else investTab(g, b, refresh);
}

function companyTab(g, b, refresh) {
  const c = g.profile.company, now = g.now();
  if (!c || c.bankrupt) {
    if (c?.bankrupt) b.append(h('p', `💥 ${c.name} a fait faillite. Les dettes ont tout englouti...`));
    b.append(h('p', 'Pas d\'entreprise. Va à la mairie (Registre du commerce) pour en créer une.'));
    return;
  }
  const s = SECTORS[c.sector], hr = companyHour(c, now);
  b.append(h('div.list-item', h('span', { style: { fontSize: '28px' } }, s.emoji), h('div.grow', h('div.t', c.name), h('div.d', `${s.name} · valeur ≈ ${fmt(companyValue(c, now))} PC · réputation ${Math.round(c.rep)}`))));
  b.append(h('div.list-item', h('div.grow',
    h('div.t', `Trésorerie : ${fmt(c.cash)} PC ${c.cash < 0 ? '⚠️' : ''}`),
    h('div.d', `Par heure de jeu : ${hr.clients} clients · CA ${fmt(hr.revenue)} · coûts ${fmt(hr.costs)} · ${hr.profit >= 0 ? 'bénéfice' : 'perte'} ${fmt(hr.profit)} PC`),
    c.history.length > 1 ? spark(c.history.map((x) => x.cash), 200, 34) : null)));
  const row = (label, controls) => b.append(h('div.list-item', h('div.grow', h('div.t', label)), h('div', { style: { display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' } }, controls)));
  const manage = (action, value, ok) => req(g, 'company.manage', { action, value }, ok).then((r) => r && refresh());
  row(`👥 Employés : ${c.staff} (${s.wage} PC/h chacun)`, [h('button.btn.small.ghost', { onclick: () => manage('staff', -1) }, '−'), h('button.btn.small', { onclick: () => manage('staff', 1) }, '+ Embaucher')]);
  row(`📣 Publicité : niveau ${c.marketing} (${marketingCost(c.marketing)} PC/h)`, [0, 1, 2, 3, 4, 5].map((l) => h(`button.btn.small${c.marketing === l ? '' : '.ghost'}`, { onclick: () => manage('marketing', l) }, String(l))));
  row(`⭐ Qualité : ${c.quality}/5`, [h('button.btn.small', { disabled: c.quality >= 5, onclick: () => manage('quality', 0, () => '⭐ Qualité améliorée !') }, c.quality >= 5 ? 'Max' : `Améliorer (${fmt(upgradeCost(c.quality))})`)]);
  row('💰 Trésorerie', [
    h('button.btn.small.ghost', { onclick: () => manage('inject', 1000) }, '+1 000'), h('button.btn.small.ghost', { onclick: () => manage('inject', 10000) }, '+10 000'),
    h('button.btn.small', { disabled: c.cash < 1, onclick: () => manage('withdraw', Math.floor(Math.max(0, c.cash)), (r) => `💸 Dividendes versés : tu as retiré ${fmt(Math.max(0, c.cash))} PC`) }, 'Me verser tout'),
  ]);
  if (g.net.mode === 'online') row(`📈 Actions proposées aux investisseurs : ${c.float} (${c.sold} vendues) · cours ${sharePrice(c, now).toFixed(2)} PC`, [100, 250, MAX_FLOAT].map((v) => h(`button.btn.small${c.float === v ? '' : '.ghost'}`, { onclick: () => manage('float', v) }, String(v))));
  if (c.sector === 'mode') brandSection(g, b, c, refresh);
  b.append(h('button.btn.small.ghost', { style: { marginTop: '10px' }, onclick: async () => {
    if (await g.ui.confirm('Vendre l\'entreprise ?', `Tu touches environ ${fmt(companyValue(c, now) * 0.85)} PC et l'entreprise ferme.`, 'Vendre')) req(g, 'company.close', {}, (r) => `Entreprise vendue : +${fmt(r.gain)} PC`).then(() => refresh());
  } }, 'Vendre / fermer l\'entreprise'));
}

function brandSection(g, b, c, refresh) {
  b.append(h('h4', { style: { marginTop: '12px' } }, `👕 Collection de la marque (${c.collections.length}/8) — chaque modèle attire des clients`));
  c.collections.forEach((d, i) => b.append(h('div.list-item', h('span', { style: { display: 'inline-block', width: '22px', height: '22px', borderRadius: '6px', background: d.color } }),
    h('div.grow', h('div.t', `« ${d.name} »`), h('div.d', TOP_LABELS[d.style] || d.style)),
    h('button.btn.small.ghost', { onclick: () => req(g, 'company.wear', { index: i }, () => `Tu portes « ${d.name} » de ${c.name} !`).then(() => g.refreshAvatar?.()) }, 'Porter'))));
  let style = BRAND_STYLES[0], color = COLORS[0];
  const name = h('input', { type: 'text', maxLength: 24, placeholder: 'Nom du modèle' });
  const styles = h('div.row', { style: { gap: '4px', flexWrap: 'wrap' } });
  const colors = h('div.swatches');
  const draw = () => {
    clear(styles); clear(colors);
    for (const s of BRAND_STYLES) styles.append(h(`button.btn.small${style === s ? '' : '.ghost'}`, { onclick: () => { style = s; draw(); } }, TOP_LABELS[s] || s));
    for (const col of COLORS) colors.append(h(`button.swatch${color === col ? '.on' : ''}`, { style: { background: col, outline: color === col ? '3px solid #fff' : 'none' }, onclick: () => { color = col; draw(); } }));
  };
  draw();
  b.append(h('div.field', h('label', 'Nouveau modèle'), name, styles, colors,
    h('button.btn.small', { style: { marginTop: '6px' }, onclick: () => req(g, 'company.design', { name: name.value, style, color }, () => '✂️ Nouveau modèle créé !').then((r) => r && refresh()) }, `Créer (${BRAND_COST} PC)`)));
}

function stocksTab(g, b, refresh) {
  const now = g.now(), p = g.profile;
  b.append(h('p.muted', `Cours en direct (frais ${STOCK_FEE * 100} %). Ils suivent des cycles et réagissent aux annonces : lis l'actualité !`));
  for (const s of STOCKS) {
    const price = stockPrice(s.sym, now);
    const hist = Array.from({ length: 24 }, (_, i) => stockPrice(s.sym, now - (23 - i) * 5 * 60_000));
    const ch = pct(price, hist[hist.length - 13]);
    const pos = p.stocks?.[s.sym];
    const pl = pos ? price * pos.n - pos.cost : 0;
    b.append(h('div.list-item', { style: { alignItems: 'flex-start' } }, h('div.grow', h('div.t', s.name), h('div.d', `${s.sym} · ${price.toFixed(2)} PC `, h('span', { style: { color: ch >= 0 ? '#7ac74f' : '#ff5a5f' } }, `${ch >= 0 ? '▲' : '▼'} ${Math.abs(ch).toFixed(1)} % (1 h)`)),
      spark(hist, 150, 26),
      pos ? h('div.d', `Tu as ${pos.n} action(s) · ${pl >= 0 ? '+' : ''}${fmt(pl)} PC`) : null),
    h('div', { style: { display: 'flex', flexDirection: 'column', gap: '3px' } },
      h('div', { style: { display: 'flex', gap: '3px' } }, [1, 10, 100].map((n) => h('button.btn.small', { onclick: () => req(g, 'stock.buy', { sym: s.sym, n }, (r) => `Achat ${n} ${s.sym} à ${r.price.toFixed(2)} (-${fmt(r.cost)} PC)`).then(() => refresh()) }, `+${n}`))),
      pos ? h('button.btn.small.ghost', { onclick: () => req(g, 'stock.sell', { sym: s.sym, n: pos.n }, (r) => `Vente ${s.sym} : +${fmt(r.gain)} PC`).then(() => refresh()) }, 'Tout vendre') : null)));
  }
  b.append(h('h4', { style: { marginTop: '10px' } }, '📰 Actualité de la bourse'));
  for (const n of marketNews(now).slice(0, 10)) b.append(h('div.d', { style: { padding: '3px 0', color: n.rumor ? '#ffd23f' : undefined } }, `${n.rumor ? '🤫' : n.mag > 0 ? '📈' : '📉'} ${n.text}`));
}

function investTab(g, b, refresh) {
  const p = g.profile;
  if (g.net.mode !== 'online') { b.append(h('p', 'En ligne, tu peux investir dans les entreprises créées par les autres joueurs (et eux dans la tienne). En solo, place ton argent en bourse !')); return; }
  b.append(h('p.muted', 'Achète des parts des entreprises des joueurs : ton argent entre dans leur trésorerie. Si l\'entreprise prospère, tes parts prennent de la valeur. Si elle fait faillite... elles ne valent plus rien.'));
  const list = h('div', h('p.muted', 'Chargement...'));
  b.append(list);
  g.net.request('invest.list', {}).then((rows) => {
    clear(list);
    if (!rows.length) list.append(h('p', 'Aucune entreprise de joueur pour le moment. Sois la première ou le premier à en créer une !'));
    for (const r of rows) {
      const mine = p.investments?.[r.id];
      list.append(h('div.list-item', h('span', { style: { fontSize: '24px' } }, r.emoji || '🏢'), h('div.grow', h('div.t', `${r.name} (de ${r.owner})`), h('div.d', `${r.price.toFixed(2)} PC/part · ${Math.max(0, r.float - r.sold)} parts dispo · ${r.staff} employé(s) · qualité ${r.quality}/5`),
        mine ? h('div.d', `Tu as ${mine.n} part(s) · valeur ${fmt(mine.n * r.price)} PC`) : null),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '3px' } },
        r.ownerId === p.id ? h('span.pill', 'À toi') : h('button.btn.small', { disabled: r.float - r.sold < 1, onclick: () => req(g, 'invest.buy', { companyId: r.id, n: Math.min(10, r.float - r.sold) }, (x) => `Investi : -${fmt(x.cost)} PC`).then(() => refresh()) }, '+10 parts'),
        mine ? h('button.btn.small.ghost', { onclick: () => req(g, 'invest.sell', { companyId: r.id, n: mine.n }, (x) => `Parts revendues : +${fmt(x.gain)} PC`).then(() => refresh()) }, 'Revendre') : null)));
    }
  }).catch((e) => { clear(list); list.append(h('p', e.message)); });
}
