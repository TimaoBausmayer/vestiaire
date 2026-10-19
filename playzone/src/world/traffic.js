import * as THREE from 'three';
import { CarVisual, dimsOf } from '../vehicles/car-models.js';
import { ROAD_GRAPH, STREET_BY_ID } from '../../shared/city.js';
import { TRAFFIC_MIX, CAR_PAINTS } from '../../shared/content/vehicles.js';
import { mulberry32 } from '../../shared/rng.js';

// CIRCULATION sur le réseau routier : chaque voiture suit sa voie (on roule à droite), choisit une
// direction à chaque carrefour, respecte les feux tricolores, garde ses distances, s'arrête devant les
// piétons et klaxonne si on reste planté devant. Les voitures restent concentrées autour du joueur :
// celles qui s'éloignent trop réapparaissent ailleurs, hors de vue.

const G = ROAD_GRAPH;
const CYCLE = 26;
const nodeHalf = (n) => Math.max(...[...n.streets].map((id) => STREET_BY_ID[id].w)) / 2;

// État d'un feu : axe 'v' vert de 0 à 10 s, orange jusqu'à 12,5 ; axe 'h' vert de 13 à 23, orange jusqu'à 25,5.
export function lightState(node, t, axis) {
  const ph = (((t + node.id * 7.3) % CYCLE) + CYCLE) % CYCLE;
  const [g0, y0, y1] = axis === 'v' ? [0, 10, 12.5] : [13, 23, 25.5];
  if (ph >= g0 && ph < y0) return 'G';
  if (ph >= y0 && ph < y1) return 'Y';
  return 'R';
}

const DRIVERS = [
  { skin: '#f1c27d', hair: '#3b2a1e', top: '#3d8ee8' }, { skin: '#8d5524', hair: '#111111', top: '#e63946' },
  { skin: '#ffdbac', hair: '#d4a017', top: '#2a9d8f' }, { skin: '#c68642', hair: '#5a3825', top: '#ffb703', hat: '#2b2d42' },
  { skin: '#e0ac69', hair: '#bbbbbb', top: '#8338ec' }, { skin: '#ffdbac', hair: '#a52a2a', top: '#f4f1ea' },
];
const DRIVER_LINES = ['Pouet pouet !', 'On se pousse, oui ?', 'C\'est une route, pas un salon !', 'Je suis en retard pour ma sieste !', 'Le piéton est roi... mais pas trop.', 'Vous comptez camper là ?'];
const CRASH_LINES = ['Ma carrosserie !', 'Vous avez votre permis à la tombola ?!', 'J\'appelle mon assureur... et ma maman !', 'Aïe aïe aïe, la peinture !', 'C\'était une voiture de location en plus !'];

const SPEED = { main: 12.5, street: 9.5, country: 11.5 };
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();

// Voie d'un tronçon dans un sens : du nœud `from` vers `to`, décalée à droite.
function laneOf(edge, from) {
  const a = G.nodes[from], b = G.nodes[from === edge.a ? edge.b : edge.a];
  const dx = Math.sign(b.x - a.x), dz = Math.sign(b.z - a.z);
  const off = edge.w >= 8 ? edge.w / 4 + 0.15 : edge.w / 4;
  const rx = -dz, rz = dx; // droite du conducteur : cap = atan2(dx, dz), droite = (-cos cap, sin cap) = (-dz, dx)
  const ha = a.degree > 1 ? nodeHalf(a) + (a.light ? 4.6 : 1.2) : 0.5;
  const hb = b.degree > 1 ? nodeHalf(b) + (b.light ? 4.6 : 1.2) : 0.5;
  const start = { x: a.x + dx * ha + rx * off, z: a.z + dz * ha + rz * off };
  const end = { x: b.x - dx * hb + rx * off, z: b.z - dz * hb + rz * off };
  return { edge, from, to: b.id, dx, dz, start, end, len: Math.max(0.5, Math.hypot(end.x - start.x, end.z - start.z)), speed: SPEED[edge.kind] * (edge.street.startsWith('place') ? 0.7 : 1), light: b.light, axis: STREET_BY_ID[edge.street].axis };
}

// Segment de virage (courbe de Bézier) entre la fin d'une voie et le début de la suivante.
function turnOf(l1, l2, node) {
  const p0 = l1.end, p2 = l2.start;
  let c;
  if (l1.dx === l2.dx && l1.dz === l2.dz) c = { x: (p0.x + p2.x) / 2, z: (p0.z + p2.z) / 2 };
  else if (l1.dx === -l2.dx && l1.dz === -l2.dz) c = { x: node.x + l1.dx * 6, z: node.z + l1.dz * 6 }; // demi-tour
  else c = { x: l1.dx ? p2.x : p0.x, z: l1.dz ? p2.z : p0.z };
  // longueur approchée
  let len = 0, px = p0.x, pz = p0.z;
  for (let i = 1; i <= 8; i++) { const t = i / 8, q = bez(p0, c, p2, t); len += Math.hypot(q.x - px, q.z - pz); px = q.x; pz = q.z; }
  const straight = l1.dx === l2.dx && l1.dz === l2.dz;
  return { turn: true, p0, c, p2, len: Math.max(0.5, len), node: node.id, straight, speed: straight ? l1.speed : Math.min(l1.speed, 6.5) };
}
function bez(p0, c, p2, t) { const u = 1 - t; return { x: u * u * p0.x + 2 * u * t * c.x + t * t * p2.x, z: u * u * p0.z + 2 * u * t * c.z + t * t * p2.z }; }

export class Traffic {
  constructor(game, { count = 26 } = {}) {
    this.game = game;
    this.cars = [];
    this.rand = mulberry32(777);
    this.lanes = new Map(); // `${edge}|${from}` -> voie
    for (const e of G.edges) for (const f of [e.a, e.b]) this.lanes.set(`${e.id}|${f}`, laneOf(e, f));
    this.mixTotal = TRAFFIC_MIX.reduce((s, m) => s + m[1], 0);
    this.lights = game.world.trafficLights;
    this.lightT = 0;
    this.reserve = new Map(); // nœud -> voiture qui le traverse
    for (let i = 0; i < count; i++) this.spawn(i, true);
    game.on('vehicle.bump', ({ other, sev, hit }) => this.onBump(other, sev, hit));
  }

  pickModel() {
    let r = this.rand() * this.mixTotal;
    for (const [m, w] of TRAFFIC_MIX) { r -= w; if (r <= 0) return m; }
    return 'citadine';
  }

  // Place (ou replace) une voiture sur une voie au hasard, à bonne distance du joueur.
  spawn(i, initial = false) {
    const P = this.game.player?.pos || { x: 0, z: 0 };
    let lane = null;
    for (let k = 0; k < 40 && !lane; k++) {
      const l = [...this.lanes.values()][Math.floor(this.rand() * this.lanes.size)];
      const mx = (l.start.x + l.end.x) / 2, mz = (l.start.z + l.end.z) / 2;
      const d = Math.hypot(mx - P.x, mz - P.z);
      if (l.len < 8) continue;
      if (initial ? d < 230 : d > 70 && d < 210) lane = l;
    }
    if (!lane) return;
    let car = this.cars[i];
    const model = this.pickModel();
    if (car && car.model !== model) { this.game.engine.scene.remove(car.root); car.visual.dispose(); for (const c of car.colliders) this.game.collision.remove(c); car = null; }
    if (!car) {
      const dims = dimsOf(model);
      const di = i % DRIVERS.length;
      const visual = new CarVisual(model, { paint: CAR_PAINTS[Math.floor(this.rand() * CAR_PAINTS.length)], driver: DRIVERS[di], driverKey: `d${di}` });
      this.game.engine.scene.add(visual.root);
      car = { model, visual, root: visual.root, L: dims.L, W: dims.W, pos: new THREE.Vector3(), yaw: 0, speed: 0, colliders: [], honked: 0, blockedFor: 0, damage: 0, stunned: 0 };
      const n = Math.max(1, Math.round(dims.L / (dims.W * 0.95)));
      for (let k = 0; k < n; k++) car.colliders.push(this.game.collision.addCyl(0, 0, dims.W / 2, 0, dims.L > 6 ? 2.6 : 1.5, { dynamic: true, noCamera: true, car }));
      car.offs = car.colliders.map((_, k) => (n === 1 ? 0 : -dims.L / 2 + dims.W / 2 + (k / (n - 1)) * (dims.L - dims.W)));
      this.cars[i] = car;
    }
    car.seg = lane; car.s = this.rand() * lane.len * 0.8; car.next = null; car.speed = lane.speed * 0.6;
    car.max = (0.85 + this.rand() * 0.25) * (car.model === 'bus' || car.model === 'camion' || car.model === 'pompiers' ? 0.75 : 1);
    car.visual.clearDents(); car.damage = 0; car.visual.u.uDamage.value = 0;
    this.place(car);
  }

  // Choisit la voie suivante à l'arrivée sur un nœud (tout droit le plus souvent, pas de demi-tour sauf impasse).
  chooseNext(lane) {
    const node = G.nodes[lane.to];
    const opts = [];
    for (const eid of node.edges) {
      if (eid === lane.edge.id && node.edges.length > 1) continue;
      const l = this.lanes.get(`${eid}|${node.id}`);
      const straight = l.dx === lane.dx && l.dz === lane.dz;
      opts.push([l, straight ? 3 : 1]);
    }
    let tot = opts.reduce((s, o) => s + o[1], 0), r = this.rand() * tot;
    for (const [l, w] of opts) { r -= w; if (r <= 0) return l; }
    return opts[0][0];
  }

  place(car) {
    const seg = car.seg;
    let x, z, yaw;
    if (seg.turn) {
      const t = Math.min(1, car.s / seg.len);
      const q = bez(seg.p0, seg.c, seg.p2, t), q2 = bez(seg.p0, seg.c, seg.p2, Math.min(1, t + 0.02));
      x = q.x; z = q.z; yaw = Math.atan2(q2.x - q.x, q2.z - q.z) || car.yaw;
    } else {
      const t = car.s / seg.len;
      x = seg.start.x + (seg.end.x - seg.start.x) * t; z = seg.start.z + (seg.end.z - seg.start.z) * t;
      yaw = Math.atan2(seg.dx, seg.dz);
    }
    car.pos.set(x, 0, z);
    let dy = yaw - car.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    car.steer = Math.max(-0.5, Math.min(0.5, dy * 3));
    car.yaw = Math.abs(dy) > 1.5 ? yaw : car.yaw + dy * 0.5;
  }

  // Obstacles à surveiller : joueur, PNJ, animaux, joueurs distants, véhicules du joueur.
  obstacles() {
    const g = this.game;
    const list = [];
    if (g.player.zone === 'world') list.push({ p: g.player.pos, who: 'player' });
    if (g.npcs) for (const n of g.npcs.list) list.push({ p: n.pos, who: 'npc' });
    if (g.animals) for (const a of g.animals.list) if (a.alt < 0.5 && a.root.visible) list.push({ p: a.pos, who: 'animal' });
    if (g.remotes) for (const r of g.remotes.all()) if (r.zone === 'world') list.push({ p: r.pos, who: 'remote' });
    if (g.vehicles) for (const v of g.vehicles.list) list.push({ p: v.pos, who: v.driven ? 'player' : 'car', r: v.dims.L / 2 });
    return list;
  }

  enterable() { return []; }

  near(pos, r) {
    for (const c of this.cars) if (c.speed > 1 && Math.hypot(c.pos.x - pos.x, c.pos.z - pos.z) < r) return true;
    return false;
  }

  onBump(other, sev, hit) {
    if (!other || !this.cars.includes(other)) return;
    const g = this.game;
    const dx = hit.x - other.pos.x, dz = hit.z - other.pos.z;
    const s = Math.sin(-other.yaw), c = Math.cos(-other.yaw);
    other.visual.dent(dx * c + dz * s, 0.7, -dx * s + dz * c, sev * 1.3);
    other.damage = Math.min(1, other.damage + sev * 0.25);
    other.visual.u.uDamage.value = other.damage * 0.85;
    other.stunned = 2.5;
    if (performance.now() - other.honked > 2500) {
      other.honked = performance.now();
      g.sfx('honk');
      g.labels.bubble(other.root, CRASH_LINES[Math.floor(Math.random() * CRASH_LINES.length)], 2600, '', other.model === 'bus' ? 3.6 : 2.4);
    }
    g.emit('traffic.crash', { car: other, sev });
  }

  update(dt) {
    const g = this.game;
    const t = g.now() / 1000;
    const P = g.player.pos;
    const camPos = g.engine.camera.position;
    const night = g.world?.dayNight?.night || 0;
    const obs = this.obstacles();
    // feux : couleur des ampoules proches (5 fois par seconde)
    this.lightT -= dt;
    if (this.lightT <= 0 && this.lights) {
      this.lightT = 0.2;
      const { heads, bulbs } = this.lights;
      const col = new THREE.Color();
      heads.forEach((hd, i) => {
        if (Math.abs(hd.x - camPos.x) > 160 || Math.abs(hd.z - camPos.z) > 160) return;
        const st = lightState(G.nodes[hd.node], t, hd.axis);
        bulbs.setColorAt(i * 3, col.set(st === 'R' ? '#ff2a2a' : '#3a1414'));
        bulbs.setColorAt(i * 3 + 1, col.set(st === 'Y' ? '#ffb000' : '#3a2a10'));
        bulbs.setColorAt(i * 3 + 2, col.set(st === 'G' ? '#2aff6a' : '#103a1c'));
      });
      bulbs.instanceColor.needsUpdate = true;
    }
    for (let i = 0; i < this.cars.length; i++) {
      const c = this.cars[i];
      if (!c) continue;
      // trop loin du joueur : on la replace ailleurs
      if (Math.abs(c.pos.x - P.x) > 270 || Math.abs(c.pos.z - P.z) > 270) { this.spawn(i); continue; }
      const seg = c.seg;
      const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
      let target = seg.speed * c.max;
      let stopAt = Infinity; // distance à laquelle il faut être arrêté
      // feu ou carrefour occupé au bout de la voie
      if (!seg.turn) {
        const remain = seg.len - c.s;
        if (seg.light) {
          const st = lightState(G.nodes[seg.to], t, seg.axis);
          if (st === 'R' || (st === 'Y' && remain > 6)) stopAt = Math.min(stopAt, remain);
        }
        const res = this.reserve.get(seg.to);
        if (res && res !== c && res.seg.turn && !res.seg.straight && remain < 6) stopAt = Math.min(stopAt, remain);
      }
      // voitures devant (même direction) et obstacles
      let byPlayer = false;
      for (const o of this.cars) {
        if (!o || o === c) continue;
        const dx = o.pos.x - c.pos.x, dz = o.pos.z - c.pos.z;
        if (Math.abs(dx) > 30 || Math.abs(dz) > 30) continue;
        const along = dx * fx + dz * fz, lat = Math.abs(dx * fz - dz * fx);
        if (along > 0 && along < 26 && lat < 1.9) stopAt = Math.min(stopAt, along - (c.L + o.L) / 2 - 2.2);
      }
      for (const o of obs) {
        const dx = o.p.x - c.pos.x, dz = o.p.z - c.pos.z;
        if (Math.abs(dx) > 25 || Math.abs(dz) > 25) continue;
        const along = dx * fx + dz * fz, lat = Math.abs(dx * fz - dz * fx);
        if (along > 0 && along < c.L / 2 + 9 && lat < 1.7 + (o.r ? 0.9 : 0)) { stopAt = Math.min(stopAt, along - c.L / 2 - (o.r || 0) - 1.5); if (o.who === 'player') byPlayer = true; }
      }
      if (c.stunned > 0) { c.stunned -= dt; stopAt = 0; }
      if (stopAt < Infinity) target = Math.min(target, Math.max(0, Math.sqrt(Math.max(0, stopAt) * 2 * 5.5)));
      const prev = c.speed;
      c.speed += Math.sign(target - c.speed) * Math.min(Math.abs(target - c.speed), (target < c.speed ? 9 : 3.2) * dt);
      if (stopAt <= 0.2) c.speed = Math.min(c.speed, Math.max(0, prev - 14 * dt));
      // avance le long des segments
      c.s += c.speed * dt;
      while (c.s >= c.seg.len) {
        c.s -= c.seg.len;
        if (c.seg.turn) {
          if (this.reserve.get(c.seg.node) === c) this.reserve.delete(c.seg.node);
          c.seg = c.next; c.next = null;
        } else {
          const nextLane = this.chooseNext(c.seg);
          c.next = nextLane;
          c.seg = turnOf(c.seg, nextLane, G.nodes[c.seg.to]);
          if (!this.reserve.has(c.seg.node)) this.reserve.set(c.seg.node, c);
        }
      }
      this.place(c);
      const v = c.visual;
      c.root.position.copy(c.pos);
      c.root.rotation.y = c.yaw;
      v.roll(c.speed * dt, c.steer || 0);
      v.u.uBrake.value = c.speed < prev - 0.01 || c.speed < 0.3 ? 1 : 0;
      v.u.uBlink.value = c.seg.turn && !c.seg.straight ? 1 : 0;
      v.u.uTime.value = g.engine.time;
      v.setLights(night);
      v.tilt.rotation.x += (Math.max(-0.04, Math.min(0.04, (c.speed - prev) / Math.max(dt, 1e-3) * -0.004)) - v.tilt.rotation.x) * Math.min(1, dt * 6);
      const dist = camPos.distanceTo(c.pos);
      v.setDetail(dist < 60 ? 0 : dist < 230 ? 1 : 2);
      c.colliders.forEach((col, k) => { col.x = c.pos.x + fx * c.offs[k]; col.z = c.pos.z + fz * c.offs[k]; });
      // klaxon si le joueur bloque
      if (byPlayer && c.speed < 0.5) {
        c.blockedFor += dt;
        if (c.blockedFor > 1.6 && performance.now() - c.honked > 4000) {
          c.honked = performance.now();
          if (c.pos.distanceTo(P) < 30) g.sfx(c.L > 5.5 ? 'horn-truck' : 'honk');
          g.labels.bubble(c.root, DRIVER_LINES[Math.floor(Math.random() * DRIVER_LINES.length)], 2200, '', c.L > 6 ? 3.6 : 2.4);
        }
      } else c.blockedFor = 0;
    }
  }
}
