import * as THREE from 'three';
import { h, fmt } from '../ui/dom.js';
import { Avatar } from '../characters/avatar.js';
import { DEFAULT_APPEARANCE, SKINS, HAIR_STYLES, HAIR_COLORS } from '../../shared/appearance.js';
import { BUILDING_BY_ID } from '../../shared/world-layout.js';
import { mulberry32 } from '../../shared/rng.js';
import { ARENAS, MODES, arenaCovers, basesOf, zoneRadius } from '../../shared/arena.js';
import { careerToast } from '../sports/races.js';

// PAINTBALL ET LASER GAME contre des bots IA.
//  - viser avec la souris (vue à l'épaule, réticule au centre), tirer : clic gauche (ou F), recharger : R
//  - paintball : une bille = éliminé·e ; laser : le gilet touché s'éteint 3 s
//  - « Dernier debout » : 12 joueurs, une seule vie, la zone violette se resserre : dehors, on est éliminé·e
const req = async (g, t, p) => { try { return await g.net.request(t, p); } catch (e) { g.ui.toast(e.message, 'bad', 4500); g.sfx('error'); return null; } };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (r, a) => a[Math.floor(r() * a.length)];
const NAMES = ['Ninja Moustache', 'Captain Patate', 'Lady Splash', 'Rambo Mou', 'Sniper Mamie', 'Turbo Tartine', 'Kevin le Furtif', 'Zorro Lasagne', 'La Panthère Rose Fluo', 'Big Boss Baguette', 'Mimi Mitraille', 'Docteur Pschitt', 'Jean-Michel Couvert', 'Tatie Tornade', 'Rocky Raclette', 'Agent Croissant', 'Lola Laser', 'Max Néon', 'Bob Bunker', 'Yoyo Tireur'];
const TEAM = { paintball: [{ name: 'Rouges', color: '#e63946' }, { name: 'Bleus', color: '#3a86ff' }], laser: [{ name: 'Verts', color: '#39ff14' }, { name: 'Violets', color: '#bc00ff' }] };
const FFA_COLORS = ['#ffbe0b', '#e63946', '#3a86ff', '#2ec4b6', '#8338ec', '#fb5607', '#06d6a0', '#ff006e', '#8ac926', '#1982c4', '#6a4c93', '#ff595e'];
const EYE = 1.5, R = 0.45, HEIGHT = 1.85;

function gun(kind) {
  const g = new THREE.Group(), m = (c, e) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, emissive: e || '#000', emissiveIntensity: e ? 0.8 : 0 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.5), m(kind === 'laser' ? '#1b1b1f' : '#2b2d42')); g.add(body);
  if (kind === 'paintball') { const hop = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), m('#ffbe0b')); hop.position.set(0, 0.13, 0.05); g.add(hop); }
  else { const tip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.08), m('#39ff14', '#39ff14')); tip.position.set(0, 0.02, 0.27); g.add(tip); }
  g.rotation.x = Math.PI / 2;
  return g;
}

export class Arenas {
  constructor(g) {
    this.g = g;
    this.m = null;
    this.covers = {};
    for (const A of Object.values(ARENAS)) this.build(A);
    // projectiles et taches de peinture (réutilisés)
    this.ballGeo = new THREE.SphereGeometry(0.06, 8, 6);
    this.splatGeo = new THREE.CircleGeometry(0.28, 10);
    this.splats = [];
    this.beams = [];
    this.cross = h('div.ar-cross');
  }

  // ------------------------------------------------------------------ décor
  build(A) {
    const g = this.g, root = new THREE.Group(), mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, ...o });
    const laser = A.kind === 'laser';
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(A.w, A.d).rotateX(-Math.PI / 2), mat(laser ? '#16131f' : '#6b8f3a'));
    floor.position.set(A.cx, 0.04, A.cz); floor.receiveShadow = true; root.add(floor);
    const covers = arenaCovers(A).map(([x, z, w, d, hh, t]) => ({ x: A.cx + x, z: A.cz + z, w, d, h: hh, t }));
    this.covers[A.id] = covers;
    const colors = laser ? ['#2a1f3d'] : ['#ff006e', '#ffbe0b', '#3a86ff', '#06d6a0', '#fb5607'];
    covers.forEach((c, i) => {
      let mesh;
      if (c.t === 'cylindre') mesh = new THREE.Mesh(new THREE.CylinderGeometry(c.w / 2, c.w / 2, c.h, 14), mat(colors[i % colors.length], { roughness: 0.4 }));
      else if (c.t === 'dorito') mesh = new THREE.Mesh(new THREE.ConeGeometry(c.w / 1.6, c.h, 3), mat(colors[i % colors.length], { roughness: 0.4 }));
      else if (c.t === 'pneus') { mesh = new THREE.Group(); for (let k = 0; k < 3; k++) { const tr = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.3, 8, 14).rotateX(Math.PI / 2), mat('#1b1b1f')); tr.position.y = -c.h / 2 + 0.25 + k * 0.35; mesh.add(tr); } }
      else mesh = new THREE.Mesh(new THREE.BoxGeometry(c.w, c.h, c.d), mat(laser ? '#2a1f3d' : c.t === 'palette' ? '#a47148' : c.t === 'mur' ? '#8d99ae' : colors[i % colors.length], { roughness: 0.6 }));
      mesh.position.set(c.x, c.h / 2, c.z); mesh.castShadow = !laser; root.add(mesh);
      if (laser) {   // bandes néon en haut des murs
        const neon = new THREE.Mesh(new THREE.BoxGeometry(c.w + 0.02, 0.08, c.d + 0.02), new THREE.MeshStandardMaterial({ color: i % 2 ? '#39ff14' : '#bc00ff', emissive: i % 2 ? '#39ff14' : '#bc00ff', emissiveIntensity: 1.6 }));
        neon.position.set(c.x, c.h - 0.05, c.z); root.add(neon);
      }
      g.collision.addBox(c.x - c.w / 2, 0, c.z - c.d / 2, c.x + c.w / 2, c.h, c.z + c.d / 2, { noCamera: true });
    });
    // clôture (filet vert ou mur noir) avec une entrée au sud, côté accueil
    const fenceH = laser ? 3.2 : 3, fm = mat(laser ? '#0d0b14' : '#2d6a4f', { transparent: !laser, opacity: laser ? 1 : 0.55 });
    const wall = (x1, z1, x2, z2) => {
      const w = Math.abs(x2 - x1) || 0.15, d = Math.abs(z2 - z1) || 0.15;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, fenceH, d), fm); m.position.set((x1 + x2) / 2, fenceH / 2, (z1 + z2) / 2); root.add(m);
      g.collision.addBox(Math.min(x1, x2) - 0.1, 0, Math.min(z1, z2) - 0.1, Math.max(x1, x2) + 0.1, fenceH, Math.max(z1, z2) + 0.1, { noCamera: true });
    };
    const X1 = A.cx - A.w / 2, X2 = A.cx + A.w / 2, Z1 = A.cz - A.d / 2, Z2 = A.cz + A.d / 2;
    wall(X1, Z1, X2, Z1); wall(X1, Z1, X1, Z2); wall(X2, Z1, X2, Z2);
    wall(X1, Z2, A.cx - 3, Z2); wall(A.cx + 3, Z2, X2, Z2);
    if (laser) for (const [x, z] of [[X1, Z1], [X2, Z1], [X1, Z2], [X2, Z2]]) { const l = new THREE.PointLight('#bc00ff', 6, 30); l.position.set(x + Math.sign(A.cx - x) * 4, 3, z + Math.sign(A.cz - z) * 4); root.add(l); }
    // drapeaux / bases colorées
    basesOf(A).forEach((b, k) => { const pad = new THREE.Mesh(new THREE.CircleGeometry(3, 20).rotateX(-Math.PI / 2), mat(TEAM[A.kind][k].color, { transparent: true, opacity: 0.3 })); pad.position.set(A.cx + b.x, 0.06, A.cz + b.z); root.add(pad); });
    g.engine.scene.add(root);
  }

  // ------------------------------------------------------------------ accueil
  desk(arenaId) {
    const g = this.g, A = ARENAS[arenaId], rec = g.profile.sports?.[arenaId] || {};
    const m = g.ui.modal({
      title: A.kind === 'laser' ? '🔫 Laser Quest Néon' : '🎯 Paintball des Hauts', width: 'min(600px, 96vw)',
      sub: `${rec.games || 0} partie(s) · ${rec.wins || 0} victoire(s) · ${rec.kills || 0} éliminations au total`,
      build: (body) => {
        body.append(h('p.muted', 'Viser : souris · Tirer : clic gauche (ou F) · Recharger : R · Courir : Maj. Mets-toi à couvert derrière les abris !'));
        for (const [id, M] of Object.entries(MODES[arenaId])) body.append(h('div.list-item', h('span', { style: { fontSize: '22px' } }, M.ffa ? '👑' : '⚔️'),
          h('div.grow', h('div.t', M.name), h('div.d', `${M.desc} Entrée ${M.fee} PC.`)),
          h('button.btn.small', { onclick: () => { m.close(); this.start(arenaId, id); } }, 'Jouer')));
      },
    });
  }

  // ------------------------------------------------------------------ partie
  async start(arenaId, mode) {
    const g = this.g, A = ARENAS[arenaId], M = MODES[arenaId][mode];
    if (this.m || g.vehicles?.current) return;
    const r = await req(g, 'arena.start', { arena: arenaId, mode });
    if (!r) return;
    const rand = mulberry32(r.seed), laser = A.kind === 'laser';
    const m = this.m = { A, M, mode, laser, rand, actors: [], shots: [], t: 0, score: [0, 0], ammo: 40, reload: 0, fireCd: 0, kills: 0, deaths: 0, over: false, hudT: 0, feed: [], zone: M.zone ? { x: A.cx + (rand() - 0.5) * A.w * 0.3, z: A.cz + (rand() - 0.5) * A.d * 0.3 } : null };
    const names = [...NAMES].sort(() => rand() - 0.5);
    const n = M.ffa || M.team * 2;
    const bases = basesOf(A);
    for (let i = 0; i < n; i++) {
      const team = M.ffa ? i : i % 2, me = i === 0;
      let spawn;
      if (M.ffa) { const a = (i / n) * Math.PI * 2; spawn = { x: A.cx + Math.cos(a) * A.w * 0.4, z: A.cz + Math.sin(a) * A.d * 0.4 }; }
      else { const b = bases[team]; spawn = { x: A.cx + b.x + (Math.floor(i / 2) - (M.team - 1) / 2) * 3, z: A.cz + b.z }; }
      const color = M.ffa ? FFA_COLORS[i % FFA_COLORS.length] : TEAM[A.kind][team].color;
      const a = { id: i, me, team, color, name: me ? g.profile.name : names[i % names.length], pos: new THREE.Vector3(spawn.x, 0, spawn.z), spawn, yaw: 0, alive: true, stun: 0, respawn: 0, kills: 0, deaths: 0, outT: 0,
        skill: 0.35 + rand() * 0.45, speed: 3.4 + rand() * 1.2, fireCd: rand(), strafe: rand() < 0.5 ? 1 : -1, strafeT: 0, react: 0, wander: null, av: null };
      if (!me) {
        a.av = new Avatar({ ...DEFAULT_APPEARANCE, skin: pick(rand, SKINS.slice(0, 8)), hair: pick(rand, HAIR_STYLES), hairColor: pick(rand, HAIR_COLORS.slice(0, 7)), top: 'tshirt', topColor: color, bottom: 'jean', bottomColor: '#2b2d42', hat: laser ? null : 'casquette', glasses: laser ? null : 'lunettes-soleil' }, {});
        a.av.hold(gun(A.kind)); g.engine.scene.add(a.av.root);
        a.lab = g.labels.add(a.av.root, h('div.wlabel', { style: { color } }, a.name), 2.2, 30);
      }
      m.actors.push(a);
    }
    m.me = m.actors[0];
    g.player.teleport(m.me.spawn.x, m.me.spawn.z, m.me.team === 0 && !M.ffa ? 0 : Math.atan2(A.cx - m.me.spawn.x, A.cz - m.me.spawn.z));
    g.avatar.hold(gun(A.kind));
    this.saved = { dist: g.cam.dist, min: g.cam.minDist };
    g.cam.dist = 3.4; g.cam.minDist = 1.5; g.cam.pitch = 0.12;
    g.cam.yaw = g.player.yaw + Math.PI;
    m.hud = h('div.ar-hud', m.hudScore = h('b'), m.hudInfo = h('small'));
    m.btns = h('div.foot-btns', h('button', { onpointerdown: (e) => { e.preventDefault(); this.touchFire = true; }, onpointerup: () => { this.touchFire = false; }, onpointerleave: () => { this.touchFire = false; } }, laser ? '⚡ Tirer' : '🎯 Tirer'), h('button', { onpointerdown: (e) => { e.preventDefault(); this.reload(); } }, '🔄 Recharger (R)'), h('button', { onpointerdown: (e) => { e.preventDefault(); this.finish(true); } }, '🏳️ Quitter'));
    g.ui.root.append(this.cross, m.hud, m.btns);
    if (m.zone) {
      m.zoneMesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 30, 48, 1, true), new THREE.MeshBasicMaterial({ color: '#bc00ff', transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
      m.zoneMesh.position.set(m.zone.x, 15, m.zone.z); g.engine.scene.add(m.zoneMesh);
    }
    this.keyOff = g.input.on('key', (e) => { if (!this.m) return; if (e.code === 'KeyR') this.reload(); });
    g.sfx('whistle');
    g.ui.toast(`${laser ? '🔫' : '🎯'} ${M.name} ! Souris = viser, clic = tirer, R = recharger.${M.zone ? ' Reste dans la zone violette !' : ''}`, 'event', 5000);
  }

  reload() { const m = this.m; if (!m || m.laser || m.reload > 0 || m.ammo === 40) return; m.reload = 1.6; this.g.sfx('click'); }

  // ------------------------------------------------------------------ géométrie : rayons et abris
  segBox(ax, ay, az, bx, by, bz, c) {
    // segment contre boîte alignée (slabs) : renvoie t (0..1) du premier contact ou null
    let t0 = 0, t1 = 1;
    for (const [a, b, lo, hi] of [[ax, bx, c.x - c.w / 2, c.x + c.w / 2], [ay, by, 0, c.h], [az, bz, c.z - c.d / 2, c.z + c.d / 2]]) {
      const d = b - a;
      if (Math.abs(d) < 1e-9) { if (a < lo || a > hi) return null; continue; }
      let u0 = (lo - a) / d, u1 = (hi - a) / d; if (u0 > u1) [u0, u1] = [u1, u0];
      t0 = Math.max(t0, u0); t1 = Math.min(t1, u1); if (t0 > t1) return null;
    }
    return t0;
  }
  firstCover(ax, ay, az, bx, by, bz) {
    let best = null;
    for (const c of this.covers[this.m.A.id]) { const t = this.segBox(ax, ay, az, bx, by, bz, c); if (t !== null && (best === null || t < best)) best = t; }
    return best;
  }
  segActor(ax, ay, az, bx, by, bz, a) {
    // segment contre cylindre vertical (rayon R, hauteur HEIGHT) : approximation par le point le plus proche
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1e-9;
    const t = clamp(((a.pos.x - ax) * dx + (a.pos.z - az) * dz) / l2, 0, 1);
    const x = ax + dx * t, z = az + dz * t, y = ay + (by - ay) * t;
    return Math.hypot(x - a.pos.x, z - a.pos.z) < R && y > a.pos.y && y < a.pos.y + HEIGHT ? t : null;
  }
  visible(a, b) {
    return this.firstCover(a.pos.x, EYE, a.pos.z, b.pos.x, 1.2, b.pos.z) === null;
  }
  enemies(a) { return this.m.actors.filter((o) => o !== a && o.alive && (this.m.M.ffa || o.team !== a.team)); }

  // ------------------------------------------------------------------ tirs
  fire(a, tx, ty, tz) {
    const m = this.m, g = this.g;
    const ox = a.pos.x + Math.sin(a.yaw) * 0.4 + Math.cos(a.yaw) * 0.2, oy = a.pos.y + 1.35, oz = a.pos.z + Math.cos(a.yaw) * 0.4 - Math.sin(a.yaw) * 0.2;
    if (m.laser) {
      // laser : instantané, s'arrête sur le premier mur ou la première cible
      const dx = tx - ox, dy = ty - oy, dz = tz - oz, L = Math.hypot(dx, dy, dz) || 1, far = 70;
      const ex = ox + dx / L * far, ey = oy + dy / L * far, ez = oz + dz / L * far;
      let tHit = this.firstCover(ox, oy, oz, ex, ey, ez) ?? 1, victim = null;
      for (const o of m.actors) { if (o === a || !o.alive || o.stun > 0) continue; const t = this.segActor(ox, oy, oz, ex, ey, ez, o); if (t !== null && t < tHit) { tHit = t; victim = o; } }
      this.beam(ox, oy, oz, ox + (ex - ox) * tHit, oy + (ey - oy) * tHit, oz + (ez - oz) * tHit, a.color);
      if (victim && (m.M.ffa || victim.team !== a.team)) this.hit(a, victim);
      if (a.me) g.sfx('beep');
      return;
    }
    // paintball : bille avec une légère retombée
    const dx = tx - ox, dy = ty - oy, dz = tz - oz, L = Math.hypot(dx, dy, dz) || 1, v = 52;
    const mesh = new THREE.Mesh(this.ballGeo, new THREE.MeshStandardMaterial({ color: a.color, emissive: a.color, emissiveIntensity: 0.3 }));
    mesh.position.set(ox, oy, oz); g.engine.scene.add(mesh);
    m.shots.push({ from: a, x: ox, y: oy, z: oz, vx: dx / L * v, vy: dy / L * v + 1.2, vz: dz / L * v, life: 1.6, mesh });
    if (a.me) g.sfx('pop');
  }
  beam(x1, y1, z1, x2, y2, z2, color) {
    const L = Math.hypot(x2 - x1, y2 - y1, z2 - z1);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, L, 5), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }));
    b.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
    b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x2 - x1, y2 - y1, z2 - z1).normalize());
    this.g.engine.scene.add(b); this.beams.push({ mesh: b, t: 0.09 });
  }
  splat(x, y, z, color, nx = 0, ny = 1, nz = 0) {
    const s = new THREE.Mesh(this.splatGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    s.position.set(x + nx * 0.02, y + ny * 0.02, z + nz * 0.02);
    s.lookAt(x + nx, y + ny, z + nz);
    s.scale.setScalar(0.7 + Math.random() * 0.8);
    this.g.engine.scene.add(s); this.splats.push(s);
    if (this.splats.length > 160) this.splats.shift().removeFromParent();
  }

  hit(shooter, victim) {
    const m = this.m, g = this.g;
    if (!victim.alive || m.over) return;
    shooter.kills++; victim.deaths++;
    if (!m.M.ffa) m.score[shooter.team]++;
    if (shooter.me) { m.kills++; g.sfx('success'); }
    if (victim.me) { m.deaths++; g.sfx('splat'); g.cam.shake = 0.3; }
    this.feed(`${shooter.me ? '🫵 Toi' : shooter.name} ${m.laser ? '⚡' : '🎯'} ${victim.me ? 'TOI' : victim.name}`);
    if (m.laser) { victim.stun = m.M.stun; return; }
    victim.alive = false;
    if (m.M.respawn) victim.respawn = m.M.respawn;
    else if (victim.me) victim.place = m.actors.filter((o) => o.alive).length + 1;
    if (victim.av) { victim.av.root.rotation.x = -Math.PI / 2; victim.av.root.position.y = 0.3; }
    if (victim.me) g.ui.toast(m.M.respawn ? `💥 Touché·e par ${shooter.name} ! Retour à la base dans ${m.M.respawn} s...` : `💥 Éliminé·e par ${shooter.name}. Place : ${victim.place}e.`, 'bad', 2500);
    this.checkEnd();
  }
  zoneOut(a) {
    const m = this.m;
    a.alive = false; a.deaths++;
    if (a.me) { m.deaths++; a.place = m.actors.filter((o) => o.alive).length + 1; this.g.ui.toast(`🟣 Éliminé·e par la zone ! Place : ${a.place}e.`, 'bad', 2500); }
    else if (a.av) { a.av.root.rotation.x = -Math.PI / 2; a.av.root.position.y = 0.3; }
    this.feed(`🟣 ${a.me ? 'TOI' : a.name} éliminé·e par la zone`);
    this.checkEnd();
  }
  feed(txt) { const m = this.m; m.feed.unshift(txt); m.feed.length = Math.min(m.feed.length, 4); }

  checkEnd() {
    const m = this.m, M = m.M;
    if (m.over) return;
    if (M.ffa && !m.laser) {
      const alive = m.actors.filter((o) => o.alive);
      if (!m.me.alive) this.finish(false, { place: m.me.place });
      else if (alive.length === 1) this.finish(false, { place: 1 });
    } else if (M.target && Math.max(...m.score) >= M.target) this.finish(false);
  }

  // ------------------------------------------------------------------ boucle
  update(dt) {
    const m = this.m, g = this.g;
    for (let i = this.beams.length - 1; i >= 0; i--) { const b = this.beams[i]; b.t -= dt; if (b.t <= 0) { b.mesh.removeFromParent(); b.mesh.geometry.dispose(); this.beams.splice(i, 1); } }
    if (!m) return;
    m.t += dt;
    const P = g.player, me = m.me, I = g.input, A = m.A;
    // le joueur
    me.pos.copy(P.pos);
    const cam = g.engine.camera, dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    me.yaw = Math.atan2(dir.x, dir.z);
    if (me.alive) P.yaw = me.yaw;
    // touché·e : on ne bouge plus (jusqu'au retour à la base / au rallumage du gilet)
    P.external = !me.alive || me.stun > 0;
    // sortie de l'arène = abandon
    if (Math.abs(P.pos.x - A.cx) > A.w / 2 + 25 || Math.abs(P.pos.z - A.cz) > A.d / 2 + 25) { this.finish(true); return; }
    m.fireCd -= dt;
    if (m.reload > 0) { m.reload -= dt; if (m.reload <= 0) { m.reload = 0; m.ammo = 40; } }
    else if (!m.laser && m.ammo <= 0) this.reload();
    if ((I.actionHeld || I.keys.has('KeyF') || this.touchFire) && m.fireCd <= 0 && me.alive && me.stun <= 0 && !g.ui.blocking && m.reload <= 0 && (m.laser || m.ammo > 0)) {
      m.fireCd = m.laser ? 0.32 : 0.16;
      if (!m.laser) m.ammo--;
      // point visé : rayon depuis la caméra jusqu'au premier abri / adversaire
      const o = cam.position, far = 80, ex = o.x + dir.x * far, ey = o.y + dir.y * far, ez = o.z + dir.z * far;
      let t = this.firstCover(o.x, o.y, o.z, ex, ey, ez) ?? 1;
      for (const a of m.actors) { if (a.me || !a.alive) continue; const u = this.segActor(o.x, o.y, o.z, ex, ey, ez, a); if (u !== null && u < t) t = u; }
      t = Math.max(t, 4 / far);
      this.fire(me, o.x + dir.x * far * t, o.y + dir.y * far * t, o.z + dir.z * far * t);
      P.setPose?.('hold-forward', 0.2);
    }
    // les bots
    const zr = m.zone ? zoneRadius(A, m.t, m.M.secs) : null;
    for (const a of m.actors) {
      if (a.stun > 0) a.stun -= dt;
      if (!a.alive) {
        if (a.respawn > 0) { a.respawn -= dt; if (a.respawn <= 0) { a.alive = true; a.pos.set(a.spawn.x, 0, a.spawn.z); if (a.me) { P.teleport(a.spawn.x, a.spawn.z, P.yaw); P.external = false; } else if (a.av) { a.av.root.rotation.x = 0; } } }
        continue;
      }
      // zone
      if (zr != null) {
        const out = Math.hypot(a.pos.x - m.zone.x, a.pos.z - m.zone.z) > zr;
        a.outT = out ? a.outT + dt : 0;
        if (a.outT > 4) { this.zoneOut(a); continue; }
      }
      if (a.me) continue;
      this.bot(a, dt, zr);
    }
    // projectiles
    for (let i = m.shots.length - 1; i >= 0; i--) {
      const s = m.shots[i];
      s.life -= dt; s.vy -= 6 * dt;
      const nx = s.x + s.vx * dt, ny = s.y + s.vy * dt, nz = s.z + s.vz * dt;
      let t = this.firstCover(s.x, s.y, s.z, nx, ny, nz), victim = null;
      for (const a of m.actors) { if (a === s.from || !a.alive) continue; const u = this.segActor(s.x, s.y, s.z, nx, ny, nz, a); if (u !== null && (t === null || u < t)) { t = u; victim = a; } }
      const ground = ny <= 0.05;
      if (t !== null || ground || s.life <= 0) {
        const tt = t ?? 1, hx = s.x + (nx - s.x) * tt, hy = Math.max(0.05, s.y + (ny - s.y) * tt), hz = s.z + (nz - s.z) * tt;
        if (victim) { if (m.M.ffa || victim.team !== s.from.team) this.hit(s.from, victim); else this.splat(hx, hy, hz, s.from.color, -s.vx, 0, -s.vz); }
        else if (t !== null) { const L = Math.hypot(s.vx, s.vz) || 1; this.splat(hx, hy, hz, s.from.color, -s.vx / L, 0, -s.vz / L); }
        else if (ground) this.splat(hx, 0.05, hz, s.from.color);
        s.mesh.removeFromParent(); s.mesh.material.dispose(); m.shots.splice(i, 1);
        if (!this.m) return;
        continue;
      }
      s.x = nx; s.y = ny; s.z = nz; s.mesh.position.set(nx, ny, nz);
    }
    if (m.zoneMesh) { m.zoneMesh.scale.set(zr, 1, zr); }
    // fin au temps
    if (m.t > m.M.secs && !m.over) {
      if (m.M.ffa && !m.laser) this.finish(false, { place: m.actors.filter((o) => o.alive).length });
      else this.finish(false);
      return;
    }
    // affichage
    this.cross.classList.toggle('off', !me.alive || me.stun > 0);
    m.hudT -= dt;
    if (m.hudT <= 0) {
      m.hudT = 0.2;
      const left = Math.max(0, m.M.secs - m.t), time = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
      const T = TEAM[A.kind];
      let line;
      if (m.M.ffa && !m.laser) line = `👑 ${m.actors.filter((o) => o.alive).length} en jeu · ⏱ ${time}`;
      else if (m.M.ffa) { const rank = 1 + m.actors.filter((o) => o.kills > me.kills).length; line = `⚡ ${me.kills} pts · ${rank}e / ${m.actors.length} · ⏱ ${time}`; }
      else line = `${T[0].name} ${m.score[0]} – ${m.score[1]} ${T[1].name}${m.M.target ? ` (objectif ${m.M.target})` : ''} · ⏱ ${time}`;
      m.hudScore.textContent = line;
      m.hudInfo.innerHTML = '';
      m.hudInfo.append(h('div', m.laser ? (me.stun > 0 ? '🔴 Gilet éteint !' : '🟢 Gilet actif') : m.reload > 0 ? '🔄 Rechargement...' : `🎨 ${m.ammo}/40 billes`, me.outT > 0 ? h('b', { style: { color: '#bc00ff' } }, ` · HORS ZONE ! ${Math.ceil(4 - me.outT)} s`) : null), ...m.feed.map((f) => h('div.ar-feed', f)));
    }
  }

  // un bot : cherche une cible visible, se met à couvert, tire avec plus ou moins de précision
  bot(a, dt, zr) {
    const m = this.m, A = m.A;
    a.fireCd -= dt; a.strafeT -= dt;
    if (a.stun > 0) { a.av.update(dt, { speed: 0, grounded: true, pose: 'idle' }); return; }
    // cible la plus proche visible (portée 40 m)
    let target = null, bd = 40;
    for (const o of this.enemies(a)) { const d = Math.hypot(o.pos.x - a.pos.x, o.pos.z - a.pos.z); if (d < bd && (o.stun <= 0) && this.visible(a, o)) { bd = d; target = o; } }
    let gx, gz;
    if (target) {
      a.react += dt;
      a.yaw = Math.atan2(target.pos.x - a.pos.x, target.pos.z - a.pos.z);
      if (a.strafeT <= 0) { a.strafe = -a.strafe; a.strafeT = 1 + m.rand() * 1.5; }
      const keep = bd > 22 ? 1 : bd < 10 ? -1 : 0;
      gx = a.pos.x + Math.sin(a.yaw) * keep * 3 + Math.cos(a.yaw) * a.strafe * 3;
      gz = a.pos.z + Math.cos(a.yaw) * keep * 3 - Math.sin(a.yaw) * a.strafe * 3;
      if (a.react > 0.65 - a.skill * 0.4 && a.fireCd <= 0) {
        a.fireCd = (m.laser ? 0.6 : 0.4) + (1 - a.skill) * 0.6 + m.rand() * 0.3;
        const spread = (1 - a.skill) * 0.12 + bd * 0.002, lead = m.laser ? 0 : bd / 52;
        const tv = target.me ? this.g.player.vel || { x: 0, z: 0 } : { x: 0, z: 0 };
        this.fire(a, target.pos.x + (tv.x || 0) * lead + (m.rand() - 0.5) * spread * bd, 1.15 + (m.rand() - 0.5) * spread * 8, target.pos.z + (tv.z || 0) * lead + (m.rand() - 0.5) * spread * bd);
      }
    } else {
      a.react = 0;
      if (!a.wander || Math.hypot(a.wander.x - a.pos.x, a.wander.z - a.pos.z) < 2 || m.rand() < dt * 0.1) {
        // en équipe : vers la base adverse ; en solo / zone : un point au hasard (dans la zone)
        const enemyBase = basesOf(A)[1 - (a.team % 2)];
        const cx = zr != null ? m.zone.x : !m.M.ffa ? A.cx + enemyBase.x : A.cx, cz = zr != null ? m.zone.z : !m.M.ffa ? A.cz + enemyBase.z : A.cz;
        const rr = zr != null ? zr * 0.7 : m.M.ffa ? Math.min(A.w, A.d) * 0.45 : 18;
        a.wander = { x: cx + (m.rand() - 0.5) * rr * 2, z: cz + (m.rand() - 0.5) * rr * 2 };
      }
      gx = a.wander.x; gz = a.wander.z;
      a.yaw = Math.atan2(gx - a.pos.x, gz - a.pos.z);
    }
    // déplacement avec évitement des abris
    let dx = gx - a.pos.x, dz = gz - a.pos.z, L = Math.hypot(dx, dz);
    let moving = 0;
    if (L > 0.3) {
      dx /= L; dz /= L;
      const step = a.speed * dt;
      for (const ang of [0, 0.6, -0.6, 1.2, -1.2, 1.9, -1.9]) {
        const c = Math.cos(ang), s = Math.sin(ang), vx = dx * c - dz * s, vz = dx * s + dz * c;
        const nx = a.pos.x + vx * step, nz = a.pos.z + vz * step;
        if (this.free(nx, nz)) { a.pos.x = nx; a.pos.z = nz; moving = a.speed; break; }
      }
    }
    a.pos.x = clamp(a.pos.x, A.cx - A.w / 2 + 1, A.cx + A.w / 2 - 1); a.pos.z = clamp(a.pos.z, A.cz - A.d / 2 + 1, A.cz + A.d / 2 - 1);
    a.av.root.position.set(a.pos.x, 0, a.pos.z); a.av.root.rotation.set(0, a.yaw, 0);
    a.av.update(dt, { speed: moving, grounded: true, pose: target ? 'hold-forward' : undefined });
  }
  free(x, z) { for (const c of this.covers[this.m.A.id]) if (Math.abs(x - c.x) < c.w / 2 + 0.5 && Math.abs(z - c.z) < c.d / 2 + 0.5) return false; return true; }

  async finish(abandon, res = {}) {
    const m = this.m, g = this.g;
    if (!m || m.over) return;
    m.over = true;
    this.m = null;
    for (const a of m.actors) { if (a.av) { a.av.root.removeFromParent(); g.labels.remove?.(a.lab); } }
    for (const s of m.shots) s.mesh.removeFromParent();
    m.zoneMesh?.removeFromParent();
    m.hud.remove(); m.btns.remove(); this.cross.remove();
    this.keyOff?.();
    g.avatar.hold(null); g.player.external = false;
    if (this.saved) { g.cam.dist = this.saved.dist; g.cam.minDist = this.saved.min; }
    const M = m.M;
    let won = false, draw = false, place = res.place;
    if (!M.ffa) { won = m.score[0] > m.score[1]; draw = m.score[0] === m.score[1]; }
    else if (m.laser) place = 1 + m.actors.filter((o) => o.kills > m.me.kills).length;
    const b = BUILDING_BY_ID[m.A.desk];
    g.player.teleport(b.door.x, b.door.z + 2, Math.PI);
    const r = await req(g, 'arena.end', { kills: m.kills, deaths: m.deaths, won, draw, place, abandon });
    if (!r) return;
    if (r.needs) g.emit('needs', r.needs);
    careerToast(g, r.career);
    g.sfx(won || place === 1 ? 'levelup' : 'success');
    const head = r.abandon ? '🏳️ Partie quittée.' : M.ffa ? (place === 1 ? '👑 VICTOIRE ! Tu es le / la dernier·e debout !' : `${place}e place sur ${M.ffa}.`) : won ? `🏆 Victoire des ${TEAM[m.A.kind][0].name} ${m.score[0]}–${m.score[1]} !` : draw ? `🤝 Égalité ${m.score[0]}–${m.score[1]}.` : `😓 Défaite ${m.score[0]}–${m.score[1]}.`;
    g.ui.dialog({ name: m.laser ? 'Arbitre néon' : 'Arbitre', role: m.A.name, text: `${head} ${r.kills} élimination(s), ${r.deaths} fois touché·e.${r.prize ? ` Gain : ${fmt(r.prize)} PC.` : ''}`, choices: [{ label: '🔁 Rejouer', action: (x) => { x.close(); this.start(m.A.id, m.mode); } }, { label: 'OK', ghost: true, action: (x) => x.close() }] });
  }
}
