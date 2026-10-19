import * as THREE from 'three';
import { h, clear } from '../ui/dom.js';
import { INGREDIENTS } from '../../shared/content/jobs.js';
import { Avatar } from '../characters/avatar.js';
import { randomAppearance } from '../ui/creator.js';
import { buildMergedGeometry } from '../core/static-builder.js';
import { actorMaterial } from '../core/materials.js';
import { POI } from '../../shared/world-layout.js';

// CUISINIER : les clients font la queue au camion ; empile les ingrédients dans le bon ordre
// (de bas en haut) avant que leur patience s'épuise. Le burger se construit en 3D sur le comptoir.
const KEYS = ['pain-bas', 'pain-haut', 'steak', 'fromage', 'salade', 'tomate', 'oignon', 'cornichon', 'confiture', 'chamallow'];
const KEYLABEL = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const THICK = { 'pain-bas': 0.12, 'pain-haut': 0.16, steak: 0.1, fromage: 0.03, salade: 0.04, tomate: 0.05, oignon: 0.03, cornichon: 0.03, confiture: 0.04, chamallow: 0.08 };
const LAYER_GEO = Object.fromEntries(KEYS.map((k) => [k, buildMergedGeometry((sb) => {
  const c = INGREDIENTS[k].color, t = THICK[k];
  if (k === 'pain-haut') sb.sphere(0, 0, 0, 0.36, c, 12, undefined, 0.45);
  else if (k === 'cornichon' || k === 'tomate' || k === 'oignon') for (let i = 0; i < 3; i++) sb.cyl(-0.15 + i * 0.15, 0, (i % 2) * 0.08 - 0.04, 0.11, t, c, 10);
  else sb.cyl(0, 0, 0, k === 'fromage' || k === 'salade' ? 0.4 : 0.36, t, c, 14);
})]));
const ORDER_LINES = ['Un burger, s\'il vous plaît ! Et vite, j\'ai un rendez-vous avec mon canapé.', 'Je voudrais ça. Exactement ça. Je vérifierai.', 'Mon médecin m\'a dit de manger équilibré. Donc un burger de chaque côté.', 'C\'est pour mon chien. Enfin, pour moi. Mais il regardera.'];
const CRITIC_LINES = ['Je suis critique gastronomique. Surprenez-moi... mais respectez la recette.', 'La confiture dans un burger, c\'est l\'avenir. Prouvez-le.'];
const HAPPY = ['Délicieux ! Je reviendrai !', 'Magnifique. J\'en pleure.', '5 étoiles. Sur 3.'];
const ANGRY = ['C\'est quoi ÇA ?!', 'J\'avais pas demandé ça !', 'Mon chien n\'en voudrait pas.'];
const LEFT = ['Je pars ! Je vais chez le concurrent... ah, y en a pas.', 'Trop long ! Je mange mon chapeau.'];

export class CookJob {
  constructor(game, mgr, job, mt, mission) {
    Object.assign(this, { game, mgr, job, mt, m: mission });
    this.stack = [];
    this.layers = [];
    this.customers = [];
    this.busy = false;
  }

  begin() {
    const g = this.game;
    g.player.teleport(POI.foodCounter.x + 1.1, POI.foodCounter.z, Math.PI / 2);
    g.player.yaw = Math.PI / 2;
    g.cutscene = true;
    g.cam.override = { pos: new THREE.Vector3(-7.6, 3.4, 18.4), look: new THREE.Vector3(-10.6, 1.4, 12.8) };
    this.burger = new THREE.Group();
    this.burger.position.set(POI.foodCounter.x - 0.1, 1.76, POI.foodCounter.z);
    g.engine.scene.add(this.burger);
    this.buildPanel();
    this.offKey = g.input.on('key', (e) => this.onKey(e));
    this.spawnCustomer();
    this.orderStart = performance.now();
    this.render();
  }

  buildPanel() {
    const g = this.game;
    this.panel = h('div.cook');
    this.orderEl = h('div.order');
    this.stackEl = h('div.stack');
    this.infoEl = h('span.muted');
    const ingr = h('div.ingr', KEYS.map((k, i) => {
      if (!this.mt.absurd && (k === 'confiture' || k === 'chamallow')) return null;
      return h('button', { onclick: () => this.add(k), title: INGREDIENTS[k].name }, h('span', INGREDIENTS[k].emoji), INGREDIENTS[k].name.replace(' (dessous)', ' ⬇').replace(' (dessus)', ' ⬆'), g.input.isTouch ? null : h('small', `touche ${KEYLABEL[i]}`));
    }));
    this.panel.append(this.orderEl, h('div.right', this.stackEl, ingr, h('div.actions', this.infoEl, h('span.spacer'),
      h('button.btn.small.ghost', { onclick: () => this.undo() }, '↶ Retirer'),
      h('button.btn.small.ghost', { onclick: () => this.clearStack() }, '🗑️ Jeter'),
      h('button.btn.coral', { onclick: () => this.serve() }, '🛎️ Servir'),
      h('button.btn.small.ghost', { onclick: () => this.mgr.cancel() }, 'Quitter'))));
    g.ui.root.append(this.panel);
  }

  onKey(e) {
    if (e.code === 'Enter') { this.serve(); return; }
    if (e.code === 'Backspace') { this.undo(); return; }
    const m = /^Digit(\d)$/.exec(e.code);
    if (m) { const i = (+m[1] + 9) % 10; if (KEYS[i] && (this.mt.absurd || i < 8)) this.add(KEYS[i]); }
  }

  get order() { return this.m.orders[this.m.current]; }

  add(k) {
    if (this.busy || this.stack.length >= 10) return;
    this.stack.push(k);
    const y = this.layers.reduce((s, l) => s + THICK[l.userData.k], 0);
    const mesh = new THREE.Mesh(LAYER_GEO[k], actorMaterial);
    mesh.userData.k = k;
    mesh.position.y = y + 0.4;
    mesh.userData.targetY = y;
    this.burger.add(mesh);
    this.layers.push(mesh);
    this.game.sfx('pop');
    this.game.player.setPose('cook', 0.4);
    this.render();
  }

  undo() { if (this.busy || !this.stack.length) return; this.stack.pop(); this.burger.remove(this.layers.pop()); this.render(); }
  clearStack() { if (this.busy) return; this.stack = []; for (const l of this.layers) this.burger.remove(l); this.layers = []; this.render(); }

  spawnCustomer() {
    const g = this.game;
    const o = this.order;
    if (!o) return;
    const av = new Avatar(randomAppearance());
    av.root.position.set(-3, 0, 13 + (Math.random() - 0.5));
    av.root.rotation.y = -Math.PI / 2;
    g.engine.scene.add(av.root);
    const c = { av, state: 'come', x: -3, leaveDir: 1 };
    this.customers.push(c);
    this.cur = c;
    const line = this.mt.absurd ? CRITIC_LINES[Math.floor(Math.random() * CRITIC_LINES.length)] : ORDER_LINES[Math.floor(Math.random() * ORDER_LINES.length)];
    setTimeout(() => g.labels.bubble(av.root, `${o.customer} : « ${line} »`, 4000), 900);
  }

  async serve() {
    if (this.busy || !this.order) return;
    this.busy = true;
    await this.sendResult('serve');
  }

  async sendResult(action) {
    const g = this.game;
    try {
      const r = await g.net.request('job.step', { missionId: this.m.id, action, order: this.m.current, stack: this.stack });
      const res = r.result;
      const c = this.cur;
      if (c) {
        const txt = res.ok ? `${HAPPY[Math.floor(Math.random() * HAPPY.length)]}${res.tip ? ` (+${res.tip} % de pourboire)` : ''}` : res.reason === 'parti' ? LEFT[Math.floor(Math.random() * LEFT.length)] : ANGRY[Math.floor(Math.random() * ANGRY.length)];
        g.labels.bubble(c.av.root, txt, 2600);
        c.state = 'leave';
        c.pose = res.ok ? 'celebrate' : 'wave';
      }
      if (res.ok) { g.sfx('coin'); const s = g.toScreen(g.player.pos, 2.4); if (s) g.ui.floater(`+${res.pay} PC`, s.x, s.y); } else g.sfx('error');
      if (r.done) { this.mgr.complete(r); return; }
      this.m = r.mission;
      this.clearStackForce();
      this.orderStart = performance.now();
      setTimeout(() => this.spawnCustomer(), 600);
    } catch (e) { g.ui.toast(e.message, 'bad'); } finally { this.busy = false; this.render(); }
  }

  clearStackForce() { this.stack = []; for (const l of this.layers) this.burger.remove(l); this.layers = []; }

  render() {
    const o = this.order;
    clear(this.orderEl);
    if (!o) return;
    this.orderEl.append(h('h4', `Commande ${this.m.current + 1}/${this.m.orders.length}`), h('div.who', `🧑 ${o.customer}`));
    const rec = h('div.recipe', o.recipe.map((k, i) => {
      const st = this.stack[i];
      return h(`span${st === undefined ? '' : st === k ? '.ok' : '.bad'}`, `${INGREDIENTS[k].emoji} ${INGREDIENTS[k].name}`);
    }));
    this.patience = h('div.patience', h('div'));
    this.orderEl.append(h('div.who', 'Recette (de bas en haut) :'), rec, this.patience);
    clear(this.stackEl);
    if (!this.stack.length) this.stackEl.append(h('span.hint', 'Ton burger : clique les ingrédients dans l\'ordre, en commençant par le bas.'));
    else this.stackEl.append(...this.stack.map((k) => INGREDIENTS[k].emoji));
    this.infoEl.textContent = `Gagné : ${this.m.earned || 0} PC`;
  }

  update(dt, t) {
    const g = this.game;
    // animation des couches qui tombent sur la pile
    for (const l of this.layers) l.position.y += (l.userData.targetY - l.position.y) * Math.min(1, dt * 14);
    // clients
    for (const c of this.customers) {
      if (c.state === 'come') { c.x = Math.max(-8.4, c.x - dt * 2.5); if (c.x <= -8.4) c.state = 'wait'; }
      if (c.state === 'leave') { c.x += dt * 2.8; c.av.root.rotation.y = Math.PI / 2; if (c.x > 2) { g.engine.scene.remove(c.av.root); c.state = 'gone'; } }
      c.av.root.position.x = c.x;
      c.av.update(dt, { speed: c.state === 'come' || c.state === 'leave' ? 2.6 : 0, grounded: true, pose: c.state === 'leave' ? c.pose : 'idle' });
    }
    this.customers = this.customers.filter((c) => c.state !== 'gone');
    // patience
    if (this.patience && this.order) {
      const el = (performance.now() - this.orderStart) / 1000;
      const k = Math.max(0, 1 - el / this.m.patience);
      this.patience.firstChild.style.width = `${k * 100}%`;
      if (k <= 0 && !this.busy) { this.busy = true; this.sendResult('timeout'); }
    }
  }

  end() {
    const g = this.game;
    this.offKey?.();
    this.panel?.remove();
    g.engine.scene.remove(this.burger);
    for (const c of this.customers) g.engine.scene.remove(c.av.root);
    g.cutscene = false;
    g.cam.override = null;
    g.player.setPose('idle');
  }

  markers() { return [{ x: POI.foodTruck.x, z: POI.foodTruck.z, color: '#ff9f1c', icon: '🍔', r: 6 }]; }
}
