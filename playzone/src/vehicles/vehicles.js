import * as THREE from 'three';
import { CarVisual, seatOf, dimsOf } from './car-models.js';
import { DriveSim } from './drive.js';
import { SkidMarks } from './skidmarks.js';
import { VEHICLES, CAR_PAINTS } from '../../shared/content/vehicles.js';
import { h } from '../ui/dom.js';

// VÉHICULES DU JOUEUR : appeler un véhicule possédé, monter / descendre (la portière s'ouvre),
// conduire (Z/S ou flèches : accélérer / freiner / marche arrière, Q/D : tourner, Espace : frein à main,
// H : klaxon), chocs et dégâts visibles, carburant, traces de pneus, son du moteur, compteur.

export const VEHICLE_ICON = { board: '🛴', caddie: '🛒', bike: '🚲', scooter: '🛵', moto: '🏍️' };
export function vehicleIcon(model) {
  const s = VEHICLES[model];
  if (!s) return '🚗';
  if (s.kind !== 'car') return VEHICLE_ICON[s.kind] || '🛵';
  return { police: '🚓', ambulance: '🚑', pompiers: '🚒', taxi: '🚕', bus: '🚌', suv: '🚙', pickup: '🛻', fourgon: '🚐', camion: '🚚', glace: '🍦', depanneuse: '🛻', sportive: '🏎️' }[model] || '🚗';
}
export function vehicleName(model) { return VEHICLES[model]?.name || model; }

const ENGINE_KIND = { board: null, caddie: null, bike: null, scooter: 'moto', moto: 'moto' };
const tmpV = new THREE.Vector3();
let nextUid = 1;

// Véhicule présent dans le monde (possédé, emprunté, PNJ...) : simulation + rendu.
export class WorldVehicle {
  constructor(game, { model, color = '#e63946', x, z, yaw = 0, owner = 'me', data = null, locked = false, driver = null, driverKey = '' }) {
    this.game = game;
    this.uid = nextUid++;
    this.model = model;
    this.spec = VEHICLES[model];
    this.dims = dimsOf(model);
    this.seat = seatOf(model);
    this.owner = owner;
    this.data = data;
    this.locked = locked;
    this.color = color;
    this.visual = new CarVisual(model, { paint: color, driver, driverKey });
    game.engine.scene.add(this.visual.root);
    this.sim = new DriveSim(model, game.collision, { x, z, yaw });
    this.sim.place(x, z, yaw);
    this.door = 0; this.doorTarget = 0;
    this.smokeT = 0;
    this.sleep = 0;
    this.lastHit = 0;
    if (data) { this.sim.damage = data.damage || 0; if (data.fuel !== undefined) this.sim.fuel = data.fuel; }
    this.updateVisual(0);
  }

  get pos() { return this.sim.pos; }
  get yaw() { return this.sim.yaw; }

  // point d'accès (portière conducteur, à gauche) dans le monde
  doorPoint(out = tmpV) {
    const s = this.sim, fx = Math.sin(s.yaw), fz = Math.cos(s.yaw), lx = Math.cos(s.yaw), lz = -Math.sin(s.yaw);
    if (this.spec.kind !== 'car') return out.set(s.pos.x + lx * 0.8, s.pos.y, s.pos.z + lz * 0.8);
    const side = this.dims.W / 2 + 0.75;
    return out.set(s.pos.x + lx * side + fx * this.seat.z, s.pos.y, s.pos.z + lz * side + fz * this.seat.z);
  }

  setPaint(c) { this.color = c; this.visual.setPaint(c); }

  updateVisual(dt, t = 0, night = 0) {
    const v = this.visual, s = this.sim, u = v.u;
    v.root.position.copy(s.pos);
    v.root.rotation.y = s.yaw;
    v.roll(s.vf * dt, -s.steer);
    // caisse : tangage au freinage / à l'accélération, roulis en virage (deux-roues : inclinaison)
    const two = this.spec.kind !== 'car' && this.spec.kind !== 'caddie';
    const pitch = Math.max(-0.045, Math.min(0.045, -s.accel * 0.0045));
    const roll = two ? Math.max(-0.5, Math.min(0.5, s.latAcc * 0.05)) : Math.max(-0.05, Math.min(0.05, s.latAcc * 0.0045));
    const k = Math.min(1, dt * 6);
    v.tilt.rotation.x += (pitch - v.tilt.rotation.x) * k;
    v.tilt.rotation.z += ((two && s.speed < 0.3 && !this.driven ? 0.18 : roll) - v.tilt.rotation.z) * k;
    u.uBrake.value = s.brake ? 1 : 0;
    u.uRev.value = s.reverse && s.vf < -0.2 ? 1 : 0;
    v.setLights(this.driven || this.lightsOn ? Math.max(night, this.lightsOn ? 1 : 0) : 0);
    u.uBlink.value = s.broken || this.hazard ? 1 : 0;
    u.uDamage.value = Math.min(1, s.damage * 0.85);
    u.uTime.value = t;
    // portière
    this.door += (this.doorTarget - this.door) * Math.min(1, dt * 7);
    u.uDoor.value = this.door * 1.15;
  }

  dispose() {
    this.game.engine.scene.remove(this.visual.root);
    this.visual.dispose();
    this.sim.remove();
  }
}

export class Vehicles {
  constructor(game) {
    this.game = game;
    this.list = [];          // véhicules du joueur présents dans le monde
    this.current = null;     // véhicule conduit
    this.summoned = null;    // véhicule possédé appelé
    this.skids = new SkidMarks(game.engine.scene);
    this.nearest = null;
    this.handbrake = false;
    this.dash = h('div.dash.hidden',
      this.dashSpeed = h('div.speed', '0'), h('div.unit', 'km/h'),
      h('div.gauges',
        h('div.g', h('span', '⛽'), h('div.bar', this.fuelBar = h('div'))),
        h('div.g', h('span', '🔧'), h('div.bar.dmg', this.dmgBar = h('div')))),
      this.dashName = h('div.name', ''));
    game.ui.root.append(this.dash);
    game.interactions.add({
      r: 1.9, priority: 3,
      x: () => this.nearest?.doorPoint().x ?? 1e9, z: () => this.nearest?.doorPoint().z ?? 1e9,
      enabled: () => !!this.nearest && !this.current && game.player.zone === 'world',
      label: () => this.enterLabel(this.nearest),
      action: () => this.tryEnter(this.nearest),
    });
    game.interactions.add({
      zone: 'any', r: 6, priority: 10,
      x: () => game.player.pos.x, z: () => game.player.pos.z,
      enabled: () => !!this.current, label: () => (this.current?.sim.speed > 3 ? '🚪 Sauter du véhicule !' : '🚪 Descendre du véhicule'), action: () => this.exit(),
    });
    game.input.on('key', (e) => {
      if (!this.current || game.ui.blocking) return;
      if (e.code === 'KeyH') this.honk();
      if (e.code === 'KeyL') { this.current.lightsOn = !this.current.lightsOn; game.ui.toast(this.current.lightsOn ? 'Phares allumés' : 'Phares automatiques', '', 1200); }
    });
    addEventListener('keydown', (e) => { if (e.code === 'Space' && this.current) { this.handbrake = true; e.preventDefault(); } });
    addEventListener('keyup', (e) => { if (e.code === 'Space') this.handbrake = false; });
    game.on('profile', (p) => {
      const s = this.summoned;
      if (!s) return;
      const v = p.vehicles.find((x) => x.id === s.data.id);
      if (!v) { this.despawn(s); return; }
      if (v.color !== s.color) s.setPaint(v.color);
      s.data = v;
    });
  }

  get driving() { return !!this.current; }
  get parked() { return this.summoned; }

  enterLabel(v) {
    if (!v) return '';
    const name = vehicleName(v.model);
    if (v.owner === 'me') return `${vehicleIcon(v.model)} Monter : ${name}`;
    if (v.locked) return `🔒 ${name} (verrouillé)`;
    return `${vehicleIcon(v.model)} Monter : ${name}`;
  }

  tryEnter(v) {
    const g = this.game;
    if (!v) return;
    if (v.locked && v.owner !== 'me') { g.sfx('lock'); g.ui.toast('C\'est verrouillé. Ce véhicule n\'est pas à toi.', 'bad'); return; }
    this.enter(v);
  }

  // Véhicule possédé : appelé près du joueur (place libre la plus proche).
  summon(vehicleId) {
    const g = this.game;
    if (g.player.zone !== 'world') { g.ui.toast('Impossible d\'appeler un véhicule ici.', 'bad'); return; }
    const data = g.profile.vehicles.find((x) => x.id === vehicleId);
    if (!data || !VEHICLES[data.model]) return;
    if (this.current) this.exit(true);
    if (this.summoned) this.despawn(this.summoned);
    const spot = this.freeSpot(data.model);
    if (!spot) { g.ui.toast('Pas assez de place ici pour garer ce véhicule. Va dans un endroit plus dégagé.', 'bad'); return; }
    const veh = new WorldVehicle(g, { model: data.model, color: data.color, x: spot.x, z: spot.z, yaw: spot.yaw, owner: 'me', data });
    this.summoned = veh;
    this.list.push(veh);
    g.fx.burst(veh.pos, '#ffffff', 16);
    g.sfx('pop');
    g.ui.toast(`${vehicleName(data.model)} livré(e) à côté de toi ! Approche-toi de la portière et appuie sur E.`, 'good');
  }

  // Cherche une place libre autour du joueur pour un véhicule.
  freeSpot(model) {
    const g = this.game, P = g.player.pos, d = dimsOf(model);
    const yaw0 = g.player.yaw;
    const dist = d.W / 2 + 1.6;
    for (const [side, along] of [[-1, 0], [1, 0], [-1, 3], [1, 3], [-1, -3], [1, -3], [0, 6], [0, -6]]) {
      const lx = Math.cos(yaw0) * side * dist + Math.sin(yaw0) * along, lz = -Math.sin(yaw0) * side * dist + Math.cos(yaw0) * along;
      const x = P.x + lx, z = P.z + lz;
      let free = true;
      for (let k = -1; k <= 1 && free; k++) {
        const cx = x + Math.sin(yaw0) * k * (d.L / 2 - d.W / 2), cz = z + Math.cos(yaw0) * k * (d.L / 2 - d.W / 2);
        tmpV.set(cx, g.collision.supportAt(cx, cz, P.y + 0.5, 0.5), cz);
        const before = tmpV.clone();
        g.collision.pushOut(tmpV, d.W / 2, 1.4, 0.45);
        if (tmpV.distanceTo(before) > 0.05 || Math.abs(before.y - P.y) > 1.2) free = false;
      }
      if (free) return { x, z, yaw: yaw0 };
    }
    return null;
  }

  despawn(v) {
    if (!v) return;
    if (v === this.current) this.exit(true);
    this.saveState(v);
    v.dispose();
    this.list = this.list.filter((x) => x !== v);
    if (v === this.summoned) this.summoned = null;
  }

  enter(v) {
    const g = this.game;
    if (g.player.carrying || g.jobs?.active?.job.id === 'cook') { g.ui.toast('Impossible de conduire maintenant.', 'bad'); return; }
    this.current = v;
    v.driven = true;
    v.doorTarget = 1;
    setTimeout(() => { if (this.current === v) v.doorTarget = 0; }, 450);
    g.player.vehicle = { model: v.model, id: v.data?.id, color: v.color };
    this.baseScale = g.avatar.root.scale.x;
    g.sfx('door');
    if (ENGINE_KIND[v.spec.kind] !== null && v.spec.kind !== 'bike') setTimeout(() => g.sfx('start'), 350);
    this.camDist = g.cam.dist;
    g.cam.dist = Math.max(g.cam.dist, v.spec.kind === 'car' ? 6 + v.dims.L * 0.9 : 6);
    this.dash.classList.remove('hidden');
    this.dashName.textContent = `${vehicleIcon(v.model)} ${vehicleName(v.model)}`;
    const touch = g.input.isTouch;
    g.hud.track('vehicle', { title: `${vehicleIcon(v.model)} ${vehicleName(v.model)}`, text: touch ? 'Joystick : avancer / tourner. ✋ : descendre.' : 'Z/S : avancer / freiner / reculer · Q/D : tourner · Espace : frein à main · H : klaxon · L : phares · E : descendre' });
    this.emit('enter', v);
  }

  exit(silent = false) {
    const g = this.game, v = this.current;
    if (!v) return;
    this.current = null;
    v.driven = false;
    this.handbrake = false;
    g.player.vehicle = null;
    g.avatar.root.scale.setScalar(this.baseScale || 1);
    g.avatar.root.rotation.set(0, v.yaw, 0);
    // on descend côté conducteur (ou on saute si ça roule)
    const p = v.doorPoint(new THREE.Vector3());
    if (!silent) { v.doorTarget = 1; setTimeout(() => { v.doorTarget = 0; }, 600); g.sfx('door'); }
    g.player.teleport(p.x, p.z, v.yaw + Math.PI / 2);
    if (v.sim.speed > 3 && !silent) { g.player.vel.set(v.sim.vx * 0.4, 5, v.sim.vz * 0.4); g.player.grounded = false; g.ui.toast('Cascade ! 🤸', '', 1500); }
    g.cam.dist = this.camDist || 9;
    g.sound.engineStop();
    g.sound.skid(0);
    this.dash.classList.add('hidden');
    g.hud.track('vehicle', null);
    this.saveState(v);
    this.emit('exit', v);
  }

  emit(type, v) { this.game.emit(`vehicle.${type}`, v); }

  honk() {
    const v = this.current;
    this.game.sfx(v && (v.dims.L > 5.5) ? 'horn-truck' : 'honk');
    this.game.labels.bubble(this.game.avatar.root, 'Pouet pouet !', 1500, 'player');
    this.game.emit('honk', v);
  }

  // Envoie l'état (dégâts, carburant) d'un véhicule possédé à l'autorité.
  saveState(v) {
    if (!v?.data || v.owner !== 'me') return;
    const d = Math.round(v.sim.damage * 1000) / 1000, f = Math.round(v.sim.fuel * 10) / 10;
    if (d === v.data.damage && f === v.data.fuel) return;
    this.game.net.request('vehicle.state', { vehicleId: v.data.id, damage: d, fuel: f }).catch(() => {});
  }

  // Chocs : dégâts, bosses, étincelles, son, secousse.
  onHits(v, hits, impactScale = 1) {
    const g = this.game;
    for (const hit of hits) {
      if (hit.speed < 1.5) continue;
      const now = performance.now();
      const sev = Math.min(1, (hit.speed - 1.5) / 18) * impactScale;
      v.sim.damage = Math.min(1, v.sim.damage + sev * 0.22 * (v.spec.kind === 'car' ? 1 : 0.6));
      // coordonnées locales du point d'impact
      const dx = hit.x - v.pos.x, dz = hit.z - v.pos.z;
      const s = Math.sin(-v.yaw), c = Math.cos(-v.yaw);
      const lx = dx * c + dz * s, lz = -dx * s + dz * c;
      if (v.spec.kind === 'car' && sev > 0.08) v.visual.dent(Math.max(-v.dims.W / 2, Math.min(v.dims.W / 2, lx)), 0.7, Math.max(-v.dims.L / 2, Math.min(v.dims.L / 2, lz)), sev * 1.4);
      if (now - v.lastHit > 250) {
        v.lastHit = now;
        g.sfx(sev > 0.25 ? 'crash' : 'bump');
        if (v === this.current) g.cam.shake = Math.min(1.2, 0.3 + sev * 1.5);
        g.fx.emit({ x: hit.x, y: v.pos.y + 0.6, z: hit.z, n: 6 + Math.round(sev * 20), colors: ['#ffd23f', '#ff9f1c', '#ffffff'], speed: 4 + sev * 6, gravity: 12, life: 0.4, size: 0.12 });
        if (sev > 0.3) g.fx.emit({ x: hit.x, y: v.pos.y + 0.8, z: hit.z, n: 8, colors: ['#9aa0a8', '#c7ccd4'], speed: 2, gravity: -1, life: 1.2, size: 0.6, grow: 1 });
        // autre véhicule percuté : il prend aussi
        const other = hit.collider?.vehicle || hit.collider?.car;
        if (other) g.emit('vehicle.bump', { by: v, other, sev, hit });
        if (v.sim.broken && v === this.current) g.ui.toast('💥 Ton véhicule est en panne ! Appelle la dépanneuse depuis le téléphone (appli Garage).', 'bad', 5000);
      }
    }
  }

  update(dt, t) {
    const g = this.game;
    const night = g.world?.dayNight?.night || 0;
    const camPos = g.engine.camera.position;
    for (const v of this.list) {
      if (v !== this.current) {
        // véhicule libre : il finit de rouler puis s'endort
        if (v.sim.speed > 0.05 || v.sleep < 1) {
          const hits = v.sim.update(dt, { throttle: 0, steer: 0, handbrake: v.sim.speed < 3 });
          this.onHits(v, hits, 0.6);
          v.sleep = v.sim.speed < 0.05 ? v.sleep + dt : 0;
        }
      }
      const d = camPos.distanceTo(v.pos);
      v.visual.setDetail(d < 60 ? 0 : d < 220 ? 1 : 2);
      v.updateVisual(dt, t, night);
      this.effects(v, dt);
    }
    // véhicule accessible le plus proche
    this.nearest = null;
    if (!this.current && g.player.zone === 'world') {
      let bd = 2.4;
      for (const v of [...this.list, ...(g.traffic?.enterable?.() || [])]) {
        if (v.driven) continue;
        const d = v.doorPoint().distanceTo(g.player.pos);
        if (d < bd) { bd = d; this.nearest = v; }
      }
    }
    if (this.summoned && g.player.zone !== 'world' && !this.current) this.despawn(this.summoned);
    this.skids.update(dt);
    if (!this.current) return;
    this.drive(dt, t);
  }

  drive(dt, t) {
    const g = this.game, v = this.current, s = v.sim, inp = g.input;
    const frozen = g.ui.blocking || g.cutscene;
    const ctl = { throttle: frozen ? 0 : inp.move.y, steer: frozen ? 0 : inp.move.x, handbrake: frozen ? false : this.handbrake || g.touch?.handbrake };
    const fuelBefore = s.fuel;
    const hits = s.update(dt, ctl);
    this.onHits(v, hits, 1);
    if (fuelBefore > 0 && s.fuel <= 0 && s.spec.fuel > 0) g.ui.toast('⛽ Panne sèche ! Pousse ton véhicule jusqu\'à une station-service, ou appelle la dépanneuse.', 'bad', 5000);
    if (s.sunk) {
      g.ui.toast('Glouglou... ton véhicule a coulé. La dépanneuse le ramène (rappelle-le depuis le téléphone).', 'bad', 5000);
      g.sfx('splat');
      s.damage = Math.max(s.damage, 0.6);
      const back = s.pos.clone().sub(new THREE.Vector3(Math.sin(s.yaw), 0, Math.cos(s.yaw)).multiplyScalar(6));
      this.exit(true);
      g.player.teleport(back.x, back.z, s.yaw);
      this.despawn(v);
      return;
    }
    // le personnage est assis dans le véhicule
    const p = g.player, seat = v.seat;
    const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw), lx = Math.cos(s.yaw), lz = -Math.sin(s.yaw);
    p.pos.set(s.pos.x + fx * seat.z + lx * seat.x, s.pos.y + seat.y, s.pos.z + fz * seat.z + lz * seat.x);
    p.yaw = s.yaw;
    p.speed = s.speed;
    p.grounded = true;
    const av = g.avatar.root;
    av.position.copy(p.pos);
    av.rotation.set(v.visual.tilt.rotation.x, s.yaw, v.visual.tilt.rotation.z, 'YXZ');
    av.scale.setScalar((this.baseScale || 1) * seat.s);
    g.avatar.update(dt, { speed: 0, grounded: true, pose: seat.pose });
    // caméra : se replace derrière le véhicule, recule avec la vitesse
    if (Math.abs(s.vf) > 2 && !inp.look.dx) {
      const want = s.yaw + Math.PI + (s.vf < 0 ? Math.PI : 0) * 0;
      g.cam.yaw += Math.atan2(Math.sin(want - g.cam.yaw), Math.cos(want - g.cam.yaw)) * Math.min(1, dt * 2.4);
    }
    // son moteur / pneus
    const ratio = Math.abs(s.vf) / v.spec.max;
    const gears = 5, gpos = ratio * gears, gear = Math.min(gears - 1, Math.floor(gpos));
    const rpm = s.broken ? 0.05 : Math.min(1, 0.18 + (gpos - gear) * 0.7 + gear * 0.04);
    const kind = v.spec.kind === 'car' ? (v.dims.L > 5.5 ? 'truck' : 'car') : ENGINE_KIND[v.spec.kind];
    g.sound.engine(s.outOfFuel || s.broken ? null : { kind, rpm, load: Math.max(0, ctl.throttle) });
    g.sound.skid(s.skid * Math.min(1, s.speed / 6));
    // compteur
    this._dashT = (this._dashT || 0) + dt;
    if (this._dashT > 0.1) {
      this._dashT = 0;
      this.dashSpeed.textContent = Math.round(s.speed * 3.6);
      this.fuelBar.style.width = `${v.spec.fuel ? Math.round((s.fuel / v.spec.fuel) * 100) : 100}%`;
      this.fuelBar.parentElement.parentElement.style.display = v.spec.fuel ? '' : 'none';
      this.dmgBar.style.width = `${Math.round((1 - s.damage) * 100)}%`;
    }
    // sauvegarde périodique de l'état
    this._saveT = (this._saveT || 0) + dt;
    if (this._saveT > 15) { this._saveT = 0; this.saveState(v); }
  }

  // Traces de pneus, fumée de dérapage, fumée de moteur abîmé.
  effects(v, dt) {
    const g = this.game, s = v.sim;
    const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw), lx = Math.cos(s.yaw), lz = -Math.sin(s.yaw);
    const D = v.dims;
    if (s.skid > 0.25 && s.speed > 2 && v.spec.kind !== 'board') {
      const half = D.track || 0;
      for (const side of half ? [-1, 1] : [0]) {
        const x = s.pos.x + fx * D.zR + lx * side * half, z = s.pos.z + fz * D.zR + lz * side * half;
        this.skids.add(`${v.uid}r${side}`, x, s.pos.y, z, v.spec.kind === 'car' ? 0.24 : 0.12, Math.min(1, s.skid));
      }
      if (Math.random() < dt * 25 * s.skid) g.fx.emit({ x: s.pos.x + fx * D.zR, y: s.pos.y + 0.25, z: s.pos.z + fz * D.zR, n: 1, colors: ['#d8d8d8', '#bfbfbf'], speed: 1, gravity: -1.5, life: 1.0, size: 0.7, grow: 1.4, jitter: 1 });
    } else {
      for (const side of [-1, 0, 1]) this.skids.lift(`${v.uid}r${side}`);
    }
    v.smokeT -= dt;
    if (s.damage > 0.45 && v.smokeT <= 0 && v.visual.lod === 0) {
      v.smokeT = s.damage > 0.85 ? 0.08 : 0.25;
      const black = s.damage > 0.85;
      g.fx.emit({ x: s.pos.x + fx * (D.L / 2 - 0.6), y: s.pos.y + (v.spec.kind === 'car' ? 1.0 : 0.7), z: s.pos.z + fz * (D.L / 2 - 0.6), n: 1, colors: black ? ['#3a3a3a', '#555555'] : ['#c8c8c8', '#a8a8a8'], speed: 1.2, gravity: -2, life: 1.6, size: 0.6, grow: 1.6, jitter: 0.4 });
    }
  }

  mapMarkers() {
    return this.summoned && !this.summoned.driven ? [{ x: this.summoned.pos.x, z: this.summoned.pos.z, color: '#2ec4b6', icon: vehicleIcon(this.summoned.model), r: 4 }] : [];
  }
}

// Panneau "Garage" (téléphone) : appeler un véhicule, voir son état, le repeindre.
export function garagePanel(game, container, refresh) {
  const p = game.profile;
  if (!p.vehicles.length) { container.append(h('p', 'Tu n\'as pas encore de véhicule. Le Garage Roule-Toujours (Grande Place, côté est) en vend.')); return; }
  for (const v of p.vehicles) {
    const spec = VEHICLES[v.model];
    if (!spec) continue;
    const state = [];
    if (spec.fuel) state.push(`⛽ ${Math.round(((v.fuel ?? spec.fuel) / spec.fuel) * 100)} %`);
    state.push(`🔧 ${Math.round((1 - (v.damage || 0)) * 100)} %`);
    container.append(h('div.list-item', h('span', { style: { fontSize: '26px' } }, vehicleIcon(v.model)),
      h('div.grow', h('div.t', spec.name), h('div.d', h('span', { style: { display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: v.color, verticalAlign: 'middle', marginRight: '6px' } }), state.join(' · '))),
      h('button.btn.small', { onclick: () => { game.phone?.close(); game.vehicles.summon(v.id); } }, 'Appeler')));
  }
  container.append(h('p.muted', { style: { marginTop: '10px' } }, `Peintures en stock : ${p.inventory.peinture || 0} (Garage Roule-Toujours, 150 PC).`));
  if (p.inventory.peinture > 0) {
    for (const v of p.vehicles) {
      container.append(h('div.field', h('label', `Repeindre : ${vehicleName(v.model)}`), h('div.swatches', CAR_PAINTS.map((c) => h('button.swatch', {
        style: { background: c }, onclick: async () => { try { await game.net.request('vehicle.paint', { vehicleId: v.id, color: c }); game.ui.toast('Nouvelle couleur !', 'good'); refresh?.(); } catch (e) { game.ui.toast(e.message, 'bad'); } },
      })))));
    }
  }
}
