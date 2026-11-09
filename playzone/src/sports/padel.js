import * as THREE from 'three';
import { h, fmt } from '../ui/dom.js';
import { Avatar } from '../characters/avatar.js';
import { DEFAULT_APPEARANCE } from '../../shared/appearance.js';
import { PADEL, PADEL_COURTS, PADEL_PAIRS, PADEL_BY_ID, PADEL_FEE, PADEL_GAMES, defaultPadel } from '../../shared/padel.js';
import { gameScore, gameWinner } from '../../shared/tennis.js';
import { careerToast } from './races.js';

// PADEL en double : toi (côté +z, moitié droite) et ton partenaire IA (moitié gauche) contre une paire PNJ.
// Commandes comme au tennis : déplace-toi, ESPACE pour frapper (A / D pour viser). La balle peut
// rebondir sur les vitres après avoir touché le sol : attends-la et renvoie-la !
const G = 11;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const req = async (g, t, p) => { try { return await g.net.request(t, p); } catch (e) { g.ui.toast(e.message, 'bad', 4000); g.sfx('error'); return null; } };
const HW = PADEL.W / 2, HL = PADEL.L / 2;

function racket(color) {
  const g = new THREE.Group();
  const m = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.2, 8), m('#14141c')); handle.position.y = -0.08; g.add(handle);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.035, 16), m(color)); head.rotation.x = Math.PI / 2; head.position.y = 0.14; g.add(head);
  g.rotation.x = Math.PI / 2;
  return g;
}

export class Padel {
  constructor(g) {
    this.g = g;
    this.m = null;
    this.build();
    g.input.on('key', (e) => { if (this.m && e.code === 'Space') this.swing(); });
  }

  build() {
    const g = this.g, root = new THREE.Group(), mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, ...o });
    const glass = mat('#bfe9ff', { transparent: true, opacity: 0.22, roughness: 0.1, depthWrite: false });
    const fence = mat('#2b2d42', { transparent: true, opacity: 0.45 });
    for (const k of PADEL_COURTS) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(PADEL.W, PADEL.L).rotateX(-Math.PI / 2), mat('#1d6fb8')); f.position.set(k.x, 0.04, k.z); f.receiveShadow = true; root.add(f);
      const line = (x, z, w, d) => { const l = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), mat('#ffffff')); l.position.set(x, 0.05, z); root.add(l); };
      for (const s of [-1, 1]) { line(k.x, k.z + s * PADEL.serviceZ, PADEL.W, 0.06); line(k.x, k.z + s * PADEL.serviceZ / 2, 0.06, PADEL.serviceZ); }
      const net = new THREE.Mesh(new THREE.BoxGeometry(PADEL.W, PADEL.netH, 0.03), mat('#14141c', { transparent: true, opacity: 0.8 })); net.position.set(k.x, PADEL.netH / 2, k.z); root.add(net);
      const band = new THREE.Mesh(new THREE.BoxGeometry(PADEL.W, 0.06, 0.05), mat('#ffffff')); band.position.set(k.x, PADEL.netH, k.z); root.add(band);
      // vitres (fonds et début des côtés) et grillage au-dessus
      for (const s of [-1, 1]) {
        const back = new THREE.Mesh(new THREE.BoxGeometry(PADEL.W, PADEL.glass, 0.06), glass); back.position.set(k.x, PADEL.glass / 2, k.z + s * HL); root.add(back);
        const backF = new THREE.Mesh(new THREE.BoxGeometry(PADEL.W, PADEL.fence - PADEL.glass, 0.04), fence); backF.position.set(k.x, PADEL.glass + (PADEL.fence - PADEL.glass) / 2, k.z + s * HL); root.add(backF);
        for (const e of [-1, 1]) {
          const side = new THREE.Mesh(new THREE.BoxGeometry(0.06, PADEL.glass, PADEL.L), glass); side.position.set(k.x + e * HW, PADEL.glass / 2, k.z); root.add(side);
        }
        g.collision.addBox(k.x - HW, 0, k.z + s * HL - 0.1, k.x + HW, PADEL.fence, k.z + s * HL + 0.1, { noCamera: true });
        g.collision.addBox(k.x + s * HW - 0.1, 0, k.z - HL, k.x + s * HW + 0.1, PADEL.glass, k.z + HL - 2, { noCamera: true });   // une porte de chaque côté
      }
      for (const [x, z] of [[-HW, -HL], [HW, -HL], [-HW, HL], [HW, HL]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, PADEL.fence, 0.12), mat('#14141c')); p.position.set(k.x + x, PADEL.fence / 2, k.z + z); root.add(p); }
    }
    g.engine.scene.add(root);
  }

  rec() { return { ...defaultPadel(), ...(this.g.profile.sports?.padel || {}) }; }

  desk() {
    const g = this.g, R = this.rec();
    const m = g.ui.modal({
      title: '🏓 Padel Club des Plaines', width: 'min(600px, 96vw)',
      sub: `Location du court : ${PADEL_FEE} PC. Double : toi + un partenaire contre une paire. Match en ${PADEL_GAMES} jeux. ${R.wins} victoire(s) / ${R.matches} match(s).`,
      build: (body) => {
        body.append(h('p.muted', 'Déplace-toi vers la balle, ESPACE pour frapper (A / D pour viser). Tu joues la moitié droite, ton partenaire la gauche. La balle peut rebondir sur les vitres après le sol : laisse-la revenir et frappe ! Un coup qui touche une vitre AVANT le sol adverse est faute.'));
        PADEL_PAIRS.forEach((o, i) => {
          const locked = i > R.beaten + 1 && !g.profile.admin, done = i <= R.beaten;
          body.append(h('div.list-item', h('span', { style: { fontSize: '22px' } }, done ? '✅' : locked ? '🔒' : '🏓'),
            h('div.grow', h('div.t', `${i + 1}. ${o.name}`), h('div.d', `Vitesse ${o.speed} · précision ${Math.round((1 - o.error) * 100)} % · prime ${fmt(o.prize)} PC`)),
            h('button.btn.small', { disabled: locked, onclick: () => { m.close(); this.start(o.id); } }, locked ? 'Verrouillé' : 'Jouer')));
        });
      },
    });
  }

  async start(oppId) {
    const g = this.g, O = PADEL_BY_ID[oppId];
    if (this.m) return;
    const r = await req(g, 'padel.start', { opp: oppId });
    if (!r) return;
    const k = PADEL_COURTS[0], S = g.engine.scene;
    const mk = (top, color) => { const av = new Avatar({ ...DEFAULT_APPEARANCE, top: 'tshirt', topColor: top, bottom: 'short', bottomColor: '#ffffff' }, {}); av.hold(racket(color)); S.add(av.root); return av; };
    const ai = (team, side, av, name) => ({ team, side, av, name, x: k.x + side * 2.5, z: k.z + (team === 0 ? 1 : -1) * (HL - 2), swing: 0, lab: g.labels.add(av.root, h('div.wlabel', name), 2.3, 40) });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), new THREE.MeshStandardMaterial({ color: '#e9ff70', emissive: '#7a8f00', emissiveIntensity: 0.4 }));
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.11, 12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.3 }));
    S.add(ball, shadow);
    g.avatar.hold(racket('#3a86ff'));
    const m = this.m = { k, O, ball, shadow, b: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }, games: [0, 0], pts: [0, 0], server: 0, state: 'serve', wait: 1, hitter: -1, bounces: 0, walled: false, rally: 0, swingT: 0,
      bots: [ai(0, -1, mk('#3a86ff', '#3a86ff'), 'Partenaire Pablo'), ai(1, -1, mk(O.color, O.color), O.name + ' ①'), ai(1, 1, mk(O.color, O.color), O.name + ' ②')] };
    g.player.teleport(k.x + 2.5, k.z + HL - 1.5, Math.PI);
    g.player.noJump = true;
    this.saved = { dist: g.cam.dist, pitch: g.cam.pitch };
    g.cam.dist = 9.5; g.cam.pitch = 0.5; g.cam.yaw = 0;
    m.hud = h('div.tn-hud', m.score = h('b', ''), m.info = h('small', ''));
    m.btns = h('div.foot-btns', h('button', { onpointerdown: (e) => { e.preventDefault(); this.swing(); } }, '🏓 Frapper (Espace)'), h('button', { onpointerdown: (e) => { e.preventDefault(); this.end(false, true); } }, '🏳️ Abandon'));
    g.ui.root.append(m.hud, m.btns);
    this.newPoint();
    g.sfx('whistle');
  }

  side(z) { return z > this.m.k.z ? 0 : 1; }

  shoot(from, tx, tz, T, power = 1) {
    const m = this.m, b = m.b;
    for (let tt = Math.max(0.45, T / power); tt <= 2.2; tt += 0.05) {
      const vx = (tx - from.x) / tt, vz = (tz - from.z) / tt, vy = (0.1 - from.y + 0.5 * G * tt * tt) / tt;
      const tn = (m.k.z - from.z) / vz, yn = from.y + vy * tn - 0.5 * G * tn * tn;
      if (tn < 0 || yn > PADEL.netH + 0.25 || tt >= 2.15) { Object.assign(b, { x: from.x, y: from.y, z: from.z, vx, vy, vz }); break; }
    }
    m.bounces = 0; m.walled = false;
  }

  newPoint() {
    const m = this.m, k = m.k;
    m.state = 'serve'; m.wait = 1.1; m.hitter = -1; m.bounces = 0; m.walled = false; m.rally = 0;
    if (m.server === 0) this.g.player.teleport(k.x + 2.5, k.z + HL - 1.5, Math.PI);
    for (const a of m.bots) { a.x = k.x + a.side * 2.5; a.z = k.z + (a.team === 0 ? 1 : -1) * (HL - 2); }
    this.refresh(m.server === 0 ? 'À toi de servir : ESPACE' : 'Service adverse...');
  }

  refresh(info) {
    const m = this.m;
    m.score.textContent = `Toi & Pablo ${m.games[0]} – ${m.games[1]} ${m.O.name} · ${gameScore(m.pts[0], m.pts[1])}`;
    if (info !== undefined) m.info.textContent = info;
  }

  swing() {
    const m = this.m, g = this.g;
    if (!m || m.swingT > 0) return;
    m.swingT = 0.35;
    g.player.setPose('throw', 0.3);
    const P = g.player.pos, b = m.b, k = m.k;
    if (m.state === 'serve' && m.server === 0) {
      this.shoot({ x: P.x, y: 1, z: P.z - 0.3 }, k.x - 2 - Math.random() * 2, k.z - 2.5 - Math.random() * 3.5, 1, 1);
      m.state = 'play'; m.hitter = 0; m.rally = 1; g.sfx('pop'); this.refresh('');
      return;
    }
    if (m.state !== 'play' || m.hitter === 0 || this.side(b.z) !== 0) return;
    this.hit(0, P.x, P.z, true);
  }

  // frappe de l'équipe `team` depuis (x, z)
  hit(team, x, z, isMe = false) {
    const m = this.m, g = this.g, b = m.b, k = m.k;
    const d = Math.hypot(b.x - x, b.z - z);
    if (isMe && (d > 1.9 || b.y > 2.6)) return false;
    const q = isMe ? clamp(1 - Math.abs(d - 0.9) / 1.1, 0, 1) : 0.6;
    const dir = team === 0 ? -1 : 1;
    let tx, tz;
    if (isMe) {
      const aim = clamp(g.input.move.x, -1, 1), err = (1 - q) * 2.4;
      tx = k.x + aim * (HW - 0.8) + (Math.random() - 0.5) * err;
      tz = k.z + dir * (HL - 1.5 - (1 - q) * 5) + (Math.random() - 0.5) * err;
    } else {
      const O = m.O, miss = team === 1 && Math.random() < O.error + (m.rally > 10 ? 0.05 : 0);
      tx = k.x + (Math.random() - 0.5) * (PADEL.W - 1.6);
      tz = k.z + dir * (3 + Math.random() * (HL - 4.5));
      if (miss) { if (Math.random() < 0.5) tx = k.x + (Math.random() < 0.5 ? -1 : 1) * (HW + 1.5); else tz = k.z + dir * (HL + 1.5); }
    }
    const power = isMe ? 1 + q * 0.2 + (g.profile.body?.muscle || 20) / 400 : team === 1 ? m.O.power : 0.95;
    this.shoot({ x: b.x, y: Math.max(0.5, b.y), z: b.z }, tx, tz, 1.2 - q * 0.25, power);
    m.hitter = team; m.rally++;
    g.sfx(q > 0.75 ? 'success' : 'pop');
    if (isMe && q > 0.8) this.refresh('💥 Coup parfait !');
    return true;
  }

  point(winner, why) {
    const m = this.m, g = this.g;
    if (m.state === 'over' || m.state === 'between') return;
    m.pts[winner]++;
    g.sfx(winner === 0 ? 'success' : 'fail');
    const gw = gameWinner(m.pts[0], m.pts[1]);
    if (gw >= 0) {
      m.games[gw]++; m.pts = [0, 0]; m.server = 1 - m.server;
      if (m.games[gw] >= PADEL_GAMES) { m.state = 'over'; m.wait = 2.2; m.result = gw === 0; this.refresh(gw === 0 ? '🏆 Match gagné !' : '😓 Match perdu...'); g.sfx(gw === 0 ? 'levelup' : 'fail'); return; }
      this.refresh(`${gw === 0 ? '🎉 Jeu pour vous' : 'Jeu adverse'} (${why})`);
    } else this.refresh(`${winner === 0 ? '✅ Point pour vous' : '❌ Point adverse'} : ${why}`);
    m.state = 'between'; m.wait = 1.4;
  }

  async end(won, abandon = false) {
    const m = this.m, g = this.g;
    if (!m) return;
    this.m = null;
    for (const a of m.bots) { a.av.root.removeFromParent(); g.labels.remove?.(a.lab); }
    m.ball.removeFromParent(); m.shadow.removeFromParent(); m.hud.remove(); m.btns.remove();
    g.avatar.hold(null); g.player.noJump = false;
    if (this.saved) { g.cam.dist = this.saved.dist; g.cam.pitch = this.saved.pitch; }
    const r = await req(g, 'padel.end', { won: !!won && !abandon });
    careerToast(g, r?.career);
    if (!r) return;
    g.ui.dialog({ name: 'Arbitre', role: 'Padel Club des Plaines', text: r.won ? `Victoire ${m.games[0]}–${m.games[1]} contre ${m.O.name} ! Prime : ${fmt(r.prize)} PC, +${r.xp} XP.${r.first ? ' Paire suivante débloquée !' : ''}` : abandon ? 'Abandon.' : `Défaite ${m.games[0]}–${m.games[1]}. Astuce : laisse la balle rebondir sur la vitre du fond, elle revient vers toi !`, choices: [{ label: 'OK', ghost: true, action: (x) => x.close() }] });
  }

  update(dt) {
    const m = this.m, g = this.g;
    if (!m) return;
    const k = m.k, b = m.b, P = g.player.pos, O = m.O;
    m.swingT = Math.max(0, m.swingT - dt);
    P.x = clamp(P.x, k.x - HW + 0.4, k.x + HW - 0.4);
    P.z = clamp(P.z, k.z + 0.6, k.z + HL - 0.4);
    if (Math.hypot(P.x - k.x, P.z - k.z) > 30) { this.end(false, true); return; }
    // les 3 IA : celui qui est responsable de la balle va la chercher, les autres se replacent
    const tFall = (b.vy + Math.sqrt(Math.max(0, b.vy * b.vy + 2 * G * Math.max(0, b.y)))) / G;
    for (const a of m.bots) {
      a.swing = Math.max(0, a.swing - dt);
      const mine = this.side(b.z) === a.team || (m.hitter !== a.team && m.state === 'play' && Math.sign(b.vz) === (a.team === 0 ? 1 : -1));
      const mates = a.team === 0 ? [{ x: P.x, z: P.z }, a] : m.bots.filter((o) => o.team === 1);
      let tx = k.x + a.side * 2.5, tz = k.z + (a.team === 0 ? 1 : -1) * (HL - 2.5);
      if (a.team === 0) tx = P.x > k.x ? k.x - 2.5 : k.x + 2.5;   // le partenaire couvre l'autre moitié
      if (m.state === 'play' && mine && m.hitter !== a.team) {
        const px = clamp(b.x + b.vx * (tFall + 0.3), k.x - HW + 0.5, k.x + HW - 0.5);
        const pz = clamp(b.z + b.vz * (tFall + 0.3), a.team === 0 ? k.z + 1 : k.z - HL + 0.5, a.team === 0 ? k.z + HL - 0.5 : k.z - 1);
        const closest = mates.reduce((best, o) => (Math.hypot(o.x - px, o.z - pz) < Math.hypot(best.x - px, best.z - pz) ? o : best));
        if (closest === a) { tx = px; tz = pz; }
      }
      if (m.state === 'serve' && m.server === 1 && a.team === 1 && a.side === 1) { tx = k.x + 2.5; tz = k.z - HL + 1.5; }
      const sp = a.team === 1 ? O.speed : 4.6, ax = tx - a.x, az = tz - a.z, ad = Math.hypot(ax, az), step = Math.min(ad, sp * dt);
      if (ad > 0.05) { a.x += ax / ad * step; a.z += az / ad * step; }
      a.av.root.position.set(a.x, 0, a.z);
      a.av.root.rotation.y = a.team === 0 ? Math.PI : 0;
      a.av.update(dt, { speed: ad > 0.2 ? Math.min(sp, ad * 3) : 0, grounded: true, pose: a.swing > 0 ? 'throw' : 'idle' });
      // frappe IA
      if (m.state === 'play' && m.hitter !== a.team && this.side(b.z) === a.team && (m.bounces === 1 || Math.abs(a.z - k.z) < 4) && b.y < 2.4 && Math.hypot(b.x - a.x, b.z - a.z) < (a.team === 1 ? O.reach : 1.7)) {
        if (a.team === 0 && Math.hypot(b.x - P.x, b.z - P.z) < 1.6) continue;   // c'est à toi
        a.swing = 0.3; this.hit(a.team, a.x, a.z);
      }
    }
    if (m.state === 'serve') {
      const sv = m.bots.find((a) => a.team === 1 && a.side === 1);
      const hand = m.server === 0 ? { x: P.x + 0.3, y: 1, z: P.z - 0.3 } : { x: sv.x - 0.3, y: 1, z: sv.z + 0.3 };
      Object.assign(b, { ...hand, vx: 0, vy: 0, vz: 0 });
      if (m.server === 1) { m.wait -= dt; if (m.wait <= 0) { sv.swing = 0.3; this.shoot({ x: sv.x, y: 1, z: sv.z + 0.3 }, k.x + 1.5 + Math.random() * 2.5, k.z + 2.5 + Math.random() * 3.5, 1, O.power * 0.9); m.state = 'play'; m.hitter = 1; m.rally = 1; this.refresh(''); g.sfx('pop'); } }
    } else if (m.state === 'play') {
      const pz = b.z;
      b.vy -= G * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      const recv = 1 - m.hitter;   // équipe qui doit renvoyer
      // filet
      if ((pz - k.z) * (b.z - k.z) < 0 && b.y < PADEL.netH) { b.vz *= -0.15; b.vx *= 0.3; this.point(recv, 'balle dans le filet'); }
      // vitres et grillage : avant le rebond au sol adverse = faute ; après = la balle rebondit et reste en jeu
      const hitWall = (axis) => {
        if (b.y > PADEL.fence) { this.point(m.bounces ? m.hitter : recv, m.bounces ? 'balle sortie du court, imprenable' : 'balle hors du court'); return; }
        if (m.bounces === 0 && this.side(b.z) === recv) { this.point(recv, 'balle dans la vitre avant le sol'); return; }
        if (axis === 'x') { b.vx = -b.vx * 0.72; b.x = clamp(b.x, k.x - HW + 0.05, k.x + HW - 0.05); } else { b.vz = -b.vz * 0.72; b.z = clamp(b.z, k.z - HL + 0.05, k.z + HL - 0.05); }
        m.walled = true; g.sfx('click');
      };
      if (Math.abs(b.x - k.x) > HW) hitWall('x');
      if (m.state === 'play' && Math.abs(b.z - k.z) > HL) hitWall('z');
      // rebond au sol
      if (m.state === 'play' && b.y <= 0.09 && b.vy < 0) {
        b.y = 0.09; b.vy = -b.vy * 0.7; b.vx *= 0.88; b.vz *= 0.88;
        g.sfx('click');
        const sd = this.side(b.z);
        if (m.bounces === 0) { if (sd === m.hitter) this.point(recv, 'balle dans le filet'); m.bounces = 1; }
        else this.point(m.hitter, m.hitter === 0 ? 'deux rebonds chez l\'adversaire' : 'deux rebonds, trop tard');
      }
    } else if (m.state === 'between') {
      b.vy -= G * dt; b.x += b.vx * dt; b.y = Math.max(0.09, b.y + b.vy * dt); b.z += b.vz * dt; b.vx *= 0.97; b.vz *= 0.97;
      m.wait -= dt; if (m.wait <= 0) this.newPoint();
    } else if (m.state === 'over') { m.wait -= dt; if (m.wait <= 0) { this.end(m.result); return; } }
    m.ball.position.set(b.x, b.y, b.z);
    m.shadow.position.set(b.x, 0.06, b.z);
  }
}
