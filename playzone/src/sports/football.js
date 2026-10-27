import * as THREE from 'three';
import { h } from '../ui/dom.js';
import { Avatar } from '../characters/avatar.js';
import { DEFAULT_APPEARANCE, SKINS, HAIR_STYLES, HAIR_COLORS } from '../../shared/appearance.js';
import { PITCH, PITCHES, pitchOfClub, DRILLS, MATCHES, FOOT_SKILLS, FOOT_LEVELS, footLevel, levelIndex } from '../../shared/sports.js';
import { mulberry32 } from '../../shared/rng.js';

// FOOTBALL : Stade des Crampons (terrain, buts, tribunes, projecteurs), club-house (inscription
// gratuite, entraînements gratuits, matchs), ballon physique, coéquipiers et adversaires PNJ.
// Commandes (touches côte à côte, main droite) : J = tirer (maintenir pour charger la frappe),
// K = passe à un coéquipier, L = tacle glissé, Espace = dribble (crochet + accélération).
// Déplacements habituels, Maj = sprint. Anciennes touches F / R / Q aussi. Boutons à l'écran sur mobile.

const L = PITCH.w / 2, W = PITCH.d / 2, R = 0.22;
const fwd = (yaw) => ({ x: Math.sin(yaw), z: Math.cos(yaw) });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const pickOne = (a) => a[Math.floor(Math.random() * a.length)];
const req = async (g, t, p) => { try { return await g.net.request(t, p); } catch (e) { g.ui.toast(e.message, 'bad', 4500); g.sfx('error'); return null; } };
const KIT = [['#1d4ed8', '#ffffff'], ['#e63946', '#14141c']];
const NAMES = ['Kylian Mbappou', 'Zizou Junior', 'Momo Lahaut', 'Titi Henri-Pas', 'Gégé la Frappe', 'Ronaldinho Patate', 'Messi-Mignon', 'Lulu Crampon', 'Nono Panenka', 'Didi Grinta', 'Benz Tomate', 'Ribéry Mou', 'Jojo Ciseau', 'Karim Volée', 'Paulo Petit-Pont', 'Sergio Tacle'];

export class Football {
  constructor(g) {
    this.g = g;
    this.s = null;
    this.buildStadium();
  }

  // ------------------------------------------------------------------------------ stade
  // un terrain par club (le grand stade a en plus le tableau d'affichage et les supporters)
  buildStadium() {
    for (const p of PITCHES) { Object.assign(PITCH, { x: p.x, z: p.z }); this.buildPitch(p); }
    this.usePitch(PITCHES[0]);
    // ballon (caché hors activité)
    const g = this.g;
    const c = document.createElement('canvas'); c.width = 64; c.height = 32;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 64, 32); x.fillStyle = '#111';
    for (let i = 0; i < 6; i++) { x.beginPath(); x.arc(6 + i * 11, i % 2 ? 9 : 23, 4.5, 0, 7); x.fill(); }
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(R, 16, 12), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(c), roughness: 0.5 }));
    this.ball.castShadow = true; this.ball.visible = false;
    g.engine.scene.add(this.ball);
    this.cones = new THREE.Group(); g.engine.scene.add(this.cones);
  }

  // terrain du club où l'on joue (toutes les positions du jeu sont relatives à PITCH)
  usePitch(p) { if (!this.s) { this.pitch = p; Object.assign(PITCH, { x: p.x, z: p.z }); } }

  buildPitch(site) {
    const g = this.g, root = new THREE.Group(), main = !!site.main;
    root.name = 'stade';
    const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, ...o });
    const plane = (w, d, m, x, z, y = 0.04) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), m); p.position.set(x, y, z); p.receiveShadow = true; root.add(p); return p; };
    // pelouse rayée
    plane(PITCH.w + 10, PITCH.d + 10, mat('#3f8f3a'), PITCH.x, PITCH.z, 0.035);
    for (let i = 0; i < 8; i++) plane(PITCH.w / 8, PITCH.d, mat(i % 2 ? '#4ea64a' : '#45993f'), PITCH.x - L + PITCH.w / 16 + i * PITCH.w / 8, PITCH.z, 0.04);
    // lignes
    const white = mat('#f4f4f0', { roughness: 0.6 });
    const line = (x, z, w, d) => plane(w, d, white, x, z, 0.05);
    line(PITCH.x, PITCH.z - W, PITCH.w, 0.15); line(PITCH.x, PITCH.z + W, PITCH.w, 0.15);
    line(PITCH.x - L, PITCH.z, 0.15, PITCH.d); line(PITCH.x + L, PITCH.z, 0.15, PITCH.d); line(PITCH.x, PITCH.z, 0.15, PITCH.d);
    const circle = new THREE.Mesh(new THREE.RingGeometry(5.9, 6.05, 48).rotateX(-Math.PI / 2), white); circle.position.set(PITCH.x, 0.05, PITCH.z); root.add(circle);
    for (const s of [-1, 1]) {
      const gx = PITCH.x + s * L, bx = gx - s * PITCH.box / 2;
      line(gx - s * PITCH.box, PITCH.z, 0.15, 20); line(bx, PITCH.z - 10, PITCH.box, 0.15); line(bx, PITCH.z + 10, PITCH.box, 0.15);
      // buts : poteaux, barre, filet
      const post = mat('#ffffff', { roughness: 0.4 });
      for (const k of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, PITCH.goalH, 8), post); p.position.set(gx, PITCH.goalH / 2, PITCH.z + k * PITCH.goalW / 2); root.add(p); }
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, PITCH.goalW, 8).rotateX(Math.PI / 2), post); bar.position.set(gx, PITCH.goalH, PITCH.z); root.add(bar);
      const net = new THREE.Mesh(new THREE.BoxGeometry(1.6, PITCH.goalH, PITCH.goalW), new THREE.MeshStandardMaterial({ color: '#ffffff', wireframe: true, transparent: true, opacity: 0.5 }));
      net.position.set(gx + s * 0.8, PITCH.goalH / 2, PITCH.z); root.add(net);
      g.collision.addBox(gx + s * 1.6 - 0.1, 0, PITCH.z - PITCH.goalW / 2, gx + s * 1.6 + 0.1, PITCH.goalH, PITCH.z + PITCH.goalW / 2, { noCamera: true });
    }
    // tribunes (côté club-house) et projecteurs
    const seat = mat('#c9ced6'), seatB = mat('#1d4ed8');
    for (let r = 0; r < 5; r++) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(50, 0.5, 1.2), r % 2 ? seat : seatB);
      st.position.set(PITCH.x, 0.25 + r * 0.5, PITCH.z + W + 10 + r * 1.2); st.castShadow = true; root.add(st);
      g.collision.addBox(PITCH.x - 25, 0, PITCH.z + W + 9.4 + r * 1.2, PITCH.x + 25, 0.5 + r * 0.5, PITCH.z + W + 10.6 + r * 1.2);
    }
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const x = PITCH.x + sx * (L + 13), z = PITCH.z + sz * (W + 10);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 14, 8), mat('#6c757d')); m.position.set(x, 7, z); root.add(m);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1, 0.4), new THREE.MeshStandardMaterial({ color: '#fffbe6', emissive: '#fff4c2', emissiveIntensity: 0.8 })); lamp.position.set(x, 14, z); root.add(lamp);
      g.collision.addCyl(x, z, 0.3, 0, 14);
    }
    // panneau du club
    const sign = new THREE.Mesh(new THREE.BoxGeometry(12, 2, 0.2), mat(site.color || '#2a9d3a')); sign.position.set(PITCH.x, 5.6, PITCH.z + W + 16.5); root.add(sign);
    if (!main) { g.engine.scene.add(root); return; }
    // tableau d'affichage (texture mise à jour pendant les matchs)
    this.board = document.createElement('canvas'); this.board.width = 512; this.board.height = 192;
    this.boardTex = new THREE.CanvasTexture(this.board);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(10, 3.75), new THREE.MeshBasicMaterial({ map: this.boardTex, toneMapped: false }));
    scr.position.set(PITCH.x - L - 9, 7, PITCH.z); scr.rotation.y = Math.PI / 2; root.add(scr);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.3, 10.6), mat('#14141c')); frame.position.set(PITCH.x - L - 9.25, 7, PITCH.z); root.add(frame);
    for (const dz of [-3.5, 3.5]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5, 0.3), mat('#6c757d')); leg.position.set(PITCH.x - L - 9.3, 2.5, PITCH.z + dz); root.add(leg); }
    this.drawBoard('STADE', 'DES CRAMPONS', '');
    // supporters dans la tribune (ils se lèvent et applaudissent aux buts)
    this.fans = [];
    const fr = mulberry32(99);
    for (let r = 0; r < 4; r++) for (let i = 0; i < 9; i++) {
      if (fr() < 0.35) continue;
      const av = new Avatar({ ...DEFAULT_APPEARANCE, skin: SKINS[Math.floor(fr() * 8)], hair: HAIR_STYLES[Math.floor(fr() * HAIR_STYLES.length)], hairColor: HAIR_COLORS[Math.floor(fr() * 7)], top: 'tshirt', topColor: fr() < 0.6 ? KIT[0][0] : KIT[1][0], hat: null }, {});
      av.root.position.set(PITCH.x - 22 + i * 5.3 + fr() * 1.5, 0.5 + r * 0.5, PITCH.z + W + 10.2 + r * 1.2);
      av.root.rotation.y = Math.PI; av.root.scale.setScalar(0.9);
      root.add(av.root); this.fans.push({ av, ph: fr() * 6 });
    }
    this.cheer = 0;
    g.engine.scene.add(root);
  }

  get active() { return !!this.s; }

  drawBoard(a, b, c) {
    const x = this.board.getContext('2d');
    x.fillStyle = '#0b0b10'; x.fillRect(0, 0, 512, 192);
    x.fillStyle = '#ffd23f'; x.font = 'bold 54px sans-serif'; x.textAlign = 'center'; x.fillText(a, 256, 70);
    x.fillStyle = '#ffffff'; x.font = 'bold 40px sans-serif'; x.fillText(b, 256, 125);
    x.fillStyle = '#2ec4b6'; x.font = 'bold 30px sans-serif'; x.fillText(c, 256, 172);
    this.boardTex.needsUpdate = true;
  }

  // ------------------------------------------------------------------------------ club-house
  desk(b = null) {
    const g = this.g;
    if (this.s) { g.ui.toast('Termine d\'abord ton activité en cours.', 'bad'); return; }
    if (b) this.usePitch(pitchOfClub(b.id));
    let tab = 'club', strength = 0.5;
    const m = g.ui.modal({
      title: `⚽ ${this.pitch?.name || 'Stade des Crampons'}`, sub: 'Club GRATUIT : inscription, entraînements et petits matchs gratuits. Plus tu joues, meilleur tu deviens.',
      width: 'min(640px, 96vw)',
      build: (body, mm) => {
        const f = g.profile.sports.foot, lv = footLevel(f.xp);
        body.append(h('div.opt-row', { style: { marginBottom: '10px' } }, [['club', 'Mon club'], ['train', 'Entraînements'], ['match', 'Matchs']].map(([id, l]) => h(`button.opt${tab === id ? '.sel' : ''}`, { onclick: () => { tab = id; mm.refresh(); } }, l))));
        if (tab === 'club') {
          body.append(h('div.list-item', h('span', { style: { fontSize: '26px' } }, f.club ? '🪪' : '📝'),
            h('div.grow', h('div.t', f.club ? `Licencié·e · niveau ${lv.name}` : 'Pas encore inscrit·e'), h('div.d', f.club ? `${f.xp} XP foot${lv.next ? ` · prochain niveau (${lv.next.name}) à ${lv.next.xp} XP` : ' · niveau maximum !'}` : 'L\'inscription est gratuite. Un match amical d\'essai est offert avant.')),
            f.club ? null : h('button.btn.small', { onclick: async () => { if (await req(g, 'foot.join', {})) { g.sfx('levelup'); g.ui.toast('⚽ Bienvenue au club ! Entraînements et matchs débloqués.', 'good', 4500); mm.refresh(); } } }, 'S\'inscrire (gratuit)')));
          body.append(h('h4', { style: { margin: '10px 0 6px' } }, 'Compétences'));
          for (const [k, n] of Object.entries(FOOT_SKILLS)) body.append(bar(n, f.skills[k]));
          body.append(bar('Endurance (corps)', g.profile.body.endurance ?? 15));
          body.append(h('p.muted', `${f.matches} matchs · ${f.wins} V / ${f.draws} N / ${f.losses} D · ${f.goals} buts · ${f.trophies} 🏆 · ${f.trainings} entraînements`));
          body.append(h('p.muted', 'Commandes : J = tirer (maintiens pour frapper plus fort) · K = passe · L = tacle glissé · Espace = dribble · Maj = sprint.'));
        } else if (tab === 'train') {
          for (const [id, d] of Object.entries(DRILLS)) body.append(h('div.list-item', h('span', { style: { fontSize: '24px' } }, d.icon),
            h('div.grow', h('div.t', `${d.name} · gratuit`), h('div.d', `${d.desc} Fait progresser : ${FOOT_SKILLS[d.skill]} + endurance.`)),
            h('button.btn.small', { onclick: () => { m.close(); this.startDrill(id); } }, 'Commencer')));
        } else {
          for (const [id, M] of Object.entries(MATCHES)) {
            const locked = lv.i < levelIndex(M.need), trial = !f.club && id === 'amical';
            const off = locked || (!f.club && (id !== 'amical' || f.matches >= 1));
            body.append(h('div.list-item', h('span', { style: { fontSize: '24px' } }, id === 'gros' ? '🏟️' : id === 'championnat' ? '🏆' : id === 'organise' ? '📣' : '⚽'),
              h('div.grow', h('div.t', `${M.name}${trial ? ' (essai gratuit)' : ''}`), h('div.d', `${M.desc} ${M.size} contre ${M.size}, ${M.mins} min.${M.prize ? ` Prime : ${M.prize} PC.` : ''}${locked ? ` 🔒 Niveau ${FOOT_LEVELS[levelIndex(M.need)].name}` : ''}`),
                id === 'organise' ? h('div.row', { style: { gap: '6px', alignItems: 'center' } }, h('span.d', 'Niveau des adversaires'), h('input', { type: 'range', min: 15, max: 100, value: Math.round(strength * 100), oninput: (e) => { strength = e.target.value / 100; } })) : null),
              h('button.btn.small', { disabled: off, onclick: () => { m.close(); this.startMatch(id, strength); } }, 'Jouer')));
          }
          if (g.net.mode !== 'solo') body.append(h('p.muted', '📣 Un match organisé envoie une invitation dans le chat : les joueurs proches peuvent venir regarder et encourager.'));
        }
      },
    });
    function bar(name, v) {
      return h('div.list-item', h('div.grow', h('div.t', `${name} : ${Math.round(v)}/100`), h('div', { style: { height: '8px', background: 'rgba(255,255,255,.12)', borderRadius: '6px', marginTop: '4px' } }, h('div', { style: { width: `${clamp(v, 0, 100)}%`, height: '100%', background: '#2ec4b6', borderRadius: '6px' } }))));
    }
  }

  // ------------------------------------------------------------------------------ acteurs
  makeActor(team, role, name, str, rand) {
    const g = this.g, pick = (a) => a[Math.floor(rand() * a.length)];
    const [shirt] = KIT[team];
    const av = new Avatar({ ...DEFAULT_APPEARANCE, skin: pick(SKINS.slice(0, 8)), hair: pick(HAIR_STYLES), hairColor: pick(HAIR_COLORS.slice(0, 7)), top: 'tshirt', topColor: role === 'gk' ? '#ffd23f' : shirt, bottom: 'short', bottomColor: KIT[team][1], hat: null, glasses: null }, {});
    g.engine.scene.add(av.root);
    const label = document.createElement('div');
    label.className = 'wlabel'; label.textContent = `${name}${role === 'gk' ? ' 🧤' : ''}`;
    const lab = g.labels.add(av.root, label, 2.0, 35);
    return { team, role, name, str, av, lab, pos: new THREE.Vector3(), yaw: 0, vel: new THREE.Vector3(), kickCd: 0, tackleCd: 0, celebrate: 0, home: { x: 0, z: 0 }, ai: true };
  }

  me() {
    const g = this.g, P = g.player;
    if (!this.s.meActor) this.s.meActor = { team: 0, role: 'att', name: g.profile.name, ai: false, kickCd: 0, tackleCd: 0, home: { x: 0, z: 0 } };
    const a = this.s.meActor;
    a.pos = P.pos; a.yaw = P.yaw; a.vel = P.vel || new THREE.Vector3();
    return a;
  }

  // direction d'attaque : équipe 0 vers +X, équipe 1 vers -X
  dir(team) { return team === 0 ? 1 : -1; }
  goalX(team) { return PITCH.x + this.dir(team) * L; }       // but que l'équipe attaque

  formation(n) {
    // rôles et positions (en coordonnées « attaque vers +X » relatives au centre)
    const F = { 3: [['gk', -L + 1.5, 0], ['def', -L * 0.45, 0], ['att', L * 0.1, 0]],
      4: [['gk', -L + 1.5, 0], ['def', -L * 0.5, -6], ['mid', -L * 0.15, 6], ['att', L * 0.1, 0]],
      5: [['gk', -L + 1.5, 0], ['def', -L * 0.55, -7], ['def', -L * 0.55, 7], ['mid', -L * 0.15, 0], ['att', L * 0.1, 0]],
      6: [['gk', -L + 1.5, 0], ['def', -L * 0.55, -8], ['def', -L * 0.55, 8], ['mid', -L * 0.2, -6], ['mid', -L * 0.2, 6], ['att', L * 0.1, 0]] };
    return F[clamp(n, 3, 6)];
  }

  setHome(a, fx, fz) { const d = this.dir(a.team); a.home = { x: PITCH.x + d * fx, z: PITCH.z + d * fz }; }

  // ------------------------------------------------------------------------------ démarrages
  async startMatch(kind, strength) {
    const g = this.g;
    const r = await req(g, 'foot.matchStart', { kind, strength });
    if (!r) return;
    const M = MATCHES[kind];
    const rand = mulberry32(r.seed);
    const f = g.profile.sports.foot;
    const mate = clamp(0.25 + footLevel(f.xp).i * 0.12, 0.2, 0.9);
    this.begin({ mode: 'match', kind, opponent: r.opponent, mins: r.mins });
    const form = this.formation(r.size);
    const names = [...NAMES].sort(() => rand() - 0.5);
    // mon équipe : moi = attaquant ; PNJ pour les autres postes
    form.forEach(([role, fx, fz], i) => {
      if (role === 'att') { const me = this.me(); this.setHome(me, fx, fz); return; }
      const a = this.makeActor(0, role, names[i], mate, rand); this.setHome(a, fx, fz); this.s.actors.push(a);
    });
    form.forEach(([role, fx, fz], i) => { const a = this.makeActor(1, role, names[8 + i] || `${r.opponent} ${i + 1}`, r.strength, rand); this.setHome(a, fx, fz); this.s.actors.push(a); });
    this.s.score = [0, 0]; this.s.myGoals = 0;
    this.s.until = g.now() + r.mins * 60_000;
    this.kickoff(0);
    if (kind === 'organise' && g.net.mode !== 'solo') g.net.chat?.(`📣 ${g.profile.name} organise un match de foot au Stade des Crampons ! Venez voir !`);
    g.sfx('whistle');
    g.ui.toast(`⚽ ${M.name} contre ${r.opponent} ! J = tirer · K = passe · L = tacle · Espace = dribble · Maj = sprint`, 'event', 6000);
  }

  async startDrill(drill) {
    const g = this.g;
    // on se place sur le terrain avant de demander (l'autorité vérifie qu'on y est)
    g.player.teleport(PITCH.x + L - 18, PITCH.z, Math.PI / 2);
    const r = await req(g, 'foot.drillStart', { drill });
    if (!r) return;
    const rand = mulberry32(r.seed);
    this.begin({ mode: 'drill', drill });
    const s = this.s, me = this.me();
    s.score = 0; s.t0 = g.now();
    if (drill === 'tirs') {
      const gk = this.makeActor(1, 'gk', 'Gardien Lulu', clamp(0.25 + footLevel(g.profile.sports.foot.xp).i * 0.1, 0.2, 0.8), rand);
      this.setHome(gk, -L + 1.5, 0); s.actors.push(gk); gk.pos.set(gk.home.x, 0, gk.home.z);
      s.balls = 10; this.nextShot();
    } else if (drill === 'slalom') {
      s.gates = [];
      for (let i = 0; i < 8; i++) s.gates.push({ x: PITCH.x - L + 10 + i * 6.5, z: PITCH.z + (i % 2 ? 4 : -4) });
      s.gi = 0; this.drawCones(s.gates);
      g.player.teleport(PITCH.x - L + 4, PITCH.z, Math.PI / 2);
      this.giveBall(me);
    } else if (drill === 'passes') {
      s.targets = [];
      for (let i = 0; i < 4; i++) { const a = this.makeActor(0, 'mid', NAMES[i], 0.6, rand); a.pos.set(PITCH.x + (i < 2 ? -12 : 12), 0, PITCH.z + (i % 2 ? -10 : 10)); a.home = { x: a.pos.x, z: a.pos.z }; a.static = true; s.actors.push(a); s.targets.push(a); }
      g.player.teleport(PITCH.x, PITCH.z, Math.PI / 2);
      s.lit = 0; s.passes = 0; this.giveBall(me); this.lightTarget();
    } else if (drill === 'sprints') {
      s.runs = []; s.side = 1; s.runT = g.now();
      g.player.teleport(PITCH.x, PITCH.z - W + 1, 0);
      this.drawCones([{ x: PITCH.x, z: PITCH.z - W + 1 }, { x: PITCH.x, z: PITCH.z + W - 1 }]);
    }
    g.ui.toast(`${DRILLS[drill].icon} ${DRILLS[drill].name} : ${DRILLS[drill].desc}`, 'good', 6000);
  }

  begin(opts) {
    const g = this.g;
    if (g.vehicles?.current) g.vehicles.exit(true);
    this.s = { ...opts, actors: [], meActor: null, ball: { pos: new THREE.Vector3(PITCH.x, R, PITCH.z), vel: new THREE.Vector3(), owner: null, last: null, lastTeam: 0, dead: 0 }, charge: 0, hudT: 0, pause: 0, speedBonus: g.player.speedBonus };
    this.ball.visible = true;
    // vitesse : la compétence aide un peu à courir plus vite pendant l'activité
    g.player.speedBonus = (g.player.speedBonus || 1) * (1 + (g.profile.sports.foot.skills.vitesse || 10) / 400);
    g.player.noJump = true;   // Espace = dribble pendant le foot
    this.buttons = h('div.foot-btns',
      h('button', { onpointerdown: (e) => { e.preventDefault(); this.shoot(0.75); } }, '⚽ Tir (J)'),
      h('button', { onpointerdown: (e) => { e.preventDefault(); this.pass(); } }, '➡️ Passe (K)'),
      h('button', { onpointerdown: (e) => { e.preventDefault(); this.tackle(); } }, '🦵 Tacle (L)'),
      h('button', { onpointerdown: (e) => { e.preventDefault(); this.dribble(); } }, '💨 Dribble (Espace)'));
    g.ui.root.append(this.buttons);
  }

  drawCones(pts) {
    this.cones.clear();
    const m = new THREE.MeshStandardMaterial({ color: '#ff7b00' });
    for (const p of pts) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.6, 10), m); c.position.set(p.x, 0.3, p.z); this.cones.add(c); }
  }

  lightTarget() {
    const s = this.s;
    s.lit = (s.lit + 1 + Math.floor(Math.random() * 3)) % s.targets.length;
    s.targets.forEach((a, i) => { a.lab.el ? (a.lab.el.textContent = i === s.lit ? '🟢 PASSE-MOI !' : a.name) : null; a.wave = i === s.lit; });
  }

  nextShot() {
    const s = this.s, g = this.g;
    if (s.balls <= 0) { this.finishDrill(); return; }
    s.balls--;
    const z = PITCH.z + (Math.random() - 0.5) * 14;
    g.player.teleport(PITCH.x - L + 17, z, -Math.PI / 2);
    s.ball.pos.set(PITCH.x - L + 16.2, R, z); s.ball.vel.set(0, 0, 0); s.ball.owner = null; s.shotAt = 0;
    const gk = s.actors[0]; gk.pos.set(gk.home.x, 0, PITCH.z); gk.hasSaved = false;
  }

  kickoff(team) {
    const s = this.s, me = this.me();
    for (const a of s.actors) { a.pos.set(a.home.x, 0, a.home.z); a.yaw = this.dir(a.team) > 0 ? Math.PI / 2 : -Math.PI / 2; a.celebrate = 0; }
    this.g.player.teleport(me.home.x - this.dir(0) * (team === 0 ? 10 : 12), me.home.z, Math.PI / 2);
    s.ball.pos.set(PITCH.x, R, PITCH.z); s.ball.vel.set(0, 0, 0); s.ball.owner = null;
    if (team === 0) this.giveBall(me);
    else { const att = s.actors.find((a) => a.team === 1 && a.role === 'att'); att.pos.set(PITCH.x + 0.8, 0, PITCH.z); this.giveBall(att); }
    s.pause = 1.2;
  }

  giveBall(a) { const b = this.s.ball; b.owner = a; b.last = a; b.lastTeam = a.team; b.target = null; a.kickCd = 0.3; }

  // ------------------------------------------------------------------------------ gestes du joueur
  kickBall(a, dx, dz, speed, lift = 0) {
    const b = this.s.ball, l = Math.hypot(dx, dz) || 1;
    b.owner = null; b.last = a; b.lastTeam = a.team;
    b.vel.set(dx / l * speed, lift, dz / l * speed);
    b.pos.y = Math.max(b.pos.y, R + 0.05);
    a.kickCd = 0.6;
    this.g.sfx('bounce');
  }

  shoot(power = null) {
    const s = this.s, me = s && this.me(), g = this.g;
    if (!s || s.ball.owner !== me) return;
    const P = power ?? clamp(s.charge / 0.8, 0.25, 1);
    s.charge = 0;
    const skill = g.profile.sports.foot.skills.tir;
    const f = fwd(me.yaw), gx = this.goalX(0);
    // visée automatique vers un coin du but si on est face au but
    const tz = PITCH.z + (Math.random() < 0.5 ? -1 : 1) * (PITCH.goalW / 2 - 0.7);
    let dx = gx - me.pos.x, dz = tz - me.pos.z;
    const facing = (f.x * dx + f.z * dz) / (Math.hypot(dx, dz) || 1);
    if (s.drill === 'tirs') { dx = -L + PITCH.x - me.pos.x; dz = tz - me.pos.z; } else if (facing < 0.5) { dx = f.x; dz = f.z; }
    const err = (1 - skill / 110) * 0.22 * (Math.random() * 2 - 1) + (P > 0.9 ? (Math.random() - 0.5) * 0.12 : 0);
    const a = Math.atan2(dx, dz) + err;
    // une vraie frappe : jusqu'à ~130 km/h, un peu d'élévation selon la puissance
    this.kickBall(me, Math.sin(a), Math.cos(a), 21 + P * 15 + skill * 0.06, 1 + P * 3.6 + Math.random() * 1.2);
    g.player.setPose('kick', 0.35); g.sfx('shot');
    if (s.drill === 'tirs') s.shotAt = g.now();
  }

  pass() {
    const s = this.s, me = s && this.me(), g = this.g;
    if (!s || s.ball.owner !== me) return;
    const f = fwd(me.yaw);
    const mates = s.actors.filter((a) => a.team === 0 && a.role !== 'gk');
    if (s.drill === 'passes') mates.sort((a, b) => (b.wave ? 1 : 0) - (a.wave ? 1 : 0));
    let best = null, bs = -Infinity;
    for (const a of mates) {
      const dx = a.pos.x - me.pos.x, dz = a.pos.z - me.pos.z, d = Math.hypot(dx, dz);
      if (d < 2 || d > 40) continue;
      const sc = (f.x * dx + f.z * dz) / d * 2 - d / 30 + (a.wave ? 3 : 0);
      if (sc > bs) { bs = sc; best = a; }
    }
    const skill = g.profile.sports.foot.skills.passe;
    let dx = f.x, dz = f.z, d = 14;
    if (best) { d = Math.hypot(best.pos.x - me.pos.x, best.pos.z - me.pos.z); dx = best.pos.x + (best.vel?.x || 0) * 0.4 - me.pos.x; dz = best.pos.z + (best.vel?.z || 0) * 0.4 - me.pos.z; }
    const a = Math.atan2(dx, dz) + (1 - skill / 110) * 0.16 * (Math.random() * 2 - 1);
    this.kickBall(me, Math.sin(a), Math.cos(a), clamp(9 + d * 0.6, 10, 24), d > 24 ? 3 : 0.3);
    s.ball.target = best;   // le coéquipier vient chercher le ballon
    g.player.setPose('kick', 0.3);
    if (best) g.labels.bubble(best.av.root, 'À moi !', 900);
  }

  // Tacle glissé : on glisse au sol dans la direction du regard ; le porteur touché perd le ballon et tombe.
  tackle() {
    const s = this.s, me = s && this.me(), g = this.g;
    if (!s || s.mode !== 'match' || me.tackleCd > 0 || s.slide || s.ball.owner === me) return;
    me.tackleCd = 1.2;
    const f = fwd(me.yaw);
    s.slide = { t: 0.7, vx: f.x * 10, vz: f.z * 10, hit: false };
    g.player.external = true;
    g.sfx('whoosh');
  }

  slideUpdate(dt) {
    const s = this.s, g = this.g, sl = s.slide, P = g.player, me = this.me();
    sl.t -= dt;
    const k = Math.max(0, sl.t / 0.7);
    P.pos.x = clamp(P.pos.x + sl.vx * k * dt, PITCH.x - L - 6, PITCH.x + L + 6); P.pos.z = clamp(P.pos.z + sl.vz * k * dt, PITCH.z - W - 6, PITCH.z + W + 6);
    P.vel.set(sl.vx * k, 0, sl.vz * k);
    P.avatar.root.position.set(P.pos.x, 0, P.pos.z); P.avatar.root.rotation.set(0, P.yaw, 0);
    P.avatar.update(dt, { speed: 0, grounded: true, pose: 'slide' });
    if (Math.random() < dt * 20) g.fx.emit({ x: P.pos.x, y: 0.1, z: P.pos.z, n: 2, colors: ['#4ea64a', '#7a5230'], speed: 1.5, gravity: 6, life: 0.4, size: 0.1 });
    const o = s.ball.owner;
    if (!sl.hit && o && o.team === 1 && Math.hypot(o.pos.x - P.pos.x, o.pos.z - P.pos.z) < 1.6) {
      sl.hit = true;
      const chance = 0.55 + (g.profile.sports.foot.skills.dribble - o.str * 100) / 220;
      if (Math.random() < chance) {
        o.downT = 1.3; o.kickCd = 1.3;
        this.kickBall(me, sl.vx, sl.vz, 4, 0.5);   // le ballon part devant
        g.sfx('bump'); g.ui.toast('🦵 Tacle réussi ! Il est par terre.', 'good', 1100);
      } else g.ui.toast('Raté : il a sauté par-dessus ton tacle !', 'bad', 1000);
    }
    if (sl.t <= 0) { s.slide = null; P.external = false; }
  }

  // Dribble : crochet + petite accélération, le ballon poussé un peu plus loin ; les tacles ratent plus souvent.
  dribble() {
    const s = this.s, me = s && this.me(), g = this.g;
    if (!s || s.ball.owner !== me || (me.dribbleCd || 0) > 0) return;
    me.dribbleCd = 1.1; me.dribbleT = 0.7;
    const side = Math.random() < 0.5 ? -1 : 1, f = fwd(me.yaw);
    g.player.teleport(me.pos.x + f.z * side * 0.9, me.pos.z - f.x * side * 0.9, me.yaw + side * 0.35);
    g.player.vel.set(f.x * 7, 0, f.z * 7);
    g.sfx('whoosh');
    g.labels.bubble(g.player.avatar.root, pickOne(['Crochet !', 'Petit pont !', 'Roulette !', 'Passement de jambes !']), 900);
  }

  // ------------------------------------------------------------------------------ boucle
  update(dt) {
    const s = this.s, g = this.g;
    // supporters : ils bougent un peu, se lèvent aux buts (seulement si on est près du stade)
    const P0 = g.player.pos;
    if (Math.abs(P0.x - PITCH.x) < 120 && Math.abs(P0.z - PITCH.z) < 100) {
      this.cheer = Math.max(0, this.cheer - dt);
      for (const f of this.fans) { f.ph += dt; f.av.update(dt, { speed: 0, grounded: true, pose: this.cheer > 0 || (s && s.mode === 'match' && Math.sin(f.ph * 0.7) > 0.95) ? 'celebrate' : 'sit' }); }
    }
    if (!s) return;
    if (s.mode === 'match') { s.boardT = (s.boardT || 0) - dt; if (s.boardT <= 0) { s.boardT = 1; const left = Math.max(0, (s.until - g.now()) / 1000); this.drawBoard(`${s.score[0]}  -  ${s.score[1]}`, `TOI · ${s.opponent}`, `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`); } }
    const me = this.me(), I = g.input;
    // sortie du terrain = abandon
    if (Math.abs(me.pos.x - PITCH.x) > L + 25 || Math.abs(me.pos.z - PITCH.z) > W + 25 || g.player.zone !== 'world') { this.stop(true); return; }
    // commandes clavier
    if (I.keys.has('KeyJ') || I.keys.has('KeyF')) s.charge += dt; else if (s.charge > 0) this.shoot();
    if (I.pressed('KeyK') || I.pressed('KeyR')) this.pass();
    if (I.pressed('KeyL') || I.pressed('KeyQ')) this.tackle();
    if (I.pressed('Space')) this.dribble();
    for (const a of [me, ...s.actors]) { a.kickCd = Math.max(0, (a.kickCd || 0) - dt); a.tackleCd = Math.max(0, (a.tackleCd || 0) - dt); a.dribbleCd = Math.max(0, (a.dribbleCd || 0) - dt); a.dribbleT = Math.max(0, (a.dribbleT || 0) - dt); }
    if (s.slide) this.slideUpdate(dt);
    if (s.down > 0) { s.down -= dt; g.player.avatar.root.position.copy(me.pos); g.player.avatar.update(dt, { speed: 0, grounded: true, pose: 'down' }); if (s.down <= 0) g.player.external = false; }
    if (s.pause > 0) { s.pause -= dt; for (const a of s.actors) this.animate(a, dt, 0); this.syncBall(); if (s.ball.owner) this.carry(s.ball.owner, dt); this.hud(dt); return; }
    if (s.mode === 'match') for (const a of s.actors) this.think(a, dt);
    else for (const a of s.actors) this.drillActor(a, dt);
    this.physics(dt);
    if (s.mode === 'drill') this.drillLogic(dt);
    this.hud(dt);
  }

  // Conduite de balle : le ballon reste devant les pieds du porteur.
  carry(a, dt) {
    const b = this.s.ball, f = fwd(a.yaw);
    const sp = Math.hypot(a.vel?.x || 0, a.vel?.z || 0);
    const k = 0.62 + sp * 0.05 + ((a.dribbleT || 0) > 0 ? 0.6 : 0);
    b.pos.set(a.pos.x + f.x * k, R, a.pos.z + f.z * k);
    b.vel.set(a.vel?.x || 0, 0, a.vel?.z || 0);
    this.ball.rotation.x += sp * dt * 3;
  }

  physics(dt) {
    const s = this.s, b = s.ball, g = this.g, me = this.me();
    if (b.owner) { this.carry(b.owner, dt); this.syncBall(); this.contest(); return; }
    b.vel.y -= 9.8 * dt;
    b.pos.addScaledVector(b.vel, dt);
    if (b.pos.y < R) { b.pos.y = R; b.vel.y = b.vel.y < -2 ? -b.vel.y * 0.45 : 0; }
    const fr = b.pos.y <= R + 0.01 ? 1.1 : 0.12;
    b.vel.x *= Math.max(0, 1 - fr * dt); b.vel.z *= Math.max(0, 1 - fr * dt);
    this.ball.rotation.x += Math.hypot(b.vel.x, b.vel.z) * dt / R * 0.3;
    // poteaux et barre : rebond simple
    for (const sgn of [-1, 1]) {
      const gx = PITCH.x + sgn * L;
      if (Math.abs(b.pos.x - gx) < 0.3) for (const k of [-1, 1]) if (Math.abs(b.pos.z - (PITCH.z + k * PITCH.goalW / 2)) < 0.3 && b.pos.y < PITCH.goalH) { b.vel.x *= -0.6; g.sfx('bump'); }
    }
    // but ?
    const side = b.pos.x > PITCH.x + L ? 1 : b.pos.x < PITCH.x - L ? -1 : 0;
    if (side) {
      const inGoal = Math.abs(b.pos.z - PITCH.z) < PITCH.goalW / 2 && b.pos.y < PITCH.goalH;
      if (inGoal) { this.goal(side > 0 ? 0 : 1); return; }
      this.out(side);
      return;
    }
    if (Math.abs(b.pos.z - PITCH.z) > W) { b.pos.z = PITCH.z + Math.sign(b.pos.z - PITCH.z) * (W - 0.6); b.vel.set(0, 0, 0); b.pos.y = R; if (s.mode === 'match') { const t = 1 - b.lastTeam; const a = this.nearest(t, b.pos); if (a) { if (a === me) g.player.teleport(b.pos.x, b.pos.z - Math.sign(b.pos.z - PITCH.z) * 0.8, me.yaw); else a.pos.set(b.pos.x, 0, b.pos.z); this.giveBall(a); s.pause = 0.6; g.ui.toast('Touche', '', 800); } } }
    // prise de balle
    const pickers = [me, ...s.actors];
    const sp = Math.hypot(b.vel.x, b.vel.z);
    for (const a of pickers) {
      if (a.kickCd > 0 || a.static) continue;
      const d = Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z);
      const reach = a.role === 'gk' && Math.abs(a.pos.x - this.goalX(1 - a.team)) < 6 ? 1.3 + a.str * 0.9 : a === me ? 1.0 : 0.85;
      if (d < reach && b.pos.y < (a.role === 'gk' ? 2.5 : 0.9) && (sp < 14 || a.role === 'gk')) {
        if (a.role === 'gk' && sp > 9 && Math.random() > 0.35 + a.str * 0.5) { a.kickCd = 0.5; continue; }   // le gardien rate l'arrêt
        if (a.role === 'gk' && sp > 9) { g.ui.toast('🧤 Arrêt du gardien !', '', 1200); a.saveT = 0.8; }
        this.giveBall(a);
        if (s.mode === 'drill' && s.drill === 'tirs' && a.role === 'gk') { a.hasSaved = true; }
        break;
      }
    }
    this.syncBall();
  }

  // Duel : un adversaire collé au porteur peut lui prendre le ballon.
  contest() {
    const s = this.s, b = s.ball, o = b.owner, g = this.g;
    if (s.mode !== 'match' || !o) return;
    for (const a of s.actors) {
      if (a.team === o.team || a.tackleCd > 0 || a.role === 'gk') continue;
      if (Math.hypot(a.pos.x - o.pos.x, a.pos.z - o.pos.z) > 1.3) continue;
      a.tackleCd = 1.4 - a.str * 0.6;
      a.slideT = 0.55;   // tacle glissé visible
      const dribble = o.ai ? o.str * 100 : g.profile.sports.foot.skills.dribble;
      const immune = (o.dribbleT || 0) > 0 ? 0.25 : 0;
      if (Math.random() < 0.3 + a.str * 0.4 - dribble / 300 - immune) {
        this.giveBall(a); o.kickCd = 0.8;
        if (!o.ai) { g.ui.toast('😵 Tacle ! Tu es par terre.', 'bad', 1000); this.s.down = 0.9; g.player.external = true; g.sfx('bump'); }
        else o.downT = 1.0;
        return;
      }
    }
  }

  nearest(team, p, skipGk = true) {
    const s = this.s, me = this.me();
    let best = null, bd = Infinity;
    for (const a of [me, ...s.actors]) { if (a.team !== team || (skipGk && a.role === 'gk') || a.static) continue; const d = Math.hypot(a.pos.x - p.x, a.pos.z - p.z); if (d < bd) { bd = d; best = a; } }
    return best;
  }

  goal(team) {
    const s = this.s, g = this.g;
    if (s.mode === 'drill') { if (s.drill === 'tirs') { s.score++; g.sfx('success'); g.ui.toast(`⚽ BUT ! (${s.score})`, 'good', 1200); setTimeout(() => this.s === s && this.nextShot(), 900); s.ball.vel.set(0, 0, 0); s.ball.pos.set(PITCH.x - L - 1, R, PITCH.z); s.shotAt = 0; } return; }
    s.score[team]++;
    this.cheer = 3.5;
    const scorer = s.ball.last;
    if (team === 0 && scorer && !scorer.ai) s.myGoals++;
    g.sfx(team === 0 ? 'success' : 'fail');
    g.ui.toast(`⚽ BUT ${team === 0 ? 'pour ton équipe' : `de ${s.opponent}`} ! ${scorer?.name || ''} · ${s.score[0]} - ${s.score[1]}`, team === 0 ? 'good' : 'bad', 3000);
    for (const a of s.actors) if (a.team === team) a.celebrate = 2.5;
    s.ball.vel.set(0, 0, 0); s.ball.owner = null;
    s.pause = 2.5;
    setTimeout(() => { if (this.s === s) this.kickoff(1 - team); }, 2400);
  }

  out(side) {
    const s = this.s, b = s.ball, g = this.g;
    if (s.mode === 'drill') { if (s.drill === 'tirs') { s.ball.vel.set(0, 0, 0); s.ball.pos.set(PITCH.x - L - 2, R, PITCH.z); g.ui.toast('À côté !', 'bad', 800); setTimeout(() => this.s === s && this.nextShot(), 700); s.shotAt = 0; } else { b.pos.x = PITCH.x + side * (L - 1); b.vel.set(0, 0, 0); } return; }
    // sortie de but : six mètres pour le gardien qui défend ce côté
    const team = side > 0 ? 1 : 0;
    const gk = s.actors.find((a) => a.team === team && a.role === 'gk');
    b.vel.set(0, 0, 0); b.pos.set(PITCH.x + side * (L - 3), R, PITCH.z);
    if (gk) { gk.pos.set(PITCH.x + side * (L - 2.5), 0, PITCH.z); this.giveBall(gk); gk.holdT = 1; }
    s.pause = 0.8;
    g.ui.toast('Sortie de but', '', 800);
  }

  // IA d'un joueur PNJ (match)
  think(a, dt) {
    const s = this.s, b = s.ball, me = this.me();
    const d = this.dir(a.team), oppGoal = { x: this.goalX(a.team), z: PITCH.z }, ownGoalX = this.goalX(1 - a.team);
    const speed = 5.2 + a.str * 2.6;
    let tx = a.home.x, tz = a.home.z, run = 0.75;
    if (a.celebrate > 0) { a.celebrate -= dt; this.animate(a, dt, 0, 'celebrate'); return; }
    if (a.downT > 0) { a.downT -= dt; this.animate(a, dt, 0, 'down'); return; }
    if (a.slideT > 0) { a.slideT -= dt; const f = fwd(a.yaw); a.pos.x += f.x * 7 * dt; a.pos.z += f.z * 7 * dt; this.animate(a, dt, 0, 'slide'); return; }
    // passe reçue : le coéquipier visé vient chercher le ballon
    if (!b.owner && b.target === a) { this.steer(a, b.pos.x + b.vel.x * 0.25, b.pos.z + b.vel.z * 0.25, 7 + a.str * 2, dt); return; }
    if (b.owner === a) {
      a.holdT = (a.holdT || 0) - dt;
      if (a.role === 'gk') { if (a.holdT > 0) { this.animate(a, dt, 0); return; } const t = this.bestMate(a); if (t) this.aiKick(a, t.pos.x - a.pos.x, t.pos.z - a.pos.z, 18, 4); else this.aiKick(a, d, 0, 20, 6); return; }
      const gd = Math.hypot(oppGoal.x - a.pos.x, oppGoal.z - a.pos.z);
      const press = [me, ...s.actors].some((o) => o.team !== a.team && Math.hypot(o.pos.x - a.pos.x, o.pos.z - a.pos.z) < 2.6);
      if (gd < 13 + a.str * 8 && a.kickCd <= 0) {
        const tz2 = PITCH.z + (Math.random() < 0.5 ? -1 : 1) * (PITCH.goalW / 2 - 0.8);
        const ang = Math.atan2(oppGoal.x - a.pos.x, tz2 - a.pos.z) + (1 - a.str) * 0.3 * (Math.random() * 2 - 1);
        this.aiKick(a, Math.sin(ang), Math.cos(ang), 16 + a.str * 9, 2 + Math.random() * 3);
        return;
      }
      if (press && a.kickCd <= 0 && Math.random() < dt * (1.5 + a.str * 2)) { const t = this.bestMate(a); if (t) { const dd = Math.hypot(t.pos.x - a.pos.x, t.pos.z - a.pos.z); const ang = Math.atan2(t.pos.x - a.pos.x, t.pos.z - a.pos.z) + (1 - a.str) * 0.15 * (Math.random() * 2 - 1); this.aiKick(a, Math.sin(ang), Math.cos(ang), clamp(7 + dd * 0.55, 8, 20), 0.3); return; } }
      tx = oppGoal.x; tz = PITCH.z + Math.sin(performance.now() / 600 + a.home.z) * 5; run = 0.8;
    } else if (a.role === 'gk') {
      tx = ownGoalX - d * 1.2; tz = clamp(b.pos.z, PITCH.z - PITCH.goalW / 2 + 0.4, PITCH.z + PITCH.goalW / 2 - 0.4);
      if (!b.owner && Math.abs(b.pos.x - ownGoalX) < 9 && Math.hypot(b.vel.x, b.vel.z) < 6) { tx = b.pos.x; tz = b.pos.z; run = 1; }
    } else {
      const myTeamHas = b.owner && b.owner.team === a.team;
      const chaser = this.nearest(a.team, b.pos);
      if (!myTeamHas && chaser === a) { tx = b.pos.x + b.vel.x * 0.3; tz = b.pos.z + b.vel.z * 0.3; run = 1; }
      else {
        const push = myTeamHas ? L * 0.3 : -L * 0.05;
        tx = a.home.x + d * push + (b.pos.x - PITCH.x) * 0.35; tz = a.home.z + (b.pos.z - PITCH.z) * 0.35;
        // second défenseur : marque le porteur adverse
        if (!myTeamHas && b.owner && a.role === 'def' && Math.abs(b.pos.x - ownGoalX) < L * 0.8) { tx = (b.pos.x + ownGoalX) / 2; tz = b.pos.z; run = 0.9; }
      }
    }
    tx = clamp(tx, PITCH.x - L - 1, PITCH.x + L + 1); tz = clamp(tz, PITCH.z - W - 1, PITCH.z + W + 1);
    this.steer(a, tx, tz, speed * run, dt);
  }

  bestMate(a) {
    const s = this.s, d = this.dir(a.team);
    let best = null, bs = -Infinity;
    for (const t of [this.me(), ...s.actors]) {
      if (t === a || t.team !== a.team || t.role === 'gk') continue;
      const open = Math.min(...[this.me(), ...s.actors].filter((o) => o.team !== a.team).map((o) => Math.hypot(o.pos.x - t.pos.x, o.pos.z - t.pos.z)));
      const sc = (t.pos.x - a.pos.x) * d * 0.15 + Math.min(open, 8) - Math.hypot(t.pos.x - a.pos.x, t.pos.z - a.pos.z) * 0.05 + (t.ai ? 0 : 1.5);
      if (sc > bs) { bs = sc; best = t; }
    }
    return best;
  }

  aiKick(a, dx, dz, speed, lift) { a.yaw = Math.atan2(dx, dz); this.kickBall(a, dx, dz, speed, lift); }

  steer(a, tx, tz, speed, dt) {
    const dx = tx - a.pos.x, dz = tz - a.pos.z, d = Math.hypot(dx, dz);
    let vx = 0, vz = 0;
    if (d > 0.4) { const v = Math.min(speed, d * 3); vx = dx / d * v; vz = dz / d * v; }
    // séparation : ne pas s'empiler
    for (const o of [this.me(), ...this.s.actors]) { if (o === a) continue; const ox = a.pos.x - o.pos.x, oz = a.pos.z - o.pos.z, od = Math.hypot(ox, oz); if (od > 0.01 && od < 1.2) { vx += ox / od * 2; vz += oz / od * 2; } }
    a.vel.set(vx, 0, vz);
    a.pos.x += vx * dt; a.pos.z += vz * dt;
    const sp = Math.hypot(vx, vz);
    if (sp > 0.3) { const ty = Math.atan2(vx, vz); let dy = ty - a.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; a.yaw += dy * Math.min(1, dt * 10); }
    this.animate(a, dt, sp);
  }

  animate(a, dt, sp, pose) {
    if (a.pos.y === undefined) return;
    a.av.root.position.set(a.pos.x, 0, a.pos.z);
    a.av.root.rotation.y = a.yaw;
    a.av.update(dt, { speed: sp, grounded: true, pose: pose || (a.wave ? 'wave' : a.saveT > 0 ? 'celebrate' : undefined) });
    if (a.saveT > 0) a.saveT -= dt;
  }

  syncBall() { this.ball.position.copy(this.s.ball.pos); }

  // ------------------------------------------------------------------------------ entraînements
  drillActor(a, dt) {
    const s = this.s, b = s.ball;
    if (a.role === 'gk') {
      if (b.owner === a) { a.holdT = (a.holdT || 0) + dt; if (a.holdT > 0.8) { a.holdT = 0; b.owner = null; b.vel.set(0, 0, 0); b.pos.set(a.pos.x + 1.5, R, a.pos.z); setTimeout(() => this.s === s && this.nextShot(), 400); } this.animate(a, dt, 0); return; }
      const tz = clamp(b.pos.z + b.vel.z * 0.25, PITCH.z - PITCH.goalW / 2 + 0.3, PITCH.z + PITCH.goalW / 2 - 0.3);
      this.steer(a, a.home.x, tz, 4 + a.str * 4, dt);
      return;
    }
    if (a.static) {
      // coéquipier immobile : il renvoie le ballon
      if (b.owner === a) { a.holdT = (a.holdT || 0) + dt; if (a.holdT > 0.7) { a.holdT = 0; const me = this.me(); this.aiKick(a, me.pos.x - a.pos.x, me.pos.z - a.pos.z, clamp(6 + Math.hypot(me.pos.x - a.pos.x, me.pos.z - a.pos.z) * 0.5, 7, 16), 0.3); } }
      this.animate(a, dt, 0);
    }
  }

  drillLogic() {
    const s = this.s, g = this.g, me = this.me(), b = s.ball, now = g.now();
    const elapsed = (now - s.t0) / 1000;
    if (s.drill === 'tirs') {
      if (s.shotAt && now - s.shotAt > 3500) { s.shotAt = 0; this.nextShot(); }
    } else if (s.drill === 'slalom') {
      const gt = s.gates[s.gi];
      if (gt && b.owner === me && Math.hypot(me.pos.x - gt.x, me.pos.z - gt.z) < 2.2) { s.gi++; g.sfx('beep'); this.cones.children[s.gi - 1].material = new THREE.MeshStandardMaterial({ color: '#2ec4b6' }); }
      if (!b.owner && Math.hypot(b.vel.x, b.vel.z) < 0.5 && Math.hypot(me.pos.x - b.pos.x, me.pos.z - b.pos.z) > 3) { s.lost = (s.lost || 0) + 1; this.giveBall(me); g.ui.toast('Ballon perdu : on reprend (pénalité).', 'bad', 900); }
      if (s.gi >= s.gates.length || elapsed > 60) { s.score = Math.round(clamp((s.gi / s.gates.length) * 6 + (s.gi >= s.gates.length ? clamp((45 - elapsed) / 5, 0, 4) : 0) - (s.lost || 0), 0, 10)); this.finishDrill(); }
    } else if (s.drill === 'passes') {
      const t = s.targets[s.lit];
      if (b.owner === t) { s.passes++; s.score++; g.sfx('success'); this.lightTarget(); }
      else if (b.owner && b.owner !== me && b.owner.static) { /* mauvais coéquipier : il renvoie */ }
      if (!b.owner && Math.hypot(b.vel.x, b.vel.z) < 0.3 && Math.hypot(me.pos.x - b.pos.x, me.pos.z - b.pos.z) > 4 && !s.targets.some((a) => Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z) < 2)) this.giveBall(me);
      if (s.score >= DRILLS.passes.max || elapsed > 70) this.finishDrill();
    } else if (s.drill === 'sprints') {
      const tz = s.side > 0 ? PITCH.z + W - 1 : PITCH.z - W + 1;
      if (Math.abs(me.pos.z - tz) < 1.5) { s.runs.push((now - s.runT) / 1000); s.runT = now; s.side = -s.side; g.sfx('beep'); }
      if (s.runs.length >= 6 || elapsed > 90) { const avg = s.runs.length ? s.runs.reduce((x, y) => x + y, 0) / s.runs.length : 99; s.score = Math.round(clamp(10 - (avg - 4.6) * 2.2, 0, 10) * (s.runs.length / 6)); this.finishDrill(); }
    }
  }

  async finishDrill() {
    const s = this.s, g = this.g;
    if (!s || s.ending) return;
    s.ending = true;
    const drill = s.drill, score = s.score;
    // l'autorité impose une durée minimale
    const wait = Math.max(0, DRILLS[drill].min * 1000 - (g.now() - s.t0) + 300);
    if (wait) await new Promise((r) => setTimeout(r, Math.min(wait, 16000)));
    this.cleanup();
    const r = await req(g, 'foot.drillEnd', { score });
    if (!r) return;
    g.sfx('levelup');
    g.ui.dialog({ name: 'Coach Jean-Mich', role: this.pitch?.name || 'Stade des Crampons', text: `${DRILLS[drill].name} : ${r.score}/${DRILLS[drill].max}. ${FOOT_SKILLS[r.skill]} → ${Math.round(r.value)}/100, endurance ${r.endurance}/100.${r.tired ? ' (Tu enchaînes beaucoup : fais une pause, les progrès sont réduits.)' : ''} Encore une ?`, choices: [
      { label: '🔁 Recommencer', action: (m) => { m.close(); this.startDrill(drill); } },
      { label: 'Ça ira', ghost: true, action: (m) => m.close() },
    ] });
  }

  // ------------------------------------------------------------------------------ affichage
  hud(dt) {
    const s = this.s, g = this.g;
    s.hudT -= dt;
    if (s.hudT > 0) return;
    s.hudT = 0.2;
    const btn = { label: s.mode === 'match' ? 'Abandonner' : 'Arrêter', onclick: () => this.stop(true) };
    if (s.mode === 'match') {
      const left = Math.max(0, (s.until - g.now()) / 1000), M = MATCHES[s.kind];
      const minute = Math.min(90, Math.floor((1 - left / (M.mins * 60)) * 90));
      g.hud.track('foot', { title: `⚽ Toi ${s.score[0]} - ${s.score[1]} ${s.opponent}`, timer: fmtT(left), text: `${minute}e minute · ${s.ball.owner ? (s.ball.owner.team === 0 ? `ballon : ${s.ball.owner.name}` : `ballon à ${s.opponent}`) : 'ballon libre'}${s.charge > 0 ? ` · frappe ${Math.round(clamp(s.charge / 0.8, 0, 1) * 100)} %` : ''}`, button: btn });
      if (left <= 0 && !s.ending) this.endMatch();
    } else {
      const el = (g.now() - s.t0) / 1000;
      const txt = s.drill === 'tirs' ? `Buts : ${s.score} · ballons restants : ${s.balls + (s.shotAt || s.ball.owner === null ? 0 : 1)}` : s.drill === 'slalom' ? `Portes : ${s.gi}/${s.gates.length}` : s.drill === 'passes' ? `Passes réussies : ${s.score}/${DRILLS.passes.max}` : `Sprints : ${s.runs.length}/6${s.runs.length ? ` · dernier ${s.runs.at(-1).toFixed(1)} s` : ''} · va vers le plot ${s.side > 0 ? 'en face' : 'de départ'}`;
      g.hud.track('foot', { title: `${DRILLS[s.drill].icon} ${DRILLS[s.drill].name}`, timer: fmtT(el), text: txt, button: btn });
    }
  }

  async endMatch(abandon = false) {
    const s = this.s, g = this.g;
    if (!s || s.ending) return;
    s.ending = true;
    g.sfx('whistle');
    const res = { gf: s.score[0], ga: s.score[1], goals: s.myGoals, abandon };
    this.cleanup();
    const r = await req(g, 'foot.matchEnd', res);
    if (!r) return;
    const t = { victoire: '🏆 Victoire !', nul: '🤝 Match nul.', defaite: '😞 Défaite.', forfait: '🏳️ Abandon (compté comme défaite).' }[r.result];
    g.sfx(r.result === 'victoire' ? 'levelup' : 'fail');
    g.ui.dialog({ name: 'Coach Jean-Mich', role: 'Fin du match', text: `${t} ${r.gf} - ${r.ga}.${r.goals ? ` Tu as marqué ${r.goals} but(s) !` : ''}${r.prize ? ` Prime : ${r.prize} PC.` : ''}${r.xp ? ` +${r.xp} XP foot (niveau ${r.level}).` : ''}`, choices: [{ label: 'OK', ghost: true, action: (m) => m.close() }] });
  }

  stop(abandon) {
    const s = this.s;
    if (!s) return;
    if (s.mode === 'match') this.endMatch(abandon);
    else { this.cleanup(); this.g.net.request('foot.drillEnd', { score: 0 }).catch(() => null); }
  }

  cleanup() {
    const s = this.s, g = this.g;
    if (!s) return;
    this.s = null;
    for (const a of s.actors) { g.engine.scene.remove(a.av.root); a.av.dispose?.(); g.labels.remove?.(a.lab); }
    this.ball.visible = false;
    this.cones.clear();
    this.buttons?.remove();
    g.player.speedBonus = s.speedBonus ?? 1;
    g.player.noJump = false; g.player.external = false;
    g.hud.track('foot', null);
    this.drawBoard('STADE', 'DES CRAMPONS', s.mode === 'match' ? `Dernier score : ${s.score[0]} - ${s.score[1]}` : '');
  }
}
