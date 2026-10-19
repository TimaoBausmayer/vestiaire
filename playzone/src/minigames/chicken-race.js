import * as THREE from 'three';
import { Minigame } from './minigame.js';
import { buildAnimal } from '../animals/models.js';
import { raceChickens } from '../../shared/minigame-logic.js';
import { MINIGAME_SPOTS } from '../../shared/world-layout.js';
import { makeSign } from '../world/signs.js';
import { PALETTE } from '../core/materials.js';

// COURSE DE POULETS : attrape les poulets (ils fuient !) et ramène-les un par un dans le panier.
const SPOT = MINIGAME_SPOTS.chickenRace;
const PEN = SPOT.pen, BASKET = SPOT.basket;

export class ChickenRace extends Minigame {
  constructor(game, def) {
    super(game, def, SPOT);
    this.maxDist = 30;
    this.carrying = null;
    this.inter = [];
  }

  static buildStatic(sb, col, scene) {
    const x1 = PEN.x - PEN.w / 2, x2 = PEN.x + PEN.w / 2, z1 = PEN.z - PEN.d / 2, z2 = PEN.z + PEN.d / 2;
    const fence = (ax, az, bx, bz) => {
      const len = Math.hypot(bx - ax, bz - az), n = Math.round(len / 1.5);
      for (let i = 0; i <= n; i++) sb.box(ax + (bx - ax) * (i / n), 0, az + (bz - az) * (i / n), 0.18, 1.2, 0.18, '#ffffff');
      sb.box((ax + bx) / 2, 0.4, (az + bz) / 2, Math.abs(bx - ax) + 0.1, 0.12, Math.abs(bz - az) + 0.1, '#ff5a5f');
      sb.box((ax + bx) / 2, 0.85, (az + bz) / 2, Math.abs(bx - ax) + 0.1, 0.12, Math.abs(bz - az) + 0.1, '#ff5a5f');
      col.addBox(Math.min(ax, bx) - 0.12, 0, Math.min(az, bz) - 0.12, Math.max(ax, bx) + 0.12, 1.2, Math.max(az, bz) + 0.12, { noCamera: true });
    };
    fence(x1, z1, x2, z1); fence(x1, z1, x1, z2); fence(x2, z1, x2, z2);
    fence(x1, z2, PEN.x - 2, z2); fence(PEN.x + 2, z2, x2, z2); // entrée au sud
    // panier géant
    sb.cyl(BASKET.x, 0, BASKET.z, 1.6, 0.9, '#b08a58', 14);
    sb.cyl(BASKET.x, 0.85, BASKET.z, 1.7, 0.12, '#8b5a2b', 14);
    sb.cyl(BASKET.x, 0.1, BASKET.z, 1.4, 0.75, '#e9c46a', 14);
    col.addCyl(BASKET.x, BASKET.z, 1.6, 0, 0.9, { noCamera: true });
    // poulailler décoratif + bottes de foin
    sb.box(x1 + 2.5, 0, z1 + 2, 3, 2, 2.4, '#e9c46a'); sb.gable(x1 + 2.5, 2, z1 + 2, 3.4, 1.2, 2.8, '#b5562d');
    col.addBoxC(x1 + 2.5, z1 + 2, 3, 2.4, 0, 3.2);
    for (const [hx, hz] of [[x2 - 3, z1 + 3], [x1 + 3, z2 - 3]]) { sb.add(SHAPE_CYL(), { x: hx, y: 0.6, z: hz, sx: 1.2, sy: 1.6, sz: 1.2, rz: Math.PI / 2, color: '#e9c46a' }); col.addCyl(hx, hz, 0.7, 0, 1.2); }
    const sign = makeSign('COURSE DE POULETS', 6, 1, { bg: '#ffd23f', fg: '#2b2350', border: '#ff5a5f' });
    sign.position.set(SPOT.x, 2.6, z2 + 0.2);
    scene.add(sign);
    for (const sx of [-3.1, 3.1]) sb.box(SPOT.x + sx, 0, z2 + 0.2, 0.2, 3.1, 0.2, PALETTE.woodDark);
  }

  onStart() {
    const g = this.game;
    this.chickens = raceChickens(this.seed, this.def.chickens).map((c) => {
      const model = buildAnimal('poulet');
      model.root.position.set(c.x, 0, c.z);
      g.engine.scene.add(model.root);
      return { ...c, model, yaw: Math.random() * 6, state: 'idle', timer: Math.random() * 2, done: false, vx: 0, vz: 0, phase: 0 };
    });
    if (Math.hypot(g.player.pos.x - PEN.x, g.player.pos.z - PEN.z) > 12) g.player.teleport(PEN.x, PEN.z + PEN.d / 2 - 1.5, Math.PI);
    this.carrying = null;
    this.inter.push(g.interactions.add({
      r: 1.9, priority: 3,
      x: () => this.nearChicken()?.x ?? 1e9, z: () => this.nearChicken()?.z ?? 1e9,
      enabled: () => this.state === 'playing' && this.carrying === null && !!this.nearChicken(),
      label: 'Attraper le poulet !', action: () => this.grab(this.nearChicken()),
    }));
    this.inter.push(g.interactions.add({
      x: BASKET.x, z: BASKET.z, r: 3.2, priority: 3,
      enabled: () => this.state === 'playing' && this.carrying !== null,
      label: 'Déposer le poulet dans le panier', action: () => this.deliver(),
    }));
  }

  nearChicken() {
    const P = this.game.player.pos;
    let best = null, bd = 1.9;
    for (const c of this.chickens || []) {
      if (c.done || c === this.carrying) continue;
      const d = Math.hypot(c.x - P.x, c.z - P.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  async grab(c) {
    if (!c || this.carrying) return;
    const g = this.game;
    this.carrying = c;
    g.player.carrying = true;
    g.player.setPose('carry');
    g.sfx('cluck');
    try { await g.net.request('mg.event', { kind: 'grab', chicken: c.i }); } catch (e) { this.carrying = null; g.player.carrying = false; g.player.setPose('idle'); g.ui.toast(e.message, 'bad'); }
  }

  async deliver() {
    const g = this.game, c = this.carrying;
    if (!c) return;
    try {
      const r = await g.net.request('mg.event', { kind: 'deliver' });
      c.done = true;
      c.model.root.position.set(BASKET.x + (Math.random() - 0.5) * 1.6, 0.7, BASKET.z + (Math.random() - 0.5) * 1.6);
      this.setScore(r.score);
      g.sfx('pop');
      g.fx.burst({ x: BASKET.x, y: 0.4, z: BASKET.z }, '#ffffff', 16);
      const scr = g.toScreen(g.player.pos, 2.4);
      if (scr) g.ui.floater('+1 🐔', scr.x, scr.y);
    } catch (e) { g.ui.toast(e.message, 'bad'); return; } finally { this.carrying = null; g.player.carrying = false; g.player.setPose('idle'); }
    if (this.chickens.every((x) => x.done)) { g.ui.toast('Tous les poulets sont rentrés ! Bravo !', 'good'); this.finish(); }
  }

  onUpdate(dt) {
    if (!this.chickens) return;
    const g = this.game, P = g.player.pos;
    const x1 = PEN.x - PEN.w / 2 + 0.8, x2 = PEN.x + PEN.w / 2 - 0.8, z1 = PEN.z - PEN.d / 2 + 0.8, z2 = PEN.z + PEN.d / 2 - 0.8;
    for (const c of this.chickens) {
      const m = c.model;
      if (c.done) { m.root.rotation.y += dt * 0.5; continue; }
      if (c === this.carrying) {
        // tenu à bout de bras, au-dessus de la tête, qui gigote
        const fx = Math.sin(g.player.yaw), fz = Math.cos(g.player.yaw);
        m.root.position.set(P.x + fx * 0.55, P.y + 1.25 + Math.sin(this.t * 25) * 0.04, P.z + fz * 0.55);
        m.root.rotation.y = g.player.yaw;
        m.wings[0].rotation.z = -Math.sin(this.t * 30) * 0.8; m.wings[1].rotation.z = Math.sin(this.t * 30) * 0.8;
        continue;
      }
      const dx = c.x - P.x, dz = c.z - P.z, d = Math.hypot(dx, dz);
      let speed = 0;
      if (this.state === 'playing' && d < 3.6) {
        // fuite (avec un peu d'aléatoire pour les rendre attrapables)
        const a = Math.atan2(dx, dz) + Math.sin(this.t * 3 + c.i) * 0.7;
        c.yaw = a; speed = 4.3;
      } else {
        c.timer -= dt;
        if (c.timer < 0) { c.timer = 1 + Math.random() * 2; c.yaw += (Math.random() - 0.5) * 2.5; c.walking = Math.random() < 0.6; }
        speed = c.walking ? 1.2 : 0;
      }
      c.x += Math.sin(c.yaw) * speed * dt;
      c.z += Math.cos(c.yaw) * speed * dt;
      // rebond sur les clôtures
      if (c.x < x1 || c.x > x2) { c.x = Math.max(x1, Math.min(x2, c.x)); c.yaw = -c.yaw; }
      if (c.z < z1 || c.z > z2) { c.z = Math.max(z1, Math.min(z2, c.z)); c.yaw = Math.PI - c.yaw; }
      const db = Math.hypot(c.x - BASKET.x, c.z - BASKET.z);
      if (db < 2.2) { c.x = BASKET.x + ((c.x - BASKET.x) / (db || 1)) * 2.2; c.z = BASKET.z + ((c.z - BASKET.z) / (db || 1)) * 2.2; }
      c.phase += dt * speed * 4;
      m.root.position.set(c.x, Math.abs(Math.sin(c.phase)) * 0.12 * (speed > 2 ? 1 : 0.4), c.z);
      m.root.rotation.y = c.yaw;
      const flap = speed > 2 ? 0.6 + Math.sin(this.t * 22) * 0.5 : 1.3;
      m.wings[0].rotation.z = -flap; m.wings[1].rotation.z = flap;
      if (speed > 2 && Math.random() < dt * 0.6) g.sfx('cluck');
    }
  }

  onEnd() {
    const g = this.game;
    for (const c of this.chickens || []) g.engine.scene.remove(c.model.root);
    this.chickens = null;
    for (const it of this.inter) g.interactions.remove(it);
    this.inter = [];
    this.carrying = null;
    g.player.carrying = false;
    g.player.setPose('idle');
  }

  mapMarkers() { return this.state !== 'idle' ? [{ x: BASKET.x, z: BASKET.z, color: '#ffd23f', icon: '🧺' }] : []; }
}

import { SHAPES } from '../core/static-builder.js';
const SHAPE_CYL = () => SHAPES.cyl(12);
