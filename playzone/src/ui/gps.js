import * as THREE from 'three';
import { findRoute, BUILDINGS, BUILDING_BY_ID, MINIGAME_SPOTS, POI, PARKINGS, GAS_STATIONS, CITY_POI } from '../../shared/world-layout.js';
import { HOUSING_BY_ID } from '../../shared/property.js';
import { VEHICLES } from '../../shared/content/vehicles.js';

// GPS : itinéraire le long des routes jusqu'à une destination (repère, boutique, mission...).
// Le trajet s'affiche sur la mini-carte, sur la carte du téléphone et au sol (ruban lumineux),
// et se recalcule si on s'en écarte.

const CAT = {
  shop: '🛍️ Boutiques', food: '🍽️ Manger et boire', cars: '🚗 Véhicules et garages', service: '🏛️ Services publics',
  leisure: '🎡 Loisirs', job: '💼 Métiers', home: '🏠 Logement', other: '📍 Autres lieux',
};
const FOOD = new Set(['cafe', 'bakery', 'burger', 'pizzeria', 'tacos', 'homard', 'poisson', 'cafe2', 'paillote', 'superette', 'supermarket', 'farm', 'station']);
const CARS = new Set(['vehicles', 'cars-new', 'cars-used', 'bikes', 'repair', 'rental', 'scrapyard']);

// Liste des destinations proposées (chez moi, mes véhicules, bâtiments nommés, lieux de loisirs).
export function destinations(profile = null) {
  const out = [];
  if (profile) {
    const h = HOUSING_BY_ID[profile.home?.place || 'studio'];
    const b = h && BUILDING_BY_ID[h.building];
    if (b) out.push({ id: 'chez-moi', name: `🏠 Chez moi (${h.name})`, cat: 'home', x: b.door.x, z: b.door.z });
    for (const v of profile.vehicles || []) if (v.park) out.push({ id: `veh-${v.id}`, name: `🔑 Mon véhicule : ${VEHICLES[v.model]?.name || v.model}`, cat: 'cars', x: v.park.x, z: v.park.z });
  }
  for (const b of BUILDINGS) {
    if (b.secret || (b.kind === 'house' && b.district)) continue;
    let cat = 'other';
    if (b.kind === 'job') cat = 'job';
    else if (b.kind === 'home' || b.kind === 'home-buy' || b.shop === 'immo') cat = 'home';
    else if (b.shop && FOOD.has(b.shop)) cat = 'food';
    else if (b.shop && CARS.has(b.shop)) cat = 'cars';
    else if (b.kind === 'shop') cat = 'shop';
    else if (['police', 'hospital', 'mairie', 'bank', 'school', 'prison', 'firestation'].includes(b.interior)) cat = 'service';
    else if (['cinema', 'bowling', 'arcade', 'gym'].includes(b.interior)) cat = 'leisure';
    out.push({ id: b.id, name: b.name, cat, x: b.door.x, z: b.door.z });
  }
  out.push({ id: 'arene', name: 'Arène Gonflable (mini-jeux)', cat: 'leisure', x: CITY_POI.arena.x, z: CITY_POI.arena.z + CITY_POI.arena.r + 4 });
  out.push({ id: 'fete', name: 'Fête foraine', cat: 'leisure', x: CITY_POI.funfair.x, z: CITY_POI.funfair.z + 24 });
  out.push({ id: 'circuit', name: 'Circuit Turbo-Mamie', cat: 'leisure', x: CITY_POI.circuit.x - 40, z: CITY_POI.circuit.z + CITY_POI.circuit.rz + 6 });
  out.push({ id: 'parc', name: 'Parc de loisirs (stands)', cat: 'leisure', x: POI.parkGate.x, z: POI.parkGate.z });
  out.push({ id: 'tartes', name: 'Stand de tartes', cat: 'leisure', x: MINIGAME_SPOTS.pieToss.x, z: MINIGAME_SPOTS.pieToss.z });
  out.push({ id: 'place', name: 'Grande Place', cat: 'other', x: 0, z: 12 });
  out.push({ id: 'plage', name: 'Plage des Orteils', cat: 'leisure', x: 0, z: 74 });
  for (const g of GAS_STATIONS) out.push({ id: `gaz-${g.id}`, name: `⛽ ${g.name}`, cat: 'cars', x: g.x, z: g.z });
  for (const p of PARKINGS) out.push({ id: p.id, name: `🅿️ ${p.name}`, cat: 'cars', x: (p.x1 + p.x2) / 2, z: (p.z1 + p.z2) / 2 });
  return out;
}
export const DEST_CATS = CAT;

export class GPS {
  constructor(game) {
    this.game = game;
    this.dest = null;      // { x, z, label }
    this.route = null;     // [{x, z}]
    this.t = 0;
    // ruban lumineux au sol
    this.ribbonMat = new THREE.MeshBasicMaterial({ color: '#29e6ff', transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false });
    this.ribbon = new THREE.Mesh(new THREE.BufferGeometry(), this.ribbonMat);
    this.ribbon.frustumCulled = false;
    this.ribbon.renderOrder = 2;
    game.engine.scene.add(this.ribbon);
  }

  set(dest) {
    this.dest = dest ? { ...dest } : null;
    this.recompute();
    this.game.emit('gps', this.dest);
  }

  clear() { this.set(null); }

  recompute() {
    const g = this.game, P = g.player.pos;
    const far = this.dest && Math.hypot(this.dest.x - P.x, this.dest.z - P.z) > 40;
    this.route = far && !this.dest.arrived && g.player.zone === 'world' ? findRoute(P.x, P.z, this.dest.x, this.dest.z) : null;
    if (this.route) { this.route.unshift({ x: P.x, z: P.z }); this.route.push({ x: this.dest.x, z: this.dest.z }); }
    this.buildRibbon();
  }

  // Distance restante le long de l'itinéraire.
  remaining() {
    if (!this.route) return this.dest ? Math.hypot(this.dest.x - this.game.player.pos.x, this.dest.z - this.game.player.pos.z) : 0;
    let d = 0;
    for (let i = 1; i < this.route.length; i++) d += Math.hypot(this.route[i].x - this.route[i - 1].x, this.route[i].z - this.route[i - 1].z);
    return d;
  }

  // Prochain point à viser (pour la boussole).
  next() {
    if (!this.route || this.route.length < 2) return this.dest;
    return this.route[Math.min(2, this.route.length - 1)];
  }

  buildRibbon() {
    const geo = this.ribbon.geometry;
    if (!this.route) { geo.setAttribute('position', new THREE.Float32BufferAttribute([], 3)); return; }
    const pos = [];
    const r = this.route;
    for (let i = 1; i < r.length; i++) {
      const a = r[i - 1], b = r[i];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      if (len < 0.1) continue;
      const nx = -(b.z - a.z) / len * 0.6, nz = (b.x - a.x) / len * 0.6;
      // tirets de 3 m
      for (let t = 0; t < len; t += 5) {
        const t1 = Math.min(len, t + 3);
        const p = (k) => ({ x: a.x + (b.x - a.x) * k / len, z: a.z + (b.z - a.z) * k / len });
        const p0 = p(t), p1 = p(t1);
        const y = 0.09;
        pos.push(p0.x - nx, y, p0.z - nz, p0.x + nx, y, p0.z + nz, p1.x + nx, y, p1.z + nz, p0.x - nx, y, p0.z - nz, p1.x + nx, y, p1.z + nz, p1.x - nx, y, p1.z - nz);
      }
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeBoundingSphere();
  }

  update(dt) {
    const g = this.game;
    this.ribbon.visible = !!this.route && g.player.zone === 'world';
    if (!this.dest) return;
    this.ribbonMat.opacity = 0.35 + Math.sin(g.engine.time * 4) * 0.15;
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 0.5;
    const P = g.player.pos;
    if (g.player.zone !== 'world') return;
    const d = Math.hypot(this.dest.x - P.x, this.dest.z - P.z);
    if (d < 9 && !this.dest.arrived) {
      this.dest.arrived = true;
      this.route = null; this.buildRibbon();
      if (this.dest.manual) {
        g.ui.toast(`📍 Vous êtes arrivé : ${this.dest.label || 'destination'}`, 'good');
        g.sfx('success');
        g.hud.compassTarget = null;
        this.clear();
      }
      return;
    }
    if (this.dest.arrived) { if (d > 30) { this.dest.arrived = false; this.recompute(); } return; }
    // on avance sur le trajet : retire les points dépassés ; trop loin du trajet -> recalcul
    if (!this.route) { if (d > 40) this.recompute(); return; }
    const r = this.route;
    r[0] = { x: P.x, z: P.z };
    while (r.length > 2 && Math.hypot(r[1].x - P.x, r[1].z - P.z) < 7) r.splice(1, 1);
    const a = r[1], b = r[Math.min(2, r.length - 1)];
    const off = distToSeg(P.x, P.z, a, b);
    if (off > 22 && Math.hypot(a.x - P.x, a.z - P.z) > 22) this.recompute(); else this.buildRibbon();
  }
}

function distToSeg(x, z, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2));
  return Math.hypot(a.x + dx * t - x, a.z + dz * t - z);
}
