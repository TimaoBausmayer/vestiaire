import * as THREE from 'three';

// Panneaux avec texte dessiné sur un canvas (enseignes, pancartes, bulles...).
const cache = new Map();

export function textTexture(text, { bg = '#2b2350', fg = '#ffffff', border = '#ffd23f', w = 512, h = 128, font = 800, size = 0 } = {}) {
  const key = [text, bg, fg, border, w, h, font, size].join('|');
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (bg) {
    g.fillStyle = bg;
    roundRect(g, 4, 4, w - 8, h - 8, Math.min(28, h / 4));
    g.fill();
  }
  if (border) { g.lineWidth = 8; g.strokeStyle = border; roundRect(g, 8, 8, w - 16, h - 16, Math.min(24, h / 4)); g.stroke(); }
  let fs = size || Math.floor(h * 0.52);
  g.font = `${font} ${fs}px Rubik, "Segoe UI", system-ui, sans-serif`;
  while (g.measureText(text).width > w - 40 && fs > 10) { fs -= 2; g.font = `${font} ${fs}px Rubik, "Segoe UI", system-ui, sans-serif`; }
  g.fillStyle = fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + fs * 0.05);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cache.set(key, tex);
  return tex;
}

export function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// Panneau plat (deux faces) dans le monde.
export function makeSign(text, width, height, opts = {}) {
  const tex = textTexture(text, { w: 512, h: Math.round((512 * height) / width), ...opts });
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: !!opts.transparent, side: opts.doubleSide ? THREE.DoubleSide : THREE.FrontSide });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  return mesh;
}

// Étiquette qui fait toujours face à la caméra (noms des joueurs, bulles).
export function makeLabel(text, opts = {}) {
  const { w = 256, h = 64, scale = 1 } = opts;
  const tex = textTexture(text, { w, h, bg: opts.bg ?? 'rgba(20,16,40,0.78)', border: opts.border ?? null, fg: opts.fg ?? '#fff', font: 700, size: opts.size || 0 });
  const mat = new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true, fog: false });
  const s = new THREE.Sprite(mat);
  s.scale.set((w / h) * 0.5 * scale, 0.5 * scale, 1);
  s.renderOrder = 10;
  return s;
}

// ATLAS D'ENSEIGNES : toutes les enseignes des bâtiments sont dessinées dans une seule grande texture et
// fusionnées dans un seul maillage (un seul appel de dessin au lieu d'un par enseigne). Chaque enseigne
// garde son code "escamotable" (elle disparaît avec le mur de façade en vue intérieure).
export class SignAtlas {
  constructor(size = 2048) {
    this.size = size;
    this.items = [];
  }

  // x, y, z : centre du panneau ; ry : orientation ; w, h : taille en mètres ; cut : code d'escamotage
  add(text, { x, y, z, ry = 0, w, h, cut = 0, bg, fg, border, size }) {
    this.items.push({ text, x, y, z, ry, w, h, cut, opts: { bg, fg, border, size } });
  }

  build() {
    const S = this.size;
    const pages = [];
    let page = null, cx = 0, cy = 0, rowH = 0;
    const newPage = () => {
      const c = document.createElement('canvas'); c.width = c.height = S;
      page = { canvas: c, g: c.getContext('2d'), items: [] };
      pages.push(page); cx = 0; cy = 0; rowH = 0;
    };
    newPage();
    for (const it of this.items) {
      const pw = Math.min(S, Math.round(Math.max(160, Math.min(560, it.w * 52)))), ph = Math.max(28, Math.round(pw * it.h / it.w));
      if (cx + pw > S) { cx = 0; cy += rowH + 4; rowH = 0; }
      if (cy + ph > S) newPage();
      it.page = page; it.rect = [cx, cy, pw, ph];
      drawSign(page.g, it.text, cx, cy, pw, ph, it.opts);
      page.items.push(it);
      cx += pw + 4; rowH = Math.max(rowH, ph);
    }
    const group = new THREE.Group();
    group.name = 'signs';
    for (const pg of pages) {
      const pos = [], uv = [], cut = [];
      for (const it of pg.items) {
        const [rx, ry, rw, rh] = it.rect;
        const u0 = rx / S, u1 = (rx + rw) / S, v0 = 1 - (ry + rh) / S, v1 = 1 - ry / S;
        const c = Math.cos(it.ry), s = Math.sin(it.ry);
        const P = (lx, ly) => [it.x + lx * c, it.y + ly, it.z - lx * s];
        const a = P(-it.w / 2, -it.h / 2), b = P(it.w / 2, -it.h / 2), cc = P(it.w / 2, it.h / 2), d = P(-it.w / 2, it.h / 2);
        pos.push(...a, ...b, ...cc, ...a, ...cc, ...d);
        uv.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
        for (let k = 0; k < 6; k++) cut.push(it.cut);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setAttribute('cut', new THREE.Float32BufferAttribute(cut, 1));
      geo.computeBoundingSphere();
      const tex = new THREE.CanvasTexture(pg.canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      const mat = withCut(new THREE.MeshBasicMaterial({ map: tex }), 'pz-signs');
      const mesh = new THREE.Mesh(geo, mat);
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
    }
    return group;
  }
}

function drawSign(g, text, x, y, w, h, { bg = '#2b2350', fg = '#ffffff', border = '#ffd23f', size = 0 } = {}) {
  g.save();
  g.translate(x, y);
  if (bg) { g.fillStyle = bg; roundRect(g, 1, 1, w - 2, h - 2, Math.min(14, h / 4)); g.fill(); }
  if (border) { g.lineWidth = Math.max(2, h * 0.06); g.strokeStyle = border; roundRect(g, 3, 3, w - 6, h - 6, Math.min(12, h / 4)); g.stroke(); }
  let fs = size || Math.floor(h * 0.55);
  g.font = `800 ${fs}px Rubik, "Segoe UI", system-ui, sans-serif`;
  while (g.measureText(text).width > w - 16 && fs > 8) { fs -= 1; g.font = `800 ${fs}px Rubik, "Segoe UI", system-ui, sans-serif`; }
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + fs * 0.05);
  g.restore();
}

import { withCut } from '../core/materials.js';
