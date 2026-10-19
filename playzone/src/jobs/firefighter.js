import * as THREE from 'three';
import { Beacon } from './beacon.js';
import { buildMergedGeometry } from '../core/static-builder.js';
import { actorMaterial } from '../core/materials.js';
import { buildAnimal } from '../animals/models.js';
import { h } from '../ui/dom.js';

// POMPIER : éteindre les feux à la lance (maintenir clic / F / bouton 💦) et sauver les chats.
const RANGE = 16;
const TRASH = buildMergedGeometry((sb) => { sb.cyl(0, 0, 0, 0.45, 1.0, '#3d5a80', 12); sb.cyl(0, 1.0, 0, 0.5, 0.1, '#2b2d42', 12); });

class Fire {
  constructor(game, f, trash) {
    this.game = game;
    this.f = f;
    this.hp = f.hp;
    this.max = f.hp;
    this.g = new THREE.Group();
    this.g.position.set(f.x, f.y, f.z);
    const mk = (c, s) => { const m = new THREE.Mesh(new THREE.ConeGeometry(0.6 * s, 1.8 * s, 7), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9 })); m.position.y = 0.8 * s; return m; };
    this.flames = [mk('#ff5a1f', 1.3), mk('#ffb000', 0.95), mk('#fff3b0', 0.55)];
    this.flames.forEach((m, i) => { m.position.x = (i - 1) * 0.35; this.g.add(m); });
    if (trash) { const t = new THREE.Mesh(TRASH, actorMaterial); t.position.y = -1.0; this.g.add(t); this.g.position.y = 1.0; }
    game.engine.scene.add(this.g);
    this.bar = h('div.wlabel', '🔥 ', this.barText = h('span', '100 %'));
    this.label = game.labels.add(this.g, this.bar, 2.8, 40);
  }

  update(dt, t) {
    const k = Math.max(0.05, this.hp / this.max);
    this.flames.forEach((m, i) => { m.scale.set(k * (1 + Math.sin(t * 9 + i) * 0.12), k * (1 + Math.sin(t * 13 + i * 2) * 0.2), k); });
    if (this.hp > 0 && Math.random() < dt * 30) {
      const p = this.g.position;
      this.game.fx.emit({ x: p.x, y: p.y + 0.6 * k, z: p.z, n: 2, colors: ['#ff5a1f', '#ffb000', '#ffd23f'], speed: 2.2 * k, spread: 0.6, dir: { x: 0, y: 1, z: 0 }, gravity: -2, life: 0.6, size: 0.45 * k + 0.1, jitter: 0.8 * k });
      this.game.fx.emit({ x: p.x, y: p.y + 1.6 * k, z: p.z, n: 1, colors: ['#555555', '#777777', '#3a3a3a'], speed: 1.5, spread: 0.5, gravity: -1.5, life: 2, size: 0.6, grow: 0.5 });
    }
    this.barText.textContent = this.hp > 0 ? `${Math.ceil(k * 100)} %` : 'Éteint !';
  }

  dispose() { this.game.engine.scene.remove(this.g); this.game.labels.remove(this.label); }
}

export class FirefighterJob {
  constructor(game, mgr, job, mt, mission) {
    Object.assign(this, { game, mgr, job, mt, m: mission });
    this.fires = [];
    this.inter = [];
    this.beacon = new Beacon(game.engine.scene, '#ff5a5f');
    this.spraying = false;
    this.pending = new Set();
  }

  begin() {
    const g = this.game;
    if (this.m.fires) {
      this.fires = this.m.fires.map((f) => new Fire(g, f, this.mt.trash));
      g.ui.toast(`🚒 ${this.m.fires.length > 1 ? `${this.m.fires.length} incendies` : 'Incendie'} signalé${this.m.fires.length > 1 ? 's' : ''} : ${this.m.fires.map((f) => f.name).join(', ')}`, 'bad', 5000);
      g.ui.toast(g.input.isTouch ? 'Maintiens le bouton 💦 pour arroser.' : 'Maintiens le clic gauche (ou F) pour arroser.', '', 5000);
    }
    if (this.m.tree) {
      const t = this.m.tree;
      this.cat = buildAnimal('chat');
      this.cat.root.position.set(t.x + 0.6, 4.4, t.z);
      g.engine.scene.add(this.cat.root);
      this.catLabel = g.labels.bubble(this.cat.root, 'Miaou ?! (je suis coincé, mais digne)', 6000, '', 1.2);
      this.inter.push(g.interactions.add({ x: t.x, z: t.z, r: 3, priority: 4, label: '🐈 Grimper et sauver le chat', enabled: () => !this.climbing, action: () => this.climb() }));
    }
    this.refresh();
  }

  target() {
    if (this.m.tree) return { x: this.m.tree.x, z: this.m.tree.z, label: 'Chat coincé' };
    const f = this.fires.find((x) => x.hp > 0);
    return f ? { x: f.f.x, z: f.f.z, label: f.f.name } : null;
  }

  refresh() {
    const t = this.target();
    this.game.hud.compassTarget = t;
    if (t) this.beacon.at(t.x, 0, t.z);
    const left = this.fires.filter((f) => f.hp > 0).length;
    this.game.hud.track('job', {
      title: `🚒 ${this.mt.name}`,
      text: this.m.tree ? 'Va jusqu\'à l\'arbre et grimpe sauver le chat.' : `Feux restants : ${left}. Approche-toi à moins de ${RANGE} m et arrose !`,
      button: { label: 'Abandonner', onclick: () => this.mgr.cancel() },
    });
  }

  async climb() {
    const g = this.game;
    this.climbing = true;
    g.cutscene = true;
    g.player.setPose('wave', 2.6);
    g.ui.toast('Tu grimpes... doucement... ne regarde pas en bas.', '', 2500);
    await new Promise((r) => setTimeout(r, 2600));
    g.cutscene = false;
    try {
      const r = await g.net.request('job.step', { missionId: this.m.id, action: 'rescue' });
      g.sfx('meow');
      this.mgr.complete(r);
    } catch (e) { g.ui.toast(e.message, 'bad'); this.climbing = false; }
  }

  async putOut(fire) {
    if (this.pending.has(fire)) return;
    this.pending.add(fire);
    const g = this.game;
    try {
      const r = await g.net.request('job.step', { missionId: this.m.id, action: 'extinguish', fire: fire.f.i });
      fire.done = true;
      g.sfx('hiss');
      g.fx.emit({ x: fire.f.x, y: fire.f.y + 1, z: fire.f.z, n: 30, colors: ['#dddddd', '#ffffff', '#aaaaaa'], speed: 3, gravity: -1, life: 1.5, size: 0.6, grow: 0.6 });
      if (r.done) { this.mgr.complete(r); return; }
      g.ui.toast(`Feu éteint : ${fire.f.name} !`, 'good');
      this.refresh();
    } catch (e) {
      fire.hp = Math.max(fire.hp, 5); // l'autorité estime que le feu n'est pas encore éteint
    } finally { this.pending.delete(fire); }
  }

  update(dt, t) {
    const g = this.game, p = g.player;
    this.beacon.update(t);
    for (const f of this.fires) f.update(dt, t);
    if (this.cat) { this.cat.root.rotation.y = Math.sin(t) * 0.6; this.cat.head.rotation.y = Math.sin(t * 2) * 0.5; }
    // lance à incendie
    const want = !g.ui.blocking && (g.input.actionHeld || g.input.keys.has('KeyF')) && this.fires.length > 0;
    if (want !== this.spraying) { this.spraying = want; g.sound.loop('water', want); if (!want) p.setPose('idle'); }
    if (!this.spraying) return;
    p.pose = 'spray';
    // visée assistée : le feu actif le plus proche devant le joueur (ou à portée)
    let best = null, bd = RANGE;
    for (const f of this.fires) {
      if (f.hp <= 0) continue;
      const d = Math.hypot(f.f.x - p.pos.x, f.f.z - p.pos.z);
      if (d < bd) { bd = d; best = f; }
    }
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
    const origin = { x: p.pos.x + fx * 0.7, y: p.pos.y + 1.3, z: p.pos.z + fz * 0.7 };
    let dir;
    if (best) {
      p.yaw = Math.atan2(best.f.x - p.pos.x, best.f.z - p.pos.z);
      const dx = best.f.x - origin.x, dy = best.f.y + 0.8 - origin.y, dz = best.f.z - origin.z;
      const d = Math.hypot(dx, dz) || 1, T = 0.5 + d / 30;
      dir = { x: dx / T / 10, y: (dy + 0.5 * 9 * T * T) / T / 10, z: dz / T / 10 };
      best.hp -= this.m.rate * dt;
      if (best.hp <= 0 && !best.done) { best.hp = 0; this.putOut(best); }
    } else dir = { x: fx * 1.2, y: 0.5, z: fz * 1.2 };
    g.fx.emit({ x: origin.x, y: origin.y, z: origin.z, n: 3, colors: ['#4cc3e6', '#bfefff', '#2e9fd6'], speed: 10, spread: 0.08, dir, gravity: 9, life: 0.9, size: 0.22 });
    if (Math.random() < dt * 4) this.refresh();
  }

  end() {
    const g = this.game;
    for (const f of this.fires) f.dispose();
    for (const it of this.inter) g.interactions.remove(it);
    if (this.cat) { g.engine.scene.remove(this.cat.root); g.labels.remove(this.catLabel); }
    this.beacon.dispose();
    g.sound.loop('water', false);
    g.cutscene = false;
  }

  markers() {
    const t = this.target();
    return t ? [{ x: t.x, z: t.z, color: '#ff5a5f', icon: this.m.tree ? '🐈' : '🔥', r: 6 }] : [];
  }
}

