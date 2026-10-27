import * as THREE from 'three';
import { h } from '../ui/dom.js';
import { buildMergedGeometry } from '../core/static-builder.js';
import { REEFS, TREASURE, AIR, ownsMask } from '../../shared/sea.js';
import { groundHeight, WATER_LEVEL } from '../../shared/world-layout.js';
import { mulberry32 } from '../../shared/rng.js';

// VIE MARINE ET PLONGÉE : bancs de poissons autour des récifs proches, vue sous-marine (brume bleue,
// surface vue d'en dessous), plongée en nageant (C : descendre, Espace : remonter) avec réserve d'air,
// coffre de l'épave, carnet des spots découverts.
const FISH_COLORS = ['#ffd23f', '#ff7b00', '#3a86ff', '#ff3fa4', '#4ffbdf', '#f4f1ea', '#e63946', '#8338ec', '#06d6a0'];
const PER_REEF = 70;   // poissons par récif (deux récifs animés au plus)

export class Sea {
  constructor(g) {
    this.g = g;
    this.dive = 0;          // profondeur de plongée sous la nage en surface (m)
    this.air = 1;
    this.under = false;
    this.camSaved = null;
    // poisson : corps ovale + queue + œil (couleur par instance)
    const fish = buildMergedGeometry((sb) => {
      sb.sphere(0, 0, 0, 0.5, '#ffffff', 10, undefined, 0.7);
      sb.box(-0.03, -0.18, -0.85, 0.06, 0.36, 0.4, '#ffffff');
      sb.sphere(0.14, 0.06, 0.28, 0.07, '#111111', 6);
      sb.sphere(-0.14, 0.06, 0.28, 0.07, '#111111', 6);
    });
    fish.scale(0.5, 1, 1);
    this.fish = new THREE.InstancedMesh(fish, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4 }), PER_REEF * 2);
    this.fish.frustumCulled = false;
    this.fish.count = 0;
    const r = mulberry32(5150);
    this.fishData = Array.from({ length: PER_REEF * 2 }, (_, i) => ({ school: Math.floor((i % PER_REEF) / 10), ph: r() * 6.28, off: [r() - 0.5, r() - 0.5, r() - 0.5], s: 0.35 + r() * 0.5 * (i % 10 === 0 ? 2.2 : 1), sp: 0.25 + r() * 0.2 }));
    const c = new THREE.Color();
    for (let i = 0; i < PER_REEF * 2; i++) this.fish.setColorAt(i, c.set(FISH_COLORS[(i * 7 + Math.floor(i / 10)) % FISH_COLORS.length]));
    g.engine.scene.add(this.fish);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3();
    this.tint = h('div.underwater');
    g.ui.root.prepend(this.tint);
    this.treasureSpot = g.interactions.add({ x: TREASURE.x, z: TREASURE.z, r: 3.2, priority: 3, enabled: () => this.dive > 3 || !!g.submarine?.s, label: '💰 Ouvrir le coffre au trésor', action: () => this.openTreasure() });
    this.discoverT = 0;
    // boutons « plonger / remonter » (maintenus) quand on nage
    const hold = (k) => ({ onpointerdown: (e) => { e.preventDefault(); this[k] = true; }, onpointerup: () => { this[k] = false; }, onpointerleave: () => { this[k] = false; } });
    this.buttons = h('div.foot-btns.swim-btns.hidden', h('button', hold('touchDown'), '🤿 Plonger (C)'), h('button', hold('touchUp'), '⬆️ Remonter (Espace)'));
    g.ui.root.append(this.buttons);
  }

  // récifs animés : les deux plus proches du joueur (à moins de 260 m)
  nearReefs(P) { return REEFS.map((rf) => ({ rf, d: Math.hypot(rf.x - P.x, rf.z - P.z) })).filter((x) => x.d < 260).sort((a, b) => a.d - b.d).slice(0, 2).map((x) => x.rf); }

  update(dt, t) {
    const g = this.g, P = g.player, sub = g.submarine?.s || P.pool;   // dans sa piscine : pas de plongée
    // ---------------------------------------------------------------- plongée en nageant
    if (P.swimming && !sub) {
      const I = g.input, floor = groundHeight(P.pos.x, P.pos.z);
      const maxDive = Math.max(0, (WATER_LEVEL - 1.05) - (floor + 0.7));
      if (I.keys.has('KeyC') || this.touchDown) this.dive = Math.min(maxDive, this.dive + 2.2 * dt);
      else if (I.keys.has('Space') || this.touchUp) this.dive = Math.max(0, this.dive - 2.8 * dt);
      this.dive = Math.min(this.dive, maxDive);
    } else this.dive = 0;
    P.dive = this.dive;
    this.buttons.classList.toggle('hidden', !(P.swimming && !sub));
    P.swimBoost = ownsMask(g.profile) ? 1.5 : 1;
    // air : on s'essouffle la tête sous l'eau, on récupère en surface
    const head = this.dive > 0.5;
    const cap = ownsMask(g.profile) || g.profile.admin ? AIR.mask : AIR.base;
    if (head) this.air = Math.max(0, this.air - dt / cap); else this.air = Math.min(1, this.air + dt / 4);
    if (head && this.air <= 0) { this.dive = 0; g.ui.toast('😮‍💨 À bout de souffle ! Remonte respirer à la surface.', 'bad', 3000); g.sfx?.('fail'); }
    if (head || this.air < 1) g.hud.track('air', { title: '🫧 Air', text: `${Math.ceil(this.air * cap)} s ${ownsMask(g.profile) ? '(masque et palmes)' : '— le masque du Centre de plongée en donne bien plus'}`, bar: this.air });
    else g.hud.track('air', null);
    // la caméra plonge avec le joueur (sinon on verrait la surface d'en haut)
    const cam = g.cam;
    if (head && !sub) {
      if (!this.camSaved) this.camSaved = { pitch: cam.pitch, dist: cam.dist };
      cam.pitch += (0.06 - cam.pitch) * Math.min(1, dt * 3);
      cam.dist += (5.5 - cam.dist) * Math.min(1, dt * 3);
    } else if (this.camSaved && !sub) { cam.pitch = this.camSaved.pitch; cam.dist = this.camSaved.dist; this.camSaved = null; }
    // ---------------------------------------------------------------- spots découverts
    this.discoverT -= dt;
    if (this.discoverT <= 0) {
      this.discoverT = 1;
      const seen = g.profile.sea?.seen || [];
      const rf = (head || sub) && REEFS.find((x) => !seen.includes(x.id) && Math.hypot(x.x - P.pos.x, x.z - P.pos.z) < x.r);
      if (rf && !this.discovering) {
        this.discovering = true;
        g.net.request('sea.discover', { id: rf.id }).then((r) => { if (!r.already) { g.sfx?.('levelup'); g.ui.toast(`🐠 Nouveau spot : ${r.name} (${r.count}/${r.of}) · +25 XP`, 'good', 4500); } }).catch(() => {}).finally(() => { this.discovering = false; });
      }
    }
    // ---------------------------------------------------------------- poissons
    const reefs = this.nearReefs(P.pos);
    let n = 0;
    reefs.forEach((rf, k) => {
      for (let i = 0; i < PER_REEF; i++) {
        const f = this.fishData[k * PER_REEF + i];
        const sc = f.school, R = rf.r * (0.35 + (sc % 4) * 0.17), w = (sc % 2 ? 1 : -1) * f.sp * (8 / R), a = t * w + sc * 1.7;
        const cx = rf.x + Math.cos(a) * R, cz = rf.z + Math.sin(a) * R;
        const floor = groundHeight(cx, cz), top = WATER_LEVEL - 0.6;
        const cy = Math.min(top - 0.3, floor + 1.2 + ((sc * 0.37) % 1) * Math.max(0.5, top - floor - 2));
        const wob = Math.sin(t * 2 + f.ph);
        this._p.set(cx + f.off[0] * 3 + wob * 0.3, cy + f.off[1] * 1.2, cz + f.off[2] * 3 + Math.cos(t * 1.7 + f.ph) * 0.3);
        const yaw = Math.atan2(-Math.sin(a) * Math.sign(w), Math.cos(a) * Math.sign(w));
        this._e.set(0, yaw + Math.sin(t * 9 + f.ph) * 0.12, 0); this._q.setFromEuler(this._e);
        this._s.setScalar(f.s);
        this._m.compose(this._p, this._q, this._s);
        this.fish.setMatrixAt(n++, this._m);
      }
    });
    this.fish.count = n;
    if (n) this.fish.instanceMatrix.needsUpdate = true;
  }

  // Appelé après le jour / nuit : brume bleue quand la caméra est sous l'eau.
  afterWorld() {
    const e = this.g.engine, fog = e.scene.fog, under = e.camera.position.y < WATER_LEVEL - 0.05;
    if (under) {
      if (!this.under) { this.under = true; this.fogSaved = { near: fog.near, far: fog.far }; this.tint.classList.add('on'); const wm = this.g.world.water.material; if (wm.side !== THREE.DoubleSide) { wm.side = THREE.DoubleSide; wm.needsUpdate = true; } wm.uniforms.under.value = 1; if (this.g.world.clouds) this.g.world.clouds.visible = false; e.sky.visible = false; this.clearSaved = e.renderer.getClearColor(new THREE.Color()).getHex(); e.renderer.setClearColor('#0b5f7c'); }
      fog.color.set('#0b5f7c'); fog.near = 0; fog.far = 30;
    } else if (this.under) {
      this.under = false; fog.near = this.fogSaved.near; fog.far = this.fogSaved.far; this.tint.classList.remove('on'); this.g.world.water.material.uniforms.under.value = 0; if (this.g.world.clouds) this.g.world.clouds.visible = true; e.sky.visible = true; e.renderer.setClearColor(this.clearSaved ?? 0x000000);
    }
  }

  async openTreasure() {
    const g = this.g;
    try { const r = await g.net.request('sea.treasure', {}); g.sfx?.('levelup'); g.fx?.emit?.({ x: TREASURE.x, y: groundHeight(TREASURE.x, TREASURE.z) + 1, z: TREASURE.z, n: 30, colors: ['#ffd23f', '#fff3c4'], speed: 3, gravity: -1, life: 1.4, size: 0.18 }); g.ui.toast(`💰 Trésor de l'épave : +${r.gain} PC !`, 'good', 5000); }
    catch (e) { g.ui.toast(e.message, 'bad', 3500); }
  }
}
