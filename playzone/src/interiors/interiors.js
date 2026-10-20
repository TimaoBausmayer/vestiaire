import * as THREE from 'three';
import { BUILDINGS } from '../../shared/world-layout.js';
import { StaticBuilder, SHAPES } from '../core/static-builder.js';
import { MATS, CUT } from '../core/materials.js';
import { buildingFrame, isEnterable, groundStorey, INTERIOR_STYLE, facadeOpenings } from '../world/buildings.js';
import { TEMPLATES, STAFF_LINES } from './templates.js';
import { furnitureGeometry, furnitureFootprint } from '../home/furniture.js';
import { FUN_LABEL, isHousePlace } from '../home/home.js';
import { jobsAt } from '../../shared/authority-careers.js';
import { Avatar } from '../characters/avatar.js';
import { CarVisual, vehicleGeometries } from '../vehicles/car-models.js';
import { VEHICLES } from '../../shared/content/vehicles.js';
import { buildAnimal } from '../animals/models.js';
import { mulberry32, hashString } from '../../shared/rng.js';
import { SKINS, HAIR_STYLES, HAIR_COLORS, COLORS } from '../../shared/appearance.js';
import { runAction } from './actions.js';

// INTÉRIEURS VISITABLES : on entre réellement dans les bâtiments par leur porte. Quand le joueur est à
// l'intérieur, le toit, les étages et les murs côté caméra s'escamotent (vue "maison de poupée") et la
// caméra plonge. L'aménagement (meubles, rayons, personnel, points d'interaction) n'est construit que
// pour les bâtiments proches du joueur, et retiré quand on s'éloigne : la grande ville reste légère.

const LOAD_R = 42, UNLOAD_R = 70;
const ENTERABLE = BUILDINGS.filter(isEnterable);

// Tenues du personnel selon le rôle.
const ROLE_LOOK = {
  cuisinier: { hat: 'toque', top: 'tablier', topColor: '#f4f1ea' }, boulanger: { hat: 'toque', top: 'tablier', topColor: '#f4f1ea' },
  serveur: { top: 'chemise', topColor: '#2b2d42' }, equipier: { hat: 'casquette', top: 'tshirt', topColor: '#e63946' },
  coiffeur: { top: 'chemise', topColor: '#cdb4db' }, policier: { hat: 'casquette', top: 'chemise', topColor: '#1d3557' }, gardien: { hat: 'casquette', top: 'chemise', topColor: '#4a4e69' },
  pompier: { hat: 'casque-pompier', top: 'uniforme-pompier', topColor: '#2b2d42' }, medecin: { top: 'tablier', topColor: '#ffffff' },
  infirmier: { top: 'chemise', topColor: '#90e0ef' }, mecano: { hat: 'casquette', top: 'debardeur', topColor: '#495057' },
  commercial: { top: 'costume', topColor: '#14213d' }, banquier: { top: 'costume', topColor: '#2b2d42' }, agent: { top: 'costume', topColor: '#3d5a80' },
  maire: { hat: 'haut-de-forme', top: 'costume', topColor: '#14213d' }, fermier: { hat: 'paille', top: 'raye', topColor: '#7a5230' },
  coach: { top: 'debardeur', topColor: '#ff70a6' }, professeur: { top: 'chemise', topColor: '#f4f1ea' }, gerant: { top: 'hawai', topColor: '#ff3fa4' },
  caissier: { top: 'tshirt', topColor: '#d00000' }, geek: { top: 'tshirt', topColor: '#2b2d42' }, ouvrier: { hat: 'casquette', top: 'gilet-livreur', topColor: '#ff9f1c' },
  manutentionnaire: { top: 'gilet-livreur', topColor: '#ffd23f' }, ferrailleur: { hat: 'casquette', top: 'debardeur', topColor: '#6c757d' },
};
const ROLE_NAME = {
  vendeur: 'Vendeur·se', geek: 'Technicien·ne', soigneur: 'Soigneur·se', boulanger: 'Boulanger·ère', serveur: 'Serveur·se', cuisinier: 'Cuisinier·ère',
  equipier: 'Équipier·ère', caissier: 'Caissier·ère', commercial: 'Commercial·e', mecano: 'Mécanicien·ne', manutentionnaire: 'Chef d\'entrepôt', ouvrier: 'Ouvrier·ère',
  accueil: 'Accueil', agent: 'Agent·e', ferrailleur: 'Ferrailleur·se', policier: 'Policier·ère', infirmier: 'Infirmier·ère', medecin: 'Médecin', pompier: 'Pompier·ère',
  habitant: 'Habitant·e', concierge: 'Concierge', banquier: 'Banquier·ère', secretaire: 'Secrétaire de mairie', maire: 'Le Maire', gerant: 'Gérant·e', coach: 'Coach',
  professeur: 'Professeur·e', gardien: 'Gardien·ne', fermier: 'Fermier·ère', coiffeur: 'Coiffeur·se',
};
const FIRST = ['Gégé', 'Josiane', 'Kévin', 'Mireille', 'Bertrand', 'Sonia', 'Jean-Claude', 'Lulu', 'Fatou', 'Yannick', 'Paulette', 'Momo', 'Ginette', 'Rachid', 'Odette', 'Nono'];

export class Interiors {
  constructor(game) {
    this.game = game;
    this.loaded = new Map();     // id -> intérieur chargé
    this.inside = null;          // bâtiment où se trouve le joueur
    this.t = 0;
    this.camSaved = null;
    this.houseData = new Map();  // en ligne : maisons d'autres joueurs { owner, home, at }
    this.buildDoors();
    game.net.on?.('house_data', (m) => {
      this.houseData.set(m.id, { ...m, at: performance.now() });
      if (this.loaded.has(m.id)) this.reload(m.id);
    });
    // déco modifiée / déménagement : on reconstruit l'intérieur concerné
    game.on('profile', (p) => {
      const sig = JSON.stringify([p.home.place, p.home.furniture]);
      if (sig === this.homeSig) return;
      const prev = this.homePlace;
      this.homeSig = sig; this.homePlace = p.home.place;
      for (const id of new Set([prev, p.home.place])) if (id && this.loaded.has(id)) this.reload(id);
    });
  }

  reload(id) {
    const b = ENTERABLE.find((x) => x.id === id);
    if (!b) return;
    this.unload(id);
    this.load(b);
  }

  // Une maison de joueur ? (la sienne, ou en ligne celle d'un autre : on demande ses meubles au serveur)
  homeView(b) {
    const g = this.game, p = g.profile;
    if (b.kind !== 'house') return null;
    if (p && p.home.place === b.id && isHousePlace(b.id)) return { furniture: p.home.furniture, owner: p.name, mine: true };
    if (g.net.mode !== 'online') return null;
    const d = this.houseData.get(b.id);
    if (!d || performance.now() - d.at > 60_000) { if (!d?.pending) { this.houseData.set(b.id, { ...(d || {}), pending: true, at: d?.at || -1e9 }); g.net.send({ t: 'house', id: b.id }); } }
    return d?.owner ? { furniture: d.home?.furniture || [], owner: d.owner.name, mine: false } : null;
  }

  // ---------------------------------------------------------------- portes (vantaux instanciés)
  buildDoors() {
    this.doors = [];
    for (const b of ENTERABLE) {
      const F = buildingFrame(b);
      const ops = b.openings || facadeOpenings(b, F.W);
      const op = ops.find((o) => o.door);
      if (!op) continue;
      const house = b.kind === 'house' || b.interior === 'house';
      const [cx, cz] = F.L(op.x, F.D / 2 - 0.15);
      const leaves = house ? 1 : 2;
      for (let k = 0; k < leaves; k++) {
        this.doors.push({ b, F, op, k, leaves, house, cx, cz, open: 0, glass: !house && b.kind !== 'decor' });
      }
    }
    const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.2 });
    this.doorMesh = new THREE.InstancedMesh(geo, mat, this.doors.length);
    const col = new THREE.Color();
    this.doors.forEach((d, i) => { this.doorMesh.setColorAt(i, col.set(d.house ? shadeHex(d.b.roofColor || '#7a4b2a') : d.glass ? '#8fb8d8' : '#6b4f3a')); this.placeDoor(d, i); });
    this.doorMesh.castShadow = false;
    this.game.engine.scene.add(this.doorMesh);
  }

  placeDoor(d, i) {
    const { F, op, k, leaves } = d;
    const lw = op.w / leaves, h = op.h - 0.05;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(lw, h, 0.08), p = new THREE.Vector3();
    let lx, lz = F.D / 2 - 0.15, ry = F.th;
    if (leaves === 1) {
      // porte battante : charnière à gauche, s'ouvre vers l'intérieur
      const hx = op.x - op.w / 2, a = d.open * 1.45;
      lx = hx + Math.cos(a) * lw / 2; lz -= Math.sin(a) * lw / 2;
      ry = F.th + a;
    } else {
      // portes coulissantes vers les côtés
      const side = k === 0 ? -1 : 1;
      lx = op.x + side * (lw / 2 + d.open * lw * 0.95);
      lz -= 0.06;
    }
    const [x, z] = F.L(lx, lz);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry);
    m.compose(p.set(x, 0.05, z), q, this.inside === d.b ? s.set(0, 0, 0) : s);
    this.doorMesh.setMatrixAt(i, m);
  }

  updateDoors(dt) {
    const g = this.game, P = g.player.pos;
    const actors = [P];
    if (g.npcs) for (const n of g.npcs.list) actors.push(n.pos);
    if (g.remotes) for (const r of g.remotes.all()) actors.push(r.pos);
    let dirty = false;
    this.doors.forEach((d, i) => {
      if (Math.abs(d.cx - P.x) > 60 || Math.abs(d.cz - P.z) > 60) return;
      let want = 0;
      for (const a of actors) if (Math.abs(a.x - d.cx) < 3.2 && Math.abs(a.z - d.cz) < 3.2) { want = 1; break; }
      const prev = d.open;
      d.open += (want - d.open) * Math.min(1, dt * 6);
      if (Math.abs(d.open - prev) > 0.002 || d.forceUpdate) { this.placeDoor(d, i); dirty = true; d.forceUpdate = false; }
      if (want && prev < 0.05 && Math.hypot(P.x - d.cx, P.z - d.cz) < 4 && !d.house && d.glass) g.sfx('pop');
    });
    if (dirty) this.doorMesh.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------- construction d'un intérieur
  load(b) {
    const g = this.game;
    const F = buildingFrame(b);
    const { th, W, D, L } = F;
    const sb = new StaticBuilder(Infinity);
    const colliders = [], spots = [], staff = [], dyn = [];
    const st = INTERIOR_STYLE[b.interior] || INTERIOR_STYLE.shop;
    const rand = mulberry32(hashString(b.id));
    const gH = groundStorey(b);
    const ops = b.openings || facadeOpenings(b, W);
    const door = ops.find((o) => o.door) || ops[0];
    const view = this.homeView(b);
    const tt = {
      b, F, gH, st, rand, door, home: view,
      footprint: furnitureFootprint, funLabel: (id) => FUN_LABEL[id],
      inner: { x1: -W / 2 + 0.4, x2: W / 2 - 0.4, z1: -D / 2 + 0.4, z2: D / 2 - 0.4 },
      box: (lx, y, lz, w, h, d, color, mat = 'main', ry = 0) => { const [x, z] = L(lx, lz); sb.box(x, y + 0.04, z, w, h, d, color, th + ry, mat); },
      cyl: (lx, y, lz, r, h, color, seg = 10, rx = 0) => { const [x, z] = L(lx, lz); sb.add(SHAPES.cyl(seg), { x, y: y + 0.04, z, sx: r * 2, sy: h, sz: r * 2, rx, ry: th, color }); },
      sphere: (lx, y, lz, r, color) => { const [x, z] = L(lx, lz); sb.sphere(x, y + 0.04, z, r, color, 8); },
      furn: (id, lx, lz, ry = 0, scale = 1) => { const [x, z] = L(lx, lz); sb.addColored(furnitureGeometry(id), x, 0.04, z, th + ry, scale); },
      add: (kind, lx, lz) => { if (kind === 'hay') { const [x, z] = L(lx, lz); sb.add(SHAPES.cyl(12), { x, y: 0.7, z, sx: 1.4, sy: 1.6, sz: 1.4, rz: Math.PI / 2, ry: th, color: '#e9c46a' }); } },
      solid: (lx, lz, w, d, h = 1, ry = 0) => {
        const a = th + ry, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
        const ww = w * c + d * s, dd = w * s + d * c;
        const [x, z] = L(lx, lz);
        colliders.push(g.collision.addBox(x - ww / 2, 0, z - dd / 2, x + ww / 2, h, z + dd / 2, { interior: b.id }));
      },
      wall: (x1, z1, x2, z2, h, color) => {
        const len = Math.hypot(x2 - x1, z2 - z1), ry = Math.atan2(x2 - x1, z2 - z1) - Math.PI / 2;
        tt.box((x1 + x2) / 2, 0, (z1 + z2) / 2, len, h, 0.15, color, 'main', ry);
        tt.solid((x1 + x2) / 2, (z1 + z2) / 2, len, 0.2, h, ry);
      },
      spot: (lx, lz, def) => {
        const [x, z] = L(lx, lz);
        // siège local (machines de sport) → coordonnées du monde
        const seat = def.seat && def.seat.lx !== undefined ? (() => { const [sx, sz] = L(def.seat.lx, def.seat.lz); return { x: sx, z: sz, yaw: th + def.seat.ry, y: def.seat.y }; })() : def.seat;
        spots.push({ x, z, ...def, seat });
      },
      seat: (lx, lz, ry, y) => { const [x, z] = L(lx, lz); spots.push({ x, z, r: 0.9, label: '🪑 S\'asseoir', action: 'sit', seat: { x, z, yaw: th + ry, y } }); },
      bed: (lx, lz, ry) => { const [x, z] = L(lx, lz); spots.push({ x, z, r: 1.6, label: '😴 Faire une sieste', action: 'nap', seat: { x, z, yaw: th + ry, y: 0.6, lie: true } }); },
      staff: (lx, lz, ry, role) => { const [x, z] = L(lx, lz); staff.push({ x, z, yaw: th + ry, role }); },
      vehicleDisplay: (model, lx, lz, ry = 0) => { const [x, z] = L(lx, lz); sb.addColored(staticVehicle(model, '#e63946'), x, 0.04, z, th + ry); },
      showcar: (model, lx, lz, ry = 0, y = 0, stat = false) => {
        const [x, z] = L(lx, lz);
        if (stat) { sb.addColored(staticVehicle(model, VEHICLES[model]?.paint || ['#e63946', '#457b9d', '#2a9d8f', '#ffb703'][Math.floor(rand() * 4)]), x, 0.04 + y, z, th + ry); tt.solid(lx, lz, 2, 4.5, 1.4, ry); return; }
        dyn.push({ type: 'car', model, x, z, y, yaw: th + ry });
        tt.solid(lx, lz, 2, 4.5, 1.4, ry);
        spots.push({ x: x + Math.cos(th) * 3, z: z - Math.sin(th) * 3, r: 2.6, label: `🚗 ${VEHICLES[model].name} — ${VEHICLES[model].price.toLocaleString('fr-FR')} PC`, action: 'car', model });
      },
      pets: (list, lx, lz) => { list.forEach((sp, i) => { const [x, z] = L(lx + i * 2.6, lz); dyn.push({ type: 'animal', species: sp, x, z, yaw: th }); }); },
    };
    (view ? TEMPLATES.home : TEMPLATES[b.interior] || TEMPLATES.shop)(tt);
    // tableau des offres d'emploi (et pointage) près de l'entrée
    if (!view && jobsAt(b).length) {
      const dx = door.x + (door.x > 0 ? -1.9 : 1.9);
      tt.box(dx, 1.1, D / 2 - 0.45, 1.1, 0.8, 0.05, '#f4f1ea'); tt.box(dx, 1.12, D / 2 - 0.48, 0.9, 0.6, 0.02, '#3d8ee8', 'glow');
      tt.spot(dx, D / 2 - 1.4, { label: '💼 Emplois : offres et pointage', action: 'job', r: 1.6, priority: 3 });
    }
    const group = sb.build(MATS, { shadows: false });
    group.name = `interior-${b.id}`;
    for (const m of group.children) { m.receiveShadow = true; m.castShadow = false; }
    g.engine.scene.add(group);
    // objets animés : voitures d'exposition, animaux
    const objects = [];
    for (const d of dyn) {
      if (d.type === 'car') {
        const v = new CarVisual(d.model, { paint: ['#e63946', '#1d3557', '#ffb703', '#2a9d8f', '#8338ec'][objects.length % 5] });
        v.root.position.set(d.x, 0.16 + d.y, d.z); v.root.rotation.y = d.yaw;
        g.engine.scene.add(v.root); objects.push({ root: v.root, dispose: () => v.dispose(), car: v });
      } else {
        const a = buildAnimal(d.species);
        a.root.position.set(d.x, 0.05, d.z); a.root.rotation.y = d.yaw;
        g.engine.scene.add(a.root); objects.push({ root: a.root });
      }
    }
    // personnel
    const people = staff.map((s, i) => {
      const look = staffLook(s.role, hashString(`${b.id}-${i}`));
      const av = new Avatar(look.app, look.extra);
      av.root.position.set(s.x, 0.05, s.z); av.root.rotation.y = s.yaw;
      g.engine.scene.add(av.root);
      const label = document.createElement('div');
      label.className = 'wlabel';
      label.textContent = `${look.name} · ${ROLE_NAME[s.role] || s.role}`;
      const lab = g.labels.add(av.root, label, 2.35, 14);
      return { ...s, av, lab, name: look.name, greeted: 0, baseYaw: s.yaw };
    });
    // points d'interaction
    const inters = spots.map((sp) => g.interactions.add({
      x: sp.x, z: sp.z, r: sp.r || 1.6, priority: sp.priority || 1,
      label: sp.label, action: () => runAction(g, sp.action, { b, spot: sp, interior: this.loaded.get(b.id) }),
    }));
    // le personnel est aussi bavard
    for (const p of people) inters.push(g.interactions.add({ x: p.x, z: p.z, r: 1.7, priority: 0, label: `💬 Parler : ${p.name}`, action: () => runAction(g, 'talk', { b, staff: p }) }));
    const it = { b, group, colliders, inters, people, objects };
    this.loaded.set(b.id, it);
    return it;
  }

  unload(id) {
    const it = this.loaded.get(id);
    if (!it) return;
    const g = this.game;
    g.engine.scene.remove(it.group);
    for (const m of it.group.children) m.geometry.dispose();
    for (const c of it.colliders) g.collision.remove(c);
    for (const i of it.inters) g.interactions.remove(i);
    for (const p of it.people) { g.engine.scene.remove(p.av.root); p.av.dispose?.(); g.labels.remove(p.lab); }
    for (const o of it.objects) { g.engine.scene.remove(o.root); o.dispose?.(); }
    this.loaded.delete(id);
  }

  // Bâtiment visitable qui contient le point (à l'intérieur des murs).
  buildingAt(x, z) {
    for (const b of ENTERABLE) if (Math.abs(x - b.x) < b.w / 2 - 0.2 && Math.abs(z - b.z) < b.d / 2 - 0.2) return b;
    return null;
  }

  update(dt, t) {
    const g = this.game, P = g.player.pos;
    const inWorld = g.player.zone === 'world';
    // chargement / déchargement des aménagements (un bâtiment par tranche de 0,3 s)
    this.t -= dt;
    if (this.t <= 0) {
      this.t = 0.3;
      let loadedOne = false;
      for (const b of ENTERABLE) {
        const d = Math.hypot(b.x - P.x, b.z - P.z) - Math.max(b.w, b.d) / 2;
        const has = this.loaded.has(b.id);
        if (!has && inWorld && d < LOAD_R && !loadedOne) { this.load(b); loadedOne = true; }
        else if (has && (d > UNLOAD_R || !inWorld)) this.unload(b.id);
      }
    }
    // dedans / dehors
    const b = inWorld && !g.vehicles?.driving ? this.buildingAt(P.x, P.z) : null;
    if (b !== this.inside) this.setInside(b);
    if (this.inside) this.updateCut();
    this.updateDoors(dt);
    // personnel : regarde le joueur proche, salue
    for (const it of this.loaded.values()) {
      for (const p of it.people) {
        const d = Math.hypot(p.x - P.x, p.z - P.z);
        const want = d < 6 ? Math.atan2(P.x - p.x, P.z - p.z) : p.baseYaw;
        let dy = want - p.av.root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        p.av.root.rotation.y += dy * Math.min(1, dt * 4);
        p.av.update(dt, { speed: 0, grounded: true, pose: d < 3.5 ? 'wave' : 'idle' });
        if (d < 4 && performance.now() - p.greeted > 25000) {
          p.greeted = performance.now();
          const lines = STAFF_LINES[p.role] || ['Bonjour !'];
          g.labels.bubble(p.av.root, lines[Math.floor(Math.random() * lines.length)], 3500);
        }
      }
    }
  }

  setInside(b) {
    const g = this.game, prev = this.inside;
    this.inside = b;
    const cam = g.cam;
    if (b) {
      CUT.uCutB.value = b.bid;
      CUT.uCutRoof.value = 1;
      g.collision.camIgnore = b.bid;
      cam.inside = { pitch: 0.92, dist: Math.max(8, Math.min(13, Math.max(b.w, b.d) * 0.6)) };
      g.world.dayNight.interiorBoost = 1;
      if (prev) g.emit('building.exit', prev);
      g.emit('building.enter', b);
      this.doors.forEach((d, i) => { if (d.b === b || d.b === prev) { d.forceUpdate = true; this.placeDoor(d, i); } });
      this.doorMesh.instanceMatrix.needsUpdate = true;
      g.hud.showPlace?.(b.name);
    } else {
      CUT.uCutB.value = 0;
      CUT.uCutRoof.value = 0;
      g.collision.camIgnore = 0;
      cam.inside = null;
      g.world.dayNight.interiorBoost = 0;
      this.doors.forEach((d, i) => { if (d.b === prev) { d.forceUpdate = true; this.placeDoor(d, i); } });
      this.doorMesh.instanceMatrix.needsUpdate = true;
      if (prev) g.emit('building.exit', prev);
    }
  }

  // Murs à escamoter : ceux entre la caméra et l'intérieur.
  updateCut() {
    const b = this.inside, c = this.game.engine.camera.position, m = CUT.uCutMask.value;
    m.set(c.z < b.z - b.d / 2 + 0.6 ? 1 : 0, c.z > b.z + b.d / 2 - 0.6 ? 1 : 0, c.x < b.x - b.w / 2 + 0.6 ? 1 : 0, c.x > b.x + b.w / 2 - 0.6 ? 1 : 0);
  }
}

function shadeHex(hex) { const c = new THREE.Color(hex); c.multiplyScalar(1.15); return `#${c.getHexString()}`; }

// Apparence (déterministe) d'un membre du personnel.
function staffLook(role, seed) {
  const r = mulberry32(seed);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const app = {
    skin: pick(SKINS.slice(0, 8)), hair: pick(HAIR_STYLES), hairColor: pick(HAIR_COLORS.slice(0, 7)), eyes: pick(['rond', 'joyeux', 'serieux', 'endormi']),
    body: pick(['mince', 'moyen', 'costaud']), height: 0.95 + r() * 0.1, top: 'tshirt', topColor: pick(COLORS), bottom: r() < 0.7 ? 'jean' : 'short',
    bottomColor: pick(['#2b2d42', '#3d8ee8', '#7a5230', '#14213d']), shoes: '#2b2d42', hat: null, glasses: r() < 0.25 ? pick(['lunettes-rondes', 'moustache', 'monocle']) : null, back: null,
  };
  const extra = ROLE_LOOK[role] || { top: 'chemise', topColor: pick(COLORS) };
  return { app, extra, name: pick(FIRST) };
}

// Version "statique" (couleurs cuites) d'un véhicule, pour les présentoirs et les garages.
const staticCache = new Map();
export function staticVehicle(model, paint) {
  const key = `${model}|${paint}`;
  if (staticCache.has(key)) return staticCache.get(key);
  const src = vehicleGeometries(model).lod;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', src.attributes.position);
  geo.setAttribute('normal', src.attributes.normal);
  const col = src.attributes.color.array.slice();
  const part = src.attributes.cpart.array;
  const c = new THREE.Color(paint);
  for (let i = 0, v = 0; i < col.length; i += 3, v += 4) if (part[v] > 0.5) { col[i] *= c.r; col[i + 1] *= c.g; col[i + 2] *= c.b; }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  staticCache.set(key, geo);
  return geo;
}
