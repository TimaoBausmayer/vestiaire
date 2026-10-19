import * as THREE from 'three';
import { h, clear, fmt } from './dom.js';
import { BUILDINGS, ROADS, POND, zoneAt, WORLD_HALF, POI, MINIGAME_SPOTS } from '../../shared/world-layout.js';
import { levelProgress } from '../../shared/rules.js';
import { formatHour } from '../world/daynight.js';

// Affichage tête haute : argent, niveau, réputation, zone, horloge, mini-carte, missions, boussole.

// Carte de fond pré-dessinée (sert à la mini-carte et à la carte du téléphone).
export function drawMapBase(px = 2) {
  const S = WORLD_HALF * 2 * px;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const X = (x) => (x + WORLD_HALF) * px;
  g.fillStyle = '#79c25a'; g.fillRect(0, 0, S, S);
  g.fillStyle = '#4e8a3e'; g.fillRect(X(-128), X(-128), 68 * px, 68 * px);
  g.fillStyle = '#a47148'; g.fillRect(X(-125), X(14), 30 * px, 44 * px);
  g.fillStyle = '#f2d59b'; g.fillRect(0, X(64), S, S);
  g.fillStyle = '#2e9fd6'; g.fillRect(0, X(93), S, S);
  g.beginPath(); g.arc(X(POND.x), X(POND.z), POND.r * px, 0, 7); g.fill();
  g.fillStyle = '#e8d5b5'; g.fillRect(X(-24), X(-24), 48 * px, 48 * px);
  g.fillStyle = '#5a5e6a';
  for (const [x1, z1, x2, z2] of ROADS) g.fillRect(X(x1), X(z1), (x2 - x1) * px, (z2 - z1) * px);
  g.fillStyle = '#b07d47'; g.fillRect(X(POI.pier.x - 4), X(POI.pier.z1), 8 * px, (POI.pier.z2 - POI.pier.z1) * px);
  for (const b of BUILDINGS) {
    if (b.secret) continue;
    g.fillStyle = b.kind === 'shop' ? '#ff5a5f' : b.kind === 'job' ? '#ffd23f' : b.kind === 'home' ? '#2ec4b6' : '#d9d4c7';
    g.fillRect(X(b.x - b.w / 2), X(b.z - b.d / 2), b.w * px, b.d * px);
  }
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(X(0), X(0), 4.5 * px, 0, 7); g.fill();
  return c;
}

const MAP_ICONS = [
  ...BUILDINGS.filter((b) => b.kind === 'shop' || b.kind === 'job' || b.kind === 'home').map((b) => ({ x: b.door.x, z: b.door.z, icon: { clothes: '👕', furniture: '🛋️', pets: '🐾', vehicles: '🛵' }[b.shop] || { delivery: '📦', firefighter: '🚒', cook: '🍔' }[b.job] || '🏠' })),
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
    this.money = h('div.chip.money', h('span.coin', 'PC'), this.moneyText = h('span', '0'));
    this.levelChip = h('div.chip', h('span', '⭐'), this.levelText = h('span', 'Niv. 1'), this.xpbar = h('div.xpbar', this.xpFill = h('div')));
    this.repChip = h('div.chip', h('span', '💬'), this.repText = h('span', '0'), h('small', 'réputation'));
    this.tl = h('div.hud-tl', this.money, this.levelChip, this.repChip);
    this.zoneName = h('div.name');
    this.clock = h('div.clock', '12:00');
    this.zoneEl = h('div.hud-zone', this.zoneName, this.clock);
    this.tr = h('div.hud-tr');
    this.tracker = h('div.tracker');
    this.compass = h('div.compass', this.compassArrow = h('div.arrow'), this.compassDist = h('div.dist'));
    this.mapCanvas = h('canvas', { width: 336, height: 336 });
    this.minimap = h('div.minimap', { title: 'Carte', onclick: () => game.phone?.open('map') }, this.mapCanvas);
    this.eventBanner = h('div.event-banner.hidden');
    ui.root.append(this.tl, this.zoneEl, this.tr, this.tracker, this.compass, this.minimap, this.eventBanner);
    this.mapBase = drawMapBase(2);
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
    // zone
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
    this.clock.textContent = `${g.world.dayNight.hour >= 20.5 || g.world.dayNight.hour < 6 ? '🌙' : '☀️'} ${formatHour(g.world.dayNight.hour)}`;
    // boussole vers l'objectif
    const t = this.compassTarget;
    if (t && g.player.zone === 'world') {
      const dx = t.x - p.x, dz = t.z - p.z;
      const d = Math.hypot(dx, dz);
      this.compass.classList.add('show');
      const camF = g.cam.yaw;
      const ang = Math.atan2(dx, dz) - (camF + Math.PI);
      this.compassArrow.style.transform = `rotate(${-ang * 180 / Math.PI}deg)`;
      this.compassDist.textContent = `${t.label ? `${t.label} · ` : ''}${Math.round(d)} m`;
    } else this.compass.classList.remove('show');
    // mini-carte (10 fois par seconde)
    this._mm += dt;
    if (this._mm > 0.1) { this._mm = 0; this.drawMinimap(); }
  }

  drawMinimap() {
    const g = this.mapCanvas.getContext('2d');
    const W = this.mapCanvas.width, px = 2, R = 55; // rayon visible en mètres
    const p = this.game.player;
    const inWorld = p.zone === 'world';
    const cx = inWorld ? p.pos.x : POI.homeDoor.x, cz = inWorld ? p.pos.z : POI.homeDoor.z;
    const k = W / (R * 2);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#2e9fd6'; g.fillRect(0, 0, W, W);
    g.save();
    g.translate(W / 2, W / 2);
    g.scale(k / px, k / px);
    g.drawImage(this.mapBase, -(cx + WORLD_HALF) * px, -(cz + WORLD_HALF) * px);
    g.restore();
    const toScreen = (x, z) => [W / 2 + (x - cx) * k, W / 2 + (z - cz) * k];
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
