import * as THREE from 'three';
import { h } from '../ui/dom.js';
import { Avatar } from '../characters/avatar.js';
import { DEFAULT_APPEARANCE, SKINS, HAIR_STYLES, COLORS } from '../../shared/appearance.js';
import { mulberry32, hashString } from '../../shared/rng.js';
import { SKI, PISTES, LIFTS, KICKERS, SKI_GATES, skiSurf, pisteAt, DISC, fmtTime } from '../../shared/courses.js';

// STATION DE SKI DU MONT-PINARD : 5 pistes (verte, bleue avec bosses, rouge à bosses, noire « le Mur »,
// snowpark à tremplins), 2 télésièges, ski ou snowboard. La glisse suit la pente du relief : on prend
// de la vitesse, on décolle sur les tremplins et les bosses, figures en l'air (rotations, grab).
// Commandes : gauche / droite = virages (rotations en l'air), Avant = schuss / grab en l'air,
// Arrière = chasse-neige, Espace = ollie (petit saut).

const req = async (g, t, p) => { try { return await g.net.request(t, p); } catch (e) { g.ui.toast(e.message, 'bad', 5000); g.sfx('error'); return null; } };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const CX = (SKI.x1 + SKI.x2) / 2;
const LIFT_T = 15;
const COLOR = { verte: '#2a9d3a', bleue: '#1d4ed8', rouge: '#e63946', noire: '#14141c', park: '#ff9f1c' };
const liftPath = (L, u) => { const z = SKI.bottom - 2 + (L.top + 4 - (SKI.bottom - 2)) * u; return { x: L.x, y: skiSurf(L.x, z) + 7.5, z }; };

export class Ski {
  constructor(g) {
    this.g = g;
    this.s = null;
    this.equip = 'ski';
    this.build();
    g.interactions.add({ x: SKI.hut.x, z: SKI.hut.z + 2.5, r: 3, priority: 3, label: '⛷️ Station du Mont-Pinard : forfaits, télésièges, 5 pistes, snowpark', action: () => g.races?.desk('ski') });
  }

  // ------------------------------------------------------------------------------ décor
  build() {
    const g = this.g, root = new THREE.Group();
    root.name = 'ski';
    const x0 = SKI.x1 - 14, x1 = SKI.x2 + 14, z0 = SKI.top - 22, z1 = SKI.bottom + 6;
    const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, 140, 110).rotateX(-Math.PI / 2);
    geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    const pos = geo.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
    const snow = new THREE.Color('#f5f9fc'), groomed = new THREE.Color('#e6eef5'), wood = new THREE.Color('#dfe8e4'), rock = new THREE.Color('#9aa3a8');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), y = skiSurf(x, z);
      pos.setY(i, y + 0.04);
      const P = pisteAt(x), inP = Math.abs(x - P.cx) < P.w / 2;
      c.copy(inP ? snow : wood);
      if (inP) c.lerp(groomed, 0.5 + 0.5 * Math.sin(x * 1.3 + Math.sin(z * 0.15) * 2));   // traces de dameuse
      if (inP && Math.abs(Math.abs(x - P.cx) - P.w / 2) < 1.2) c.lerp(new THREE.Color(COLOR[P.color]), 0.35);   // balisage
      if (!inP && y > 4 && Math.sin(x * 0.7) * Math.sin(z * 0.5) > 0.55) c.lerp(rock, 0.5);
      if (x < SKI.x1 - 4 || x > SKI.x2 + 4) c.lerp(rock, 0.4);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const mtn = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
    mtn.receiveShadow = true; root.add(mtn);
    g.collision.addBox(SKI.x1 - 10, -1, SKI.top - 18, SKI.x2 + 10, 70, SKI.bottom - 12, { noCamera: true });
    // front de neige (en bas)
    const front = new THREE.Mesh(new THREE.PlaneGeometry(SKI.x2 - SKI.x1 + 20, 14).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#eef4f8', roughness: 0.9 }));
    front.position.set(CX, 0.035, SKI.bottom + 4); root.add(front);
    // sommets enneigés au loin (décor au nord de l'autoroute)
    const rockM = new THREE.MeshStandardMaterial({ color: '#8d969c', flatShading: true }), capM = new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true });
    for (let i = 0; i < 9; i++) {
      const hh = 90 + (i % 3) * 35, r = 70 + (i % 2) * 30, x = -980 + i * 110, z = -1080 - (i % 2) * 40;
      const m = new THREE.Mesh(new THREE.ConeGeometry(r, hh, 7), rockM); m.position.set(x, hh / 2 - 6, z); root.add(m);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.38, hh * 0.38, 7), capM); cap.position.set(x, hh - 6 - hh * 0.19, z); root.add(cap);
    }
    // sapins entre les pistes et sur les bords
    const r = mulberry32(7), pine = new THREE.MeshStandardMaterial({ color: '#2f6b3a', flatShading: true }), white = new THREE.MeshStandardMaterial({ color: '#ffffff' });
    const pinesG = new THREE.ConeGeometry(1.5, 4.8, 7), capG = new THREE.ConeGeometry(0.75, 1.5, 7);
    const lanes = Object.values(PISTES).sort((a, b) => a.cx - b.cx);
    for (let k = 0; k < 160; k++) {
      let x;
      const side = Math.floor(r() * (lanes.length + 1));
      if (side === 0) x = SKI.x1 - 2 - r() * 8; else if (side === lanes.length) x = SKI.x2 + 2 + r() * 8;
      else { const a = lanes[side - 1], b = lanes[side]; x = a.cx + a.w / 2 + 1 + r() * Math.max(1, (b.cx - b.w / 2) - (a.cx + a.w / 2) - 2); }
      const z = SKI.top + r() * (SKI.bottom - SKI.top - 12), y = skiSurf(x, z), s = 0.7 + r() * 0.8;
      const t = new THREE.Mesh(pinesG, pine); t.scale.setScalar(s); t.position.set(x, y + 2.4 * s, z); root.add(t);
      const cp = new THREE.Mesh(capG, white); cp.scale.setScalar(s); cp.position.set(x, y + 4.3 * s, z); root.add(cp);
    }
    // panneaux de départ de piste, balises, portes de slalom, tremplins colorés
    for (const P of Object.values(PISTES)) {
      const y = skiSurf(P.cx, P.top + 2);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3, 0.2), new THREE.MeshStandardMaterial({ color: '#8d5a2b' })); post.position.set(P.cx - P.w / 2 + 2, y + 1.5, P.top + 2); root.add(post);
      const sign = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.1, 0.12), new THREE.MeshStandardMaterial({ color: COLOR[P.color] })); sign.position.set(P.cx - P.w / 2 + 2, y + 3.2, P.top + 2); root.add(sign);
      const pm = new THREE.MeshStandardMaterial({ color: COLOR[P.color] }), pg = new THREE.CylinderGeometry(0.06, 0.06, 1.4, 5);
      for (let z = P.top + 10; z < SKI.bottom - 4; z += 14) for (const sx of [-1, 1]) { const b = new THREE.Mesh(pg, pm); b.position.set(P.cx + sx * (P.w / 2 - 0.5), skiSurf(P.cx + sx * (P.w / 2 - 0.5), z) + 0.7, z); root.add(b); }
    }
    for (const k of KICKERS) { const P = PISTES.park; const m = new THREE.Mesh(new THREE.BoxGeometry(P.w - 8, 0.15, 0.4), new THREE.MeshStandardMaterial({ color: '#ff9f1c' })); m.position.set(P.cx, skiSurf(P.cx, k.z - 0.05) + 0.05, k.z - 0.2); root.add(m); }
    for (const [i, gt] of SKI_GATES.entries()) {
      const m = new THREE.MeshStandardMaterial({ color: i % 2 ? '#1d4ed8' : '#e63946' });
      for (const dx of [-3.5, 3.5]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.8, 6), m); p.position.set(gt.x + dx, skiSurf(gt.x + dx, gt.z) + 0.9, gt.z); root.add(p); const f = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.6, 0.8), m); f.position.set(gt.x + dx, skiSurf(gt.x + dx, gt.z) + 1.4, gt.z + 0.4); root.add(f); }
    }
    // arche d'arrivée, chalet d'accueil, gares des télésièges
    const woodM = new THREE.MeshStandardMaterial({ color: '#8d5a2b' }), roofM = new THREE.MeshStandardMaterial({ color: '#b5452f' });
    for (const sx of [-1, 1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5, 0.5), roofM); m.position.set(CX + sx * 30, 2.5, SKI.bottom + 1); root.add(m); }
    const banner = new THREE.Mesh(new THREE.BoxGeometry(60.5, 1.4, 0.3), roofM); banner.position.set(CX, 5.2, SKI.bottom + 1); root.add(banner);
    const ch = new THREE.Mesh(new THREE.BoxGeometry(12, 4.5, 6), woodM); ch.position.set(SKI.hut.x, 2.25, SKI.hut.z - 2.5); root.add(ch);
    const cr = new THREE.Mesh(new THREE.ConeGeometry(8.6, 3, 4), roofM); cr.rotation.y = Math.PI / 4; cr.scale.z = 0.55; cr.position.set(SKI.hut.x, 6, SKI.hut.z - 2.5); root.add(cr);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(7, 1.1, 0.2), new THREE.MeshStandardMaterial({ color: '#1d4ed8' })); sign.position.set(SKI.hut.x, 3.9, SKI.hut.z + 0.55); root.add(sign);
    g.collision.addBox(SKI.hut.x - 6, 0, SKI.hut.z - 5.5, SKI.hut.x + 6, 4.5, SKI.hut.z + 0.5);
    // télésièges
    const steel = new THREE.MeshStandardMaterial({ color: '#7c858d' }), seatM = new THREE.MeshStandardMaterial({ color: '#e63946' });
    this.chairs = [];
    const rr = mulberry32(3);
    for (const L of LIFTS) {
      for (let u = 0; u <= 1.001; u += 1 / 7) { const p = liftPath(L, u); const py = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 8, 8), steel); py.position.set(L.x, p.y - 4, p.z); root.add(py); const bar = new THREE.Mesh(new THREE.BoxGeometry(5, 0.3, 0.3), steel); bar.position.set(L.x, p.y + 0.4, p.z); root.add(bar); }
      for (const dx of [-2, 2]) for (let k = 0; k < 7; k++) { const a = liftPath(L, k / 7), b = liftPath(L, (k + 1) / 7); const dir = new THREE.Vector3(0, b.y - a.y, b.z - a.z), len = dir.length(); const cab = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, len, 4), new THREE.MeshStandardMaterial({ color: '#222' })); cab.position.set(L.x + dx, (a.y + b.y) / 2 + 0.4, (a.z + b.z) / 2); cab.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()); root.add(cab); }
      for (const z of [SKI.bottom - 2, L.top + 4]) { const st = new THREE.Mesh(new THREE.BoxGeometry(7, 4, 5), woodM); st.position.set(L.x, skiSurf(L.x, z) + 2, z + (z > -800 ? 4 : -4)); root.add(st); }
      for (let i = 0; i < 16; i++) {
        const grp = new THREE.Group();
        const seat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.6), seatM); seat.position.y = -1.6;
        const back = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 0.1), seatM); back.position.set(0, -1.3, -0.3);
        const rod = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.6, 0.06), steel); rod.position.y = -0.8;
        grp.add(seat, back, rod);
        // des skieurs PNJ assis sur certains sièges
        if (rr() < 0.4) { const av = new Avatar({ ...DEFAULT_APPEARANCE, top: 'sweat', topColor: COLORS[Math.floor(rr() * COLORS.length)], hat: 'bonnet', skin: SKINS[Math.floor(rr() * 8)] }, {}); av.root.position.set(0, -2.05, 0); av.root.scale.setScalar(0.9); av.update(0.1, { speed: 0, grounded: true, pose: 'sit' }); grp.add(av.root); }
        root.add(grp); this.chairs.push({ m: grp, u: i / 16, L });
      }
    }
    g.engine.scene.add(root);
    // équipement aux pieds : skis ou snowboard
    this.skis = new THREE.Group();
    for (const dx of [-0.16, 0.16]) { const k = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 1.7), new THREE.MeshStandardMaterial({ color: '#ffd23f' })); k.position.set(dx, 0.02, 0.1); this.skis.add(k); }
    this.board = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.32), new THREE.MeshStandardMaterial({ color: '#8338ec' }));
    this.board.position.y = 0.03;
    this.gear = new THREE.Group(); this.gear.add(this.skis, this.board); this.gear.visible = false;
    g.engine.scene.add(this.gear);
    // skieurs PNJ qui descendent les pistes (ambiance)
    this.locals = [];
    const lr = mulberry32(11);
    for (let i = 0; i < 8; i++) {
      const P = Object.values(PISTES)[i % 5];
      const av = new Avatar({ ...DEFAULT_APPEARANCE, top: 'sweat', topColor: COLORS[Math.floor(lr() * COLORS.length)], hat: lr() < 0.6 ? 'bonnet' : null, skin: SKINS[Math.floor(lr() * 8)], hair: HAIR_STYLES[Math.floor(lr() * HAIR_STYLES.length)] }, {});
      g.engine.scene.add(av.root);
      this.locals.push({ av, P, z: P.top + lr() * (SKI.bottom - P.top), ph: lr() * 6, sp: 7 + lr() * 6, amp: 4 + lr() * (P.w / 2 - 6) });
    }
  }

  // ------------------------------------------------------------------------------ départ
  async go(mode) {
    const g = this.g, M = DISC.ski.modes[mode];
    const pick = await new Promise((resolve) => {
      let piste = M.piste || 'bleue', equip = this.equip;
      const m = g.ui.modal({
        title: '⛷️ Ta descente', sub: M.name, width: 'min(560px, 96vw)',
        build: (b) => {
          b.append(h('div.field', h('label', 'Équipement'), h('div.opt-row', [['ski', '🎿 Ski'], ['snowboard', '🏂 Snowboard']].map(([id, l]) => h(`button.opt${equip === id ? '.sel' : ''}`, { onclick: () => { equip = id; m.refresh(); } }, l)))));
          if (!M.piste) b.append(h('div.field', h('label', 'Piste'), h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } }, Object.entries(PISTES).map(([id, P]) => h(`button.opt${piste === id ? '.sel' : ''}`, { onclick: () => { piste = id; m.refresh(); } }, `${P.icon} ${P.name} (${P.color === 'park' ? 'tremplins' : P.color})`)))));
          b.append(h('p.muted', 'Gauche / droite : virages · Avant : schuss (en l\'air : grab) · Arrière : chasse-neige · Espace : ollie · en l\'air, gauche / droite = rotations.'));
        },
        foot: (f) => f.append(h('button.btn.ghost', { onclick: () => { m.close(); resolve(null); } }, 'Annuler'), h('button.btn', { onclick: () => { m.close(); resolve({ piste, equip }); } }, '🚡 Prendre le télésiège')),
      });
    });
    if (!pick) return;
    return this.start(mode, pick.piste, pick.equip);
  }

  async start(mode, piste, equip = 'ski') {
    const g = this.g, M = DISC.ski.modes[mode];
    this.equip = equip;
    const r = await req(g, 'sport.start', { disc: 'ski', mode });
    if (!r) return;
    if (r.trial) g.ui.toast('🎁 Essai gratuit !', 'good', 2500);
    if (g.vehicles?.current) g.vehicles.exit(true);
    const P = PISTES[M.piste || piste] || PISTES.bleue;
    g.player.external = true;
    g.player.noJump = true;
    this.s = { mode, M, P, equip, L: LIFTS[P.lift], phase: 'lift', t: 0, x: P.cx, z: P.top + 3, y: 0, vy: 0, yaw: 0, vis: 0, v: 0, air: 0, spin: 0, grab: 0, maxY: 0, gates: 0, gi: 0, crashed: 0, hudT: 0, field: r.field, npcs: [], score: 0, tricks: 0 };
    this.skipBtn = h('div.foot-btns', h('button', { onpointerdown: (e) => { e.preventDefault(); if (this.s?.phase === 'lift') this.s.t = LIFT_T; } }, '⏩ Arriver en haut'));
    g.ui.root.append(this.skipBtn);
    g.ui.toast(`🚡 ${this.s.L.name} → ${P.icon} ${P.name}. Profite de la vue ! (⏩ pour arriver en haut)`, '', 4000);
  }

  startDescent() {
    const s = this.s, g = this.g;
    s.phase = 'wait'; s.t = 0;
    s.x = s.P.cx; s.z = s.P.top + 3; s.y = skiSurf(s.x, s.z); s.yaw = 0; s.vis = 0; s.v = 0; s.vy = 0;
    this.skipBtn?.remove();
    this.gear.visible = true; this.skis.visible = s.equip === 'ski'; this.board.visible = s.equip === 'snowboard';
    for (const n of s.field) {
      if (s.M.score) continue;
      const r = mulberry32(hashString(n.name));
      const av = new Avatar({ ...DEFAULT_APPEARANCE, skin: SKINS[Math.floor(r() * 8)], hair: HAIR_STYLES[Math.floor(r() * HAIR_STYLES.length)], top: 'sweat', topColor: COLORS[Math.floor(r() * COLORS.length)], hat: 'bonnet' }, {});
      g.engine.scene.add(av.root);
      const label = document.createElement('div'); label.className = 'wlabel'; label.textContent = `${n.name} (PNJ)`;
      s.npcs.push({ n, av, lab: g.labels.add(av.root, label, 2.1, 50) });
    }
    this.lights = h('div.kart-lights', [0, 1, 2].map(() => h('span')));
    g.ui.root.append(this.lights);
  }

  // ------------------------------------------------------------------------------ boucle
  update(dt) {
    const g = this.g, s = this.s;
    for (const c of this.chairs) { c.u = (c.u + dt / (LIFT_T * 2)) % 1; const up = c.u < 0.5, u = up ? c.u * 2 : 2 - c.u * 2, p = liftPath(c.L, u); c.m.position.set(p.x + (up ? 2 : -2), p.y + 0.4, p.z); c.m.rotation.y = up ? Math.PI : 0; }
    this.updateLocals(dt);
    if (!s) return;
    const P = g.player, I = g.input;
    if (s.phase === 'lift') {
      s.t += dt;
      const p = liftPath(s.L, Math.min(1, s.t / LIFT_T));
      P.pos.set(p.x + 2, p.y - 1.55, p.z); P.yaw = Math.PI;
      P.avatar.root.position.set(p.x + 2, p.y - 2.05, p.z); P.avatar.root.rotation.set(0, Math.PI, 0);
      P.avatar.update(dt, { speed: 0, grounded: true, pose: 'sit' });
      if (s.t >= LIFT_T) this.startDescent();
      return;
    }
    if (s.phase === 'wait') {
      s.t += dt;
      const on = Math.min(3, Math.floor(s.t / 0.7) + 1);
      [...this.lights.children].forEach((e, i) => e.classList.toggle('on', i < on));
      if (on !== s.lastOn) { s.lastOn = on; g.sfx('beep'); }
      if (s.t >= 2.1) { this.lights.remove(); s.phase = 'run'; s.t = 0; g.sfx('go'); g.ui.toast('🟢 Partez !', 'good', 1000); }
    } else this.physics(dt, I);
    if (this.s) this.render(dt, I);
  }

  physics(dt, I) {
    const g = this.g, s = this.s;
    s.t += dt;
    const skill = g.profile.sports.ski?.skill || 5, board = s.equip === 'snowboard';
    const ground = skiSurf(s.x, s.z);
    const airborne = s.y > ground + 0.12;
    if (s.crashed > 0) { s.crashed -= dt; s.v = Math.max(0, s.v - 20 * dt); s.y = ground; s.vy = 0; }
    else if (!airborne) {
      // gravité selon la pente sous les skis
      const e = 0.6, gx = (skiSurf(s.x + e, s.z) - skiSurf(s.x - e, s.z)) / (2 * e), gz = (skiSurf(s.x, s.z + e) - skiSurf(s.x, s.z - e)) / (2 * e);
      const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw);
      const tuck = I.move.y > 0.3, plow = I.move.y < -0.3;
      const acc = -9.8 * (gx * fx + gz * fz) * 0.92 - (plow ? 0.32 : 0.04) * 9.8 - (tuck ? 0.0022 : 0.0035) * s.v * s.v;
      s.v = clamp(s.v + acc * dt, 0, 31 + skill / 20);
      const turn = (board ? 1.5 : 1.7) + skill / 80;
      s.yaw = clamp(s.yaw - I.move.x * turn * dt, -1.5, 1.5);
      s.vis += wrap(s.yaw - s.vis) * Math.min(1, dt * 12);
      s.v *= 1 - Math.abs(I.move.x) * 0.1 * dt;
      if (I.pressed('Space')) { s.vy = 3.6; s.y = ground + 0.15; s.air = 0; s.spin = 0; s.grab = 0; s.maxY = 0; g.sfx('jump'); }
    }
    // déplacement + vertical (balistique en l'air, sinon on suit la neige)
    const pz = s.z;
    s.x += Math.sin(s.yaw) * s.v * dt;
    s.z += Math.cos(s.yaw) * s.v * dt;
    const g2 = skiSurf(s.x, s.z);
    if (airborne || s.vy > 0) {
      s.vy -= 9.8 * dt; s.y += s.vy * dt;
      s.air += dt; s.maxY = Math.max(s.maxY, s.y - g2);
      if (I.move.x) { const sp = I.move.x * 6.5 * dt; s.vis -= sp; s.spin += Math.abs(sp); }
      if (I.move.y > 0.3) s.grab += dt;
      if (s.y <= g2) this.land(g2);
    } else {
      const vyT = (g2 - ground) / Math.max(dt, 1e-3);
      // décollage : la neige descend d'un coup sous les skis (lèvre d'un tremplin, sommet d'une bosse)
      if (g2 < ground - 0.05 && (s.vyPrev || 0) > 0.6 && s.v > 6) { s.vy = s.vyPrev; s.y = ground; s.air = 0; s.spin = 0; s.grab = 0; s.maxY = 0; }
      else { s.y = g2; s.vy = 0; }
      s.vyPrev = vyT;
    }
    // bords : chute dans la poudreuse
    if (s.x < SKI.x1 + 1 || s.x > SKI.x2 - 1) { s.x = clamp(s.x, SKI.x1 + 2, SKI.x2 - 2); this.crash('❄️ Hors-piste : chute dans la poudreuse !'); }
    // portes de slalom (rouge)
    const gt = SKI_GATES[s.gi];
    if (s.M.gates && gt && pz < gt.z && s.z >= gt.z) { if (Math.abs(s.x - gt.x) < 3.5) { s.gates++; g.sfx('beep'); } else g.ui.toast('❌ Porte manquée (+5 s)', 'bad', 1000); s.gi++; }
    if (s.z >= SKI.bottom - 1) this.finish();
  }

  land(ground) {
    const s = this.s, g = this.g, board = s.equip === 'snowboard';
    const air = s.air, height = s.maxY, spinTot = s.spin;
    s.y = ground; s.vy = 0; s.air = 0; s.spin = 0;
    const half = board ? Math.PI : Math.PI * 2;
    const rots = Math.round(spinTot / half);
    const err = Math.abs(wrap((s.vis - s.yaw) - (board && rots % 2 ? Math.PI : 0)));
    if (err > 0.75 && spinTot > 0.5) { this.crash('💥 Réception ratée !'); return; }
    s.vis = s.yaw;
    if (air < 0.45) return;
    const deg = Math.round(rots * (board ? 180 : 360));
    const grab = s.grab > 0.3;
    const pts = Math.round(air * 120 + height * 25 + rots * (board ? 110 : 200) + (grab ? 80 : 0));
    s.score += pts; s.tricks++;
    s.grab = 0;
    g.sfx(pts > 300 ? 'levelup' : 'success');
    g.ui.toast(`🏂 ${deg ? `${deg}°` : 'Saut'}${grab ? ' + grab' : ''} : ${height.toFixed(1)} m, ${air.toFixed(1)} s en l'air → ${pts} pts`, 'good', 2200);
  }

  crash(msg) {
    const s = this.s;
    if (s.crashed > 0) return;
    s.crashed = 1.6; s.v *= 0.3; s.vis = s.yaw;
    this.g.sfx('bump'); this.g.ui.toast(msg, 'bad', 1300);
  }

  render(dt, I) {
    const g = this.g, s = this.s, P = g.player;
    const ground = skiSurf(s.x, s.z), y = Math.max(s.y, ground);
    P.pos.set(s.x, y, s.z); P.yaw = s.vis; P.vel.set(Math.sin(s.yaw) * s.v, s.vy, Math.cos(s.yaw) * s.v);
    const board = s.equip === 'snowboard';
    const bodyYaw = s.vis + (board ? Math.PI / 2 : 0);
    P.avatar.root.position.set(s.x, y, s.z); P.avatar.root.rotation.set(s.crashed > 0 ? 1.25 : 0, bodyYaw, 0);
    const inAir = s.y > ground + 0.12;
    P.avatar.update(dt, { speed: 0, grounded: true, pose: s.crashed > 0 ? 'down' : inAir && s.grab > 0 ? 'sit' : board ? 'spray' : I.move.y > 0.3 ? 'sit' : 'hold-forward' });
    // l'équipement suit la pente
    const e = 0.8, slopeX = Math.atan2(skiSurf(s.x, s.z + e) - skiSurf(s.x, s.z - e), 2 * e);
    this.gear.position.set(s.x, y + 0.02, s.z);
    this.gear.rotation.set(inAir ? 0.2 : slopeX * Math.cos(s.vis), s.vis, 0, 'YXZ');
    if (s.v > 8 && !inAir && Math.random() < dt * 14) g.fx.emit({ x: s.x, y: y + 0.1, z: s.z, n: 3, colors: ['#ffffff', '#e8f4ff'], speed: 2, gravity: 5, life: 0.5, size: 0.15 });
    // concurrents PNJ (slalom)
    if (s.phase === 'run') for (const n of s.npcs) {
      const u = Math.min(1, s.t / n.n.total);
      const z = s.P.top + 3 + (SKI.bottom - s.P.top - 3) * u;
      const k = SKI_GATES.findIndex((gt) => gt.z > z);
      const ga = SKI_GATES[Math.max(0, k - 1)] || { x: s.P.cx, z: s.P.top }, gb = SKI_GATES[k] || { x: s.P.cx, z: SKI.bottom };
      const w = clamp((z - ga.z) / ((gb.z - ga.z) || 1), 0, 1), x = ga.x + (gb.x - ga.x) * w;
      n.av.root.position.set(x, skiSurf(x, z), z); n.av.root.rotation.y = Math.atan2(gb.x - ga.x, 14);
      n.av.update(dt, { speed: 0, grounded: true, pose: 'hold-forward' });
    }
    s.hudT -= dt;
    if (s.hudT <= 0) {
      s.hudT = 0.2;
      const pos = 1 + s.npcs.filter((n) => Math.min(1, s.t / n.n.total) > (s.z - s.P.top) / (SKI.bottom - s.P.top)).length;
      g.hud.track('ski', { title: `${board ? '🏂' : '⛷️'} ${s.P.icon} ${s.P.name}`, timer: fmtTime(s.t), text: `${Math.round(s.v * 3.6)} km/h${s.M.gates ? ` · portes ${s.gates}/${s.gi}` : ''}${s.M.score || s.tricks ? ` · figures ${s.score} pts` : ''}${s.npcs.length ? ` · position ${pos}/${s.npcs.length + 1}` : ''}`, button: { label: 'Abandonner', onclick: () => this.finish(true) } });
    }
  }

  updateLocals(dt) {
    const P = this.g.player.pos;
    if (Math.abs(P.x - CX) > 320 || P.z > SKI.bottom + 260) return;
    for (const l of this.locals) {
      l.z += l.sp * dt;
      if (l.z > SKI.bottom - 2) l.z = l.P.top + 4;
      l.ph += dt * 1.1;
      const x = l.P.cx + Math.sin(l.ph) * l.amp;
      l.av.root.position.set(x, skiSurf(x, l.z), l.z);
      l.av.root.rotation.set(0, Math.cos(l.ph) * 0.6, 0);
      l.av.update(dt, { speed: 0, grounded: true, pose: 'hold-forward' });
    }
  }

  async finish(abandon = false) {
    const s = this.s, g = this.g;
    if (!s) return;
    this.s = null;
    this.skipBtn?.remove(); this.lights?.remove();
    for (const n of s.npcs) { g.engine.scene.remove(n.av.root); n.av.dispose?.(); g.labels.remove?.(n.lab); }
    this.gear.visible = false;
    g.hud.track('ski', null);
    g.player.external = false; g.player.noJump = false;
    if (abandon || s.phase !== 'run') { g.player.teleport(SKI.hut.x, SKI.hut.z + 5, Math.PI); await req(g, 'sport.finish', { abandon: true }); return; }
    g.player.teleport(clamp(s.x, SKI.x1 + 4, SKI.x2 - 4), SKI.bottom + 6, 0);
    g.net.sendState?.(g.player.netState(), g.player.zone);
    const r = await req(g, 'sport.finish', { time: s.t, gates: s.gates, score: s.score });
    if (!r) return;
    g.sfx(r.rank === 1 || r.record ? 'levelup' : 'success');
    const pos = r.rank ? `${r.rank === 1 ? '🥇 VICTOIRE' : `${r.rank}e`} sur ${r.of}. ` : '';
    const res = s.M.score ? `Score : ${r.score} pts (${s.tricks} figure(s))` : `Temps : ${fmtTime(r.total)}${r.missed ? ` (dont ${r.missed * 5} s de pénalité)` : ''}${s.tricks ? ` · ${s.score} pts de figures` : ''}`;
    g.ui.dialog({ name: 'Le moniteur Jean-Schuss', role: s.M.name, text: `${pos}${res}.${r.record ? ' NOUVEAU RECORD !' : ''}${r.prize ? ` Prix : ${r.prize} PC.` : ''} Niveau ${Math.round(r.skill)}/100.`, choices: [
      { label: '🚡 Remonter', action: (m) => { m.close(); g.player.teleport(SKI.hut.x, SKI.hut.z + 3, Math.PI); this.go(s.mode); } },
      { label: 'OK', ghost: true, action: (m) => m.close() },
    ] });
  }
}
