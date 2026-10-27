import * as THREE from 'three';
import { VEHICLES } from '../../shared/content/vehicles.js';
import { dimsOf } from './car-models.js';
import { groundHeight, WATER_LEVEL } from '../../shared/world-layout.js';

// Physique de conduite "arcade réaliste" commune au joueur et aux PNJ (police...) :
// accélération selon la vitesse, freinage, marche arrière, braquage qui diminue avec la vitesse
// (modèle "bicyclette"), adhérence latérale (dérapage au frein à main), collisions avec rebond,
// dégâts, carburant. Entrées : { throttle -1..1, steer -1..1 (droite > 0), handbrake }.

const tmp = new THREE.Vector3();

export class DriveSim {
  constructor(model, collision, { x = 0, z = 0, y = 0, yaw = 0 } = {}) {
    this.model = model;
    this.spec = VEHICLES[model];
    this.dims = dimsOf(model);
    this.collision = collision;
    this.pos = new THREE.Vector3(x, y, z);
    this.yaw = yaw;
    this.vx = 0; this.vz = 0;     // vitesse monde
    this.vf = 0;                  // vitesse longitudinale (m/s, négative en marche arrière)
    this.steer = 0;               // angle des roues (rad, droite > 0)
    this.yawRate = 0;
    this.brake = 0; this.reverse = 0; this.skid = 0; this.slip = 0;
    this.damage = 0;              // 0..1 (1 = en panne)
    this.fuel = this.spec.fuel;   // litres
    this.accel = 0; this.latAcc = 0;
    this.distance = 0;
    this.sunk = false;
    // colliders : cylindres le long de la caisse (les piétons et autres véhicules s'y cognent)
    const W = this.dims.W, L = this.dims.L;
    const n = this.spec.kind === 'car' ? Math.max(2, Math.round(L / (W * 0.95))) : 1;
    this.circles = [];
    const rad = this.spec.kind === 'car' ? W * 0.5 : Math.max(0.35, W * 0.5);
    for (let i = 0; i < n; i++) {
      const oz = n === 1 ? 0 : -L / 2 + rad + (i / (n - 1)) * (L - 2 * rad);
      this.circles.push({ oz, r: rad });
    }
    this.colliders = this.circles.map((c) => collision.addCyl(x, z, c.r, y, this.spec.kind === 'car' ? (this.dims.L > 6 ? 2.6 : 1.45) : 1.1, { dynamic: true, noCamera: true, owner: this, vehicle: this }));
    this.syncColliders();
  }

  get speed() { return Math.hypot(this.vx, this.vz); }
  get forward() { return tmp.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }

  maxSpeed() { return this.spec.max * (this.boost || 1) * (1 - this.damage * 0.4); }
  // Gamme de la voiture (0 = petite voiture bon marché, 1 = hypercar) : plus elle est chère, plus elle
  // tient la route (adhérence en virage, direction vive, stabilité). Véhicules de service : milieu de gamme.
  get tier() {
    if (this._tier === undefined) { const p = this.spec.price || 30000; this._tier = Math.max(0, Math.min(1, Math.log10(Math.max(1, p / 8000)) / 2.5)); }
    return this._tier;
  }
  get broken() { return this.damage >= 1; }
  get outOfFuel() { return this.spec.fuel > 0 && this.fuel <= 0; }

  syncColliders() {
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    this.circles.forEach((c, i) => { const col = this.colliders[i]; col.x = this.pos.x + fx * c.oz; col.z = this.pos.z + fz * c.oz; col.minY = this.pos.y; col.maxY = this.pos.y + (this.spec.kind === 'car' ? (this.dims.L > 6 ? 2.6 : 1.45) : 1.1); });
  }

  setEnabled(on) { for (const c of this.colliders) c.enabled = on; }

  remove() { for (const c of this.colliders) this.collision.remove(c); this.colliders = []; }

  place(x, z, yaw, y) {
    // on cherche le sol depuis 3 m au-dessus du terrain (pas sur le toit d'un auvent de station !)
    this.pos.set(x, y ?? this.collision.supportAt(x, z, groundHeight(x, z) + 3, 0.5, 0.5, this), z);
    this.yaw = yaw; this.vx = this.vz = this.vf = 0; this.steer = 0;
    this.syncColliders();
  }

  // Avance la simulation. Renvoie la liste des chocs [{ speed, nx, nz, x, z, collider }].
  update(dt, inp) {
    const sp = this.spec, D = this.dims;
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const rx = -Math.cos(this.yaw), rz = Math.sin(this.yaw); // droite
    let vf = this.vx * fx + this.vz * fz;
    let vl = this.vx * rx + this.vz * rz;
    let thr = inp.throttle || 0;
    const dead = this.broken || this.outOfFuel || this.sunk;
    if (dead && thr > 0) thr = 0.12 * thr;   // on pousse péniblement
    const maxF = this.maxSpeed();
    let acc = 0;
    this.brake = 0; this.reverse = 0;
    if (thr > 0.05) {
      if (vf < -0.4) { acc = (sp.kind === 'f1' ? 30 : 13) * thr; this.brake = 1; }
      else acc = sp.acc * thr * Math.max(0.06, 1 - (vf / maxF) ** 2);
      // limiteur de vitesse : on coupe l'accélération en douceur à l'approche de la limite
      if (this.limit && vf > this.limit - 1.5) acc = Math.min(acc, (this.limit - vf) * 2.5);
    } else if (thr < -0.05) {
      if (vf > 0.4) { acc = (sp.kind === 'f1' ? 30 : 13) * thr; this.brake = 1; }
      else { acc = sp.acc * 0.55 * thr * Math.max(0, 1 - (vf / (maxF * 0.3)) ** 2); this.reverse = 1; }
    } else {
      const roll = 0.9 + Math.abs(vf) * 0.09;
      acc = -Math.sign(vf) * Math.min(Math.abs(vf) / dt, roll);
    }
    if (inp.handbrake) { acc += -Math.sign(vf) * Math.min(Math.abs(vf) / dt, 6.5); this.brake = 1; }
    vf += acc * dt;
    this.accel = acc;
    // braquage
    const aspd = Math.abs(vf);
    // direction plus vive à basse vitesse, plus douce à haute vitesse ; le permis rend la conduite plus facile
    const L = this.licensed ? 1 : 0;
    // la F1 garde beaucoup de braquage à haute vitesse (appui aéro), une voiture de série un peu moins
    const F1 = sp.kind === 'f1';
    const maxSteer = (sp.kind === 'car' ? 0.74 : F1 ? 0.62 : 0.78) * (1 - (F1 ? 0.42 : 0.52) * Math.min(1, aspd / Math.max(10, sp.max)));
    const target = (inp.steer || 0) * maxSteer;
    const T = sp.kind === 'car' ? this.tier : F1 ? 1 : 0.5;
    this.steer += (target - this.steer) * Math.min(1, dt * (Math.abs(target) > Math.abs(this.steer) ? 10 + 5 * T + 2 * L : 13 + 4 * T + 2 * L) * (F1 ? 1.4 : 1));
    const wb = Math.max(0.6, D.zF - D.zR);
    let yawRate = -vf * Math.tan(this.steer) / wb * (sp.turn / 1.8);
    // l'adhérence plafonne la rotation : à haute vitesse la voiture vire large mais reste contrôlable
    // (au lieu de pivoter brutalement). Les voitures haut de gamme encaissent plus d'accélération latérale.
    // F1 : ~4 g d'appui aérodynamique (de plus en plus avec la vitesse) ; voitures : 1,8 à 2,9 g selon la gamme
    const aero = F1 ? 22 + 0.35 * aspd : 0;
    const latMax = (sp.kind === 'car' ? 18 + 9 * T + 3 * L : F1 ? 18 + aero : 15) * sp.grip * (inp.handbrake ? 1.8 : 1);
    if (aspd > 1 && Math.abs(yawRate * vf) > latMax) yawRate = Math.sign(yawRate) * latMax / aspd;
    if (inp.handbrake && aspd > 4) yawRate *= 1.6;
    this.yawRate = yawRate;
    // adhérence latérale : le dérapage s'amortit plus ou moins vite
    const grip = sp.grip * (inp.handbrake ? 0.22 : 1) * (1 - this.damage * 0.25);
    vl *= Math.exp(-dt * (1.5 + 11 * grip + (3 + 5 * T + 2 * L + (F1 ? 6 : 0)) * (inp.handbrake ? 0 : 1)));   // contrôle de stabilité (toutes, renforcé haut de gamme et avec le permis)
    this.slip = Math.abs(vl);
    this.latAcc = yawRate * vf;
    this.yaw += yawRate * dt;
    this.vx = fx * vf + rx * vl;
    this.vz = fz * vf + rz * vl;
    this.vf = vf;
    // dérapage visible (traces, fumée, crissement)
    const hardBrake = this.brake && aspd > 9 && !inp.handbrake ? 0.45 : 0;
    this.skid = Math.min(1, Math.max(0, (this.slip - 2.2) / 4) + hardBrake + (inp.handbrake && aspd > 5 ? 0.5 : 0));
    // déplacement
    const dx = this.vx * dt, dz = this.vz * dt;
    this.pos.x += dx; this.pos.z += dz;
    const moved = Math.hypot(dx, dz);
    this.distance += moved;
    if (sp.fuel > 0 && !dead) this.fuel = Math.max(0, this.fuel - moved / 1000 * sp.use * (1 + Math.max(0, thr) * 0.6) * 60);
    // collisions avec le décor, les autres véhicules, les gros obstacles
    const hits = this.collide();
    // sol (plateformes, trottoirs...)
    const support = this.collision.supportAt(this.pos.x, this.pos.z, this.pos.y + 0.5, 0.4, 0.55, this);
    this.pos.y += (support - this.pos.y) * Math.min(1, dt * 12);
    // eau profonde : le véhicule coule
    if (groundHeight(this.pos.x, this.pos.z) < WATER_LEVEL - 0.8) this.sunk = true;
    this.syncColliders();
    return hits;
  }

  collide() {
    const hits = [];
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    let cx = 0, cz = 0, n = 0, torque = 0;
    for (const c of this.circles) {
      const px = this.pos.x + fx * c.oz, pz = this.pos.z + fz * c.oz;
      tmp.set(px, this.pos.y, pz);
      const hit = this.collision.pushOut(tmp, c.r, 1.3, 0.45, this);
      if (!hit) continue;
      const ox = tmp.x - px, oz = tmp.z - pz;
      const len = Math.hypot(ox, oz);
      if (len < 1e-4) continue;
      cx += ox; cz += oz; n++;
      // un choc décentré fait pivoter la voiture
      torque += (c.oz * (fx * oz - fz * ox)) / (this.dims.L * this.dims.L) * 2;
      const nx = ox / len, nz = oz / len;
      const vn = this.vx * nx + this.vz * nz;
      hits.push({ speed: Math.max(0, -vn), nx, nz, x: px - nx * c.r, z: pz - nz * c.r, collider: hit, oz: c.oz });
    }
    if (!n) return hits;
    this.pos.x += cx / n; this.pos.z += cz / n;
    this.yaw += Math.max(-0.03, Math.min(0.03, torque));
    // rebond : on annule la vitesse vers l'obstacle (+ un peu de rebond), frottement le long du mur
    const l = Math.hypot(cx, cz) || 1, nx = cx / l, nz = cz / l;
    const vn = this.vx * nx + this.vz * nz;
    if (vn < 0) {
      const e = 0.25;
      this.vx -= (1 + e) * vn * nx; this.vz -= (1 + e) * vn * nz;
      const tx = -nz, tz = nx, vt = this.vx * tx + this.vz * tz;
      this.vx -= vt * tx * 0.15; this.vz -= vt * tz * 0.15;
    }
    return hits;
  }

  // Applique un choc reçu de l'extérieur (autre véhicule qui nous percute...)
  push(vx, vz) { this.vx += vx; this.vz += vz; }
}
