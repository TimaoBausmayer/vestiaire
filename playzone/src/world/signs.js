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
