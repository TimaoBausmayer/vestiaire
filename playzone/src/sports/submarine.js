import * as THREE from 'three';
import { h, fmt } from '../ui/dom.js';
import { groundHeight, WATER_LEVEL, BUILDING_BY_ID } from '../../shared/world-layout.js';
import { SUBMARINE, REEFS } from '../../shared/sea.js';

// SOUS-MARIN du Centre de plongée : on explore les récifs et l'épave au fond de la mer.
// Avant / arrière = moteur, gauche / droite = virer, Espace = monter, C = descendre, phares la nuit.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function buildSub() {
  const g = new THREE.Group();
  const m = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, metalness: 0.25, ...o });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.1, 3.6, 8, 16).rotateX(Math.PI / 2), m('#ffd23f')); g.add(body);
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 1.1, 14), m('#ffd23f')); tower.position.set(0, 1.25, 0.3); g.add(tower);
  const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 6), m('#6c757d')); scope.position.set(0, 2.1, 0.5); g.add(scope);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.95, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2), m('#8ee3ff', { transparent: true, opacity: 0.45, roughness: 0.05 })); dome.position.set(0, 0.1, 2.55); g.add(dome);
  for (const s of [-1, 1]) {
    const port = new THREE.Mesh(new THREE.CircleGeometry(0.28, 14), m('#bdf0ff', { emissive: '#4cc3e6', emissiveIntensity: 0.6 })); port.position.set(s * 1.12, 0.15, 0.4); port.rotation.y = s * Math.PI / 2; g.add(port);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.6), m('#e63946')); fin.position.set(s * 1.4, 0, -1.2); g.add(fin);
  }
  const rud = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.2, 0.7), m('#e63946')); rud.position.set(0, 0.2, -2.6); g.add(rud);
  const prop = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 0.08), m('#b08d57', { metalness: 0.8 })); prop.position.set(0, 0, -2.95); g.add(prop); g.userData.prop = prop;
  const lamp = new THREE.SpotLight('#fff6d8', 0, 40, 0.6, 0.5, 1.2); lamp.position.set(0, 0.2, 2.6); lamp.target.position.set(0, -1.5, 14); g.add(lamp, lamp.target); g.userData.lamp = lamp;
  return g;
}

export class Submarine {
  constructor(g) {
    this.g = g;
    this.s = null;
    this.rig = buildSub();
    this.rig.visible = false;
    g.engine.scene.add(this.rig);
  }

  desk() {
    const g = this.g;
    g.ui.dialog({ name: 'Capitaine Nemo-Nemo', role: 'Centre de plongée Bulle d\'Air', text: `Envie d'explorer les fonds ? Le ${SUBMARINE.name} t'emmène voir les ${REEFS.length} spots : coraux, poissons, et l'épave du Sardine-Express (avec un coffre !). ${SUBMARINE.minutes} minutes pour ${g.profile.admin ? '0' : fmt(SUBMARINE.rent)} PC. Pour plonger à la nage, prends plutôt masque et palmes au comptoir.`, choices: [
      { label: `🟡 Louer le sous-marin (${g.profile.admin ? 'gratuit' : `${fmt(SUBMARINE.rent)} PC`})`, action: (m) => { m.close(); this.start(); } },
      { label: 'Plus tard', ghost: true, action: (m) => m.close() },
    ] });
  }

  async start() {
    const g = this.g;
    let r;
    try { r = await g.net.request('sub.start', {}); } catch (e) { g.ui.toast(e.message, 'bad', 4000); return; }
    if (g.vehicles?.current) g.vehicles.exit(true);
    g.player.external = true; g.player.noJump = true;
    g.player.avatar.root.visible = false;
    const y = WATER_LEVEL - 0.9;
    this.s = { x: r.at.x, z: r.at.z, y, yaw: Math.PI, speed: 0, vy: 0, until: r.until };
    this.rig.visible = true;
    this.saved = { dist: g.cam.dist, pitch: g.cam.pitch, min: g.cam.minDist };
    g.cam.dist = 9; g.cam.pitch = 0.12; g.cam.yaw = 0;
    this.buttons = h('div.foot-btns',
      h('button', { onpointerdown: (e) => { e.preventDefault(); this.up = true; }, onpointerup: () => { this.up = false; }, onpointerleave: () => { this.up = false; } }, '⬆️ Monter (Espace)'),
      h('button', { onpointerdown: (e) => { e.preventDefault(); this.down = true; }, onpointerup: () => { this.down = false; }, onpointerleave: () => { this.down = false; } }, '⬇️ Plonger (C)'),
      h('button', { onpointerdown: (e) => { e.preventDefault(); this.stop(); } }, '🏖️ Rentrer'));
    g.ui.root.append(this.buttons);
    g.sfx('start');
    g.ui.toast(`🟡 Sous-marin à l'eau ! Avant = moteur, gauche / droite = virer, C = plonger, Espace = monter. ${r.cost ? `(${fmt(r.cost)} PC)` : ''}`, 'good', 6000);
  }

  update(dt, t) {
    const s = this.s, g = this.g;
    if (!s) return;
    const I = g.input, now = g.now();
    if (now > s.until) { g.ui.toast('⏱️ Fin de la location : retour au Centre de plongée.', '', 4000); this.stop(); return; }
    // moteur et gouvernail
    const target = I.move.y * SUBMARINE.speed * (I.move.y < 0 ? 0.5 : 1);
    s.speed += (target - s.speed) * Math.min(1, dt * 1.2);
    s.yaw -= I.move.x * 0.9 * dt * (0.4 + Math.min(1, Math.abs(s.speed) / 3));
    const vert = (I.keys.has('Space') || this.up ? 1 : 0) - (I.keys.has('KeyC') || I.keys.has('ShiftLeft') || this.down ? 1 : 0);
    s.vy += (vert * 2.2 - s.vy) * Math.min(1, dt * 2);
    const nx = s.x + Math.sin(s.yaw) * s.speed * dt, nz = s.z + Math.cos(s.yaw) * s.speed * dt;
    const floorN = groundHeight(nx, nz);
    if (floorN < WATER_LEVEL - 2) { s.x = nx; s.z = nz; } else { s.speed *= -0.3; g.sfx('bump'); }
    const floor = groundHeight(s.x, s.z);
    s.y = clamp(s.y + s.vy * dt, floor + 1.3, WATER_LEVEL - 0.9);
    // rendu
    const bob = Math.sin(t * 1.3) * 0.06;
    this.rig.position.set(s.x, s.y + bob, s.z);
    this.rig.rotation.set(-s.vy * 0.12, s.yaw, -I.move.x * 0.12 * Math.min(1, Math.abs(s.speed) / 3), 'YXZ');
    this.rig.userData.prop.rotation.z += dt * (2 + Math.abs(s.speed) * 6);
    this.rig.userData.lamp.intensity = s.y < WATER_LEVEL - 4 || g.world.dayNight.night ? 30 : 0;
    if (Math.random() < dt * (2 + Math.abs(s.speed))) g.fx?.emit?.({ x: s.x - Math.sin(s.yaw) * 3.2, y: s.y, z: s.z - Math.cos(s.yaw) * 3.2, n: 2, colors: ['#e0fbff', '#ffffff'], speed: 0.8, gravity: -2.5, life: 1.6, size: 0.12 });
    const P = g.player;
    P.pos.set(s.x, s.y, s.z); P.yaw = s.yaw; P.vel.set(Math.sin(s.yaw) * s.speed, s.vy, Math.cos(s.yaw) * s.speed); P.speed = Math.abs(s.speed);
    const depth = Math.max(0, WATER_LEVEL - s.y);
    g.hud.track('sub', { title: '🟡 Sous-marin', text: `Profondeur ${depth.toFixed(1)} m · ${Math.round(Math.abs(s.speed) * 3.6)} km/h · reste ${Math.ceil((s.until - now) / 60000)} min`, bar: Math.min(1, depth / SUBMARINE.depth) });
  }

  async stop() {
    const s = this.s, g = this.g;
    if (!s) return;
    this.s = null;
    this.rig.visible = false;
    this.buttons?.remove();
    g.hud.track('sub', null);
    g.player.external = false; g.player.noJump = false;
    g.player.avatar.root.visible = true;
    if (this.saved) { g.cam.dist = this.saved.dist; g.cam.pitch = this.saved.pitch; g.cam.minDist = this.saved.min; }
    g.net.request('sub.end', {}).catch(() => {});
    const b = BUILDING_BY_ID.plongee;
    g.player.teleport(b.door.x, b.door.z + 3, 0);
  }
}
