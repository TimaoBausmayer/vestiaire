import * as THREE from 'three';
import { careerToast } from './races.js';
import { h, fmt } from '../ui/dom.js';
import { GOLF, HOLES, PAR, MAX_STROKES, holeCenter, defaultGolf, golfPrize } from '../../shared/golf.js';

// MINI-GOLF : 9 trous (verts, bordures en bois, blocs, bumpers, moulin qui tourne).
// A / D (ou gauche / droite) = viser ; maintenir ESPACE = charger la puissance, relâcher = taper.
// La balle roule (frottement), rebondit sur les bordures, les blocs et les bumpers ; elle tombe dans
// le trou si elle y passe assez lentement. 6 coups maximum par trou.
const R = 0.07, FRICTION = 1.15, Y = GOLF.greenY;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const req = async (g, t, p) => { try { return await g.net.request(t, p); } catch (e) { g.ui.toast(e.message, 'bad', 4000); g.sfx('error'); return null; } };

export function buildGolf(sb, col) {
  sb.box(GOLF.x, 0, GOLF.z, GOLF.w + 2, 0.04, GOLF.d + 2, '#b7e4c7');   // gazon autour
  HOLES.forEach((H, i) => {
    const c = holeCenter(i), [hw, hd] = H.green;
    sb.box(c.x, 0, c.z, hw * 2, Y, hd * 2, '#2a9d3a');                    // green surélevé
    for (const [x, z, w, d] of [[0, -hd - 0.12, hw * 2 + 0.5, 0.24], [0, hd + 0.12, hw * 2 + 0.5, 0.24], [-hw - 0.12, 0, 0.24, hd * 2], [hw + 0.12, 0, 0.24, hd * 2]]) sb.box(c.x + x, 0, c.z + z, w, Y + 0.18, d, '#8d5a2b');
    for (const [bx, bz, bw, bd] of H.blocks) sb.box(c.x + bx, Y, c.z + bz, bw * 2, 0.3, bd * 2, '#c9a46a');
    for (const [bx, bz, br] of H.bumpers) { sb.cyl(c.x + bx, Y, c.z + bz, br, 0.35, '#ef476f', 16); sb.cyl(c.x + bx, Y + 0.35, c.z + bz, br * 0.6, 0.05, '#ffd166', 12); }
    // trou (fond sombre + drapeau) et départ
    sb.cyl(c.x + H.cup[0], Y + 0.005, c.z + H.cup[1], 0.11, 0.01, '#111111', 14);
    sb.cyl(c.x + H.cup[0], Y, c.z + H.cup[1], 0.015, 1.2, '#f1f1f1', 6);
    sb.box(c.x + H.cup[0] + 0.2, Y + 0.95, c.z + H.cup[1], 0.4, 0.25, 0.02, '#e63946');
    sb.box(c.x + H.tee[0], Y + 0.002, c.z + H.tee[1], 0.5, 0.01, 0.5, '#95d5b2');
    // panneau du trou
    sb.box(c.x + hw + 0.9, 0, c.z + hd - 0.5, 0.1, 1.1, 0.1, '#5c3d24'); sb.box(c.x + hw + 0.9, 1.1, c.z + hd - 0.5, 0.05, 0.6, 1, '#ffd166');
    if (H.mill) {   // tour du moulin (les pales tournent : système)
      sb.box(c.x, Y, c.z + H.mill.cz - 0.9, 1, 2.2, 0.6, '#f1faee'); sb.cone(c.x, Y + 2.2, c.z + H.mill.cz - 0.9, 0.8, 0.8, '#e63946', 4);
    }
  });
}

export class Golf {
  constructor(g) {
    this.g = g;
    this.s = null;
    const S = g.engine.scene;
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 }));
    this.arrow = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 8).rotateX(Math.PI / 2).translate(0, 0, 0.6), new THREE.MeshBasicMaterial({ color: '#ffd166' }));
    this.ball.visible = this.arrow.visible = false;
    S.add(this.ball, this.arrow);
    // pales du moulin (trou 9)
    const mi = HOLES.findIndex((h) => h.mill), mc = holeCenter(mi), M = HOLES[mi].mill;
    this.mill = new THREE.Mesh(new THREE.BoxGeometry(M.len * 2, 0.5, 0.12), new THREE.MeshStandardMaterial({ color: '#8d5a2b' }));
    this.mill.position.set(mc.x, Y + 0.3, mc.z + M.cz);
    S.add(this.mill);
    this.millAngle = 0;
    g.input.on('key', (e) => { if (this.s && e.code === 'Escape') this.finish(true); });
  }

  rec() { return { ...defaultGolf(), ...(this.g.profile.sports?.golf || {}) }; }

  desk() {
    const g = this.g, Rr = this.rec();
    g.ui.dialog({ name: 'Gérant du mini-golf', role: 'Le Trou Rigolo', text: `9 trous, par ${PAR}. ${g.profile.admin ? 'Gratuit pour toi' : `${GOLF.fee} PC le parcours`}. Sous le par : prime ! Chaque trou en un coup : +50 PC. Ton record : ${Rr.best ? `${Rr.best} coups` : '—'} · ${Rr.aces} trou${Rr.aces > 1 ? 's' : ''} en un.`, choices: [
      { label: '⛳ Jouer le parcours', action: (m) => { m.close(); this.start(); } },
      { label: 'Plus tard', ghost: true, action: (m) => m.close() },
    ] });
  }

  async start() {
    const g = this.g;
    if (this.s) return;
    const r = await req(g, 'golf.start', {});
    if (!r) return;
    this.s = { hole: 0, strokes: [], n: 0, charge: 0, charging: false, aim: Math.PI, b: null, moving: false, sunk: 0 };
    this.saved = { dist: g.cam.dist, pitch: g.cam.pitch };
    this.ui = h('div.gf-hud', this.title = h('b', ''), this.info = h('div', ''), h('div.gf-bar', this.pow = h('i')), h('small', 'A / D : viser · maintenir ESPACE : puissance · relâcher : taper · Échap : arrêter'));
    this.btns = h('div.foot-btns',
      h('button', { onpointerdown: (e) => { e.preventDefault(); this.aimBtn = -1; }, onpointerup: () => { this.aimBtn = 0; }, onpointerleave: () => { this.aimBtn = 0; } }, '↺'),
      h('button', { onpointerdown: (e) => { e.preventDefault(); this.chargeBtn = true; }, onpointerup: () => { this.chargeBtn = false; }, onpointerleave: () => { this.chargeBtn = false; } }, '⛳ Taper'),
      h('button', { onpointerdown: (e) => { e.preventDefault(); this.aimBtn = 1; }, onpointerup: () => { this.aimBtn = 0; }, onpointerleave: () => { this.aimBtn = 0; } }, '↻'));
    g.ui.root.append(this.ui, this.btns);
    g.player.noJump = true; g.player.external = true;
    this.ball.visible = this.arrow.visible = true;
    this.setupHole();
  }

  setupHole() {
    const s = this.s, H = HOLES[s.hole], c = holeCenter(s.hole);
    s.c = c; s.H = H; s.n = 0;
    s.b = { x: c.x + H.tee[0], z: c.z + H.tee[1], vx: 0, vz: 0 };
    s.aim = Math.atan2(H.cup[0] - H.tee[0], H.cup[1] - H.tee[1]);
    s.moving = false; s.sunk = 0;
    this.g.cam.dist = 6; this.g.cam.pitch = 0.6;
    this.refresh();
  }

  refresh(msg) {
    const s = this.s;
    const total = s.strokes.reduce((a, n) => a + n, 0);
    this.title.textContent = `Trou ${s.hole + 1}/9 · ${s.H.name} · par ${s.H.par}`;
    this.info.textContent = msg || `Coups : ${s.n} · total ${total + s.n} (par ${PAR})`;
  }

  shoot(power) {
    const s = this.s;
    const v = 0.6 + power * 7.5;
    s.b.vx = Math.sin(s.aim) * v; s.b.vz = Math.cos(s.aim) * v;
    s.moving = true; s.n++;
    this.g.player.setPose('throw', 0.4);
    this.g.sfx('click');
    this.refresh();
  }

  // collisions : bordures du green, blocs, bumpers, pales du moulin
  collide(nx, nz) {
    const s = this.s, c = s.c, H = s.H, b = s.b, [hw, hd] = H.green;
    let x = nx, z = nz, hit = false;
    const lx = x - c.x, lz = z - c.z;
    if (lx < -hw + R) { x = c.x - hw + R; b.vx = Math.abs(b.vx) * 0.8; hit = true; }
    if (lx > hw - R) { x = c.x + hw - R; b.vx = -Math.abs(b.vx) * 0.8; hit = true; }
    if (lz < -hd + R) { z = c.z - hd + R; b.vz = Math.abs(b.vz) * 0.8; hit = true; }
    if (lz > hd - R) { z = c.z + hd - R; b.vz = -Math.abs(b.vz) * 0.8; hit = true; }
    const boxes = [...H.blocks];
    if (H.mill) { const a = this.millAngle, L = H.mill.len; for (let t = -L + 0.2; t <= L - 0.19; t += 0.4) boxes.push([Math.cos(a) * t, H.mill.cz - Math.sin(a) * t, 0.2, 0.2]); }   // pale découpée en petits blocs
    for (const [bx, bz, bw, bd] of boxes) {
      const qx = x - (c.x + bx), qz = z - (c.z + bz);
      if (Math.abs(qx) < bw + R && Math.abs(qz) < bd + R) {
        const px = bw + R - Math.abs(qx), pz = bd + R - Math.abs(qz);
        if (px < pz) { x += Math.sign(qx || 1) * px; b.vx = Math.sign(qx || 1) * Math.abs(b.vx) * 0.75; }
        else { z += Math.sign(qz || 1) * pz; b.vz = Math.sign(qz || 1) * Math.abs(b.vz) * 0.75; }
        hit = true;
      }
    }
    for (const [bx, bz, br] of H.bumpers) {
      const qx = x - (c.x + bx), qz = z - (c.z + bz), d = Math.hypot(qx, qz);
      if (d < br + R && d > 1e-4) {
        const nxx = qx / d, nzz = qz / d, vn = b.vx * nxx + b.vz * nzz;
        x = c.x + bx + nxx * (br + R); z = c.z + bz + nzz * (br + R);
        if (vn < 0) { b.vx -= 2.1 * vn * nxx; b.vz -= 2.1 * vn * nzz; }   // bumper : rebond un peu plus fort
        hit = true;
      }
    }
    if (hit) this.g.sfx('bump');
    return [x, z];
  }

  async nextHole(n) {
    const s = this.s;
    s.strokes.push(n);
    if (s.hole >= HOLES.length - 1) { this.finish(false); return; }
    s.hole++;
    this.setupHole();
  }

  async finish(abandon) {
    const s = this.s, g = this.g;
    if (!s) return;
    this.s = null;
    this.ui.remove(); this.btns.remove();
    this.ball.visible = this.arrow.visible = false;
    g.player.noJump = false; g.player.external = false;
    if (this.saved) { g.cam.dist = this.saved.dist; g.cam.pitch = this.saved.pitch; }
    g.player.teleport(GOLF.x + GOLF.w / 2 + 2, GOLF.z - GOLF.d / 2 - 2, 0);
    if (abandon) { await req(g, 'golf.end', { strokes: null }); g.ui.toast('⛳ Parcours abandonné.', '', 2500); return; }
    const r = await req(g, 'golf.end', { strokes: s.strokes });
    careerToast(g, r?.career);
    if (!r?.done) return;
    const diff = r.total - r.par;
    g.sfx(diff <= 0 ? 'levelup' : 'success');
    g.ui.dialog({ name: 'Carte de score', role: 'Le Trou Rigolo', text: `${s.strokes.map((n, i) => `T${i + 1}:${n}`).join(' · ')}\nTotal : ${r.total} (${diff === 0 ? 'par' : diff > 0 ? `+${diff}` : diff})${r.record ? ' · 🏅 nouveau record !' : ''}${r.aces ? ` · ${r.aces} trou${r.aces > 1 ? 's' : ''} en un !` : ''}${r.prize ? ` · prime ${fmt(r.prize)} PC` : ''}`, choices: [{ label: '⛳ Super !', ghost: true, action: (m) => m.close() }] });
  }

  update(dt) {
    this.millAngle += dt * (HOLES.find((x) => x.mill).mill.speed);
    this.mill.rotation.y = this.millAngle;
    const s = this.s, g = this.g;
    if (!s) return;
    const b = s.b, I = g.input, P = g.player;
    if (s.sunk > 0) {
      s.sunk -= dt;
      if (s.sunk <= 0) this.nextHole(s.n);
    } else if (s.moving) {
      // roule, frotte, rebondit
      const sp = Math.hypot(b.vx, b.vz), dec = Math.max(0, sp - FRICTION * dt) / (sp || 1);
      b.vx *= dec; b.vz *= dec;
      const steps = Math.ceil(sp * dt / 0.05) || 1;
      for (let k = 0; k < steps; k++) { const [x, z] = this.collide(b.x + b.vx * dt / steps, b.z + b.vz * dt / steps); b.x = x; b.z = z; }
      const cx = s.c.x + s.H.cup[0], cz = s.c.z + s.H.cup[1], dc = Math.hypot(b.x - cx, b.z - cz);
      if (dc < 0.12 && sp < 3.2) {
        s.moving = false; s.sunk = 1.4; b.x = cx; b.z = cz;
        const n = s.n, d = n - s.H.par;
        const word = n === 1 ? '🎯 TROU EN UN !' : d <= -2 ? '🦅 Eagle !' : d === -1 ? '🐦 Birdie !' : d === 0 ? '✅ Par' : d === 1 ? 'Bogey' : `+${d}`;
        g.sfx(n === 1 ? 'levelup' : d <= 0 ? 'success' : 'pop');
        this.refresh(`${word} (${n} coup${n > 1 ? 's' : ''})`);
      } else if (sp < 0.05) {
        s.moving = false; b.vx = b.vz = 0;
        if (s.n >= MAX_STROKES) { s.sunk = 1.2; s.n = MAX_STROKES; this.refresh(`${MAX_STROKES} coups : trou suivant !`); }
        else s.aim = Math.atan2(cx - b.x, cz - b.z);
      }
    } else {
      // visée et puissance
      const turn = (I.keys.has('KeyA') || I.keys.has('ArrowLeft') ? 1 : 0) - (I.keys.has('KeyD') || I.keys.has('ArrowRight') ? 1 : 0) + (-(this.aimBtn || 0));
      s.aim += turn * dt * 1.6;
      const held = I.keys.has('Space') || this.chargeBtn;
      if (held) { s.charging = true; s.charge = (s.charge + dt * 0.9) % 2; }
      else if (s.charging) { s.charging = false; const p = s.charge > 1 ? 2 - s.charge : s.charge; s.charge = 0; this.shoot(p); }
      const p = s.charge > 1 ? 2 - s.charge : s.charge;
      this.pow.style.width = `${p * 100}%`;
    }
    this.ball.position.set(b.x, Y + 0.09 - (s.sunk > 0 ? Math.min(0.2, (1.4 - s.sunk) * 0.3) : 0), b.z);
    this.arrow.visible = !s.moving && s.sunk <= 0;
    this.arrow.position.set(b.x, Y + 0.12, b.z); this.arrow.rotation.y = s.aim;
    // le joueur se tient derrière la balle, la caméra regarde dans l'axe du tir
    const bx = b.x - Math.sin(s.aim) * 0.5 + Math.cos(s.aim) * 0.35, bz = b.z - Math.cos(s.aim) * 0.5 - Math.sin(s.aim) * 0.35;
    if (!s.moving) { P.pos.set(bx, Y, bz); P.yaw = s.aim; }
    P.avatar.root.position.copy(P.pos); P.avatar.root.rotation.y = P.yaw;
    P.avatar.update(dt, { speed: 0, grounded: true, pose: P.poseTimer > 0 ? P.pose : 'hold-forward' });
    if (P.poseTimer > 0) P.poseTimer -= dt;
    g.cam.yaw += Math.atan2(Math.sin(s.aim + Math.PI - g.cam.yaw), Math.cos(s.aim + Math.PI - g.cam.yaw)) * Math.min(1, dt * 3);
  }
}
