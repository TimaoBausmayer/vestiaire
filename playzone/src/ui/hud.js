import { ISLANDS } from '../../shared/islands.js';
import { PARKS, ZOO } from '../../shared/city.js';
import * as THREE from 'three';
import { h, clear, fmt } from './dom.js';
import { BUILDINGS, ROADS, POND, LAKE, MARINA, CAP_PORT, zoneAt, WORLD_BOUNDS, POI, MINIGAME_SPOTS, PARKINGS, CITY_POI, PORT_QUAY } from '../../shared/world-layout.js';
import { levelProgress } from '../../shared/rules.js';
import { PITCH } from '../../shared/sports.js';
import { SKI, ROUTES } from '../../shared/courses.js';
import { formatHour } from '../world/daynight.js';

// Affichage tête haute : argent, niveau, réputation, zone, horloge, mini-carte, missions, boussole.

// Carte de fond pré-dessinée (sert à la mini-carte et à la carte du téléphone). px pixels par mètre.
export const MAP = WORLD_BOUNDS;
export const MAP_PX = 0.5;   // pixels par mètre de l'image de la carte (carte géante : 0,5)
export function drawMapBase(px = 2) {
  const B = WORLD_BOUNDS;
  const c = document.createElement('canvas');
  c.width = (B.maxX - B.minX) * px; c.height = (B.maxZ - B.minZ) * px;
  const g = c.getContext('2d');
  const X = (x) => (x - B.minX) * px, Y = (z) => (z - B.minZ) * px;
  const rect = (x1, z1, x2, z2, col) => { g.fillStyle = col; g.fillRect(X(x1), Y(z1), (x2 - x1) * px, (z2 - z1) * px); };
  rect(B.minX, B.minZ, B.maxX, B.maxZ, '#79c25a');
  rect(-136, -136, -60, -60, '#4e8a3e');                 // forêt
  rect(-300, -136, -136, 56, '#86c467');                  // campagne
  rect(-300, -335, -136, -136, '#a3b08f');                // industrie
  rect(-125, 14, -95, 58, '#a47148');                     // champs Bidoche
  for (const [x1, z1, x2, z2] of [[-283, -63, -228, -14], [-212, -132, -150, -78], [-283, -132, -228, -78], [-212, 10, -150, 50]]) rect(x1, z1, x2, z2, '#b08850');
  rect(B.minX, 64, 140, B.maxZ, '#f2d59b');               // plages
  rect(B.minX, 93, 140, B.maxZ, '#2e9fd6');                // mer
  rect(140, 56, 300, PORT_QUAY.z, '#b3aea4');          // quai du port
  rect(140, PORT_QUAY.z, 300, B.maxZ, '#2e9fd6');
  rect(300, 64, B.maxX, B.maxZ, '#f2d59b'); rect(300, 93, B.maxX, B.maxZ, '#2e9fd6'); // plages de la Côte des Villas
  rect(-840, -430, -300, 50, '#7fae55');                   // vignobles
  rect(-900, -1000, 900, -880, '#6aa84f');                 // abords de l'autoroute
  rect(-3000, -2950, 3000, -2000, '#9fcf7a');               // hauts plateaux
  rect(-3000, -3400, 3000, -2950, '#8d8f8a'); rect(-3000, -3400, 3000, -3150, '#eef2f6');   // massif enneigé
  rect(-3000, -2000, -1850, 400, '#e2bf85');                // désert des Sablons
  rect(1850, -2000, 3000, 400, '#6cc46b'); rect(2930, -2000, 3000, 400, '#f2d59b');   // côte des Palmiers et plage
  rect(-1850, -1900, -420, -1000, '#3f7a35');               // forêt noire
  rect(-420, -1570, 420, -1230, '#b9c4a6');                 // Nordville
  rect(900, -1750, 1750, -1300, '#a7d27f'); rect(900, -1575, 1750, -1525, '#5a5e6a');   // aéroport et piste
  g.fillStyle = '#2e9fd6'; g.beginPath(); g.ellipse(X(LAKE.x), Y(LAKE.z), LAKE.r * px, LAKE.r / 1.3 * px, 0, 0, 7); g.fill();   // lac
  rect(MARINA.x1, PORT_QUAY.z, MARINA.x2, B.maxZ, '#2e9fd6');
  rect(CAP_PORT.x1, PORT_QUAY.z, CAP_PORT.x2, B.maxZ, '#2e9fd6');
  for (const I of ISLANDS) {   // îles : plage de sable, intérieur vert (ou roche du volcan)
    g.fillStyle = '#f7e7c1'; g.beginPath(); g.arc(X(I.x), Y(I.z), I.r * px, 0, 7); g.fill();
    g.fillStyle = I.kind === 'volcan' ? '#5a4a44' : I.kind === 'jungle' ? '#2f7a34' : '#6cc04a'; g.beginPath(); g.arc(X(I.x), Y(I.z), I.r * 0.72 * px, 0, 7); g.fill();
  }
  rect(PITCH.x - PITCH.w / 2, PITCH.z - PITCH.d / 2, PITCH.x + PITCH.w / 2, PITCH.z + PITCH.d / 2, '#3f9a3a'); // stade
  rect(SKI.x1, SKI.top, SKI.x2, SKI.bottom, '#f4f8fb'); rect(SKI.x1 - 26, SKI.top, SKI.x1, SKI.bottom, '#c9d2d8'); rect(SKI.x2, SKI.top, SKI.x2 + 26, SKI.bottom, '#c9d2d8'); // station de ski
  g.strokeStyle = '#3a3d42'; g.lineWidth = 13 * px; g.beginPath(); ROUTES.f1.pts.forEach((p, i) => (i ? g.lineTo(X(p.x), Y(p.z)) : g.moveTo(X(p.x), Y(p.z)))); g.closePath(); g.stroke(); // circuit F1
  g.fillStyle = '#2e9fd6'; g.beginPath(); g.arc(X(POND.x), Y(POND.z), POND.r * px, 0, 7); g.fill();
  rect(-24, -24, 24, 24, '#e8d5b5');                       // place
  g.fillStyle = '#e9d8a6'; g.beginPath(); g.arc(X(CITY_POI.arena.x), Y(CITY_POI.arena.z), CITY_POI.arena.r * px, 0, 7); g.fill();
  const C = CITY_POI.circuit;
  g.strokeStyle = '#5a5e6a'; g.lineWidth = 9 * px; g.beginPath(); g.ellipse(X(C.x), Y(C.z), C.rx * px, C.rz * px, 0, 0, 7); g.stroke();
  for (const P of [...PARKS, ZOO]) rect(P.x - P.w / 2, P.z - P.d / 2, P.x + P.w / 2, P.z + P.d / 2, '#57b84a');   // parcs et zoo
  for (const p of PARKINGS) rect(p.x1, p.z1, p.x2, p.z2, '#8a8f96');
  g.fillStyle = '#5a5e6a';
  for (const [x1, z1, x2, z2] of ROADS) g.fillRect(X(x1), Y(z1), (x2 - x1) * px, (z2 - z1) * px);
  rect(POI.pier.x - 4, POI.pier.z1, POI.pier.x + 4, POI.pier.z2, '#b07d47');
  for (const b of BUILDINGS) {
    if (b.secret) continue;
    const col = b.kind === 'shop' ? '#ff5a5f' : b.kind === 'job' ? '#ffd23f' : b.kind === 'home' || b.kind === 'home-buy' ? '#2ec4b6' : b.kind === 'service' ? '#7aa7ff' : '#d9d4c7';
    rect(b.x - b.w / 2, b.z - b.d / 2, b.x + b.w / 2, b.z + b.d / 2, col);
  }
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(X(0), Y(0), 4.5 * px, 0, 7); g.fill();
  return c;
}

// Trace un itinéraire GPS sur une carte.
export function drawRoute(g, toScreen, route, scale = 1) {
  if (!route || route.length < 2) return;
  g.save();
  g.lineJoin = 'round'; g.lineCap = 'round';
  for (const [w, col] of [[7 * scale, '#1b1446'], [4 * scale, '#29e6ff']]) {
    g.strokeStyle = col; g.lineWidth = w;
    g.beginPath();
    route.forEach((p, i) => { const [x, y] = toScreen(p.x, p.z); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    g.stroke();
  }
  g.restore();
}

const SHOP_ICON = { clothes: '👕', furniture: '🛋️', pets: '🐾', vehicles: '🛵', cafe: '☕', bakery: '🥖', burger: '🍔', pizzeria: '🍕', tacos: '🌮', homard: '🦞', poisson: '🐟', cafe2: '☕', paillote: '🍹', immo: '🏡', electronics: '📺', 'cars-new': '🚗', 'cars-luxe': '🏎️', hightech: '🖥️', armurerie: '🎯', 'auto-ecole': '🚦', 'pole-emploi': '💼', 'foot-club': '⚽', f1: '🏎️', maison: '🛋️', brico: '🧰', jardin: '🌴', sport: '🏋️', pharmacie: '💊', bijoux: '💍', surf: '🪁', 'cars-used': '🚙', bikes: '🏍️', repair: '🔧', 'furniture-used': '🪑', 'pet-acc': '🦴', supermarket: '🛒', superette: '🛒', 'clothes-used': '🧥', depot: '♻️', brocante: '🏺', station: '⛽', rental: '🔑', scrapyard: '🔩', farm: '🥕' };
const SERVICE_ICON = { police: '👮', hospital: '🏥', mairie: '🏛️', bank: '🏦', school: '🏫', prison: '⛓️', cinema: '🎬', bowling: '🎳', arcade: '🕹️', gym: '💪', office: '🏢' };
const MAP_ICONS = [
  ...BUILDINGS.filter((b) => b.kind === 'shop' || b.kind === 'job' || b.kind === 'home' || b.kind === 'service' || b.kind === 'home-buy').map((b) => ({ x: b.door.x, z: b.door.z, icon: { delivery: '📦', firefighter: '🚒', cook: '🍔' }[b.job] || SHOP_ICON[b.shop] || SERVICE_ICON[b.interior] || '🏠' })),
  { x: CITY_POI.arena.x, z: CITY_POI.arena.z, icon: '🎪' }, { x: CITY_POI.circuit.x, z: CITY_POI.circuit.z, icon: '🏁' }, { x: CITY_POI.funfair.x, z: CITY_POI.funfair.z, icon: '🎡' },
  { x: POI.foodTruck.x, z: POI.foodTruck.z, icon: '🍔' },
  { x: MINIGAME_SPOTS.pieToss.x, z: MINIGAME_SPOTS.pieToss.z, icon: '🥧' },
  { x: MINIGAME_SPOTS.chickenRace.x, z: MINIGAME_SPOTS.chickenRace.z, icon: '🐔' },
  { x: MINIGAME_SPOTS.obstacle.x, z: MINIGAME_SPOTS.obstacle.z, icon: '🏃' },
  { x: POI.eventBoard.x, z: POI.eventBoard.z, icon: '📋' },
];

export function drawMarkers(g, toScreen, markers, scale = 1) {
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `${Math.round(13 * scale)}px system-ui, sans-serif`;
  for (const m of MAP_ICONS) { const [x, y] = toScreen(m.x, m.z); g.fillText(m.icon, x, y); }
  for (const m of markers) {
    const [x, y] = toScreen(m.x, m.z);
    g.fillStyle = m.color || '#ffd23f';
    g.strokeStyle = '#1b1446'; g.lineWidth = 2 * scale;
    g.beginPath(); g.arc(x, y, (m.r || 5) * scale, 0, 7); g.fill(); g.stroke();
    if (m.icon) { g.font = `${Math.round(12 * scale)}px system-ui`; g.fillText(m.icon, x, y - 12 * scale); }
  }
}

export class HUD {
  constructor(ui, game) {
    this.ui = ui;
    this.game = game;
    this.money = h('div.chip.money', { title: 'Compte en banque (carte) · argent liquide' }, h('span.coin', 'PC'), this.moneyText = h('span', '0'), this.cashText = h('small.cash', ''));
    this.levelChip = h('div.chip', h('span', '⭐'), this.levelText = h('span', 'Niv. 1'), this.xpbar = h('div.xpbar', this.xpFill = h('div')));
    this.repChip = h('div.chip', h('span', '💬'), this.repText = h('span', '0'), h('small', 'réputation'));
    this.tracker = h('div.tracker');
    this.tl = h('div.hud-tl', this.money, this.levelChip, this.repChip, this.tracker);
    this.zoneName = h('div.name');
    this.clock = h('div.clock', '12:00');
    this.zoneEl = h('div.hud-zone', this.zoneName, this.clock);
    this.tr = h('div.hud-tr');
    this.compass = h('div.compass', this.compassArrow = h('div.arrow'), this.compassDist = h('div.dist'), this.compassTurn = h('div.turn'));
    this.mapCanvas = h('canvas', { width: 336, height: 336 });
    this.minimap = h('div.minimap', { title: 'Carte', onclick: () => game.phone?.open('map') }, this.mapCanvas);
    this.eventBanner = h('div.event-banner.hidden');
    ui.root.append(this.tl, this.zoneEl, this.tr, this.compass, this.minimap, this.eventBanner);
    this.mapBase = drawMapBase(MAP_PX);
    this.lastZone = null;
    this.markers = [];       // marqueurs dynamiques {x, z, color, icon}
    this.compassTarget = null;
    this.trackers = new Map();
    this._mm = 0;
  }

  addButton(icon, title, onclick) {
    const b = h('button.icon-btn', { title, 'aria-label': title, onclick }, icon);
    this.tr.append(b);
    return b;
  }

  setProfile(p, prev) {
    this.moneyText.textContent = fmt(p.coins);
    this.cashText.textContent = `💵 ${fmt(p.cash || 0)}`;
    if (prev && p.coins !== prev.coins) {
      this.money.classList.remove('bump'); void this.money.offsetWidth; this.money.classList.add('bump');
    }
    const lp = levelProgress(p.xp);
    this.levelText.textContent = `Niv. ${lp.level}`;
    this.xpFill.style.width = `${Math.round(lp.ratio * 100)}%`;
    this.repText.textContent = fmt(p.rep);
  }

  // Encart de mission/mini-jeu à gauche. content = { title, text, timer, bar } ; null pour retirer.
  track(key, content) {
    let el = this.trackers.get(key);
    if (!content) { el?.remove(); this.trackers.delete(key); return; }
    if (!el) { el = h('div'); this.trackers.set(key, el); this.tracker.append(el); }
    clear(el);
    el.append(h('h4', h('span', content.title), content.timer ? h('span.timer', content.timer) : null));
    if (content.text) el.append(h('p', content.text));
    if (content.bar !== undefined) el.append(h('div.bar', h('div', { style: { width: `${Math.max(0, Math.min(100, content.bar * 100))}%`, background: content.barColor } })));
    if (content.button) el.append(h('button.btn.small.ghost', { style: { marginTop: '8px' }, onclick: content.button.onclick }, content.button.label));
  }

  // Nom du lieu (bâtiment) quand on y entre.
  showPlace(name) {
    this.zoneName.textContent = name;
    this.zoneName.classList.add('show');
    clearTimeout(this._zt);
    this._zt = setTimeout(() => this.zoneName.classList.remove('show'), 3000);
  }

  setEventBanner(content) {
    const b = this.eventBanner;
    if (!content) { b.classList.add('hidden'); return; }
    b.classList.remove('hidden');
    clear(b);
    b.append(h('h4', content.title), h('p', content.text));
  }

  update(dt) {
    const g = this.game;
    const p = g.player.pos;
    // jauge d'endurance (sprint : Maj / bouton 🏃)
    if (!this.stamina) { this.staminaFill = h('div'); this.stamina = h('div.stamina', { title: 'Endurance (sprint)' }, h('span', '🏃'), h('div.sbar', this.staminaFill)); this.ui.root.append(this.stamina); }
    const st = g.player.stamina ?? 1;
    this.stamina.classList.toggle('show', st < 0.995 || g.player.sprinting);
    this.staminaFill.style.width = `${Math.round(st * 100)}%`;
    this.stamina.classList.toggle('low', st < 0.2);
    // zone
    if (g.player.zone !== 'world' && this.lastZone !== g.player.zone) {
      this.lastZone = g.player.zone;
      const ins = g.home?.inside;
      const fl = g.floors?.at;
      this.zoneName.textContent = fl ? `${fl.b.name} · ${fl.n}e étage` : ins && !ins.mine ? `Chez ${ins.ownerName}` : 'Chez moi';
      this.zoneName.classList.add('show');
    }
    if (g.player.zone === 'world') {
      const z = zoneAt(p.x, p.z);
      if (z.id !== this.lastZone) {
        this.lastZone = z.id;
        this.zoneName.textContent = z.name;
        this.zoneName.classList.add('show');
        clearTimeout(this._zt);
        this._zt = setTimeout(() => this.zoneName.classList.remove('show'), 3500);
      }
    }
    this.clock.textContent = `${g.world.dayNight.hour >= 20.5 || g.world.dayNight.hour < 6 ? '🌙' : '☀️'} ${g.world.dayNight.day || ''} ${formatHour(g.world.dayNight.hour)}`;
    // boussole vers l'objectif
    // la boussole suit l'itinéraire GPS (prochain virage) quand il y en a un
    const t0 = this.compassTarget;
    if (g.gps) {
      if (t0 && (!g.gps.dest || g.gps.dest.x !== t0.x || g.gps.dest.z !== t0.z)) g.gps.set({ x: t0.x, z: t0.z, label: t0.label, manual: !!t0.manual });
      else if (!t0 && g.gps.dest) g.gps.clear();
    }
    const t = t0 && g.gps?.route ? { ...g.gps.next(), label: t0.label } : t0;
    if (t && g.player.zone === 'world') {
      const dx = t.x - p.x, dz = t.z - p.z;
      const d = t0 && g.gps?.route ? g.gps.remaining() : Math.hypot(dx, dz);
      this.compass.classList.add('show');
      const camF = g.cam.yaw;
      const ang = Math.atan2(dx, dz) - (camF + Math.PI);
      this.compassArrow.style.transform = `rotate(${-ang * 180 / Math.PI}deg)`;
      const km = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(m / 10) * 10} m`);
      const ins = t0 && g.gps?.dest ? g.gps.instruction() : null;
      const speed = g.vehicles?.driving ? Math.max(8, Math.abs(g.vehicles.current?.speed || 0)) : 4.5;
      const eta = Math.max(1, Math.round(d / speed / 60));
      this.compassDist.textContent = `${t.label ? `${t.label} · ` : ''}${km(d)} · ${eta} min`;
      this.compassTurn.textContent = ins ? `${ins.icon} Dans ${km(ins.dist)} : ${ins.text}` : '';
      this.compassTurn.style.display = ins ? '' : 'none';
    } else this.compass.classList.remove('show');
    // mini-carte (10 fois par seconde)
    this._mm += dt;
    if (this._mm > 0.1) { this._mm = 0; this.drawMinimap(); }
  }

  drawMinimap() {
    const g = this.mapCanvas.getContext('2d');
    const W = this.mapCanvas.width, px = MAP_PX, R = this.game.vehicles?.driving ? 85 : 55; // rayon visible en mètres
    const p = this.game.player;
    const inWorld = p.zone === 'world';
    const cx = inWorld ? p.pos.x : POI.homeDoor.x, cz = inWorld ? p.pos.z : POI.homeDoor.z;
    const k = W / (R * 2);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#2e9fd6'; g.fillRect(0, 0, W, W);
    g.save();
    g.translate(W / 2, W / 2);
    g.scale(k / px, k / px);
    g.drawImage(this.mapBase, -(cx - WORLD_BOUNDS.minX) * px, -(cz - WORLD_BOUNDS.minZ) * px);
    g.restore();
    const toScreen = (x, z) => [W / 2 + (x - cx) * k, W / 2 + (z - cz) * k];
    if (inWorld) drawRoute(g, toScreen, this.game.gps?.route, 2);
    drawMarkers(g, toScreen, [...this.game.mapMarkers()], 2);
    // joueur
    g.save();
    g.translate(W / 2, W / 2);
    g.rotate(-p.yaw + Math.PI);
    g.fillStyle = '#ffffff'; g.strokeStyle = '#ff5a5f'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(0, -14); g.lineTo(10, 10); g.lineTo(0, 5); g.lineTo(-10, 10); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }
}

// Étiquettes HTML accrochées à des objets 3D (noms au-dessus des têtes, bulles de dialogue).
export class WorldLabels {
  constructor(container, camera) {
    this.container = container;
    this.camera = camera;
    this.items = new Set();
    this.v = new THREE.Vector3();
  }

  add(obj, el, offsetY = 2.4, maxDist = 40) {
    const it = { obj, el, offsetY, maxDist };
    this.items.add(it);
    this.container.append(el);
    return it;
  }

  remove(it) { if (!it) return; it.el.remove(); this.items.delete(it); }

  // Bulle temporaire au-dessus d'un objet.
  bubble(obj, text, ms = 3500, cls = '', offsetY = 2.6) {
    if (obj.userData.bubble) this.remove(obj.userData.bubble);
    const it = this.add(obj, h(`div.bubble${cls ? `.${cls}` : ''}`, text), offsetY, 35);
    obj.userData.bubble = it;
    setTimeout(() => { if (obj.userData.bubble === it) { this.remove(it); obj.userData.bubble = null; } }, ms);
    return it;
  }

  update() {
    const cam = this.camera;
    const W = this.container.clientWidth, H = this.container.clientHeight;
    for (const it of this.items) {
      if (!it.obj.parent || it.obj.visible === false) { it.el.style.display = 'none'; continue; }
      it.obj.getWorldPosition(this.v);
      const d = this.v.distanceTo(cam.position);
      this.v.y += it.offsetY * (it.obj.scale?.y || 1);
      this.v.project(cam);
      if (this.v.z > 1 || d > it.maxDist || Math.abs(this.v.x) > 1.2 || Math.abs(this.v.y) > 1.2) { it.el.style.display = 'none'; continue; }
      it.el.style.display = '';
      const x = (this.v.x * 0.5 + 0.5) * W, y = (-this.v.y * 0.5 + 0.5) * H;
      it.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      it.el.style.left = '0'; it.el.style.top = '0';
      it.el.style.opacity = d > it.maxDist * 0.75 ? String(1 - (d - it.maxDist * 0.75) / (it.maxDist * 0.25)) : '1';
    }
  }
}
