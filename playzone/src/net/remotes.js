import * as THREE from 'three';
import { Avatar } from '../characters/avatar.js';
import { PetFollower } from '../animals/pets.js';
import { CarVisual, seatOf } from '../vehicles/car-models.js';
import { VEHICLES } from '../../shared/content/vehicles.js';
import { JOB_BY_ID } from '../../shared/content/jobs.js';
import { levelFromXp } from '../../shared/rules.js';
import { h } from '../ui/dom.js';

// AUTRES JOUEURS (en ligne) : reçus du serveur 10 fois par seconde, affichés avec ~120 ms de retard
// pour interpoler en douceur. Avatar, tenue de métier, animal, véhicule, bulles de chat.
const DELAY = 120;
const uniformOf = (duty) => (duty && JOB_BY_ID[duty] ? JOB_BY_ID[duty].uniform : {});

class Remote {
  constructor(game, info) {
    this.game = game;
    this.id = info.id;
    this.buf = [];
    this.pos = new THREE.Vector3(info.x ?? 0, info.y ?? 0, info.z ?? 0);
    this.yaw = info.ry || 0;
    this.zone = info.zone || 'world';
    this.avatar = new Avatar(info.appearance, { ...(info.phy || {}), ...uniformOf(info.duty) });
    game.engine.scene.add(this.avatar.root);
    this.labelEl = h('div.wlabel');
    this.label = game.labels.add(this.avatar.root, this.labelEl, 2.45, 30);
    this.setInfo(info);
  }

  setInfo(info) {
    this.info = { ...this.info, ...info };
    const i = this.info;
    this.name = i.name;
    this.labelEl.textContent = '';
    this.labelEl.append(`${i.stars ? `${'★'.repeat(i.stars)} ` : ''}${i.name}`, h('span.tag', ` #${i.tag}`), h('div.tag', `Niv. ${levelFromXp(i.level || 0)}${i.duty ? ` · ${JOB_BY_ID[i.duty]?.name || i.duty}` : ''}`));
    const key = JSON.stringify([i.appearance, i.duty, i.phy]);
    if (key !== this.appKey) { this.appKey = key; this.avatar.setAppearance(i.appearance, { ...(i.phy || {}), ...uniformOf(i.duty) }); }
    const petKey = i.pet ? JSON.stringify(i.pet) : null;
    if (petKey !== this.petKey) {
      this.petKey = petKey;
      this.pet?.dispose();
      this.pet = i.pet ? new PetFollower(this.game, { ...i.pet, food: 100, fedAt: 0, joy: 100, joyAt: 0 }, false) : null;
    }
  }

  push(at, a) {
    this.buf.push({ at, x: a[1], y: a[2], z: a[3], ry: a[4], s: a[5], p: a[6], d: a[7], g: a[8], w: a[9], v: a[10], c: a[11] });
    if (this.buf.length > 30) this.buf.shift();
  }

  update(dt, t, now, myZone) {
    const rt = now - DELAY;
    const b = this.buf;
    let s;
    if (!b.length) return;
    let i = b.length - 1;
    while (i > 0 && b[i - 1].at > rt) i--;
    if (i > 0 && b[i].at >= rt) {
      const a = b[i - 1], c = b[i];
      const k = Math.max(0, Math.min(1, (rt - a.at) / (c.at - a.at || 1)));
      s = { ...c, x: a.x + (c.x - a.x) * k, y: a.y + (c.y - a.y) * k, z: a.z + (c.z - a.z) * k, ry: a.ry + Math.atan2(Math.sin(c.ry - a.ry), Math.cos(c.ry - a.ry)) * k };
    } else s = b[b.length - 1];
    const jump = Math.hypot(s.x - this.pos.x, s.z - this.pos.z) > 25;
    if (jump) this.pos.set(s.x, s.y, s.z); else this.pos.lerp(new THREE.Vector3(s.x, s.y, s.z), Math.min(1, dt * 20));
    this.yaw = s.ry;
    const visible = this.zone === myZone;
    this.avatar.root.visible = visible;
    this.avatar.root.position.copy(this.pos);
    this.avatar.root.rotation.y = this.yaw;
    // véhicule : le joueur est assis ; on en déduit la position de la caisse
    if (s.v && visible && VEHICLES[s.v]) {
      if (!this.veh || this.vehKey !== `${s.v}|${s.c}`) {
        this.disposeVehicle();
        this.vehKey = `${s.v}|${s.c}`;
        this.veh = new CarVisual(s.v, { paint: s.c || '#e63946' });
        this.game.engine.scene.add(this.veh.root);
      }
      const seat = seatOf(s.v);
      const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw), lx = Math.cos(this.yaw), lz = -Math.sin(this.yaw);
      const cx = this.pos.x - fx * seat.z - lx * seat.x, cz = this.pos.z - fz * seat.z - lz * seat.x;
      const moved = this.lastVeh ? Math.hypot(cx - this.lastVeh.x, cz - this.lastVeh.z) : 0;
      this.lastVeh = { x: cx, z: cz };
      this.veh.root.visible = true;
      this.veh.root.position.set(cx, this.pos.y - seat.y, cz);
      this.veh.root.rotation.y = this.yaw;
      const dyaw = Math.atan2(Math.sin(this.yaw - (this.prevYaw ?? this.yaw)), Math.cos(this.yaw - (this.prevYaw ?? this.yaw)));
      this.veh.roll(moved, Math.max(-0.5, Math.min(0.5, dyaw / Math.max(0.001, dt) * 0.3)));
      this.veh.setLights(this.game.world?.dayNight?.night || 0);
      this.veh.setDetail(this.game.engine.camera.position.distanceTo(this.pos) < 60 ? 0 : 1);
      this.avatar.root.scale.setScalar((this.info.appearance?.height || 1) * seat.s);
    } else if (this.veh) { this.veh.root.visible = false; this.avatar.root.scale.setScalar(this.info.appearance?.height || 1); }
    this.prevYaw = this.yaw;
    this.avatar.update(dt, { speed: s.v ? 0 : s.s, grounded: !!s.g, swimming: !!s.w, pose: s.v ? seatOf(s.v)?.pose || 'sit' : s.p, dance: s.d });
    this.pet?.update(dt, t, { pos: this.pos, yaw: this.yaw, speed: s.s, zone: this.zone }, visible && !s.v);
  }

  disposeVehicle() {
    if (!this.veh) return;
    this.game.engine.scene.remove(this.veh.root);
    this.veh.dispose();
    this.veh = null;
  }

  dispose() {
    this.avatar.dispose();
    this.game.labels.remove(this.label);
    this.pet?.dispose();
    this.disposeVehicle();
  }
}

export class Remotes {
  constructor(game) {
    this.game = game;
    this.map = new Map();
    const net = game.net;
    for (const info of net.initialPlayers || []) this.add(info);
    net.on('welcome', (m) => { for (const r of this.map.values()) r.dispose(); this.map.clear(); for (const info of m.players || []) this.add(info); });
    net.on('join', (m) => this.add(m));
    net.on('leave', (m) => { const r = this.map.get(m.id); if (r) { r.dispose(); this.map.delete(m.id); } });
    net.on('pupdate', (m) => this.map.get(m.id)?.setInfo(m));
    net.on('snap', (m) => {
      for (const a of m.l) {
        const r = this.map.get(a[0]);
        if (r) { r.push(m.at, a); r.zone = game.player.zone; }
      }
      // ceux qui ne sont plus dans l'instantané ne sont pas dans ma zone (ou trop loin)
      const seen = new Set(m.l.map((a) => a[0]));
      for (const r of this.map.values()) if (!seen.has(r.id)) r.zone = '?';
    });
    net.on('chat', (m) => { const r = this.map.get(m.from); if (r && !game.social?.isMuted(m.from)) game.labels.bubble(r.avatar.root, m.text, 5000); });
    this.nearest = null;
    game.interactions.add({
      zone: 'any', r: 2.6, priority: 0,
      x: () => this.nearest?.pos.x ?? 1e9, z: () => this.nearest?.pos.z ?? 1e9,
      enabled: () => !!this.nearest,
      label: () => `👤 ${this.nearest?.name}`,
      action: () => game.social?.openPlayer(this.nearest.id),
    });
  }

  add(info) {
    if (this.map.has(info.id)) { this.map.get(info.id).setInfo(info); return; }
    this.map.set(info.id, new Remote(this.game, info));
  }

  all() { return [...this.map.values()].filter((r) => r.buf.length); }
  get(id) { return this.map.get(id); }

  update(dt, t) {
    const g = this.game;
    const now = g.now();
    const P = g.player.pos;
    let best = null, bd = 2.6;
    for (const r of this.map.values()) {
      r.update(dt, t, now, g.player.zone);
      if (r.zone !== g.player.zone) continue;
      const d = Math.hypot(r.pos.x - P.x, r.pos.z - P.z);
      if (d < bd) { bd = d; best = r; }
    }
    this.nearest = best;
  }

  mapMarkers() {
    const party = this.game.social?.party;
    const out = [];
    for (const r of this.map.values()) {
      if (r.zone !== this.game.player.zone || !r.buf.length) continue;
      const inParty = party?.members.some((m) => m.id === r.id);
      out.push({ x: r.pos.x, z: r.pos.z, color: inParty ? '#2ec4b6' : '#3d8ee8', r: inParty ? 5 : 3.5 });
    }
    return out;
  }
}
