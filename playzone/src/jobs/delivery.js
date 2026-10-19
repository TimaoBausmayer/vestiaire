import * as THREE from 'three';
import { POI } from '../../shared/world-layout.js';
import { buildMergedGeometry } from '../core/static-builder.js';
import { actorMaterial } from '../core/materials.js';
import { Beacon } from './beacon.js';

// LIVREUR : prendre le colis au dépôt, puis le livrer devant la bonne porte (une ou plusieurs adresses).
// Express : chrono. Fragile : chaque saut abîme le colis (l'autorité le mesure à partir des positions).
const BOX = buildMergedGeometry((sb) => {
  sb.box(0, -0.25, 0, 0.6, 0.5, 0.5, '#c49a6c');
  sb.box(0, 0.24, 0, 0.62, 0.03, 0.12, '#e9d5a0');
  sb.box(0, -0.05, 0.255, 0.25, 0.18, 0.01, '#ffffff');
});

export class DeliveryJob {
  constructor(game, mgr, job, mt, mission) {
    Object.assign(this, { game, mgr, job, mt, m: mission });
    this.inter = [];
    this.beacon = new Beacon(game.engine.scene, '#ffd23f');
    this.localDamage = 0;
    this.wasGrounded = true;
  }

  begin() {
    const g = this.game;
    this.inter.push(g.interactions.add({ x: POI.depot.x, z: POI.depot.z, r: 3.6, priority: 4, label: '📦 Prendre le colis', enabled: () => !this.m.picked, action: () => this.pickup() }));
    for (const s of this.m.stops) {
      this.inter.push(g.interactions.add({ x: s.x, z: s.z, r: 3, priority: 4, label: `📦 Livrer : ${s.name}`, enabled: () => this.m.picked && !this.m.stops.find((x) => x.id === s.id).done, action: () => this.deliver(s.id) }));
    }
    this.refresh();
  }

  async pickup() {
    const g = this.game;
    try {
      const r = await g.net.request('job.step', { missionId: this.m.id, action: 'pickup' });
      this.m = r.mission;
      this.m.pickedLocal = performance.now();
      this.box = new THREE.Mesh(BOX, actorMaterial);
      this.box.position.set(0, 1.2, 0.5);
      g.avatar.root.add(this.box);
      g.player.carrying = true;
      g.player.setPose('carry');
      g.sfx('pop');
      if (this.m.fragile) g.ui.toast('🥚 Colis fragile : évite de sauter et de tomber !', 'bad', 4000);
      if (this.m.limit) g.ui.toast(`⏱️ Express : livre en moins de ${this.m.limit} s pour le bonus !`, '', 4000);
      this.refresh();
    } catch (e) { g.ui.toast(e.message, 'bad'); }
  }

  async deliver(stopId) {
    const g = this.game;
    try {
      const r = await g.net.request('job.step', { missionId: this.m.id, action: 'deliver', stop: stopId });
      g.sfx('success');
      const stop = this.m.stops.find((s) => s.id === stopId);
      g.labels.bubble(g.avatar.root, ['Colis pour vous !', 'Signez ici... ou là, peu importe.', 'Livré avec amour (et un peu de sueur).'][Math.floor(Math.random() * 3)], 2500, 'player');
      if (r.done) { this.mgr.complete(r); return; }
      this.m = { ...r.mission, pickedLocal: this.m.pickedLocal };
      g.ui.toast(`Livré au ${stop.name} ! Encore ${this.m.stops.filter((s) => !s.done).length} colis.`, 'good');
      this.refresh();
    } catch (e) { g.ui.toast(e.message, 'bad'); }
  }

  target() {
    if (!this.m.picked) return { x: POI.depot.x, z: POI.depot.z, label: 'Dépôt' };
    const s = this.m.stops.find((x) => !x.done);
    return s ? { x: s.x, z: s.z, label: s.name } : null;
  }

  refresh() {
    const t = this.target();
    this.game.hud.compassTarget = t;
    if (t) this.beacon.at(t.x, 0, t.z);
    this.updateTracker();
  }

  updateTracker() {
    const left = this.m.stops.filter((s) => !s.done);
    let timer = null, bar;
    if (this.m.limit && this.m.picked) {
      const el = (performance.now() - this.m.pickedLocal) / 1000;
      const rem = this.m.limit - el;
      timer = rem > 0 ? `${Math.ceil(rem)} s` : 'En retard !';
      bar = Math.max(0, rem / this.m.limit);
    }
    const text = !this.m.picked ? 'Va chercher le colis au dépôt Colis Express.' : `Livre à : ${left.map((s) => s.name).join(', ')}${this.m.fragile ? ` · Colis abîmé : ${Math.min(100, this.localDamage)} %` : ''}`;
    this.game.hud.track('job', { title: `📦 ${this.mt.name}`, text, timer, bar, button: { label: 'Abandonner', onclick: () => this.mgr.cancel() } });
  }

  update(dt, t) {
    this.beacon.update(t);
    const p = this.game.player;
    if (this.m.fragile && this.m.picked) {
      if (this.wasGrounded && !p.grounded && !p.swimming) { this.localDamage += 20; this.game.ui.toast('🥚 Crac ! Le colis a souffert.', 'bad', 1500); this.game.sfx('error'); }
      this.wasGrounded = p.grounded;
    }
    this._tt = (this._tt || 0) + dt;
    if (this._tt > 0.25) { this._tt = 0; this.updateTracker(); }
  }

  end() {
    const g = this.game;
    for (const it of this.inter) g.interactions.remove(it);
    this.beacon.dispose();
    if (this.box) g.avatar.root.remove(this.box);
    g.player.carrying = false;
    g.player.setPose('idle');
  }

  markers() {
    const t = this.target();
    return t ? [{ x: t.x, z: t.z, color: '#ffd23f', icon: '📦', r: 6 }] : [];
  }
}
