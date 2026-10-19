import * as THREE from 'three';
import { SPECIES } from '../../shared/content/animals.js';
import { groundHeight, isWater, WATER_LEVEL, POND } from '../../shared/world-layout.js';
import { mulberry32 } from '../../shared/rng.js';
import { buildAnimal } from './models.js';

// Animaux du monde : chaque espèce a son comportement (voir shared/content/animals.js).
// Ils bougent, réagissent au joueur, aux autres animaux et à l'heure (les loups hurlent la nuit).

const rand = mulberry32(777);
const R = (a, b) => a + rand() * (b - a);
const VIEW = 85;            // au-delà, l'animal n'est ni dessiné ni simulé
const PET_LINES = {
  chien: ['Le chien remue la queue si fort qu\'il en tourne sur lui-même.', 'Wouf ! (traduction : "encore !")'],
  chat: ['Le chat accepte la caresse. Pour cette fois.', 'Le chat vous fixe. Vous avez été évalué.'],
  pigeon: ['Le pigeon recule, offusqué.'], poulet: ['Cot cot ?! (le poulet panique poliment)'],
  vache: ['Meuuuh. (elle apprécie)'], cochon: ['Groin groin ! (il se roule de joie)'], mouton: ['Bêêê. C\'est tout doux.'],
  cheval: ['Le cheval hennit et secoue sa crinière comme dans une pub pour shampoing.'],
  lapin: ['Le lapin remue le nez à 300 km/h.'], rat: ['Le rat vous serre la main. Si, si.'],
  tortue: ['La tortue rentre la tête. Elle ressortira mardi.'], canard: ['Coin ! (merci)'],
  ours: ['L\'ours fait un câlin d\'ours. Vous survivez.'], loup: ['Le loup recule. Respect mutuel.'],
  renard: ['Le renard file comme une flèche.'], serpent: ['Sssss... (il ronronne à sa façon)'],
  corbeau: ['Le corbeau vous offre une capsule de bouteille.'], aigle: ['...'], requin: ['Le requin voulait juste un câlin.'],
  crocodile: ['CLAC ! Le crocodile n\'est pas d\'humeur.'],
};
const SOUNDS = { chien: 'bark', chat: 'meow', poulet: 'cluck', canard: 'quack', vache: 'moo', pigeon: 'cluck' };

class Animal {
  constructor(mgr, species, x, z, idx) {
    this.mgr = mgr;
    this.species = species;
    this.def = SPECIES[species];
    this.idx = idx;
    this.model = buildAnimal(species);
    this.root = this.model.root;
    mgr.scene.add(this.root);
    if (this.model.segs.length) for (const s of this.model.segs) mgr.scene.add(s);
    this.pos = new THREE.Vector3(x, 0, z);
    this.yaw = rand() * Math.PI * 2;
    this.state = 'idle';
    this.timer = R(0, 3);
    this.target = null;
    this.phase = rand() * 10;
    this.speed = 0;
    this.alt = 0;          // altitude (oiseaux)
    this.cooldown = 0;
    this.trail = [];
    const a = this.def.area;
    this.area = a;
    this.circle = { x: (a[0] + a[2]) / 2, z: (a[1] + a[3]) / 2, r: R(10, 22), a: rand() * 6.28 };
    if (this.def.behavior === 'fly') this.alt = this.def.high ? 38 : R(12, 20);
    this.place();
  }

  randomPoint() {
    const a = this.area;
    for (let i = 0; i < 12; i++) {
      const x = R(a[0] + 1, a[2] - 1), z = R(a[1] + 1, a[3] - 1);
      if (this.def.water ? isWater(x, z) && (!this.def.deep || groundHeight(x, z) < -2) : !isWater(x, z) && !this.mgr.game.collision.pointBlocked(x, 0.4, z, 0.4)) return { x, z };
    }
    return { x: this.pos.x, z: this.pos.z };
  }

  place() {
    const p = this.randomPoint();
    this.pos.x = p.x; this.pos.z = p.z;
    if (this.species === 'crocodile') { this.pos.set(POND.x + POND.r + 1.2, 0, POND.z - 2); this.yaw = -Math.PI / 2; }
  }

  goTo(p, speedMul = 1) { this.target = p; this.state = 'walk'; this.speedMul = speedMul; this.stuck = 0; }

  update(dt, t, ctx) {
    const def = this.def, P = ctx.player;
    const dx = P.x - this.pos.x, dz = P.z - this.pos.z;
    const dPlayer = Math.hypot(dx, dz);
    this.cooldown -= dt;
    this.timer -= dt;
    const b = def.behavior;
    let moving = false;

    // ---- réactions au joueur (et au monde)
    if (b === 'flock') return this.updatePigeon(dt, t, ctx, dPlayer);
    if (b === 'fly') return this.updateFlyer(dt, t);
    if (def.flee && dPlayer < def.flee && this.state !== 'flee' && ctx.playerZone === 'world') {
      const k = 8 / (dPlayer || 1);
      this.goTo({ x: this.pos.x - dx * k, z: this.pos.z - dz * k }, b === 'flee' ? 2.4 : 1.8);
      this.state = 'flee';
      if (this.species === 'poulet' && this.cooldown < 0) { this.mgr.sound('cluck', dPlayer); this.cooldown = 2; }
    }
    if (this.species === 'chien' && this.state !== 'greet' && dPlayer < 7 && this.cooldown < 0 && ctx.playerZone === 'world') {
      this.state = 'greet'; this.timer = 5; this.cooldown = 25;
      this.mgr.sound('bark', dPlayer);
      this.mgr.bubble(this, 'Wouf ! Wouf !');
    }
    if (this.species === 'chien' && this.state !== 'greet' && this.state !== 'chase' && this.cooldown < 10) {
      const pg = this.mgr.find('pigeon', this.pos, 9, (a) => a.alt < 0.5);
      if (pg && rand() < 0.01) { this.state = 'chase'; this.prey = pg; this.timer = 4; }
    }
    if (this.species === 'crocodile' && dPlayer < 3.6 && this.cooldown < 0 && ctx.playerZone === 'world' && P.y < 1.5) {
      this.cooldown = 3; this.snap = 0.6;
      this.mgr.sound('splat', dPlayer);
      this.mgr.bubble(this, 'CLAC !');
      this.mgr.game.player.vel.x += (dx / (dPlayer || 1)) * 14;
      this.mgr.game.player.vel.z += (dz / (dPlayer || 1)) * 14;
      this.mgr.game.player.vel.y = 6;
      this.mgr.game.player.grounded = false;
    }
    if (this.species === 'ours' && dPlayer < 5 && this.cooldown < 0) { this.cooldown = 12; this.stand = 2.5; this.mgr.bubble(this, 'Grmmmbl.'); }
    if (this.species === 'loup' && ctx.night > 0.6 && this.idx === 0 && this.cooldown < 0 && rand() < 0.004) { this.cooldown = 25; this.howl = 2.5; this.mgr.bubble(this, 'Aouuuuh !'); }
    if (this.species === 'requin' && this.state === 'circle' && !(ctx.playerSwimming && dPlayer < 18)) { this.state = 'idle'; this.timer = 1; }
    if (this.species === 'requin' && ctx.playerSwimming && dPlayer < 18) {
      this.state = 'circle';
      this.circleA = (this.circleA ?? 0) + dt * 0.7;
      this.target = { x: P.x + Math.cos(this.circleA) * 4.5, z: P.z + Math.sin(this.circleA) * 4.5 };
      if (this.cooldown < 0) { this.cooldown = 15; this.mgr.bubble(this, 'Le requin veut juste un câlin.', 0.6); }
    }

    // ---- états
    if (this.state === 'greet') {
      if (dPlayer > 1.8) { this.target = { x: P.x, z: P.z }; moving = this.moveTo(dt, def.speed * 1.6); } else this.faceTo(P.x, P.z, dt);
      if (this.timer < 0 || dPlayer > 15) { this.state = 'idle'; this.timer = 2; }
    } else if (this.state === 'chase') {
      if (this.prey) { this.target = { x: this.prey.pos.x, z: this.prey.pos.z }; moving = this.moveTo(dt, def.speed * 1.8); }
      if (this.timer < 0) { this.state = 'idle'; this.timer = 3; }
    } else if (this.state === 'walk' || this.state === 'flee' || this.state === 'circle') {
      moving = this.moveTo(dt, def.speed * (this.speedMul || 1));
      if (!moving && this.state !== 'circle') { this.state = 'idle'; this.timer = b === 'graze' ? R(4, 10) : b === 'peck' ? R(1, 3) : R(2, 6); }
    } else if (this.state === 'idle' && this.timer < 0) {
      const leader = b === 'prowl' && this.idx > 0 ? this.mgr.find('loup', this.pos, 200, (x) => x.idx === 0) : null;
      if (b === 'bask' && rand() < 0.6) { this.timer = R(5, 12); } else if (leader) this.goTo({ x: leader.pos.x + R(-3, 3), z: leader.pos.z + R(-3, 3) }, 1.3);
      else this.goTo(this.randomPoint(), 1);
    }
    if (this.prey && this.prey.alt > 0.5) this.prey = null;

    // ---- position verticale
    if (def.water) {
      const sea = this.species === 'requin';
      const g = groundHeight(this.pos.x, this.pos.z);
      if (isWater(this.pos.x, this.pos.z)) this.pos.y = sea ? WATER_LEVEL - 0.45 + Math.sin(t * 1.3 + this.idx) * 0.08 : WATER_LEVEL - (this.species === 'crocodile' ? 0.35 : 0.02) + Math.sin(t * 2 + this.idx) * 0.03;
      else this.pos.y = g;
    } else this.pos.y = groundHeight(this.pos.x, this.pos.z);

    this.animate(dt, t, moving, dPlayer);
  }

  moveTo(dt, speed) {
    const tg = this.target;
    if (!tg) return false;
    const dx = tg.x - this.pos.x, dz = tg.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.4) return false;
    const a = this.area;
    const want = Math.atan2(dx, dz);
    let diff = Math.atan2(Math.sin(want - this.yaw), Math.cos(want - this.yaw));
    this.yaw += diff * Math.min(1, dt * 6);
    const step = Math.min(d, speed * dt);
    const nx = this.pos.x + Math.sin(this.yaw) * step, nz = this.pos.z + Math.cos(this.yaw) * step;
    // reste dans son habitat (et dans l'eau pour les nageurs)
    if (this.def.water && !isWater(nx, nz) && this.species !== 'crocodile') { this.target = this.randomPoint(); return false; }
    if (!this.def.water && isWater(nx, nz)) { this.target = this.randomPoint(); return false; }
    const before = { x: this.pos.x, z: this.pos.z };
    this.pos.x = Math.max(a[0] - 4, Math.min(a[2] + 4, nx));
    this.pos.z = Math.max(a[1] - 4, Math.min(a[3] + 4, nz));
    if (!this.def.water) this.mgr.game.collision.pushOut(this.pos, 0.35, 0.8, 0.3);
    const moved = Math.hypot(this.pos.x - before.x, this.pos.z - before.z);
    this.stuck = moved < step * 0.3 ? (this.stuck || 0) + dt : 0;
    if (this.stuck > 1) { this.target = this.randomPoint(); this.stuck = 0; }
    this.speed = moved / dt;
    return true;
  }

  faceTo(x, z, dt) {
    const want = Math.atan2(x - this.pos.x, z - this.pos.z);
    this.yaw += Math.atan2(Math.sin(want - this.yaw), Math.cos(want - this.yaw)) * Math.min(1, dt * 5);
  }

  // Pigeons : picorent au sol, s'envolent tous ensemble si on approche (ou si un chien arrive).
  updatePigeon(dt, t, ctx, dPlayer) {
    const dog = this.mgr.find('chien', this.pos, 3.5);
    if (this.alt < 0.5 && (dPlayer < this.def.flee || dog || this.mgr.carNear(this.pos, 4)) && this.state !== 'fly') {
      this.mgr.scare(this.pos, 7);
    }
    if (this.state === 'fly') {
      this.flyT += dt;
      this.circle.a += dt * 1.6;
      const up = Math.min(1, this.flyT / 1.5), down = this.flyT > this.flyDur ? Math.max(0, 1 - (this.flyT - this.flyDur) / 2) : 1;
      this.alt = 9 * up * down;
      const tx = this.land.x + Math.cos(this.circle.a) * 6 * down, tz = this.land.z + Math.sin(this.circle.a) * 6 * down;
      const nx = this.pos.x + (tx - this.pos.x) * Math.min(1, dt * 1.8), nz = this.pos.z + (tz - this.pos.z) * Math.min(1, dt * 1.8);
      this.yaw = Math.atan2(nx - this.pos.x, nz - this.pos.z) || this.yaw;
      this.pos.x = nx; this.pos.z = nz;
      if (this.flyT > this.flyDur + 2) { this.state = 'idle'; this.alt = 0; this.timer = R(1, 3); }
    } else {
      if (this.state === 'walk') { if (!this.moveTo(dt, this.def.speed)) { this.state = 'idle'; this.timer = R(1, 3); } } else if (this.timer < 0) {
        this.goTo({ x: this.pos.x + R(-3, 3), z: this.pos.z + R(-3, 3) });
      }
    }
    this.pos.y = groundHeight(this.pos.x, this.pos.z) + this.alt;
    this.animate(dt, t, this.state === 'walk', dPlayer);
  }

  takeOff() {
    if (this.state === 'fly') return;
    this.state = 'fly'; this.flyT = 0; this.flyDur = R(4, 7); this.land = this.randomPoint(); this.circle.a = rand() * 6.28;
  }

  // Aigles et corbeaux : tournent dans le ciel.
  updateFlyer(dt, t) {
    const c = this.circle;
    c.a += dt * (this.def.speed / c.r);
    c.x += Math.sin(t * 0.05 + this.idx) * dt * 2;
    c.z += Math.cos(t * 0.04 + this.idx * 2) * dt * 2;
    const a = this.area;
    c.x = Math.max(a[0] + c.r, Math.min(a[2] - c.r, c.x)); c.z = Math.max(a[1] + c.r, Math.min(a[3] - c.r, c.z));
    const nx = c.x + Math.cos(c.a) * c.r, nz = c.z + Math.sin(c.a) * c.r;
    this.yaw = Math.atan2(nx - this.pos.x, nz - this.pos.z);
    this.pos.set(nx, this.alt + Math.sin(t * 0.5 + this.idx) * 1.5, nz);
    this.animate(dt, t, true, 999);
  }

  animate(dt, t, moving, dPlayer) {
    const m = this.model;
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
    const sp = moving ? Math.max(1, this.speed) : 0;
    this.phase += dt * (moving ? 4 + sp * 2.2 : 0);
    const ph = this.phase;
    for (let i = 0; i < m.legs.length; i++) {
      const s = i === 0 || i === 3 ? 1 : -1;
      m.legs[i].rotation.x = moving ? Math.sin(ph) * 0.6 * s : m.legs[i].rotation.x * 0.8;
    }
    const b = this.def.behavior;
    // petits animaux : ils sautillent
    if (!m.legs.length && m.body && moving && !m.wings.length) this.root.position.y += Math.abs(Math.sin(ph * 0.8)) * (this.species === 'lapin' ? 0.3 : 0.06);
    if (m.head && m.headBase) {
      let hx = 0, hy = 0, dy = 0;
      if (!moving && b === 'graze') { hx = 0.9; dy = -0.35 * (m.height || 1); }
      if (!moving && (b === 'peck' || this.species === 'pigeon')) { const pk = Math.max(0, Math.sin(t * 7 + this.idx * 3)); hx = pk * 0.9; dy = -pk * 0.08; }
      if (!moving && b !== 'graze') hy = Math.sin(t * 0.7 + this.idx) * 0.5;
      if (this.species === 'canard' && !moving) { const dip = Math.sin(t * 0.8 + this.idx) > 0.85; hx = dip ? 1.4 : 0; }
      if (this.howl > 0) { this.howl -= dt; hx = -0.9; }
      if (this.species === 'tortue') { const hide = dPlayer < 2.2 ? 0 : 1; m.head.scale.setScalar(m.head.scale.x + (hide - m.head.scale.x) * Math.min(1, dt * 6)); }
      m.head.rotation.x += (hx - m.head.rotation.x) * Math.min(1, dt * 8);
      m.head.rotation.y += (hy - m.head.rotation.y) * Math.min(1, dt * 3);
      m.head.position.y = m.headBase.y + dy;
    }
    if (m.jaw) {
      this.snap = Math.max(0, (this.snap || 0) - dt);
      const open = this.snap > 0 ? 0.7 : Math.max(0, Math.sin(t * 0.6)) * 0.12;
      m.jaw.rotation.x = open;
      if (this.snap > 0) this.root.position.add(new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)).multiplyScalar(this.snap * 0.6));
    }
    if (m.wings.length) {
      const flying = this.alt > 0.5 || b === 'fly';
      // au repos les ailes sont repliées le long du corps ; en vol elles battent
      const f = flying ? (this.species === 'aigle' ? Math.sin(t * 3) * 0.25 + 0.1 : Math.sin(t * 18 + this.idx) * 0.9)
        : this.species === 'poulet' && this.state === 'flee' ? 0.6 + Math.sin(t * 20) * 0.5 : 1.3;
      m.wings[0].rotation.z = -f; m.wings[1].rotation.z = f;
      if (this.species === 'poulet' && moving) this.root.position.y += Math.abs(Math.sin(ph)) * 0.08;
    }
    if (this.stand > 0) { this.stand -= dt; this.root.rotation.x = -0.9 * Math.min(1, this.stand); } else this.root.rotation.x = 0;
    if (this.species === 'requin') this.root.rotation.z = Math.sin(t * 2) * 0.08;
    // serpent : les anneaux suivent la trace de la tête en ondulant
    if (m.segs.length) {
      this.trail.unshift({ x: this.pos.x, z: this.pos.z });
      if (this.trail.length > 90) this.trail.pop();
      for (let i = 0; i < m.segs.length; i++) {
        const p = this.trail[Math.min(this.trail.length - 1, i * 4)] || this.pos;
        const n = this.trail[Math.min(this.trail.length - 1, i * 4 + 2)] || p;
        const ang = Math.atan2(p.x - n.x, p.z - n.z) || this.yaw;
        const side = Math.sin(t * 6 - i * 0.9) * 0.12 * (moving ? 1 : 0.3);
        m.segs[i].position.set(p.x + Math.cos(ang) * side, groundHeight(p.x, p.z), p.z - Math.sin(ang) * side);
        m.segs[i].rotation.y = ang;
      }
      this.root.visible = false;
    }
  }

  setVisible(v) {
    this.root.visible = v && !this.model.segs.length;
    for (const s of this.model.segs) s.visible = v;
  }
}

export class Animals {
  constructor(game) {
    this.game = game;
    this.scene = game.engine.scene;
    this.list = [];
    for (const [sp, def] of Object.entries(SPECIES)) {
      for (let i = 0; i < def.count; i++) {
        const a = def.area;
        // les loups restent groupés
        const x = sp === 'loup' ? (a[0] + a[2]) / 2 + i * 1.5 : R(a[0], a[2]);
        const z = sp === 'loup' ? (a[1] + a[3]) / 2 : R(a[1], a[3]);
        this.list.push(new Animal(this, sp, x, z, i));
      }
    }
    this.nearest = null;
    game.interactions.add({
      r: 2.6, priority: -1,
      x: () => this.nearest?.pos.x ?? 1e9, z: () => this.nearest?.pos.z ?? 1e9,
      enabled: () => !!this.nearest,
      label: () => `Caresser : ${this.nearest?.def.name.toLowerCase()}`,
      action: () => this.pet(this.nearest),
    });
  }

  find(species, pos, r, filter) {
    for (const a of this.list) if (a.species === species && Math.hypot(a.pos.x - pos.x, a.pos.z - pos.z) < r && (!filter || filter(a))) return a;
    return null;
  }

  scare(pos, r) {
    for (const a of this.list) if (a.def.behavior === 'flock' && Math.hypot(a.pos.x - pos.x, a.pos.z - pos.z) < r) a.takeOff();
  }

  carNear(pos, r) { return this.game.traffic?.near(pos, r) ?? false; }

  sound(name, dist) { if (dist < 25) this.game.sfx(name); }

  bubble(a, text, offset = 0.6) {
    this.game.labels.bubble(a.root.visible ? a.root : (a.model.segs[0] || a.root), text, 2500, '', (a.model.height || 1) + offset);
  }

  pet(a) {
    if (!a) return;
    const lines = PET_LINES[a.species] || ['...'];
    this.bubble(a, lines[Math.floor(rand() * lines.length)]);
    if (SOUNDS[a.species]) this.game.sfx(SOUNDS[a.species]);
    this.game.player.setPose('pet', 1.2);
    if (a.species === 'crocodile') { a.cooldown = -1; }
    if (a.def.flee || a.species === 'poulet' || a.species === 'renard') { a.state = 'idle'; a.timer = -1; a.def.flee && a.goTo(a.randomPoint(), 2); }
    if (a.species === 'chien') { a.state = 'greet'; a.timer = 6; }
    if (a.def.behavior === 'flock') this.scare(a.pos, 6);
  }

  update(dt, t) {
    const g = this.game;
    const P = g.player.pos;
    const inWorld = g.player.zone === 'world';
    const ctx = { player: P, playerZone: g.player.zone, playerSwimming: g.player.swimming, night: g.world.dayNight.night };
    let best = null, bd = 2.6;
    for (const a of this.list) {
      const d = Math.hypot(a.pos.x - P.x, a.pos.z - P.z);
      const flyer = a.def.behavior === 'fly';
      const vis = inWorld && (d < VIEW || flyer);
      a.setVisible(vis);
      if (!vis) continue;
      a.update(dt, t, ctx);
      if (d < bd && a.alt < 0.5 && !flyer && a.species !== 'requin') { bd = d; best = a; }
    }
    this.nearest = best;
  }
}
