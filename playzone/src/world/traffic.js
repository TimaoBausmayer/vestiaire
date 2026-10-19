import * as THREE from 'three';
import { buildMergedGeometry, SHAPES as B } from '../core/static-builder.js';
import { actorMaterial, MATS } from '../core/materials.js';
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

const MODELS = {
  citadine: (c) => (sb) => {
    sb.box(0, 0.35, 0, 1.8, 0.75, 3.8, c); sb.box(0, 1.1, -0.2, 1.6, 0.7, 2.0, c);
    sb.box(0, 1.15, -0.2, 1.62, 0.5, 1.7, '#cfe8ff'); sb.box(0, 1.15, -0.2, 1.4, 0.5, 2.02, '#cfe8ff');
    sb.box(0, 0.65, 1.91, 1.4, 0.2, 0.02, '#fff3b0'); sb.box(0, 0.65, -1.91, 1.4, 0.15, 0.02, '#e63946');
  },
  taxi: (c) => (sb) => { MODELS.citadine('#ffd23f')(sb); sb.box(0, 1.8, -0.2, 0.7, 0.25, 0.35, '#2b2d42'); },
  camionnette: (c) => (sb) => {
    sb.box(0, 0.35, -0.6, 2.0, 2.0, 3.6, '#f4f1ea'); sb.box(0, 0.35, 1.6, 2.0, 1.4, 1.2, c);
    sb.box(0, 1.2, 2.21, 1.7, 0.5, 0.02, '#cfe8ff'); sb.box(0, 1.3, -0.6, 2.02, 0.5, 2.5, c);
  },
  bus: (c) => (sb) => {
    sb.box(0, 0.4, 0, 2.3, 2.4, 7.5, c); sb.box(0, 1.5, 0, 2.32, 0.8, 7.0, '#cfe8ff'); sb.box(0, 2.8, 0, 2.1, 0.15, 7.0, '#f4f1ea');
    sb.box(0, 1.0, 3.76, 1.8, 1.4, 0.02, '#cfe8ff');
  },
  glace: () => (sb) => {
    sb.box(0, 0.35, 0, 2.0, 2.1, 4.4, '#ffc8dd'); sb.box(0, 1.4, 1.2, 2.02, 0.6, 1.4, '#cfe8ff');
    sb.cone(0, 2.45, -0.5, 0.45, 1.1, '#e9a23b', 8); sb.add(B.cone(8), { y: 3.55, z: -0.5, sx: 0.9, sy: 0.9, sz: 0.9, rx: Math.PI, color: '#e9a23b' });
    sb.sphere(0, 3.65, -0.5, 0.5, '#fff3f8', 10);
  },
};
const WHEEL = buildMergedGeometry((sb) => { sb.add(B.cyl(12), { sx: 0.7, sy: 0.3, sz: 0.7, rz: Math.PI / 2, color: '#1b1b24' }); sb.add(B.cyl(8), { sx: 0.35, sy: 0.32, sz: 0.35, rz: Math.PI / 2, color: '#c7ccd4' }); });
const FLEET = [
  ['citadine', '#ff5a5f', 0], ['taxi', '', 0], ['bus', '#2ec4b6', 0], ['citadine', '#3d8ee8', 0], ['glace', '', 0],
  ['camionnette', '#7ac74f', 1], ['citadine', '#c77dff', 1], ['citadine', '#f4f1ea', 1], ['taxi', '', 1], ['camionnette', '#ff9f1c', 1],
];
const LENGTH = { citadine: 3.8, taxi: 3.8, camionnette: 4.8, bus: 7.5, glace: 4.4 };
const DRIVER_LINES = ['Pouet pouet !', 'On se pousse, oui ?', 'C\'est une route, pas un salon !', 'Je suis en retard pour ma sieste !', 'Le piéton est roi... mais pas trop.'];

export class Traffic {
  constructor(game) {
    this.game = game;
    this.lanes = [lanePath(TRAFFIC_LOOP.lanes[1], true), lanePath(TRAFFIC_LOOP.lanes[0], false)];
    this.cars = [];
    const tmp = { pos: new THREE.Vector3(), yaw: 0 };
    const perLane = [0, 0];
    FLEET.forEach(([type, color, lane]) => {
      const geo = buildMergedGeometry(MODELS[type](color));
      const root = new THREE.Group();
      const body = new THREE.Mesh(geo, actorMaterial);
      body.castShadow = true;
      root.add(body);
      const L = LENGTH[type];
      for (const [x, z] of [[-0.95, L * 0.32], [0.95, L * 0.32], [-0.95, -L * 0.32], [0.95, -L * 0.32]]) {
        const w = new THREE.Mesh(WHEEL, actorMaterial);
        w.position.set(x, 0.35, z);
        root.add(w);
      }
      game.engine.scene.add(root);
      const path = this.lanes[lane];
      const s = (perLane[lane]++ / 5) * path.len;
      const car = {
        type, root, lane, path, s, L, speed: 0, max: type === 'bus' ? 6.5 : type === 'glace' ? 5 : 8 + Math.random() * 2,
        blockedFor: 0, honked: 0, pos: new THREE.Vector3(), yaw: 0,
        colliders: [game.collision.addCyl(0, 0, 1.15, 0, 1.6, { dynamic: true, noCamera: true }), game.collision.addCyl(0, 0, 1.15, 0, 1.6, { dynamic: true, noCamera: true })],
      };
      if (type === 'bus') car.colliders.push(game.collision.addCyl(0, 0, 1.2, 0, 2.6, { dynamic: true, noCamera: true }));
      sample(path, s, tmp);
      car.pos.copy(tmp.pos); car.yaw = tmp.yaw;
      this.cars.push(car);
    });
    this.tmp = tmp;
  }

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
      const target = blocked ? 0 : c.max;
      c.speed += Math.sign(target - c.speed) * Math.min(Math.abs(target - c.speed), (blocked ? 16 : 5) * dt);
      c.s = (c.s + c.speed * dt) % c.path.len;
      sample(c.path, c.s, this.tmp);
      c.pos.copy(this.tmp.pos);
      let dy = this.tmp.yaw - c.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      c.yaw += dy * Math.min(1, dt * 8);
      c.root.position.copy(c.pos);
      c.root.rotation.y = c.yaw;
      // collisions : cylindres le long de la voiture
      const offs = c.colliders.length === 3 ? [-c.L * 0.33, 0, c.L * 0.33] : [-c.L * 0.25, c.L * 0.25];
      c.colliders.forEach((col, i) => { col.x = c.pos.x + Math.sin(c.yaw) * offs[i]; col.z = c.pos.z + Math.cos(c.yaw) * offs[i]; });
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

export { MATS };
