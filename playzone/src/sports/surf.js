import * as THREE from 'three';
import { h, fmt } from '../ui/dom.js';
import { WATER_LEVEL, BUILDING_BY_ID } from '../../shared/world-layout.js';
import { SURF, BOARDS, RENTAL, CONTEST, swell, swellLabel, wavesAt, waveAt, waterHeight, faceSlope, shoulderDist, sideFade, bestBoard } from '../../shared/surf.js';
import { Wake } from './wake.js';
import { careerToast } from './races.js';

// SURF à la Plage des Orteils : des vagues arrivent du large et déferlent sur le récif.
//  - on RAME (Avant) vers le large ou vers la plage, gauche / droite pour tourner ;
//  - quand une vague arrive derrière toi, rame vers la plage et appuie sur ESPACE pour décoller ;
//  - sur la vague : gauche / droite pour descendre ou remonter la face, file le long de l'épaule
//    juste devant la partie qui casse (« la poche ») : c'est là que ça va vite et que ça rapporte ;
//  - entre dans la mousse qui casse = tube (énorme bonus) mais attention à la chute ;
//  - remonte vite vers la crête = aerial ; en l'air, gauche / droite = rotations.
const req = async (g, t, p) => { try { return await g.net.request(t, p); } catch (e) { g.ui.toast(e.message, 'bad', 4500); g.sfx('error'); return null; } };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const MAXW = 4;

export class Surf {
  constructor(g) {
    this.g = g;
    this.s = null;
    this.waves = [];
    this.buildSea();
    this.board = this.buildBoard();
    this.board.visible = false;
    g.engine.scene.add(this.board);
    this.wake = new Wake(g.engine.scene, { width: 0.7, y: WATER_LEVEL + 0.05 });
    g.interactions.add({
      x: SURF.school.x, z: SURF.school.z, r: 3.2, priority: 4,
      enabled: () => !this.s && g.player.zone === 'world',
      label: () => '🏄 École de surf (vagues, cours, compétition)',
      action: () => this.desk(BUILDING_BY_ID['surf-school']),
    });
  }

  // ------------------------------------------------------------------ décor : la mer qui ondule
  buildSea() {
    const W = SURF.x2 - SURF.x1 + 70, D = SURF.zSpawn - SURF.zShore + 30;
    const geo = new THREE.PlaneGeometry(W, D, 110, 150).rotateX(-Math.PI / 2);
    this.uWaves = Array.from({ length: MAXW }, () => new THREE.Vector4(0, 0, 0, -1));
    this.seaMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uW: { value: this.uWaves }, uT: { value: 0 }, uX1: { value: SURF.x1 }, uX2: { value: SURF.x2 }, uSun: { value: new THREE.Vector3(0.4, 0.8, 0.3).normalize() } },
      vertexShader: `
        uniform vec4 uW[${MAXW}]; uniform float uT, uX1, uX2;
        varying float vH; varying float vFoam; varying float vSlope; varying vec3 vWorld;
        float prof(float d, float H) {
          float fr = 4.0 + H * 2.2, bk = 12.0 + H * 3.0;
          if (d < 0.0) { float u = max(0.0, 1.0 + d / fr); return u * u * (3.0 - 2.0 * u); }
          return exp(-(d / bk) * (d / bk) * 2.2);
        }
        float side(float x) { return clamp(min((x - uX1 + 25.0) / 25.0, (uX2 + 25.0 - x) / 25.0), 0.0, 1.0); }
        float height(vec2 p, out float foam) {
          float y = 0.0; foam = 0.0;
          for (int i = 0; i < ${MAXW}; i++) {
            vec4 w = uW[i]; if (w.y <= 0.0) continue;
            float d = p.y - w.x, v = w.y * prof(d, w.y);
            if (v > y) y = v;
            // mousse : partie cassée de la vague (et juste derrière), crête qui se forme
            if (w.w >= 0.0 && abs(p.x - w.z) < w.w && d > -(4.0 + w.y * 2.2) * 0.8 && d < 9.0) foam = max(foam, 0.85 - max(0.0, d) / 12.0);
            if (abs(d) < 1.2 && w.y > 0.9) foam = max(foam, 0.35 * (w.y - 0.9));
          }
          return y * side(p.x);
        }
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          float f0, f1, f2;
          float y = height(wp.xz, f0);
          float yz = height(wp.xz + vec2(0.0, 0.6), f1), yx = height(wp.xz + vec2(0.6, 0.0), f2);
          vSlope = length(vec2(yx - y, yz - y)) / 0.6;
          y += sin(wp.x * 0.35 + uT * 1.3) * 0.04 + sin(wp.z * 0.27 - uT * 1.1) * 0.04;
          wp.y += y; vH = y; vFoam = f0 * side(wp.x); vWorld = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: `
        varying float vH; varying float vFoam; varying float vSlope; varying vec3 vWorld; uniform float uT;
        void main() {
          vec3 deep = vec3(0.05, 0.36, 0.55), shallow = vec3(0.18, 0.72, 0.78);
          vec3 c = mix(deep, shallow, clamp(vH * 0.45 + vSlope * 0.6, 0.0, 1.0));
          float n = fract(sin(dot(floor(vWorld.xz * 2.0), vec2(12.9898, 78.233))) * 43758.5453);
          float foam = clamp(vFoam * (0.75 + 0.35 * n), 0.0, 1.0);
          c = mix(c, vec3(0.96, 0.98, 1.0), foam);
          float a = clamp(vH * 3.0 + foam, 0.0, 0.92);
          if (a < 0.02) discard;
          gl_FragColor = vec4(c, a);
        }`,
    });
    this.sea = new THREE.Mesh(geo, this.seaMat);
    this.sea.position.set((SURF.x1 + SURF.x2) / 2, WATER_LEVEL + 0.03, (SURF.zShore + SURF.zSpawn) / 2 + 5);
    this.sea.frustumCulled = false;
    this.sea.renderOrder = 2;
    this.g.engine.scene.add(this.sea);
  }

  buildBoard() {
    const root = new THREE.Group();
    const shape = new THREE.Shape();
    shape.moveTo(-0.24, -0.95); shape.quadraticCurveTo(0, -1.05, 0.24, -0.95); shape.quadraticCurveTo(0.32, 0.1, 0.16, 0.85); shape.quadraticCurveTo(0, 1.12, -0.16, 0.85); shape.quadraticCurveTo(-0.32, 0.1, -0.24, -0.95);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.07, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.025, bevelSegments: 2 }).rotateX(-Math.PI / 2);
    this.boardMat = new THREE.MeshStandardMaterial({ color: '#ffbe0b', roughness: 0.4 });
    const b = new THREE.Mesh(geo, this.boardMat); root.add(b);
    const stringer = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.105, 1.9), new THREE.MeshStandardMaterial({ color: '#6b4226' })); stringer.position.y = 0.0; root.add(stringer);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.14), new THREE.MeshStandardMaterial({ color: '#2b2d42' })); fin.position.set(0, -0.1, -0.85); root.add(fin);
    return root;
  }

  // la mer bouge même quand on ne surfe pas (on voit les vagues depuis la plage)
  tick(ts) {
    const sw = swell(this.g.now());
    this.waves = wavesAt(ts, sw);
    for (let k = 0; k < MAXW; k++) {
      const w = this.waves[k];
      if (w) this.uWaves[k].set(w.zc, w.H, w.peak, w.half); else this.uWaves[k].set(0, 0, 0, -1);
    }
    this.seaMat.uniforms.uT.value = ts;
  }

  // ------------------------------------------------------------------ école de surf
  desk(b) {
    const g = this.g, S = g.profile.sports?.surf || {}, board = bestBoard(g.profile.inventory);
    const H = swell(g.now());
    g.ui.dialog({ name: 'Moana, monitrice de surf', role: b?.name || 'École de surf des Orteils', text: `Houle du moment : ${H.toFixed(1).replace('.', ',')} m (${swellLabel(H)}). ${board ? `Ta planche : ${BOARDS[board].name}.` : S.trial ? `Location de planche : ${RENTAL.price} PC.` : 'Premier cours OFFERT avec une planche en mousse !'} Rame avec Avant, décolle avec ESPACE quand la vague te soulève, puis file le long de la vague juste devant la mousse.`, choices: [
      { label: '🏄 Session libre', action: (m) => { m.close(); this.start('libre'); } },
      { label: `🏆 Compétition : 2 meilleures vagues en 4 min (${CONTEST.fee} PC)`, action: (m) => { m.close(); this.start('contest'); } },
      { label: '🛒 Acheter une planche', action: (m) => { m.close(); import('../ui/shop.js').then(({ openShop }) => openShop(g, 'surf', BUILDING_BY_ID['surf-shop'])); } },
      { label: `📊 Mes stats (niveau ${Math.round(S.skill || 5)}/100)`, action: (m) => m.show(`Sessions : ${S.sessions || 0} · vagues surfées : ${S.waves || 0} · meilleure vague : ${fmt(S.bestWave || 0)} pts · compétitions : ${S.contests || 0} (${S.wins || 0} victoires).`, [{ label: 'OK', ghost: true, action: (x) => x.close() }]) },
      { label: 'Au revoir', ghost: true, action: (m) => m.close() },
    ] });
  }

  async start(mode) {
    const g = this.g, P = g.player;
    if (this.s || g.vehicles?.current) return;
    const r = await req(g, 'surf.start', { mode });
    if (!r) return;
    const st = r.stats, x = clamp(P.pos.x, SURF.x1 + 10, SURF.x2 - 10);
    this.boardMat.color.set({ 'surf-mousse': '#ffbe0b', 'surf-long': '#f4f1ea', 'surf-fish': '#3a86ff', 'surf-short': '#e63946' }[r.board] || '#ffbe0b');
    this.s = { mode, st, x, z: SURF.zShore + 6, yaw: 0, v: 0, state: 'paddle', f: 0, wave: null, y: 0, vy: 0, spin: 0, spin0: 0, score: 0, scores: [], airs: 0, tubes: 0, tube: 0, wipe: 0, stamina: 1, hudT: 0, t0: g.now(), turnAcc: 0, turnT: 0, field: r.field, skill: r.skill, rides: 0 };
    P.external = true;
    this.board.visible = true;
    this.buttons = h('div.foot-btns',
      h('button', { onpointerdown: (e) => { e.preventDefault(); this.takeoff(); } }, '🌊 Décoller (Espace)'),
      h('button', { onpointerdown: (e) => { e.preventDefault(); this.stop(); } }, '🏖️ Plage'));
    g.ui.root.append(this.buttons);
    g.sfx('whoosh');
    g.ui.toast(`🏄 ${r.trial ? 'Cours gratuit ! ' : r.paid ? `-${r.paid} PC. ` : ''}${BOARDS[r.board].name}. Rame vers le large (Avant), retourne-toi vers la plage quand une vague arrive, rame et ESPACE pour décoller !${mode === 'contest' ? ' Compétition : tes 2 meilleures vagues comptent, 4 minutes !' : ''}`, 'event', 8000);
  }

  // tentative de décollage sur la vague qui arrive
  takeoff() {
    const s = this.s, g = this.g;
    if (!s || s.state !== 'paddle') return;
    const toShore = -Math.cos(s.yaw);
    let best = null;
    for (const w of this.waves) {
      const d = s.z - w.zc, front = 4 + w.H * 2.2;
      if (d < -front * (0.95 * s.st.takeoff) || d > 1.5 * s.st.takeoff) continue;
      if (w.zc > SURF.zBreak + 30 || w.H < 0.45 || sideFade(s.x) < 0.5) continue;
      if (shoulderDist(w, s.x) < -2.5) continue;   // en plein dans la mousse : impossible
      best = w; break;
    }
    if (!best) { g.ui.toast(this.waves.some((w) => w.zc - s.z > 2 && w.zc - s.z < 40) ? '⏳ Trop tôt : attends que la vague te soulève (elle doit être juste derrière toi).' : '🌊 Pas de vague ici : regarde vers le large et attends la prochaine série.', '', 2200); return; }
    if (toShore < 0.25) { g.ui.toast('↩️ Tourne-toi vers la plage avant de décoller !', '', 1800); return; }
    if (s.v < 0.9 / s.st.takeoff) { g.ui.toast('💪 Rame plus fort (Avant) pour prendre la vague !', '', 1800); return; }
    s.state = 'ride'; s.wave = best.i; s.f = Math.max(0.4, best.zc - s.z); s.v = 4 + best.H * 1.6; s.score = 0; s.tube = 0;
    g.sfx('whoosh');
    g.ui.toast(`🌊 Debout ! Vague de ${best.H.toFixed(1).replace('.', ',')} m : file le long de la vague, devant la mousse !`, 'good', 2500);
  }

  endRide(msg, keep = 1) {
    const s = this.s, g = this.g;
    const pts = Math.round(s.score * keep);
    if (pts >= 40) { s.scores.push(Math.min(3000, pts)); s.rides++; }
    s.state = 'paddle'; s.wave = null; s.v = Math.min(s.v, 1.2); s.y = 0;
    g.ui.toast(`${msg}${pts >= 40 ? ` · vague notée ${fmt(pts)} pts` : ''}`, pts >= 600 ? 'good' : '', 2600);
    if (pts >= 1500) g.sfx('levelup'); else if (pts >= 40) g.sfx('success');
  }

  wipeout(msg) {
    const s = this.s, g = this.g;
    s.score *= 0.6;
    this.endRide(`💦 ${msg}`, 1);
    s.state = 'wipe'; s.wipe = 2.4; s.v = 0;
    g.sfx('splat');
    g.fx.emit({ x: s.x, y: WATER_LEVEL + 0.4, z: s.z, n: 26, colors: ['#ffffff', '#bfe9ff'], speed: 4, gravity: 9, life: 0.8, size: 0.25 });
  }

  update(dt) {
    const g = this.g;
    // horloge des vagues : avance avec le jeu (et se recale sur l'heure du serveur si elle dérive trop)
    const real = g.now() / 1000;
    this.ts = this.ts == null || Math.abs(this.ts - real) > 40 ? real : this.ts + dt;
    const ts = this.ts;
    this.tick(ts);
    const s = this.s;
    if (!s) return;
    const I = g.input, P = g.player, c = SURF.speed;
    if (I.pressed('Space')) { if (s.state === 'paddle') this.takeoff(); }
    if (s.mode === 'contest' && (g.now() - s.t0) / 1000 > CONTEST.secs) { this.stop('⏱️ Fin de la compétition !'); return; }
    let surface = waterHeight(s.x, s.z, this.waves);
    if (s.state === 'wipe') {
      s.wipe -= dt; s.z -= 2 * dt;   // la mousse te ramène vers le bord
      if (s.wipe <= 0) { s.state = 'paddle'; g.ui.toast('🏄 Remonte sur ta planche et repars !', '', 1500); }
    } else if (s.state === 'paddle') {
      const stroke = I.move.y > 0.1 && s.stamina > 0.05;
      const vmax = 2.5 * s.st.speed * (0.85 + (g.profile.body.endurance ?? 15) / 300);
      s.v += ((stroke ? vmax : 0) - s.v) * Math.min(1, dt * (stroke ? 1.2 : 0.8));
      if (I.move.y < -0.1) s.v = Math.max(0, s.v - dt * 2);
      s.stamina = clamp(s.stamina + (stroke ? -dt * 0.05 : dt * 0.12), 0, 1);
      s.yaw -= I.move.x * 1.9 * dt;
      s.x += Math.sin(s.yaw) * s.v * dt; s.z += Math.cos(s.yaw) * s.v * dt;
      // la mousse d'une vague cassée te repousse vers la plage
      for (const w of this.waves) if (w.broken && shoulderDist(w, s.x) < 0 && Math.abs(s.z - w.zc) < 4) s.z -= 3.2 * dt;
      s.paddleAnim = (s.paddleAnim || 0) + dt * (stroke ? 6 : 0);
    } else if (s.state === 'ride') {
      const w = waveAt(s.wave, ts, swell(g.now()));
      if (!w || w.zc < SURF.zShore + 7) { this.endRide('🏖️ Fin de la vague !'); }
      else {
        const front = 4 + w.H * 2.2, slope = faceSlope(s.f, w.H), down = -Math.cos(s.yaw);
        const prevYaw = s.yaw;
        s.yaw -= I.move.x * s.st.turn * (1.7 + s.v * 0.06) * dt;
        s.turnAcc += Math.abs(wrap(s.yaw - prevYaw)); s.turnT += dt;
        if (s.turnT > 0.7) { if (s.turnAcc > 1.7 && s.v > 5 && s.f < front * 0.4) { const p = Math.round(90 + s.v * 14); s.score += p; g.ui.toast(`🔄 ${down > 0 ? 'Bottom turn' : 'Cutback'} ! +${p}`, '', 1100); } s.turnAcc = 0; s.turnT = 0; }
        // la gravité sur la face : descendre accélère, remonter freine ; la vague pousse aussi
        s.v += (5.2 * slope * down + 1.4 * slope - 0.16 * s.v) * dt;
        s.v = clamp(s.v, 0, 13.5 * s.st.speed);
        const vx = Math.sin(s.yaw) * s.v, vz = Math.cos(s.yaw) * s.v;
        s.f += -vz * dt; s.x += vx * dt;
        s.z = w.zc - s.f;
        const sd = shoulderDist(w, s.x);
        if (s.f > front + 3.5) this.endRide('🌊 Tu es sorti·e devant la vague');
        else if (s.f < 0) {
          if (s.v > 6.2 && Math.cos(s.yaw) > 0.25) { s.state = 'air'; s.vy = Math.min(7.5, s.v * 0.62); s.y = surface + 0.1; s.spin = 0; s.spin0 = s.yaw; s.vzw = vz - c; s.vxw = vx; g.sfx('whoosh'); }
          else this.endRide('🔙 Tu es passé·e derrière la vague');
        } else if (sideFade(s.x) < 0.2) this.endRide('🏁 Bout de la vague');
        else if (s.v < 1.2 && slope < 0.3) this.endRide('😴 La vague t\'a laissé·e sur place');
        else if (sd < -3.2) this.wipeout('La vague t\'a englouti·e !');
        else {
          const tube = sd < 0 && s.f < front * 0.65;
          if (tube) { s.tube += dt; if (s.v < 5.5 && Math.random() < dt * 0.6) { this.wipeout('Écrasé·e dans le tube !'); } }
          else if (s.tube > 0.8) { s.tubes++; const p = Math.round(400 + s.tube * 350); s.score += p; g.ui.toast(`🌀 TUBE de ${s.tube.toFixed(1)} s ! +${p}`, 'good', 2000); g.sfx('levelup'); s.tube = 0; }
          else s.tube = 0;
          if (s.state === 'ride') {
            const pocket = sd >= 0 && sd < 10 ? 2 - sd / 10 : 1;
            s.score += dt * s.v * 7 * pocket * (slope > 0.2 ? 1 : 0.35) * (tube ? 3 : 1);
          }
        }
      }
    } else if (s.state === 'air') {
      s.vy -= 9.8 * dt; s.y += s.vy * dt;
      s.x += s.vxw * dt; s.z += s.vzw * dt;
      const sp = I.move.x * 7 * s.st.spin * dt; s.yaw -= sp; s.spin += Math.abs(sp);
      if (s.y <= surface + 0.05 && s.vy < 0) {
        const spins = Math.floor((s.spin + 0.7) / (Math.PI * 2)), err = Math.abs(wrap(s.yaw - s.spin0 - (s.spin > 0.7 ? 0 : 0)));
        const w = waveAt(s.wave, ts, swell(g.now()));
        if ((s.spin > 0.7 && err > 0.9) || !w) this.wipeout('Réception ratée !');
        else {
          s.airs++; const p = 300 + spins * 450 + Math.round(s.v * 20);
          s.score += p; g.ui.toast(`🛫 AERIAL${spins ? ` ${spins * 360}°` : ''} ! +${p}`, 'good', 2000); g.sfx('success');
          s.state = 'ride'; s.f = Math.max(0.5, w.zc - s.z); s.v *= 0.82; if (Math.cos(s.yaw) > 0) s.yaw = Math.PI - s.yaw * 0.3;
        }
      }
    }
    // limites du spot
    s.x = clamp(s.x, SURF.x1 - 18, SURF.x2 + 18);
    if (s.z < SURF.zShore - 1 && s.state === 'paddle') { this.stop('🏖️ De retour sur la plage.'); return; }
    s.z = Math.min(s.z, SURF.zSpawn + 10);
    surface = waterHeight(s.x, s.z, this.waves);
    // placement de la planche et du surfeur
    const yb = WATER_LEVEL + 0.08 + (s.state === 'air' ? s.y : surface);
    const w = s.wave != null ? this.waves.find((q) => q.i === s.wave) : null;
    const tilt = s.state === 'ride' && w ? -faceSlope(s.f, w.H) * 0.22 * -Math.cos(s.yaw) : 0;
    this.board.position.set(s.x, yb, s.z);
    this.board.rotation.set(tilt, s.yaw, s.state === 'ride' ? -I.move.x * 0.35 : 0, 'YXZ');
    this.board.visible = s.state !== 'wipe';
    this.wake.update(dt);
    if (s.state === 'ride' && s.v > 3) this.wake.push(s.x - Math.sin(s.yaw) * 0.9, s.z - Math.cos(s.yaw) * 0.9, s.yaw, Math.min(1, s.v / 9));
    if (s.state === 'ride' && s.v > 6 && Math.random() < dt * 14) g.fx.emit({ x: s.x - Math.sin(s.yaw) * 0.7, y: yb + 0.1, z: s.z - Math.cos(s.yaw) * 0.7, n: 3, colors: ['#ffffff', '#bfe9ff'], speed: 2.5, gravity: 9, life: 0.5, size: 0.14 });
    P.pos.set(s.x, yb + 0.06, s.z); P.vel.set(0, 0, 0); P.yaw = s.yaw; P.grounded = true; P.swimming = s.state === 'wipe'; P.speed = s.v;
    const av = P.avatar.root;
    const lying = s.state === 'paddle';
    av.position.set(s.x, s.state === 'wipe' ? WATER_LEVEL - 0.9 : yb + (lying ? 0.02 : 0.08), s.z);
    av.rotation.set(0, s.yaw + (s.state === 'ride' || s.state === 'air' ? Math.PI / 2 * 0.85 : 0), s.state === 'ride' ? -I.move.x * 0.25 : 0, 'YXZ');
    if (lying) P.pushPhase = 0.5 + Math.sin(s.paddleAnim || 0) * 0.25;
    P.avatar.update(dt, { speed: 0, grounded: true, swimming: s.state === 'wipe', pose: lying ? 'pushup' : s.state === 'wipe' ? 'idle' : 'guard' });
    // caméra : derrière le surfeur quand il glisse
    if (s.state === 'ride' && !I.look.dx) g.cam.yaw += wrap(s.yaw + Math.PI - g.cam.yaw) * Math.min(1, dt * 1.6);
    // affichage
    s.hudT -= dt;
    if (s.hudT <= 0) {
      s.hudT = 0.25;
      const two = [...s.scores].sort((a, b) => b - a).slice(0, 2).reduce((a, b) => a + b, 0);
      const near = this.waves.filter((q) => q.zc > s.z && q.zc - s.z < 60 && q.H > 0.45).sort((a, b) => a.zc - b.zc)[0];
      const info = s.state === 'paddle' ? (near ? `🌊 vague de ${near.H.toFixed(1).replace('.', ',')} m dans ${Math.max(0, Math.round((near.zc - s.z) / SURF.speed))} s : tourne-toi vers la plage, rame et ESPACE !` : `rame (Avant) · souffle ${Math.round(s.stamina * 100)} %`)
        : s.state === 'ride' ? `🏄 ${Math.round(s.v * 3.6)} km/h · vague ${fmt(Math.round(s.score))} pts${s.tube > 0 ? ' · 🌀 DANS LE TUBE !' : ''}` : s.state === 'air' ? '🛫 en l\'air : gauche / droite pour tourner !' : '💦 sous l\'eau...';
      const left = s.mode === 'contest' ? Math.max(0, CONTEST.secs - (g.now() - s.t0) / 1000) : null;
      g.hud.track('surf', { title: `🏄 Surf${s.mode === 'contest' ? ' · compétition' : ''} · houle ${swell(g.now()).toFixed(1).replace('.', ',')} m`, timer: left != null ? `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}` : undefined, text: `${info} · ${s.scores.length} vague(s) · ${s.mode === 'contest' ? `2 meilleures : ${fmt(two)}` : `meilleure : ${fmt(Math.max(0, ...s.scores))}`}`, button: { label: 'Sortir de l\'eau', onclick: () => this.stop() } });
    }
  }

  async stop(msg = '') {
    const s = this.s, g = this.g;
    if (!s) return;
    if (s.state === 'ride' || s.state === 'air') this.endRide('🏁');
    this.s = null;
    this.board.visible = false;
    this.wake.clear();
    this.buttons?.remove();
    g.hud.track('surf', null);
    const P = g.player;
    P.external = false; P.pushPhase = 0;
    const sc = BUILDING_BY_ID['surf-school'];
    P.teleport(sc.door.x, sc.door.z + 2, Math.PI);
    const r = await req(g, 'surf.end', { waves: s.scores.length, scores: s.scores, airs: s.airs, tubes: s.tubes });
    if (!r) return;
    if (r.needs) g.emit('needs', r.needs);
    careerToast(g, r.career);
    const C = r.contest;
    const text = C && !C.abandon
      ? `${C.place === 1 ? '🥇 VICTOIRE !' : `${C.place}e sur ${C.of}.`} Tes 2 meilleures vagues : ${fmt(C.two)} pts. ${C.prize ? `Prix : ${fmt(C.prize)} PC.` : ''} Les autres : ${C.field.map((f) => `${f.name} ${fmt(f.score)}`).join(', ')}.`
      : `${r.waves} vague(s) surfée(s), meilleure : ${fmt(r.bestWave)} pts.`;
    g.sfx(C?.place === 1 ? 'levelup' : 'success');
    g.ui.dialog({ name: 'Moana', role: 'École de surf', text: `${msg ? `${msg} ` : ''}${text} Niveau de surf : ${Math.round(r.skill)}/100.${r.career ? ` Carrière surf : +${r.career.pts} pts (${r.career.div}).` : ''}`, choices: [{ label: '🏄 Y retourner', action: (m) => { m.close(); this.start(s.mode); } }, { label: 'OK', ghost: true, action: (m) => m.close() }] });
  }
}
