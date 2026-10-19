import * as THREE from 'three';
import { Animal } from './animals.js';
import { addCollar } from './models.js';
import { groundHeight, isWater, WATER_LEVEL } from '../../shared/world-layout.js';
import { SPECIES, TRICKS, petStatus } from '../../shared/content/animals.js';
import { COLORS } from '../../shared/appearance.js';
import { h } from '../ui/dom.js';

// ANIMAUX DE COMPAGNIE : l'animal actif suit son maître, fait ses tours, réclame à manger.
// La même classe sert pour les animaux des autres joueurs en ligne.
const TRICK_NAME = Object.fromEntries(TRICKS.map((t) => [t.id, t.name]));

export class PetFollower {
  constructor(game, pet, isMine) {
    this.game = game;
    this.pet = pet;
    this.isMine = isMine;
    const mgr = { game, scene: game.engine.scene, find: () => null, carNear: () => false, sound: () => {}, bubble: () => {} };
    this.anim = new Animal(mgr, pet.species, game.player.pos.x, game.player.pos.z, 0);
    this.anim.def = { ...SPECIES[pet.species], flee: 0 };
    this.collar = addCollar(this.anim.model, pet.collar);
    this.label = game.labels.add(this.anim.model.segs[0] || this.anim.root, h('div.wlabel', `🐾 ${pet.name}`), (this.anim.model.height || 0.6) + 0.5, 16);
    this.trick = null;
    this.nextTrick = 10 + Math.random() * 10;
    this.hungryCd = 20;
  }

  dispose() {
    const scene = this.game.engine.scene;
    scene.remove(this.anim.root);
    for (const s of this.anim.model.segs) scene.remove(s);
    this.game.labels.remove(this.label);
  }

  doTrick(id) { this.trick = { id, t: 0 }; this.game.labels.bubble(this.anim.root.visible ? this.anim.root : this.anim.model.segs[0], `${this.pet.name} : « ${TRICK_NAME[id]} » ✨`, 2200, '', (this.anim.model.height || 0.6) + 0.9); }

  // owner = { pos, yaw, speed, zone }
  update(dt, t, owner, visible) {
    const a = this.anim, p = a.pos;
    const vis = visible;
    a.setVisible(vis);
    if (!vis) return;
    const fx = Math.sin(owner.yaw), fz = Math.cos(owner.yaw), rx = Math.cos(owner.yaw), rz = -Math.sin(owner.yaw);
    const inHome = owner.zone.startsWith('home');
    let moving = false;
    if (this.pet.species === 'corbeau') {
      // perché sur l'épaule
      p.set(owner.pos.x - rx * 0.38, owner.pos.y + 1.62, owner.pos.z - rz * 0.38);
      a.yaw = owner.yaw;
      a.alt = 0;
    } else {
      const tx = owner.pos.x - fx * 1.6 - rx * 0.9, tz = owner.pos.z - fz * 1.6 - rz * 0.9;
      const d = Math.hypot(tx - p.x, tz - p.z);
      if (d > 18) { p.x = tx; p.z = tz; } else if (d > 0.6 && !(this.trick && this.trick.id !== 'tourne')) {
        const speed = Math.min(12, Math.max(a.def.speed * 1.6, owner.speed * 1.2, 2));
        const want = Math.atan2(tx - p.x, tz - p.z);
        a.yaw += Math.atan2(Math.sin(want - a.yaw), Math.cos(want - a.yaw)) * Math.min(1, dt * 8);
        const step = Math.min(d, speed * dt);
        p.x += Math.sin(a.yaw) * step; p.z += Math.cos(a.yaw) * step;
        a.speed = speed;
        moving = true;
      }
      if (inHome) p.y = 0.02;
      else if (isWater(p.x, p.z)) p.y = WATER_LEVEL - 0.1;
      else p.y = Math.max(groundHeight(p.x, p.z), owner.pos.y > 0.3 && Math.hypot(owner.pos.x - p.x, owner.pos.z - p.z) < 2.5 ? owner.pos.y : 0);
    }
    a.state = moving ? 'walk' : 'idle';
    a.animate(dt, t, moving, 99);
    // tours de dressage
    if (!moving && this.pet.tricks?.length && this.pet.species !== 'corbeau') {
      this.nextTrick -= dt;
      if (this.nextTrick < 0 && !this.trick) { this.nextTrick = 14 + Math.random() * 14; this.doTrick(this.pet.tricks[Math.floor(Math.random() * this.pet.tricks.length)]); }
    }
    if (this.trick) {
      const tr = this.trick;
      tr.t += dt;
      const r = a.root;
      if (tr.id === 'assis') { r.rotation.x = -0.45; r.position.y -= 0.05; }
      if (tr.id === 'saute') r.position.y += Math.abs(Math.sin(tr.t * 6)) * 0.8;
      if (tr.id === 'tourne') { a.yaw += dt * 9; r.rotation.y = a.yaw; }
      if (tr.id === 'mort') r.rotation.z = (Math.PI / 2) * Math.min(1, tr.t * 4);
      if (tr.t > 2.2) { this.trick = null; r.rotation.x = 0; r.rotation.z = 0; }
    }
    if (this.isMine) {
      this.hungryCd -= dt;
      if (this.hungryCd < 0) {
        this.hungryCd = 40;
        const st = petStatus(this.pet, this.game.now());
        if (st.food < 25) this.game.labels.bubble(this.anim.root.visible ? this.anim.root : this.anim.model.segs[0], `${this.pet.name} a faim ! (croquettes)`, 3000, '', 1.2);
        else if (st.joy < 25) this.game.labels.bubble(this.anim.root.visible ? this.anim.root : this.anim.model.segs[0], `${this.pet.name} s'ennuie... un câlin ?`, 3000, '', 1.2);
      }
    }
  }
}

export class Pets {
  constructor(game) {
    this.game = game;
    this.follower = null;
    this.key = null;
    game.on('profile', () => this.sync());
    this.sync();
    game.interactions.add({
      zone: 'any', r: 2.2, priority: 2,
      x: () => this.follower?.anim.pos.x ?? 1e9, z: () => this.follower?.anim.pos.z ?? 1e9,
      enabled: () => !!this.follower && this.follower.pet.species !== 'corbeau',
      label: () => `🐾 S'occuper de ${this.follower?.pet.name}`,
      action: () => this.openPanel(this.follower.pet.id),
    });
  }

  sync() {
    const p = this.game.profile;
    const pet = p.pets.find((x) => x.id === p.activePet) || null;
    const key = pet ? `${pet.id}|${pet.species}|${pet.collar}|${pet.name}` : null;
    if (key === this.key) { if (this.follower && pet) this.follower.pet = pet; return; }
    this.key = key;
    const old = this.follower;
    this.follower?.dispose();
    this.follower = pet ? new PetFollower(this.game, pet, true) : null;
    if (old && this.follower) { this.follower.anim.pos.copy(old.anim.pos); }
  }

  update(dt, t) {
    const g = this.game;
    if (!this.follower) return;
    const pl = g.player;
    this.follower.update(dt, t, { pos: pl.pos, yaw: pl.yaw, speed: pl.speed, zone: pl.zone }, !pl.vehicle || this.follower.pet.species === 'corbeau');
  }

  openPanel(petId) {
    const g = this.game;
    let sel = petId || g.profile.activePet || g.profile.pets[0]?.id;
    const act = (type, payload, msg) => g.net.request(type, payload).then((r) => { if (msg) g.ui.toast(typeof msg === 'function' ? msg(r) : msg, 'good'); m.refresh(); return r; }).catch((e) => g.ui.toast(e.message, 'bad'));
    const m = g.ui.modal({
      title: '🐾 Mes animaux', sub: 'Nourris-les, câline-les, apprends-leur des tours.', width: 'min(600px, 96vw)',
      build: (b) => {
        const p = g.profile;
        if (!p.pets.length) { b.append(h('p', 'Tu n\'as pas encore d\'animal. Va à l\'Animalerie Poil-Poil (Grande Place, côté ouest) pour en adopter un !')); return; }
        if (!p.pets.find((x) => x.id === sel)) sel = p.pets[0].id;
        b.append(h('div.tabs', { style: { padding: '0 0 10px' } }, p.pets.map((pt) => h(`button.tab${pt.id === sel ? '.active' : ''}`, { onclick: () => { sel = pt.id; m.refresh(); } }, `${SPECIES[pt.species].emoji} ${pt.name}`))));
        const pet = p.pets.find((x) => x.id === sel);
        const st = petStatus(pet, g.now());
        const bar = (v, c) => h('div.xpbar', { style: { width: '100%', height: '12px' } }, h('div', { style: { width: `${v}%`, background: c } }));
        b.append(h('div.stat-grid',
          h('div.stat', h('b', `${st.food} %`), h('span', 'Satiété'), bar(st.food, '#ff9f1c')),
          h('div.stat', h('b', `${st.joy} %`), h('span', 'Joie'), bar(st.joy, '#ff5a5f')),
          h('div.stat', h('b', String(pet.trainings)), h('span', 'Séances de dressage'))));
        b.append(h('p', { style: { margin: '12px 0 4px' } }, h('b', 'Tours appris : '), pet.tricks.length ? pet.tricks.map((t) => TRICK_NAME[t]).join(', ') : 'aucun pour l\'instant'));
        const nextT = TRICKS.find((t) => !pet.tricks.includes(t.id));
        if (nextT) b.append(h('p.muted', `Prochain tour : « ${nextT.name} » après ${nextT.trainings} séances.`));
        b.append(h('p.muted', `Dans ton sac : ${p.inventory.croquettes || 0} croquettes, ${p.inventory.friandise || 0} friandises.`));
        b.append(h('div.row', { style: { flexWrap: 'wrap', margin: '10px 0' } },
          h('button.btn.small', { onclick: () => act('pet.feed', { petId: pet.id }, `${pet.name} se régale !`).then(() => g.sfx('pop')) }, '🥣 Nourrir'),
          h('button.btn.small.coral', { onclick: () => act('pet.cuddle', { petId: pet.id }, `${pet.name} adore ça.`).then(() => { g.player.setPose('pet', 1.2); g.sfx(pet.species === 'chien' ? 'bark' : pet.species === 'chat' ? 'meow' : 'pop'); }) }, '💕 Câlin'),
          h('button.btn.small.teal', { onclick: () => act('pet.train', { petId: pet.id }, (r) => (r.learned ? `🎓 ${pet.name} a appris « ${r.learned.name} » !` : `${pet.name} progresse...`)).then((r) => { if (r?.learned && this.follower?.pet.id === pet.id) this.follower.doTrick(r.learned.id); }) }, '🎓 Dresser (1 friandise)'),
          pet.tricks.length && this.follower?.pet.id === pet.id ? h('button.btn.small.ghost', { onclick: () => { m.close(); this.follower.doTrick(pet.tricks[Math.floor(Math.random() * pet.tricks.length)]); } }, '✨ Faire un tour') : null));
        const nameInput = h('input.text-input', { value: pet.name, maxlength: 14, style: { maxWidth: '220px' } });
        b.append(h('div.field', h('label', 'Nom'), h('div.row', nameInput, h('button.btn.small.ghost', { onclick: () => act('pet.rename', { petId: pet.id, name: nameInput.value }, 'Nouveau nom enregistré.') }, 'Renommer'))));
        b.append(h('div.field', h('label', 'Collier'), h('div.swatches', COLORS.map((c) => h(`button.swatch${pet.collar === c ? '.sel' : ''}`, { style: { background: c }, onclick: () => act('pet.collar', { petId: pet.id, color: c }) })))));
        b.append(h('div.row', { style: { flexWrap: 'wrap' } },
          p.activePet === pet.id
            ? h('button.btn.small.ghost', { onclick: () => act('pet.active', { petId: null }, `${pet.name} t'attend à la maison.`) }, '🏠 Laisser à la maison')
            : h('button.btn.small', { onclick: () => act('pet.active', { petId: pet.id }, `${pet.name} te suit !`) }, '🐾 Emmener avec moi'),
          h('button.btn.small.ghost', { onclick: async () => { if (await g.ui.confirm('Confier à la ferme ?', `${pet.name} ira vivre une vie paisible à la Ferme Bidoche. C'est définitif.`, 'Confier')) act('pet.rehome', { petId: pet.id }, (r) => `${r.name} est parti vivre à la ferme. Il t'enverra des cartes postales.`); } }, 'Confier à la ferme')));
      },
    });
  }
}

export { THREE };
