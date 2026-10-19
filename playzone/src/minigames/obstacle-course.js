import * as THREE from 'three';
import { Minigame } from './minigame.js';
import { buildMergedGeometry, SHAPES as B } from '../core/static-builder.js';
import { actorMaterial } from '../core/materials.js';
import { MINIGAME_SPOTS } from '../../shared/world-layout.js';
import { makeSign } from '../world/signs.js';

// PARCOURS DU COMBATTANT MOU : 6 anneaux à traverser dans l'ordre, au milieu d'obstacles.
// Le chrono officiel est calculé par l'autorité à partir des positions du joueur.
const SPOT = MINIGAME_SPOTS.obstacle;
const CPS = SPOT.checkpoints;
const MUD = [[27, -121, 46, -100], [45.5, -111, 50.5, -102]];
const STATIC_PLATFORMS = [
  // [x, z, w, d, top]
  [28.5, -100.5, 2.6, 2.6, 1.0], [30.5, -104.5, 2.6, 2.6, 2.0], [32.5, -108.5, 2.6, 2.6, 3.0], [34, -112, 4.2, 4.2, 3.2],
  [48, -111.8, 1.4, 1.0, 0.45],
];
const BEAM = [47.7, -111, 48.3, -102, 0.9];
const PADS = [[48, -94.5], [48, -88.5]];
const WALLS = [[48, -92, 6, 2.4], [48, -86, 6, 2.4]];
const HURDLES = [-73.5, -75.5, -77.5];
const SPINNERS = [{ x: 26, z: -85.5, speed: 1.7 }, { x: 26, z: -91, speed: -2.1 }];
const MOVERS = [{ z: -114, xa: 38, xb: 41.5, top: 2.6, speed: 0.55 }, { z: -116.5, xa: 42, xb: 44.8, top: 2.0, speed: 0.7 }];

export class ObstacleCourse extends Minigame {
  constructor(game, def) {
    super(game, def, SPOT);
    this.maxDist = 0;
    const scene = game.engine.scene;
    // bras tournants
    const armGeo = buildMergedGeometry((sb) => {
      sb.cyl(0, 0, 0, 0.35, 1.2, '#30343f', 10);
      sb.add(B.cyl(8), { x: 0, y: 0.75, z: 0, sx: 0.32, sy: 7, sz: 0.32, rz: Math.PI / 2, color: '#ff5a5f' });
      for (const x of [-3.5, 3.5]) sb.sphere(x, 0.75, 0, 0.35, '#ffd23f', 8);
    });
    this.spinners = SPINNERS.map((s) => {
      const m = new THREE.Mesh(armGeo, actorMaterial);
      m.position.set(s.x, 0, s.z);
      m.castShadow = true;
      scene.add(m);
      game.collision.addCyl(s.x, s.z, 0.4, 0, 1.2);
      return { ...s, m, a: 0 };
    });
    // plateformes mobiles
    const movGeo = buildMergedGeometry((sb) => { sb.box(0, -0.35, 0, 2.6, 0.35, 2.6, '#2ec4b6'); sb.box(0, -0.38, 0, 2.7, 0.06, 2.7, '#ffffff'); });
    this.movers = MOVERS.map((mv) => {
      const m = new THREE.Mesh(movGeo, actorMaterial);
      m.castShadow = true;
      scene.add(m);
      const col = game.collision.addBox(0, mv.top - 0.4, 0, 0, mv.top, 0, { dynamic: true });
      return { ...mv, m, col, x: mv.xa, dx: 0 };
    });
    // anneaux
    const ringGeo = new THREE.TorusGeometry(2.2, 0.22, 8, 28);
    this.rings = CPS.map((c, i) => {
      const next = CPS[i + 1] || { x: c.x, z: c.z - 1 };
      const prev = CPS[i - 1] || { x: SPOT.x, z: SPOT.z };
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffffff' }));
      m.position.set(c.x, c.y + 2.1, c.z);
      m.rotation.y = Math.atan2(next.x - prev.x, next.z - prev.z);
      scene.add(m);
      return m;
    });
    this.next = 0;
    this.lastSafe = { x: SPOT.x, y: 0, z: SPOT.z };
  }

  static buildStatic(sb, col, scene) {
    // boue
    for (const [x1, z1, x2, z2] of MUD) sb.quad((x1 + x2) / 2, 0.035, (z1 + z2) / 2, x2 - x1, z2 - z1, '#6b4a2b', 0, 'ground');
    for (let i = 0; i < 26; i++) sb.blob(28 + ((i * 7.3) % 17), 0, -120 + ((i * 5.1) % 19), 0.35, '#5a3d22', 0.3);
    // plateformes, poutre
    for (const [x, z, w, d, top] of STATIC_PLATFORMS) {
      sb.box(x, 0, z, w, top, d, '#c77dff');
      sb.box(x, top - 0.05, z, w + 0.1, 0.1, d + 0.1, '#ffffff');
      col.addBoxC(x, z, w, d, 0, top);
    }
    const [bx1, bz1, bx2, bz2, bt] = BEAM;
    sb.box((bx1 + bx2) / 2, 0, (bz1 + bz2) / 2, bx2 - bx1, bt, bz2 - bz1, '#ffd23f');
    col.addBox(bx1, 0, bz1, bx2, bt, bz2);
    // haies
    for (const z of HURDLES) {
      sb.box(SPOT.x, 0, z, 4, 0.9, 0.25, '#ffffff');
      for (const s of [-1.9, 1.9]) sb.box(SPOT.x + s, 0, z, 0.2, 0.95, 0.4, '#ff5a5f');
      col.addBoxC(SPOT.x, z, 4, 0.25, 0, 0.9);
    }
    // murs + trampolines
    for (const [x, z, w, hgt] of WALLS) { sb.box(x, 0, z, w, hgt, 0.5, '#ff9f1c'); col.addBoxC(x, z, w, 0.5, 0, hgt); }
    for (const [x, z] of PADS) { sb.cyl(x, 0, z, 1.1, 0.3, '#2b2d42', 14); sb.cyl(x, 0.28, z, 0.95, 0.05, '#2ec4b6', 14, 'glow'); }
    // couloir : barrières latérales
    const rail = (x1, z1, x2, z2) => { sb.box((x1 + x2) / 2, 0, (z1 + z2) / 2, Math.abs(x2 - x1) + 0.2, 0.8, Math.abs(z2 - z1) + 0.2, '#f4f1ea'); col.addBox(Math.min(x1, x2) - 0.1, 0, Math.min(z1, z2) - 0.1, Math.max(x1, x2) + 0.1, 0.8, Math.max(z1, z2) + 0.1, { noCamera: true }); };
    rail(23, -72, 23, -97); rail(29.2, -72, 29.2, -83); rail(29.2, -94, 29.2, -97);
    rail(51, -78, 51, -122); rail(45, -78, 45, -98);
    // portique de départ / arrivée
    for (const [x, z, txt] of [[SPOT.x, -71.5, 'DÉPART'], [48, -78.5, 'ARRIVÉE']]) {
      for (const s of [-2.6, 2.6]) { sb.box(x + s, 0, z, 0.4, 4, 0.4, '#5b3fa6'); col.addBoxC(x + s, z, 0.4, 0.4, 0, 4); }
      sb.box(x, 4, z, 5.6, 0.8, 0.5, '#5b3fa6');
      const sg = makeSign(txt, 4.2, 0.65, { bg: '#5b3fa6', fg: '#ffd23f', border: null });
      sg.position.set(x, 4.4, z + 0.27);
      scene.add(sg);
    }
    const sign = makeSign('PARCOURS DU COMBATTANT MOU', 7, 1, { bg: '#2ec4b6', fg: '#14102b', border: '#ffffff' });
    sign.position.set(SPOT.x - 4.2, 2.3, SPOT.z + 0.5);
    sign.rotation.y = 0.5;
    scene.add(sign);
    sb.box(SPOT.x - 4.2, 0, SPOT.z + 0.45, 0.2, 1.8, 0.15, '#6e4a26');
  }

  // Les obstacles bougent en permanence (même hors partie).
  ambient(dt, t) {
    const g = this.game, P = g.player.pos, v = g.player.vel;
    for (const s of this.spinners) {
      s.a += s.speed * dt;
      s.m.rotation.y = s.a;
      // collision avec le bras : on se fait éjecter
      if (P.y < 1.1 && g.player.zone === 'world') {
        const ax = Math.cos(s.a), az = -Math.sin(s.a);
        const dx = P.x - s.x, dz = P.z - s.z;
        const along = dx * ax + dz * az;
        const lat = Math.abs(dx * az - dz * ax);
        if (Math.abs(along) < 3.8 && lat < 0.6 && Math.hypot(dx, dz) > 0.6) {
          // le bras balaie le joueur dans son sens de rotation
          const dir = Math.sign(s.speed * along) || 1;
          v.x = az * dir * 10; v.z = -ax * dir * 10; v.y = 6;
          g.player.grounded = false;
          if (!this._bonk || t - this._bonk > 0.6) { this._bonk = t; g.sfx('bounce'); g.cam.shake = 0.6; }
        }
      }
    }
    for (const mv of this.movers) {
      const k = (Math.sin(t * mv.speed * 2) + 1) / 2;
      const nx = mv.xa + (mv.xb - mv.xa) * k;
      mv.dx = nx - mv.x;
      mv.x = nx;
      mv.m.position.set(nx, mv.top, mv.z);
      Object.assign(mv.col, { minX: nx - 1.3, maxX: nx + 1.3, minZ: mv.z - 1.3, maxZ: mv.z + 1.3 });
      // le joueur debout sur la plateforme est transporté
      if (g.player.grounded && Math.abs(P.y - mv.top) < 0.1 && Math.abs(P.x - nx) < 1.5 && Math.abs(P.z - mv.z) < 1.5) P.x += mv.dx;
    }
    // trampolines du parcours
    for (const [x, z] of PADS) if (g.player.grounded && Math.hypot(P.x - x, P.z - z) < 1.05 && P.y < 0.6) { v.y = 13.5; g.player.grounded = false; g.sfx('bounce'); }
    for (const [i, r] of this.rings.entries()) {
      const active = this.state !== 'idle';
      r.material.color.set(!active ? '#ffffff' : i < this.next ? '#5fd068' : i === this.next ? '#ffd23f' : '#ffffff');
      r.scale.setScalar(active && i === this.next ? 1 + Math.sin(t * 6) * 0.06 : 1);
    }
  }

  onStart() {
    const g = this.game;
    this.next = 0;
    this.lastSafe = { x: SPOT.x, y: 0, z: SPOT.z - 0.5 };
    g.player.teleport(SPOT.x, SPOT.z - 0.5, Math.PI);
    g.cam.yaw = 0;
    g.cutscene = true; // immobile pendant le compte à rebours
  }

  onGo() { this.game.cutscene = false; }

  onUpdate(dt) {
    if (this.state !== 'playing') return;
    const g = this.game, P = g.player.pos;
    const c = CPS[this.next];
    if (c && Math.hypot(P.x - c.x, P.z - c.z) <= 3.8 && Math.abs(P.y - c.y) <= 3.4) {
      this.next++;
      this.lastSafe = { x: c.x, y: c.y, z: c.z };
      this.setScore(`${this.next}/${CPS.length}`);
      g.sfx(this.next >= CPS.length ? 'success' : 'pop');
      if (this.next >= CPS.length) { setTimeout(() => this.finish(), 250); return; }
    }
    // chute dans la boue : retour au dernier anneau
    const inMud = MUD.some(([x1, z1, x2, z2]) => P.x > x1 && P.x < x2 && P.z > z1 && P.z < z2);
    if (inMud && P.y < 0.25 && g.player.grounded) {
      g.fx.emit({ x: P.x, y: 0.2, z: P.z, n: 20, colors: ['#6b4a2b', '#5a3d22'], speed: 4, gravity: 10, life: 0.8, size: 0.3 });
      g.sfx('splat');
      g.ui.toast('Splatch ! Retour au dernier anneau.', 'bad', 1500);
      g.player.teleport(this.lastSafe.x, this.lastSafe.z, g.player.yaw, this.lastSafe.y + 0.05);
      g.net.notifyTeleport?.('checkpoint');
    }
  }

  setScore(s) { this.score = s; this.scoreBox.querySelector('b').textContent = String(s); }

  onEnd() { this.game.cutscene = false; this.next = 0; }

  mapMarkers() {
    if (this.state === 'idle') return [];
    const c = CPS[this.next];
    return c ? [{ x: c.x, z: c.z, color: '#ffd23f', icon: '⭕' }] : [];
  }
}

