import { h, fmt } from './dom.js';
import { WINGS, BOARDS, FOILS, GEAR_COLORS, GEAR_SLOTS, equipped, gearStats, ownsGear } from '../../shared/gear.js';
import { windAt, windAtPos, windLabel, forecast } from '../../shared/wingfoil.js';
import { VEHICLES } from '../../shared/content/vehicles.js';
import { sentence, lawyerCost } from '../../shared/justice.js';
import { mobileRepairCost, POCKET_KINDS } from '../../shared/property.js';
import { BUILDING_BY_ID } from '../../shared/world-layout.js';
import { calNow } from '../events/agenda.js';
import { BOATS, ownsBoat } from '../../shared/sailing.js';

// Applis du téléphone : Équipement (wingfoil à la carte, jet ski, vélos « de poche »), Météo (vent),
// Avocat (faire cesser une poursuite), et les raccourcis de l'écran d'accueil.

const req = async (g, t, p) => { try { return await g.net.request(t, p); } catch (e) { g.ui.toast(e.message, 'bad', 4500); g.sfx('error'); return null; } };
const SLOT_NAMES = { wing: '🪁 Aile', board: '🏄 Planche', foil: '🛩️ Foil' };
const bar = (label, v, max = 1.5) => h('div.gear-stat', h('span', label), h('div.bar', h('div', { style: { width: `${Math.round(Math.min(1, v / max) * 100)}%` } })));

// ------------------------------------------------------------------ Équipement
export function gearApp(g, b, phone) {
  const p = g.profile, gear = equipped(p), st = gearStats(gear);
  const ownsWing = Object.keys(WINGS).some((id) => ownsGear(p, id));
  const w = windAtPos(calNow(g), g.player.pos.x, g.player.pos.z);
  // wingfoil : résumé + mise à l'eau
  b.append(h('div.gear-card', { style: { borderColor: gear.wingColor } },
    h('div.t', `🪁 Wingfoil ${ownsWing ? '' : '(location au Surf Shop)'}`),
    h('div.d', `${WINGS[gear.wing].name} · ${BOARDS[gear.board].name} · ${FOILS[gear.foil].name}`),
    h('div.d', `Vent maintenant : ${w.kts} nœuds — ${w.kts >= st.minWind ? `✅ ça vole (minimum ${st.minWind})` : `❌ trop faible pour cette aile (minimum ${st.minWind})`}`),
    bar('Vitesse', st.speed), bar('Sauts', st.jump), bar('Rotations', st.spin, 1.7), bar('Stabilité', st.stability, 1.7),
    h('div.d', `Décolle sur le foil à ${Math.round(st.takeoff * 3.6)} km/h`),
    h('div.row', ownsWing ? h('button.btn.small', { onclick: () => { phone.close(); g.wingfoil?.launchHere(); } }, '🌊 Mettre à l\'eau ici') : null,
      h('button.btn.small.ghost', { onclick: () => { const s = BUILDING_BY_ID['surf-shop']; phone.goTo?.({ x: s.door.x, z: s.door.z, name: 'Surf Shop' }); } }, '📍 Surf Shop'))));
  // pièces : équiper ce qu'on possède, voir le reste
  for (const [slot, table] of Object.entries(GEAR_SLOTS)) {
    b.append(h('h4.gear-h', SLOT_NAMES[slot]));
    for (const [id, d] of Object.entries(table)) {
      const own = ownsGear(p, id), on = gear[slot] === id;
      const price = d.price || (slot === 'wing' ? 1800 : 0);
      b.append(h(`div.list-item${on ? '.sel' : ''}`, h('span', { style: { fontSize: '22px' } }, d.emoji),
        h('div.grow', h('div.t', d.name), h('div.d', d.desc)),
        own ? h('button.btn.small', { disabled: on, onclick: async () => { if (await req(g, 'gear.equip', { slot, id })) { g.sfx('click'); phone.render(); } } }, on ? '✔ équipé' : 'Équiper')
          : h('span.pill', price ? `${fmt(price)} PC · Surf Shop` : 'dans le pack')));
    }
  }
  // couleurs
  const sw = (key) => h('div.swatches', GEAR_COLORS.map((c) => h(`button.swatch${gear[key] === c ? '.sel' : ''}`, { style: { background: c }, onclick: async () => { if (await req(g, 'gear.equip', { [key]: c })) phone.render(); } })));
  b.append(h('h4.gear-h', '🎨 Couleurs'), h('div.field', h('label', 'Aile'), sw('wingColor')), h('div.field', h('label', 'Planche'), sw('boardColor')));
  // jet ski
  if ((p.inventory.jetski || 0) > 0) {
    b.append(h('h4.gear-h', '🚤 Jet ski'), h('div.list-item', h('span', { style: { fontSize: '22px' } }, '🚤'), h('div.grow', h('div.t', 'Jet ski Turbo-Mouette 1600'), h('div.d', 'Balade libre partout où il y a de l\'eau profonde.')),
      h('button.btn.small', { onclick: () => { phone.close(); g.jetski?.launchHere(); } }, '🌊 À l\'eau ici')));
  }
  // bateaux et kites possédés : à l'eau où on veut
  const boats = Object.keys(BOATS).filter((id) => ownsBoat(p, id));
  if (boats.length) {
    b.append(h('h4.gear-h', '⛵ Mes bateaux'));
    for (const id of boats) b.append(h('div.list-item', h('span', { style: { fontSize: '22px' } }, BOATS[id].emoji), h('div.grow', h('div.t', BOATS[id].name), h('div.d', 'Navigation libre partout où il y a de l\'eau profonde.')),
      h('button.btn.small', { onclick: () => { phone.close(); g.sailing?.launchHere(id); } }, '🌊 À l\'eau ici')));
  }
  // vélos et trottinettes : on les sort du sac gratuitement
  const pocket = p.vehicles.filter((v) => POCKET_KINDS.includes(VEHICLES[v.model]?.kind));
  b.append(h('h4.gear-h', '🎒 Vélos et trottinettes'));
  if (!pocket.length) b.append(h('p.muted', 'Aucun pour l\'instant : Deux-Roues Express, Cycles des Cimes ou le Bike Park.'));
  for (const v of pocket) {
    b.append(h('div.list-item', h('span', { style: { fontSize: '22px' } }, VEHICLES[v.model].kind === 'board' ? '🛴' : '🚲'), h('div.grow', h('div.t', VEHICLES[v.model].name), h('div.d', 'Gratuit, où que tu sois.')),
      h('button.btn.small', { onclick: () => { phone.close(); g.vehicles.deliver(v.id); } }, '🎒 Sortir')));
  }
}

// ------------------------------------------------------------------ Météo
export function meteoApp(g, b) {
  const t = calNow(g), w = windAt(t), st = gearStats(equipped(g.profile));
  const deg = ((w.dir * 180) / Math.PI + 360) % 360, card = ['nord', 'nord-est', 'est', 'sud-est', 'sud', 'sud-ouest', 'ouest', 'nord-ouest'][Math.round(deg / 45) % 8];
  b.append(h('div.gear-card', h('div.big', `🌬️ ${w.kts} nœuds`), h('div.d', `${windLabel(w.kts)} · vent de ${card}`), h('div.d', w.kts >= st.minWind ? '🪁 Bon pour le wingfoil avec ton aile !' : `🪁 Pas assez pour ton aile (il faut ${st.minWind} nœuds) : essaie une aile plus grande.`)));
  b.append(h('h4.gear-h', 'Prévisions (heures de jeu)'));
  b.append(h('div.meteo', forecast(t, 10).map((f) => h('div.mcol', h('div.mh', `${f.h} h`), h('div.mb', h('i', { style: { height: `${Math.min(100, f.kts * 3)}%`, background: f.kts >= st.minWind ? '#2ec4b6' : '#9aa5b1' } })), h('div.mk', `${Math.round(f.kts)}`)))));
  b.append(h('p.muted', 'Barre turquoise = assez de vent pour ton aile. La brise se lève souvent l\'après-midi.'));
}

// ------------------------------------------------------------------ Avocat
export function lawyerApp(g, b, phone) {
  const j = g.profile.justice || {}, stars = j.stars || 0;
  if (!stars && !(j.crimes || []).length) {
    b.append(h('p', '⚖️ Maître Plaidetout est à ton service. Personne ne te recherche pour le moment.'), h('p.muted', 'Si la police te poursuit, appelle-le d\'ici : il fait cesser la poursuite sur-le-champ (tu gardes ta voiture). Au moment d\'une arrestation, il peut aussi t\'éviter la prison.'));
    return;
  }
  const minutes = sentence(j.crimes || []), cost = g.profile.admin ? 0 : lawyerCost(minutes, stars);
  b.append(h('div.gear-card', h('div.t', `🚨 Recherché·e : ${'★'.repeat(stars)}${'☆'.repeat(Math.max(0, 5 - stars))}`), h('div.d', minutes ? `Tu risques ${minutes} minutes de prison.` : 'Pas de prison en vue, mais la police te court après.'),
    h('button.btn.block', { onclick: async () => {
      const r = await req(g, 'police.lawyer', {});
      if (!r) return;
      g.police?.clearUnits(); g.police?.renderStars();
      g.sfx('success');
      g.ui.toast(`⚖️ Affaire classée par Maître Plaidetout${r.cost ? ` (-${fmt(r.cost)} PC)` : ''}. Les agents rentrent au poste.`, 'good', 5000);
      phone.render();
    } }, `⚖️ Appeler Maître Plaidetout (${cost ? `${fmt(cost)} PC` : 'gratuit'})`)));
}

// ------------------------------------------------------------------ raccourcis de l'écran d'accueil
export function quickActions(g, phone) {
  const p = g.profile, out = [];
  const chip = (label, fn) => out.push(h('button.qa', { onclick: fn }, label));
  const cur = g.vehicles?.current;
  if (cur?.owner === 'me' && cur.sim.damage > 0.05) chip(`🔧 Réparer ici · ${fmt(mobileRepairCost(cur.model, cur.sim.damage))} PC`, async () => { await g.vehicles.repairHere(cur); phone.render(); });
  if ((g.profile.justice?.stars || 0) > 0) chip('⚖️ Avocat', () => phone.go('avocat'));
  if (Object.keys(WINGS).some((id) => ownsGear(p, id))) chip('🪁 À l\'eau', () => { phone.close(); g.wingfoil?.launchHere(); });
  if ((p.inventory.jetski || 0) > 0) chip('🚤 Jet ski', () => { phone.close(); g.jetski?.launchHere(); });
  const boat = Object.keys(BOATS).find((id) => ownsBoat(p, id));
  if (boat) chip(`${BOATS[boat].emoji} ${BOATS[boat].name}`, () => { phone.close(); g.sailing?.launchHere(boat); });
  const bike = p.vehicles.find((v) => POCKET_KINDS.includes(VEHICLES[v.model]?.kind));
  if (bike && !cur) chip(`🎒 ${VEHICLES[bike.model].name}`, () => { phone.close(); g.vehicles.deliver(bike.id); });
  return out.length ? h('div.quick-actions', out) : null;
}
