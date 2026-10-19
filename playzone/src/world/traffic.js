import * as THREE from 'three';
import { CarVisual, dimsOf } from '../vehicles/car-models.js';
import { TRAFFIC_LOOP } from '../../shared/world-layout.js';

// Circulation sur le boulevard : deux voies (on roule à droite), freinage devant les piétons,
// les animaux et les autres voitures, klaxon si on reste planté devant.

function lanePath(half, clockwise) {
  const r = 4, pts = [];
  const corners = [[half, -half], [half, half], [-half, half], [-half, -half]];
  const startA = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
  corners.forEach(([cx, cz], i) => {
    const ox = cx - Math.sign(cx) * r, oz = cz - Math.sign(cz) * r;
    for (let k = 0; k <= 6; k++) { const a = startA[i] + (k / 6) * (Math.PI / 2); pts.push(new THREE.Vector3(ox + Math.cos(a) * r, 0, oz + Math.sin(a) * r)); }
  });
  if (!clockwise) pts.reverse();
  const cum = [0];
  for (let i = 1; i <= pts.length; i++) cum.push(cum[i - 1] + pts[i - 1].distanceTo(pts[i % pts.length]));
  return { pts, cum, len: cum[cum.length - 1] };
}

function sample(path, s, out) {
  s = ((s % path.len) + path.len) % path.len;
  let i = 0;
  while (path.cum[i + 1] < s) i++;
  const a = path.pts[i], b = path.pts[(i + 1) % path.pts.length];
  const t = (s - path.cum[i]) / (path.cum[i + 1] - path.cum[i]);
  out.pos.lerpVectors(a, b, t);
  out.yaw = Math.atan2(b.x - a.x, b.z - a.z);
  return out;
}

const FLEET = [
  ['citadine', '#e63946', 0], ['taxi', '#ffd23f', 0], ['bus', '#2a9d8f', 0], ['berline', '#457b9d', 0], ['glace', '#ffc8dd', 0],
  ['fourgon', '#f4f1ea', 1], ['suv', '#2b2d42', 1], ['break', '#a8dadc', 1], ['taxi', '#ffd23f', 1], ['pickup', '#bc6c25', 1],
];
const DRIVERS = [
  { skin: '#f1c27d', hair: '#3b2a1e', top: '#3d8ee8' }, { skin: '#8d5524', hair: '#111111', top: '#e63946' },
  { skin: '#ffdbac', hair: '#d4a017', top: '#2a9d8f' }, { skin: '#c68642', hair: '#5a3825', top: '#ffb703', hat: '#2b2d42' },
  { skin: '#e0ac69', hair: '#bbbbbb', top: '#8338ec' }, { skin: '#ffdbac', hair: '#a52a2a', top: '#f4f1ea' },
];
const DRIVER_LINES = ['Pouet pouet !', 'On se pousse, oui ?', 'C\'est une route, pas un salon !', 'Je suis en retard pour ma sieste !', 'Le piéton est roi... mais pas trop.'];
const CRASH_LINES = ['Ma carrosserie !', 'Vous avez votre permis à la tombola ?!', 'J\'appelle mon assureur... et ma maman !', 'Aïe aïe aïe, la peinture !', 'C\'était une voiture de location en plus !'];

export class Traffic {
  constructor(game) {
    this.game = game;
    this.lanes = [lanePath(TRAFFIC_LOOP.lanes[1], true), lanePath(TRAFFIC_LOOP.lanes[0], false)];
    this.cars = [];
    const tmp = { pos: new THREE.Vector3(), yaw: 0 };
    const perLane = [0, 0];
    FLEET.forEach(([type, color, lane], i) => {
      const dims = dimsOf(type);
      const L = dims.L;
      const d = DRIVERS[i % DRIVERS.length];
      const visual = new CarVisual(type, { paint: color, driver: d, driverKey: `d${i % DRIVERS.length}` });
      game.engine.scene.add(visual.root);
      const path = this.lanes[lane];
      const s0 = (perLane[lane]++ / 5) * path.len;
      const car = {
        type, visual, root: visual.root, lane, path, s: s0, L, speed: 0, max: type === 'bus' ? 6.5 : type === 'glace' ? 5 : 8 + Math.random() * 2,
        blockedFor: 0, honked: 0, pos: new THREE.Vector3(), yaw: 0, stunned: 0,
        colliders: [],
      };
      const n = Math.max(2, Math.round(L / (dims.W * 0.95)));
      for (let k = 0; k < n; k++) car.colliders.push(game.collision.addCyl(0, 0, dims.W / 2, 0, L > 6 ? 2.6 : 1.5, { dynamic: true, noCamera: true, car }));
      car.offs = car.colliders.map((_, k) => -L / 2 + dims.W / 2 + (k / (n - 1)) * (L - dims.W));
      sample(path, s0, tmp);
      car.pos.copy(tmp.pos); car.yaw = tmp.yaw;
      this.cars.push(car);
    });
    // un véhicule du joueur percute une voiture : bosse, arrêt, conducteur furieux
    game.on('vehicle.bump', ({ other, sev, hit }) => {
      if (!other || !this.cars.includes(other)) return;
      const dx = hit.x - other.pos.x, dz = hit.z - other.pos.z;
      const s = Math.sin(-other.yaw), c = Math.cos(-other.yaw);
      other.visual.dent(dx * c + dz * s, 0.7, -dx * s + dz * c, sev * 1.3);
      other.damage = Math.min(1, (other.damage || 0) + sev * 0.25);
      other.visual.u.uDamage.value = other.damage * 0.85;
      other.stunned = 2.5;
      if (performance.now() - other.honked > 2500) {
        other.honked = performance.now();
        game.sfx('honk');
        game.labels.bubble(other.root, CRASH_LINES[Math.floor(Math.random() * CRASH_LINES.length)], 2600, '', other.type === 'bus' ? 3.6 : 2.4);
      }
      game.emit('traffic.crash', { car: other, sev });
    });
    this.tmp = tmp;
  }

  // Véhicules dans lesquels le joueur peut monter (aucun pour l'instant dans la circulation).
  enterable() { return []; }

  near(pos, r) {
    for (const c of this.cars) if (c.speed > 1 && Math.hypot(c.pos.x - pos.x, c.pos.z - pos.z) < r) return true;
    return false;
  }

  // Obstacles à surveiller : joueur, PNJ, animaux au sol, joueurs distants.
  obstacles() {
    const g = this.game;
    const list = [];
    if (g.player.zone === 'world' && !g.player.vehicle) list.push({ p: g.player.pos, who: 'player' });
    if (g.player.vehicle) list.push({ p: g.player.pos, who: 'player' });
    if (g.npcs) for (const n of g.npcs.list) list.push({ p: n.pos, who: 'npc' });
    if (g.animals) for (const a of g.animals.list) if (a.alt < 0.5 && a.root.visible && Math.abs(a.pos.x) < 34 && Math.abs(a.pos.z) < 34) list.push({ p: a.pos, who: 'animal' });
    if (g.remotes) for (const r of g.remotes.all()) if (r.zone === 'world') list.push({ p: r.pos, who: 'remote' });
    return list;
  }

  update(dt) {
    const obs = this.obstacles();
    const P = this.game.player.pos;
    const camPos = this.game.engine.camera.position;
    const night = this.game.world?.dayNight?.night || 0;
    for (const c of this.cars) {
      const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
      let blocked = false, byPlayer = false;
      for (const o of obs) {
        const dx = o.p.x - c.pos.x, dz = o.p.z - c.pos.z;
        const along = dx * fx + dz * fz, lat = Math.abs(dx * fz - dz * fx);
        if (along > c.L * 0.3 && along < c.L * 0.5 + 6 && lat < 1.8) { blocked = true; if (o.who === 'player') byPlayer = true; }
      }
      for (const o of this.cars) {
        if (o === c || o.lane !== c.lane) continue;
        let ds = o.s - c.s;
        if (ds < 0) ds += c.path.len;
        if (ds < (c.L + o.L) / 2 + 3.5) blocked = true;
      }
      if (c.stunned > 0) { c.stunned -= dt; blocked = true; }
      const target = blocked ? 0 : c.max;
      const prev = c.speed;
      c.speed += Math.sign(target - c.speed) * Math.min(Math.abs(target - c.speed), (blocked ? 16 : 5) * dt);
      c.s = (c.s + c.speed * dt) % c.path.len;
      sample(c.path, c.s, this.tmp);
      c.pos.copy(this.tmp.pos);
      let dy = this.tmp.yaw - c.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      c.yaw += dy * Math.min(1, dt * 8);
      c.root.position.copy(c.pos);
      c.root.rotation.y = c.yaw;
      const v = c.visual;
      v.roll(c.speed * dt, Math.max(-0.5, Math.min(0.5, dy * 2)));
      v.u.uBrake.value = c.speed < prev - 0.01 || c.speed < 0.3 ? 1 : 0;
      v.setLights(night);
      v.u.uTime.value = this.game.engine.time;
      v.tilt.rotation.x += (Math.max(-0.04, Math.min(0.04, (c.speed - prev) / Math.max(dt, 1e-3) * -0.004)) - v.tilt.rotation.x) * Math.min(1, dt * 6);
      const dist = camPos.distanceTo(c.pos);
      v.setDetail(dist < 60 ? 0 : dist < 230 ? 1 : 2);
      // collisions : cylindres le long de la voiture
      c.colliders.forEach((col, i) => { col.x = c.pos.x + Math.sin(c.yaw) * c.offs[i]; col.z = c.pos.z + Math.cos(c.yaw) * c.offs[i]; });
      // klaxon
      if (byPlayer && c.speed < 0.5) {
        c.blockedFor += dt;
        if (c.blockedFor > 1.6 && performance.now() - c.honked > 4000) {
          c.honked = performance.now();
          if (c.pos.distanceTo(P) < 30) this.game.sfx('honk');
          this.game.labels.bubble(c.root, DRIVER_LINES[Math.floor(Math.random() * DRIVER_LINES.length)], 2200, '', c.type === 'bus' ? 3.6 : 2.4);
        }
      } else c.blockedFor = 0;
    }
  }
}

