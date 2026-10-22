import * as THREE from 'three';
import { h } from '../ui/dom.js';
import { WorldVehicle } from '../vehicles/vehicles.js';
import { Avatar } from '../characters/avatar.js';
import { findRoute, nearestRoadPoint, ROAD_GRAPH, STREET_BY_ID } from '../../shared/city.js';
import { CRIMES, FINES, SPEED_LIMIT, RADARS, loseTime, EXAM_ROUTE, EXAM_START, EXAM_MAX_ERRORS } from '../../shared/justice.js';
import { PRISON_YARD, PRISON_CELL, inPrison } from '../../shared/authority-justice.js';
import { lightState } from '../world/traffic.js';
import { Beacon } from '../jobs/beacon.js';

// POLICE : étoiles de recherche, voitures de police (IA qui suit les routes puis fonce sur le joueur),
// agents à pied, arrestation, radars et feux rouges, contrôle du permis, prison (temps réel), examen du
// permis de conduire. Les décisions (amendes, peines) sont prises par l'autorité.

const OFFICER = { skin: '#c68642', hair: 'court', hairColor: '#2b1a10', eyes: 'serieux', body: 'costaud', height: 1.02, top: 'chemise', topColor: '#1d3557', bottom: 'jean', bottomColor: '#14213d', shoes: '#111111', hat: 'casquette', glasses: null, back: null };
const SHOUTS = ['Police ! Plus un geste !', 'Arrêtez-vous !', 'Halte ! Au nom de la loi... et des croissants !', 'Vous êtes cerné·e ! Enfin, presque.', 'Rangez-vous sur le côté !'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const ang = (a) => Math.atan2(Math.sin(a), Math.cos(a));

class PoliceUnit {
  constructor(game, x, z, yaw) {
    this.game = game;
    this.v = new WorldVehicle(game, { model: 'police', color: '#f4f4f4', x, z, yaw, owner: 'police', locked: true, driver: { skin: '#c68642', hair: '#2b1a10', top: '#1d3557', hat: '#1d3557' }, driverKey: 'flic' });
    this.v.visual.u.uSiren.value = 1;
    this.v.ai = true;
    this.v.lightsOn = true;
    game.vehicles.list.push(this.v);
    this.route = null; this.routeT = 0; this.wp = 0;
    this.stuck = 0; this.reverseT = 0;
    this.officer = null;
    this.catchT = 0;
    this.shoutT = 2;
  }

  dispose() {
    const g = this.game;
    g.vehicles.list = g.vehicles.list.filter((x) => x !== this.v);
    this.v.dispose();
    if (this.officer) { g.engine.scene.remove(this.officer.av.root); }
  }

  target() { const g = this.game; return g.vehicles.current ? g.vehicles.current.pos : g.player.pos; }

  update(dt, t) {
    const g = this.game, P = this.target(), s = this.v.sim;
    const dist = Math.hypot(P.x - s.pos.x, P.z - s.pos.z);
    this.shoutT -= dt;
    if (this.shoutT <= 0 && dist < 30) { this.shoutT = 6 + Math.random() * 4; g.labels.bubble(this.officer ? this.officer.av.root : this.v.visual.root, pick(SHOUTS), 2200, '', 2.6); }
    // agent à pied : il court vers le joueur
    if (this.officer) {
      const o = this.officer;
      const dx = g.player.pos.x - o.pos.x, dz = g.player.pos.z - o.pos.z, d = Math.hypot(dx, dz);
      if (g.vehicles.current || d > 45) { this.recallOfficer(); return; }
      const sp = 8.2;
      if (d > 1.1) { o.pos.x += (dx / d) * sp * dt; o.pos.z += (dz / d) * sp * dt; }
      o.pos.y = g.collision.supportAt(o.pos.x, o.pos.z, o.pos.y + 1, 0.3);
      g.collision.pushOut(o.pos, 0.35, 1.7, 0.5);
      o.av.root.position.copy(o.pos);
      o.av.root.rotation.y = Math.atan2(dx, dz);
      o.av.update(dt, { speed: d > 1.1 ? sp : 0, grounded: true, pose: d < 2 ? 'hold-forward' : 'idle' });
      this.catchT = d < 1.7 ? this.catchT + dt : Math.max(0, this.catchT - dt);
      if (this.catchT > 0.9) { g.police.arrestMe('Menotté·e par un agent !'); return; }
      this.driveCar(dt, 0, 0, true);
      return;
    }
    // voiture : on roule vers le joueur (par les routes de loin, tout droit de près)
    if (!g.vehicles.current && dist < 13 && s.speed < 4) { this.spawnOfficer(); return; }
    this.routeT -= dt;
    if (dist > 35 && (this.routeT <= 0 || !this.route)) {
      this.routeT = 3;
      this.route = findRoute(s.pos.x, s.pos.z, P.x, P.z) || null;
      this.wp = 0;
    }
    let aim = P;
    if (dist > 35 && this.route?.length) {
      while (this.wp < this.route.length - 1 && Math.hypot(this.route[this.wp].x - s.pos.x, this.route[this.wp].z - s.pos.z) < 9) this.wp++;
      aim = this.route[this.wp];
    }
    const want = Math.atan2(aim.x - s.pos.x, aim.z - s.pos.z);
    const diff = ang(want - s.yaw);
    let throttle = dist > 18 ? 1 : dist > 8 ? 0.55 : 0.25;
    if (Math.abs(diff) > 1.4 && s.speed > 8) throttle = -0.3;
    let steer = -Math.max(-1, Math.min(1, diff * 2.4));
    // coincé : marche arrière quelques instants
    if (throttle > 0 && s.speed < 1) this.stuck += dt; else this.stuck = 0;
    if (this.stuck > 1.5) { this.reverseT = 1.3; this.stuck = 0; }
    if (this.reverseT > 0) { this.reverseT -= dt; throttle = -0.8; steer = -steer; }
    this.driveCar(dt, throttle, steer, false);
    // voiture du joueur bloquée par la police : arrestation
    if (g.vehicles.current && dist < 6 && g.vehicles.current.sim.speed < 2.5) { this.catchT += dt; if (this.catchT > 2.5) g.police.arrestMe('Sortez du véhicule, les mains en l\'air !'); } else this.catchT = 0;
  }

  driveCar(dt, throttle, steer, handbrake) {
    if (!this.v.sim.colliders.length) return; // unité déjà retirée (arrestation pendant la mise à jour)
    const hits = this.v.sim.update(dt, { throttle, steer, handbrake });
    if (hits.length) this.game.vehicles.onHits(this.v, hits, 0.4);
  }

  spawnOfficer() {
    const g = this.game, s = this.v.sim;
    const av = new Avatar(OFFICER);
    const p = this.v.doorPoint(new THREE.Vector3());
    av.root.position.copy(p);
    g.engine.scene.add(av.root);
    this.officer = { av, pos: p.clone() };
    this.v.doorTarget = 1;
    setTimeout(() => { this.v.doorTarget = 0; }, 700);
    g.sfx('door');
    void s;
  }

  recallOfficer() {
    if (!this.officer) return;
    this.game.engine.scene.remove(this.officer.av.root);
    this.officer = null;
  }
}

export class Police {
  constructor(game) {
    this.game = game;
    this.units = [];
    this.seenAt = 0;
    this.spawnT = 0;
    this.radarCd = 0;
    this.lightCd = 0;
    this.licenceCd = 0;
    this.speedCd = 0;
    this.el = h('div.wanted.hidden', this.starsEl = h('div.stars'), this.wantedTxt = h('div.txt'));
    game.ui.root.append(this.el);
    this.buildRadars();
    this.examBeacon = new Beacon(game.engine.scene, '#3d8ee8');
    this.examBeacon.g.visible = false;
    game.net.on?.('arrested', (m) => this.onArrested(m, `🚔 Arrêté·e par ${m.by} !`));
    game.on('profile', () => this.renderStars());
  }

  get j() { return this.game.profile?.justice; }
  get stars() { return this.j?.stars || 0; }

  buildRadars() {
    const g = this.game, geo = [];
    this.radarMeshes = new THREE.Group();
    for (const r of RADARS) {
      const off = r.axis === 'h' ? { x: 0, z: 6.2 } : { x: 6.2, z: 0 };
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.4, 0.15), new THREE.MeshStandardMaterial({ color: '#555b66' }));
      pole.position.set(r.x + off.x, 1.2, r.z + off.z);
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.7), new THREE.MeshStandardMaterial({ color: '#2b2d42' }));
      box.position.set(r.x + off.x, 2.6, r.z + off.z);
      const lens = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.25, 0.25), new THREE.MeshBasicMaterial({ color: '#ffd23f' }));
      lens.position.set(r.x + off.x, 2.7, r.z + off.z);
      this.radarMeshes.add(pole, box, lens);
      geo.push(r);
    }
    g.engine.scene.add(this.radarMeshes);
  }

  renderStars() {
    const s = this.stars, jail = this.j?.jail;
    this.el.classList.toggle('hidden', !s);
    this.starsEl.textContent = '★'.repeat(s) + '☆'.repeat(5 - s);
    if (!s) this.clearUnits();
    void jail;
  }

  clearUnits() { for (const u of this.units) u.dispose(); this.units = []; }

  // Délit commis (le client constate, l'autorité décide).
  async crime(type, witnessed, extra = {}) {
    const g = this.game;
    try {
      const r = await g.net.request('crime.report', { type, witnessed, ...extra });
      if (witnessed) {
        this.seenAt = g.now();
        g.sfx('whistle');
        g.ui.toast(`🚨 ${CRIMES[type].name} : des témoins ont appelé la police ! (${'★'.repeat(r.stars)})`, 'bad', 4500);
      }
      this.renderStars();
      return r;
    } catch (e) { g.ui.toast(e.message, 'bad'); return null; }
  }

  async fine(type) {
    const g = this.game;
    try {
      const r = await g.net.request('police.fine', { type });
      if (r.skipped) return;
      g.sfx('beep');
      g.ui.toast(`🧾 ${FINES[type].name} : ${r.amount} PC d'amende${FINES[type].points ? ` et -${FINES[type].points} point(s) (reste ${r.points}/12)` : ''}.${r.suspended ? ' PERMIS SUSPENDU !' : ''}`, 'bad', 5000);
      this.renderStars();
    } catch { /* hors ligne */ }
  }

  // ------------------------------------------------------------------ arrestation et prison
  async arrestMe(why) {
    const g = this.game;
    if (this.arresting) return;
    this.arresting = true;
    if (g.vehicles.current) g.vehicles.exit(true);
    g.player.setPose('celebrate', 1);
    g.labels.bubble(g.avatar.root, 'C\'est pas moi ! C\'est le pigeon !', 2500, 'player');
    try {
      const r = await g.net.request('police.arrest', {});
      this.onArrested(r, why);
    } catch { /* plus recherché */ }
    this.arresting = false;
  }

  onArrested(r, why) {
    const g = this.game;
    this.clearUnits();
    g.sfx('fail');
    if (r.at) g.player.teleport(r.at.x, r.at.z, Math.PI);
    g.cam.snap?.(g.player.pos, 0);
    g.ui.dialog({ name: 'Le juge', role: 'Tribunal de PLAYZONE', text: `${why} Délits : ${r.crimes.map((c) => CRIMES[c]?.name || c).join(', ')}. Peine : ${r.minutes} minutes de prison (temps réel).${r.seized ? ` Argent liquide saisi : ${r.seized} PC.` : ''}${r.fired ? ' Et vous êtes renvoyé·e de la police !' : ''}`, choices: [{ label: '⛓️ D\'accord...', ghost: true, action: (m) => m.close() }] });
    this.renderStars();
  }

  jailUpdate() {
    const g = this.game, jl = this.j?.jail;
    if (!jl) { g.hud.track('jail', null); return; }
    const left = Math.max(0, jl.until - g.now());
    g.hud.track('jail', { title: '⛓️ Prison de la Pomme Pourrie', text: `Libération dans ${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')} (laverie = remise de peine, ou tenter une évasion...)`, bar: 1 - left / (jl.minutes * 60000) });
    if (g.player.zone === 'world' && !inPrison(g.player.pos) && !g.cutscene) {
      g.player.teleport(PRISON_CELL.x, PRISON_CELL.z, Math.PI);
      g.ui.toast('💂 Un gardien te ramène gentiment (mais fermement) en cellule.', 'bad');
    }
    if (left <= 0 && !this.releasing) {
      this.releasing = true;
      g.net.request('jail.release', {}).then((r) => { g.player.teleport(r.at.x, r.at.z, Math.PI); g.sfx('success'); g.ui.toast('🔓 Libéré·e ! Tu as payé ta dette à la société. Essaie de rester sage...', 'good', 5000); }).catch(() => {}).finally(() => { this.releasing = false; });
    }
  }

  // ------------------------------------------------------------------ infractions routières
  trafficChecks(dt) {
    const g = this.game, v = g.vehicles.current;
    this.radarCd -= dt; this.lightCd -= dt; this.licenceCd -= dt; this.speedCd -= dt;
    if (!v || v.owner === 'police') return;
    const P = v.pos, kmh = v.sim.speed * 3.6;
    const road = nearestRoadPoint(P.x, P.z);
    const limit = road && road.dist < 8 ? SPEED_LIMIT[road.edge.kind] || 50 : 80;
    // radars
    for (const r of RADARS) {
      if (this.radarCd > 0) break;
      if (Math.hypot(P.x - r.x, P.z - r.z) < 9 && kmh > limit + 5) { this.radarCd = 15; this.flash(); this.fine('vitesse'); }
    }
    // police qui voit un grand excès de vitesse, un feu rouge, l'absence de permis
    const cop = this.nearbyCop(P, 45);
    if (cop && kmh > limit + 30 && this.speedCd <= 0) { this.speedCd = 20; this.crime('grand-exces', true); }
    if (cop && this.licenceCd <= 0 && !['bike', 'board', 'caddie', 'scooter', 'kart', 'f1'].includes(v.spec.kind) && !this.j.licence.permis && v.owner !== 'exam') {
      this.licenceCd = 60;
      this.fine('sans-permis');
    }
    // feux rouges franchis
    const node = ROAD_GRAPH.nodes.find((n) => n.light && Math.abs(n.x - P.x) < 6 && Math.abs(n.z - P.z) < 6);
    if (node && this.lightCd <= 0 && v.sim.speed > 4) {
      const axis = Math.abs(Math.sin(v.yaw)) > 0.7 ? 'h' : 'v';
      if (lightState(node, g.now() / 1000, axis) === 'R') {
        this.lightCd = 12;
        if (this.exam) this.exam.errors++;
        if (cop) this.fine('feu-rouge');
        else g.ui.toast('🚦 Feu rouge grillé ! (Pas de police en vue... cette fois.)', 'bad', 2500);
      }
    }
    if (this.exam && kmh > limit + 5 && this.speedCd <= 0) { this.speedCd = 3; this.exam.errors++; g.ui.toast(`🚗 Examen : trop vite (${Math.round(kmh)} km/h, limite ${limit}) ! Erreur ${this.exam.errors}/${EXAM_MAX_ERRORS + 1}`, 'bad', 2500); }
  }

  flash() {
    const g = this.game;
    const el = h('div', { style: { position: 'absolute', inset: '0', background: '#fff', opacity: '0.8', zIndex: '35', pointerEvents: 'none', transition: 'opacity .5s' } });
    g.ui.root.append(el);
    requestAnimationFrame(() => { el.style.opacity = '0'; });
    setTimeout(() => el.remove(), 600);
    g.sfx('pop');
  }

  // Une voiture de police (IA ou circulation) assez proche pour voir le joueur ?
  nearbyCop(P, r) {
    const g = this.game;
    for (const u of this.units) if (Math.hypot(u.v.pos.x - P.x, u.v.pos.z - P.z) < r) return u;
    for (const c of g.traffic?.cars || []) if (c.model === 'police' && Math.hypot(c.pos.x - P.x, c.pos.z - P.z) < r) return c;
    return null;
  }

  // ------------------------------------------------------------------ examen du permis
  startExam(route) {
    const g = this.game;
    const v = new WorldVehicle(g, { model: 'citadine', color: '#3d8ee8', x: EXAM_START.x, z: EXAM_START.z, yaw: EXAM_START.yaw, owner: 'exam' });
    g.vehicles.list.push(v);
    g.vehicles.enter(v);
    this.exam = { v, route, i: 0, errors: 0, at: g.now() };
    this.examBeacon.at(route[0].x, 0.1, route[0].z);
    g.ui.toast('🚗 Examen du permis : suis les balises bleues, respecte les limites (50 km/h) et les feux, ne touche rien !', 'good', 6000);
    g.on('vehicle.bump', (e) => { if (this.exam && e.by === this.exam.v && e.sev > 0.1) this.exam.errors++; });
  }

  examUpdate() {
    const g = this.game, ex = this.exam;
    if (!ex) return;
    if (g.vehicles.current !== ex.v) { this.endExam(false, 'Tu es descendu·e de la voiture pendant l\'examen !'); return; }
    const cp = ex.route[ex.i];
    g.hud.track('exam', { title: '🚗 Examen du permis', text: `Balise ${ex.i + 1}/${ex.route.length} · erreurs ${ex.errors}/${EXAM_MAX_ERRORS + 1}` });
    if (Math.hypot(ex.v.pos.x - cp.x, ex.v.pos.z - cp.z) < 7) {
      ex.i++;
      g.sfx('beep');
      if (ex.i >= ex.route.length) this.endExam(true);
      else this.examBeacon.at(ex.route[ex.i].x, 0.1, ex.route[ex.i].z);
    }
    if (ex.errors > EXAM_MAX_ERRORS) this.endExam(false, 'Trop d\'erreurs.');
  }

  async endExam(done, why = '') {
    const g = this.game, ex = this.exam;
    if (!ex) return;
    this.exam = null;
    this.examBeacon.g.visible = false;
    g.hud.track('exam', null);
    let passed = false;
    try { passed = (await g.net.request('licence.examEnd', { checkpoints: done ? ex.route.length : ex.i, errors: ex.errors })).passed; } catch { /* rien */ }
    if (g.vehicles.current === ex.v) g.vehicles.exit(true);
    g.vehicles.despawn(ex.v, false);
    g.sfx(passed ? 'levelup' : 'fail');
    g.ui.dialog({ name: 'L\'inspecteur·rice', role: 'Examen du permis', text: passed ? '🎉 Félicitations, vous avez votre permis de conduire ! 12 points. Roulez prudemment.' : `Ajourné·e. ${why} Vous pourrez repasser l'examen.`, choices: [{ label: 'OK', ghost: true, action: (m) => m.close() }] });
  }

  // ------------------------------------------------------------------ boucle
  update(dt, t) {
    const g = this.game, j = this.j;
    if (!j) return;
    this.examBeacon.update(t);
    this.jailUpdate();
    this.examUpdate();
    if (g.player.zone === 'world') this.trafficChecks(dt);
    const stars = j.stars;
    if (!stars || j.jail) { if (this.units.length) this.clearUnits(); this.dispatchAt = 0; return; }
    const P = g.vehicles.current ? g.vehicles.current.pos : g.player.pos;
    // un témoin appelle : la police met du temps à arriver (≈ 30 s, un peu moins pour un délit grave),
    // puis les voitures partent de loin et viennent par les routes
    if (!this.dispatchAt) { this.dispatchAt = g.now() + Math.max(15, 32 - stars * 4) * 1000; g.ui.toast('📞 Un témoin appelle la police...', 'bad', 3500); }
    const waitS = Math.ceil((this.dispatchAt - g.now()) / 1000);
    if (waitS > 0 && !this.units.length) {
      this.seenAt = g.now(); // tant que personne n'est là, on ne peut pas « semer » la police
      this.el.classList.remove('blink');
      this.wantedTxt.textContent = `📞 Police prévenue : arrivée dans ~${waitS} s`;
      return;
    }
    // apparition des voitures de police (selon les étoiles)
    this.spawnT -= dt;
    const want = Math.min(4, stars);
    if (this.units.length < want && this.spawnT <= 0) {
      this.spawnT = 10;
      const ang0 = Math.random() * Math.PI * 2;
      for (let k = 0; k < 8; k++) {
        const a = ang0 + k * 0.8, rp = nearestRoadPoint(P.x + Math.sin(a) * 150, P.z + Math.cos(a) * 150);
        if (!rp) continue;
        const e = rp.edge, na = ROAD_GRAPH.nodes[e.a], nb = ROAD_GRAPH.nodes[e.b];
        const yaw = Math.atan2(P.x - rp.x, P.z - rp.z);
        void na; void nb; void STREET_BY_ID;
        this.units.push(new PoliceUnit(g, rp.x, rp.z, yaw));
        g.sound.siren?.(1, 'police');
        break;
      }
    }
    for (const u of this.units) u.update(dt, t);
    // la police voit-elle le joueur ?
    const inside = !!g.interiors?.inside;
    const seen = this.units.some((u) => { const q = u.officer ? u.officer.pos : u.v.pos; const d = Math.hypot(q.x - P.x, q.z - P.z); return d < (inside ? 14 : 70); });
    if (seen) this.seenAt = g.now();
    const unseen = (g.now() - this.seenAt) / 1000;
    const need = loseTime(stars);
    this.el.classList.toggle('blink', unseen > 2);
    this.wantedTxt.textContent = unseen > 2 ? `Cache-toi ! Encore ${Math.max(0, Math.ceil(need - unseen))} s sans être vu·e` : 'La police te poursuit !';
    if (unseen > need && !this.losing) {
      this.losing = true;
      g.net.request('police.lose', {}).then(() => { g.sfx('success'); g.ui.toast('😎 Tu as semé la police. Pour cette fois...', 'good', 4000); this.clearUnits(); this.renderStars(); }).catch(() => {}).finally(() => { this.losing = false; });
    }
    // sirène
    const near = this.units.reduce((m, u) => Math.min(m, Math.hypot(u.v.pos.x - P.x, u.v.pos.z - P.z)), 999);
    g.sound.siren?.(Math.max(0, 1 - near / 120), 'police');
  }
}

export { PRISON_YARD };
