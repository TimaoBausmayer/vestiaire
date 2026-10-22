import * as THREE from 'three';
import { h, fmt } from '../ui/dom.js';
import { Avatar } from '../characters/avatar.js';
import { DEFAULT_APPEARANCE, SKINS, COLORS } from '../../shared/appearance.js';
import { groundHeight, WATER_LEVEL, BUILDING_BY_ID } from '../../shared/world-layout.js';
import { mulberry32, hashString } from '../../shared/rng.js';
import { DISC, ROUTES, GATE_R, routeAt, fmtTime } from '../../shared/courses.js';
import { Wake } from './wake.js';

// JET SKI : balade en mer, parcours de bouées chronométré, course contre des pilotes PNJ.
// Avant = gaz, Arrière = frein / marche arrière, gauche / droite = virer (ça dérape !),
// Espace = saut sur une vague (rotations en l'air avec gauche / droite).

const req = async (g, t, p) => { try { return await g.net.request(t, p); } catch (e) { g.ui.toast(e.message, 'bad', 5000); g.sfx('error'); return null; } };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const R = ROUTES.bouees;
const wave = (x, z, t) => 0.18 * Math.sin(x * 0.11 + t * 1.3) + 0.12 * Math.sin(z * 0.17 - t * 1.7) + 0.06 * Math.sin((x + z) * 0.31 + t * 2.3);

function hull(paint) {
  const g = new THREE.Group();
  const m = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, metalness: 0.1, ...o });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 1.9, 6, 12).rotateX(Math.PI / 2), m(paint)); body.scale.set(1, 0.55, 1); body.position.y = 0.25; g.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 12).rotateX(Math.PI / 2), m(paint)); nose.scale.set(1, 0.55, 1); nose.position.set(0, 0.32, 1.45); g.add(nose);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.08, 2.2), m('#ffffff')); stripe.position.set(0, 0.33, 0); g.add(stripe);
  const seat = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.0, 4, 8).rotateX(Math.PI / 2), m('#14141c', { roughness: 0.7 })); seat.position.set(0, 0.62, -0.3); g.add(seat);
  const cons = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.35, 0.45), m('#2b2d42')); cons.position.set(0, 0.7, 0.55); cons.rotation.x = -0.4; g.add(cons);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6).rotateZ(Math.PI / 2), m('#c0c4ca', { metalness: 0.8 })); bar.position.set(0, 0.95, 0.5); g.add(bar);
  return g;
}

export class Jetski {
  constructor(g) {
    this.g = g;
    this.s = null;
    this.rig = hull('#e63946');
    this.rig.visible = false;
    g.engine.scene.add(this.rig);
    this.wake = new Wake(g.engine.scene, { width: 1.4, y: WATER_LEVEL + 0.04 });
    // bouées du parcours (orange, avec fanion)
    const root = new THREE.Group(), bm = new THREE.MeshStandardMaterial({ color: '#ff7b00', roughness: 0.4 }), fm = new THREE.MeshStandardMaterial({ color: '#ffd23f' });
    this.buoys = [];
    for (const gt of R.gates) {
      const b = new THREE.Group();
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.8, 14, 10), bm); b.add(ball);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2, 5), new THREE.MeshStandardMaterial({ color: '#333' })); pole.position.y = 1.2; b.add(pole);
      const flag = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.5, 0.8), fm); flag.position.set(0, 1.9, 0.4); b.add(flag);
      b.position.set(gt.x, WATER_LEVEL, gt.z); root.add(b); this.buoys.push(b);
    }
    g.engine.scene.add(root);
  }

  go(mode) { return this.start(mode); }

  async start(mode) {
    const g = this.g, D = DISC.jetski, M = D.modes[mode];
    const r = await req(g, 'sport.start', { disc: 'jetski', mode });
    if (!r) return;
    if (r.trial) g.ui.toast('🎁 Essai gratuit !', 'good', 2500);
    if (g.vehicles?.current) g.vehicles.exit(true);
    const st = routeAt(R, -12);
    g.player.external = true; g.player.noJump = true;
    this.s = { mode, M, x: st.x, z: st.z, yaw: st.yaw, vx: 0, vz: 0, y: 0, vy: 0, spin: 0, air: 0, vis: st.yaw, next: 1, lap: 0, laps: [], go: r.go, lapStart: r.go, hudT: 0, npcs: [], tricks: 0, until: M.free ? g.now() + M.free * 1000 : 0 };
    this.rig.visible = true;
    this.wake.clear();
    const own = (g.profile.inventory.jetski || 0) > 0;
    // pilotes PNJ
    r.field.forEach((n, i) => {
      const rr = mulberry32(hashString(n.name));
      const grp = hull(COLORS[Math.floor(rr() * COLORS.length)]);
      const av = new Avatar({ ...DEFAULT_APPEARANCE, skin: SKINS[Math.floor(rr() * 8)], top: 'sweat', topColor: COLORS[Math.floor(rr() * COLORS.length)] }, {});
      av.root.position.set(0, 0.45, -0.35); av.update(0.1, { speed: 0, grounded: true, pose: 'sit' }); grp.add(av.root);
      g.engine.scene.add(grp);
      const label = document.createElement('div'); label.className = 'wlabel'; label.textContent = `${n.name} (PNJ)`;
      const w = new Wake(g.engine.scene, { width: 1.2, y: WATER_LEVEL + 0.035, n: 40 });
      this.s.npcs.push({ n, grp, av, lab: g.labels.add(grp, label, 2, 60), lat: ((i % 3) - 1) * 4, back: 6 + Math.floor(i / 3) * 6, prog: 0, wake: w });
    });
    this.buttons = h('div.foot-btns', h('button', { onpointerdown: (e) => { e.preventDefault(); this.jump(); } }, '🌊 Saut (Espace)'), h('button', { onpointerdown: (e) => { e.preventDefault(); this.stop(true); } }, '🏖️ Rentrer'));
    g.ui.root.append(this.buttons);
    if (M.laps) { this.lights = h('div.kart-lights', [0, 1, 2, 3, 4].map(() => h('span'))); g.ui.root.append(this.lights); }
    g.ui.toast(`🚤 ${M.name}${own ? ' avec TON jet ski' : ''} ! Avant = gaz, gauche / droite = virer, Espace = saut.`, 'good', 5000);
    g.sfx('start');
  }

  jump() {
    const s = this.s;
    if (!s || s.y > 0.05) return;
    const sp = Math.hypot(s.vx, s.vz);
    if (sp < 8) { this.g.ui.toast('Trop lent pour décoller !', '', 1000); return; }
    s.vy = 3.2 + sp * 0.18; s.y = 0.06; s.air = 0; s.spin = 0; s.liftYaw = s.yaw;
    this.g.sfx('whoosh');
  }

  update(dt) {
    const s = this.s, g = this.g;
    this.wake.update(dt);
    if (!s) return;
    const I = g.input, now = g.now(), t = now / 1000;
    const left = (s.go - now) / 1000;
    const racing = !!s.M.laps, waiting = racing && left > 0;
    if (waiting) {
      const on = Math.min(5, Math.floor((3 - left) / 0.55) + 1);
      [...this.lights.children].forEach((e, i) => e.classList.toggle('on', i < on));
      if (on !== s.lastOn) { s.lastOn = on; g.sfx('beep'); }
    } else if (this.lights?.isConnected) { this.lights.remove(); g.sfx('go'); g.ui.toast('🟢 GO !', 'good', 1000); }
    const skill = g.profile.sports.jetski?.skill || 5;
    const maxV = 21 + skill / 12;
    if (s.y > 0) {
      s.air += dt; s.vy -= 9.8 * dt; s.y += s.vy * dt;
      if (I.move.x) { const sp = I.move.x * 6 * dt; s.vis -= sp; s.spin += Math.abs(sp); }
      if (s.y <= 0) this.land();
    } else if (!waiting) {
      // propulsion dans l'axe, dérapage latéral amorti
      const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw);
      const along = s.vx * fx + s.vz * fz;
      const thr = I.move.y > 0.1 ? I.move.y * 11 : I.move.y < -0.1 ? I.move.y * 9 : 0;
      let na = along + (thr - along * 0.18) * dt;
      na = clamp(na, -5, maxV);
      const lx = s.vx - along * fx, lz = s.vz - along * fz;
      const keep = Math.max(0, 1 - dt * 2.2);
      s.vx = fx * na + lx * keep; s.vz = fz * na + lz * keep;
      s.yaw -= I.move.x * (1.4 + Math.min(1.2, Math.abs(na) / 12)) * dt * (na < 0 ? -1 : 1);
      s.vis += wrap(s.yaw - s.vis) * Math.min(1, dt * 10);
      if (I.pressed('Space')) this.jump();
    }
    if (waiting) { s.vx = 0; s.vz = 0; }
    s.x += s.vx * dt; s.z += s.vz * dt;
    // rester en eau profonde
    if (groundHeight(s.x, s.z) > WATER_LEVEL - 0.7 || s.z > 236 || Math.abs(s.x) > 896) { s.x -= s.vx * dt * 1.5; s.z -= s.vz * dt * 1.5; s.vx *= -0.3; s.vz *= -0.3; g.sfx('bump'); }
    const sp = Math.hypot(s.vx, s.vz);
    const wy = wave(s.x, s.z, t);
    const y = WATER_LEVEL + 0.05 + wy * (sp > 12 ? 0.4 : 1) + Math.max(0, s.y);
    this.rig.position.set(s.x, y, s.z);
    this.rig.rotation.set(-Math.min(0.25, sp / 70) + (s.y > 0 ? -0.15 : 0), s.vis, -I.move.x * Math.min(0.35, sp / 50), 'YXZ');
    const P = g.player;
    P.pos.set(s.x, y + 0.45, s.z); P.yaw = s.vis; P.vel.set(s.vx, s.vy, s.vz); P.speed = sp;
    P.avatar.root.position.set(s.x - Math.sin(s.vis) * 0.35, y + 0.45, s.z - Math.cos(s.vis) * 0.35); P.avatar.root.rotation.set(0, s.vis, 0);
    P.avatar.update(dt, { speed: 0, grounded: true, pose: 'sit' });
    if (sp > 3 && s.y <= 0) { this.wake.push(s.x - Math.sin(s.vis) * 1.3, s.z - Math.cos(s.vis) * 1.3, s.vis, Math.min(1, sp / 16)); if (Math.random() < dt * 18) g.fx.emit({ x: s.x - Math.sin(s.vis) * 1.4, y: WATER_LEVEL + 0.3, z: s.z - Math.cos(s.vis) * 1.4, n: 3, colors: ['#ffffff', '#cfefff'], speed: 3, gravity: 9, life: 0.6, size: 0.18 }); }
    for (const b of this.buoys) b.position.y = WATER_LEVEL + wave(b.position.x, b.position.z, t) - 0.25;
    // portes / tours
    if (racing && !waiting) {
      const gt = R.gates[s.next];
      if (Math.hypot(s.x - gt.x, s.z - gt.z) < GATE_R.bouees) {
        if (s.next === 0) { const lap = (now - s.lapStart) / 1000; s.laps.push(lap); s.lapStart = now; s.lap++; g.sfx('success'); if (s.lap >= s.M.laps) { this.stop(false); return; } g.ui.toast(`⏱️ Tour ${s.lap} : ${fmtTime(lap)}`, 'good', 1800); }
        s.next = (s.next + 1) % R.gates.length;
      }
      this.buoys.forEach((b, i) => b.scale.setScalar(i === s.next ? 1.4 + Math.sin(t * 6) * 0.15 : 1));
    }
    // PNJ
    const rt = Math.max(0, (now - s.go) / 1000);
    for (const n of s.npcs) {
      const L = R.len, laps = n.n.laps;
      let k = laps.findIndex((x) => rt < x), prog;
      if (rt <= 0) prog = -n.back; else if (k < 0) prog = laps.length * L + (rt - laps[laps.length - 1]) * 3; else { const t0 = k ? laps[k - 1] : 0; const u = (rt - t0) / (laps[k] - t0); prog = k * L + (k ? 0 : -n.back) + (L + (k ? 0 : n.back)) * u; }
      const moved = prog - n.prog; n.prog = prog;
      const p = routeAt(R, prog);
      n.grp.position.set(p.x + Math.cos(p.yaw) * n.lat, WATER_LEVEL + 0.05 + wave(p.x, p.z, t) * 0.4, p.z - Math.sin(p.yaw) * n.lat);
      n.grp.rotation.set(-0.15, p.yaw, 0, 'YXZ');
      if (moved > 0.05) n.wake.push(n.grp.position.x - Math.sin(p.yaw) * 1.3, n.grp.position.z - Math.cos(p.yaw) * 1.3, p.yaw, 0.8);
      n.wake.update(dt);
    }
    if (s.until && now > s.until) { g.ui.toast('⏱️ Fin de la balade !', '', 2500); this.stop(true); return; }
    s.hudT -= dt;
    if (s.hudT <= 0) {
      s.hudT = 0.2;
      const gt = R.gates[s.next], gs = s.next === 0 ? R.len : (s.next / R.gates.length) * R.len;
      const my = s.lap * R.len + gs - Math.min(Math.hypot(s.x - gt.x, s.z - gt.z), R.len / R.gates.length);
      const pos = 1 + s.npcs.filter((n) => n.prog > my).length;
      g.hud.track('jetski', { title: `🚤 ${s.M.name}`, timer: racing ? fmtTime(rt) : s.until ? fmtTime(Math.max(0, (s.until - now) / 1000)) : '', text: `${Math.round(sp * 3.6)} km/h${racing ? ` · tour ${Math.min(s.M.laps, s.lap + 1)}/${s.M.laps} · bouée ${s.next + 1}` : ''}${s.npcs.length ? ` · position ${pos}/${s.npcs.length + 1}` : ''}${s.tricks ? ` · ${s.tricks} figure(s)` : ''}`, button: { label: 'Rentrer', onclick: () => this.stop(true) } });
    }
  }

  land() {
    const s = this.s, g = this.g;
    const rots = Math.round(s.spin / (Math.PI * 2));
    const err = Math.abs(wrap(s.vis - s.yaw));
    s.y = 0; s.vy = 0;
    if (err > 0.8 && s.spin > 0.5) { s.vx *= 0.2; s.vz *= 0.2; s.vis = s.yaw; g.sfx('splat'); g.ui.toast('💦 Plouf ! Réception ratée.', 'bad', 1200); return; }
    s.vis = s.yaw;
    g.fx.emit({ x: s.x, y: WATER_LEVEL + 0.3, z: s.z, n: 14, colors: ['#ffffff', '#bfe9ff'], speed: 4, gravity: 9, life: 0.8, size: 0.2 });
    if (s.air > 0.5) { s.tricks++; g.sfx('success'); g.ui.toast(`🌊 ${rots ? `${rots * 360}° !` : 'Joli saut !'} (${s.air.toFixed(1)} s en l'air)`, 'good', 1500); }
  }

  async stop(abandon) {
    const s = this.s, g = this.g;
    if (!s) return;
    this.s = null;
    this.rig.visible = false;
    this.buttons?.remove(); this.lights?.remove();
    for (const n of s.npcs) { g.engine.scene.remove(n.grp); g.labels.remove?.(n.lab); n.wake.clear(); g.engine.scene.remove(n.wake.mesh); }
    this.buoys.forEach((b) => b.scale.setScalar(1));
    g.hud.track('jetski', null);
    g.player.external = false; g.player.noJump = false;
    const time = (g.now() - s.go) / 1000;
    if (!abandon) { const p0 = R.pts[0]; g.player.pos.set(p0.x, 0, p0.z); g.net.sendState?.(g.player.netState(), g.player.zone); }
    const r = await req(g, 'sport.finish', abandon ? { abandon: true } : { time, laps: s.laps });
    const shop = BUILDING_BY_ID['surf-shop'];
    g.player.teleport(shop.door.x, shop.door.z + 3, Math.PI);
    if (abandon || !r) return;
    g.sfx(r.rank === 1 || r.record ? 'levelup' : 'success');
    const pos = r.rank ? `${r.rank === 1 ? '🥇 VICTOIRE' : `${r.rank}e`} sur ${r.of}. ` : '';
    g.ui.dialog({ name: 'Kéké le moniteur', role: s.M.name, text: `${pos}Temps : ${fmtTime(r.total)}${r.bestLap ? ` · meilleur tour ${fmtTime(r.bestLap)}` : ''}.${r.record ? ' NOUVEAU RECORD !' : ''}${r.prize ? ` Prix : ${fmt(r.prize)} PC.` : ''} Niveau jet ski ${Math.round(r.skill)}/100.`, choices: [{ label: 'OK', ghost: true, action: (m) => m.close() }] });
  }
}
