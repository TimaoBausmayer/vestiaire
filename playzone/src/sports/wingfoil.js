import * as THREE from 'three';
import { h } from '../ui/dom.js';
import { groundHeight, WATER_LEVEL, BUILDING_BY_ID } from '../../shared/world-layout.js';
import { windAt, windLabel, forecast, MIN_WIND, SURF_SPOT, WING, maxJump } from '../../shared/wingfoil.js';
import { calNow } from '../events/agenda.js';
import { Wake } from './wake.js';
import { gearStats, equipped, deepWaterNear, inNavZone } from '../../shared/gear.js';

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
    this.wake = new Wake(g.engine.scene, { width: 0.9, y: WATER_LEVEL + 0.04 });
    // filets de vent : traits blancs qui filent dans le sens du vent autour du rider
    this.streaks = [];
    const sm = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false });
    for (let i = 0; i < 26; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 3 + Math.random() * 3), sm); l.visible = false; g.engine.scene.add(l); this.streaks.push({ m: l, x: 0, y: 0, z: 0 }); }
  }

  buildRig() {
    const root = new THREE.Group();
    const m = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, ...o });
    // planche effilée (pont blanc, rails colorés, pad antidérapant)
    const shape = new THREE.Shape();
    shape.moveTo(-0.28, -0.75); shape.lineTo(0.28, -0.75); shape.quadraticCurveTo(0.33, 0.2, 0.18, 0.62); shape.quadraticCurveTo(0, 0.85, -0.18, 0.62); shape.quadraticCurveTo(-0.33, 0.2, -0.28, -0.75);
    const boardG = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 }).rotateX(-Math.PI / 2);
    const board = new THREE.Mesh(boardG, m('#f7f7f2')); board.position.y = -0.05; root.add(board);
    const rail = new THREE.Mesh(boardG, this.railMat = m('#ff9f1c')); rail.scale.set(1.04, 0.5, 1.02); rail.position.y = -0.07; root.add(rail);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.02, 0.7), m('#2b2d42', { roughness: 0.9 })); pad.position.set(0, 0.09, -0.25); root.add(pad);
    // foil : mât, fuselage, aile avant (grande), stabilisateur
    const carbon = m('#1b1b1f', { roughness: 0.3, metalness: 0.3 });
    const mast = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.85, 0.13), carbon); mast.position.set(0, -0.48, 0.05); root.add(mast);
    const fus = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.9, 8).rotateX(Math.PI / 2), carbon); fus.position.set(0, -0.9, 0.08); root.add(fus);
    const fw = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 6), carbon); fw.scale.set(0.42, 0.012, 0.09); fw.position.set(0, -0.9, 0.5); root.add(fw);
    const st = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 4), carbon); st.scale.set(0.16, 0.01, 0.05); st.position.set(0, -0.9, -0.36); root.add(st);
    // l'aile gonflable : bord d'attaque (boudin), voilure, latte centrale avec poignées, fenêtre
    const wing = new THREE.Group();
    const lead = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.075, 8, 32, Math.PI), this.leadMat = m('#ff3fa4'));
    wing.add(lead);
    const canopy = new THREE.Mesh(new THREE.CircleGeometry(1.35, 32, 0, Math.PI), this.canopyMat = m('#ffd6ec', { side: THREE.DoubleSide, transparent: true, opacity: 0.9, roughness: 0.6 }));
    wing.add(canopy);
    const win = new THREE.Mesh(new THREE.CircleGeometry(0.28, 16), m('#bfe9ff', { side: THREE.DoubleSide, transparent: true, opacity: 0.55, roughness: 0.1 })); win.position.set(0.55, 0.45, 0.01); wing.add(win);
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 1.35, 8), this.leadMat); strut.position.set(0, 0.675, 0.02); wing.add(strut);
    for (const yy of [0.35, 0.85]) { const hd = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.02, 6, 12), m('#14141c')); hd.position.set(0, yy, 0.08); hd.rotation.y = Math.PI / 2; wing.add(hd); }
    // tenue à bout de bras, de côté (comme une voile), légèrement inclinée
    wing.rotation.set(-0.35, Math.PI / 2, 0, 'YXZ'); wing.position.set(0.15, 1.15, 0.45);
    root.add(wing);
    this.wingMesh = wing;
    return root;
  }

  // Habille le rig avec l'équipement choisi : couleurs de l'aile et de la planche, taille de l'aile.
  applyGear(gear) {
    const c = new THREE.Color(gear.wingColor);
    this.leadMat.color.copy(c);
    this.canopyMat.color.copy(c).lerp(new THREE.Color('#ffffff'), 0.7);
    this.railMat.color.set(gear.boardColor);
    const size = { 'aile-3': 0.78, 'aile-4': 0.88, 'aile-6': 1.08, 'aile-7': 1.16, 'aile-free': 0.94, 'aile-mamie': 0.7 }[gear.wing] || 1;
    this.wingMesh.scale.setScalar(size);
  }

  // ------------------------------------------------------------------ Surf Shop
  desk(b) {
    const g = this.g;
    const t = calNow(g), w = windAt(t), W = g.profile.sports?.wing || {};
    const own = (g.profile.inventory.wingfoil || 0) > 0;
    const fc = forecast(t, 6).map((f) => `${f.h} h : ${Math.round(f.kts)} nds`).join(' · ');
    g.ui.dialog({ name: 'Kéké le moniteur', role: 'Surf Shop Vent Debout', text: `Vent actuel : ${w.kts} nœuds (${windLabel(w.kts)}). Il en faut ${MIN_WIND} pour voler. Prévisions : ${fc}. ${own ? 'Ton wingfoil est prêt !' : W.trial ? `Location : ${WING.rental} PC la session, ou achète le tien (${WING.price} PC).` : 'Première fois ? L\'essai est GRATUIT !'}`, choices: [
      own ? { label: '🪁 Aller à l\'eau avec mon wingfoil', action: (m) => { m.close(); this.start('own'); } } : null,
      { label: '🎛️ Mon équipement (aile, planche, foil, couleurs)', action: (m) => { m.close(); g.phone?.open('gear'); } },
      !own && !W.trial ? { label: '🎁 Essai gratuit', action: (m) => { m.close(); this.start('trial'); } } : null,
      !own ? { label: `🪁 Louer pour une session (${WING.rental} PC)`, action: (m) => { m.close(); this.start('rent'); } } : null,
      { label: '🚤 Jet ski (essai gratuit, abonnement ou achat)', action: (m) => { m.close(); g.races?.desk('jetski'); } },
      { label: '🛒 Boutique (wingfoil, jet ski)', action: (m) => { m.close(); import('../ui/shop.js').then(({ openShop }) => openShop(g, 'surf', b)); } },
      { label: `🏆 Mes records (saut ${W.best || 0} m, ${W.bestPoints || 0} pts)`, action: (m) => m.show(`Sessions : ${W.sessions || 0} · sauts : ${W.jumps || 0} · niveau de glisse : ${Math.round(W.skill || 5)}/100. Conseils : vent de travers = vitesse max ; en vol, Espace pour sauter, tourne en l'air pour des rotations !`, [{ label: 'OK', ghost: true, action: (x) => x.close() }]) },
      { label: 'Au revoir', ghost: true, action: (m) => m.close() },
    ].filter(Boolean) });
  }

  // Mise à l'eau « où on veut » (avec son propre matériel) : l'eau profonde la plus proche.
  launchHere() {
    const g = this.g, P = g.player;
    if (this.s) return;
    const at = deepWaterNear(P.pos.x, P.pos.z, 48);
    if (!at) { g.ui.toast('🌊 Pas d\'eau profonde à côté : approche-toi de la mer, du lac ou d\'un port.', 'bad', 3500); return; }
    this.start('own', at);
  }

  async start(mode, at = null) {
    const g = this.g;
    const P = g.player;
    const back = { x: P.pos.x, z: P.pos.z };
    const r = await req(g, 'wing.start', { mode, ...(at ? { at } : {}) });
    if (!r) return;
    if (g.vehicles?.current) g.vehicles.exit(true);
    const sp = at || SURF_SPOT;
    P.teleport(sp.x, sp.z, Math.PI / 2);
    P.external = true;
    this.stats = r.stats || gearStats(equipped(g.profile));
    this.applyGear(r.gear || equipped(g.profile));
    this.s = { back: at ? back : null, x: sp.x, z: sp.z, yaw: Math.PI / 2, speed: 2, y: 0, vy: 0, air: 0, spinAcc: 0, spinStart: 0, crashed: 0, hudT: 0, best: 0, jumps: 0, mode, sheet: 0.7, wind: r.wind, stamina: 1, stowed: false, pitch: 0, flipAcc: 0 };
    this.wingMesh.visible = true;
    this.rig.visible = true;
    this.buttons = h('div.foot-btns', h('button', { onpointerdown: (e) => { e.preventDefault(); this.pump(); } }, '💪 Pomper (E)'), h('button', { onpointerdown: (e) => { e.preventDefault(); this.jump(); } }, '🦘 Saut'), h('button', { onpointerdown: (e) => { e.preventDefault(); this.toggleWing(); } }, '🎒 Aile (R)'), h('button', { onpointerdown: (e) => { e.preventDefault(); this.stop(); } }, '🏖️ Plage'));
    g.ui.root.append(this.buttons);
    g.sfx('whoosh');
    g.ui.toast(`🪁 ${r.paid ? `Location ${r.paid} PC. ` : mode === 'trial' ? 'Essai gratuit ! ' : ''}Vent ${r.wind.kts} nœuds. Vent de travers = vitesse, Avant = puissance, E = pomper, Espace = saut (en l'air : souris = 360 et flips), R = ranger l'aile.`, 'good', 7000);
  }

  jump() {
    const s = this.s;
    if (!s || s.y > 0.05 || s.crashed > 0) return;
    if (s.speed < 6.5) { this.g.ui.toast('Trop lent pour sauter : prends de la vitesse sur le foil !', '', 1200); return; }
    const kts = s.stowed ? 8 : s.wind.kts;
    const J = this.stats.jump * (s.stowed ? 0.6 : 1);
    s.vy = Math.min(Math.sqrt(2 * 9.8 * maxJump(kts) * J) * 0.98, (3 + s.speed * 0.42 + kts * 0.12) * Math.sqrt(J));
    s.y = 0.06; s.air = 0; s.spinAcc = 0; s.flipAcc = 0; s.pitch = 0; s.maxY = 0; s.spinStart = s.yaw;
    this.g.sfx('whoosh');
  }

  // Pomper (touche E) : un coup de jambes et de bras qui relance la planche. En rythme (toutes les
  // 0,3 à 0,9 s) c'est très efficace ; trop vite, on s'épuise. Le niveau de glisse rend chaque coup meilleur.
  pump() {
    const s = this.s, g = this.g;
    if (!s || s.y > 0 || s.crashed > 0) return;
    const now = g.now(), gap = (now - (s.lastPump || 0)) / 1000;
    s.lastPump = now;
    if (s.stamina < 0.12) { g.ui.toast('😮‍💨 À bout de souffle : laisse-toi glisser un instant.', '', 1200); return; }
    const rhythm = gap > 0.3 && gap < 0.9 ? 1 : gap <= 0.3 ? 0.35 : 0.7;
    const skill = (g.profile.sports?.wing?.skill || 5) / 100;
    s.speed += (0.75 + skill * 0.6) * rhythm * (s.speed < this.stats.takeoff + 1 ? 1.25 : 0.8);
    s.stamina = Math.max(0, s.stamina - 0.09);
    s.pumpAnim = 0.35;
    g.sfx('whoosh');
  }

  // Ranger / sortir l'aile (touche R) : sans aile, on vole seulement en pompant (pumpfoil).
  toggleWing() {
    const s = this.s;
    if (!s) return;
    s.stowed = !s.stowed;
    this.wingMesh.visible = !s.stowed;
    this.g.ui.toast(s.stowed ? '🎒 Aile rangée dans le dos : pompe avec E pour rester sur le foil !' : '🪁 Aile sortie : le vent te pousse à nouveau.', '', 2500);
  }

  update(dt) {
    const s = this.s, g = this.g;
    if (!s) return;
    const I = g.input, P = g.player;
    s.wind = windAt(calNow(g));
    const w = s.wind;
    if (I.pressed('KeyE')) this.pump();
    if (I.pressed('KeyR')) this.toggleWing();
    s.stamina = Math.min(1, (s.stamina ?? 1) + dt * 0.12);
    // cap du vent : il souffle VERS (dir + PI) ; angle entre notre cap et la direction d'où il vient
    const off = Math.abs(wrap(s.yaw - w.dir));           // 0 = face au vent
    const sail = s.stowed ? 0 : off < 0.7 ? 0 : off < 1.2 ? (off - 0.7) / 0.5 * 0.8 : off < 2.2 ? 1 : 1 - (off - 2.2) / 0.94 * 0.4;
    const tk = this.stats.takeoff;
    const foiling = s.speed > tk;
    if (s.crashed > 0) {
      s.crashed -= dt; s.speed = 0;
      if (s.crashed <= 0) g.ui.toast('🪁 Remonte sur la planche !', '', 1200);
    } else if (s.y > 0) {
      // en l'air : souris (ou gauche / droite) = rotations 360, souris vers le bas (ou avant / arrière) = flips
      s.air += dt;
      s.vy -= 9.8 * dt; s.y += s.vy * dt; s.maxY = Math.max(s.maxY, s.y);
      const mx = (I.mouse.dx + I.look.dx) * 0.011, my = (I.mouse.dy + I.look.dy) * 0.011;
      const spin = (I.move.x * 6.5 * dt + mx) * this.stats.spin;
      s.yaw -= spin; s.spinAcc += Math.abs(spin);
      const flip = (I.move.y * -5.5 * dt + my) * this.stats.spin * 0.9;
      s.pitch += flip; s.flipAcc += Math.abs(flip);
      if (s.y <= 0) this.land();
    } else {
      // sur l'eau / sur le foil : en vol, la traînée chute et la planche file bien plus vite
      s.sheet = clamp(s.sheet + I.move.y * dt * 0.8, 0.3, 1);
      const turn = (s.speed > 6 ? 1.1 : 1.6) * this.stats.turn * dt;
      s.yaw -= I.move.x * turn;
      const minW = this.stats.minWind;
      const kts = w.kts < minW ? w.kts * 0.4 : w.kts * Math.max(1, MIN_WIND / minW);
      const fly = foiling ? WING.foilBoost : 0.8;
      const cap = WING.maxSpeed * this.stats.speed * (foiling ? 1.4 : 1);
      const target = Math.min(cap, kts * 0.5 * this.stats.speed * sail * s.sheet * fly * (1 + (g.profile.sports?.wing?.skill || 5) / 300));
      // sans propulsion, on ralentit doucement en vol (le foil glisse) et vite dans l'eau
      const drag = target > s.speed ? 0.6 : foiling ? 0.22 : 1.2;
      s.speed += (target - s.speed) * Math.min(1, dt * drag);
      if (I.pressed('Space')) this.jump();
    }
    const foilH = s.speed > tk ? Math.min(0.75, (s.speed - tk) * 0.4) : 0;
    s.x += Math.sin(s.yaw) * s.speed * dt;
    s.z += Math.cos(s.yaw) * s.speed * dt;
    // rester en eau profonde, dans la zone de navigation
    if (groundHeight(s.x, s.z) > WATER_LEVEL - 0.9 || !inNavZone(s.x, s.z)) {
      s.x -= Math.sin(s.yaw) * s.speed * dt; s.z -= Math.cos(s.yaw) * s.speed * dt;
      s.speed *= 0.5; s.yaw += Math.PI * 0.6 * dt * 4;
      if (groundHeight(s.x, s.z) > WATER_LEVEL - 0.3) { this.stop('Retour à la plage !'); return; }
    }
    const y = WATER_LEVEL + 0.15 + foilH + Math.max(0, s.y);
    s.pumpAnim = Math.max(0, (s.pumpAnim || 0) - dt);
    const bob = s.pumpAnim > 0 ? Math.sin((0.35 - s.pumpAnim) / 0.35 * Math.PI) * -0.12 : 0;
    this.rig.position.set(s.x, y + bob + (foilH < 0.1 && s.y <= 0 ? Math.sin(g.now() / 400 + s.x) * 0.06 : 0), s.z);
    this.wake.update(dt);
    if (s.speed > 2 && s.y <= 0) this.wake.push(s.x - Math.sin(s.yaw) * 0.8, s.z - Math.cos(s.yaw) * 0.8, s.yaw, foilH > 0.1 ? 0.45 : Math.min(1, s.speed / 8));
    // vent visible
    const wd = w.dir + Math.PI, wx = Math.sin(wd), wz = Math.cos(wd), wsp = 4 + w.kts * 0.6;
    for (const st of this.streaks) {
      if (!st.m.visible || Math.hypot(st.x - s.x, st.z - s.z) > 30) { st.x = s.x + (Math.random() - 0.5) * 50 - wx * 20; st.z = s.z + (Math.random() - 0.5) * 50 - wz * 20; st.y = WATER_LEVEL + 0.8 + Math.random() * 4; st.m.visible = true; }
      st.x += wx * wsp * dt; st.z += wz * wsp * dt;
      st.m.position.set(st.x, st.y, st.z); st.m.rotation.y = wd;
    }
    // en l'air : la planche (et le rider) tournent et font des saltos
    this.rig.rotation.set(s.y > 0 ? -0.15 + (s.pitch || 0) : -0.04 * s.speed / 10, s.yaw, s.y > 0 ? 0 : -I.move.x * 0.25, 'YXZ');
    // l'aile s'oriente avec le vent
    this.wingMesh.rotation.y = Math.PI / 2 + clamp(wrap(w.dir - s.yaw) * 0.35, -0.7, 0.7);
    // le rider
    P.pos.set(s.x, y + 0.06, s.z); P.vel.set(Math.sin(s.yaw) * s.speed, 0, Math.cos(s.yaw) * s.speed); P.yaw = s.yaw; P.grounded = true; P.swimming = s.crashed > 0; P.speed = s.speed;
    const av = P.avatar.root;
    av.position.set(s.x, s.crashed > 0 ? WATER_LEVEL - 0.9 : y + 0.06 + bob * 0.5, s.z); av.rotation.set(s.y > 0 ? (s.pitch || 0) : 0, s.yaw, 0, 'YXZ');
    P.avatar.update(dt, { speed: 0, grounded: true, swimming: s.crashed > 0, pose: s.crashed > 0 ? 'idle' : s.pumpAnim > 0 ? 'sit' : s.stowed ? 'idle' : 'hold-forward' });   // pomper = flexion des jambes
    // gerbes d'eau
    if (s.speed > 6 && s.y <= 0 && Math.random() < dt * 10) g.fx.emit({ x: s.x - Math.sin(s.yaw) * 0.8, y: WATER_LEVEL + 0.1, z: s.z - Math.cos(s.yaw) * 0.8, n: 4, colors: ['#ffffff', '#bfe9ff'], speed: 2, gravity: 8, life: 0.5, size: 0.12 });
    s.hudT -= dt;
    if (s.hudT <= 0) {
      s.hudT = 0.25;
      const allure = s.stowed ? '🎒 aile rangée (pumpfoil)' : off < 0.7 ? '⛔ face au vent (zone morte)' : off < 1.2 ? 'près du vent' : off < 2.2 ? '✅ vent de travers (top !)' : 'vent arrière';
      g.hud.track('wing', { title: `🪁 Wingfoil · vent ${w.kts} nds`, text: `${Math.round(s.speed * 3.6)} km/h · ${foilH > 0.1 ? 'sur le foil ✈️' : `dans l'eau (décolle à ${Math.round(tk * 3.6)} km/h : pompe avec E !)`} · ${allure} · souffle ${Math.round(s.stamina * 100)} % · meilleur saut ${s.best.toFixed(1)} m`, button: { label: 'Rentrer à la plage', onclick: () => this.stop() } });
      if (w.kts < this.stats.minWind - 2 && !s.windWarn && !s.stowed) { s.windWarn = true; g.ui.toast('🌬️ Peu de vent pour cette aile : pompe avec E pour décoller, ou prends une aile plus grande.', 'bad', 4500); }
    }
  }

  async land() {
    const s = this.s, g = this.g;
    s.y = 0; s.vy = 0;
    const spins = Math.floor((s.spinAcc + 0.6) / (Math.PI * 2));
    const flips = Math.floor((s.flipAcc + 0.7) / (Math.PI * 2));
    const err = Math.abs(wrap(s.yaw - s.spinStart));
    const perr = Math.abs(wrap(s.pitch || 0));
    // atterrissage : il faut retomber dans l'axe et à plat. L'entraînement rend la réception plus facile.
    const skill = (g.profile.sports?.wing?.skill || 5) / 100;
    const tol = 0.75 + 0.25 * this.stats.stability + skill * 0.7;
    s.pitch = 0;
    if ((err > tol && s.spinAcc > 0.6) || (perr > tol * 0.9 && s.flipAcc > 0.6)) { s.crashed = 2; s.speed = 0; g.sfx('splat'); g.ui.toast(`💦 PLOUF ! Réception ratée${skill < 0.3 ? ' (entraîne-toi : la réception devient plus facile avec le niveau)' : ''}.`, 'bad', 1800); return; }
    if (s.spinAcc > 0.6) s.yaw = s.spinStart + spins * Math.PI * 2;
    s.speed *= 0.85;
    const height = s.maxY, air = s.air;
    if (height < 0.6) return;
    const r = await req(g, 'wing.jump', { height, air, spins, flips });
    if (!r || !this.s) return;
    s.jumps++; s.best = Math.max(s.best, r.height);
    g.sfx(r.record ? 'levelup' : 'success');
    const tricks = [r.spins ? `${r.spins} × 360` : '', r.flips ? `${r.flips} flip${r.flips > 1 ? 's' : ''}` : ''].filter(Boolean).join(' + ');
    g.ui.toast(`🪁 Saut de ${r.height.toFixed(1)} m${tricks ? ` · ${tricks}` : ''} : ${r.pts} pts${r.record ? ' · RECORD PERSO !' : ''}`, 'good', 2600);
  }

  stop(msg = '') {
    const s = this.s, g = this.g;
    if (!s) return;
    this.s = null;
    this.rig.visible = false;
    this.wake.clear();
    for (const st of this.streaks) st.m.visible = false;
    this.buttons?.remove();
    g.hud.track('wing', null);
    const P = g.player;
    P.external = false;
    // retour au bord : là où on s'était mis à l'eau, sinon devant le Surf Shop
    const shop = BUILDING_BY_ID['surf-shop'];
    if (s.back) P.teleport(s.back.x, s.back.z, Math.PI); else P.teleport(shop.door.x, shop.door.z + 3, Math.PI);
    g.net.request('wing.end', {}).catch(() => null);
    g.ui.toast(`🏖️ ${msg || 'Session terminée.'} ${s.jumps} saut(s), meilleur ${s.best.toFixed(1)} m.`, 'good', 3500);
  }
}
