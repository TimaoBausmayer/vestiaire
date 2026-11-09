import { h, fmt } from './dom.js';
import { destinations } from './gps.js';
import { BUILDING_BY_ID, BUILDINGS } from '../../shared/world-layout.js';
import { taxiPrice } from '../../shared/taxi.js';
import { SPORT_CLUBS, myClub } from '../../shared/clubs.js';
import { CAREER_SPORTS } from '../../shared/career.js';
import { HOUSING_BY_ID } from '../../shared/property.js';

// Appli « Taxi » : raccourcis pour aller tout de suite chez soi, au garage, au travail, à son club,
// sur les lieux de sport... en taxi (payant, gratuit pour l'admin) ou avec le GPS (gratuit).
const view = { q: '' };

function shortcuts(g) {
  const p = g.profile, out = [], P = g.player.pos;
  const at = (id) => BUILDING_BY_ID[id] && { x: BUILDING_BY_ID[id].door.x, z: BUILDING_BY_ID[id].door.z };
  const hb = HOUSING_BY_ID[p.home?.place || 'studio'], home = hb && at(hb.building);
  if (home) out.push({ name: '🏠 Chez moi', ...home });
  if (p.home?.owned?.length) for (const id of p.home.owned) { const H = HOUSING_BY_ID[id]; if (H && H.building !== hb?.building && at(H.building)) out.push({ name: `🏡 ${H.name}`, ...at(H.building) }); }
  for (const v of p.vehicles || []) if (v.park) out.push({ name: `🔑 Mon véhicule (${v.model})`, x: v.park.x, z: v.park.z });
  const garages = BUILDINGS.filter((b) => ['repair', 'vehicles'].includes(b.shop)).sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z));
  if (garages[0]) out.push({ name: `🔧 Garage le plus proche (${garages[0].name})`, x: garages[0].door.x, z: garages[0].door.z });
  if (p.career?.job?.building && at(p.career.job.building)) out.push({ name: `💼 Mon travail (${BUILDING_BY_ID[p.career.job.building].name})`, ...at(p.career.job.building) });
  for (const sp of Object.keys(SPORT_CLUBS)) { const c = myClub(p, sp, g.now()); if (c?.site && at(c.site)) out.push({ name: `${CAREER_SPORTS[sp].icon} Mon club : ${c.name}`, ...at(c.site) }); }
  out.push({ name: `🍾 Le Velours (club privé${p.unlocks?.vip || p.admin ? '' : ', code au videur'})`, ...at('club-vip') });
  for (const [id, n] of [['club-foot', '⚽🏃 Stade des Crampons'], ['f1-paddock', '🏎️ Paddock F1'], ['surf-school', '🏄 École de surf'], ['piscine', '🏊 Piscine olympique'], ['tennis-1', '🎾 Tennis'], ['minigolf', '⛳ Mini-golf'], ['circuit-stand', '🏁 Karting'], ['bike-park', '🚵 Bike Park'], ['athle-est', '🏟️ Stade de l\'Est'], ['athle-vignes', '🍇 Stade des Vignes'], ['surf-shop', '🪁 Surf Shop (wingfoil, jet ski)'], ['hightech', '📱 MégaTech']]) if (at(id)) out.push({ name: n, ...at(id) });
  return out;
}

export function taxiApp(g, b, phone) {
  const P = g.player.pos, admin = !!g.profile.admin;
  const row = (d) => {
    const dist = Math.hypot(d.x - P.x, d.z - P.z), price = admin ? 0 : taxiPrice(dist);
    return h('div.list-item', h('div.grow', h('div.t', d.name), h('div.d', `${dist >= 1000 ? `${(dist / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(dist)} m`} · taxi ${price ? `${fmt(price)} PC` : 'gratuit'}`)),
      h('button.btn.small.ghost', { onclick: () => { phone.goTo({ x: d.x, z: d.z, name: d.name }); } }, '📍 GPS'),
      h('button.btn.small', { onclick: () => ride(g, phone, d) }, '🚕 Y aller'));
  };
  b.append(h('p.muted', 'Le taxi t\'emmène tout de suite (prix selon la distance). Le GPS est gratuit.'));
  b.append(h('h4', { style: { margin: '8px 0 4px' } }, '⭐ Raccourcis'));
  for (const d of shortcuts(g)) b.append(row(d));
  b.append(h('h4', { style: { margin: '12px 0 4px' } }, '🔍 Tous les lieux'));
  const list = h('div');
  const search = h('input.ph-search', { placeholder: 'Chercher un lieu (boulangerie, hôpital, plage...)', value: view.q, onkeydown: (e) => e.stopPropagation(), oninput: (e) => { view.q = e.target.value; draw(); } });
  b.append(search, list);
  const all = destinations(g.profile);
  function draw() {
    list.textContent = '';
    const q = view.q.trim().toLowerCase();
    if (!q) { list.append(h('p.muted', 'Tape un nom de lieu.')); return; }
    const found = all.filter((d) => d.name.toLowerCase().includes(q)).slice(0, 25);
    if (!found.length) list.append(h('p.muted', 'Aucun lieu trouvé.'));
    for (const d of found) list.append(row(d));
  }
  draw();
}

async function ride(g, phone, d) {
  if (g.vehicles?.current) g.vehicles.exit(true);
  if (g.races?.s || g.surf?.s || g.wingfoil?.s || g.football?.s) { g.ui.toast('Termine d\'abord ton activité.', 'bad'); return; }
  try {
    const r = await g.net.request('taxi.ride', { x: d.x, z: d.z });
    phone.close();
    const veil = h('div.taxi-veil', h('div', '🚕'), h('b', `En route : ${d.name}`));
    g.ui.root.append(veil);
    g.sfx('door');
    setTimeout(() => { g.player.teleport(d.x, d.z, 0); g.net.sendState?.(g.player.netState(), g.player.zone); }, 450);
    setTimeout(() => { veil.classList.add('out'); setTimeout(() => veil.remove(), 500); g.ui.toast(`🚕 Arrivé·e : ${d.name}${r.price ? ` · -${fmt(r.price)} PC` : ''}`, 'good', 2500); }, 1300);
  } catch (e) { g.sfx('error'); g.ui.toast(e.message, 'bad'); }
}
