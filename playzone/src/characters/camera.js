import * as THREE from 'three';

// Caméra à la troisième personne : orbite autour du joueur (glisser la souris / le doigt),
// zoom à la molette, et se rapproche quand un mur la gênerait.

export class ThirdPersonCamera {
  constructor(camera, collision) {
    this.camera = camera;
    this.collision = collision;
    this.yaw = 0;          // la caméra est "derrière" le joueur quand yaw = lacet du joueur + PI... on part de 0
    this.pitch = 0.42;
    this.dist = 9;
    this.minDist = 2.5;
    this.maxDist = 22;
    this.curDist = 9;
    this.target = new THREE.Vector3();
    this.smoothTarget = new THREE.Vector3();
    this.idle = 0;
    this.shake = 0;
    this.override = null;  // { pos, look } pour une vue fixe (mini-jeu, cuisine)
    this.inside = null;    // { pitch, dist } : vue plongeante à l'intérieur d'un bâtiment
  }

  snap(target, yaw) {
    this.smoothTarget.copy(target);
    if (yaw !== undefined) this.yaw = yaw;
  }

  update(dt, target, input) {
    const sens = input.isTouch ? 0.0075 : 0.0055;
    if (input.look.dx || input.look.dy) this.idle = 0; else this.idle += dt;
    this.yaw -= input.look.dx * sens;
    this.pitch = Math.max(-0.15, Math.min(1.25, this.pitch + input.look.dy * sens * 0.8));
    if (input.zoom) this.dist = Math.max(this.minDist, Math.min(this.maxDist, this.dist * (1 + input.zoom * 0.12)));

    if (this.override) {
      const o = this.override;
      this.camera.position.lerp(o.pos, 1 - Math.exp(-dt * 5));
      this.camera.lookAt(o.look);
      return;
    }

    // à l'intérieur : la caméra plonge (toit et murs côté caméra escamotés)
    if (this.inside) {
      if (!(input.look.dx || input.look.dy)) this.pitch += (this.inside.pitch - this.pitch) * Math.min(1, dt * 3);
      this.pitch = Math.max(0.55, this.pitch);
    }
    this.smoothTarget.lerp(target, 1 - Math.exp(-dt * 14));
    const t = this.smoothTarget;
    const hx = t.x, hy = t.y + 1.6, hz = t.z;
    const cp = Math.cos(this.pitch);
    const dx = Math.sin(this.yaw) * cp, dy = Math.sin(this.pitch), dz = Math.cos(this.yaw) * cp;
    const dist = this.inside ? Math.min(this.dist, this.inside.dist) : this.dist;
    const free = this.collision.segmentFree(hx, hy, hz, hx + dx * dist, hy + dy * dist, hz + dz * dist);
    const want = Math.max(this.minDist * 0.6, dist * free - 0.2);
    this.curDist += (want - this.curDist) * (want < this.curDist ? 1 : 1 - Math.exp(-dt * 3));
    const d = this.curDist;
    let cy = hy + dy * d;
    cy = Math.max(cy, t.y + 0.4 - 1.6 + 1.0);
    this.camera.position.set(hx + dx * d, cy, hz + dz * d);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2);
      this.camera.position.x += (Math.random() - 0.5) * this.shake * 0.4;
      this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.4;
    }
    this.camera.lookAt(hx, hy, hz);
  }

  // Lacet "avant" de la caméra (pour les déplacements) : la caméra regarde vers -direction.
  get forwardYaw() { return this.yaw; }
}
