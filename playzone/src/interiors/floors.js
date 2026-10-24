import * as THREE from 'three';
import { h } from '../ui/dom.js';
import { buildMergedGeometry, SHAPES } from '../core/static-builder.js';
import { actorMaterial } from '../core/materials.js';
import { BUILDINGS } from '../../shared/world-layout.js';
import { HOUSING_BY_ID } from '../../shared/property.js';
import { mulberry32, hashString } from '../../shared/rng.js';
import { Avatar } from '../characters/avatar.js';
import { DEFAULT_APPEARANCE, SKINS, HAIR_STYLES, HAIR_COLORS, COLORS } from '../../shared/appearance.js';
import { chatMode } from '../characters/chat-ui.js';

// ÉTAGES DES IMMEUBLES : l'ascenseur du hall dessert chaque étage (palier avec les portes des
// appartements, où l'on peut sonner chez les voisins, fenêtre avec vue sur la ville) et le toit-terrasse
// (transats, jardinières, guirlandes ; héliport en haut des tours), d'où la vue porte loin.
const FO = { x: 1000, z: 260 };             // palier : hors de la carte (comme le logement)
const CORR = { w: 4.4, d: 24 };
export const TALL = (b) => (b.floors || 1) >= 3 && ['lobby', 'office'].includes(b.interior);
const NEIGHBOURS = [
  ['Mme Pichon', 'Voisine curieuse', ['Ah, c\'est vous ! J\'ai tout vu, tout entendu. Comme d\'habitude.', 'Vous avez reçu un colis, je l\'ai gardé... enfin, je l\'ai ouvert.']],
  ['Kevin', 'Étudiant fatigué', ['Mmmh... il est quelle heure ? Je dormais.', 'Si c\'est pour la fête de samedi, c\'était pas moi.']],
  ['M. Duroc', 'Syndic de copropriété', ['La réunion de copropriété, c\'est jeudi. Apportez des chaises.', 'L\'ascenseur ? Il fonctionne. Officiellement.']],
  ['Léa', 'Musicienne', ['Désolée pour la batterie hier soir ! Je joue moins fort maintenant, promis.', 'Vous voulez venir écouter ma nouvelle chanson ?']],
  ['Papi Jo', 'Retraité', ['Entrez, entrez ! J\'ai des petits gâteaux. Un peu durs, mais bons.', 'De mon temps, les immeubles avaient des escaliers. Et on montait à pied !']],
  ['Inès', 'Chef cuisinière', ['Ça sent bon, hein ? Lasagnes maison. Revenez dans dix minutes !', 'Vous n\'auriez pas un œuf ? Il m\'en manque un.']],
];
const NOBODY = ['Personne ne répond... on entend juste une télé allumée.', 'Un chien aboie derrière la porte. Mieux vaut ne pas insister.', 'Silence. Il y a un paillasson « Partez ».', 'Une voix lointaine : « On n\'achète rien ! »'];

export class Floors {
  constructor(g) {
    this.g = g;
    this.at = null;        // { b, n } : immeuble et étage visités
    this.group = new THREE.Group();
    this.group.position.set(FO.x, 0, FO.z);
    this.group.visible = false;
    g.engine.scene.add(this.group);
    this.colliders = [];
    this.inters = [];
    this.neighbour = null;
    // ascenseur du palier
    this.inters.push(g.interactions.add({ zone: 'home-etage', x: FO.x, z: FO.z + CORR.d / 2 - 1.4, r: 2, priority: 2, label: '🛗 Ascenseur', action: () => this.panel(this.at.b) }));
    // toits-terrasses : redescendre par la cage d'ascenseur
    for (const b of BUILDINGS.filter(TALL)) {
      const [x, z] = roofLift(b);
      g.interactions.add({ x, z, r: 3.4, priority: 3, level: b.h, label: '🛗 Ascenseur (redescendre)', action: () => this.panel(b) });
    }
  }

  // Tableau de l'ascenseur : rez-de-chaussée, étages, toit, son appartement.
  panel(b) {
    const g = this.g, floors = b.floors, p = g.profile;
    const mine = p.properties.map((x) => HOUSING_BY_ID[x.id]).find((x) => x?.kind === 'appart' && x.building === b.id);
    const m = g.ui.modal({
      title: `🛗 ${b.name}`, sub: `${floors} étages · ${this.at?.b === b ? `tu es au ${this.at.n}e` : 'choisis ta destination'}`, width: 'min(380px, 94vw)',
      build: (body) => {
        const go = (fn) => () => { m.close(); g.sfx?.('door'); fn(); };
        const grid = h('div.lift-grid');
        grid.append(h('button.lift-btn.roof', { onclick: go(() => this.roof(b)) }, '🌇 Toit-terrasse'));
        for (let n = floors - 1; n >= 1; n--) grid.append(h(`button.lift-btn${this.at?.b === b && this.at.n === n ? '.on' : ''}`, { onclick: go(() => this.visit(b, n)) }, `${n}`));
        grid.append(h('button.lift-btn.rdc', { onclick: go(() => this.ground(b)) }, 'RDC · Hall'));
        body.append(grid);
        if (mine) body.append(h('button.btn.block', { style: { marginTop: '10px' }, onclick: go(() => { this.leave(); g.home.enter(null, null, null, { x: b.door.x, z: b.door.z + 1 }); }) }, `🏠 Mon appartement (${mine.name})`));
      },
    });
  }

  // Palier d'un étage (décor généré selon l'immeuble et l'étage).
  visit(b, n) {
    const g = this.g;
    this.fade(() => {
      this.build(b, n);
      this.at = { b, n };
      g.player.zone = 'home-etage';
      if (g.hud) g.hud.lastZone = null;   // nom de l'étage affiché à nouveau
      g.player.teleport(FO.x, FO.z + CORR.d / 2 - 3, Math.PI, 0.02);
      g.cam.snap(g.player.pos, 0); g.cam.pitch = 0.8; g.cam.dist = 10;
      g.world.static.visible = false; g.world.terrain.visible = false; g.world.water.visible = false;
      this.group.visible = true;
      g.hud.track('etage', { title: `🏢 ${b.name}`, text: `${n}e étage · sonne chez les voisins, ou reprends l'ascenseur.` });
      g.emit('zone', g.player.zone);
    });
  }

  roof(b) {
    const g = this.g;
    this.fade(() => {
      this.leave(true);
      const [x, z] = roofLift(b);
      g.player.teleport(x + 2.5, z, Math.PI / 2, b.h + 0.05);
      g.cam.snap(g.player.pos, 0); g.cam.pitch = 0.35; g.cam.dist = 11;
      g.hud.track('etage', { title: `🌇 Toit de ${b.name}`, text: 'Profite de la vue ! L\'ascenseur te ramène en bas.' });
      g.emit('zone', 'world');
    });
  }

  ground(b) {
    const g = this.g;
    this.fade(() => {
      this.leave(true);
      g.player.teleport(b.door.x, b.door.z, b.facing === 'N' ? Math.PI : 0);
      g.cam.snap(g.player.pos, 0);
      g.hud.track('etage', null);
      g.emit('zone', 'world');
    });
  }

  leave(toWorld = true) {
    const g = this.g;
    if (!this.at) return;
    this.at = null;
    this.group.visible = false;
    this.neighbour?.root && this.group.remove(this.neighbour.root);
    this.neighbour = null;
    if (toWorld) { g.player.zone = 'world'; g.world.static.visible = true; g.world.terrain.visible = true; g.world.water.visible = true; }
  }

  fade(fn) { this.g.home.fade(fn); }

  build(b, n) {
    const g = this.g;
    for (const c of this.colliders) g.collision.remove(c);
    this.colliders = [];
    for (const it of this.inters.splice(1)) g.interactions.remove(it);
    if (this.mesh) { this.group.remove(this.mesh); this.mesh.geometry.dispose(); }
    if (this.neighbour) { this.group.remove(this.neighbour.root); this.neighbour = null; }
    const r = mulberry32(hashString(`${b.id}:${n}`));
    const W = CORR.w, D = CORR.d, H = 3;
    const wall = ['#f4f1ea', '#e9edf2', '#f6e7c8', '#e3f2fd', '#fde2e4'][Math.floor(r() * 5)];
    const carpet = ['#7a2e2e', '#2b4c7e', '#3a5a40', '#5c4d7d'][Math.floor(r() * 4)];
    const doorsAt = [];
    this.mesh = new THREE.Mesh(buildMergedGeometry((sb) => {
      sb.box(0, -0.2, 0, W + 0.6, 0.2, D + 0.6, '#b8a58a');
      sb.box(0, -0.01, 0, W - 1.2, 0.03, D - 1, carpet);
      for (const sx of [-1, 1]) sb.box(sx * (W / 2 + 0.15), 0, 0, 0.3, H, D, wall);
      sb.box(0, 0, -D / 2 - 0.15, W, H, 0.3, wall);
      sb.box(0, 0, D / 2 + 0.15, W, H, 0.3, wall);
      // plinthes, appliques, plafonniers
      for (const sx of [-1, 1]) sb.box(sx * (W / 2 - 0.02), 0, 0, 0.05, 0.12, D, '#7a5230');
      for (let z = -D / 2 + 3; z < D / 2 - 2; z += 5) for (const sx of [-1, 1]) sb.box(sx * (W / 2 - 0.08), 2.3, z + 2.5, 0.12, 0.25, 0.5, '#fff3c4', 0, 'glow');
      // portes des appartements (3 de chaque côté), numéros, paillassons
      for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) {
        const z = -D / 2 + 4 + i * 6.5;
        sb.box(sx * (W / 2 - 0.05), 0, z, 0.1, 2.2, 1.1, ['#7a4b2a', '#5a3d2b', '#2b2d42', '#8d5a34'][Math.floor(r() * 4)]);
        sb.box(sx * (W / 2 - 0.12), 1.05, z + 0.38, 0.06, 0.08, 0.08, '#ffd23f');
        sb.box(sx * (W / 2 - 0.1), 1.75, z, 0.04, 0.22, 0.4, '#d4a017');
        sb.box(sx * (W / 2 - 0.7), 0, z, 0.9, 0.03, 0.6, ['#7a5230', '#a0703c', '#3a5a40'][Math.floor(r() * 3)]);
        doorsAt.push({ x: sx * (W / 2 - 0.9), z, num: `${n}${i * 2 + (sx > 0 ? 2 : 1)}` });
      }
      // fenêtre au fond (vue sur la ville, de plus en plus haute)
      sb.box(0, 0.8, -D / 2 + 0.02, 2.6, 1.8, 0.06, '#bfe3ff', 0, 'windows');
      sb.box(0, 0.7, -D / 2 + 0.25, 2.9, 0.1, 0.5, '#f4f1ea');
      // plantes et banc
      sb.cyl(-W / 2 + 0.6, 0, -D / 2 + 0.8, 0.3, 0.5, '#8d5a34', 10); sb.blob(-W / 2 + 0.6, 0.9, -D / 2 + 0.8, 0.5, '#3a7d44', 1.2);
      sb.box(W / 2 - 0.6, 0, -D / 2 + 1.2, 0.5, 0.45, 1.6, '#a0703c');
      // ascenseur (portes métalliques, boutons)
      sb.box(-0.7, 0, D / 2 - 0.02, 1.3, 2.3, 0.1, '#adb5bd'); sb.box(0.7, 0, D / 2 - 0.02, 1.3, 2.3, 0.1, '#adb5bd');
      sb.box(0, 2.35, D / 2 - 0.05, 1.2, 0.3, 0.06, '#14141c'); sb.box(1.7, 1.1, D / 2 - 0.05, 0.2, 0.35, 0.06, '#d0d4da');
      // vue : la ville en contrebas, derrière la fenêtre
      const below = -3 * n - 1;
      sb.box(0, below - 0.2, -D / 2 - 120, 400, 0.2, 230, '#6fb14d');
      for (let k = 0; k < 40; k++) { const bw = 6 + r() * 14, bh = 4 + r() * 3 * Math.max(3, n + 2); sb.box((r() - 0.5) * 220, below, -D / 2 - 18 - r() * 200, bw, bh, bw * (0.7 + r() * 0.6), COLORS[Math.floor(r() * COLORS.length)]); }
    }), actorMaterial);
    this.group.add(this.mesh);
    // murs solides
    const c = g.collision;
    this.colliders.push(c.addBox(FO.x - W / 2 - 1, -3, FO.z - D / 2 - 1, FO.x + W / 2 + 1, 0, FO.z + D / 2 + 1, { noCamera: true }));
    for (const sx of [-1, 1]) this.colliders.push(c.addBoxC(FO.x + sx * (W / 2 + 0.15), FO.z, 0.3, D, 0, H, { noCamera: true }));
    this.colliders.push(c.addBoxC(FO.x, FO.z - D / 2 - 0.15, W, 0.3, 0, H, { noCamera: true }));
    this.colliders.push(c.addBoxC(FO.x, FO.z + D / 2 + 0.15, W, 0.3, 0, H, { noCamera: true }));
    // sonner aux portes
    for (const d of doorsAt) {
      this.inters.push(g.interactions.add({ zone: 'home-etage', x: FO.x + d.x, z: FO.z + d.z, r: 1.5, priority: 1, label: `🔔 Sonner à l'appartement ${d.num}`, action: () => this.ring(b, n, d) }));
    }
  }

  // Un voisin ouvre (ou pas) ; on peut discuter librement avec lui.
  ring(b, n, d) {
    const g = this.g, r = mulberry32(hashString(`${b.id}:${d.num}`));
    g.sfx?.('pop');
    if (r() < 0.35) { g.ui.toast(`🚪 ${NOBODY[Math.floor(r() * NOBODY.length)]}`, '', 3500); return; }
    const [name, role, lines] = NEIGHBOURS[Math.floor(r() * NEIGHBOURS.length)];
    if (this.neighbour) this.group.remove(this.neighbour.root);
    const av = new Avatar({ ...DEFAULT_APPEARANCE, skin: SKINS[Math.floor(r() * 8)], hair: HAIR_STYLES[Math.floor(r() * HAIR_STYLES.length)], hairColor: HAIR_COLORS[Math.floor(r() * 7)], topColor: COLORS[Math.floor(r() * COLORS.length)] }, {});
    av.root.position.set(d.x + Math.sign(d.x) * 0.5, 0, d.z);
    av.root.rotation.y = d.x > 0 ? -Math.PI / 2 : Math.PI / 2;
    av.update(0.016, { speed: 0, grounded: true, pose: 'wave' });
    this.group.add(av.root);
    this.neighbour = av;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const choices = [
      { label: '⌨️ Discuter', action: (m) => chatMode(g, m, { id: `${b.id}:${d.num}`, name, role }, (x) => x.show(pick(lines), choices)) },
      { label: 'Au revoir', ghost: true, action: (m) => { m.close(); setTimeout(() => { if (this.neighbour === av) { this.group.remove(av.root); this.neighbour = null; } }, 600); } },
    ];
    g.ui.dialog({ name, role: `${role} · appartement ${d.num}`, text: pick(lines), choices });
  }

  update(dt) {
    if (this.at && this.neighbour) this.neighbour.update(dt, { speed: 0, grounded: true, pose: 'idle' });
    // revenu au sol (ou parti ailleurs) : on efface l'info « toit »
    const g = this.g;
    if (!this.at && g.player.zone === 'world' && g.player.pos.y < 3 && this._roofHud !== false) { g.hud.track('etage', null); this._roofHud = false; }
    else if (g.player.pos.y >= 3) this._roofHud = true;
  }
}

// Cage d'ascenseur sur le toit (coin arrière du bâtiment).
export function roofLift(b) { return [b.x + b.w / 2 - 3, b.z - b.d / 2 + 3]; }

// Décor des toits-terrasses (statique) : colliders du toit et du garde-corps, transats, jardinières,
// guirlandes, cage d'ascenseur ; héliport sur les tours.
export function buildRoofs(sb, col) {
  for (const b of BUILDINGS.filter(TALL)) {
    const y = b.h, r = mulberry32(hashString(`roof:${b.id}`));
    const x1 = b.x - b.w / 2, x2 = b.x + b.w / 2, z1 = b.z - b.d / 2, z2 = b.z + b.d / 2;
    col.addBox(x1, y - 0.4, z1, x2, y, z2);
    for (const [a, c, e, f] of [[x1, z1, x2, z1 + 0.3], [x1, z2 - 0.3, x2, z2], [x1, z1, x1 + 0.3, z2], [x2 - 0.3, z1, x2, z2]]) col.addBox(a, y, c, e, y + 1.1, f);
    // garde-corps vitré
    sb.box(b.x, y + 0.8, z1 + 0.15, b.w, 0.3, 0.12, '#d0d4da'); sb.box(b.x, y + 0.8, z2 - 0.15, b.w, 0.3, 0.12, '#d0d4da');
    sb.box(x1 + 0.15, y + 0.8, b.z, 0.12, 0.3, b.d, '#d0d4da'); sb.box(x2 - 0.15, y + 0.8, b.z, 0.12, 0.3, b.d, '#d0d4da');
    // cage d'ascenseur
    const [lx, lz] = roofLift(b);
    sb.box(lx, y, lz, 2.4, 2.6, 2.4, '#adb5bd'); sb.box(lx, y + 2.6, lz, 2.7, 0.2, 2.7, '#6c757d');
    col.addBoxC(lx, lz, 2.4, 2.4, y, y + 2.6);
    if (b.style === 'tower') {   // héliport
      sb.cyl(b.x, y, b.z, Math.min(b.w, b.d) * 0.35, 0.08, '#2b2d42', 24);
      sb.box(b.x - 1.6, y + 0.09, b.z, 0.5, 0.02, 4, '#ffffff'); sb.box(b.x + 1.6, y + 0.09, b.z, 0.5, 0.02, 4, '#ffffff'); sb.box(b.x, y + 0.09, b.z, 3.2, 0.02, 0.5, '#ffffff');
      continue;
    }
    // terrasse : platelage, transats, parasols, jardinières, guirlandes
    sb.box(b.x, y, b.z, b.w * 0.6, 0.06, b.d * 0.5, '#a0703c');
    for (let i = 0; i < 3; i++) {
      const tx = b.x - b.w * 0.2 + i * b.w * 0.2, tz = b.z + b.d * 0.12;
      sb.add(SHAPES.box(), { x: tx, y: y + 0.3, z: tz, sx: 0.7, sy: 0.1, sz: 1.8, rx: -0.12, color: ['#2ec4b6', '#ff9f1c', '#e63946'][i] });
      sb.box(tx, y, tz, 0.6, 0.3, 1.6, '#f4f1ea');
    }
    sb.cyl(b.x, y, b.z - b.d * 0.12, 0.05, 2.2, '#d0d4da', 6); sb.cone(b.x, y + 2.1, b.z - b.d * 0.12, 1.5, 0.5, ['#ffd23f', '#ff70a6', '#3a86ff'][Math.floor(r() * 3)], 12);
    for (const sx of [-1, 1]) { sb.box(b.x + sx * (b.w / 2 - 1), y, b.z, 0.8, 0.6, b.d * 0.6, '#8d5a34'); for (let k = 0; k < 5; k++) sb.blob(b.x + sx * (b.w / 2 - 1), y + 0.8, b.z - b.d * 0.25 + k * b.d * 0.12, 0.45, ['#3a7d44', '#6a994e', '#ff70a6'][k % 3], 1); }
    for (let k = 0; k <= 8; k++) sb.sphere(x1 + 1 + k * (b.w - 2) / 8, y + 2.2 - Math.sin(k / 8 * Math.PI) * 0.4, z2 - 1, 0.09, ['#ffd23f', '#ff70a6', '#4ffbdf'][k % 3], 6, 'glow');
  }
}
