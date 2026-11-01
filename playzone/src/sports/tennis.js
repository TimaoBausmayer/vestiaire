import * as THREE from 'three';
import { h, fmt } from '../ui/dom.js';
import { Avatar } from '../characters/avatar.js';
import { DEFAULT_APPEARANCE } from '../../shared/appearance.js';
import { COURT, TENNIS_CLUBS, TENNIS_OPPONENTS, T_OPP_BY_ID, GAMES_TO_WIN, TENNIS_FEE, gameScore, gameWinner, defaultTennis } from '../../shared/tennis.js';

// TENNIS : courts (surface, lignes, filet, grillages), match en simple contre un PNJ.
// Déplacements habituels ; ESPACE = frapper quand la balle arrive (le bon moment = coup plus précis
// et plus profond) ; A / D (ou gauche / droite) au moment de frapper = viser à gauche / à droite.
const G = 11;                  // gravité « arcade »
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const req = async (g, t, p) => { try { return await g.net.request(t, p); } catch (e) { g.ui.toast(e.message, 'bad', 4000); g.sfx('error'); return null; } };

// ------------------------------------------------------------------ décor statique
export function buildTennis(sb, col) {
  for (const C of TENNIS_CLUBS) {
    for (const k of C.courts) {
      const W = COURT.W / 2, L = COURT.L / 2, aw = COURT.W + COURT.runX * 2, al = COURT.L + COURT.runZ * 2;
      sb.box(k.x, 0, k.z, aw, 0.05, al, C.surface === '#4f9e3a' ? '#3f8a30' : C.surface === '#c8643b' ? '#b5562f' : '#2f5a96');
      sb.box(k.x, 0.01, k.z, COURT.W + 2.74, 0.05, COURT.L, C.surface);
      const line = (x, z, w, d) => sb.box(x, 0.02, z, w, 0.05, d, '#ffffff');
      line(k.x - W, k.z, 0.08, COURT.L); line(k.x + W, k.z, 0.08, COURT.L);                       // lignes de côté (simple)
      line(k.x - W - 1.37, k.z, 0.08, COURT.L); line(k.x + W + 1.37, k.z, 0.08, COURT.L);         // couloirs (double)
      line(k.x, k.z - L, COURT.W + 2.74, 0.08); line(k.x, k.z + L, COURT.W + 2.74, 0.08);         // fonds de court
      for (const s of [-1, 1]) line(k.x, k.z + s * 6.4, COURT.W, 0.08);                           // lignes de service
      line(k.x, k.z, 0.08, 12.8);                                                                // ligne médiane
      // filet : poteaux, toile, bande blanche
      for (const s of [-1, 1]) sb.cyl(k.x + s * (W + 1.37 + 0.5), 0, k.z, 0.05, 1.07, '#495057', 8);
      sb.box(k.x, 0.1, k.z, COURT.W + 3.74, 0.85, 0.03, '#1b1b24');
      sb.box(k.x, 0.92, k.z, COURT.W + 3.74, 0.07, 0.05, '#ffffff');
      // grillage autour du court
      for (const s of [-1, 1]) {
        sb.box(k.x, 0, k.z + s * al / 2, aw, 3, 0.05, '#2d6a4f'); col.addBox(k.x - aw / 2, 0, k.z + s * al / 2 - 0.1, k.x + aw / 2, 3, k.z + s * al / 2 + 0.1, { noCamera: true });
        sb.box(k.x + s * aw / 2, 0, k.z - al / 4 - 1.5, 0.05, 3, al / 2 - 3, '#2d6a4f'); col.addBox(k.x + s * aw / 2 - 0.1, 0, k.z - al / 2, k.x + s * aw / 2 + 0.1, 3, k.z - 3, { noCamera: true });
        sb.box(k.x + s * aw / 2, 0, k.z + al / 4 + 1.5, 0.05, 3, al / 2 - 3, '#2d6a4f'); col.addBox(k.x + s * aw / 2 - 0.1, 0, k.z + 3, k.x + s * aw / 2 + 0.1, 3, k.z + al / 2, { noCamera: true });
      }
      // chaise d'arbitre
      sb.box(k.x + W + 2.6, 0, k.z, 0.6, 1.8, 0.6, '#ffffff'); sb.box(k.x + W + 2.6, 1.8, k.z, 0.7, 0.08, 0.7, '#2a9d8f');
    }
  }
}

function racket(color = '#e63946') {
  const g = new THREE.Group();
  const m = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.3, 8), m('#14141c')); handle.position.y = -0.1; g.add(handle);
  const head = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.018, 6, 20), m(color)); head.position.y = 0.17; g.add(head);
  const strings = new THREE.Mesh(new THREE.CircleGeometry(0.13, 16), new THREE.MeshBasicMaterial({ color: '#f1faee', transparent: true, opacity: 0.45, side: THREE.DoubleSide })); strings.position.y = 0.17; g.add(strings);
  g.rotation.x = Math.PI / 2;
  return g;
}

export class Tennis {
  constructor(g) {
    this.g = g;
    this.m = null;   // match en cours
    g.input.on('key', (e) => { if (this.m && e.code === 'Space') this.swing(); });
  }

  rec() { return { ...defaultTennis(), ...(this.g.profile.sports?.tennis || {}) }; }

  // ------------------------------------------------------------------ accueil du club
  desk(b) {
    const g = this.g, R = this.rec();
    const club = TENNIS_CLUBS.find((c) => c.id === b?.id) || TENNIS_CLUBS[0];
    const m = g.ui.modal({
      title: `🎾 ${club.name}`, width: 'min(600px, 96vw)',
      sub: `Location du court : ${TENNIS_FEE} PC le match. Match en ${GAMES_TO_WIN} jeux gagnants. Palmarès : ${R.wins} victoire${R.wins > 1 ? 's' : ''} / ${R.matches} match${R.matches > 1 ? 's' : ''} · ${R.aces} aces.`,
      build: (body) => {
        body.append(h('p.muted', 'Commandes : déplace-toi pour aller vers la balle, ESPACE pour frapper (au bon moment = coup parfait), A / D en frappant pour viser à gauche / à droite. Au service : ESPACE. Ton endurance et tes muscles rendent tes coups plus forts.'));
        TENNIS_OPPONENTS.forEach((o, i) => {
          const locked = i > R.beaten + 1 && !g.profile.admin, done = i <= R.beaten;
          body.append(h('div.list-item', h('span', { style: { fontSize: '22px' } }, done ? '✅' : locked ? '🔒' : '🎾'),
            h('div.grow', h('div.t', `${i + 1}. ${o.name}`), h('div.d', `Vitesse ${o.speed} · précision ${Math.round((1 - o.error) * 100)} % · prime ${fmt(o.prize)} PC${done ? ' (revanche : 40 %)' : ''}`)),
            h('button.btn.small', { disabled: locked, onclick: () => { m.close(); this.start(club, o.id); } }, locked ? 'Verrouillé' : 'Jouer')));
        });
      },
    });
  }

  // ------------------------------------------------------------------ match
  async start(club, oppId) {
    const g = this.g, O = T_OPP_BY_ID[oppId];
    if (this.m) return;
    const r = await req(g, 'tennis.start', { opp: oppId });
    if (!r) return;
    const k = club.courts[0];
    const S = g.engine.scene;
    const av = new Avatar({ ...DEFAULT_APPEARANCE, skin: pick(['#f1c27d', '#8d5524', '#e0ac69', '#ffdbac']), hair: pick(['court', 'long', 'herisse', 'chignon']), top: 'tshirt', topColor: O.color, bottom: 'short', bottomColor: '#ffffff' }, {});
    av.hold(racket(O.color)); S.add(av.root);
    const label = g.labels.add(av.root, h('div.wlabel', O.name), 2.3, 40);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), new THREE.MeshStandardMaterial({ color: '#e9ff70', emissive: '#7a8f00', emissiveIntensity: 0.4 }));
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.12, 12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.3 }));
    S.add(ball, shadow);
    g.avatar.hold(racket('#3a86ff'));
    const P = g.player;
    const m = this.m = { club, k, O, av, label, ball, shadow, b: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }, ai: { x: k.x, z: k.z - COURT.L / 2 - 1 }, games: [0, 0], pts: [0, 0], server: 0, state: 'serve', wait: 1, hitter: -1, bounces: 0, aces: 0, rally: 0, swingT: 0, aiSwing: 0, t0: performance.now() };
    P.teleport(k.x + 0.6, k.z + COURT.L / 2 + 1, Math.PI);
    P.noJump = true;
    this.saved = { dist: g.cam.dist, pitch: g.cam.pitch };
    g.cam.dist = 8.5; g.cam.pitch = 0.42; g.cam.yaw = 0;
    m.hud = h('div.tn-hud', m.score = h('b', ''), m.info = h('small', ''));
    m.btns = h('div.foot-btns', h('button', { onpointerdown: (e) => { e.preventDefault(); this.swing(); } }, '🎾 Frapper (Espace)'), h('button', { onpointerdown: (e) => { e.preventDefault(); this.end(false, true); } }, '🏳️ Abandon'));
    g.ui.root.append(m.hud, m.btns);
    this.newPoint();
    g.sfx('whistle');
  }

  side(z) { return z > this.m.k.z ? 0 : 1; }   // 0 = côté du joueur (+z), 1 = côté adversaire

  // trajectoire qui retombe en (tx, tz) en passant au-dessus du filet
  // power > 1 : balle plus rapide (vol plus court), toujours vers la même cible
  shoot(from, tx, tz, T, power = 1) {
    const m = this.m, b = m.b;
    for (let tt = Math.max(0.45, T / power); tt <= 2.2; tt += 0.05) {
      const vx = (tx - from.x) / tt, vz = (tz - from.z) / tt, vy = (0.1 - from.y + 0.5 * G * tt * tt) / tt;
      const tn = (m.k.z - from.z) / vz, yn = from.y + vy * tn - 0.5 * G * tn * tn;
      if (tn < 0 || yn > COURT.netH + 0.25 || tt >= 2.15) { Object.assign(b, { x: from.x, y: from.y, z: from.z, vx, vy, vz }); break; }
    }
    m.bounces = 0; m.netChecked = false;
  }

  newPoint() {
    const m = this.m, g = this.g, k = m.k;
    m.state = 'serve'; m.wait = 1.1; m.hitter = -1; m.bounces = 0; m.rally = 0;
    const srv = m.server;
    if (srv === 0) { g.player.teleport(k.x + 0.8, k.z + COURT.L / 2 + 0.6, Math.PI); g.cam.yaw = 0; }
    m.ai.x = k.x - 0.8; m.ai.z = k.z - COURT.L / 2 - 0.6;
    this.refresh(srv === 0 ? 'À toi de servir : ESPACE' : `${m.O.name} sert...`);
  }

  refresh(info) {
    const m = this.m;
    m.score.textContent = `Toi ${m.games[0]} – ${m.games[1]} ${m.O.name.split(' ')[0]} · ${gameScore(m.pts[0], m.pts[1])}`;
    if (info !== undefined) m.info.textContent = info;
  }

  swing() {
    const m = this.m, g = this.g;
    if (!m || m.swingT > 0) return;
    m.swingT = 0.35;
    g.player.setPose('throw', 0.3);
    const P = g.player.pos, b = m.b, k = m.k;
    if (m.state === 'serve' && m.server === 0) {
      // service : vers le carré de service adverse en diagonale
      const tx = k.x + (P.x > k.x ? -1 : 1) * (1 + Math.random() * 2.4), tz = k.z - 3.5 - Math.random() * 2.4;
      this.shoot({ x: P.x, y: 2.4, z: P.z - 0.4 }, tx, tz, 0.75, 1.05 + (g.profile.body?.muscle || 20) / 300);
      m.state = 'play'; m.hitter = 0; m.rally = 1; g.sfx('pop');
      this.refresh('');
      return;
    }
    if (m.state !== 'play' || m.hitter === 0 || this.side(b.z) !== 0) return;
    const d = Math.hypot(b.x - P.x, b.z - P.z);
    if (d > 1.9 || b.y > 2.6) return;   // trop loin : coup dans le vide
    // qualité du coup : meilleure quand la balle est à bonne distance (~0,9 m)
    const q = clamp(1 - Math.abs(d - 0.9) / 1.1, 0, 1);
    const aim = clamp(g.input.move.x, -1, 1);
    const err = (1 - q) * 2.6;
    const tx = k.x + aim * (COURT.W / 2 - 0.6) + (Math.random() - 0.5) * err;
    const tz = k.z - COURT.L / 2 + 1.2 + (1 - q) * 6 + (Math.random() - 0.5) * err;
    const power = 1 + q * 0.25 + (g.profile.body?.muscle || 20) / 400;
    this.shoot({ x: b.x, y: Math.max(0.5, b.y), z: b.z }, tx, tz, 1.15 - q * 0.25, power);
    m.hitter = 0; m.rally++;
    g.sfx(q > 0.75 ? 'success' : 'pop');
    if (q > 0.8) this.refresh('💥 Coup parfait !');
  }

  aiHit() {
    const m = this.m, O = m.O, b = m.b, k = m.k;
    m.aiSwing = 0.3;
    const speed = Math.hypot(b.vx, b.vz);
    const miss = Math.random() < O.error + Math.max(0, speed - 16) * 0.012 + (m.rally > 8 ? 0.04 : 0);
    let tx, tz;
    if (miss) { const w = Math.random(); tx = k.x + (w < 0.5 ? (Math.random() < 0.5 ? -1 : 1) * (COURT.W / 2 + 0.8 + Math.random()) : (Math.random() - 0.5) * COURT.W); tz = w < 0.5 ? k.z + 6 : (Math.random() < 0.5 ? k.z + COURT.L / 2 + 1 + Math.random() * 2 : k.z + 0.5); }
    else { tx = k.x + (Math.random() - 0.5) * (COURT.W - 1.4); tz = k.z + COURT.L / 2 - 1 - Math.random() * 6; }
    this.shoot({ x: b.x, y: Math.max(0.5, b.y), z: b.z }, tx, tz, 1.25 - O.power * 0.2, O.power);
    if (miss && tz === k.z + 0.5) { m.b.vy *= 0.55; }   // filet
    m.hitter = 1; m.rally++;
    this.g.sfx('pop');
  }

  point(winner, why) {
    const m = this.m, g = this.g;
    if (m.state === 'over') return;
    m.pts[winner]++;
    if (winner === 0 && m.rally === 1 && m.server === 0) m.aces++;
    g.sfx(winner === 0 ? 'success' : 'fail');
    const gw = gameWinner(m.pts[0], m.pts[1]);
    if (gw >= 0) {
      m.games[gw]++; m.pts = [0, 0]; m.server = 1 - m.server;
      if (m.games[gw] >= GAMES_TO_WIN) { m.state = 'over'; m.wait = 2.2; this.refresh(gw === 0 ? '🏆 Jeu, set et match !' : '😓 Match perdu...'); g.sfx(gw === 0 ? 'levelup' : 'fail'); m.result = gw === 0; return; }
      this.refresh(`${gw === 0 ? '🎉 Jeu pour toi' : 'Jeu pour l\'adversaire'} (${why})`);
    } else this.refresh(`${winner === 0 ? '✅ Point pour toi' : '❌ Point adverse'} : ${why}`);
    m.state = 'between'; m.wait = 1.4;
  }

  async end(won, abandon = false) {
    const m = this.m, g = this.g;
    if (!m) return;
    this.m = null;
    m.av.root.removeFromParent(); g.labels.remove?.(m.label); m.ball.removeFromParent(); m.shadow.removeFromParent();
    m.hud.remove(); m.btns.remove();
    g.avatar.hold(null); g.player.noJump = false;
    if (this.saved) { g.cam.dist = this.saved.dist; g.cam.pitch = this.saved.pitch; }
    const r = await req(g, 'tennis.end', { won: !!won && !abandon, aces: m.aces });
    if (!r) return;
    if (r.won) g.ui.dialog({ name: 'Arbitre', role: m.club.name, text: `Jeu, set et match ! ${m.games[0]}–${m.games[1]} contre ${m.O.name}. Prime : ${fmt(r.prize)} PC, +${r.xp} XP.${r.first ? ' Adversaire suivant débloqué !' : ''}${m.aces ? ` (${m.aces} ace${m.aces > 1 ? 's' : ''} !)` : ''}`, choices: [{ label: '🎾 Super !', ghost: true, action: (x) => x.close() }] });
    else g.ui.dialog({ name: 'Arbitre', role: m.club.name, text: abandon ? 'Abandon. Le court reste à toi la prochaine fois !' : `Défaite ${m.games[0]}–${m.games[1]}. Conseil : frappe la balle quand elle est à un pas de toi, et vise les côtés avec A / D !`, choices: [{ label: 'D\'accord', ghost: true, action: (x) => x.close() }] });
  }

  // ------------------------------------------------------------------ boucle
  update(dt) {
    const m = this.m, g = this.g;
    if (!m) return;
    const k = m.k, b = m.b, P = g.player.pos, O = m.O;
    m.swingT = Math.max(0, m.swingT - dt); m.aiSwing = Math.max(0, m.aiSwing - dt);
    // le joueur reste de son côté
    P.x = clamp(P.x, k.x - COURT.W / 2 - COURT.runX + 0.4, k.x + COURT.W / 2 + COURT.runX - 0.4);
    P.z = clamp(P.z, k.z + 0.6, k.z + COURT.L / 2 + COURT.runZ - 0.6);
    if (Math.hypot(P.x - k.x, P.z - k.z) > 40) { this.end(false, true); return; }
    // adversaire : se place sous la balle (ou au centre)
    let tx = k.x, tz = k.z - COURT.L / 2 - 0.8;
    if (m.state === 'play' && m.hitter === 0 && b.vz < 0) {
      // point de chute prévu
      const tFall = (b.vy + Math.sqrt(Math.max(0, b.vy * b.vy + 2 * G * Math.max(0, b.y)))) / G;
      tx = b.x + b.vx * (tFall + 0.35); tz = Math.min(k.z - 2, b.z + b.vz * (tFall + 0.35));
    } else if (m.state === 'serve' && m.server === 1) { tx = k.x - 0.8; tz = k.z - COURT.L / 2 - 0.6; }
    const ax = tx - m.ai.x, az = tz - m.ai.z, ad = Math.hypot(ax, az);
    const step = Math.min(ad, O.speed * dt);
    if (ad > 0.05) { m.ai.x += (ax / ad) * step; m.ai.z += (az / ad) * step; }
    m.ai.z = Math.min(m.ai.z, k.z - 0.8);
    m.av.root.position.set(m.ai.x, 0, m.ai.z);
    m.av.root.rotation.y = Math.atan2(P.x - m.ai.x, P.z - m.ai.z);
    m.av.update(dt, { speed: ad > 0.2 ? Math.min(O.speed, ad * 3) : 0, grounded: true, pose: m.aiSwing > 0 ? 'throw' : 'idle' });
    // états du point
    if (m.state === 'serve') {
      const hand = m.server === 0 ? { x: P.x + 0.3, y: 1.6 + Math.abs(Math.sin(performance.now() / 300)) * 0.5, z: P.z - 0.3 } : { x: m.ai.x - 0.3, y: 1.8, z: m.ai.z + 0.3 };
      Object.assign(b, { ...hand, vx: 0, vy: 0, vz: 0 });
      if (m.server === 1) { m.wait -= dt; if (m.wait <= 0) { m.aiSwing = 0.3; this.shoot({ x: m.ai.x, y: 2.4, z: m.ai.z + 0.4 }, k.x + (Math.random() - 0.5) * COURT.W * 0.6, k.z + 3.5 + Math.random() * 2.6, 0.85, O.power); m.state = 'play'; m.hitter = 1; m.rally = 1; this.refresh(''); g.sfx('pop'); } }
    } else if (m.state === 'play') {
      const pz = b.z;
      b.vy -= G * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      // filet
      if ((pz - k.z) * (b.z - k.z) < 0 && b.y < COURT.netH && Math.abs(b.x - k.x) < COURT.W / 2 + 2) { b.vz *= -0.15; b.vx *= 0.3; this.point(1 - m.hitter, 'balle dans le filet'); }
      // rebond
      if (b.y <= 0.1 && b.vy < 0) {
        b.y = 0.1; b.vy = -b.vy * 0.72; b.vx *= 0.88; b.vz *= 0.88;
        g.sfx('click');
        const sd = this.side(b.z), inX = Math.abs(b.x - k.x) <= COURT.W / 2 + 0.05, inZ = Math.abs(b.z - k.z) <= COURT.L / 2 + 0.05;
        if (m.bounces === 0) {
          if (sd === m.hitter) this.point(1 - m.hitter, 'balle dans le filet');
          else if (!inX || !inZ) this.point(1 - m.hitter, 'faute, balle dehors');
          m.bounces = 1;
        } else this.point(m.hitter, m.hitter === 0 ? 'l\'adversaire n\'a pas pu la rattraper' : 'deuxième rebond, trop tard');
      }
      // l'adversaire frappe quand la balle passe à sa portée (après le rebond, ou de volée près du filet)
      if (m.state === 'play' && m.hitter === 0 && this.side(b.z) === 1 && (m.bounces === 1 || m.ai.z > k.z - 4) && b.y < 2.4 && Math.hypot(b.x - m.ai.x, b.z - m.ai.z) < O.reach) this.aiHit();
      // balle partie très loin
      if (m.state === 'play' && Math.abs(b.z - k.z) > COURT.L / 2 + COURT.runZ + 4) this.point(m.bounces ? m.hitter : 1 - m.hitter, m.bounces ? 'balle imprenable' : 'balle dehors');
    } else if (m.state === 'between') {
      b.vy -= G * dt; b.x += b.vx * dt; b.y = Math.max(0.1, b.y + b.vy * dt); b.z += b.vz * dt; b.vx *= 0.98; b.vz *= 0.98;
      m.wait -= dt; if (m.wait <= 0) this.newPoint();
    } else if (m.state === 'over') {
      m.wait -= dt; if (m.wait <= 0) { this.end(m.result); return; }
    }
    m.ball.position.set(b.x, b.y, b.z);
    m.shadow.position.set(b.x, 0.06, b.z);
  }
}
