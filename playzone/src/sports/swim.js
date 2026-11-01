import * as THREE from 'three';
import { h, fmt } from '../ui/dom.js';
import { Avatar } from '../characters/avatar.js';
import { DEFAULT_APPEARANCE } from '../../shared/appearance.js';
import { POOL, laneZ, SWIM_RACES, swimCap, defaultSwim } from '../../shared/swim.js';

// PISCINE OLYMPIQUE : bassin de 50 m (8 couloirs, lignes d'eau, plots de départ, gradins), courses de
// crawl contre 5 PNJ. On nage en alternant J / L (bras gauche, bras droit) : le bon rythme (~3 par
// seconde) donne la vitesse ; trop vite, on s'essouffle. Au mur du 100 m : ESPACE = virage culbute.
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const req = async (g, t, p) => { try { return await g.net.request(t, p); } catch (e) { g.ui.toast(e.message, 'bad', 4000); g.sfx('error'); return null; } };
const X0 = POOL.x - POOL.L / 2, X1 = POOL.x + POOL.L / 2;
const ME = 3;   // couloir du joueur

export function buildPool(sb, col) {
  const { x, z, L, W, waterY, deckY } = POOL;
  // plages (dallage surélevé) autour du bassin, marches d'accès
  for (const [cx, cz, w, d] of [[x, z - W / 2 - 2.5, L + 6, 5], [x, z + W / 2 + 2.5, L + 6, 5], [X0 - 1.5, z, 3, W], [X1 + 1.5, z, 3, W]]) { sb.box(cx, 0, cz, w, deckY, d, '#e9ecef'); col.addBox(cx - w / 2, 0, cz - d / 2, cx + w / 2, deckY, cz + d / 2); }
  for (let k = 0; k < 3; k++) { const zz = z + W / 2 + 5 + 0.5 + k * 0.6; sb.box(x, 0, zz, 6, deckY - (k + 1) * 0.33, 0.6, '#ced4da'); col.addBox(x - 3, 0, zz - 0.3, x + 3, deckY - (k + 1) * 0.33, zz + 0.3); }
  // bassin : fond carrelé bleu, eau transparente gérée par le système, lignes d'eau
  sb.box(x, 0, z, L, 0.05, W, '#0077b6');
  for (let i = 0; i < POOL.lanes; i++) sb.box(x, 0.06, laneZ(i), L - 4, 0.02, 0.25, '#03045e');
  for (let i = 1; i < POOL.lanes; i++) {
    const zz = z - W / 2 + (W / POOL.lanes) * i;
    for (let k = 0; k < 25; k++) sb.cyl(X0 + 1 + k * 2, waterY - 0.05, zz, 0.08, 0.12, k % 4 < 2 ? '#e63946' : '#ffffff', 8);
  }
  // plots de départ et numéros de couloir
  for (let i = 0; i < POOL.lanes; i++) { sb.box(X0 - 0.6, deckY, laneZ(i), 0.9, 0.5, 0.7, '#ffffff'); sb.box(X0 - 0.6, deckY + 0.5, laneZ(i), 0.92, 0.06, 0.72, '#0077b6'); }
  // gradins côté nord
  for (let r = 0; r < 5; r++) { const zz = z - W / 2 - 5 - 0.6 - r * 1.1; sb.box(x, 0, zz, L, deckY + 0.5 + r * 0.5, 1.1, r % 2 ? '#ffd166' : '#ef476f'); col.addBox(x - L / 2, 0, zz - 0.55, x + L / 2, deckY + 0.5 + r * 0.5, zz + 0.55); }
  // tableau d'affichage
  sb.box(X1 + 1.8, 0, z, 0.3, 5, 0.3, '#495057'); sb.box(X1 + 1.8, 5, z, 0.3, 2.4, 6, '#14141c'); sb.box(X1 + 1.62, 5.3, z, 0.05, 1.8, 5.4, '#06d6a0', 0, 'glow');
}

export class Swim {
  constructor(g) {
    this.g = g;
    this.r = null;
    // eau du bassin (transparente)
    const water = new THREE.Mesh(new THREE.PlaneGeometry(POOL.L, POOL.W).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#4cc9f0', transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0.1 }));
    water.position.set(POOL.x, POOL.waterY, POOL.z);
    g.engine.scene.add(water);
    g.input.on('key', (e) => {
      if (!this.r) return;
      if (e.code === 'KeyJ') this.stroke(-1); else if (e.code === 'KeyL') this.stroke(1);
      else if (e.code === 'Space') this.turn();
      else if (e.code === 'Escape') this.finish(true);
    });
  }

  rec() { return { ...defaultSwim(), ...(this.g.profile.sports?.swim || {}) }; }

  desk() {
    const g = this.g, R = this.rec();
    const m = g.ui.modal({
      title: '🏊 Piscine olympique des Dauphins', width: 'min(560px, 96vw)',
      sub: `Niveau de nageur·se : ${Math.round(R.skill)}/100 · ${R.wins} victoire${R.wins > 1 ? 's' : ''} · ${R.podiums} podiums · record 50 m : ${R.best ? `${R.best.toFixed(2)} s` : '—'} · 100 m : ${R.best100 ? `${R.best100.toFixed(2)} s` : '—'}`,
      build: (body) => {
        body.append(h('p.muted', 'On nage en alternant J et L (bras gauche, bras droit), environ 3 mouvements par seconde. Trop vite = essoufflement. Au mur du 100 m, ESPACE pour le virage culbute. Ton endurance augmente ta vitesse max.'));
        for (const [id, R2] of Object.entries(SWIM_RACES)) {
          body.append(h('div.list-item', h('span', { style: { fontSize: '22px' } }, id === 'libre' ? '🌊' : '🏁'),
            h('div.grow', h('div.t', R2.name), h('div.d', `${g.profile.admin ? 'Gratuit' : `${R2.fee} PC`}${R2.prizes.length ? ` · primes : ${R2.prizes.join(' / ')} PC` : ' · fait monter l\'endurance'}`)),
            h('button.btn.small', { onclick: () => { m.close(); this.start(id); } }, 'Plonger !')));
        }
      },
    });
  }

  async start(race) {
    const g = this.g;
    if (this.r) return;
    const res = await req(g, 'swim.start', { race });
    if (!res) return;
    const R = SWIM_RACES[race], P = g.player;
    const S = g.engine.scene;
    const field = res.field.map((n, i) => {
      const lane = [1, 2, 4, 5, 6][i];
      const av = new Avatar({ ...DEFAULT_APPEARANCE, skin: pick(['#f1c27d', '#8d5524', '#e0ac69', '#ffdbac', '#c68642']), hair: 'chauve', hat: null, top: 'debardeur', topColor: pick(['#e63946', '#3a86ff', '#ffbe0b', '#8338ec', '#06d6a0']), bottom: 'short', bottomColor: '#14141c' }, {});
      S.add(av.root);
      const lab = g.labels.add(av.root, h('div.wlabel', n.name), 1.4, 40);
      return { ...n, lane, av, lab, x: X0 + 0.5, dir: 1, done: false, dist: 0 };
    });
    P.external = true;
    P.avatar.root.rotation.set(0, Math.PI / 2, 0);
    this.saved = { dist: g.cam.dist, pitch: g.cam.pitch };
    g.cam.dist = 9; g.cam.pitch = 0.5; g.cam.yaw = -Math.PI / 2;
    const r = this.r = { race, R, field, t: -3, x: X0 + 0.5, dir: 1, dist: 0, v: 0, cap: swimCap(g.profile.body?.endurance ?? 15, this.rec().skill), strokes: [], last: 0, side: 0, stamina: 1, turned: false, done: false };
    r.hud = h('div.sw-hud', r.title = h('b', R.name), r.info = h('div', 'À vos marques...'), h('div.sw-bar', r.stam = h('i')), h('small', 'J / L en alternance · ESPACE au mur (virage) · Échap : sortir'));
    r.btns = h('div.foot-btns', h('button', { onpointerdown: (e) => { e.preventDefault(); this.stroke(-1); } }, '🫲 J'), h('button', { onpointerdown: (e) => { e.preventDefault(); this.stroke(1); } }, '🫱 L'), h('button', { onpointerdown: (e) => { e.preventDefault(); this.turn(); } }, '🔄 Virage'));
    g.ui.root.append(r.hud, r.btns);
    g.sfx('whistle');
  }

  stroke(side) {
    const r = this.r;
    if (!r || r.t < 0 || r.done || side === r.side) return;
    r.side = side;
    r.strokes.push(r.t);
    this.g.sfx('click');
  }

  turn() {
    const r = this.r;
    if (!r || r.R.dist < 100 || r.turned || r.done) return;
    if (r.dir === 1 && r.x > X1 - 2.2) { r.turned = true; r.dir = -1; r.v *= 0.9; this.g.sfx('whoosh'); r.info.textContent = '🔄 Virage culbute parfait !'; }
  }

  async finish(abandon = false) {
    const r = this.r, g = this.g, P = g.player;
    if (!r) return;
    this.r = null;
    for (const n of r.field) { n.av.root.removeFromParent(); g.labels.remove?.(n.lab); }
    r.hud.remove(); r.btns.remove();
    P.external = false;
    P.teleport(POOL.x, POOL.z + POOL.W / 2 + 2.5, 0);
    if (this.saved) { g.cam.dist = this.saved.dist; g.cam.pitch = this.saved.pitch; }
    const res = await req(g, 'swim.end', { time: r.time, abandon: abandon && r.R.dist > 0, meters: Math.round(r.dist) });
    if (!res) return;
    if (res.needs) g.emit('needs', res.needs);
    if (!r.R.dist) { g.ui.toast(`🌊 ${Math.round(res.swum)} m nagés ! Endurance en hausse · niveau ${Math.round(res.skill)}`, 'good', 4500); return; }
    if (abandon) { g.ui.toast('Tu sors du bassin. La prochaine fois !', '', 3000); return; }
    const medal = ['🥇', '🥈', '🥉'][res.place - 1] || '🏊';
    g.ui.dialog({ name: 'Juge-arbitre', role: 'Piscine olympique', text: `${medal} ${res.place}${res.place === 1 ? 'er·e' : 'e'} en ${res.time.toFixed(2)} s !${res.record ? ' 🏅 Nouveau record perso !' : ''}${res.prize ? ` Prime : ${fmt(res.prize)} PC.` : ''} Niveau de nageur·se : ${Math.round(res.skill)}/100.`, choices: [{ label: '🏊 Super !', ghost: true, action: (m) => m.close() }] });
    g.sfx(res.place === 1 ? 'levelup' : 'success');
  }

  update(dt, t) {
    const r = this.r, g = this.g;
    if (!r) return;
    const P = g.player;
    r.t += dt;
    if (r.t < 0) { r.info.textContent = r.t < -1 ? 'À vos marques...' : 'Prêts...'; }
    else if (!r.go) { r.go = true; r.info.textContent = '🔔 Partez !'; g.sfx('go'); }
    if (r.t >= 0 && !r.done) {
      // cadence des 1,5 dernières secondes → vitesse visée
      r.strokes = r.strokes.filter((s) => r.t - s < 1.5);
      const cad = r.strokes.length / 1.5;
      const over = Math.max(0, cad - 3.6);
      r.stamina = Math.max(0, Math.min(1, r.stamina - over * dt * 0.25 + (cad < 3 ? dt * 0.12 : 0)));
      const want = Math.min(r.cap, cad * 0.8) * (0.45 + r.stamina * 0.55);
      r.v += (want - r.v) * Math.min(1, dt * 2.5);
      r.x += r.dir * r.v * dt; r.dist += r.v * dt;
      if (r.R.dist >= 100 && r.dir === 1 && r.x >= X1 - 0.6) { if (!r.turned) { r.v = 0.3; r.x = X1 - 0.6; r.info.textContent = '🧱 Mur ! ESPACE pour le virage'; } }
      const finished = r.R.dist ? (r.R.dist === 50 ? r.x >= X1 - 0.6 : r.turned && r.x <= X0 + 0.6) : r.t >= 120;
      if (finished) { r.done = true; r.time = Math.round(r.t * 100) / 100; r.end = 2; g.sfx('success'); r.info.textContent = r.R.dist ? `🏁 Arrivée en ${r.time.toFixed(2)} s !` : '🏁 Fin de la séance'; }
      else if (r.R.dist) r.info.textContent = r.info.textContent.startsWith('🔄') && r.t % 2 < 1.5 ? r.info.textContent : `${Math.round(r.dist)} / ${r.R.dist} m · ${(r.v * 3.6).toFixed(1)} km/h`;
      else r.info.textContent = `${Math.round(r.dist)} m · reste ${Math.ceil(120 - r.t)} s`;
    }
    if (r.done) { r.end -= dt; if (r.end <= 0) { this.finish(false); return; } }
    r.stam.style.width = `${r.stamina * 100}%`;
    // le joueur dans l'eau
    const z = laneZ(ME), y = POOL.waterY - 1.0;
    P.pos.set(r.x, y, z);
    P.avatar.root.position.set(r.x, y, z);
    P.avatar.root.rotation.y = r.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    P.avatar.update(dt, { speed: r.v, swimming: r.t >= 0, grounded: false });
    // nageurs PNJ : même course, à leur vitesse
    for (const n of r.field) {
      if (r.t >= 0 && !n.done) {
        n.dist = Math.min(r.R.dist, n.v * r.t * (0.96 + 0.08 * Math.sin(r.t * 0.7 + n.lane)));
        const leg = Math.min(n.dist, 50), back = Math.max(0, n.dist - 50);
        n.x = back > 0 ? X1 - 0.6 - back : X0 + 0.5 + leg; n.dir = back > 0 ? -1 : 1;
        if (n.dist >= r.R.dist) n.done = true;
      }
      n.av.root.position.set(n.x, y, laneZ(n.lane));
      n.av.root.rotation.y = n.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      n.av.update(dt, { speed: n.done ? 0 : n.v, swimming: r.t >= 0, grounded: false });
    }
  }
}
