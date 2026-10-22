import * as THREE from 'three';
import { h, fmt } from '../ui/dom.js';
import { CALENDAR, CAL_BY_ID, VENUES, occurrences, occLabel, minutesUntil } from '../../shared/calendar.js';
import { BUILDING_BY_ID } from '../../shared/world-layout.js';
import { HOUR_MS, DAYS_LONG, weekday, gameDay } from '../../shared/clock.js';

// AGENDA : le calendrier des événements (appli du téléphone + panneaux d'affichage en ville).
// L'heure affichée est celle du jeu (10 min réelles = 1 h de jeu) ; on indique aussi le délai réel.

export const calNow = (g) => g.now() + (g.world?.dayNight?.shift || 0);
export const venuePos = (v) => { const V = VENUES[v]; if (!V) return null; if (V.building) { const b = BUILDING_BY_ID[V.building]; return b ? { x: b.door.x, z: b.door.z, name: V.name } : null; } return { x: V.x, z: V.z, name: V.name }; };

function status(o, now) {
  if (now >= o.end) return { t: 'Terminé', cls: '' };
  if (now >= o.start) return { t: `EN COURS · encore ${minutesUntil(o.end, now)} min`, cls: '.ok' };
  return { t: `dans ${minutesUntil(o.start, now)} min réelles`, cls: '.warn' };
}

export function agendaApp(g, b, phone) {
  const now = calNow(g);
  const cal = g.profile.calendar || { reg: {}, history: [] };
  const list = occurrences(now - HOUR_MS * 4, now + HOUR_MS * 40);
  // résultats à récupérer (tournois terminés auxquels on était inscrit)
  const toClaim = Object.keys(cal.reg || {}).filter((occ) => !cal.claimed?.[occ] && list.some((o) => o.occ === occ && now >= o.end));
  for (const occ of toClaim) {
    const o = list.find((x) => x.occ === occ), ev = CAL_BY_ID[o.id];
    b.append(h('div.list-item', { style: { background: 'linear-gradient(90deg, rgba(255,210,63,.35), rgba(139,92,246,.35))' } }, h('span', { style: { fontSize: '24px' } }, '🏁'),
      h('div.grow', h('div.t', `Résultats : ${ev.name}`), h('div.d', 'Le tournoi est terminé.')),
      h('button.btn.small', { onclick: async () => {
        try { const r = await g.net.request('cal.claim', { occ }); showResult(g, ev, r); phone.render(); } catch (e) { g.ui.toast(e.message, 'bad'); }
      } }, 'Voir')));
  }
  let lastDay = null;
  for (const o of list) {
    if (now >= o.end && !cal.reg?.[o.occ]) continue;
    const ev = CAL_BY_ID[o.id], st = status(o, now), v = venuePos(ev.venue);
    if (o.day !== lastDay) { lastDay = o.day; b.append(h('h4', { style: { margin: '12px 0 4px' } }, o.day === gameDay(now) ? `Aujourd'hui (${DAYS_LONG[weekday(o.day)]})` : DAYS_LONG[weekday(o.day)])); }
    const registered = !!cal.reg?.[o.occ];
    const podium = ev.rewards?.podium;
    b.append(h('div.list-item.agenda-item', h('span', { style: { fontSize: '26px' } }, ev.emoji),
      h('div.grow',
        h('div.t', ev.name, ' ', h(`span.pill${st.cls}`, st.t)),
        h('div.d', `${occLabel(o)} · 📍 ${v?.name || '?'} · ${ev.price ? `${fmt(ev.price)} PC` : 'gratuit'}${ev.places ? ` · ${ev.places} places` : ''}${podium ? ` · prix ${podium.join(' / ')} PC` : ''}`),
        h('div.d', ev.desc)),
      h('div.col-btns',
        v ? h('button.btn.small.ghost', { onclick: () => { g.gps?.set({ x: v.x, z: v.z, label: ev.name }); g.ui.toast(`📍 GPS : ${v.name}`); phone.close(); } }, 'GPS') : null,
        ev.register && now < o.end ? (registered ? h('span.pill.ok', 'Inscrit·e') : h('button.btn.small', { onclick: async () => {
          try { await g.net.request('cal.register', { occ: o.occ }); g.sfx('success'); g.ui.toast(`✅ Inscrit·e : ${ev.name}`, 'good'); phone.render(); } catch (e) { g.ui.toast(e.message, 'bad'); }
        } }, 'S\'inscrire')) : null)));
  }
  if (!list.length) b.append(h('p.muted', 'Aucun événement prévu dans les prochaines heures.'));
  const hist = (cal.history || []).slice(-8).reverse();
  if (hist.length) {
    b.append(h('h4', { style: { margin: '14px 0 6px' } }, 'Mes derniers résultats'));
    for (const r of hist) b.append(h('div.list-item', h('div.grow', h('div.t', `${CAL_BY_ID[r.id]?.emoji || '🏅'} ${CAL_BY_ID[r.id]?.name || r.id}`), h('div.d', r.place ? `${r.place}${r.place === 1 ? 'er' : 'e'} sur ${r.of}${r.prize ? ` · +${fmt(r.prize)} PC` : ''}` : 'Participation'))));
  }
  const cur = g.events?.current;
  if (cur) b.prepend(h('div.list-item', { style: { background: 'linear-gradient(90deg, rgba(255,90,95,.5), rgba(139,92,246,.5))' } }, h('span', { style: { fontSize: '26px' } }, cur.emoji), h('div.grow', h('div.t', `En ce moment : ${cur.name}`), h('div.d', cur.desc))));
}

export function showResult(g, ev, r) {
  g.sfx(r.prize ? 'levelup' : 'success');
  const m = g.ui.modal({
    title: `${ev.emoji} ${ev.name}`, sub: r.place ? `Tu termines ${r.place}${r.place === 1 ? 'er' : 'e'} sur ${r.ranking.length}.` : 'Tu n\'as pas posé de score pendant le tournoi.',
    build: (body) => {
      if (r.prize) body.append(h('p', `💰 Prix : ${fmt(r.prize)} PC`));
      body.append(h('table.board', r.ranking.slice(0, 10).map((x, i) => h(`tr${x.me ? '.me' : ''}`, h('td', String(i + 1)), h('td', x.name, x.npc ? h('span.pill', { style: { marginLeft: '6px' } }, 'PNJ') : null), h('td.num', String(x.score))))));
    },
    foot: (f) => f.append(h('button.btn', { onclick: () => m.close() }, 'OK')),
  });
}

// Texte d'un panneau d'affichage : les prochains événements (rafraîchi à chaque heure de jeu).
export function boardLines(now, n = 5) {
  return occurrences(now, now + HOUR_MS * 30).filter((o) => o.end > now).slice(0, n).map((o) => {
    const ev = CAL_BY_ID[o.id];
    return `${now >= o.start ? '▶ ' : ''}${occLabel(o)}  ${ev.name}`;
  });
}
export { CALENDAR };

// ------------------------------------------------------------------------------------- panneaux en ville
// Panneaux d'affichage (deux faces) qui listent les prochains événements ; E pour ouvrir l'Agenda.
const BOARD_SPOTS = [
  { x: 9, z: -15, ry: 0, name: 'Grande Place' },
  { x: 14, z: -437, ry: 0, name: 'Casino Royal Pomme' },
  { x: 166, z: -344, ry: 0, name: 'Circuit Turbo-Mamie' },
  { x: -28, z: -228, ry: 0, name: 'Parc des Tilleuls' },
];

export class CalendarBoards {
  constructor(g) {
    this.g = g;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 512; this.canvas.height = 320;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    const face = new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false });
    const geo = new THREE.PlaneGeometry(3.2, 2.0);
    this.t = 0;
    for (const s of BOARD_SPOTS) {
      const grp = new THREE.Group();
      grp.position.set(s.x, 0, s.z); grp.rotation.y = s.ry;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.2, 0.16), new THREE.MeshLambertMaterial({ color: '#3a3a44' }));
      for (const dx of [-1.45, 1.45]) { const p = post.clone(); p.position.set(dx, 1.1, 0); grp.add(p); }
      const frame = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.2, 0.12), new THREE.MeshLambertMaterial({ color: '#1b1446' }));
      frame.position.y = 2.6; grp.add(frame);
      for (const side of [1, -1]) { const m = new THREE.Mesh(geo, face); m.position.set(0, 2.6, side * 0.07); if (side < 0) m.rotation.y = Math.PI; grp.add(m); }
      g.engine.scene.add(grp);
      g.collision.addBox(s.x - 1.6, 0, s.z - 0.3, s.x + 1.6, 3.7, s.z + 0.3);
      g.interactions.add({ x: s.x, z: s.z, r: 3, priority: 3, label: '📅 Panneau des événements (Agenda)', action: () => g.phone?.open('events') });
    }
    this.draw();
  }

  draw() {
    const c = this.canvas.getContext('2d'), W = 512, H = 320;
    c.fillStyle = '#14102b'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#ffd23f'; c.font = '800 34px Rubik, system-ui, sans-serif'; c.textAlign = 'center';
    c.fillText('📅 AGENDA PLAYZONE', W / 2, 44);
    c.textAlign = 'left'; c.font = '600 21px Rubik, system-ui, sans-serif';
    const lines = boardLines(calNow(this.g), 6);
    lines.forEach((l, i) => { c.fillStyle = l.startsWith('▶') ? '#7ef29a' : '#ffffff'; c.fillText(l.length > 44 ? `${l.slice(0, 43)}…` : l, 18, 92 + i * 37); });
    if (!lines.length) { c.fillStyle = '#ffffff'; c.fillText('Rien de prévu pour le moment.', 18, 100); }
    this.tex.needsUpdate = true;
  }

  update(dt) {
    this.t += dt;
    if (this.t > 20) { this.t = 0; this.draw(); }
  }
}
