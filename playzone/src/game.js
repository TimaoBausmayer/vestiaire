import * as THREE from 'three';
import { Engine, detectQuality } from './core/engine.js';
import { Input } from './core/input.js';
import { Collision } from './core/collision.js';
import { Interactions } from './core/interact.js';
import { Emitter } from './core/emitter.js';
import { Sfx } from './core/audio.js';
import { World } from './world/world.js';
import { Avatar } from './characters/avatar.js';
import { Player } from './characters/player.js';
import { ThirdPersonCamera } from './characters/camera.js';
import { UI } from './ui/ui.js';
import { HUD, WorldLabels } from './ui/hud.js';
import { showTitle, probeServer } from './ui/title.js';
import { openCreator } from './ui/creator.js';
import { openShop, openWardrobe } from './ui/shop.js';
import { LocalConnection } from './net/local.js';
import { FX } from './core/fx.js';
import { NPCs } from './characters/npcs.js';
import { Animals } from './animals/animals.js';
import { Traffic } from './world/traffic.js';
import { ParkedCars } from './vehicles/parked.js';
import { Secrets } from './world/secrets.js';
import { Minigames } from './minigames/index.js';
import { Jobs } from './jobs/index.js';
import { Home } from './home/home.js';
import { Pets } from './animals/pets.js';
import { Vehicles } from './vehicles/vehicles.js';
import { Phone } from './ui/phone.js';
import { Events } from './events/events.js';
import { Season } from './events/season.js';
import { Remotes } from './net/remotes.js';
import { Social } from './net/social.js';
import { TouchControls } from './ui/touch.js';
import { GPS } from './ui/gps.js';
import { Interiors } from './interiors/interiors.js';
import { Bills } from './property/bills.js';
import { Bank } from './property/bank.js';
import { Life } from './life/life.js';
import { Basket } from './ui/shop.js';
import { BUILDINGS, POI } from '../shared/world-layout.js';
import { DEFAULT_APPEARANCE } from '../shared/appearance.js';
import { levelFromXp } from '../shared/rules.js';

// Le jeu : assemble tous les systèmes et fait tourner la boucle.
export class Game extends Emitter {
  constructor(container, uiRoot) {
    super();
    this.container = container;
    this.uiRoot = uiRoot;
    this.playing = false;
    this.systems = [];       // modules mis à jour à chaque image : { update(dt, t), mapMarkers?() }
    this.qs = new URLSearchParams(location.search);
  }

  async boot() {
    // on interroge le serveur tout de suite (la construction du monde et la 1re image prennent du temps)
    const serverProbe = probeServer();
    this.engine = new Engine(this.container, this.qs.get('qualite') || detectQuality());
    this.input = new Input(this.engine.canvas);
    this.collision = new Collision();
    this.interactions = new Interactions();
    this.sound = new Sfx();
    this.world = new World(this.engine, this.collision);
    this.ui = new UI(this.uiRoot, this);
    this.minigames = new Minigames(this); // ajoute aussi le décor des stands au monde
    this.world.build();
    if (this.qs.has('heure')) this.world.dayNight.forcedHour = +this.qs.get('heure');

    this.labels = new WorldLabels(this.ui.labels, this.engine.camera);
    this.avatar = new Avatar(DEFAULT_APPEARANCE);
    this.engine.scene.add(this.avatar.root);
    this.player = new Player(this.avatar, this.collision);
    this.player.teleport(POI.spawn.x, POI.spawn.z, POI.spawn.ry);
    this.player.onJump = () => this.sfx('jump');
    this.player.onBounce = () => this.sfx('bounce');
    this.player.onLand = () => this.sfx('land');
    this.cam = new ThirdPersonCamera(this.engine.camera, this.collision);
    this.cam.snap(this.player.pos, this.player.yaw + Math.PI);
    this.avatar.root.visible = false;

    // La ville vit déjà derrière l'écran titre : habitants, animaux, circulation.
    this.fx = new FX(this.engine.scene);
    this.npcs = new NPCs(this);
    this.animals = new Animals(this);
    this.traffic = new Traffic(this);
    this.parked = new ParkedCars(this);
    this.season = new Season(this);
    this.ambient = [this.npcs, this.animals, this.traffic, this.minigames, this.season, this.fx];

    this.engine.onUpdate((dt, t) => this.update(dt, t));
    this.engine.start();
    document.getElementById('boot').classList.add('hidden');

    // Écran titre (la ville tourne en arrière-plan)
    this.titleOrbit = true;
    const serverInfo = await serverProbe.wait(5000);
    const solo = new LocalConnection();
    const save = solo.hasSave() ? (await solo.connect()).profile : null;
    if (this.qs.get('auto') === 'solo') return this.startSolo(solo, false);
    await showTitle(this.ui, {
      soloSave: save?.name, serverInfo, quality: this.engine.quality,
      onQuality: (q) => this.engine.setQuality(q),
      onSolo: () => this.startSolo(solo, false),
      onNewSolo: async () => {
        if (await this.ui.confirm('Nouveau personnage ?', 'Ta sauvegarde solo actuelle sera remplacée. (Pense à l\'exporter depuis le téléphone si tu veux la garder.)', 'Recommencer')) { solo.resetSave(); this.startSolo(solo, true); } else location.reload();
      },
      onOnline: () => this.startOnline(serverInfo),
    });
  }

  async startSolo(conn, fresh) {
    this.net = conn;
    if (fresh) conn.profile = null; else await conn.connect();
    this.afterConnect();
  }

  async startOnline() {
    const { OnlineConnection } = await import('./net/online.js');
    this.net = new OnlineConnection();
    try {
      await this.net.connect();
    } catch (e) {
      this.ui.toast(`Connexion impossible : ${e.message}. Passage en solo.`, 'bad', 6000);
      this.net = new LocalConnection();
      await this.net.connect();
    }
    this.afterConnect();
  }

  afterConnect() {
    this.titleOrbit = false;
    this.net.beforeRequest = () => { if (this.playing) this.net.sendState(this.player.netState(), this.player.zone); };
    this.net.on('profile', (p) => this.setProfile(p));
    if (!this.net.profile) {
      this.avatar.root.visible = true;
      openCreator(this, {
        askName: true,
        onDone: async (name, appearance) => {
          await this.net.createProfile(name, appearance);
          this.startPlaying(true);
        },
      });
    } else this.startPlaying(false);
  }

  startPlaying(firstTime) {
    this.cam.override = null;
    this.hud = new HUD(this.ui, this);
    this.gps = this.addSystem(new GPS(this));
    this.life = this.addSystem(new Life(this));
    this.eating = this.life;
    this.sitting = this.life;
    this.basket = new Basket(this);
    this.interiors = this.addSystem(new Interiors(this));
    this.bills = this.addSystem(new Bills(this));
    // décalage d'horloge (nuits passées à dormir) : seulement en solo, l'heure en ligne est commune
    try { this.world.dayNight.shift = this.net.mode === 'solo' ? +(localStorage.getItem('playzone.timeShift') || 0) || 0 : 0; } catch { /* stockage indisponible */ }
    this.bank = new Bank(this);
    this.setProfile(this.net.profile);
    this.avatar.root.visible = true;
    this.player.teleport(POI.spawn.x, POI.spawn.z, POI.spawn.ry);
    this.cam.snap(this.player.pos, this.player.yaw + Math.PI);
    this.cam.pitch = 0.38;
    this.setupWorldInteractions();
    this.secrets = this.addSystem(new Secrets(this));
    this.jobs = this.addSystem(new Jobs(this));
    this.home = this.addSystem(new Home(this));
    this.pets = this.addSystem(new Pets(this));
    this.vehicles = this.addSystem(new Vehicles(this));
    this.phone = new Phone(this);
    this.events = this.addSystem(new Events(this));
    if (this.net.mode === 'online') {
      this.remotes = this.addSystem(new Remotes(this));
      this.social = new Social(this);
    }
    this.hud.addButton('📱', 'Téléphone (P)', () => this.phone?.toggle());
    this.hud.addButton('👕', 'Garde-robe', () => openWardrobe(this));
    this.muteBtn = this.hud.addButton(this.sound.muted ? '🔇' : '🔊', 'Son', () => { this.sound.setMuted(!this.sound.muted); this.muteBtn.textContent = this.sound.muted ? '🔇' : '🔊'; });
    this.input.on('key', (e) => this.onKey(e));
    this.touch = this.addSystem(new TouchControls(this));
    this.playing = true;
    this.emit('playing');
    this.ui.toast(`Bienvenue à PLAYZONE, ${this.profile.name} ! ${this.net.mode === 'solo' ? '(mode solo)' : '(en ligne)'}`, 'good', 4500);
    if (firstTime) setTimeout(() => this.ui.toast('Astuce : les bâtiments jaunes de la mini-carte sont des métiers, les rouges des boutiques.', '', 6000), 2500);
    this.net.request('daily.claim').then((r) => {
      this.sfx('coin');
      this.ui.toast(`🎁 Bonus du jour : +${r.coins} PC (série de ${r.streak} jour${r.streak > 1 ? 's' : ''})`, 'money', 5000);
    }).catch(() => {});
  }

  setProfile(p) {
    const prev = this._prevProfile;
    this.profile = p;
    this.hud?.setProfile(p, prev);
    if (prev && levelFromXp(p.xp) > levelFromXp(prev.xp)) {
      this.sfx('levelup');
      this.ui.toast(`⭐ Niveau ${levelFromXp(p.xp)} atteint ! De nouveaux objets sont disponibles.`, 'good', 5000);
    }
    this._prevProfile = JSON.parse(JSON.stringify(p));
    this.refreshAvatar();
    this.emit('profile', p);
  }

  // Tenue affichée : apparence du profil + uniforme du métier en cours éventuel.
  refreshAvatar() {
    if (!this.profile) return;
    const key = JSON.stringify([this.profile.appearance, this.uniform]);
    if (key === this._avatarKey) return;
    this._avatarKey = key;
    this.avatar.setAppearance(this.profile.appearance, this.uniform || {});
  }

  previewAppearance(app) { this._avatarKey = null; this.avatar.setAppearance(app, this.uniform || {}); }

  setUniform(u) { this.uniform = u; this.refreshAvatar(); this.emit('uniform', u); }

  editLook() {
    const app = this.profile.appearance;
    const items = this.net.content.items;
    const owned = Object.keys(this.profile.inventory).filter((k) => this.profile.inventory[k] > 0);
    openCreator(this, {
      appearance: app,
      extraTops: owned.filter((id) => items[id]?.slot === 'top'),
      extraBottoms: owned.filter((id) => items[id]?.slot === 'bottom'),
      labels: Object.fromEntries(owned.map((id) => [id, items[id]?.name])),
      onDone: (_, a) => this.net.request('avatar.update', { appearance: { ...a, hat: app.hat, glasses: app.glasses, back: app.back } }),
      onCancel: () => { this._avatarKey = null; this.refreshAvatar(); },
    });
  }

  sfx(name) { this.sound.play(name); }

  // Affiche une récompense reçue de l'autorité (+PC, XP, niveau...).
  reward(data, label = '') {
    if (!data) return;
    const screen = this.toScreen(this.player.pos, 2.4);
    if (data.coins > 0) {
      this.sfx('coin');
      if (screen) this.ui.floater(`+${data.coins} PC`, screen.x, screen.y);
      this.ui.toast(`${label ? `${label} · ` : ''}+${data.coins} PC${data.xp ? ` · +${data.xp} XP` : ''}`, 'money');
    }
    if (data.jobUp) { this.sfx('levelup'); this.ui.toast(`🏅 Niveau ${data.jobUp} dans ce métier ! Nouvelles missions et améliorations débloquées.`, 'good', 5500); }
  }

  toScreen(pos, dy = 0) {
    const v = new THREE.Vector3(pos.x, pos.y + dy, pos.z).project(this.engine.camera);
    if (v.z > 1) return null;
    return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight };
  }

  // Les boutiques se visitent : on entre par la porte et on achète au comptoir (voir interiors/).
  setupWorldInteractions() {}

  interact() {
    if (!this.playing || this.ui.blocking || this.cutscene) return;
    if (this.interactions.trigger()) this.sfx('click');
  }

  onKey(e) {
    if (!this.playing) return;
    const k = e.key.toLowerCase();
    if (this.ui.blocking || this.cutscene) return;
    if (e.code === 'KeyE') this.interact();
    else if (k === 'p' || e.code === 'Tab') this.phone?.toggle();
    else if (k === 'm') this.phone?.open('map');
    else if (e.code === 'Enter') this.chat?.focus();
    else if (['Digit1', 'Digit2', 'Digit3'].includes(e.code)) { this.player.dance = +e.code.slice(5) - 1; this.player.setPose('dance'); this.emit('dance'); }
    else if (e.code === 'Digit4') this.player.setPose('wave', 2);
  }

  onUiChange() {
    if (this.player) this.player.frozen = this.ui.blocking || !!this.cutscene;
  }

  // Marqueurs pour la mini-carte et la carte du téléphone.
  mapMarkers() {
    const out = [...this.minigames.mapMarkers()];
    for (const s of this.systems) if (s.mapMarkers) out.push(...s.mapMarkers());
    return out;
  }

  addSystem(s) { this.systems.push(s); return s; }

  now() { return this.net ? this.net.serverNow() : Date.now(); }

  // Tests automatiques : avance la simulation de `seconds` à pas fixe (sans attendre le rendu).
  debugStep(seconds, dt = 1 / 30) {
    const n = Math.round(seconds / dt);
    for (let i = 0; i < n; i++) { this.engine.time += dt; this.update(dt, this.engine.time); }
  }

  update(dt, t) {
    this.input.update();
    if (this.titleOrbit) {
      const a = t * 0.06;
      this.cam.override = { pos: new THREE.Vector3(Math.sin(a) * 42, 18, Math.cos(a) * 42), look: new THREE.Vector3(0, 2, 0) };
    }
    for (const s of this.ambient) s.update(dt, t);
    if (this.playing) {
      this.player.frozen = this.ui.blocking || !!this.cutscene;
      this.player.update(dt, this.input, this.cam.yaw);
      for (const s of this.systems) s.update?.(dt, t);
      const it = this.ui.blocking || this.cutscene ? null : this.interactions.update(this.player.pos, this.player.zone);
      this.ui.prompt(it ? this.interactions.label() : null);
      this._net = (this._net || 0) + dt;
      if (this._net >= 0.1) { this._net = 0; this.net.sendState(this.player.netState(), this.player.zone); }
      this.hud.update(dt);
    } else {
      this.avatar.update(dt, { speed: 0, grounded: true, pose: 'idle' });
    }
    this.cam.update(dt, this.player.pos, this.input);
    this.engine.followShadow(this.player.pos.x, this.player.pos.z);
    this.world.update(dt, t, this.now());
    this.labels.update();
    this.input.endFrame();
  }
}
