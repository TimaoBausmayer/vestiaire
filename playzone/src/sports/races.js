import * as THREE from 'three';
import { openShop } from '../ui/shop.js';
import { h, fmt } from '../ui/dom.js';
import { WorldVehicle } from '../vehicles/vehicles.js';
import { CarVisual } from '../vehicles/car-models.js';
import { Avatar } from '../characters/avatar.js';
import { DEFAULT_APPEARANCE, SKINS, HAIR_STYLES, HAIR_COLORS, COLORS } from '../../shared/appearance.js';
import { HOUR_MS } from '../../shared/clock.js';
import { mulberry32, hashString } from '../../shared/rng.js';
import { DISC, ROUTES, ATHLE, GATE_R, routeAt, distToRoute, fmtTime } from '../../shared/courses.js';

// COURSES SUR PARCOURS : course à pied (piste d'athlétisme), cyclisme (boucle des Hauts, vélo prêté),
// Formule 1 (circuit de l'Académie, monoplace prêtée). Feux de départ, portes de contrôle, tours,
// adversaires PNJ qui progressent avec toi, classement en direct. Résultats validés par l'autorité.

const req = async (g, t, p) => { try { return await g.net.request(t, p); } catch (e) { g.ui.toast(e.message, 'bad', 5000); g.sfx('error'); return null; } };
const pick = (r, a) => a[Math.floor(r() * a.length)];
const MODEL = { bike: 'velo-course', f1: 'f1' };   // modèle prêté (une discipline peut en préciser un autre)
const F1_PAINTS = ['#d00000', '#00a19c', '#ff8700', '#1e41ff', '#ffffff', '#006f62', '#2b2d42', '#ffd23f', '#9b5de5', '#0090ff'];

export class Races {
  constructor(g) {
    this.g = g;
    this.s = null;
    this.build();
  }

  // ------------------------------------------------------------------------------ décors
  build() {
    const g = this.g, root = new THREE.Group();
    root.name = 'courses';
    const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...o });
    // piste d'athlétisme rouge (anneau arrondi) avec couloirs
    const ring = (hx, hz, r) => { const s = new THREE.Shape(); s.moveTo(-hx + r, -hz); s.lineTo(hx - r, -hz); s.absarc(hx - r, -hz + r, r, -Math.PI / 2, 0); s.lineTo(hx, hz - r); s.absarc(hx - r, hz - r, r, 0, Math.PI / 2); s.lineTo(-hx + r, hz); s.absarc(-hx + r, hz - r, r, Math.PI / 2, Math.PI); s.lineTo(-hx, -hz + r); s.absarc(-hx + r, -hz + r, r, Math.PI, Math.PI * 1.5); return s; };
    const w = ATHLE.w / 2;
    const outer = ring(ATHLE.hx + w, ATHLE.hz + w, ATHLE.r + w);
    outer.holes.push(ring(ATHLE.hx - w, ATHLE.hz - w, ATHLE.r - w));
    const track = new THREE.Mesh(new THREE.ShapeGeometry(outer, 16).rotateX(-Math.PI / 2), mat('#b5452f'));
    track.position.set(ATHLE.cx, 0.03, ATHLE.cz); track.receiveShadow = true; root.add(track);
    for (const k of [-1, 0, 1]) {
      const ln = new THREE.Mesh(new THREE.ShapeGeometry((() => { const o = ring(ATHLE.hx + k * 1.1 + 0.04, ATHLE.hz + k * 1.1 + 0.04, ATHLE.r + k * 1.1 + 0.04); o.holes.push(ring(ATHLE.hx + k * 1.1 - 0.04, ATHLE.hz + k * 1.1 - 0.04, ATHLE.r + k * 1.1 - 0.04)); return o; })(), 16).rotateX(-Math.PI / 2), mat('#f4f1ea'));
      ln.position.set(ATHLE.cx, 0.035, ATHLE.cz); root.add(ln);
    }
    // lignes de départ / arrivée
    const finish = (route, w) => {
      const p = routeAt(route, 0);
      const c = document.createElement('canvas'); c.width = 64; c.height = 16;
      const x = c.getContext('2d'); for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#111' : '#fff'; x.fillRect(i * 4, j * 4, 4, 4); }
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.6).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(c) }));
      m.position.set(p.x, 0.06, p.z); m.rotation.y = p.yaw + Math.PI / 2; root.add(m);
      return p;
    };
    finish(ROUTES.piste, ATHLE.w);
    // cyclisme : arche de départ sur le boulevard des Paillettes
    const hp = finish(ROUTES.hauts, 9);
    for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 0.5), mat('#ffd23f')); m.position.set(hp.x, 3, hp.z + s * 6.2); root.add(m); }
    const arch = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.4, 13), mat('#e63946')); arch.position.set(hp.x, 6.4, hp.z); root.add(arch);
    // circuit F1 : asphalte, vibreurs, grille, tribune, portique des feux
    const F = ROUTES.f1, asph = mat('#3a3d42', { roughness: 0.95 });
    for (let i = 0; i < F.pts.length; i++) {
      const a = F.pts[i], b = F.pts[(i + 1) % F.pts.length], len = Math.hypot(b.x - a.x, b.z - a.z);
      const seg = new THREE.Mesh(new THREE.PlaneGeometry(F.width, len + F.width * 0.2).rotateX(-Math.PI / 2), asph);
      seg.position.set((a.x + b.x) / 2, 0.04, (a.z + b.z) / 2); seg.rotation.y = Math.atan2(b.x - a.x, b.z - a.z); seg.receiveShadow = true; root.add(seg);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(F.width / 2, 20).rotateX(-Math.PI / 2), asph); disc.position.set(a.x, 0.041, a.z); root.add(disc);
      // vibreurs rouge et blanc aux virages
      for (let k = 0; k < 8; k++) { const ang = (k / 8) * Math.PI * 2; const v = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.6), mat(k % 2 ? '#ffffff' : '#e63946')); v.position.set(a.x + Math.cos(ang) * (F.width / 2 + 0.4), 0.05, a.z + Math.sin(ang) * (F.width / 2 + 0.4)); v.rotation.y = -ang; root.add(v); }
    }
    finish(F, F.width);
    const st = new THREE.Mesh(new THREE.BoxGeometry(130, 0.6, 8), mat('#c9ced6')); st.position.set(712, 0.3, -733); root.add(st);
    for (let r = 0; r < 4; r++) { const step = new THREE.Mesh(new THREE.BoxGeometry(130, 0.5, 1.6), mat(r % 2 ? '#d00000' : '#f4f1ea')); step.position.set(712, 0.85 + r * 0.55, -737 + r * 1.6); root.add(step); }
    g.collision.addBox(647, 0, -738, 777, 2.6, -729);
    const p0 = routeAt(F, 0);
    for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7, 0.5), mat('#2b2d42')); m.position.set(p0.x, 3.5, p0.z + s * 7.5); root.add(m); g.collision.addCyl(p0.x, p0.z + s * 7.5, 0.3, 0, 7); }
    const gantry = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 15.5), mat('#2b2d42')); gantry.position.set(p0.x, 7.2, p0.z); root.add(gantry);
    this.f1Lights = [];
    for (let k = 0; k < 5; k++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), new THREE.MeshStandardMaterial({ color: '#330000', emissive: '#ff0000', emissiveIntensity: 0 })); l.position.set(p0.x - 0.45, 7.2, p0.z - 3 + k * 1.5); root.add(l); this.f1Lights.push(l); }
    g.engine.scene.add(root);
  }

  // ------------------------------------------------------------------------------ accueils
  // Club-house du Stade des Crampons : foot, course à pied, vélo.
  clubDesk(b = null) {
    const g = this.g;
    if (b && b.id !== 'club-foot') {   // club de quartier : foot sur son propre terrain
      g.ui.dialog({ name: 'Accueil', role: b.name, text: 'Bienvenue au club ! Le terrain est juste à côté : entraînements et matchs gratuits, ta licence vaut dans tous les clubs de la ville.', choices: [
        { label: '⚽ Football (club gratuit)', action: (m) => { m.close(); g.football.desk(b); } },
        { label: 'Au revoir', ghost: true, action: (m) => m.close() },
      ] });
      return;
    }
    g.ui.dialog({ name: 'Accueil', role: 'Club-house du Stade des Crampons', text: 'Bienvenue à la Maison des Sports ! Foot et course à pied gratuits, vélo avec licence (essai gratuit).', choices: [
      { label: '⚽ Football (club gratuit)', action: (m) => { m.close(); g.football.desk(b); } },
      { label: '🏃 Course à pied (gratuit)', action: (m) => { m.close(); this.desk('course'); } },
      { label: '🚴 Cyclisme (Vélo Club)', action: (m) => { m.close(); this.desk('velo'); } },
      { label: 'Au revoir', ghost: true, action: (m) => m.close() },
    ] });
  }

  // Bike Park des Géants : VTT, vélo de route, achat de vélos
  bikeDesk(b) {
    const g = this.g;
    g.ui.dialog({ name: 'Accueil', role: 'Bike Park des Géants', text: 'Salut ! Sentier VTT plein de bosses (essai gratuit puis pass), Route des Cols gratuite en vélo de route. Et on vend des vélos !', choices: [
      { label: '🚵 VTT : sentier et Enduro', action: (m) => { m.close(); this.desk('vtt'); } },
      { label: '🚴‍♂️ Vélo de route : Route des Cols', action: (m) => { m.close(); this.desk('route'); } },
      { label: '🛒 Acheter un vélo', action: (m) => { m.close(); openShop(g, 'bikes', b); } },
      { label: 'Au revoir', ghost: true, action: (m) => m.close() },
    ] });
  }

  desk(disc) {
    const g = this.g, D = DISC[disc];
    if (this.s || g.football?.s) { g.ui.toast('Termine d\'abord ton activité en cours.', 'bad'); return; }
    const m = g.ui.modal({
      title: `${D.icon} ${D.name}`, sub: D.member ? `Essai gratuit, puis adhésion. Plus tu pratiques, plus tu progresses (et plus les adversaires PNJ sont forts).` : 'Gratuit. Plus tu cours, plus tu deviens rapide et endurant·e.',
      width: 'min(620px, 96vw)',
      build: (body) => {
        const d = g.profile.sports[disc], now = g.now();
        const mem = d.member && d.member.until > now ? d.member : null;
        body.append(h('div.list-item', h('span', { style: { fontSize: '24px' } }, '📈'), h('div.grow', h('div.t', `Niveau ${Math.round(d.skill)}/100 · endurance ${Math.round(g.profile.body.endurance ?? 15)}/100`),
          h('div.d', `${d.sessions} séance(s) · ${d.races} course(s) · ${d.wins} victoire(s) · ${d.podiums} podium(s)${d.grid ? ` · grille du prochain GP : P${d.grid}` : ''}`))));
        if (D.member) {
          body.append(h('div.list-item', h('span', { style: { fontSize: '24px' } }, mem ? '🎫' : d.trial ? '🔒' : '🎁'),
            h('div.grow', h('div.t', mem ? `${D.member.name} : valable encore ${Math.ceil((mem.until - now) / HOUR_MS)} h de jeu` : d.trial ? 'Essai gratuit utilisé' : 'Essai gratuit disponible !'), h('div.d', mem ? 'Toutes les épreuves sont ouvertes.' : d.trial ? 'Prends l\'adhésion pour continuer.' : 'Ta première séance (ou course) est offerte, sans adhésion.')),
            mem ? null : h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
              D.day ? h('button.btn.small.ghost', { onclick: () => this.member(disc, 'day', m) }, `Journée ${D.day} PC`) : null,
              h('button.btn.small', { onclick: () => this.member(disc, 'season', m) }, `${D.member.days} jours : ${fmt(D.member.price)} PC`))));
        }
        for (const [id, M] of Object.entries(D.modes)) {
          body.append(h('div.list-item', h('span', { style: { fontSize: '22px' } }, M.npcs ? '🏁' : '⏱️'),
            h('div.grow', h('div.t', M.name), h('div.d', `${M.npcs ? `${M.npcs + 1} participants · prix ${M.prizes.join(' / ')} PC` : 'Chronométré, sans adversaire'}${M.fee ? ` · inscription ${M.fee} PC` : ''} · record ${fmtTime(d.best[id])}`)),
            h('button.btn.small', { onclick: () => { m.close(); D.how === 'ski' ? g.ski.go(id) : D.how === 'jet' ? g.jetski.go(id) : this.start(disc, id); } }, 'Y aller')));
        }
        body.append(h('p.muted', D.how === 'foot' ? 'Maj = sprint. Ton endurance décide combien de temps tu tiens à fond.' : D.how === 'bike' ? 'Le club te prête un vélo de course. Attention aux voitures sur la boucle !' : D.how === 'f1' ? 'Attends l\'extinction des 5 feux rouges. Les qualifications décident de ta place sur la grille du Grand Prix.' : D.how === 'jet' ? 'Avant = gaz, Arrière = frein / marche arrière, gauche / droite = virer, Espace = saut sur la vague (rotations en l\'air). Si tu possèdes un jet ski, pas besoin d\'abonnement.' : 'A / D pour tourner, Avant = position de recherche de vitesse, Arrière = chasse-neige.'));
      },
    });
  }

  async member(disc, kind, m) {
    const r = await req(this.g, 'sport.member', { disc, kind });
    if (r) { this.g.sfx('cash'); this.g.ui.toast(`🎫 Adhésion prise (${r.price} PC). Bonne pratique !`, 'good'); m.refresh(); }
  }

  // ------------------------------------------------------------------------------ départ
  async start(disc, mode) {
    const g = this.g, D = DISC[disc], M = D.modes[mode], route = ROUTES[D.route];
    const r = await req(g, 'sport.start', { disc, mode });
    if (!r) return;
    if (r.trial) g.ui.toast('🎁 Essai gratuit !', 'good', 2500);
    if (g.vehicles?.current) g.vehicles.exit(true);
    // place sur la grille : derrière la ligne (les qualifs F1 améliorent la position)
    const myGrid = D.how === 'f1' && M.npcs ? Math.max(0, Math.min(M.npcs, (r.grid || M.npcs + 1) - 1)) : M.npcs;
    const slot = (i) => { const back = 4 + Math.floor(i / 2) * (D.how === 'f1' ? 8 : D.how === 'bike' ? 3 : 2); const lat = (i % 2 ? 1 : -1) * (D.how === 'f1' ? 3 : D.how === 'bike' ? 2 : 1.1); return { back, lat }; };
    const place = (sl) => { const p = routeAt(route, -sl.back); return { x: p.x + Math.cos(p.yaw) * sl.lat, z: p.z - Math.sin(p.yaw) * sl.lat, yaw: p.yaw }; };
    const me = place(slot(myGrid));
    const s = this.s = { disc, mode, D, M, route, go: r.go, laps: [], lapStart: r.go, next: 1, lap: 0, hudT: 0, off: 0, npcs: [], start: me, prevSpeed: g.player.speedBonus };
    const d = g.profile.sports[disc];
    if (D.how === 'foot') {
      g.player.teleport(me.x, me.z, me.yaw);
      g.player.speedBonus = (g.player.speedBonus || 1) * (1 + d.skill / 450);
    } else {
      const v = new WorldVehicle(g, { model: D.model || MODEL[D.how], color: D.how === 'f1' ? '#d00000' : '#e63946', x: me.x, z: me.z, yaw: me.yaw, owner: 'course' });
      g.vehicles.list.push(v); g.vehicles.enter(v);
      if (D.how === 'bike') v.sim.boost = 1 + (d.skill + (g.profile.body.endurance ?? 15)) / 380;
      else v.sim.boost = 1 + d.skill / 900;
      s.v = v;
    }
    // adversaires PNJ (position calculée depuis leurs temps, validés par l'autorité)
    let k = 0;
    r.field.forEach((n) => { if (k === myGrid) k++; s.npcs.push(this.makeNpc(n, slot(k), D)); k++; });
    this.lights = h('div.kart-lights', [0, 1, 2, 3, 4].map(() => h('span')));
    g.ui.root.append(this.lights);
    g.ui.toast(`${D.icon} ${M.name} : ${M.laps} tour(s). Départ à l'extinction des feux !`, 'event', 4000);
    g.cam.dist = Math.max(D.how === 'f1' ? 7 : 5.5, g.cam.dist);
  }

  makeNpc(n, sl, D) {
    const g = this.g, r = mulberry32(hashString(n.name));
    const app = { ...DEFAULT_APPEARANCE, skin: pick(r, SKINS.slice(0, 8)), hair: pick(r, HAIR_STYLES), hairColor: pick(r, HAIR_COLORS.slice(0, 7)), top: D.how === 'foot' ? 'debardeur' : 'tshirt', topColor: pick(r, COLORS), bottom: 'short', hat: null };
    let root, av = null, vis = null;
    if (D.how === 'foot') { av = new Avatar(app, {}); root = av.root; } else { vis = new CarVisual(D.model || MODEL[D.how], { paint: D.how === 'f1' ? pick(r, F1_PAINTS) : pick(r, COLORS), driver: app, driverKey: `race-${n.name}` }); root = vis.root; }
    g.engine.scene.add(root);
    const label = document.createElement('div');
    label.className = 'wlabel'; label.textContent = `${n.name} (PNJ)`;
    const lab = g.labels.add(root, label, D.how === 'f1' ? 1.6 : 2.1, 45);
    return { n, sl, av, vis, root, lab, prog: -sl.back, lat: sl.lat };
  }

  // progression d'un PNJ (m depuis la ligne) au temps t (s après le départ)
  npcProg(n, t, back) {
    const L = this.s.route.len, laps = n.n.laps;
    if (t <= 0) return -back;
    let k = laps.findIndex((x) => t < x);
    if (k < 0) return laps.length * L + Math.min(40, (t - laps[laps.length - 1]) * 3);
    const t0 = k === 0 ? 0 : laps[k - 1], t1 = laps[k];
    const u = (t - t0) / (t1 - t0);
    const start = k === 0 ? -back : 0;
    return k * L + start + (L - start) * u;
  }

  // ------------------------------------------------------------------------------ boucle
  update(dt) {
    const s = this.s, g = this.g;
    if (!s) return;
    const now = g.now();
    const left = (s.go - now) / 1000;
    const P = s.v ? s.v.pos : g.player.pos;
    // feux de départ
    if (left > 0) {
      if (s.v) s.v.sim.place(s.start.x, s.start.z, s.start.yaw); else g.player.teleport(s.start.x, s.start.z, s.start.yaw);
      const on = Math.min(5, Math.floor((3 - left) / 0.55) + 1);
      [...this.lights.children].forEach((e, i) => e.classList.toggle('on', i < on));
      if (s.D.how === 'f1') this.f1Lights.forEach((l, i) => { l.material.emissiveIntensity = i < on ? 2 : 0; });
      if (on !== s.lastOn) { s.lastOn = on; g.sfx('beep'); }
    } else if (this.lights?.isConnected) { this.lights.remove(); this.f1Lights.forEach((l) => { l.material.emissiveIntensity = 0; }); g.sfx('go'); g.ui.toast('🟢 GO !', 'good', 1200); }
    if (s.v && g.vehicles.current !== s.v) { this.finish(true, 'Tu es descendu·e.'); return; }
    if (!s.v && g.player.zone !== 'world') { this.finish(true); return; }
    const t = Math.max(0, (now - s.go) / 1000);
    // portes de contrôle et tours
    if (left <= 0) {
      const gt = s.route.gates[s.next];
      if (Math.hypot(P.x - gt.x, P.z - gt.z) < GATE_R[s.D.route]) {
        if (s.next === 0) {
          const lap = (now - s.lapStart) / 1000;
          s.laps.push(lap); s.lapStart = now; s.lap++;
          g.sfx('success');
          if (s.lap >= s.M.laps) { this.finish(false); return; }
          g.ui.toast(`⏱️ Tour ${s.lap} : ${fmtTime(lap)}`, 'good', 2000);
        }
        s.next = (s.next + 1) % s.route.gates.length;
      }
      // sortie du parcours
      const off = distToRoute(s.route, P.x, P.z) > (s.D.how === 'foot' ? 12 : s.D.how === 'bike' ? 18 : 25);
      s.off = off ? s.off + dt : 0;
      if (s.off > 6) { this.finish(true, 'Tu as quitté le parcours.'); return; }
    }
    // PNJ
    for (const n of s.npcs) {
      const prog = this.npcProg(n, t, n.sl.back);
      const moved = prog - n.prog; n.prog = prog;
      // dépassements : on se décale
      const ahead = s.npcs.find((o) => o !== n && o.prog > prog && o.prog - prog < (s.D.how === 'f1' ? 7 : 3) && Math.abs(o.lat - n.lat) < 1.4);
      const target = ahead ? -Math.sign(n.lat || 1) * (s.D.how === 'f1' ? 3 : 1.4) : n.sl.lat * 0.5;
      n.lat += (target - n.lat) * Math.min(1, dt * 1.2);
      const p = routeAt(s.route, prog);
      n.root.position.set(p.x + Math.cos(p.yaw) * n.lat, 0, p.z - Math.sin(p.yaw) * n.lat);
      const dy = Math.atan2(Math.sin(p.yaw - n.root.rotation.y), Math.cos(p.yaw - n.root.rotation.y));
      n.root.rotation.y += dy * Math.min(1, dt * 8);
      if (n.av) n.av.update(dt, { speed: Math.max(0, moved / dt), grounded: true });
      else n.vis.roll(Math.max(0, moved), 0);
    }
    // affichage
    s.hudT -= dt;
    if (s.hudT <= 0) {
      s.hudT = 0.2;
      const gt = s.route.gates[s.next];
      const gs = s.next === 0 ? s.route.len : (s.next / s.route.gates.length) * s.route.len;
      const myProg = s.lap * s.route.len + gs - Math.min(Math.hypot(P.x - gt.x, P.z - gt.z), s.route.len / s.route.gates.length);
      const pos = 1 + s.npcs.filter((n) => n.prog > myProg).length;
      const best = s.laps.length ? Math.min(...s.laps) : null;
      g.hud.track('race', { title: `${s.D.icon} ${s.M.name}`, timer: fmtTime(t), text: `Tour ${Math.min(s.M.laps, s.lap + 1)}/${s.M.laps}${s.npcs.length ? ` · position ${pos}/${s.npcs.length + 1}` : ''} · meilleur tour ${fmtTime(best)}${s.v ? ` · ${Math.round(Math.abs(s.v.sim.speed) * 3.6)} km/h` : ''}`, button: { label: 'Abandonner', onclick: () => this.finish(true) } });
    }
  }

  async finish(abandon, why = '') {
    const s = this.s, g = this.g;
    if (!s) return;
    this.s = null;
    const time = (g.now() - s.go) / 1000;
    this.lights?.remove();
    for (const n of s.npcs) { g.engine.scene.remove(n.root); n.vis?.dispose?.(); n.av?.dispose?.(); g.labels.remove?.(n.lab); }
    g.hud.track('race', null);
    g.player.speedBonus = s.prevSpeed ?? 1;
    if (s.v) g.player.pos.set(s.v.pos.x, g.player.pos.y, s.v.pos.z);
    g.net.sendState?.(g.player.netState(), g.player.zone);   // position exacte sur la ligne
    const r = await req(g, 'sport.finish', abandon ? { abandon: true } : { time, laps: s.laps });
    if (s.v) { if (g.vehicles.current === s.v) g.vehicles.exit(true); g.vehicles.despawn(s.v, false); }
    if (abandon) { g.ui.toast(`🏳️ Abandon. ${why}`, 'bad', 3000); return; }
    if (!r) return;
    g.sfx(r.rank === 1 || r.record ? 'levelup' : 'success');
    const pos = r.rank ? `${r.rank === 1 ? '🥇 VICTOIRE' : r.rank === 2 ? '🥈 2e' : r.rank === 3 ? '🥉 3e' : `${r.rank}e`} sur ${r.of}. ` : '';
    g.ui.dialog({ name: s.D.how === 'f1' ? 'Ton ingénieur·e de course' : 'Coach Jean-Mich', role: s.M.name, text: `${pos}Temps : ${fmtTime(r.total)}${r.bestLap ? ` · meilleur tour ${fmtTime(r.bestLap)}` : ''}.${r.record ? ' NOUVEAU RECORD PERSO !' : ` Record : ${fmtTime(r.best)}.`}${r.prize ? ` Prix : ${fmt(r.prize)} PC.` : ''}${r.grid ? ` Tu partiras P${r.grid} au prochain Grand Prix.` : ''} Niveau ${Math.round(r.skill)}/100, endurance ${r.endurance}/100.`, choices: [
      { label: '🔁 Recommencer', action: (m) => { m.close(); g.player.teleport(s.start.x, s.start.z, s.start.yaw); this.desk(s.disc); } },
      { label: 'OK', ghost: true, action: (m) => m.close() },
    ] });
  }
}
