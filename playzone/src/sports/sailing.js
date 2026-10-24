import * as THREE from 'three';
import { h, fmt } from '../ui/dom.js';
import { groundHeight, WATER_LEVEL, BUILDING_BY_ID } from '../../shared/world-layout.js';
import { BOATS, BOAT_IDS, SAIL_MEMBER, SAIL_JUMP_MUL, SAIL_SPOT, ownsBoat, sailPower, defaultSail } from '../../shared/sailing.js';
import { windAtPos, windLabel, maxJump } from '../../shared/wingfoil.js';
import { deepWaterNear, inNavZone } from '../../shared/gear.js';
import { calNow } from '../events/agenda.js';
import { Avatar } from '../characters/avatar.js';
import { DEFAULT_APPEARANCE } from '../../shared/appearance.js';
import { Wake } from './wake.js';

// VOILE ET KITESURF : on barre (gauche / droite), on règle la voile (avant = border, arrière = choquer),
// on fait du rappel (Espace) pour empêcher le bateau de gîter et de dessaler. Bout au vent (45°), la voile
// faseye : il faut virer de bord. En kite : Espace = saut, souris en l'air = 360 et flips.

const req = async (g, t, p) => { try { return await g.net.request(t, p); } catch (e) { g.ui.toast(e.message, 'bad', 5000); g.sfx('error'); return null; } };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, ...o });

function triangle(a, b, c, color) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat(color, { side: THREE.DoubleSide, roughness: 0.7 }));
}

// Modèle 3D d'un support (coque, mât, bôme et grand-voile pivotante, foc ; ou planche + aile de kite)
function buildBoat(B) {
  const root = new THREE.Group(), L = B.len;
  if (B.kite) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, L), mat(B.color)); board.position.y = 0.03; root.add(board);
    for (const z of [-0.45, 0.45]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.16), mat('#14141c')); st.position.set(0, 0.07, z * L * 0.6); root.add(st); }
    const kite = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.55, 8, 28, Math.PI), mat(B.sail, { side: THREE.DoubleSide }));
    kite.scale.set(1, 0.55, 1.6); root.add(kite);
    const lines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#f8f9fa' }));
    lines.frustumCulled = false; root.add(lines);
    return { root, kite, lines, boom: null };
  }
  const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(B.color, { roughness: 0.3 }));
  hull.scale.set(L * 0.21, 0.42, L * 0.5); hull.position.y = 0.18; root.add(hull);
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.06, 24), mat('#f8f9fa', { roughness: 0.6 })); deck.scale.set(L * 0.205, 1, L * 0.49); deck.position.y = 0.19; root.add(deck);
  const cock = new THREE.Mesh(new THREE.BoxGeometry(L * 0.25, 0.08, L * 0.38), mat('#dfe3e8')); cock.position.set(0, 0.2, -L * 0.12); root.add(cock);
  const mz = L * 0.18;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, B.mast, 8), mat('#c0c4cc', { metalness: 0.6, roughness: 0.3 })); mast.position.set(0, 0.2 + B.mast / 2, mz); root.add(mast);
  // bôme + grand-voile, qui pivotent autour du mât
  const boom = new THREE.Group(); boom.position.set(0, 0.2, mz); root.add(boom);
  const bl = L * 0.6;
  const boomBar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, bl, 6).rotateX(Math.PI / 2), mat('#c0c4cc', { metalness: 0.5 })); boomBar.position.set(0, 0.7, -bl / 2); boom.add(boomBar);
  boom.add(triangle([0, 0.72, 0], [0, B.mast - 0.1, 0], [0, 0.72, -bl], B.sail));
  // bande de couleur (numéro de voile)
  boom.add(triangle([0.01, B.mast * 0.55, -0.05], [0.01, B.mast * 0.65, -0.05], [0.01, B.mast * 0.55, -bl * 0.35], B.color === '#f8f9fa' ? '#3a86ff' : B.color));
  let jib = null;
  if (B.jib) { jib = triangle([0, B.mast * 0.78, mz], [0, 0.3, L * 0.48], [0, 0.35, mz + 0.15], '#f8f9fa'); root.add(jib); }
  return { root, boom, jib, hull };
}

export class Sailing {
  constructor(g) {
    this.g = g;
    this.s = null;
    this.models = {};
    this.wake = new Wake(g.engine.scene, { width: 1.1, y: WATER_LEVEL + 0.04 });
  }

  model(id) {
    if (!this.models[id]) { const m = buildBoat(BOATS[id]); m.root.visible = false; this.g.engine.scene.add(m.root); this.models[id] = m; }
    return this.models[id];
  }

  // ------------------------------------------------------------------ club-house
  desk(b) {
    const g = this.g, p = g.profile, S = { ...defaultSail(), ...(p.sports?.sail || {}) }, now = g.now();
    const w = windAtPos(calNow(g), b.x, b.z + 120);
    const member = S.member && S.member.until > now;
    const m = g.ui.modal({
      title: '⛵ Club de Voile du Cap Venteux', sub: `Vent sur le plan d'eau : ${w.kts} nœuds (${windLabel(w.kts)}) — ici, il y a toujours du vent ! Niveau de voile ${Math.round(S.skill)}/100.`,
      width: 'min(640px, 96vw)',
      build: (body) => {
        body.append(h('div.list-item', h('span', { style: { fontSize: '24px' } }, member ? '🎫' : '🏷️'),
          h('div.grow', h('div.t', member ? `${SAIL_MEMBER.name} : active` : SAIL_MEMBER.name), h('div.d', member ? 'Tous les bateaux du club sont à toi.' : `${SAIL_MEMBER.days} jours, tous les bateaux en libre accès. Sinon : 1er essai gratuit sur chaque support, puis location.`)),
          member ? null : h('button.btn.small', { onclick: async () => { if (await req(g, 'sail.member', {})) { g.sfx('cash'); m.refresh(); } } }, `${fmt(SAIL_MEMBER.price)} PC`)));
        for (const id of BOAT_IDS) {
          const B = BOATS[id], own = ownsBoat(p, id), trial = !S.trials.includes(id);
          const how = own ? 'à toi' : member || p.admin ? 'licence' : trial ? 'essai gratuit' : `location ${B.rent} PC`;
          body.append(h('div.list-item', h('span', { style: { fontSize: '24px' } }, B.emoji),
            h('div.grow', h('div.t', `${B.name}${B.crew > 1 ? ' · en double' : ''}${B.level ? ` · niveau ${B.level}` : ''}`), h('div.d', `${B.desc} Vitesse max ≈ ${Math.round(B.max * 3.6)} km/h.`)),
            h('button.btn.small', { onclick: () => { m.close(); this.start(id, this.launchFor(b)); } }, `Naviguer (${how})`)));
        }
        body.append(h('p.muted', 'Barre : gauche / droite · voile : avant = border, arrière = choquer · Espace = rappel (ou saut en kite). Bout au vent (45°), la voile faseye : vire de bord ! Trop de gîte = dessalage.'));
      },
    });
  }

  // départ du plan d'eau du club, au large des pontons de la marina
  launchFor(b) { return b?.id === 'club-voile' ? { x: SAIL_SPOT.x, z: SAIL_SPOT.z } : deepWaterNear(b.door.x, b.door.z, 90); }

  // mise à l'eau « où on veut » avec son propre bateau
  launchHere(id) {
    const P = this.g.player;
    const at = deepWaterNear(P.pos.x, P.pos.z, 48);
    if (!at) { this.g.ui.toast('🌊 Pas d\'eau profonde à côté : approche-toi de la mer, du lac ou d\'un port.', 'bad', 3500); return; }
    this.start(id, at);
  }

  async start(id, at) {
    const g = this.g, P = g.player, B = BOATS[id];
    if (this.s || g.wingfoil?.s || g.jetski?.s) { g.ui.toast('Termine d\'abord ton activité en cours.', 'bad'); return; }
    if (!at) { g.ui.toast('Pas d\'eau profonde à côté.', 'bad'); return; }
    const back = { x: P.pos.x, z: P.pos.z };
    const r = await req(g, 'sail.start', { boat: id, at });
    if (!r) return;
    if (g.vehicles?.current) g.vehicles.exit(true);
    P.teleport(at.x, at.z, 0);
    P.external = true; P.noJump = true;
    const M = this.model(id);
    M.root.visible = true;
    let crew = null;
    if (B.crew > 1) { crew = new Avatar({ ...DEFAULT_APPEARANCE, skin: '#c68642', hair: 'court', top: 'sweat', topColor: B.color === '#f8f9fa' ? '#3a86ff' : B.color }, {}); g.engine.scene.add(crew.root); }
    this.s = { id, B, M, crew, back, x: at.x, z: at.z, yaw: r.wind.dir + Math.PI / 2, speed: 0.5, sheet: 0.8, heel: 0, over: 0, capsized: 0, capsizes: 0, y: 0, vy: 0, air: 0, spinAcc: 0, flipAcc: 0, pitch: 0, best: 0, jumps: 0, hudT: 0, skill: r.skill || 5, wind: r.wind };
    this.buttons = h('div.foot-btns', h('button', { onpointerdown: (e) => { e.preventDefault(); this.touchHike = true; }, onpointerup: () => { this.touchHike = false; } }, B.kite ? '🦘 Saut' : '💪 Rappel'), h('button', { onpointerdown: (e) => { e.preventDefault(); this.stop(); } }, '⚓ Rentrer'));
    g.ui.root.append(this.buttons);
    g.sfx('whoosh');
    g.ui.toast(`${B.emoji} ${B.name} à l'eau ! ${r.mode === 'trial' ? 'Essai gratuit. ' : r.paid ? `Location ${r.paid} PC. ` : ''}Vent ${r.wind.kts} nœuds. ${B.kite ? 'Espace = saut.' : 'Espace = rappel contre la gîte.'}`, 'good', 6000);
  }

  update(dt) {
    const s = this.s, g = this.g;
    if (!s) return;
    const I = g.input, P = g.player, B = s.B, M = s.M;
    s.wind = windAtPos(calNow(g), s.x, s.z);
    const w = s.wind, kts = w.kts;
    const rel = wrap(s.yaw - w.dir), off = Math.abs(rel), side = Math.sign(rel) || 1;
    const hiking = I.keys.has('Space') || this.touchHike;
    const skill = s.skill / 100;
    if (s.capsized > 0) {
      s.capsized -= dt; s.speed *= Math.exp(-dt * 3);
      if (s.capsized <= 0) { s.heel = 0; s.over = 0; g.ui.toast('⛵ Bateau redressé : c\'est reparti !', '', 1500); }
    } else if (s.y > 0) {
      // kite en l'air : 360 et flips à la souris
      s.air += dt; s.vy -= 9.8 * dt; s.y += s.vy * dt; s.maxY = Math.max(s.maxY, s.y);
      const spin = I.move.x * 6.5 * dt + (I.mouse.dx + I.look.dx) * 0.011;
      s.yaw -= spin; s.spinAcc += Math.abs(spin);
      const flip = I.move.y * -5.5 * dt + (I.mouse.dy + I.look.dy) * 0.011;
      s.pitch += flip; s.flipAcc += Math.abs(flip);
      if (s.y <= 0) this.land();
    } else {
      s.sheet = clamp(s.sheet + I.move.y * dt * 0.7, 0.35, 1);
      s.yaw -= I.move.x * B.turn * dt * (0.35 + Math.min(1, s.speed / 3));
      const pw = sailPower(off, B.kite) * s.sheet;
      const target = Math.min(B.max * (1 + skill * 0.25), kts * 0.514 * B.eff * pw * 1.15);
      s.speed += (target - s.speed) * Math.min(1, dt * (target > s.speed ? 0.45 : 0.9));
      if (B.kite) {
        if (I.pressed('Space') || (this.touchHike && !s.jumpLatch)) this.jump();
        s.jumpLatch = this.touchHike;
      } else {
        // gîte : le vent dans la voile couche le bateau, le rappel le redresse
        const force = pw * Math.pow(kts / 18, 2) / (B.stiff * (1 + skill * 0.6));
        // rappel du barreur (Espace) + équipier au trapèze sur les bateaux en double
        const righting = (hiking ? B.hike * (1 + skill * 0.5) : 0) + (B.crew > 1 ? 0.55 : 0);
        s.heel += ((force - righting) - s.heel) * Math.min(1, dt * 2.5);
        if (s.heel > 1.15) s.over += dt; else s.over = Math.max(0, s.over - dt);
        if (s.over > 1.6) { s.capsized = 3.5; s.capsizes++; s.speed = 0; g.sfx('splat'); g.ui.toast('💦 DESSALÉ ! Dans les rafales : rappel (Espace) et choque la voile (arrière).', 'bad', 3500); }
      }
    }
    s.x += Math.sin(s.yaw) * s.speed * dt;
    s.z += Math.cos(s.yaw) * s.speed * dt;
    if (groundHeight(s.x, s.z) > WATER_LEVEL - 0.6 || !inNavZone(s.x, s.z)) {
      s.x -= Math.sin(s.yaw) * s.speed * dt * 1.5; s.z -= Math.cos(s.yaw) * s.speed * dt * 1.5;
      s.speed *= 0.3; s.yaw += Math.PI * dt * 2;
      g.sfx('bump');
    }
    // affichage du bateau : gîte, tangage dans les vagues, bôme du côté sous le vent
    const heelVis = s.capsized > 0 ? side * 1.45 : side * clamp(s.heel, 0, 1.3) * 0.5;
    const y = WATER_LEVEL + Math.max(0, s.y) + Math.sin(g.now() / 500 + s.x) * 0.05;
    M.root.position.set(s.x, y, s.z);
    M.root.rotation.set(s.y > 0 ? s.pitch : Math.sin(g.now() / 700) * 0.03, s.yaw, B.kite ? 0 : -heelVis, 'YXZ');
    if (M.boom) M.boom.rotation.y = side * clamp(0.25 + (off - 0.8) * 0.55 * (1.15 - s.sheet), 0.12, 1.35);
    if (B.kite) {
      // aile de traction : sous le vent, à 14 m de haut, lignes jusqu'au rider
      const kd = w.dir + Math.PI + side * 0.5, kx = Math.sin(kd) * 16, kz = Math.cos(kd) * 16;
      const local = new THREE.Vector3(kx, 14, kz).applyAxisAngle(new THREE.Vector3(0, 1, 0), -s.yaw);
      M.kite.position.copy(local);
      M.kite.rotation.set(0, Math.atan2(local.x, local.z), 0);
      M.lines.geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 1.2, 0, local.x - 2, local.y, local.z, 0, 1.2, 0, local.x + 2, local.y, local.z], 3));
    }
    this.wake.update(dt);
    if (s.speed > 1 && s.y <= 0) this.wake.push(s.x - Math.sin(s.yaw) * B.len * 0.5, s.z - Math.cos(s.yaw) * B.len * 0.5, s.yaw, Math.min(1, s.speed / 8));
    // marin(s) : assis au vent, couché dehors au rappel ; équipier au trapèze
    const lean = hiking && !B.kite ? 0.75 : 0.25, beam = B.len * 0.21;
    const sx = -side * beam * (hiking ? 1.05 : 0.6), base = new THREE.Vector3(sx, 0.25, -B.len * 0.28).applyEuler(M.root.rotation).add(M.root.position);
    P.pos.set(s.x, y + 0.2, s.z); P.vel.set(Math.sin(s.yaw) * s.speed, 0, Math.cos(s.yaw) * s.speed); P.yaw = s.yaw; P.grounded = true; P.speed = s.speed; P.swimming = s.capsized > 0;
    const av = P.avatar.root;
    if (B.kite) { av.position.set(s.x, y + 0.06, s.z); av.rotation.set(s.y > 0 ? s.pitch : 0, s.yaw, side * 0.35, 'YXZ'); P.avatar.update(dt, { speed: 0, grounded: true, pose: 'hold-forward' }); }
    else { av.position.copy(base); av.rotation.set(0, s.yaw, -heelVis + side * lean, 'YXZ'); P.avatar.update(dt, { speed: 0, grounded: true, swimming: s.capsized > 0, pose: 'sit' }); }
    if (s.crew) {
      const cpos = new THREE.Vector3(-side * beam * (s.heel > 0.4 ? 1.6 : 0.7), 0.3, B.len * 0.02).applyEuler(M.root.rotation).add(M.root.position);
      s.crew.root.position.copy(cpos); s.crew.root.rotation.set(0, s.yaw, -heelVis + side * (s.heel > 0.4 ? 1.2 : 0.2), 'YXZ');
      s.crew.update(dt, { speed: 0, grounded: true, pose: s.heel > 0.4 ? 'hold-forward' : 'sit' });
    }
    if (s.speed > 4 && Math.random() < dt * 8) g.fx.emit({ x: s.x + Math.sin(s.yaw) * B.len * 0.45, y: WATER_LEVEL + 0.1, z: s.z + Math.cos(s.yaw) * B.len * 0.45, n: 3, colors: ['#ffffff', '#bfe9ff'], speed: 1.5, gravity: 8, life: 0.4, size: 0.1 });
    s.hudT -= dt;
    if (s.hudT <= 0) {
      s.hudT = 0.25;
      const allure = off < (B.kite ? 0.85 : 0.75) ? '⛔ bout au vent : vire de bord !' : off < 1.2 ? 'au près' : off < 2.0 ? '✅ travers / largue (top)' : 'vent arrière';
      g.hud.track('sail', { title: `${B.emoji} ${B.name} · vent ${kts} nds`, text: `${Math.round(s.speed * 3.6)} km/h · ${allure} · voile ${Math.round(s.sheet * 100)} %${B.kite ? ` · meilleur saut ${s.best.toFixed(1)} m` : ` · gîte ${Math.round(clamp(s.heel, 0, 1.5) * 40)}°${s.heel > 0.9 ? ' ⚠️ RAPPEL !' : ''}`}`, button: { label: 'Rentrer au port', onclick: () => this.stop() } });
    }
  }

  jump() {
    const s = this.s;
    if (!s || s.y > 0.05 || s.capsized > 0) return;
    if (s.speed < 6) { this.g.ui.toast('Trop lent pour décoller : prends de la vitesse au travers !', '', 1200); return; }
    s.vy = Math.min(Math.sqrt(2 * 9.8 * maxJump(s.wind.kts) * SAIL_JUMP_MUL) * 0.97, 4 + s.speed * 0.5 + s.wind.kts * 0.15);
    s.y = 0.06; s.air = 0; s.spinAcc = 0; s.flipAcc = 0; s.pitch = 0; s.maxY = 0; s.spinStart = s.yaw;
    this.g.sfx('whoosh');
  }

  async land() {
    const s = this.s, g = this.g;
    s.y = 0; s.vy = 0;
    const spins = Math.floor((s.spinAcc + 0.6) / (Math.PI * 2)), flips = Math.floor((s.flipAcc + 0.7) / (Math.PI * 2));
    const err = Math.abs(wrap(s.yaw - s.spinStart)), perr = Math.abs(wrap(s.pitch));
    const tol = 0.9 + s.skill / 100 * 0.7;
    s.pitch = 0;
    if ((err > tol && s.spinAcc > 0.6) || (perr > tol * 0.9 && s.flipAcc > 0.6)) { s.capsized = 2.5; s.capsizes++; s.speed = 0; g.sfx('splat'); g.ui.toast('💦 Crash ! Réception ratée.', 'bad', 1500); return; }
    if (s.spinAcc > 0.6) s.yaw = s.spinStart + spins * Math.PI * 2;
    s.speed *= 0.85;
    if (s.maxY < 0.8) return;
    const r = await req(g, 'sail.jump', { height: s.maxY, air: s.air, spins, flips });
    if (!r || !this.s) return;
    s.jumps++; s.best = Math.max(s.best, r.height);
    g.sfx(r.record ? 'levelup' : 'success');
    g.ui.toast(`🪂 Saut de ${r.height.toFixed(1)} m${r.spins ? ` · ${r.spins} × 360` : ''}${r.flips ? ` · ${r.flips} flip(s)` : ''} : ${r.pts} pts${r.record ? ' · RECORD !' : ''}`, 'good', 2600);
  }

  stop(msg = '') {
    const s = this.s, g = this.g;
    if (!s) return;
    this.s = null;
    s.M.root.visible = false;
    if (s.crew) { g.engine.scene.remove(s.crew.root); s.crew.dispose?.(); }
    this.wake.clear();
    this.buttons?.remove(); this.touchHike = false;
    g.hud.track('sail', null);
    const P = g.player;
    P.external = false; P.noJump = false; P.swimming = false;
    P.teleport(s.x, s.z, s.yaw);   // on reste là où on est, dans l'eau
    g.net.request('sail.end', { capsizes: s.capsizes }).then((r) => { if (r?.skill) g.profile.sports.sail = { ...(g.profile.sports.sail || {}), skill: r.skill }; }).catch(() => null);
    g.ui.toast(`⚓ ${msg || 'Retour au port.'}${s.capsizes ? ` ${s.capsizes} dessalage(s).` : ''}${s.jumps ? ` ${s.jumps} saut(s), meilleur ${s.best.toFixed(1)} m.` : ''}`, 'good', 3500);
  }
}
