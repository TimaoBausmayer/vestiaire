import * as THREE from 'three';
import { buildMergedGeometry, SHAPES as B } from '../core/static-builder.js';
import { actorMaterial } from '../core/materials.js';
import { groundHeight, WATER_LEVEL } from '../../shared/world-layout.js';
import { h } from '../ui/dom.js';

// VÉHICULES : trottinette, caddie turbo, scooter, voiturette. On les appelle depuis le téléphone,
// on monte (E), on conduit (Z/S ou flèches : accélérer/freiner, Q/D : tourner), H : klaxon.
export const SPECS = {
  trottinette: { name: 'Trottinette', max: 9.5, acc: 7, turn: 2.6, seatY: 0.18, pose: 'hold-forward', radius: 0.6, seatZ: -0.1 },
  caddie: { name: 'Caddie Turbo', max: 12, acc: 8, turn: 2.8, seatY: 0.62, pose: 'sit', radius: 0.8, seatZ: -0.05 },
  scooter: { name: 'Scooter', max: 15.5, acc: 9, turn: 2.3, seatY: 0.62, pose: 'sit', radius: 0.9, seatZ: -0.25 },
  voiturette: { name: 'Voiturette', max: 18.5, acc: 10, turn: 2.0, seatY: 0.42, pose: 'sit', radius: 1.3, seatZ: -0.25, seatX: -0.35 },
};

const cache = new Map();
export function vehicleGeometry(model, color) {
  const key = `${model}|${color}`;
  if (cache.has(key)) return cache.get(key);
  const wheel = (sb, x, z, r = 0.3, w = 0.2) => { sb.add(B.cyl(12), { x, y: r, z, sx: r * 2, sy: w, sz: r * 2, rz: Math.PI / 2, color: '#1b1b24' }); sb.add(B.cyl(8), { x, y: r, z, sx: r, sy: w + 0.02, sz: r, rz: Math.PI / 2, color: '#c7ccd4' }); };
  const geo = buildMergedGeometry((sb) => {
    if (model === 'trottinette') {
      sb.box(0, 0.12, 0, 0.35, 0.06, 1.1, color);
      sb.add(B.cyl(6), { y: 0.15, z: 0.52, sx: 0.06, sy: 1.0, sz: 0.06, rx: -0.15, color: '#30343f' });
      sb.add(B.cyl(6), { y: 1.1, z: 0.6, sx: 0.05, sy: 0.6, sz: 0.05, rz: Math.PI / 2, color: '#30343f' });
      wheel(sb, 0, 0.5, 0.11, 0.08); wheel(sb, 0, -0.45, 0.11, 0.08);
    } else if (model === 'caddie') {
      const m = '#c7ccd4';
      for (const x of [-0.35, 0.35]) sb.box(x, 0.35, 0, 0.04, 0.6, 1.0, m);
      sb.box(0, 0.35, -0.48, 0.74, 0.6, 0.04, m); sb.box(0, 0.35, 0.48, 0.74, 0.6, 0.04, m); sb.box(0, 0.33, 0, 0.74, 0.04, 1.0, m);
      for (let i = 0; i < 5; i++) { sb.box(-0.36, 0.45 + i * 0.1, 0, 0.05, 0.02, 1.0, color); sb.box(0.36, 0.45 + i * 0.1, 0, 0.05, 0.02, 1.0, color); }
      sb.box(0, 1.0, -0.62, 0.8, 0.06, 0.06, color);
      for (const [x, z] of [[-0.3, -0.4], [0.3, -0.4], [-0.3, 0.4], [0.3, 0.4]]) { sb.box(x, 0.1, z, 0.03, 0.25, 0.03, m); wheel(sb, x, z, 0.08, 0.05); }
      sb.add(B.cone(8), { y: 0.5, z: -0.75, sx: 0.25, sy: 0.4, sz: 0.25, rx: Math.PI / 2 + Math.PI, color: '#ff9f1c' }); // "réacteur"
    } else if (model === 'scooter') {
      sb.box(0, 0.3, 0, 0.45, 0.25, 1.3, color);
      sb.box(0, 0.55, -0.3, 0.4, 0.15, 0.6, '#2b2d42');
      sb.box(0, 0.3, 0.6, 0.45, 0.8, 0.2, color);
      sb.add(B.cyl(6), { y: 1.1, z: 0.62, sx: 0.05, sy: 0.75, sz: 0.05, rz: Math.PI / 2, color: '#30343f' });
      sb.box(0, 0.85, 0.72, 0.2, 0.15, 0.05, '#fff3b0');
      wheel(sb, 0, 0.62, 0.25, 0.14); wheel(sb, 0, -0.55, 0.25, 0.14);
    } else {
      sb.box(0, 0.25, 0, 1.6, 0.55, 2.6, color);
      sb.box(0, 0.8, 0.95, 1.5, 0.12, 0.6, color);
      sb.box(0, 0.8, 0.7, 1.45, 0.5, 0.06, '#cfe8ff');
      for (const x of [-0.35, 0.35]) { sb.box(x, 0.55, -0.25, 0.6, 0.15, 0.6, '#2b2d42'); sb.box(x, 0.65, -0.55, 0.6, 0.6, 0.12, '#2b2d42'); }
      sb.add(B.cyl(10), { x: -0.35, y: 0.85, z: 0.35, sx: 0.32, sy: 0.04, sz: 0.32, rx: -1.1, color: '#14141c' });
      sb.box(0, 0.45, 1.31, 1.2, 0.15, 0.02, '#fff3b0'); sb.box(0, 0.45, -1.31, 1.2, 0.12, 0.02, '#e63946');
      for (const [x, z] of [[-0.8, 0.85], [0.8, 0.85], [-0.8, -0.85], [0.8, -0.85]]) wheel(sb, x, z, 0.3, 0.2);
    }
  });
  cache.set(key, geo);
  return geo;
}

export class Vehicles {
  constructor(game) {
    this.game = game;
    this.parked = null;   // véhicule appelé : { v (données profil), mesh, pos, yaw, speed }
    this.driving = false;
    game.interactions.add({
      r: 2.6, priority: 3,
      x: () => this.parked?.pos.x ?? 1e9, z: () => this.parked?.pos.z ?? 1e9,
      enabled: () => !!this.parked && !this.driving,
      label: () => `🔑 Monter : ${SPECS[this.parked?.v.model]?.name}`,
      action: () => this.enter(),
    });
    game.interactions.add({
      zone: 'any', r: 5, priority: 10,
      x: () => game.player.pos.x, z: () => game.player.pos.z,
      enabled: () => this.driving, label: '🚪 Descendre du véhicule', action: () => this.exit(),
    });
    game.input.on('key', (e) => { if (e.code === 'KeyH' && this.driving) this.honk(); });
    game.on('profile', (p) => {
      if (!this.parked) return;
      const v = p.vehicles.find((x) => x.id === this.parked.v.id);
      if (!v) { this.despawn(); return; }
      if (v.color !== this.parked.v.color) { this.parked.v = v; this.parked.mesh.geometry = vehicleGeometry(v.model, v.color); }
    });
  }

  summon(vehicleId) {
    const g = this.game;
    if (g.player.zone !== 'world') { g.ui.toast('Impossible d\'appeler un véhicule ici.', 'bad'); return; }
    const v = g.profile.vehicles.find((x) => x.id === vehicleId);
    if (!v) return;
    if (this.driving) this.exit();
    this.despawn();
    const yaw = g.player.yaw;
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const pos = new THREE.Vector3(g.player.pos.x + rx * 2.4, 0, g.player.pos.z + rz * 2.4);
    pos.y = g.collision.supportAt(pos.x, pos.z, g.player.pos.y + 0.5, 0.5);
    const mesh = new THREE.Mesh(vehicleGeometry(v.model, v.color), actorMaterial);
    mesh.castShadow = true;
    g.engine.scene.add(mesh);
    this.parked = { v, mesh, pos, yaw, speed: 0 };
    this.place();
    g.fx.burst(pos, '#ffffff', 16);
    g.sfx('pop');
    g.ui.toast(`${SPECS[v.model].name} livré(e) à côté de toi ! Approche-toi et appuie sur E.`, 'good');
  }

  despawn() {
    if (!this.parked) return;
    this.game.engine.scene.remove(this.parked.mesh);
    this.parked = null;
  }

  enter() {
    const g = this.game;
    if (!this.parked || g.player.carrying || g.jobs?.active?.job.id === 'cook') { g.ui.toast('Impossible de conduire maintenant.', 'bad'); return; }
    this.driving = true;
    g.player.vehicle = this.parked.v;
    g.sfx('door');
    g.hud.track('vehicle', { title: `🛵 ${SPECS[this.parked.v.model].name}`, text: g.input.isTouch ? 'Joystick : avancer / tourner. Bouton ✋ : descendre.' : 'Z/S : avancer/freiner · Q/D : tourner · H : klaxon · E : descendre' });
  }

  exit() {
    const g = this.game, c = this.parked;
    if (!this.driving) return;
    this.driving = false;
    g.player.vehicle = null;
    c.speed = 0;
    const rx = Math.cos(c.yaw), rz = -Math.sin(c.yaw);
    g.player.teleport(c.pos.x - rx * 1.6, c.pos.z - rz * 1.6, c.yaw);
    g.hud.track('vehicle', null);
  }

  honk() {
    this.game.sfx('honk');
    this.game.labels.bubble(this.game.avatar.root, 'Pouet pouet !', 1500, 'player');
  }

  place() {
    const c = this.parked;
    c.mesh.position.copy(c.pos);
    c.mesh.rotation.y = c.yaw;
  }

  update(dt) {
    const g = this.game, c = this.parked;
    if (!c) return;
    if (g.player.zone !== 'world' && !this.driving) { this.despawn(); return; }
    if (!this.driving) return;
    const sp = SPECS[c.v.model];
    const inp = g.input;
    const frozen = g.ui.blocking || g.cutscene;
    const throttle = frozen ? 0 : inp.move.y, steer = frozen ? 0 : inp.move.x;
    if (throttle > 0.05) c.speed += throttle * sp.acc * dt * (c.speed < 0 ? 2.5 : 1);
    else if (throttle < -0.05) c.speed += throttle * sp.acc * dt * (c.speed > 0 ? 2.5 : 0.8);
    else c.speed *= Math.exp(-1.4 * dt);
    c.speed = Math.max(-sp.max * 0.35, Math.min(sp.max, c.speed));
    c.yaw -= steer * sp.turn * dt * Math.max(-1, Math.min(1, c.speed / 4));
    const before = c.pos.clone();
    c.pos.x += Math.sin(c.yaw) * c.speed * dt;
    c.pos.z += Math.cos(c.yaw) * c.speed * dt;
    const hit = g.collision.pushOut(c.pos, sp.radius, 1.4, 0.6);
    if (hit && Math.abs(c.speed) > 4) { c.speed *= -0.25; g.sfx('land'); g.cam.shake = 0.4; } else if (hit) c.speed *= 0.6;
    const support = g.collision.supportAt(c.pos.x, c.pos.z, c.pos.y + 0.5, sp.radius * 0.5, 0.6);
    c.pos.y += (support - c.pos.y) * Math.min(1, dt * 12);
    // dans l'eau profonde : le véhicule coule
    if (groundHeight(c.pos.x, c.pos.z) < WATER_LEVEL - 0.7) {
      g.ui.toast('Glouglou... ton véhicule a coulé. Il retourne au garage (rappelle-le depuis le téléphone).', 'bad', 5000);
      g.sfx('splat');
      const p = before;
      this.exit();
      g.player.teleport(p.x, p.z, c.yaw);
      this.despawn();
      return;
    }
    this.place();
    c.mesh.rotation.z = -steer * Math.min(1, Math.abs(c.speed) / sp.max) * (c.v.model === 'scooter' || c.v.model === 'trottinette' ? 0.25 : 0.04);
    // le joueur est assis / debout sur le véhicule
    const p = g.player;
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), rx = Math.cos(c.yaw), rz = -Math.sin(c.yaw);
    p.pos.set(c.pos.x + fx * sp.seatZ + rx * (sp.seatX || 0), c.pos.y + sp.seatY, c.pos.z + fz * sp.seatZ + rz * (sp.seatX || 0));
    p.yaw = c.yaw;
    p.speed = Math.abs(c.speed);
    p.grounded = true;
    g.avatar.root.position.copy(p.pos);
    g.avatar.root.rotation.y = c.yaw;
    g.avatar.root.rotation.z = c.mesh.rotation.z;
    g.avatar.update(dt, { speed: 0, grounded: true, pose: sp.pose });
    // la caméra se replace doucement derrière le véhicule
    if (Math.abs(c.speed) > 2 && !inp.look.dx) {
      const want = c.yaw + Math.PI;
      g.cam.yaw += Math.atan2(Math.sin(want - g.cam.yaw), Math.cos(want - g.cam.yaw)) * Math.min(1, dt * 2.2);
    }
    if (c.v.model === 'caddie' && c.speed > 8 && Math.random() < dt * 20) g.fx.emit({ x: c.pos.x - fx * 0.8, y: c.pos.y + 0.5, z: c.pos.z - fz * 0.8, n: 1, colors: ['#ff9f1c', '#ffd23f'], speed: 1, gravity: 0, life: 0.3, size: 0.25 });
  }

  mapMarkers() { return this.parked && !this.driving ? [{ x: this.parked.pos.x, z: this.parked.pos.z, color: '#2ec4b6', icon: '🛵', r: 4 }] : []; }
}

// Panneau "Garage" (téléphone) : appeler un véhicule, le repeindre.
export function garagePanel(game, container, refresh) {
  const p = game.profile;
  if (!p.vehicles.length) { container.append(h('p', 'Tu n\'as pas encore de véhicule. Le Garage Roule-Toujours est sur la Grande Place (côté est).')); return; }
  for (const v of p.vehicles) {
    container.append(h('div.list-item', h('span', { style: { fontSize: '26px' } }, { trottinette: '🛴', caddie: '🛒', scooter: '🛵', voiturette: '🚗' }[v.model]),
      h('div.grow', h('div.t', SPECS[v.model].name), h('div.d', h('span', { style: { display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: v.color, verticalAlign: 'middle', marginRight: '6px' } }), 'Peinture actuelle')),
      h('button.btn.small', { onclick: () => { game.phone?.close(); game.vehicles.summon(v.id); } }, 'Appeler')));
  }
  container.append(h('p.muted', { style: { marginTop: '10px' } }, `Peintures en stock : ${p.inventory.peinture || 0} (Garage Roule-Toujours, 150 PC).`));
  if (p.inventory.peinture > 0) {
    for (const v of p.vehicles) {
      container.append(h('div.field', h('label', `Repeindre : ${SPECS[v.model].name}`), h('div.swatches', ['#ff5a5f', '#ff9f1c', '#ffd23f', '#7ac74f', '#2ec4b6', '#3d8ee8', '#5b3fa6', '#c77dff', '#ff8fab', '#f4f1ea', '#2b2d42', '#14213d'].map((c) => h('button.swatch', {
        style: { background: c }, onclick: async () => { try { await game.net.request('vehicle.paint', { vehicleId: v.id, color: c }); game.ui.toast('Nouvelle couleur !', 'good'); refresh?.(); } catch (e) { game.ui.toast(e.message, 'bad'); } },
      })))));
    }
  }
}
