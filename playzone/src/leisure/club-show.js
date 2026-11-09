import * as THREE from 'three';
import { h } from '../ui/dom.js';
import { buildingFrame } from '../world/buildings.js';
import { BEAT } from './nightclub-beat.js';

// SHOW DES BOÎTES DE NUIT (surtout Le Velours) : écran LED géant animé derrière le DJ, murs LED,
// lasers qui balaient la salle, lyres (faisceaux de lumière) sur la structure du plafond, sol
// brillant qui pulse en rythme, stroboscope et canons à confettis sur les « drops », soirées à thème
// selon l'heure. Et la vie de la soirée : ta POPULARITÉ monte quand tu danses, offres des bouteilles,
// fais des selfies... et les filles viennent d'elles-mêmes te parler.
const THEMES = [
  { from: 20, to: 23, name: 'Soirée Néon', icon: '💜', cols: ['#bc00ff', '#39ff14', '#00e5ff', '#ff00aa'] },
  { from: 23, to: 26, name: 'Soirée Paillettes', icon: '✨', cols: ['#ffd700', '#ff006e', '#ffffff', '#8338ec'] },
  { from: 26, to: 29, name: 'Soirée Mousse', icon: '🫧', cols: ['#00b4d8', '#90e0ef', '#ffffff', '#ff70a6'], foam: true },
  { from: 29, to: 44, name: 'Soirée Années 80', icon: '🕺', cols: ['#ff2a6d', '#05d9e8', '#ffbe0b', '#d1f7ff'] },
];
const themeAt = (hour) => { const hh = hour < 12 ? hour + 24 : hour; return THEMES.find((t) => hh >= t.from && hh < t.to) || THEMES[0]; };
const add = (c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

export class ClubShow {
  constructor(g) {
    this.g = g;
    this.b = null;
    this.pop = 0;          // popularité de la soirée (0..100)
    this.approachT = 12;
  }

  build(b) {
    const g = this.g, F = buildingFrame(b), big = b.interior === 'megaclub';
    const W = F.W - 1, D = F.D - 1, H = Math.min(b.h || 8, big ? 11 : 6.5) - 0.6;
    const root = new THREE.Group();
    const at = (lx, y, lz, obj) => { const [x, z] = F.L(lx, lz); obj.position.set(x, y, z); obj.rotation.y = F.th; root.add(obj); return obj; };
    this.theme = themeAt(g.world.dayNight.hour);
    const C = this.theme.cols.map((c) => new THREE.Color(c));
    // --- sol brillant animé (tuiles qui pulsent en rythme), au-dessus du sol du bâtiment
    const n = big ? 26 : 12, cell = (Math.min(W, D) * (big ? 0.62 : 0.6)) / n;
    const tiles = new THREE.InstancedMesh(new THREE.PlaneGeometry(cell * 0.92, cell * 0.92).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }), n * n);
    const m4 = new THREE.Matrix4();
    let k = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const [x, z] = F.L((i - (n - 1) / 2) * cell, (j - (n - 1) / 2) * cell + (big ? 0 : -1)); m4.makeRotationY(F.th); m4.setPosition(x, 0.1, z); tiles.setMatrixAt(k, m4); tiles.setColorAt(k, C[(i + j) % C.length]); k++; }
    tiles.frustumCulled = false; root.add(tiles); this.tiles = { mesh: tiles, n };
    // --- écran LED géant derrière le DJ (texture canvas animée : égaliseur + nom du club)
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 192;
    this.screen = { cv, ctx: cv.getContext('2d'), tex: new THREE.CanvasTexture(cv), name: b.name.replace(/\s*\(.*\)/, '').toUpperCase() };
    const sw = Math.min(W * 0.55, big ? 26 : 9), sh = sw * 0.375;
    at(0, H - sh / 2 - 0.3, -D / 2 + 0.25, new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshBasicMaterial({ map: this.screen.tex, toneMapped: false })));
    // --- murs LED latéraux (bandes verticales qui changent de couleur)
    this.strips = [];
    const ns = big ? 14 : 6;
    for (const s of [-1, 1]) for (let i = 0; i < ns; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.35, H - 1), add(this.theme.cols[i % 4]));
      const [x, z] = F.L(s * (W / 2 - 0.12), -D / 2 + 2 + i * ((D - 4) / (ns - 1)));
      m.position.set(x, (H - 1) / 2 + 0.6, z); m.rotation.y = F.th + Math.PI / 2; root.add(m); this.strips.push(m);
    }
    // --- structure du plafond (truss) et lyres : cônes de lumière qui balaient la salle
    const truss = new THREE.MeshStandardMaterial({ color: '#9aa0a6', metalness: 0.9, roughness: 0.3 });
    for (const lz of [-D * 0.25, 0, D * 0.25]) at(0, H - 0.2, lz, new THREE.Mesh(new THREE.BoxGeometry(W * 0.8, 0.25, 0.25), truss));
    this.beams = [];
    const nb = big ? 14 : 6;
    for (let i = 0; i < nb; i++) {
      const lx = (i / (nb - 1) - 0.5) * W * 0.75, lz = [-D * 0.25, 0, D * 0.25][i % 3];
      const cone = new THREE.Mesh(new THREE.ConeGeometry(big ? 2.4 : 1.4, H - 0.5, 20, 1, true).translate(0, -(H - 0.5) / 2, 0), add(this.theme.cols[i % 4]));
      cone.material.opacity = 0.16;
      const pivot = new THREE.Group(); const [x, z] = F.L(lx, lz); pivot.position.set(x, H - 0.3, z); pivot.add(cone); root.add(pivot);
      this.beams.push({ pivot, ph: i * 0.7 });
    }
    // --- lasers (fins faisceaux depuis la scène)
    this.lasers = [];
    const nl = big ? 16 : 6, [ox, oz] = F.L(0, -D / 2 + 3);
    for (let i = 0; i < nl; i++) {
      const L = big ? 40 : 14;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, L, 4).rotateX(Math.PI / 2).translate(0, 0, L / 2), add(i % 2 ? this.theme.cols[1] : this.theme.cols[0]));
      m.material.opacity = 0.85;
      const pv = new THREE.Group(); pv.position.set(ox, H * 0.6, oz); pv.rotation.y = F.th; pv.add(m); root.add(pv);
      this.lasers.push({ pv, m, ph: i * 0.4 });
    }
    // --- piliers miroir et boules à facettes
    const mirror = new THREE.MeshStandardMaterial({ color: '#dfe7ff', metalness: 1, roughness: 0.08 });
    if (big) for (const [lx, lz] of [[-W * 0.22, -D * 0.12], [W * 0.22, -D * 0.12], [-W * 0.22, D * 0.18], [W * 0.22, D * 0.18]]) at(lx, H / 2, lz, new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, H, 16), mirror));
    this.balls = [];
    for (const lx of big ? [-W * 0.2, 0, W * 0.2] : [0]) { const ball = at(lx, H - 1.2, big ? -2 : -1, new THREE.Mesh(new THREE.IcosahedronGeometry(big ? 0.9 : 0.45, 1), new THREE.MeshStandardMaterial({ color: '#e9ecef', metalness: 1, roughness: 0.12, flatShading: true }))); this.balls.push(ball); }
    // --- lumières colorées réelles (peu nombreuses : coûteuses)
    this.lights = C.slice(0, big ? 4 : 3).map((c, i) => { const l = new THREE.PointLight(c, big ? 18 : 8, big ? 30 : 14, 1.5); root.add(l); return { l, i }; });
    this.strobe = new THREE.PointLight('#ffffff', 0, big ? 60 : 20, 1.2); { const [x, z] = F.L(0, 0); this.strobe.position.set(x, H - 1, z); } root.add(this.strobe);
    this.F = F; this.W = W; this.D = D; this.H = H; this.big = big;
    g.engine.scene.add(root);
    this.root = root;
  }

  enter(b) {
    const g = this.g;
    this.b = b;
    this.build(b);
    this.t = 0; this.lastBeat = -1;
    this.hud = h('div.club-pop', this.popEl = h('b', ''), h('small', `${this.theme.icon} ${this.theme.name}`));
    g.ui.root.append(this.hud);
    this.refreshPop();
    g.ui.note(`${this.theme.icon} Ce soir : ${this.theme.name} !`, 'good', 3500);
  }
  leave() {
    if (this.root) { this.root.removeFromParent(); this.root.traverse((o) => { o.geometry?.dispose?.(); }); this.root = null; }
    this.hud?.remove(); this.b = null;
  }

  boost(v, why) {
    const before = this.pop;
    this.pop = Math.max(0, Math.min(100, this.pop + v));
    if (why && Math.floor(this.pop / 25) > Math.floor(before / 25)) this.g.ui.note(`🔥 Popularité ${Math.round(this.pop)} : ${why}`, 'good', 2500);
    this.refreshPop();
  }
  refreshPop() { if (this.popEl) this.popEl.textContent = `🔥 Popularité ${Math.round(this.pop)}/100`; }

  drawScreen(t, beat) {
    const S = this.screen, x = S.ctx, cols = this.theme.cols;
    x.fillStyle = '#05030c'; x.fillRect(0, 0, 512, 192);
    for (let i = 0; i < 32; i++) { const v = (Math.sin(t * 3 + i * 0.7) * 0.5 + 0.5) * (0.4 + 0.6 * Math.abs(Math.sin(t * 1.3 + i))) * (beat ? 1 : 0.8); x.fillStyle = cols[i % cols.length]; x.fillRect(i * 16 + 2, 192 - v * 150, 12, v * 150); }
    x.font = 'bold 54px sans-serif'; x.textAlign = 'center'; x.fillStyle = '#ffffff'; x.shadowColor = cols[0]; x.shadowBlur = 24;
    x.fillText(S.name, 256, 70); x.shadowBlur = 0;
    S.tex.needsUpdate = true;
  }

  // une fille vient d'elle-même te parler quand tu es populaire
  approach() {
    const g = this.g, it = g.interiors?.loaded.get(this.b.id), P = g.player.pos;
    if (!it) return;
    const free = it.people.filter((p) => p.role === 'fetarde' && !p.walkTo && Math.hypot(p.x - P.x, p.z - P.z) > 3).sort((x, y) => Math.hypot(x.x - P.x, x.z - P.z) - Math.hypot(y.x - P.x, y.z - P.z)).slice(0, 6);
    if (!free.length) return;
    const p = free[Math.floor(Math.random() * free.length)], a = Math.random() * Math.PI * 2;
    p.walkTo = { x: P.x + Math.cos(a) * 1.3, z: P.z + Math.sin(a) * 1.3, done: (q) => {
      g.labels.bubble(q.av.root, ['Salut ! Je t\'ai vu danser 😍', 'Hey, c\'est toi la star de la soirée ?', 'On danse ensemble ? 💃', 'J\'adore ton style !'][Math.floor(Math.random() * 4)], 3500);
      g.net.request('club.girl', { id: `club:${this.b.id}:${q.name}`, kind: 'approach' }).then((r) => g.ui.note(`💕 ${q.name} est venue te parler (affection ${r.aff}/100) : appuie sur E pour lui répondre`, 'good', 4000)).catch(() => {});
    } };
  }

  // les filles qui viennent à ta table après une bouteille
  gather(girls) {
    const P = this.g.player.pos;
    girls.forEach((p, i) => { const a = (i / Math.max(1, girls.length)) * Math.PI * 2; p.walkTo = { x: P.x + Math.cos(a) * 1.5, z: P.z + Math.sin(a) * 1.5 }; });
  }

  update(dt, t) {
    const g = this.g, inside = g.interiors?.inside;
    const isClub = inside && (inside.interior === 'club' || inside.interior === 'megaclub') ? inside : null;
    if (isClub && this.b !== isClub) { if (this.b) this.leave(); this.enter(isClub); }
    else if (!isClub && this.b) this.leave();
    if (!this.b || !this.root) return;
    this.t += dt;
    const beatK = Math.floor(this.t / BEAT.period), onBeat = beatK !== this.lastBeat;
    const ph = (this.t % BEAT.period) / BEAT.period, pulse = 1 - ph;
    if (onBeat) {
      this.lastBeat = beatK;
      // sol : nouvelles couleurs à chaque temps
      const T = this.tiles, cols = this.theme.cols.map((c) => new THREE.Color(c)), c = new THREE.Color();
      for (let i = 0; i < T.n * T.n; i++) { const x = i % T.n, y = Math.floor(i / T.n); c.copy(cols[(x + y + beatK) % cols.length]); if (((x * 31 + y * 17 + beatK * 7) % 5) === 0) c.multiplyScalar(0.15); T.mesh.setColorAt(i, c); }
      T.mesh.instanceColor.needsUpdate = true;
      // « drop » toutes les 32 mesures : stroboscope + canons à confettis
      if (beatK % 32 === 0 && beatK > 0) {
        this.drop = 1.6;
        const [x, z] = this.F.L(0, -this.D / 2 + 4);
        g.fx?.emit?.({ x, y: 3, z, n: this.big ? 160 : 60, colors: this.theme.cols, speed: 9, gravity: 3, life: 3, size: 0.14, jitter: 1 });
        if (this.theme.foam) for (let k = 0; k < 6; k++) { const [fx, fz] = this.F.L((Math.random() - 0.5) * this.W * 0.5, (Math.random() - 0.5) * this.D * 0.4); g.fx?.emit?.({ x: fx, y: 0.6, z: fz, n: 18, colors: ['#ffffff', '#e0fbfc'], speed: 1.5, gravity: -0.4, life: 3.5, size: 0.4, grow: 2 }); }
        g.ui.note('🎆 DROP ! La salle explose !', 'good', 1500);
      }
    }
    this.drop = Math.max(0, (this.drop || 0) - dt);
    this.strobe.intensity = this.drop > 0 ? (Math.sin(this.t * 60) > 0 ? (this.big ? 120 : 40) : 0) : 0;
    this.tiles.mesh.material.opacity = 0.22 + pulse * 0.3;
    for (const s of this.strips) s.material.opacity = 0.25 + pulse * 0.5;
    for (const b of this.beams) { b.pivot.rotation.set(Math.sin(this.t * 0.9 + b.ph) * 0.55, this.t * 0.3 + b.ph, Math.cos(this.t * 0.7 + b.ph) * 0.45); }
    for (const l of this.lasers) { l.pv.rotation.set(-0.08 - Math.abs(Math.sin(this.t * 0.6 + l.ph)) * 0.3, this.F.th + Math.PI + Math.sin(this.t * 0.8 + l.ph) * 0.9, 0); l.m.visible = this.drop > 0 || Math.sin(this.t * 2 + l.ph) > -0.2; }
    for (const ball of this.balls) ball.rotation.y = this.t * 0.8;
    for (const { l, i } of this.lights) { const [x, z] = this.F.L(Math.cos(this.t * (0.7 + i * 0.2) + i * 1.6) * this.W * 0.3, Math.sin(this.t * (0.5 + i * 0.15) + i) * this.D * 0.25); l.position.set(x, this.H - 1.5, z); }
    this.scrT = (this.scrT || 0) - dt;
    if (this.scrT <= 0) { this.scrT = 1 / 15; this.drawScreen(this.t, pulse > 0.7); }
    // popularité : retombe doucement ; les filles viennent quand elle est haute
    this.pop = Math.max(0, this.pop - dt * 0.15);
    this.popT = (this.popT || 0) - dt;
    if (this.popT <= 0) { this.popT = 1; this.refreshPop(); }
    this.approachT -= dt;
    if (this.approachT <= 0) { this.approachT = Math.max(8, 30 - this.pop * 0.22); if (this.pop >= 25) this.approach(); }
  }
}
