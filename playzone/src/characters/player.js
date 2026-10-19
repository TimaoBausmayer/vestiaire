import * as THREE from 'three';
import { groundHeight, WATER_LEVEL, POI, WORLD_HALF } from '../../shared/world-layout.js';

// Contrôleur du joueur : déplacement relatif à la caméra, sprint, saut (avec "coyote time"),
// nage, trampoline, collisions. Les déplacements sont envoyés au serveur qui vérifie la vitesse.

export const PLAYER_RADIUS = 0.42;
export const PLAYER_HEIGHT = 1.9;
const GRAVITY = 25;

export class Player {
  constructor(avatar, collision) {
    this.avatar = avatar;
    this.collision = collision;
    this.pos = new THREE.Vector3(POI.spawn.x, 0, POI.spawn.z);
    this.vel = new THREE.Vector3();
    this.yaw = POI.spawn.ry;
    this.grounded = true;
    this.swimming = false;
    this.coyote = 0;
    this.frozen = false;     // interface ouverte, cinématique...
    this.speedBonus = 1;     // améliorations (ex. livreur)
    this.walkSpeed = 5.2;
    this.runSpeed = 9;
    this.pose = 'idle';
    this.poseTimer = 0;
    this.dance = 0;
    this.zone = 'world';     // 'world' ou 'home:<id>'
    this.vehicle = null;     // véhicule conduit (géré par vehicles.js)
    this.speed = 0;
    this.onBounce = null;
  }

  setPose(p, duration = 0) { this.pose = p; this.poseTimer = duration; }

  teleport(x, z, yaw, y) {
    this.pos.set(x, y ?? this.collision.supportAt(x, z, 50, PLAYER_RADIUS), z);
    this.vel.set(0, 0, 0);
    if (yaw !== undefined) this.yaw = yaw;
    this.avatar.root.position.copy(this.pos);
    this.avatar.root.rotation.y = this.yaw;
  }

  update(dt, input, camYaw) {
    if (this.vehicle) return; // le véhicule gère le joueur
    const p = this.pos, v = this.vel;
    const canMove = !this.frozen;
    // direction voulue (relative à la caméra)
    let mx = 0, mz = 0;
    if (canMove) {
      const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
      const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
      mx = fx * input.move.y + rx * input.move.x;
      mz = fz * input.move.y + rz * input.move.x;
    }
    const mlen = Math.hypot(mx, mz);
    const ground = groundHeight(p.x, p.z);
    const inHome = this.zone.startsWith('home');
    this.swimming = !inHome && ground < WATER_LEVEL - 1.0 && p.y < WATER_LEVEL - 0.6;
    let target = this.swimming ? 3.6 : input.sprint ? this.runSpeed : this.walkSpeed;
    target *= this.speedBonus;
    if (this.pose === 'carry') target *= 0.85;
    const accel = this.grounded || this.swimming ? 14 : 4;
    const tx = mlen > 0.01 ? (mx / Math.max(1, mlen)) * target : 0;
    const tz = mlen > 0.01 ? (mz / Math.max(1, mlen)) * target : 0;
    const k = 1 - Math.exp(-accel * dt);
    v.x += (tx - v.x) * k;
    v.z += (tz - v.z) * k;

    // saut
    this.coyote = this.grounded ? 0.12 : Math.max(0, this.coyote - dt);
    if (canMove && input.pressed('Space') && this.coyote > 0 && !this.swimming) {
      v.y = 8.6;
      this.grounded = false;
      this.coyote = 0;
      this.onJump?.();
    }
    if (this.swimming) {
      const targetY = WATER_LEVEL - 1.05 + Math.sin(performance.now() / 400) * 0.05;
      v.y = (targetY - p.y) * 4;
    } else {
      v.y -= GRAVITY * dt;
    }

    p.x += v.x * dt;
    p.z += v.z * dt;
    p.y += v.y * dt;
    this.collision.pushOut(p, PLAYER_RADIUS, PLAYER_HEIGHT, 0.6);
    const support = this.collision.supportAt(p.x, p.z, p.y, PLAYER_RADIUS, 0.6);
    if (!this.swimming && p.y <= support + 0.02 && v.y <= 0) {
      if (!this.grounded && v.y < -12) this.onLand?.(v.y);
      p.y = support;
      v.y = 0;
      this.grounded = true;
      // trampoline
      const T = POI.trampoline;
      if (!inHome && Math.hypot(p.x - T.x, p.z - T.z) < 1.6 && support > 0.4) {
        v.y = 21;
        this.grounded = false;
        this.onBounce?.();
      }
    } else if (p.y > support + 0.05 || v.y > 0) {
      this.grounded = false;
    }
    if (this.swimming) this.grounded = false;
    if (p.y < -20) this.teleport(POI.spawn.x, POI.spawn.z); // sécurité
    p.x = Math.max(-WORLD_HALF - 4, Math.min(inHome ? 2000 : WORLD_HALF + 4, p.x));

    // orientation : vers la direction du mouvement
    const hs = Math.hypot(v.x, v.z);
    this.speed = hs;
    if (hs > 0.3 && mlen > 0.01) {
      const want = Math.atan2(v.x, v.z);
      let d = want - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * Math.min(1, dt * 12);
    }
    if (this.poseTimer > 0) { this.poseTimer -= dt; if (this.poseTimer <= 0) this.pose = this.carrying ? 'carry' : 'idle'; }
    if (this.pose === 'dance' && hs > 1) this.pose = 'idle';

    this.avatar.root.position.copy(p);
    if (this.pose !== 'dance' || this.dance !== 2) this.avatar.root.rotation.y = this.yaw;
    this.avatar.update(dt, { speed: hs, grounded: this.grounded, swimming: this.swimming, pose: this.pose, dance: this.dance });
  }

  // État réseau compact
  netState() {
    return {
      x: Math.round(this.pos.x * 100) / 100, y: Math.round(this.pos.y * 100) / 100, z: Math.round(this.pos.z * 100) / 100,
      ry: Math.round(this.yaw * 100) / 100, s: Math.round(this.speed * 10) / 10,
      p: this.pose, d: this.dance, g: this.grounded ? 1 : 0, w: this.swimming ? 1 : 0,
      v: this.vehicle ? this.vehicle.model : null,
    };
  }
}
