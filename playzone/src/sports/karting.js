import * as THREE from 'three';
import { h, fmt } from '../ui/dom.js';
import { WorldVehicle } from '../vehicles/vehicles.js';
import { CarVisual } from '../vehicles/car-models.js';
import { Avatar } from '../characters/avatar.js';
import { DEFAULT_APPEARANCE, SKINS, HAIR_STYLES, HAIR_COLORS, COLORS } from '../../shared/appearance.js';
import { VEHICLES } from '../../shared/content/vehicles.js';
import { liveOf, liveOcc, occurrences, CAL_BY_ID, occLabel, minutesUntil } from '../../shared/calendar.js';
import { HOUR_MS } from '../../shared/clock.js';
import { mulberry32, hashString } from '../../shared/rng.js';
import {
  TRACK, TRACK_LENGTH, TRACK_SAMPLES, trackAt, GATES, GATE_R, MIN_LAP, KARTS, MEMBERSHIPS, FORMULAS, RACES, LEVELS, sessionPrice, memberOk, fmtLap,
} from '../../shared/karting.js';
import { calNow } from '../events/agenda.js';

// KARTING : accueil du circuit (sessions, courses, adhésions, records) et conduite sur la piste.
// Les chronos officiels sont validés par l'autorité ; ici on affiche, on anime les pilotes PNJ.

const req = async (g, t, p) => { try { return await g.net.request(t, p); } catch (e) { g.ui.toast(e.message, 'bad'); g.sfx('error'); return null; } };
const memberOf = (g) => { const m = g.profile.karting?.member; return m && m.until > g.now() ? m : null; };

// Répartition du temps sur un tour : on ralentit dans les virages (bouts de l'ovale).
const TAU = (() => {
  const out = [0];
  for (let i = 1; i < TRACK_SAMPLES.length; i++) {
    const a = TRACK_SAMPLES[i - 1], b = TRACK_SAMPLES[i];
    const curve = Math.abs(Math.cos(a.a)) > 0.75 ? 1 / 0.8 : 1;
    out.push(out[i - 1] + (b.s - a.s) * curve);
  }
  const tot = out[out.length - 1];
  return out.map((x) => x / tot);
})();
// Fraction de temps (0..1) → abscisse sur le tour.
function sOfTau(u) {
  u = Math.max(0, Math.min(1, u));
  let lo = 0, hi = TAU.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (TAU[m] <= u) lo = m; else hi = m; }
  const k = (u - TAU[lo]) / Math.max(1e-9, TAU[hi] - TAU[lo]);
  return TRACK_SAMPLES[lo].s + (TRACK_SAMPLES[hi].s - TRACK_SAMPLES[lo].s) * k;
}
const gridSlot = (i) => ({ s: -5 - Math.floor(i / 2) * 4.5, lat: i % 2 ? 2.2 : -2.2 });

// ------------------------------------------------------------------------------------- accueil
export function kartingDesk(g, b) {
  let tab = 'sessions', kart = 'kart';
  const m = g.ui.modal({
    title: '🏎️ Circuit Turbo-Mamie', sub: 'Karts de location, chronos officiels, courses contre des pilotes PNJ (débutant → expert). Prix en PlayCoins.',
    width: 'min(680px, 96vw)',
    tabs: null,
    build: (body, mm) => {
      const now = g.now(), mem = memberOf(g), K = g.profile.karting || {};
      const promo = !!liveOcc('kart-promo', calNow(g));
      body.append(h('div.opt-row', { style: { marginBottom: '10px' } }, [['sessions', 'Sessions'], ['courses', 'Courses'], ['adhesions', 'Adhésions'], ['records', 'Records']].map(([id, l]) => h(`button.opt${tab === id ? '.sel' : ''}`, { onclick: () => { tab = id; mm.refresh(); } }, l))));
      body.append(h('div.muted', mem ? `🎫 ${MEMBERSHIPS[mem.kind].name} — valable encore ${Math.ceil((mem.until - now) / HOUR_MS)} h de jeu.` : 'Pas d\'adhésion : prix normaux.', promo ? ' · 🎉 Lundi à moitié prix !' : ''));
      const kartRow = () => h('div.field', h('label', 'Kart'), h('div.opt-row', Object.entries(KARTS).map(([id, k]) => {
        const okK = !k.need || memberOk(mem, k.need, now) || k.extra;
        return h(`button.opt${kart === id ? '.sel' : ''}`, { disabled: !okK, onclick: () => { kart = id; mm.refresh(); } }, `${k.name} (${VEHICLES[id].max * 3.6 | 0} km/h)${k.need && !memberOk(mem, k.need, now) ? (k.extra ? ` +${k.extra} PC` : ' 🔒') : ''}`);
      })));
      if (tab === 'sessions') {
        body.append(kartRow());
        for (const [id, F] of Object.entries(FORMULAS)) {
          const price = id === 'libre' && promo ? 0 : sessionPrice(F.price, mem, promo);
          body.append(h('div.list-item', h('div.grow', h('div.t', F.name), h('div.d', `${F.minutes} min réelles · ${price === F.price ? `${price} PC` : `${price} PC au lieu de ${F.price}`}${F.timed ? ' · chrono, meilleur tour' : ' · sans classement officiel'}`)),
            h('button.btn.small', { onclick: async () => { const r = await req(g, 'kart.start', { formula: id, kart }); if (r) { mm.close(); g.karting.begin({ mode: 'session', kart, formula: id, until: r.until }); } } }, 'Rouler')));
        }
      } else if (tab === 'courses') {
        body.append(kartRow());
        const cn = calNow(g);
        const live = liveOf((e) => e.kind === 'karting' && !!e.race, cn);
        for (const o of live) {
          const ev = CAL_BY_ID[o.id], R = RACES[ev.race], reg = !!g.profile.calendar?.reg?.[o.occ];
          body.append(h('div.list-item', { style: { background: 'linear-gradient(90deg, rgba(255,210,63,.3), rgba(139,92,246,.3))' } }, h('span', { style: { fontSize: '24px' } }, ev.emoji),
            h('div.grow', h('div.t', `${R.name} — EN COURS (encore ${minutesUntil(o.end, cn)} min)`), h('div.d', `${R.laps} tours · ${R.field} pilotes PNJ · prix ${R.prizes.join(' / ')} PC · ${ev.register ? (reg ? 'inscrit·e ✅' : `inscription ${ev.price} PC`) : `engagement ${R.fee} PC`}${R.member ? ' · adhérents seulement' : ''}`)),
            ev.register && !reg ? h('button.btn.small.ghost', { onclick: async () => { if (await req(g, 'cal.register', { occ: o.occ })) { g.sfx('success'); mm.refresh(); } } }, 'S\'inscrire') : null,
            h('button.btn.small', { onclick: async () => { const r = await req(g, 'kart.race', { race: ev.race, kart }); if (r) { mm.close(); g.karting.begin({ mode: 'race', kart, race: ev.race, ...r }); } } }, 'Prendre le départ')));
        }
        if (!live.length) body.append(h('p', 'Aucune course en ce moment. Prochains départs :'));
        for (const o of occurrences(cn, cn + 30 * HOUR_MS).filter((x) => CAL_BY_ID[x.id].race && x.start > cn).slice(0, 4)) {
          const ev = CAL_BY_ID[o.id];
          body.append(h('div.list-item', h('span', { style: { fontSize: '22px' } }, ev.emoji), h('div.grow', h('div.t', ev.name), h('div.d', `${occLabel(o)} · dans ${minutesUntil(o.start, cn)} min réelles`))));
        }
      } else if (tab === 'adhesions') {
        for (const [id, M] of Object.entries(MEMBERSHIPS)) {
          body.append(h('div.list-item', h('div.grow', h('div.t', `${M.name} — ${fmt(M.price)} PC`), h('div.d', M.desc)),
            h('button.btn.small', { onclick: async () => { if (await g.ui.confirm(M.name, `${M.desc}\nPrix : ${fmt(M.price)} PC.`, 'Payer') && await req(g, 'kart.member', { kind: id })) { g.sfx('cash'); g.ui.toast(`🎫 ${M.name} activée !`, 'good'); mm.refresh(); } } }, mem?.kind === id ? 'Prolonger' : 'Prendre')));
        }
      } else {
        body.append(h('div.stat-grid',
          h('div.stat', h('b', fmtLap(K.best)), h('span', 'Meilleur tour')),
          h('div.stat', h('b', String(K.laps || 0)), h('span', 'Tours chronométrés')),
          h('div.stat', h('b', `${K.wins || 0} / ${K.races || 0}`), h('span', 'Victoires / courses')),
          h('div.stat', h('b', String(K.podiums || 0)), h('span', 'Podiums'))));
        const board = h('div.muted', 'Chargement…');
        body.append(h('h3', { style: { marginTop: '12px' } }, 'Meilleurs tours (tous les temps)'), board);
        g.net.request('mg.board', { id: 'kart' }).then(({ top }) => {
          board.textContent = ''; board.classList.remove('muted');
          if (!top?.length) { board.textContent = 'Aucun chrono pour l\'instant.'; return; }
          board.append(h('table.board', top.map((r, i) => h(`tr${r.id === g.profile.id ? '.me' : ''}`, h('td', String(i + 1)), h('td', r.name, r.npc ? h('span.pill', { style: { marginLeft: '6px' } }, 'PNJ') : null), h('td.num', fmtLap(r.score))))));
        }).catch(() => { board.textContent = 'Classement indisponible.'; });
        if (K.history?.length) {
          body.append(h('h3', { style: { marginTop: '12px' } }, 'Mes dernières courses'));
          for (const r of K.history.slice(-6).reverse()) body.append(h('div.list-item', h('div.grow', h('div.t', RACES[r.race]?.name || r.race), h('div.d', r.place ? `${r.place}e / ${r.of} · ${fmtLap(r.total)} · meilleur tour ${fmtLap(r.best)}${r.prize ? ` · +${fmt(r.prize)} PC` : ''}` : 'Abandon'))));
        }
      }
    },
  });
  return m;
}

// ------------------------------------------------------------------------------------- piste
export class Karting {
  constructor(g) {
    this.g = g;
    this.s = null;
    this.lights = null;
  }

  // Démarrage d'une session ou d'une course (après validation par l'autorité).
  begin(opts) {
    const g = this.g;
    const field = opts.field || [];
    const me = opts.mode === 'race' ? gridSlot(field.length) : { s: -6, lat: 0 };
    const p = trackAt(me.s, me.lat);
    const v = new WorldVehicle(g, { model: opts.kart, color: VEHICLES[opts.kart].paint, x: p.x, z: p.z, yaw: p.yaw, owner: 'kart' });
    g.vehicles.list.push(v);
    g.vehicles.enter(v);
    this.s = { ...opts, v, grid: p, next: 0, passed: 0, lapStart: opts.mode === 'race' ? opts.green : null, laps: [], best: null, t: 0, hudT: 0, offTrack: 0, done: false };
    // pilotes PNJ
    this.s.npcs = field.map((d, i) => this.makeNpc(d, i));
    if (opts.mode === 'race') {
      this.lights = h('div.kart-lights', [0, 1, 2, 3, 4].map(() => h('span')));
      g.ui.root.append(this.lights);
      g.ui.toast(`🏁 ${RACES[opts.race].name} : ${opts.laps} tours. Attends l'extinction des feux !`, 'event', 4500);
    } else g.ui.toast(`🏎️ ${FORMULAS[opts.formula].name} : passe la ligne pour lancer le chrono. Reste sur la piste !`, 'good', 4500);
    g.cam.dist = Math.max(5.5, g.cam.dist);
  }

  makeNpc(d, i) {
    const g = this.g;
    const r = mulberry32(hashString(d.name));
    const pick = (a) => a[Math.floor(r() * a.length)];
    const model = d.level === 'expert' ? 'kart-pro' : d.level === 'confirme' ? 'kart-sport' : 'kart';
    const vis = new CarVisual(model, { paint: pick(['#e63946', '#3a86ff', '#ffd23f', '#2a9d8f', '#8338ec', '#ff9f1c', '#06d6a0']) });
    g.engine.scene.add(vis.root);
    const av = new Avatar({ ...DEFAULT_APPEARANCE, skin: pick(SKINS.slice(0, 8)), hair: pick(HAIR_STYLES), hairColor: pick(HAIR_COLORS.slice(0, 7)), topColor: pick(COLORS), top: 'tshirt', hat: null }, {});
    av.root.scale.setScalar(0.9);
    g.engine.scene.add(av.root);
    const label = document.createElement('div');
    label.className = 'wlabel';
    label.textContent = `${d.name} · ${LEVELS[d.level].name} (PNJ)`;
    const lab = g.labels.add(av.root, label, 1.7, 40);
    const col = g.collision.addCyl(0, 0, 0.75, 0, 1.1, { dynamic: true, noCamera: true });
    const slot = gridSlot(i);
    return { d, vis, av, lab, col, slot, lat: slot.lat, s: slot.s, prog: slot.s, finished: false, spin: 0 };
  }

  // Abscisse cumulée (depuis la ligne de départ) d'un PNJ au temps t (s après le feu vert).
  npcProgress(n, t) {
    const L = n.d.laps;
    if (t <= 0) return { prog: n.slot.s, spin: 0 };
    let k = L.findIndex((x) => t < x);
    if (k < 0) return { prog: L.length * TRACK_LENGTH + Math.min(30, (t - L[L.length - 1]) * 6), spin: 0, done: true };
    const t0 = k === 0 ? 0 : L[k - 1], t1 = L[k];
    const sp = n.d.spins.find((x) => x.lap === k);
    let u = (t - t0) / (t1 - t0), spin = 0;
    const startS = k === 0 ? n.slot.s : 0;
    if (sp) {
      // le tête-à-queue : arrêt de `dur` secondes à la fraction `at` du tour
      const drive = t1 - t0 - sp.dur, ta = t0 + drive * sp.at;
      if (t < ta) u = ((t - t0) / drive);
      else if (t < ta + sp.dur) { u = sp.at; spin = (t - ta) / sp.dur; }
      else u = (t - t0 - sp.dur) / drive;
    }
    const s = startS + sOfTau(u) * (k === 0 ? (TRACK_LENGTH - startS) / TRACK_LENGTH : 1);
    return { prog: k * TRACK_LENGTH + s, spin };
  }

  // Suivi des portes côté client (même logique que l'autorité) pour l'affichage.
  gates(pos, now) {
    const s = this.s;
    if (s.mode === 'race' && now < s.green) return;
    const gt = GATES[s.next];
    if (Math.hypot(pos.x - gt.x, pos.z - gt.z) > GATE_R) return;
    if (s.next === 0) {
      if (s.passed >= GATES.length - 1 && s.lapStart !== null) {
        const lap = (now - s.lapStart) / 1000;
        if (lap >= MIN_LAP) {
          s.laps.push(lap);
          const rec = s.best === null || lap < s.best;
          if (rec) s.best = lap;
          this.g.sfx(rec ? 'success' : 'beep');
          this.g.ui.toast(`⏱️ Tour ${s.laps.length} : ${fmtLap(lap)}${rec ? ' (meilleur tour !)' : ''}`, rec ? 'good' : '', 2500);
        }
      }
      if (!(s.mode === 'race' && s.laps.length === 0 && s.passed === 0)) s.lapStart = now;
      s.passed = 0; s.next = 1;
    } else { s.passed++; s.next = (s.next + 1) % GATES.length; }
  }

  update(dt) {
    const g = this.g, s = this.s;
    if (!s || s.done) return;
    const now = g.now(), v = s.v;
    // feux de départ : le kart reste sur la grille
    if (s.mode === 'race') {
      const left = (s.green - now) / 1000;
      if (left > 0) {
        v.sim.place(s.grid.x, s.grid.z, s.grid.yaw);
        const on = Math.min(5, Math.floor((4 - left) / 0.8) + 1);
        [...this.lights.children].forEach((e, i) => e.classList.toggle('on', i < on));
        if (on !== s.lastOn) { s.lastOn = on; g.sfx('beep'); }
      } else if (this.lights.isConnected) { this.lights.remove(); g.sfx('go'); g.ui.toast('🟢 GO !', 'good', 1200); }
    }
    if (g.vehicles.current !== v) { this.end('Tu es sorti·e du kart.'); return; }
    this.gates(v.pos, now);
    // rester sur la piste
    const ex = (v.pos.x - TRACK.x) / (TRACK.rx + 14), ez = (v.pos.z - TRACK.z) / (TRACK.rz + 14);
    if (ex * ex + ez * ez > 1) { s.offTrack += dt; if (s.offTrack > 3) { this.end('Les karts ne quittent pas le circuit !'); return; } } else s.offTrack = 0;
    // PNJ
    const t = (now - (s.green || 0)) / 1000;
    for (const n of s.npcs) {
      const { prog, spin, done } = this.npcProgress(n, t);
      n.finished = !!done;
      // dépassement : on se décale si un kart est juste devant
      const ahead = s.npcs.find((o) => o !== n && o.prog > prog && o.prog - prog < 5 && Math.abs(o.lat - n.lat) < 1.6);
      const target = ahead ? (n.lat > 0 ? -2.2 : 2.2) : n.slot.lat * 0.6;
      n.lat += (target - n.lat) * Math.min(1, dt * 1.5);
      const moved = prog - n.prog;
      n.prog = prog;
      const p = trackAt(prog, n.lat);
      const yaw = p.yaw + spin * Math.PI * 2;
      n.vis.root.position.set(p.x, 0.16, p.z);
      n.vis.root.rotation.y = yaw;
      n.av.root.position.set(p.x - Math.sin(yaw) * 0.25, 0.22, p.z - Math.cos(yaw) * 0.25);
      n.av.root.rotation.y = yaw;
      n.av.update(dt, { speed: 0, grounded: true, pose: 'sit' });
      n.col.x = p.x; n.col.z = p.z;
      n.vis.roll(Math.max(0, moved), 0);
    }
    // affichage (5 fois par seconde)
    s.hudT -= dt;
    if (s.hudT <= 0) {
      s.hudT = 0.2;
      const cur = s.lapStart !== null && now >= (s.green || 0) ? (now - s.lapStart) / 1000 : null;
      if (s.mode === 'race') {
        const R = RACES[s.race];
        const myProg = s.laps.length * TRACK_LENGTH + this.progressOnLap(v.pos);
        const pos = 1 + s.npcs.filter((n) => n.prog > myProg).length;
        g.hud.track('kart', { title: `🏁 ${R.name}`, timer: cur !== null ? fmtLap(cur) : '', text: `Tour ${Math.min(R.laps, s.laps.length + 1)}/${R.laps} · position ${pos}/${s.npcs.length + 1} · meilleur ${fmtLap(s.best)}` });
        if (s.laps.length >= R.laps) this.end();
        else if (t > 60 && s.npcs.every((n) => n.finished) && t > Math.max(...s.npcs.map((n) => n.d.laps.at(-1))) + 60) this.end('Course terminée sans toi : drapeau à damier.');
      } else {
        const left = Math.max(0, (s.until - now) / 1000);
        g.hud.track('kart', { title: `🏎️ ${FORMULAS[s.formula].name}`, timer: `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`, text: `Tour en cours ${fmtLap(cur)} · meilleur ${fmtLap(s.best)} · ${s.laps.length} tour(s)`, button: { label: 'Rentrer au stand', onclick: () => this.end() } });
        if (left <= 0) this.end('Fin de la session !');
      }
    }
  }

  // Abscisse sur le tour en cours (projection sur la ligne médiane, depuis la ligne de départ).
  progressOnLap(pos) {
    let best = 0, bd = Infinity;
    for (let i = 0; i < TRACK_SAMPLES.length; i += 4) { const q = TRACK_SAMPLES[i]; const d = (q.x - pos.x) ** 2 + (q.z - pos.z) ** 2; if (d < bd) { bd = d; best = q.s; } }
    const s = this.s;
    return s.passed === 0 && s.next === 1 && best > TRACK_LENGTH * 0.8 ? 0 : best;
  }

  async end(why = '') {
    const g = this.g, s = this.s;
    if (!s || s.done) return;
    s.done = true;
    g.hud.track('kart', null);
    this.lights?.remove();
    let r = null;
    try { r = await g.net.request('kart.finish', {}); } catch (e) { g.ui.toast(e.message, 'bad'); }
    if (g.vehicles.current === s.v) g.vehicles.exit(true);
    g.vehicles.despawn(s.v, false);
    for (const n of s.npcs) { g.engine.scene.remove(n.vis.root); n.vis.dispose?.(); g.engine.scene.remove(n.av.root); g.labels.remove?.(n.lab); g.collision.remove(n.col); }
    const stand = (await import('../../shared/world-layout.js')).BUILDING_BY_ID['circuit-stand'];
    g.player.teleport(stand.door.x, stand.door.z + 1.5, 0);
    this.s = null;
    if (why) g.ui.toast(why, '', 3500);
    if (r) this.results(r);
  }

  results(r) {
    const g = this.g;
    g.sfx(r.place === 1 || r.record ? 'levelup' : 'success');
    if (r.place === 1) g.fx.confetti(g.player.pos, 80);
    const m = g.ui.modal({
      title: r.mode === 'race' ? (r.place ? `${r.place === 1 ? '🏆 Victoire' : `🏁 ${r.place}e place`} — ${RACES[r.race].name}` : '🏁 Abandon') : '🏎️ Fin de session',
      sub: r.mode === 'race' ? `Temps total ${fmtLap(r.total)} · meilleur tour ${fmtLap(r.best)}` : `${r.laps.length} tour(s) chronométré(s) · meilleur ${fmtLap(r.best)}${r.record ? ' · NOUVEAU RECORD PERSO !' : ''}`,
      build: (b) => {
        if (r.prize) b.append(h('p', `💰 Prix : ${fmt(r.prize)} PC`));
        if (r.laps?.length) b.append(h('p.muted', `Tours : ${r.laps.map(fmtLap).join(' · ')}`));
        if (r.ranking) b.append(h('table.board', r.ranking.map((x, i) => h(`tr${x.me ? '.me' : ''}`, h('td', String(i + 1)), h('td', x.name, x.npc ? h('span.pill', { style: { marginLeft: '6px' } }, `PNJ ${LEVELS[x.level]?.name || ''}`) : null), h('td.num', x.time ? fmtLap(x.time) : 'abandon')))));
      },
      foot: (f) => f.append(h('button.btn', { onclick: () => m.close() }, 'OK')),
    });
  }
}
