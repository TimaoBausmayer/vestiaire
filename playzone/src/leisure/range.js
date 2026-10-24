import * as THREE from 'three';
import { h, fmt } from '../ui/dom.js';
import { buildMergedGeometry, SHAPES as S } from '../core/static-builder.js';
import { actorMaterial } from '../core/materials.js';
import { buildingFrame } from '../world/buildings.js';
import { RANGE, RANGE_WEAPONS, rangeTargets, targetVisible } from '../../shared/leisure.js';

// STAND DE TIR : vue à la première personne depuis un poste de tir, cibles qui se lèvent dans 4 couloirs.
// Les armes n'existent QUE ici (et au paintball / laser game) : on ne peut pas sortir avec.

// Géométrie des couloirs (repère local de l'intérieur : la porte est côté +z, le fond côté -z).
export function rangeLayout(W, D) {
  const I = { x1: -W / 2 + 0.4, x2: W / 2 - 0.4, z1: -D / 2 + 0.4, z2: D / 2 - 0.4 };
  const boothZ = I.z2 - 5.5, backZ = I.z1 + 1.2;
  const laneW = (I.x2 - I.x1 - 2) / RANGE.lanes;
  const laneX = (k) => I.x1 + 1 + laneW * (k + 0.5);
  return { I, boothZ, backZ, laneW, laneX, near: boothZ - 5, far: backZ + 0.6 };
}

const R_TARGET = 0.55;
const GEO = {
  cible: buildMergedGeometry((sb) => {
    sb.box(0, 0, -0.04, 0.08, 1.0, 0.05, '#6b6b6b');
    ['#f4f1ea', '#141414', '#3d8ee8', '#e63946', '#ffd23f'].forEach((c, i) => sb.add(S.cyl(24), { y: 1.55, z: i * 0.01, sx: R_TARGET * 2 * (1 - i * 0.19), sy: 0.03, sz: R_TARGET * 2 * (1 - i * 0.19), rx: Math.PI / 2, color: c }));
  }),
  silhouette: buildMergedGeometry((sb) => {
    sb.box(0, 0, -0.04, 0.08, 0.6, 0.05, '#6b6b6b');
    sb.box(0, 0.6, 0, 0.9, 1.05, 0.04, '#1d1d24');
    sb.add(S.cyl(16), { y: 1.9, sx: 0.5, sy: 0.04, sz: 0.5, rx: Math.PI / 2, color: '#1d1d24' });
    ['#f4f1ea', '#e63946'].forEach((c, i) => sb.add(S.cyl(20), { y: 1.25, z: 0.03 + i * 0.01, sx: 0.5 - i * 0.26, sy: 0.02, sz: 0.5 - i * 0.26, rx: Math.PI / 2, color: c }));
  }),
  otage: buildMergedGeometry((sb) => {
    sb.box(0, 0, -0.04, 0.08, 0.6, 0.05, '#6b6b6b');
    sb.box(0, 0.6, 0, 0.9, 1.05, 0.04, '#7ac74f');
    sb.add(S.cyl(16), { y: 1.9, sx: 0.5, sy: 0.04, sz: 0.5, rx: Math.PI / 2, color: '#f6cfa3' });
    sb.box(-0.12, 1.88, 0.03, 0.06, 0.06, 0.02, '#222'); sb.box(0.12, 1.88, 0.03, 0.06, 0.06, 0.02, '#222');
    sb.box(0, 1.72, 0.03, 0.2, 0.04, 0.02, '#c1121f');
    sb.box(0, 1.05, 0.03, 0.8, 0.22, 0.02, '#ffffff'); // pancarte « NE PAS TIRER »
    sb.box(0, 1.1, 0.04, 0.6, 0.06, 0.02, '#c1121f');
  }),
  pistolet: buildMergedGeometry((sb) => {
    sb.box(0, 0, 0, 0.05, 0.05, 0.26, '#26262b'); sb.box(0, -0.12, 0.08, 0.045, 0.14, 0.06, '#3a2a1e');
    sb.box(0, 0.05, -0.02, 0.012, 0.012, 0.012, '#ff3fa4');
  }),
  carabine: buildMergedGeometry((sb) => {
    sb.box(0, 0, -0.05, 0.05, 0.05, 0.6, '#26262b'); sb.box(0, -0.09, 0.22, 0.05, 0.1, 0.26, '#7a4a22');
    sb.add(S.cyl(10), { y: 0.06, z: 0, sx: 0.06, sy: 0.24, sz: 0.06, rx: Math.PI / 2, color: '#141414' });
  }),
};
// centre des zones de points (hauteur locale de la cible) et rayon
const CENTER = { cible: [1.55, R_TARGET], silhouette: [1.25, 0.5], otage: [1.3, 0.6] };

export function rangePanel(g, b) {
  const st = g.profile.leisure?.range || { best: 0, plays: 0, wins: 0 };
  let weapon = 'pistolet';
  const m = g.ui.modal({
    title: '🎯 Stand de tir Dédé la Gâchette', sub: 'Armes de location, utilisées UNIQUEMENT ici, sous l\'œil d\'un moniteur. Vise le centre, épargne les otages (−15).',
    width: 'min(600px, 96vw)',
    build: (body) => {
      body.append(h('div.stat-grid',
        h('div.stat', h('b', String(st.best || 0)), h('span', 'Ton record')),
        h('div.stat', h('b', String(st.plays || 0)), h('span', 'Séances')),
        h('div.stat', h('b', String(st.wins || 0)), h('span', 'Compétitions gagnées'))));
      body.append(h('div.field', h('label', 'Arme'), h('div.opt-row', Object.entries(RANGE_WEAPONS).map(([k, w]) => h(`button.opt${weapon === k ? '.sel' : ''}`, { onclick: () => { weapon = k; m.refresh(); } }, `${w.icon} ${w.name} (${w.ammo} cartouches)`)))));
      body.append(h('div.list-item', h('div.grow', h('div.t', 'Entraînement'), h('div.d', `${RANGE.duration} s de tir · ${RANGE.fee} PC (arme + munitions)`)),
        h('button.btn.small', { onclick: () => { m.close(); startRange(g, b, weapon, false); } }, 'Tirer')));
      const [p1, p2, p3] = RANGE.compet.prizes;
      body.append(h('div.list-item', h('div.grow', h('div.t', '🏆 Compétition du jour'), h('div.d', `Inscription ${RANGE.compet.fee} PC · prix : ${p1} / ${p2} / ${p3} PC · contre ${RANGE.compet.rivals} tireurs PNJ dont le niveau suit le tien · 3 par heure`)),
        h('button.btn.small', { onclick: () => { m.close(); startRange(g, b, weapon, true); } }, 'S\'inscrire')));
      const board = h('div.muted', 'Chargement du classement…');
      body.append(h('h3', { style: { marginTop: '12px' } }, 'Meilleurs tireurs'), board);
      g.net.request('mg.board', { id: 'tir' }).then(({ top }) => {
        board.textContent = '';
        board.classList.remove('muted');
        if (!top?.length) { board.textContent = 'Personne encore : à toi l\'honneur !'; return; }
        board.append(h('table.board', top.map((r, i) => h(`tr${r.id === g.profile.id ? '.me' : ''}`, h('td', String(i + 1)), h('td', r.name, r.npc ? h('span.pill', { style: { marginLeft: '6px' } }, 'PNJ') : null), h('td.num', String(r.score))))));
      }).catch(() => { board.textContent = 'Classement indisponible.'; });
    },
  });
}

async function startRange(g, b, weapon, compet) {
  if (g.range) return;
  let r;
  try { r = await g.net.request('range.start', { weapon, compet }); } catch (e) { g.ui.toast(e.message, 'bad'); g.sfx('error'); return; }
  g.sfx('cash');
  g.range = new RangeSession(g, b, weapon, compet, r);
}

export class RangeSession {
  constructor(g, b, weapon, compet, r) {
    this.g = g; this.b = b; this.weapon = weapon; this.w = RANGE_WEAPONS[weapon]; this.compet = compet;
    this.seed = r.seed; this.ammo = r.ammo; this.score = 0; this.shots = 0;
    // temps de tir calé sur l'horloge réelle (comme l'autorité), même si l'image ralentit
    this.t0 = performance.now();
    this.t = -RANGE.countdown; this.cool = 0; this.over = false;
    this.targets = rangeTargets(this.seed);
    const F = buildingFrame(b);
    this.F = F;
    this.L = rangeLayout(F.W, F.D);
    this.raycaster = new THREE.Raycaster();
    this.meshes = this.targets.map((tg) => {
      const m = new THREE.Mesh(GEO[tg.kind], actorMaterial);
      m.visible = false; m.userData.i = tg.i;
      g.engine.scene.add(m);
      return m;
    });
    // le joueur se place au poste n°2, vue à la première personne
    const lx = (this.L.laneX(1) + this.L.laneX(2)) / 2;
    const [px, pz] = F.L(lx, this.L.boothZ + 0.9);
    g.player.teleport(px, pz, F.th + Math.PI);
    g.player.avatar.root.visible = false;
    const [ex, ez] = F.L(lx, this.L.boothZ + 0.6);
    const [lkx, lkz] = F.L(lx, this.L.backZ);
    this.eye = new THREE.Vector3(ex, 1.62, ez);
    this.look = new THREE.Vector3(lkx, 1.45, lkz);
    this.kick = 0;
    g.cutscene = true;
    g.cam.override = { pos: this.eye.clone(), look: this.look.clone() };
    g.engine.camera.position.copy(this.eye);
    this.fov0 = g.engine.camera.fov;
    if (this.w.zoom) { g.engine.camera.fov = this.fov0 / this.w.zoom; g.engine.camera.updateProjectionMatrix(); }
    // arme tenue à la première personne
    this.gun = new THREE.Mesh(GEO[weapon], actorMaterial);
    this.gun.position.set(0.16, -0.15, -0.55);
    this.gun.scale.setScalar(0.7);
    g.engine.camera.add(this.gun);
    if (!g.engine.camera.parent) g.engine.scene.add(g.engine.camera);
    this.cross = h(`div.crosshair.show${this.w.zoom ? '.scope' : ''}`);
    this.hud = h('div.mg-hud', this.timeBox = h('div.box', h('b', String(RANGE.duration)), h('span', 'Secondes')),
      this.scoreBox = h('div.box', h('b', '0'), h('span', 'Points')), this.ammoBox = h('div.box', h('b', String(this.ammo)), h('span', 'Cartouches')));
    this.cd = h('div.countdown');
    this.quit = h('button.btn.ghost.range-quit', { onclick: () => this.finish(true) }, 'Abandonner');
    g.ui.root.append(this.cross, this.hud, this.cd, this.quit);
    g.input.noLock = true; g.input.unlock();   // on vise avec le curseur
    this.offClick = g.input.on('click', (e) => this.fire(e.x, e.y));
    this.flash = new THREE.PointLight('#ffd27a', 0, 6);
    g.engine.scene.add(this.flash);
    this.markers = [];
  }

  targetPos(tg, t) {
    const L = this.L;
    const lz = L.near - tg.depth * (L.near - L.far);
    let lx = L.laneX(tg.lane) + tg.off * L.laneW * 0.35;
    if (tg.move) lx += tg.move * Math.sin((t - tg.t) * 1.7) * L.laneW * 0.28;
    const [x, z] = this.F.L(lx, lz);
    return { x, z };
  }

  fire(sx, sy) {
    const g = this.g;
    if (this.over || this.t < 0 || this.cool > 0 || g.ui.blocking || this.shots >= this.ammo) return;
    this.cool = this.w.cooldown;
    this.shots++;
    this.ammoBox.querySelector('b').textContent = String(this.ammo - this.shots);
    g.sfx('shot');
    this.kick = 1;
    this.flash.position.copy(this.eye); this.flash.intensity = 4;
    // légère dispersion de l'arme
    const sway = this.w.sway * innerHeight * 4;
    const ndc = new THREE.Vector2(((sx + (Math.random() - 0.5) * sway) / innerWidth) * 2 - 1, -((sy + (Math.random() - 0.5) * sway) / innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(ndc, g.engine.camera);
    const vis = this.meshes.filter((m) => m.visible && !m.userData.hit);
    const hit = this.raycaster.intersectObjects(vis, false)[0];
    let i = null, ratio = 1;
    if (hit) {
      const m = hit.object, tg = this.targets[m.userData.i];
      const local = m.worldToLocal(hit.point.clone());
      const [cy, rad] = CENTER[tg.kind];
      ratio = Math.hypot(local.x, local.y - cy) / rad;
      if (tg.kind === 'otage' || ratio <= 1.05) { i = tg.i; m.userData.hit = true; }
      this.impact(hit.point);
    }
    g.net.request('range.shot', { i, ratio: Math.min(1, ratio) }).then((d) => {
      this.score = d.score;
      this.scoreBox.querySelector('b').textContent = String(d.score);
      if (i !== null) this.popup(sx, sy, d.pts);
    }).catch(() => {});
    if (this.shots >= this.ammo) setTimeout(() => this.finish(), 700);
  }

  impact(p) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), new THREE.MeshBasicMaterial({ color: '#111' }));
    m.position.copy(p);
    this.g.engine.scene.add(m);
    this.markers.push(m);
  }

  popup(x, y, pts) {
    const el = h(`div.hit-pop${pts < 0 ? '.bad' : ''}`, { style: { left: `${x}px`, top: `${y}px` } }, pts < 0 ? `${pts} OTAGE !` : `+${pts}`);
    this.g.ui.root.append(el);
    setTimeout(() => el.remove(), 900);
    if (pts < 0) this.g.sfx('fail'); else if (pts >= 10) this.g.sfx('success');
  }

  update(dt) {
    const g = this.g;
    if (this.over) return;
    this.t = (performance.now() - this.t0) / 1000 - RANGE.countdown; this.cool -= dt;
    if (this.t < 0) { const n = Math.ceil(-this.t); if (this.cd.textContent !== String(n)) { this.cd.textContent = String(n); g.sfx('beep'); } }
    else if (this.cd.textContent !== '') { if (this.cd.textContent !== 'FEU !') { this.cd.textContent = 'FEU !'; g.sfx('go'); setTimeout(() => { this.cd.textContent = ''; }, 600); } }
    this.timeBox.querySelector('b').textContent = String(Math.max(0, Math.ceil(RANGE.duration - Math.max(0, this.t))));
    if (g.input.pointer) { this.cross.style.left = `${g.input.pointer.x}px`; this.cross.style.top = `${g.input.pointer.y}px`; }
    for (const tg of this.targets) {
      const m = this.meshes[tg.i];
      const shown = targetVisible(tg, this.t);
      if (!shown && !m.visible) continue;
      const p = this.targetPos(tg, this.t);
      m.position.set(p.x, 0.05, p.z);
      m.rotation.y = this.F.th;
      const age = this.t - tg.t, left = tg.t + tg.d - this.t;
      let up = Math.max(0, Math.min(1, age * 7, left * 7));
      if (m.userData.hit) up = Math.max(0, 1 - (m.userData.fall = (m.userData.fall || 0) + dt * 5));
      m.rotation.x = -(1 - up) * Math.PI / 2;
      m.visible = up > 0.01;
    }
    // recul de l'arme et éclair
    this.kick = Math.max(0, this.kick - dt * 8);
    g.cam.override.look.copy(this.look).y += this.kick * 0.5;
    this.gun.rotation.x = this.kick * 0.35;
    this.gun.position.z = -0.55 + this.kick * 0.05;
    this.flash.intensity = Math.max(0, this.flash.intensity - dt * 40);
    if (this.t >= RANGE.duration) this.finish();
  }

  cleanup() {
    const g = this.g;
    this.offClick?.(); this.g.input.noLock = false;
    for (const m of [...this.meshes, ...this.markers]) g.engine.scene.remove(m);
    g.engine.scene.remove(this.flash);
    g.engine.camera.remove(this.gun);
    if (this.w.zoom) { g.engine.camera.fov = this.fov0; g.engine.camera.updateProjectionMatrix(); }
    this.cross.remove(); this.hud.remove(); this.cd.remove(); this.quit.remove();
    g.cam.override = null; g.cutscene = false;
    g.player.avatar.root.visible = true;
    g.range = null;
  }

  async finish(abandon = false) {
    if (this.over) return;
    this.over = true;
    const g = this.g;
    if (abandon) { g.net.request('range.cancel', {}).catch(() => {}); this.cleanup(); g.ui.toast('Séance abandonnée. L\'arme reste au stand.'); return; }
    let r = null;
    try {
      // l'autorité attend la fin réelle du temps de tir (ou la dernière cartouche)
      for (let k = 0; k < 8 && !r; k++) { try { r = await g.net.request('range.finish', {}); } catch (e) { if (!/pas finie/.test(e.message)) throw e; await new Promise((res) => setTimeout(res, 500)); } }
    } catch (e) { g.ui.toast(e.message, 'bad'); }
    this.cleanup();
    if (!r) return;
    g.sfx(r.record ? 'levelup' : 'success');
    const m = g.ui.modal({
      title: r.compet ? (r.compet.place === 1 ? '🏆 Victoire !' : `Compétition : ${r.compet.place}e`) : '🎯 Fin de séance', sub: `Arme rendue au moniteur. ${r.shots} cartouches tirées.`,
      build: (body) => {
        body.append(h('div.stat-grid',
          h('div.stat', h('b', String(r.score)), h('span', 'Points')),
          h('div.stat', h('b', String(r.best)), h('span', r.record ? 'Nouveau record !' : 'Record')),
          h('div.stat', h('b', r.rank ? `#${r.rank}` : '—'), h('span', 'Classement'))));
        if (r.compet) {
          body.append(h('p', r.compet.prize ? `💰 Prix : ${fmt(r.compet.prize)} PC !` : 'Pas de prix cette fois. Entraîne-toi et reviens !'));
          body.append(h('table.board', r.compet.rivals.map((x, i) => h(`tr${x.me ? '.me' : ''}`, h('td', String(i + 1)), h('td', x.name, x.npc ? h('span.pill', { style: { marginLeft: '6px' } }, 'PNJ') : null), h('td.num', String(x.score))))));
        }
      },
      foot: (f) => f.append(h('button.btn', { onclick: () => m.close() }, 'OK')),
    });
  }
}
