import * as THREE from 'three';
import { h } from '../ui/dom.js';
import { CarVisual } from '../vehicles/car-models.js';
import { Avatar } from '../characters/avatar.js';
import { BUILDINGS, findRoute, nearestRoadPoint } from '../../shared/world-layout.js';
import { DEFAULT_APPEARANCE, SKINS, COLORS } from '../../shared/appearance.js';
import { ASSIST } from '../../shared/justice.js';

// URGENCES ET VIE DE LA RUE : incendies (fumée, flammes, pompiers qui arrivent et éteignent),
// courses-poursuites entre la police et des conducteurs PNJ (on peut aider en percutant le fuyard),
// voleurs à la tire PNJ (« Au voleur ! » : un coup de poing et c'est réglé), appli Urgences (112).

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const OFFICER = { ...DEFAULT_APPEARANCE, skin: '#c68642', hair: 'court', top: 'chemise', topColor: '#1d3557', bottom: 'jean', bottomColor: '#14213d', hat: 'casquette' };
const FIREFIGHTER = { ...DEFAULT_APPEARANCE, skin: '#e0ac69', top: 'chemise', topColor: '#d62828', bottom: 'jean', bottomColor: '#2b2d42', hat: 'casque-pompier' };
const CIVIL_CARS = ['citadine', 'berline', 'break', 'suv', 'coupe', 'sportive', 'pickup'];

// Véhicule « scripté » qui suit un itinéraire routier (sans physique), avec un collider pour être percuté.
class RouteCar {
  constructor(g, model, route, speed, opts = {}) {
    this.g = g; this.route = route; this.i = 1; this.speed = speed;
    this.vis = new CarVisual(model, { paint: opts.paint || pick(COLORS), driver: opts.driver || { skin: pick(SKINS.slice(0, 8)), hair: '#2b1a10', top: pick(COLORS) }, driverKey: opts.key || 'urg' });
    if (opts.siren) this.vis.u.uSiren.value = 1;
    this.vis.u.uLights.value = 1;
    this.pos = new THREE.Vector3(route[0].x, 0, route[0].z);
    this.yaw = 0;
    this.vis.root.position.copy(this.pos);
    g.engine.scene.add(this.vis.root);
    this.col = g.collision.addCyl(this.pos.x, this.pos.z, 1.3, 0, 1.6, { dynamic: true, noCamera: true });
    this.done = false;
  }
  update(dt) {
    if (this.done) return;
    const tgt = this.route[this.i];
    if (!tgt) { this.done = true; return; }
    const dx = tgt.x - this.pos.x, dz = tgt.z - this.pos.z, d = Math.hypot(dx, dz);
    const step = this.speed * dt;
    if (d <= step) { this.pos.x = tgt.x; this.pos.z = tgt.z; this.i++; }
    else { this.pos.x += (dx / d) * step; this.pos.z += (dz / d) * step; }
    const want = Math.atan2(dx, dz);
    let dy = want - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.yaw += dy * Math.min(1, dt * 6);
    this.vis.root.position.set(this.pos.x, 0, this.pos.z);
    this.vis.root.rotation.y = this.yaw;
    this.vis.roll(step, -dy);
    this.vis.u.uTime.value = performance.now() / 1000;
    this.col.x = this.pos.x; this.col.z = this.pos.z;
  }
  dispose() { this.g.engine.scene.remove(this.vis.root); this.vis.dispose(); this.g.collision.remove(this.col); }
}

export class Emergencies {
  constructor(g) {
    this.g = g;
    this.fires = [];
    this.chase = null;
    this.thief = null;
    this.trucks = [];
    this.nextFire = 120 + Math.random() * 120;
    this.nextChase = 60 + Math.random() * 90;
    this.nextThief = 90 + Math.random() * 90;
    this.waterMat = new THREE.MeshBasicMaterial({ color: '#9bd5ff', transparent: true, opacity: 0.55 });
  }

  get busy() { const g = this.g; return !!(g.races?.s || g.football?.s || g.ski?.s || g.wingfoil?.s || g.jetski?.s || g.karting?.s || g.profile?.justice?.jail || g.player.zone !== 'world'); }

  // ------------------------------------------------------------------------------ incendies
  startFire(b = null) {
    const g = this.g, P = g.player.pos;
    if (!b) {
      const cands = BUILDINGS.filter((x) => !x.secret && x.id !== 'prison' && x.id !== 'pompiers' && x.h && Math.hypot(x.x - P.x, x.z - P.z) > 40 && Math.hypot(x.x - P.x, x.z - P.z) < 180);
      if (!cands.length) return null;
      b = pick(cands);
    }
    const grp = new THREE.Group();
    const flames = [];
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.8 + Math.random() * 0.8, 2.5 + Math.random() * 2, 7), new THREE.MeshBasicMaterial({ color: i % 2 ? '#ff7b00' : '#ffd23f', transparent: true, opacity: 0.85 }));
      m.position.set((Math.random() - 0.5) * b.w * 0.7, b.h + 1, (Math.random() - 0.5) * b.d * 0.7);
      grp.add(m); flames.push(m);
    }
    grp.position.set(b.x, 0, b.z);
    g.engine.scene.add(grp);
    const f = { b, grp, flames, life: 1, called: false, truck: null, t: 0, autoCall: 60 + Math.random() * 40 };
    this.fires.push(f);
    g.ui.toast(`🔥 Incendie : ${b.name} ! Appelle les pompiers (appli Urgences 🚨 du téléphone).`, 'bad', 6000);
    g.sfx('horn-truck');
    return f;
  }

  nearestFire(r = 250) {
    const P = this.g.player.pos;
    let best = null, bd = r;
    for (const f of this.fires) { const d = Math.hypot(f.b.x - P.x, f.b.z - P.z); if (d < bd && f.life > 0) { bd = d; best = f; } }
    return best;
  }

  sendTruck(f) {
    const g = this.g;
    if (!f || f.truck) return;
    f.called = true;
    // le camion part de loin et arrive par les routes
    const ang = Math.random() * Math.PI * 2;
    const from = nearestRoadPoint(f.b.x + Math.sin(ang) * 160, f.b.z + Math.cos(ang) * 160);
    const to = nearestRoadPoint(f.b.x, f.b.z);
    const route = findRoute(from.x, from.z, to.x, to.z) || [from, to];
    route.unshift({ x: from.x, z: from.z }); route.push({ x: to.x, z: to.z });
    const truck = new RouteCar(g, 'pompiers', route, 15, { siren: true, key: 'pompier', driver: { skin: '#e0ac69', hair: '#2b1a10', top: '#d62828', hat: '#ffd23f' } });
    f.truck = { car: truck, crew: [], spray: 0 };
    this.trucks.push(truck);
  }

  updateFire(f, dt) {
    const g = this.g;
    f.t += dt;
    for (const [i, m] of f.flames.entries()) { const k = f.life * (0.75 + Math.sin(f.t * 9 + i) * 0.25); m.scale.set(k, k * (1 + Math.sin(f.t * 13 + i * 2) * 0.2), k); m.visible = f.life > 0.05; }
    if (f.life > 0 && Math.random() < dt * 6) g.fx.emit({ x: f.b.x + (Math.random() - 0.5) * f.b.w * 0.5, y: f.b.h + 3, z: f.b.z + (Math.random() - 0.5) * f.b.d * 0.5, n: 2, colors: ['#4a4a4a', '#6b6b6b', '#2b2b2b'], speed: 1.2, gravity: -2.5, life: 3, size: 1.2, grow: 2 });
    // quelqu'un finit par appeler les pompiers
    if (!f.called && f.t > f.autoCall) { this.sendTruck(f); g.ui.toast(`🚒 Un voisin a appelé les pompiers pour ${f.b.name}.`, '', 3500); }
    const tr = f.truck;
    if (tr) {
      tr.car.update(dt);
      if (tr.car.done && !tr.crew.length) {
        // les pompiers descendent et arrosent
        for (let k = 0; k < 2; k++) {
          const av = new Avatar(FIREFIGHTER, {});
          av.root.position.set(tr.car.pos.x + (k ? 2 : -2), 0, tr.car.pos.z + 2);
          av.root.rotation.y = Math.atan2(f.b.x - tr.car.pos.x, f.b.z - tr.car.pos.z);
          g.engine.scene.add(av.root); tr.crew.push(av);
        }
        g.labels.bubble(tr.crew[0].root, 'Pompiers ! Écartez-vous !', 2500);
      }
      if (tr.crew.length) {
        for (const av of tr.crew) {
          av.update(dt, { speed: 0, grounded: true, pose: 'spray' });
          if (Math.random() < dt * 14) { const p = av.root.position, dx = f.b.x - p.x, dz = f.b.z - p.z, d = Math.hypot(dx, dz) || 1; g.fx.emit({ x: p.x + dx / d, y: 1.4, z: p.z + dz / d, n: 3, colors: ['#9bd5ff', '#ffffff'], speed: 9, gravity: 6, life: 0.9, size: 0.18, spread: 0.15, dir: { x: dx / d, y: 0.45, z: dz / d } }); }
        }
        f.life = Math.max(0, f.life - dt / 14);
        if (f.life <= 0 && !f.out) {
          f.out = true;
          g.ui.toast(`🚒 Feu éteint : ${f.b.name}. Merci les pompiers !`, 'good', 3500);
          setTimeout(() => this.removeFire(f), 6000);
        }
      }
    } else if (f.t > 240) { f.life = Math.max(0, f.life - dt / 30); if (f.life <= 0 && !f.out) { f.out = true; this.removeFire(f); } }
  }

  removeFire(f) {
    const g = this.g;
    g.engine.scene.remove(f.grp);
    if (f.truck) { f.truck.car.dispose(); for (const av of f.truck.crew) g.engine.scene.remove(av.root); this.trucks = this.trucks.filter((t) => t !== f.truck.car); }
    this.fires = this.fires.filter((x) => x !== f);
  }

  // ------------------------------------------------------------------------------ courses-poursuites
  startChase() {
    const g = this.g, P = g.player.pos;
    const a0 = Math.random() * Math.PI * 2;
    const from = nearestRoadPoint(P.x + Math.sin(a0) * 90, P.z + Math.cos(a0) * 90);
    const to = nearestRoadPoint(P.x - Math.sin(a0) * 260, P.z - Math.cos(a0) * 260);
    if (!from || !to) return null;
    const route = findRoute(from.x, from.z, to.x, to.z);
    if (!route || route.length < 3) return null;
    route.unshift({ x: from.x, z: from.z });
    const fug = new RouteCar(g, pick(CIVIL_CARS), route, 19, { key: 'fuyard' });
    const cop = new RouteCar(g, 'police', [{ x: from.x, z: from.z }, ...route], 19.5, { siren: true, paint: '#f4f4f4', key: 'flic', driver: { skin: '#c68642', hair: '#2b1a10', top: '#1d3557', hat: '#1d3557' } });
    // la police démarre un peu derrière
    cop.pos.x -= Math.sin(Math.atan2(route[1].x - from.x, route[1].z - from.z)) * 25; cop.pos.z -= Math.cos(Math.atan2(route[1].x - from.x, route[1].z - from.z)) * 25;
    this.chase = { fug, cop, t: 0, phase: 'run', helped: false };
    g.ui.toast('🚨 Course-poursuite ! Un chauffard fuit la police. Percute-le avec ta voiture pour aider (récompense) !', 'event', 5000);
    return this.chase;
  }

  updateChase(dt) {
    const g = this.g, c = this.chase, P = g.vehicles.current ? g.vehicles.current.pos : g.player.pos;
    c.t += dt;
    if (c.phase === 'run') {
      c.fug.update(dt); c.cop.update(dt);
      // ça accélère dans les lignes droites
      c.fug.speed = 17 + Math.sin(c.t * 0.7) * 4;
      // le joueur percute le fuyard avec un véhicule
      const v = g.vehicles.current;
      if (v && Math.hypot(v.pos.x - c.fug.pos.x, v.pos.z - c.fug.pos.z) < 4.2) { c.helped = true; this.endChase('Fuyard bloqué par toi !'); return; }
      if (c.fug.done || c.t > 50) this.endChase(c.fug.done ? 'Fuyard coincé au bout de la rue.' : 'Le fuyard a fini dans un bac à fleurs.');
      g.sound.siren?.(Math.max(0, 1 - Math.hypot(c.cop.pos.x - P.x, c.cop.pos.z - P.z) / 140), 'police');
    } else {
      // arrestation : le conducteur sort les mains en l'air, l'agent le menotte
      c.t2 += dt;
      for (const a of c.actors) a.update(dt, { speed: 0, grounded: true, pose: a === c.actors[0] ? 'celebrate' : 'hold-forward' });
      if (c.t2 > 9) this.clearChase();
    }
  }

  async endChase(why) {
    const g = this.g, c = this.chase;
    c.phase = 'arrest'; c.t2 = 0;
    const p = c.fug.pos, yaw = c.fug.yaw;
    c.cop.pos.set(p.x - Math.sin(yaw) * 7, 0, p.z - Math.cos(yaw) * 7); c.cop.update(0);
    const driver = new Avatar({ ...DEFAULT_APPEARANCE, skin: pick(SKINS.slice(0, 8)), topColor: pick(COLORS) }, {});
    driver.root.position.set(p.x + Math.cos(yaw) * 2, 0, p.z - Math.sin(yaw) * 2);
    const off = new Avatar(OFFICER, {});
    off.root.position.set(p.x + Math.cos(yaw) * 2 - Math.sin(yaw) * 1.2, 0, p.z - Math.sin(yaw) * 2 - Math.cos(yaw) * 1.2);
    off.root.rotation.y = yaw;
    g.engine.scene.add(driver.root, off.root);
    c.actors = [driver, off];
    g.labels.bubble(off.root, 'Police ! Les mains sur le capot !', 3000);
    setTimeout(() => this.chase === c && g.labels.bubble(driver.root, pick(['C\'est pas ma voiture !', 'J\'allais chez ma grand-mère !', 'Je croyais que c\'était un rallye !']), 2600), 1500);
    g.sfx('whistle');
    if (c.helped) {
      try { const r = await g.net.request('police.assist', { kind: 'chase' }); g.ui.toast(r.amount ? `👮 Merci pour ton aide ! Prime citoyenne : ${r.amount} PC (liquide), +3 réputation.` : '👮 Merci pour ton aide !', 'good', 4500); } catch (e) { g.ui.toast(e.message, 'bad'); }
    } else g.ui.toast(`🚓 ${why} Le chauffard est arrêté.`, '', 3000);
  }

  clearChase() {
    const g = this.g, c = this.chase;
    if (!c) return;
    c.fug.dispose(); c.cop.dispose();
    for (const a of c.actors || []) g.engine.scene.remove(a.root);
    this.chase = null;
  }

  // ------------------------------------------------------------------------------ voleur à la tire
  startThief() {
    const g = this.g, P = g.player.pos;
    const a = Math.random() * Math.PI * 2;
    const x = P.x + Math.sin(a) * 9, z = P.z + Math.cos(a) * 9;
    const av = new Avatar({ ...DEFAULT_APPEARANCE, top: 'sweat', topColor: '#14141c', hat: 'bonnet', glasses: 'lunettes-soleil' }, {});
    av.root.position.set(x, 0, z);
    g.engine.scene.add(av.root);
    const label = document.createElement('div'); label.className = 'wlabel'; label.textContent = '🦹 Voleur !';
    const lab = g.labels.add(av.root, label, 2.2, 60);
    this.thief = { av, lab, pos: new THREE.Vector3(x, 0, z), dir: a, t: 0, down: 0 };
    g.labels.bubble(av.root, 'Hé hé, joli sac !', 1500);
    g.ui.toast('👜 « Au voleur ! » Un pickpocket s\'enfuit avec un sac : rattrape-le et frappe-le (F) !', 'event', 4500);
  }

  updateThief(dt) {
    const g = this.g, th = this.thief;
    th.t += dt;
    if (th.down > 0) {
      th.down -= dt;
      th.av.update(dt, { speed: 0, grounded: true, pose: 'down' });
      if (th.down <= 0) this.clearThief();
      return;
    }
    const sp = 6.8;
    const nx = th.pos.x + Math.sin(th.dir) * sp * dt, nz = th.pos.z + Math.cos(th.dir) * sp * dt;
    if (g.collision.blockedAt?.(nx, nz) || Math.random() < dt * 0.3) th.dir += (Math.random() - 0.5) * 1.6;
    th.pos.set(nx, g.collision.supportAt(nx, nz, 2, 0.3), nz);
    g.collision.pushOut(th.pos, 0.35, 1.7, 0.5);
    th.av.root.position.copy(th.pos); th.av.root.rotation.y = th.dir;
    th.av.update(dt, { speed: sp, grounded: true });
    if (th.t > 40 || Math.hypot(th.pos.x - g.player.pos.x, th.pos.z - g.player.pos.z) > 120) { g.ui.toast('🦹 Le voleur s\'est échappé...', '', 2500); this.clearThief(); }
  }

  // appelé par le coup de poing du joueur : true si c'était le voleur
  punchTarget(P) {
    const th = this.thief, g = this.g;
    if (!th || th.down > 0 || Math.hypot(th.pos.x - P.x, th.pos.z - P.z) > 2) return false;
    th.down = 4;
    g.sfx('bump');
    g.labels.bubble(th.av.root, 'Aïe ! OK, OK, je rends le sac !', 2500);
    g.net.request('police.assist', { kind: 'thief' }).then((r) => g.ui.toast(r.amount ? `👜 Voleur arrêté ! Récompense : ${r.amount} PC (liquide), +3 réputation.` : '👜 Voleur arrêté ! Merci !', 'good', 4000)).catch((e) => g.ui.toast(e.message, 'bad'));
    return true;
  }

  clearThief() { const th = this.thief; if (!th) return; this.g.engine.scene.remove(th.av.root); this.g.labels.remove?.(th.lab); this.thief = null; }

  // ------------------------------------------------------------------------------ appli Urgences
  async call(service) {
    const g = this.g;
    const fire = this.nearestFire();
    try {
      const r = await g.net.request('emergency.call', { service, real: service === 'pompiers' && !!fire });
      if (service === 'pompiers') {
        if (fire && !fire.truck) { this.sendTruck(fire); g.ui.toast(`🚒 Pompiers en route vers ${fire.b.name} ! (sirène)`, 'good', 4000); }
        else if (fire) g.ui.toast('🚒 Les pompiers sont déjà en route.', '', 2500);
        else g.ui.toast('🚒 « Aucun incendie signalé près de chez vous. N\'appelez pas pour rien ! »', 'bad', 3500);
      } else if (service === 'police') {
        if (this.thief) { g.ui.toast('👮 « Un voleur ? Une patrouille arrive... rattrapez-le si vous pouvez ! »', '', 3500); }
        else if (this.chase) g.ui.toast('👮 « Nous sommes déjà sur la poursuite, merci ! »', '', 3000);
        else g.ui.toast('👮 « Police, j\'écoute ? ... Un pigeon vous regarde bizarrement ? Bon. On note. »', '', 3500);
      } else g.ui.toast(r.healed ? '🚑 Les ambulanciers t\'ont soigné·e sur place (gratuit).' : '🚑 « Vous allez très bien ! Buvez de l\'eau. »', r.healed ? 'good' : '', 3500);
    } catch (e) { g.ui.toast(e.message, 'bad'); }
  }

  app(b, phone) {
    const g = this.g, fire = this.nearestFire();
    b.append(h('p.muted', 'Numéro unique 112. Appelle seulement pour une vraie urgence !'));
    b.append(h('div.list',
      h('button.btn.block', { onclick: () => { this.call('police'); phone.close(); } }, '👮 Appeler la police (17)'),
      h('button.btn.block', { onclick: () => { this.call('pompiers'); phone.close(); } }, `🚒 Appeler les pompiers (18)${fire ? ' · 🔥 incendie proche !' : ''}`),
      h('button.btn.block', { onclick: () => { this.call('ambulance'); phone.close(); } }, '🚑 Appeler une ambulance (15)')));
    const j = g.profile.justice;
    const pend = (j.pending || []).reduce((s, x) => s + x.amount, 0);
    if (pend) b.append(h('p', `🧾 Amendes en suspens : ${pend} PC — tu ne les paies que si la police t'attrape. Sème-la et tu touches une prime !`));
    void ASSIST;
  }

  // ------------------------------------------------------------------------------ boucle
  update(dt) {
    const g = this.g;
    if (!g.profile) return;
    for (const f of [...this.fires]) this.updateFire(f, dt);
    if (this.chase) this.updateChase(dt);
    if (this.thief) this.updateThief(dt);
    if (this.busy) return;
    this.nextFire -= dt; this.nextChase -= dt; this.nextThief -= dt;
    if (this.nextFire <= 0) { this.nextFire = 300 + Math.random() * 240; if (this.fires.length < 2) this.startFire(); }
    if (this.nextChase <= 0) { this.nextChase = 180 + Math.random() * 180; if (!this.chase && !g.profile.justice.stars) this.startChase(); }
    if (this.nextThief <= 0) { this.nextThief = 200 + Math.random() * 200; if (!this.thief && !g.vehicles.current) this.startThief(); }
  }
}
