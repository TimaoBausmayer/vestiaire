import * as THREE from 'three';
import { HOME_INTERIOR, POI, BUILDING_BY_ID } from '../../shared/world-layout.js';
import { buildMergedGeometry } from '../core/static-builder.js';
import { actorMaterial } from '../core/materials.js';
import { furnitureGeometry, furnitureBoxes, isWall } from './furniture.js';
import { h } from '../ui/dom.js';
import { HOUSING_BY_ID, HOME_SIZES, homeSize, gardenOf, localInBuilding } from '../../shared/property.js';
import { buildingFrame } from '../world/buildings.js';
import { cookPanel, shower, sleep } from '../life/home-life.js';

// Maison "dans le monde" (on y entre vraiment) : le logement habité est-il une maison / ferme ?
export const isHousePlace = (place) => ['maison', 'ferme', 'villa'].includes(HOUSING_BY_ID[place]?.kind);

// LOGEMENT : intérieur visitable, décoration (placer/tourner/retirer des meubles), meubles interactifs.
// En ligne, on peut inviter des amis : ils entrent dans la même "zone" et voient la même déco.
const O = HOME_INTERIOR.origin;
const WALL_H = 3.2;
const FUN = {
  tele: ['La télé diffuse « Les pigeons, ces héros méconnus », épisode 47.', 'Publicité : « Achetez un deuxième canapé pour votre canapé. »'],
  'borne-arcade': ['GAME OVER. Le chat a encore le record.', 'Tu bats ton record ! ... ah non, c\'était le score du chat.'],
  piano: ['♪ Do, ré, mi... fa-ux.', '♪ Tu joues la lettre à Élise. Élise n\'a pas répondu.'],
  frigo: ['Le frigo : « Encore toi ? Il n\'y a que des cornichons. »', 'Le frigo : « Ferme-moi, tu fais rentrer la chaleur ! »'],
  lit: ['Tu fais une sieste de 3 secondes. Tu te sens neuf.', 'Zzz... tu rêves d\'un burger à la confiture. Cauchemar ?'],
  aquarium: ['Gérard le poisson te fait coucou. Enfin, des bulles.'],
  'nain-jardin': ['Le nain te regarde. Tu détournes les yeux. Il a gagné.'],
  trone: ['Tu t\'assois sur le trône. La télécommande est à toi.'],
  'statue-poulet': ['Gloire aux héros de l\'Invasion !'],
  cercueil: ['Étonnamment confortable. Ne le dis à personne.'],
};

export const FUN_LABEL = { cuisiniere: '🍳 Cuisiner', douche: '🚿 Prendre une douche', tele: '📺 Allumer la télé', 'borne-arcade': '🕹️ Jouer à la borne', piano: '🎹 Jouer du piano', frigo: '🧊 Ouvrir le frigo', lit: '🛏️ Dormir', 'boule-disco': '🪩 Allumer la boule disco', aquarium: '🐠 Regarder Gérard', 'nain-jardin': '🧙 Fixer le nain', trone: '👑 S\'asseoir sur le trône', 'statue-poulet': '🐔 Admirer la statue', cercueil: '⚰️ S\'allonger' };

export class Home {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    this.group.position.set(O.x, 0, O.z);
    this.group.visible = false;
    game.engine.scene.add(this.group);
    this.colliders = [];
    this.walls = [];
    this.items = [];     // meubles posés { mesh, f, col }
    this.inside = null;  // { ownerId, ownerName, size }
    this.disco = false;
    game.interactions.add({ x: POI.homeDoor.x, z: POI.homeDoor.z, r: 3.2, priority: 2, label: '🏠 Rentrer chez moi (studio)', enabled: () => (game.profile?.home.place || 'studio') === 'studio', action: () => this.enter() });
    this.exitInter = game.interactions.add({ zone: 'home', x: O.x, z: () => O.z + this.size().d / 2 - 1.2, r: 2.2, priority: 2, label: '🚪 Sortir', action: () => this.exit() });
    // maison dans le monde : bouton Décorer quand on est chez soi
    game.on('building.enter', (b) => { if (b.id === game.profile.home.place && isHousePlace(b.id)) this.enterHouse(b); });
    game.on('building.exit', (b) => { if (this.houseB === b && !this.inGarden) this.leaveHouse(); });
    this.funInter = game.interactions.add({
      zone: 'home', r: 2.2, priority: 1,
      x: () => this.nearFun()?.mesh.position.x + O.x || 1e9, z: () => this.nearFun()?.mesh.position.z + O.z || 1e9,
      enabled: () => !!this.nearFun() && !this.ghost,
      label: () => FUN_LABEL[this.nearFun()?.f.i] || 'Utiliser',
      action: () => this.useFun(this.nearFun()),
    });
    game.on('profile', (p) => { if (this.inside && this.inside.ownerId === p.id) this.load(p.home); });
  }

  size() { return this.houseB ? HOUSING_BY_ID[this.houseB.id].size : this.inside?.dims || HOME_SIZES.studio; }

  enterHouse(b) {
    this.houseB = b;
    this.houseF = buildingFrame(b);
    this.decoBtn?.remove();
    this.decoBtn = this.game.hud.addButton('🛠️', 'Décorer', () => this.openDeco());
    this.game.hud.track('home', { title: this.inGarden ? '🌳 Mon jardin' : '🏠 Chez moi', text: this.inGarden ? 'Bouton 🛠️ : piscine, barbecue, hamac, palmiers... tout se pose dans le jardin.' : 'Bouton 🛠️ pour décorer. Le jardin est derrière la maison !' });
  }

  // Jardin derrière sa maison : on y décore comme à l'intérieur (même repère que la maison).
  gardenTick() {
    const g = this.game, place = g.profile?.home.place;
    const gd = place && isHousePlace(place) ? gardenOf(place) : null;
    const b = gd && BUILDING_BY_ID[HOUSING_BY_ID[place].building];
    let inG = false;
    if (b) {
      const P = g.player.pos, l = localInBuilding(b, P.x, P.z);
      inG = P.y < 4 && l.x > gd.x1 - 1 && l.x < gd.x2 + 1 && l.z > gd.z1 - 1 && l.z < gd.z2 + 0.3;
    }
    if (inG === !!this.inGarden) return;
    this.inGarden = inG;
    if (inG) this.enterHouse(b);
    else if (this.houseB && g.interiors?.inside?.id !== this.houseB.id) this.leaveHouse();
    else if (this.houseB) this.enterHouse(this.houseB);   // rentré dans la maison : on remet le bon titre
  }

  leaveHouse() {
    this.cancelGhost();
    this.houseB = null;
    this.decoBtn?.remove();
    this.decoBtn = null;
    this.game.hud.track('home', null);
  }

  fade(fn) {
    const el = h('div', { style: { position: 'absolute', inset: '0', background: '#120d33', opacity: '0', transition: 'opacity .25s', zIndex: '40', pointerEvents: 'none' } });
    this.game.ui.root.append(el);
    requestAnimationFrame(() => { el.style.opacity = '1'; });
    setTimeout(() => { fn(); el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 260);
  }

  // Entrer chez soi (ou chez un ami en ligne : ownerId, home, ownerName)
  enter(ownerId, home, ownerName, exitTo = null) {
    const g = this.game;
    const mine = !ownerId || ownerId === g.profile.id;
    const data = mine ? g.profile.home : home;
    g.sfx('door');
    this.fade(() => {
      const dims = homeSize({ home: data });
      this.inside = { ownerId: mine ? g.profile.id : ownerId, ownerName: mine ? g.profile.name : ownerName, size: data.size, dims, mine, exitTo };
      this.buildRoom(dims);
      this.load(data);
      this.group.visible = true;
      g.player.zone = `home:${this.inside.ownerId}`;
      const S = this.size();
      g.player.teleport(O.x, O.z + S.d / 2 - 2, Math.PI, 0.02);
      g.cam.snap(g.player.pos, 0);
      g.cam.pitch = 0.75; g.cam.dist = 11;
      g.world.static.visible = false;
      this.decoBtn = mine ? g.hud.addButton('🛠️', 'Décorer', () => this.openDeco()) : null;
      g.hud.track('home', { title: mine ? '🏠 Chez moi' : `🏠 Chez ${ownerName}`, text: mine ? 'Bouton 🛠️ pour décorer. Approche-toi de la porte pour sortir.' : 'Tu es invité ! Sois sage avec les meubles.' });
      g.emit('zone', g.player.zone);
    });
  }

  exit() {
    const g = this.game;
    g.sfx('door');
    this.cancelGhost();
    this.fade(() => {
      this.group.visible = false;
      const to = this.inside?.exitTo || { x: POI.homeDoor.x, z: POI.homeDoor.z + 1 };
      this.inside = null;
      g.player.zone = 'world';
      g.player.teleport(to.x, to.z, Math.PI);
      g.cam.snap(g.player.pos, 0);
      g.cam.pitch = 0.4; g.cam.dist = 9;
      g.world.static.visible = true;
      this.decoBtn?.remove();
      g.hud.track('home', null);
      if (this.disco) this.toggleDisco(false);
      g.emit('zone', 'world');
    });
  }

  buildRoom(dims) {
    const key = `${dims.w}x${dims.d}`;
    if (this.builtSize === key) return;
    this.builtSize = key;
    for (const m of this.walls) this.group.remove(m);
    if (this.floor) this.group.remove(this.floor);
    for (const c of this.colliders) this.game.collision.remove(c);
    this.walls = []; this.colliders = [];
    const W = dims.w, D = dims.d;
    const size = W > 16 ? 'appart' : 'studio';
    this.floor = new THREE.Mesh(buildMergedGeometry((sb) => {
      sb.box(0, -60, 0, 200, 59.9, 200, '#1d1640');
      for (let i = 0; i < W / 0.8; i++) sb.box(-W / 2 + 0.4 + i * 0.8, -0.1, 0, 0.78, 0.1, D, i % 2 ? '#c49a6c' : '#b88a5c');
      sb.box(0, -0.05, D / 2 - 0.9, 1.6, 0.06, 1.0, '#7a2e2e'); // paillasson
    }), actorMaterial);
    this.floor.receiveShadow = true;
    this.group.add(this.floor);
    // plancher solide (sinon on tomberait : l'intérieur est hors de la carte)
    this.colliders.push(this.game.collision.addBox(O.x - W / 2 - 0.5, -3, O.z - D / 2 - 0.5, O.x + W / 2 + 0.5, 0, O.z + D / 2 + 0.5, { noCamera: true }));
    const wallColor = size === 'appart' ? '#f6e7c8' : '#e8f0ff';
    const mkWall = (x, z, w, d, nx, nz, withWindow) => {
      const m = new THREE.Mesh(buildMergedGeometry((sb) => {
        sb.box(0, 0, 0, w, WALL_H, d, wallColor);
        sb.box(0, 0, 0, w + 0.02, 0.15, d + 0.02, '#7a5230');
        if (withWindow) {
          const alongZ = d > w, len = Math.max(w, d);
          for (let k = -1; k <= 1; k += 2) {
            const off = (len / 4) * k;
            if (alongZ) sb.box(0, 1.2, off, w + 0.06, 1.2, 1.4, '#bfe3ff');
            else sb.box(off, 1.2, 0, 1.4, 1.2, d + 0.06, '#bfe3ff');
          }
        }
      }), actorMaterial);
      m.position.set(x, 0, z);
      m.userData.n = [nx, nz];
      m.castShadow = true;
      this.group.add(m);
      this.walls.push(m);
      this.colliders.push(this.game.collision.addBoxC(O.x + x, O.z + z, w, d, 0, WALL_H, { noCamera: true }));
    };
    const t = 0.25;
    mkWall(0, -D / 2, W, t, 0, -1, true);
    mkWall(-W / 2, 0, t, D, -1, 0, true);
    mkWall(W / 2, 0, t, D, 1, 0, true);
    const seg = (W - 2) / 2;
    mkWall(-W / 2 + seg / 2, D / 2, seg, t, 0, 1, false);
    mkWall(W / 2 - seg / 2, D / 2, seg, t, 0, 1, false);
  }

  load(home) {
    const g = this.game;
    if (this.inside) { this.inside.dims = homeSize({ home }); this.buildRoom(this.inside.dims); }
    for (const it of this.items) { this.group.remove(it.mesh); for (const c of it.cols || []) g.collision.remove(c); }
    this.items = home.furniture.map((f, index) => {
      const mesh = new THREE.Mesh(furnitureGeometry(f.i), actorMaterial);
      mesh.position.set(f.x, 0, f.z);
      mesh.rotation.y = (f.r || 0) * Math.PI / 2;
      mesh.castShadow = true;
      this.group.add(mesh);
      // murs : pleine hauteur (le mur avec porte laisse passer au milieu)
      const cols = furnitureBoxes(f).map(([x, z, w, d, hh]) => g.collision.addBoxC(O.x + x, O.z + z, w, d, 0, hh, { noCamera: !isWall(f.i) }));
      return { mesh, f, cols, index };
    });
  }

  nearFun() {
    if (!this.inside) return null;
    const P = this.game.player.pos;
    let best = null, bd = 2.2;
    for (const it of this.items) {
      if (!FUN_LABEL[it.f.i]) continue;
      const d = Math.hypot(P.x - (O.x + it.f.x), P.z - (O.z + it.f.z));
      if (d < bd) { bd = d; best = it; }
    }
    return best;
  }

  // Meuble "amusant" d'une maison (point d'interaction posé par l'intérieur).
  useFunItem(id) { this.useFun({ f: { i: id } }); }

  useFun(it) {
    if (!it) return;
    const g = this.game;
    if (it.f.i === 'boule-disco') { this.toggleDisco(!this.disco); return; }
    if (it.f.i === 'cuisiniere') { cookPanel(g); return; }
    if (it.f.i === 'douche') { shower(g); return; }
    if (it.f.i === 'lit') {
      const m = it.mesh;
      sleep(g, m ? { x: O.x + it.f.x, z: O.z + it.f.z, yaw: m.rotation.y, y: 0.6 } : null);
      return;
    }
    const lines = FUN[it.f.i];
    if (!lines) return;
    g.labels.bubble(g.avatar.root, lines[Math.floor(Math.random() * lines.length)], 3500, 'player');
    if (it.f.i === 'piano') [262, 330, 392].forEach((f, i) => setTimeout(() => g.sound.ensure() && g.sound.tone('triangle', f, f, 0.3, 0.1), i * 180));
    if (it.f.i === 'lit') g.player.setPose('sit', 2.5);
  }

  toggleDisco(on) {
    this.disco = on;
    if (on && !this.spots) {
      // projecteurs colorés qui balaient le sol
      this.spots = new THREE.Group();
      for (let i = 0; i < 7; i++) {
        const m = new THREE.Mesh(new THREE.CircleGeometry(0.9, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
        m.position.y = 0.03;
        this.spots.add(m);
      }
      this.group.add(this.spots);
    }
    if (this.spots) this.spots.visible = on;
    this.game.sound.music(on);
    this.game.ui.toast(on ? '🪩 C\'est la fête ! (touches 1, 2, 3 pour danser)' : 'La fête est finie. Snif.', on ? 'good' : '');
  }

  // ------------------------------------------------------------------ décoration
  openDeco() {
    const g = this.game;
    const items = g.net.content.items;
    const m = g.ui.modal({
      title: '🛠️ Décoration', sub: `Logement : ${HOUSING_BY_ID[g.profile.home.place]?.name || 'studio'}${g.profile.home.place === 'studio' && g.profile.home.size === 'appart' ? ' (agrandi)' : ''} · ${g.profile.home.furniture.length}/60 meubles posés`,
      build: (b) => {
        const p = g.profile;
        const owned = Object.keys(p.inventory).filter((id) => items[id]?.furniture && p.inventory[id] > 0);
        if (!owned.length) b.append(h('p.muted', 'Tu n\'as encore aucun meuble. Va chez Meubles Mous, sur la Grande Place !'));
        if (p.home.furniture.length) b.append(h('button.btn.block', { style: { marginBottom: '10px' }, onclick: () => { const k = this.nearestPlaced(); if (k < 0) { g.ui.toast('Approche-toi d\'un meuble.', 'bad'); return; } m.close(); this.startGhost(p.home.furniture[k].i, k); } }, '✋ Déplacer le meuble le plus proche (touche M)'));
        b.append(h('p.muted', '🧱 Murs et cloisons (2 m, à tourner avec R) : Brico Dépôt ou Maison & Déco. Pose-les bout à bout pour créer des pièces.'));
        b.append(h('div.grid', owned.map((id) => {
          const placed = p.home.furniture.filter((f) => f.i === id).length;
          const free = p.inventory[id] - placed;
          return h('div.card', h('div.emoji', items[id].emoji), h('div.title', items[id].name), h('div.desc', `${free} en stock · ${placed} posé${placed > 1 ? 's' : ''}`),
            h('button.btn.small', { disabled: free <= 0, onclick: () => { m.close(); this.startGhost(id); } }, 'Placer'));
        })));
        if (p.home.furniture.length) {
          b.append(h('h3', { style: { marginTop: '16px' } }, 'Meubles posés'));
          b.append(h('div.list', p.home.furniture.map((f, i) => h('div.list-item', h('span', items[f.i]?.emoji || '📦'), h('div.grow', h('div.t', items[f.i]?.name || f.i)),
            h('button.btn.small', { onclick: () => { m.close(); this.startGhost(f.i, i); } }, '✋ Déplacer'),
            h('button.btn.small.ghost', { onclick: async () => { try { await g.net.request('home.remove', { index: i }); m.refresh(); } catch (e) { g.ui.toast(e.message, 'bad'); } } }, 'Ranger')))));
        }
      },
    });
  }

  canDecorate() { return !!(this.inside?.mine || this.houseB) && !this.ghost; }
  moveNearest() {
    const k = this.nearestPlaced();
    if (k < 0) { this.game.ui.toast('✋ Approche-toi du meuble (ou du mur) à déplacer, puis appuie sur M.', '', 3000); return; }
    this.startGhost(this.game.profile.home.furniture[k].i, k);
  }

  // Meuble posé le plus proche du joueur (index dans home.furniture), ou -1.
  nearestPlaced() {
    const g = this.game, P = g.player.pos, list = g.profile.home.furniture;
    let best = -1, bd = 3.5;
    list.forEach((f, i) => {
      let wx = O.x + f.x, wz = O.z + f.z;
      if (this.houseB) [wx, wz] = this.houseF.L(f.x, f.z);
      const d = Math.hypot(P.x - wx, P.z - wz);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  startGhost(itemId, moveIndex = null) {
    const g = this.game;
    this.cancelGhost();
    const mat = actorMaterial.clone();
    mat.transparent = true; mat.opacity = 0.55;
    const mesh = new THREE.Mesh(furnitureGeometry(itemId), mat);
    (this.houseB ? g.engine.scene : this.group).add(mesh);
    const moving = moveIndex !== null ? g.profile.home.furniture[moveIndex] : null;
    this.ghost = { itemId, mesh, r: moving ? moving.r || 0 : 0, moveIndex };
    // l'original disparaît pendant qu'on le déplace
    if (moving && this.houseB) { g.interiors.hideFurn = moveIndex; g.interiors.reload(this.houseB.id); this.hiddenMove = { house: this.houseB.id }; }
    else if (moving) { const it = this.items.find((x) => x.index === moveIndex); if (it) it.mesh.visible = false; this.hiddenMove = it; }
    this.ghostBar = h('div.dialog-box', h('div', h('span.who', moving ? 'Déplacer le meuble' : isWall(itemId) ? 'Placer le mur' : 'Placer le meuble'), h('span.role', 'déplace-toi pour le positionner')),
      h('div.choices', { style: { marginTop: '10px' } },
        h('button.btn.small.ghost', { onclick: () => this.rotateGhost() }, '↻ Tourner (R)'),
        h('button.btn.small', { onclick: () => this.confirmGhost() }, '✔ Poser ici (E)'),
        h('button.btn.small.ghost', { onclick: () => this.cancelGhost() }, 'Annuler')));
    g.ui.root.append(this.ghostBar);
    this.offKey = g.input.on('key', (e) => {
      if (e.code === 'KeyR') this.rotateGhost();
      else if (e.code === 'KeyE') this.confirmGhost();
      else if (e.code === 'Escape') this.cancelGhost();
    });
  }

  rotateGhost() { if (this.ghost) this.ghost.r = (this.ghost.r + 1) % 4; }

  ghostPos() {
    const p = this.game.player;
    const S = this.size();
    const wx = p.pos.x + Math.sin(p.yaw) * 1.8, wz = p.pos.z + Math.cos(p.yaw) * 1.8;
    let lx = wx - O.x, lz = wz - O.z;
    if (this.houseB) {
      // repère local de la maison (x le long de la façade, z vers la porte)
      const b = this.houseB, th = this.houseF.th, dx = wx - b.x, dz = wz - b.z;
      lx = dx * Math.cos(th) - dz * Math.sin(th); lz = dx * Math.sin(th) + dz * Math.cos(th);
    }
    const snap = (v, lim) => Math.max(-lim, Math.min(lim, Math.round(v * 4) / 4));
    const gd = this.houseB && gardenOf(this.houseB.id);
    if (gd && (this.inGarden || lz < -this.houseF.D / 2)) {   // dans le jardin
      const cl = (v, a, b) => Math.max(a, Math.min(b, Math.round(v * 4) / 4));
      return { x: cl(lx, gd.x1 + 0.75, gd.x2 - 0.75), z: cl(lz, gd.z1 + 0.75, gd.z2 - 0.75) };
    }
    return { x: snap(lx, S.w / 2 - 0.6), z: snap(lz, S.d / 2 - 0.6) };
  }

  async confirmGhost() {
    if (!this.ghost) return;
    const g = this.game;
    const { x, z } = this.ghostPos();
    const { itemId, r, moveIndex } = this.ghost;
    try {
      if (moveIndex !== null && moveIndex !== undefined) await g.net.request('home.move', { index: moveIndex, x, z, r });
      else await g.net.request('home.place', { itemId, x, z, r });
      g.sfx('pop'); this.cancelGhost();
    } catch (e) { g.ui.toast(e.message, 'bad'); }
  }

  cancelGhost() {
    if (this.hiddenMove?.house) { this.game.interiors.hideFurn = null; this.game.interiors.reload(this.hiddenMove.house); this.hiddenMove = null; }
    else if (this.hiddenMove) { this.hiddenMove.mesh.visible = true; this.hiddenMove = null; }
    if (!this.ghost) return;
    this.ghost.mesh.removeFromParent();
    this.ghost = null;
    this.ghostBar?.remove();
    this.offKey?.();
  }

  update(dt, t) {
    this.gardenTick();
    if (this.houseB && this.ghost) {
      const { x, z } = this.ghostPos();
      const [wx, wz] = this.houseF.L(x, z);
      this.ghost.mesh.position.set(wx, 0.05, wz);
      this.ghost.mesh.rotation.y = this.houseF.th + this.ghost.r * Math.PI / 2;
    }
    if (!this.inside) return;
    // murs "maison de poupée" : on masque ceux qui sont entre la caméra et le joueur
    const cam = this.game.engine.camera.position;
    const S = this.size();
    const cx = cam.x - O.x, cz = cam.z - O.z;
    for (const w of this.walls) {
      const [nx, nz] = w.userData.n;
      w.visible = !((nx > 0 && cx > S.w / 2 - 0.5) || (nx < 0 && cx < -S.w / 2 + 0.5) || (nz > 0 && cz > S.d / 2 - 0.5) || (nz < 0 && cz < -S.d / 2 + 0.5));
    }
    if (this.ghost) {
      const { x, z } = this.ghostPos();
      this.ghost.mesh.position.set(x, 0, z);
      this.ghost.mesh.rotation.y = this.ghost.r * Math.PI / 2;
    }
    if (this.disco && this.spots) {
      const S2 = this.size();
      this.spots.children.forEach((m, i) => {
        m.position.x = Math.sin(t * (0.7 + i * 0.13) + i) * (S2.w / 2 - 1.5);
        m.position.z = Math.cos(t * (0.5 + i * 0.11) + i * 2) * (S2.d / 2 - 1.5);
        m.material.color.setHSL(((t * 0.25) + i / 7) % 1, 0.9, 0.55);
      });
      for (const it of this.items) if (it.f.i === 'boule-disco') it.mesh.rotation.y = t * 2;
    }
  }
}

