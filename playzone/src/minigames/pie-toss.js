import * as THREE from 'three';
import { Minigame } from './minigame.js';
import { buildMergedGeometry, SHAPES as B } from '../core/static-builder.js';
import { actorMaterial, PALETTE } from '../core/materials.js';
import { pieTargets, pieTargetPos, PIE_POINTS } from '../../shared/minigame-logic.js';
import { MINIGAME_SPOTS } from '../../shared/world-layout.js';
import { makeSign } from '../world/signs.js';
import { h } from '../ui/dom.js';

// BATAILLE DE TARTES : clique (ou touche l'écran) pour lancer une tarte sur les cibles.
const SPOT = MINIGAME_SPOTS.pieToss;

const GEO = {
  normal: buildMergedGeometry((sb) => {
    sb.box(0, 0, -0.05, 0.12, 1.3, 0.08, '#7a5230');
    const rings = ['#e63946', '#ffffff', '#e63946', '#ffffff', '#e63946'];
    rings.forEach((c, i) => sb.add(B.cyl(20), { y: 1.9, z: i * 0.012, sx: 1.4 - i * 0.28, sy: 0.05, sz: 1.4 - i * 0.28, rx: Math.PI / 2, color: c }));
  }),
  gold: buildMergedGeometry((sb) => {
    sb.box(0, 0, -0.05, 0.12, 1.3, 0.08, '#7a5230');
    sb.add(B.cyl(5), { y: 1.9, sx: 1.4, sy: 0.08, sz: 1.4, rx: Math.PI / 2, color: '#ffd23f' });
    sb.add(B.cyl(5), { y: 1.9, z: 0.03, sx: 1.4, sy: 0.08, sz: 1.4, rx: Math.PI / 2, rz: Math.PI / 5, color: '#ffb000' });
    sb.add(B.cyl(12), { y: 1.9, z: 0.06, sx: 0.5, sy: 0.05, sz: 0.5, rx: Math.PI / 2, color: '#ffffff' });
  }),
  mamie: buildMergedGeometry((sb) => {
    sb.box(0, 0, -0.05, 0.12, 0.8, 0.08, '#7a5230');
    sb.box(0, 0.8, 0, 0.9, 1.0, 0.08, '#c77dff');           // robe
    sb.add(B.cyl(16), { y: 2.2, sx: 0.7, sy: 0.06, sz: 0.7, rx: Math.PI / 2, color: '#f6cfa3' }); // tête
    sb.add(B.cyl(12), { y: 2.62, z: -0.01, sx: 0.45, sy: 0.06, sz: 0.4, rx: Math.PI / 2, color: '#e8e8e8' }); // chignon
    for (const x of [-0.13, 0.13]) { sb.add(B.torus(), { x, y: 2.25, z: 0.05, sx: 0.22, sy: 0.22, sz: 0.22, color: '#222' }); }
    sb.box(0, 2.0, 0.05, 0.22, 0.04, 0.02, '#7a2e2e');
    sb.box(0, 1.85, 0, 0.6, 0.12, 0.09, '#ff5a5f');          // écharpe
  }),
  pie: buildMergedGeometry((sb) => {
    sb.cyl(0, 0, 0, 0.28, 0.1, '#d4a373', 14);
    sb.cyl(0, 0.1, 0, 0.24, 0.07, '#fff3e6', 14);
    sb.sphere(0, 0.18, 0, 0.06, '#e63946', 6);
  }),
};

export class PieToss extends Minigame {
  constructor(game, def) {
    super(game, def, SPOT);
    this.maxDist = 6;
    this.raycaster = new THREE.Raycaster();
    this.pies = [];
  }

  static buildStatic(sb, col, scene) {
    const { x, z } = SPOT, T = SPOT.targets;
    // comptoir + toit rayé
    sb.box(x, 0, z - 1.2, 6, 1.1, 1, PALETTE.wood);
    for (const sx of [-2.9, 2.9]) sb.box(x + sx, 0, z - 1.2, 0.2, 3.2, 0.2, '#ffffff');
    for (let i = 0; i < 8; i++) sb.add(B.box(), { x: x - 2.8 + i * 0.8, y: 3.2, z: z - 1.4, sx: 0.8, sy: 0.12, sz: 2.4, rx: 0.12, color: i % 2 ? '#ff5a5f' : '#ffffff' });
    col.addBoxC(x, z - 1.2, 6, 1, 0, 1.1);
    // champ de tir : rails, palissade, côtés
    for (let r = 0; r < 3; r++) { const rz = T.z1 + 3 + r * ((T.z2 - T.z1 - 6) / 2); sb.box((T.x1 + T.x2) / 2, 0.01, rz, T.x2 - T.x1, 0.06, 0.4, '#5a4632'); }
    sb.box((T.x1 + T.x2) / 2, 0, T.z1 - 1.5, T.x2 - T.x1 + 2, 3.5, 0.5, '#8b5a2b');
    for (let i = 0; i < 12; i++) sb.box(T.x1 - 1 + i * 2.4, 3.5, T.z1 - 1.5, 0.3, 0.6, 0.55, '#6e4a26');
    col.addBox(T.x1 - 1, 0, T.z1 - 1.75, T.x2 + 1, 3.5, T.z1 - 1.25);
    for (const sx of [T.x1 - 1, T.x2 + 1]) { sb.box(sx, 0, (T.z1 + T.z2) / 2 - 1, 0.4, 1.6, T.z2 - T.z1 + 3, '#8b5a2b'); col.addBox(sx - 0.2, 0, T.z1 - 1.5, sx + 0.2, 1.6, T.z2 + 1.5); }
    // barrière devant les cibles (on ne va pas chercher ses tartes)
    sb.box((T.x1 + T.x2) / 2, 0, T.z2 + 2, T.x2 - T.x1 + 2, 0.9, 0.2, '#ffffff');
    col.addBox(T.x1 - 1, 0, T.z2 + 1.9, T.x2 + 1, 0.9, T.z2 + 2.1);
    const sign = makeSign('BATAILLE DE TARTES', 5.6, 0.9, { bg: '#ff5a5f', fg: '#ffffff', border: '#ffd23f' });
    sign.position.set(x, 3.75, z - 0.2);
    scene.add(sign);
    const back = makeSign('VISEZ LES CIBLES — PAS MAMIE !', 12, 1.4, { bg: '#2b2350', fg: '#ffd23f', border: '#ffffff' });
    back.position.set((T.x1 + T.x2) / 2, 2.6, T.z1 - 1.24);
    scene.add(back);
  }

  onStart() {
    const g = this.game;
    this.targets = pieTargets(this.seed, this.def.duration, this.def.targets);
    this.hits = new Set();
    this.pending = new Set();
    this.meshes = this.targets.map((tg) => {
      const m = new THREE.Mesh(GEO[tg.type], actorMaterial);
      m.castShadow = true;
      m.visible = false;
      m.scale.setScalar(1.4);
      m.userData.i = tg.i;
      g.engine.scene.add(m);
      return m;
    });
    g.player.teleport(SPOT.x, SPOT.z, Math.PI);
    g.cutscene = true;
    g.cam.override = { pos: new THREE.Vector3(SPOT.x + 1.1, 2.6, SPOT.z + 2.2), look: new THREE.Vector3(SPOT.x + 0.4, 1.5, SPOT.z - 20) };
    this.cross = h('div.crosshair');
    g.ui.root.append(this.cross);
    this.offClick = g.input.on('click', (e) => this.throwAt(e.x, e.y));
    this.cooldown = 0;
  }

  onGo() { this.cross.classList.add('show'); }

  throwAt(sx, sy) {
    if (this.state !== 'playing' || this.cooldown > 0 || this.game.ui.blocking) return;
    this.cooldown = 0.3;
    const g = this.game;
    const ndc = new THREE.Vector2((sx / innerWidth) * 2 - 1, -(sy / innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(ndc, g.engine.camera);
    const vis = this.meshes.filter((m) => m.visible && !this.hits.has(m.userData.i));
    const hit = this.raycaster.intersectObjects(vis, false)[0];
    const flight = 0.38;
    let aim, target = null;
    if (hit) {
      target = this.targets[hit.object.userData.i];
      const p = pieTargetPos(target, this.t + flight);
      aim = new THREE.Vector3(p.x, hit.point.y, p.z + 0.1);
    } else {
      // pas de cible : la tarte s'écrase au sol ou contre la palissade
      const r = this.raycaster.ray;
      const tt = r.direction.y < -0.01 ? -r.origin.y / r.direction.y : 40;
      aim = r.origin.clone().addScaledVector(r.direction, Math.min(tt, 40));
      aim.z = Math.max(aim.z, SPOT.targets.z1 - 1.2);
    }
    const pie = new THREE.Mesh(GEO.pie, actorMaterial);
    const from = new THREE.Vector3(g.player.pos.x + 0.3, 1.8, g.player.pos.z - 0.6);
    pie.position.copy(from);
    g.engine.scene.add(pie);
    this.pies.push({ pie, from, aim, t: 0, flight, target });
    g.player.setPose('throw', 0.25);
    g.sfx('throw');
  }

  onUpdate(dt) {
    if (!this.targets) return;
    const g = this.game;
    this.cooldown -= dt;
    if (g.input.pointer && this.cross) { this.cross.style.left = `${g.input.pointer.x}px`; this.cross.style.top = `${g.input.pointer.y}px`; }
    // cibles
    for (const tg of this.targets) {
      const m = this.meshes[tg.i];
      const shown = this.t >= tg.t && this.t <= tg.t + tg.d;
      const hit = this.hits.has(tg.i);
      if (!shown && !m.visible) continue;
      const p = pieTargetPos(tg, this.t);
      m.position.set(p.x, 0, p.z);
      const age = this.t - tg.t, left = tg.t + tg.d - this.t;
      const up = hit ? Math.max(0, 1 - (m.userData.fall = (m.userData.fall || 0) + dt * 4)) : Math.min(1, age * 6, left * 6);
      m.rotation.x = -(1 - Math.max(0, up)) * Math.PI / 2;
      m.visible = shown || (hit && up > 0);
      if (hit && up <= 0) m.visible = false;
    }
    // tartes en vol
    for (const p of this.pies) {
      p.t += dt;
      const k = Math.min(1, p.t / p.flight);
      p.pie.position.lerpVectors(p.from, p.aim, k);
      p.pie.position.y += Math.sin(k * Math.PI) * 1.4;
      p.pie.rotation.x = k * 6;
      if (k >= 1 && !p.done) {
        p.done = true;
        g.engine.scene.remove(p.pie);
        g.fx.emit({ x: p.aim.x, y: p.aim.y, z: p.aim.z, n: 18, colors: ['#fff3e6', '#ffffff', '#d4a373', '#e63946'], speed: 3, spread: 2, gravity: 8, life: 0.7, size: 0.22 });
        g.sfx('splat');
        if (p.target && !this.hits.has(p.target.i)) this.registerHit(p.target);
      }
    }
    this.pies = this.pies.filter((p) => !p.done);
  }

  async registerHit(tg) {
    const g = this.game;
    this.hits.add(tg.i);
    const pts = PIE_POINTS[tg.type];
    const scr = g.toScreen(this.meshes[tg.i].position, 3);
    if (scr) g.ui.floater(pts > 0 ? `+${pts}` : `${pts}`, scr.x, scr.y, pts > 0 ? (tg.type === 'gold' ? '#ffd23f' : '#ffffff') : '#ff4d6d');
    if (tg.type === 'mamie') { g.labels.bubble(this.meshes[tg.i], ['Ah non mais ça va pas ?!', 'Je vais le dire au maire !', 'Ma permanente !'][tg.i % 3], 1800, '', 3); g.sfx('error'); }
    try {
      const r = await g.net.request('mg.event', { kind: 'hit', target: tg.i });
      this.setScore(r.score);
    } catch (e) { /* refusé par l'autorité : pas de point */ }
  }

  onEnd() {
    const g = this.game;
    for (const m of this.meshes || []) g.engine.scene.remove(m);
    for (const p of this.pies) g.engine.scene.remove(p.pie);
    this.pies = [];
    this.meshes = null;
    this.targets = null;
    this.offClick?.();
    this.cross?.remove();
    g.cutscene = false;
    g.cam.override = null;
    g.cam.yaw = 0;
  }
}
