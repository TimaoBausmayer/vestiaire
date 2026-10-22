import * as THREE from 'three';
import { h } from '../ui/dom.js';
import { Avatar } from '../characters/avatar.js';
import { DEFAULT_APPEARANCE, SKINS, HAIR_STYLES, COLORS } from '../../shared/appearance.js';
import { mulberry32, hashString } from '../../shared/rng.js';
import { SKI, SKI_GATES, skiY, DISC, fmtTime } from '../../shared/courses.js';

// STATION DE SKI DU MONT-PINARD : piste enneigée, télésiège (on s'assoit, on monte), descente libre,
// slalom chronométré (10 portes, +5 s par porte manquée) et compétition contre des skieurs PNJ.
// Commandes : gauche / droite = virages, Avant = recherche de vitesse, Arrière = chasse-neige (freiner).

const req = async (g, t, p) => { try { return await g.net.request(t, p); } catch (e) { g.ui.toast(e.message, 'bad', 5000); g.sfx('error'); return null; } };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const CX = (SKI.x1 + SKI.x2) / 2, HALF = (SKI.x2 - SKI.x1) / 2;
const SIN = Math.sin(Math.atan2(SKI.height, SKI.bottom - SKI.top)), COS = Math.cos(Math.atan2(SKI.height, SKI.bottom - SKI.top));
const LIFT_T = 16;   // secondes de télésiège

// hauteur du relief : la piste + des flancs rocheux
function mountainY(x, z) {
  const side = Math.max(0, Math.abs(x - CX) - HALF);
  const top = z < SKI.top ? Math.max(0, 1 - (SKI.top - z) / 18) : 1;
  return skiY(z) * Math.max(0, 1 - side / 26) * top + (side > 0 ? Math.sin(x * 0.15) * Math.sin(z * 0.11) * 2 * Math.min(1, side / 10) * (skiY(z) / SKI.height) : 0);
}

export class Ski {
  constructor(g) {
    this.g = g;
    this.s = null;
    this.build();
    g.interactions.add({ x: SKI.hut.x, z: SKI.hut.z + 2.5, r: 3, priority: 3, label: '⛷️ Station du Mont-Pinard : forfaits, télésiège, slalom', action: () => g.races?.desk('ski') });
  }

  build() {
    const g = this.g, root = new THREE.Group();
    root.name = 'ski';
    // relief enneigé
    const W = SKI.x2 - SKI.x1 + 56, D = SKI.bottom - SKI.top + 25;
    const geo = new THREE.PlaneGeometry(W, D, 60, 50).rotateX(-Math.PI / 2);
    geo.translate(CX, 0, (SKI.top - 20 + SKI.bottom + 5) / 2);
    const pos = geo.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), y = mountainY(x, z);
      pos.setY(i, y + 0.05);
      const onPiste = Math.abs(x - CX) < HALF;
      c.set(onPiste ? '#f4f8fb' : y > 18 ? '#e9eef2' : '#8a8f86');
      if (onPiste) c.lerp(new THREE.Color('#c9dbe8'), 0.25 + 0.25 * Math.sin(x * 0.9 + Math.sin(z * 0.2) * 3) * Math.sin(z * 0.35));   // traces de ski, bosses
      if (!onPiste && Math.sin(x * 0.4 + z * 0.3) > 0.4) c.set(y > 10 ? '#cfd8de' : '#6d7a63');
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const mtn = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
    mtn.receiveShadow = true; root.add(mtn);
    // on ne marche pas sur la montagne (on monte en télésiège)
    g.collision.addBox(SKI.x1 - 26, -1, SKI.top - 20, SKI.x2 + 26, SKI.height + 5, SKI.bottom - 14, { noCamera: true });
    // sapins sur les flancs
    const r = mulberry32(42), pine = new THREE.MeshStandardMaterial({ color: '#2f6b3a' }), snowTop = new THREE.MeshStandardMaterial({ color: '#ffffff' });
    for (let i = 0; i < 90; i++) {
      const side = r() < 0.5 ? -1 : 1, x = CX + side * (HALF + 3 + r() * 20), z = SKI.top + r() * (SKI.bottom - SKI.top - 10);
      const y = mountainY(x, z), s = 0.8 + r() * 0.8;
      const t = new THREE.Mesh(new THREE.ConeGeometry(1.6 * s, 5 * s, 8), pine); t.position.set(x, y + 2.5 * s, z); root.add(t);
      const sn = new THREE.Mesh(new THREE.ConeGeometry(0.8 * s, 1.6 * s, 8), snowTop); sn.position.set(x, y + 4.4 * s, z); root.add(sn);
    }
    // portes de slalom
    this.gateMeshes = [];
    for (const [i, gt] of SKI_GATES.entries()) {
      const m = new THREE.MeshStandardMaterial({ color: i % 2 ? '#1d4ed8' : '#e63946' });
      for (const dx of [-4, 4]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.8, 6), m); p.position.set(gt.x + dx, skiY(gt.z) + 0.9, gt.z); root.add(p);
        const f = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.6, 0.8), m); f.position.set(gt.x + dx, skiY(gt.z) + 1.4, gt.z + 0.4); root.add(f);
      }
    }
    // arche d'arrivée et cabane de départ (sommet)
    const wood = new THREE.MeshStandardMaterial({ color: '#8d5a2b' }), roof = new THREE.MeshStandardMaterial({ color: '#b5452f' });
    for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5, 0.5), roof); m.position.set(CX + s * 14, 2.5, SKI.bottom - 2); root.add(m); }
    const banner = new THREE.Mesh(new THREE.BoxGeometry(28.5, 1.4, 0.3), roof); banner.position.set(CX, 5.2, SKI.bottom - 2); root.add(banner);
    const top = new THREE.Mesh(new THREE.BoxGeometry(8, 3, 5), wood); top.position.set(CX, SKI.height + 1.5, SKI.top - 8); root.add(top);
    // chalet (accueil, forfaits) au pied des pistes
    const ch = new THREE.Mesh(new THREE.BoxGeometry(10, 4, 6), wood); ch.position.set(SKI.hut.x, 2, SKI.hut.z - 2); root.add(ch);
    const cr = new THREE.Mesh(new THREE.ConeGeometry(7.2, 2.6, 4), roof); cr.rotation.y = Math.PI / 4; cr.scale.z = 0.62; cr.position.set(SKI.hut.x, 5.3, SKI.hut.z - 2); root.add(cr);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(6, 1, 0.2), new THREE.MeshStandardMaterial({ color: '#1d4ed8' })); sign.position.set(SKI.hut.x, 3.5, SKI.hut.z + 1.05); root.add(sign);
    g.collision.addBox(SKI.hut.x - 5, 0, SKI.hut.z - 5, SKI.hut.x + 5, 4, SKI.hut.z + 1);
    // télésiège : pylônes, câble, sièges qui tournent
    const X = SKI.liftX, steel = new THREE.MeshStandardMaterial({ color: '#7c858d' });
    this.liftPath = (u) => { const z = SKI.bottom - 2 + (SKI.top - 6 - (SKI.bottom - 2)) * u; return { x: X, y: skiY(z) + 7.2, z }; };
    for (let u = 0; u <= 1.001; u += 1 / 7) { const p = this.liftPath(u); const py = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 8, 8), steel); py.position.set(X, p.y - 4, p.z); root.add(py); const bar = new THREE.Mesh(new THREE.BoxGeometry(5, 0.3, 0.3), steel); bar.position.set(X, p.y + 0.4, p.z); root.add(bar); }
    for (const dx of [-2, 2]) {
      const a = this.liftPath(0), b = this.liftPath(1);
      const dir = new THREE.Vector3(0, b.y - a.y, b.z - a.z), len = dir.length();
      const cab = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, len, 4), new THREE.MeshStandardMaterial({ color: '#222' }));
      cab.position.set(X + dx, (a.y + b.y) / 2 + 0.4, (a.z + b.z) / 2); cab.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      root.add(cab);
    }
    this.chairs = [];
    const seatM = new THREE.MeshStandardMaterial({ color: '#e63946' });
    for (let i = 0; i < 18; i++) { const ch2 = new THREE.Group(); const seat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.6), seatM); seat.position.y = -1.6; const back = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 0.1), seatM); back.position.set(0, -1.3, -0.3); const rod = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.6, 0.06), steel); rod.position.y = -0.8; ch2.add(seat, back, rod); root.add(ch2); this.chairs.push({ m: ch2, u: i / 18 }); }
    g.engine.scene.add(root);
    // skis aux pieds pendant la descente
    this.skis = new THREE.Group();
    for (const dx of [-0.16, 0.16]) { const k = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 1.7), new THREE.MeshStandardMaterial({ color: '#ffd23f' })); k.position.set(dx, 0.02, 0.1); this.skis.add(k); }
    this.skis.visible = false;
    g.engine.scene.add(this.skis);
  }

  // ------------------------------------------------------------------------------ départ : télésiège
  async go(mode) {
    const g = this.g;
    const r = await req(g, 'sport.start', { disc: 'ski', mode });
    if (!r) return;
    if (r.trial) g.ui.toast('🎁 Essai gratuit !', 'good', 2500);
    if (g.vehicles?.current) g.vehicles.exit(true);
    const M = DISC.ski.modes[mode];
    g.player.external = true;
    this.s = { mode, M, phase: 'lift', t: 0, x: CX, z: SKI.top - 4, yaw: 0, v: 0, gates: 0, gi: 0, crashed: 0, hudT: 0, field: r.field, npcs: [] };
    this.skipBtn = h('div.foot-btns', h('button', { onpointerdown: (e) => { e.preventDefault(); if (this.s?.phase === 'lift') this.s.t = LIFT_T; } }, '⏩ Arriver en haut'));
    g.ui.root.append(this.skipBtn);
    g.ui.toast('🚡 Télésiège : profite de la vue ! (bouton ⏩ pour arriver en haut)', '', 4000);
  }

  startDescent() {
    const s = this.s, g = this.g;
    s.phase = 'wait'; s.t = 0;
    s.x = CX; s.z = SKI.top + 2; s.yaw = 0; s.v = 0;
    this.skipBtn?.remove();
    this.skis.visible = true;
    // skieurs PNJ (compétition) : ils descendent en même temps, chacun à son rythme
    for (const n of s.field) {
      const r = mulberry32(hashString(n.name));
      const av = new Avatar({ ...DEFAULT_APPEARANCE, skin: SKINS[Math.floor(r() * 8)], hair: HAIR_STYLES[Math.floor(r() * HAIR_STYLES.length)], top: 'sweat', topColor: COLORS[Math.floor(r() * COLORS.length)], hat: 'bonnet' }, {});
      g.engine.scene.add(av.root);
      const label = document.createElement('div'); label.className = 'wlabel'; label.textContent = `${n.name} (PNJ)`;
      s.npcs.push({ n, av, lab: g.labels.add(av.root, label, 2.1, 50) });
    }
    this.lights = h('div.kart-lights', [0, 1, 2].map(() => h('span')));
    g.ui.root.append(this.lights);
  }

  update(dt) {
    const s = this.s, g = this.g;
    // les sièges tournent toujours
    for (const c of this.chairs) { c.u = (c.u + dt / (LIFT_T * 2)) % 1; const up = c.u < 0.5, u = up ? c.u * 2 : 2 - c.u * 2, p = this.liftPath(u); c.m.position.set(p.x + (up ? 2 : -2), p.y + 0.4, p.z); }
    if (!s) return;
    const P = g.player, I = g.input;
    if (s.phase === 'lift') {
      s.t += dt;
      const p = this.liftPath(Math.min(1, s.t / LIFT_T));
      P.pos.set(p.x + 2, p.y - 1.55, p.z); P.yaw = Math.PI;
      P.avatar.root.position.set(p.x + 2, p.y - 2.1, p.z); P.avatar.root.rotation.set(0, Math.PI, 0);
      P.avatar.update(dt, { speed: 0, grounded: true, pose: 'sit' });
      if (s.t >= LIFT_T) this.startDescent();
      return;
    }
    if (s.phase === 'wait') {
      s.t += dt;
      const on = Math.min(3, Math.floor(s.t / 0.7) + 1);
      [...this.lights.children].forEach((e, i) => e.classList.toggle('on', i < on));
      if (on !== s.lastOn) { s.lastOn = on; g.sfx('beep'); }
      if (s.t >= 2.1) { this.lights.remove(); s.phase = 'run'; s.t = 0; g.sfx('go'); g.ui.toast('🟢 Partez !', 'good', 1000); }
    } else if (s.phase === 'run') {
      s.t += dt;
      const skill = g.profile.sports.ski?.skill || 5;
      if (s.crashed > 0) { s.crashed -= dt; s.v = 0; }
      else {
        const tuck = I.move.y > 0.3, plow = I.move.y < -0.3;
        s.yaw = clamp(s.yaw - I.move.x * (1.5 + skill / 80) * dt, -1.45, 1.45);
        const mu = plow ? 0.32 : 0.045, k = tuck ? 0.0024 : 0.004;
        s.v += (9.8 * SIN * Math.cos(s.yaw) - mu * 9.8 * COS - k * s.v * s.v) * dt;
        s.v *= 1 - Math.abs(I.move.x) * 0.12 * dt;
        s.v = clamp(s.v, 0, 30 + skill / 20);
      }
      const pz = s.z;
      s.x += Math.sin(s.yaw) * s.v * dt;
      s.z += Math.cos(s.yaw) * s.v * dt * COS;
      // bords de piste : chute
      if (Math.abs(s.x - CX) > HALF - 2) { s.x = CX + Math.sign(s.x - CX) * (HALF - 3); s.crashed = 1.5; s.yaw = 0; g.sfx('bump'); g.ui.toast('❄️ Chute dans la poudreuse !', 'bad', 1200); }
      // portes
      const gt = SKI_GATES[s.gi];
      if (gt && pz < gt.z && s.z >= gt.z) { if (Math.abs(s.x - gt.x) < 4) { s.gates++; g.sfx('beep'); } else if (s.M.gates) g.ui.toast('❌ Porte manquée (+5 s)', 'bad', 1000); s.gi++; }
      if (s.z >= SKI.bottom - 1) { this.finish(); return; }
    }
    // skieur
    const y = skiY(s.z);
    P.pos.set(s.x, y, s.z); P.yaw = s.yaw; P.vel.set(Math.sin(s.yaw) * s.v, 0, Math.cos(s.yaw) * s.v);
    const slope = Math.atan2(SKI.height, SKI.bottom - SKI.top);
    P.avatar.root.position.set(s.x, y, s.z); P.avatar.root.rotation.set(s.crashed > 0 ? 1.2 : 0, s.yaw, 0);
    P.avatar.update(dt, { speed: 0, grounded: true, pose: I.move.y > 0.3 ? 'sit' : 'hold-forward' });
    this.skis.position.set(s.x, y + 0.02, s.z); this.skis.rotation.set(slope, s.yaw, 0, 'YXZ');
    // PNJ : descente en zigzag à travers les portes
    if (s.phase === 'run') for (const n of s.npcs) {
      const u = Math.min(1, s.t / n.n.total);
      const z = SKI.top + 2 + (SKI.bottom - SKI.top - 2) * u;
      const k = SKI_GATES.findIndex((gt) => gt.z > z);
      const ga = SKI_GATES[Math.max(0, k - 1)] || { x: CX }, gb = SKI_GATES[k] || { x: CX, z: SKI.bottom };
      const w = k <= 0 ? 0 : (z - SKI_GATES[k - 1].z) / ((gb.z || SKI.bottom) - SKI_GATES[k - 1].z);
      const x = ga.x + (gb.x - ga.x) * clamp(w, 0, 1);
      n.av.root.position.set(x, skiY(z), z); n.av.root.rotation.y = Math.atan2(gb.x - ga.x, 14);
      n.av.update(dt, { speed: 0, grounded: true, pose: 'hold-forward' });
    }
    s.hudT -= dt;
    if (s.hudT <= 0) {
      s.hudT = 0.2;
      const pos = 1 + s.npcs.filter((n) => Math.min(1, s.t / n.n.total) > (s.z - SKI.top) / (SKI.bottom - SKI.top)).length;
      g.hud.track('ski', { title: `⛷️ ${s.M.name}`, timer: fmtTime(s.t), text: `${Math.round(s.v * 3.6)} km/h${s.M.gates ? ` · portes ${s.gates}/${s.gi}` : ''}${s.npcs.length ? ` · position ${pos}/${s.npcs.length + 1}` : ''} · Avant = vitesse, Arrière = chasse-neige`, button: { label: 'Abandonner', onclick: () => this.finish(true) } });
    }
  }

  async finish(abandon = false) {
    const s = this.s, g = this.g;
    if (!s) return;
    this.s = null;
    this.skipBtn?.remove(); this.lights?.remove();
    for (const n of s.npcs) { g.engine.scene.remove(n.av.root); n.av.dispose?.(); g.labels.remove?.(n.lab); }
    this.skis.visible = false;
    g.hud.track('ski', null);
    g.player.external = false;
    if (abandon || s.phase !== 'run') { g.player.teleport(SKI.hut.x, SKI.hut.z + 5, Math.PI); await req(g, 'sport.finish', { abandon: true }); return; }
    g.player.teleport(Math.max(SKI.x1 + 4, Math.min(SKI.x2 - 4, s.x)), SKI.bottom + 6, 0);
    g.net.sendState?.(g.player.netState(), g.player.zone);
    const r = await req(g, 'sport.finish', { time: s.t, gates: s.gates });
    if (!r) return;
    g.sfx(r.rank === 1 || r.record ? 'levelup' : 'success');
    const pos = r.rank ? `${r.rank === 1 ? '🥇 VICTOIRE' : `${r.rank}e`} sur ${r.of}. ` : '';
    g.ui.dialog({ name: 'Le moniteur Jean-Schuss', role: s.M.name, text: `${pos}Temps : ${fmtTime(r.total)}${r.missed ? ` (dont ${r.missed * 5} s de pénalité, ${r.missed} porte(s) manquée(s))` : ''}.${r.record ? ' NOUVEAU RECORD !' : ` Record : ${fmtTime(r.best)}.`}${r.prize ? ` Prix : ${r.prize} PC.` : ''} Niveau de ski ${Math.round(r.skill)}/100.`, choices: [
      { label: '🚡 Remonter (télésiège)', action: (m) => { m.close(); g.player.teleport(SKI.hut.x, SKI.hut.z + 3, Math.PI); g.races.desk('ski'); } },
      { label: 'OK', ghost: true, action: (m) => m.close() },
    ] });
  }
}
