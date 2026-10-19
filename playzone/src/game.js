import * as THREE from 'three';
import { Engine } from './core/engine.js';
import { Input } from './core/input.js';
import { Collision } from './core/collision.js';
import { Interactions } from './core/interact.js';
import { World } from './world/world.js';
import { Avatar } from './characters/avatar.js';
import { Player } from './characters/player.js';
import { ThirdPersonCamera } from './characters/camera.js';
import { DEFAULT_APPEARANCE } from '../shared/appearance.js';

// Le jeu : assemble tous les systèmes et fait tourner la boucle.
export class Game {
  constructor(container, uiRoot) {
    this.container = container;
    this.uiRoot = uiRoot;
  }

  async boot() {
    this.engine = new Engine(this.container);
    this.input = new Input(this.engine.canvas);
    this.collision = new Collision();
    this.interactions = new Interactions();
    this.world = new World(this.engine, this.collision);
    this.world.build();
    const qs = new URLSearchParams(location.search);
    if (qs.has('heure')) this.world.dayNight.forcedHour = +qs.get('heure');

    this.avatar = new Avatar(DEFAULT_APPEARANCE);
    this.engine.scene.add(this.avatar.root);
    this.player = new Player(this.avatar, this.collision);
    this.player.teleport(this.player.pos.x, this.player.pos.z, this.player.yaw);
    this.cam = new ThirdPersonCamera(this.engine.camera, this.collision);
    this.cam.snap(this.player.pos, this.player.yaw + Math.PI);

    this.engine.onUpdate((dt, t) => this.update(dt, t));
    this.engine.start();
    document.getElementById('boot').classList.add('hidden');
  }

  now() { return Date.now(); }

  // Tests automatiques : avance la simulation de `seconds` à pas fixe (sans attendre le rendu).
  debugStep(seconds, dt = 1 / 30) {
    const n = Math.round(seconds / dt);
    for (let i = 0; i < n; i++) { this.engine.time += dt; this.update(dt, this.engine.time); }
  }

  update(dt, t) {
    this.input.update();
    this.player.update(dt, this.input, this.cam.yaw);
    this.cam.update(dt, this.player.pos, this.input);
    this.engine.followShadow(this.player.pos.x, this.player.pos.z);
    this.world.update(dt, t, this.now());
    this.input.endFrame();
  }
}
