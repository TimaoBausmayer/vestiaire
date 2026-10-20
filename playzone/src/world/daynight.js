import * as THREE from 'three';
import { MATS } from '../core/materials.js';

// Cycle jour/nuit partagé : l'heure du jeu se calcule à partir de l'heure réelle (synchronisée avec
// le serveur en ligne), donc tous les joueurs voient la même heure.
// Échelle : 10 minutes réelles = 1 heure de jeu (une journée complète dure 4 heures réelles).
// En solo, dormir la nuit fait passer directement au matin (décalage d'horloge local).

export const HOUR_MS = 10 * 60 * 1000;
export const CYCLE_MS = 24 * HOUR_MS;
const DAYS = ['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.', 'Dim.'];

export function gameHour(nowMs) { return (7 + (nowMs % CYCLE_MS) / HOUR_MS) % 24; }
// Jour de la semaine du jeu (0 = lundi).
export function gameDay(nowMs) { return Math.floor((nowMs + 7 * HOUR_MS) / CYCLE_MS); }
export const dayName = (nowMs) => DAYS[((gameDay(nowMs) % 7) + 7) % 7];

export function formatHour(h) {
  const hh = Math.floor(h) % 24, mm = Math.floor((h % 1) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

const KEYS = [
  { h: 0, top: '#070b1f', hor: '#16203f', light: 0.35, sun: 0.0, stars: 1, win: 1 },
  { h: 5, top: '#141d44', hor: '#4a3a5f', light: 0.4, sun: 0.0, stars: 0.8, win: 1 },
  { h: 6.5, top: '#3a5ea8', hor: '#f4a96a', light: 0.75, sun: 0.6, stars: 0.1, win: 0.6 },
  { h: 8, top: '#4a90e2', hor: '#cfe9f7', light: 1, sun: 1, stars: 0, win: 0 },
  { h: 13, top: '#3d8ee8', hor: '#bfe3f5', light: 1, sun: 1, stars: 0, win: 0 },
  { h: 17.5, top: '#4a7fd0', hor: '#f6d9a0', light: 0.95, sun: 0.9, stars: 0, win: 0 },
  { h: 19.5, top: '#34407a', hor: '#f08a5d', light: 0.7, sun: 0.45, stars: 0.1, win: 0.7 },
  { h: 21, top: '#0e1533', hor: '#2a2f5a', light: 0.42, sun: 0.0, stars: 0.8, win: 1 },
  { h: 24, top: '#070b1f', hor: '#16203f', light: 0.35, sun: 0.0, stars: 1, win: 1 },
];

const ca = new THREE.Color(), cb = new THREE.Color();
function lerpColor(a, b, t, out) { ca.set(a); cb.set(b); return out.copy(ca).lerp(cb, t); }

export class DayNight {
  constructor(engine, water) {
    this.engine = engine;
    this.water = water;
    this.hour = 12;
    this.top = new THREE.Color(); this.hor = new THREE.Color();
    this.night = 0;
  }

  update(nowMs) {
    const tNow = nowMs + (this.shift || 0);
    const h = this.forcedHour ?? gameHour(tNow) % 24;
    this.hour = h;
    this.day = dayName(tNow);
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const t = (h - a.h) / (b.h - a.h);
    const L = (k) => a[k] + (b[k] - a[k]) * t;
    lerpColor(a.top, b.top, t, this.top);
    lerpColor(a.hor, b.hor, t, this.hor);
    const e = this.engine;
    const u = e.skyUniforms;
    u.topColor.value.copy(this.top);
    u.horizonColor.value.copy(this.hor);
    u.bottomColor.value.copy(this.hor).multiplyScalar(0.7);
    u.starAmount.value = L('stars');
    const light = L('light'), sun = L('sun');
    e.scene.fog.color.copy(this.hor);
    // lumière ambiante : ciel (hémisphère) + carte d'environnement (reflets), soleil direct
    const env = e.quality !== 'low';
    e.hemi.intensity = env ? 0.35 + light * 0.75 : 0.55 + light * 1.1;
    e.hemi.color.set(light > 0.6 ? 0xdff3ff : 0x8fa0d8);
    // à l'intérieur d'un bâtiment, l'éclairage des lampes compense la nuit
    if (this.interiorBoost) { e.hemi.intensity += this.interiorBoost * 0.95 * (1 - light); if (light < 0.7) e.hemi.color.set(0xfff1dc); }
    e.scene.environmentIntensity = 0.25 + light * 0.55;
    e.sun.intensity = sun * 2.6;
    // course du soleil (de l'est vers l'ouest)
    const ang = ((h - 6) / 14) * Math.PI;
    e.sunOffset.set(Math.cos(ang) * -70 + 20, Math.max(25, Math.sin(ang) * 90), 35);
    u.sunDir.value.copy(e.sunOffset).normalize();
    e.sun.color.set(h < 8 || h > 17.5 ? 0xffc890 : 0xfff1d6);
    this.night = L('win');
    MATS.windows.emissiveIntensity = this.night * 1.15;
    // reflets : recalculés tous les quarts d'heure du jeu (≈ toutes les 12 s)
    const bucket = Math.floor(h * 4);
    if (env && (bucket !== this._envBucket || e.envDirty)) {
      this._envBucket = bucket; e.envDirty = false;
      this._ground ||= new THREE.Color();
      this._ground.set('#5d6b4a').multiplyScalar(0.25 + light * 0.75);
      this._sunCol ||= new THREE.Color();
      this._sunCol.copy(e.sun.color).multiplyScalar(sun);
      e.updateEnvironment(this.top, this.hor, this._ground, e.sunOffset, this._sunCol);
    }
    MATS.glow.color.setScalar(0.45 + 0.55 * this.night);
    if (this.water) this.water.material.uniforms.light.value = 0.45 + 0.55 * light;
  }
}
