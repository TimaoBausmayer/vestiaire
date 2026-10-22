import * as THREE from 'three';
import { h } from '../ui/dom.js';
import { groundHeight, WATER_LEVEL, BUILDING_BY_ID } from '../../shared/world-layout.js';
import { windAt, windLabel, forecast, MIN_WIND, SURF_SPOT, WING, maxJump } from '../../shared/wingfoil.js';
import { calNow } from '../events/agenda.js';

// WINGFOIL : on tient l'aile, le vent pousse, la planche décolle sur son foil au-dessus de l'eau.
// Commandes : gauche/droite = tourner, avant = border l'aile (plus de puissance), arrière = choquer,
// Espace = sauter (en vol sur le foil), gauche/droite en l'air = rotations (points bonus).
// Il faut du vent (10 nœuds) : allure idéale vent de travers, impossible face au vent.

const req = async (g, t, p) => { try { return await g.net.request(t, p); } catch (e) { g.ui.toast(e.message, 'bad', 5000); g.sfx('error'); return null; } };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class Wingfoil {
  constructor(g) {
    this.g = g;
    this.s = null;
    this.rig = this.buildRig();
    this.rig.visible = false;
    g.engine.scene.add(this.rig);
  }

  buildRig() {
    const root = new THREE.Group();
    const m = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, ...o });
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 1.5), m('#f4f1ea')); board.position.y = 0; root.add(board);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.125, 1.5), m('#ff9f1c')); root.add(stripe);
    const mast = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.85, 0.12), m('#2b2d42')); mast.position.set(0, -0.48, 0.1); root.add(mast);
    const foil = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.03, 0.22), m('#2b2d42')); foil.position.set(0, -0.9, 0.25); root.add(foil);
    // l'aile gonflable, tenue devant le rider
    const wing = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), m('#ff3fa4', { side: THREE.DoubleSide, transparent: true, opacity: 0.92 }));
    wing.scale.set(1.6, 0.55, 0.9); wing.rotation.set(-Math.PI / 2.4, 0, 0); wing.position.set(0, 2.0, 0.75);
    root.add(wing);
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.8, 6), m('#14141c')); strut.rotation.x = Math.PI / 2.4; strut.position.set(0, 1.75, 0.7); root.add(strut);
    this.wingMesh = wing;
    return root;
  }

  // ------------------------------------------------------------------ Surf Shop
  desk(b) {
    const g = this.g;
    const t = calNow(g), w = windAt(t), W = g.profile.sports?.wing || {};
    const own = (g.profile.inventory.wingfoil || 0) > 0;
    const fc = forecast(t, 6).map((f) => `${f.h} h : ${Math.round(f.kts)} nds`).join(' · ');
    g.ui.dialog({ name: 'Kéké le moniteur', role: 'Surf Shop Vent Debout', text: `Vent actuel : ${w.kts} nœuds (${windLabel(w.kts)}). Il en faut ${MIN_WIND} pour voler. Prévisions : ${fc}. ${own ? 'Ton wingfoil est prêt !' : W.trial ? `Location : ${WING.rental} PC la session, ou achète le tien (${WING.price} PC).` : 'Première fois ? L\'essai est GRATUIT !'}`, choices: [
      own ? { label: '🪁 Aller à l\'eau avec mon wingfoil', action: (m) => { m.close(); this.start('own'); } } : null,
      !own && !W.trial ? { label: '🎁 Essai gratuit', action: (m) => { m.close(); this.start('trial'); } } : null,
      !own ? { label: `🪁 Louer pour une session (${WING.rental} PC)`, action: (m) => { m.close(); this.start('rent'); } } : null,
      { label: '🛒 Boutique (acheter un wingfoil)', action: (m) => { m.close(); import('../ui/shop.js').then(({ openShop }) => openShop(g, 'surf', b)); } },
      { label: `🏆 Mes records (saut ${W.best || 0} m, ${W.bestPoints || 0} pts)`, action: (m) => m.show(`Sessions : ${W.sessions || 0} · sauts : ${W.jumps || 0} · niveau de glisse : ${Math.round(W.skill || 5)}/100. Conseils : vent de travers = vitesse max ; en vol, Espace pour sauter, tourne en l'air pour des rotations !`, [{ label: 'OK', ghost: true, action: (x) => x.close() }]) },
      { label: 'Au revoir', ghost: true, action: (m) => m.close() },
    ].filter(Boolean) });
  }

  async start(mode) {
    const g = this.g;
    const r = await req(g, 'wing.start', { mode });
    if (!r) return;
    if (g.vehicles?.current) g.vehicles.exit(true);
    const P = g.player;
    P.teleport(SURF_SPOT.x, SURF_SPOT.z, Math.PI / 2);
    P.external = true;
    this.s = { x: SURF_SPOT.x, z: SURF_SPOT.z, yaw: Math.PI / 2, speed: 2, y: 0, vy: 0, air: 0, spinAcc: 0, spinStart: 0, crashed: 0, hudT: 0, best: 0, jumps: 0, mode, sheet: 0.7, wind: r.wind };
    this.rig.visible = true;
    this.buttons = h('div.foot-btns', h('button', { onpointerdown: (e) => { e.preventDefault(); this.jump(); } }, '🦘 Saut'), h('button', { onpointerdown: (e) => { e.preventDefault(); this.stop(); } }, '🏖️ Plage'));
    g.ui.root.append(this.buttons);
    g.sfx('whoosh');
    g.ui.toast(`🪁 ${r.paid ? `Location ${r.paid} PC. ` : mode === 'trial' ? 'Essai gratuit ! ' : ''}Vent ${r.wind.kts} nœuds. Tourne pour prendre le vent de travers, Avant = plus de puissance, Espace = saut.`, 'good', 7000);
  }

  jump() {
    const s = this.s;
    if (!s || s.y > 0.05 || s.crashed > 0) return;
    if (s.speed < 6.5) { this.g.ui.toast('Trop lent pour sauter : prends de la vitesse sur le foil !', '', 1200); return; }
    const kts = s.wind.kts;
    s.vy = Math.min(Math.sqrt(2 * 9.8 * maxJump(kts)) * 0.98, 3 + s.speed * 0.42 + kts * 0.12);
    s.y = 0.06; s.air = 0; s.spinAcc = 0; s.maxY = 0; s.spinStart = s.yaw;
    this.g.sfx('whoosh');
  }

  update(dt) {
    const s = this.s, g = this.g;
    if (!s) return;
    const I = g.input, P = g.player;
    s.wind = windAt(calNow(g));
    const w = s.wind;
    // cap du vent : il souffle VERS (dir + PI) ; angle entre notre cap et la direction d'où il vient
    const off = Math.abs(wrap(s.yaw - w.dir));           // 0 = face au vent
    const sail = off < 0.7 ? 0 : off < 1.2 ? (off - 0.7) / 0.5 * 0.8 : off < 2.2 ? 1 : 1 - (off - 2.2) / 0.94 * 0.4;
    if (s.crashed > 0) {
      s.crashed -= dt; s.speed = 0;
      if (s.crashed <= 0) g.ui.toast('🪁 Remonte sur la planche !', '', 1200);
    } else if (s.y > 0) {
      // en l'air : rotations
      s.air += dt;
      s.vy -= 9.8 * dt; s.y += s.vy * dt; s.maxY = Math.max(s.maxY, s.y);
      const spin = I.move.x * 6.5 * dt;
      s.yaw -= spin; s.spinAcc += Math.abs(spin);
      if (I.pressed('Space')) { /* déjà en l'air */ }
      if (s.y <= 0) this.land();
    } else {
      // sur l'eau / sur le foil
      s.sheet = clamp(s.sheet + I.move.y * dt * 0.8, 0.3, 1);
      const turn = (s.speed > 6 ? 1.1 : 1.6) * dt;
      s.yaw -= I.move.x * turn;
      const kts = w.kts < MIN_WIND ? w.kts * 0.4 : w.kts;
      const target = Math.min(WING.maxSpeed, kts * 0.5 * sail * s.sheet * (1 + (g.profile.sports?.wing?.skill || 5) / 300));
      s.speed += (target - s.speed) * Math.min(1, dt * (target > s.speed ? 0.6 : 1.2));
      if (I.pressed('Space')) this.jump();
    }
    const foilH = s.speed > 5.5 ? Math.min(0.75, (s.speed - 5.5) * 0.4) : 0;
    s.x += Math.sin(s.yaw) * s.speed * dt;
    s.z += Math.cos(s.yaw) * s.speed * dt;
    // rester en eau profonde, dans la zone de navigation
    if (groundHeight(s.x, s.z) > WATER_LEVEL - 0.9 || s.z > 236 || Math.abs(s.x) > 896) {
      s.x -= Math.sin(s.yaw) * s.speed * dt; s.z -= Math.cos(s.yaw) * s.speed * dt;
      s.speed *= 0.5; s.yaw += Math.PI * 0.6 * dt * 4;
      if (groundHeight(s.x, s.z) > WATER_LEVEL - 0.3) { this.stop('Retour à la plage !'); return; }
    }
    const y = WATER_LEVEL + 0.15 + foilH + Math.max(0, s.y);
    this.rig.position.set(s.x, y, s.z);
    this.rig.rotation.set(s.y > 0 ? -0.15 : -0.04 * s.speed / 10, s.yaw, s.y > 0 ? 0 : -I.move.x * 0.25);
    // l'aile s'oriente avec le vent
    this.wingMesh.rotation.z = clamp(wrap(w.dir - s.yaw) * 0.3, -0.8, 0.8);
    // le rider
    P.pos.set(s.x, y + 0.06, s.z); P.vel.set(Math.sin(s.yaw) * s.speed, 0, Math.cos(s.yaw) * s.speed); P.yaw = s.yaw; P.grounded = true; P.swimming = s.crashed > 0; P.speed = s.speed;
    const av = P.avatar.root;
    av.position.set(s.x, s.crashed > 0 ? WATER_LEVEL - 0.9 : y + 0.06, s.z); av.rotation.set(0, s.yaw, 0);
    P.avatar.update(dt, { speed: 0, grounded: true, swimming: s.crashed > 0, pose: s.crashed > 0 ? 'idle' : 'hold-forward' });
    // gerbes d'eau
    if (s.speed > 6 && s.y <= 0 && Math.random() < dt * 10) g.fx.emit({ x: s.x - Math.sin(s.yaw) * 0.8, y: WATER_LEVEL + 0.1, z: s.z - Math.cos(s.yaw) * 0.8, n: 4, colors: ['#ffffff', '#bfe9ff'], speed: 2, gravity: 8, life: 0.5, size: 0.12 });
    s.hudT -= dt;
    if (s.hudT <= 0) {
      s.hudT = 0.25;
      const allure = off < 0.7 ? '⛔ face au vent (zone morte)' : off < 1.2 ? 'près du vent' : off < 2.2 ? '✅ vent de travers (top !)' : 'vent arrière';
      g.hud.track('wing', { title: `🪁 Wingfoil · vent ${w.kts} nds`, text: `${Math.round(s.speed * 3.6)} km/h · ${foilH > 0.1 ? 'sur le foil ✈️' : 'dans l\'eau'} · ${allure} · aile ${Math.round(s.sheet * 100)} % · meilleur saut ${s.best.toFixed(1)} m`, button: { label: 'Rentrer à la plage', onclick: () => this.stop() } });
      if (w.kts < MIN_WIND - 2 && !s.windWarn) { s.windWarn = true; g.ui.toast('🌬️ Le vent tombe... ça ne porte presque plus. Rentre à la plage !', 'bad', 4000); }
    }
  }

  async land() {
    const s = this.s, g = this.g;
    s.y = 0; s.vy = 0;
    const spins = Math.floor((s.spinAcc + 0.6) / (Math.PI * 2));
    const err = Math.abs(wrap(s.yaw - s.spinStart));
    // atterrissage : il faut retomber à peu près dans l'axe (ou après des tours complets)
    if (err > 1.0 && s.spinAcc > 0.6) { s.crashed = 2; s.speed = 0; g.sfx('splat'); g.ui.toast('💦 PLOUF ! Atterrissage raté.', 'bad', 1500); return; }
    if (s.spinAcc > 0.6) s.yaw = s.spinStart + spins * Math.PI * 2;
    s.speed *= 0.85;
    const height = s.maxY, air = s.air;
    if (height < 0.6) return;
    const r = await req(g, 'wing.jump', { height, air, spins });
    if (!r || !this.s) return;
    s.jumps++; s.best = Math.max(s.best, r.height);
    g.sfx(r.record ? 'levelup' : 'success');
    g.ui.toast(`🪁 Saut de ${r.height.toFixed(1)} m${r.spins ? ` + ${r.spins} rotation(s)` : ''} : ${r.pts} pts${r.record ? ' · RECORD PERSO !' : ''}`, 'good', 2500);
  }

  stop(msg = '') {
    const s = this.s, g = this.g;
    if (!s) return;
    this.s = null;
    this.rig.visible = false;
    this.buttons?.remove();
    g.hud.track('wing', null);
    const P = g.player;
    P.external = false;
    const shop = BUILDING_BY_ID['surf-shop'];
    P.teleport(shop.door.x, shop.door.z + 3, Math.PI);
    g.net.request('wing.end', {}).catch(() => null);
    g.ui.toast(`🏖️ ${msg || 'Session terminée.'} ${s.jumps} saut(s), meilleur ${s.best.toFixed(1)} m.`, 'good', 3500);
  }
}
