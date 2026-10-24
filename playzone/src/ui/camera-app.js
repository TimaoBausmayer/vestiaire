import { h } from './dom.js';

// APPAREIL PHOTO du téléphone : viseur plein écran, mode selfie (la caméra passe devant le personnage,
// qui prend la pose), filtres, flash. La photo (JPEG ~260 px) peut être publiée sur PlayGram ou gardée
// dans la galerie (stockée dans le navigateur).
export const FILTERS = [
  { id: 'normal', name: 'Normal', css: 'none' },
  { id: 'vif', name: 'Vif', css: 'saturate(1.6) contrast(1.1)' },
  { id: 'retro', name: 'Rétro', css: 'sepia(0.55) contrast(1.05) brightness(1.05)' },
  { id: 'nb', name: 'N&B', css: 'grayscale(1) contrast(1.15)' },
  { id: 'froid', name: 'Glacé', css: 'hue-rotate(-12deg) saturate(1.2) brightness(1.05)' },
  { id: 'soir', name: 'Golden', css: 'sepia(0.25) saturate(1.4) hue-rotate(-8deg) brightness(1.08)' },
];
const GALLERY_KEY = 'playzone.gallery.v1';
export function loadGallery() { try { return JSON.parse(localStorage.getItem(GALLERY_KEY) || '[]'); } catch { return []; } }
export function saveToGallery(photo) {
  const list = loadGallery();
  list.unshift({ photo, at: Date.now() });
  for (let n = 16; n >= 4; n -= 4) { try { localStorage.setItem(GALLERY_KEY, JSON.stringify(list.slice(0, n))); return true; } catch { /* plein : on garde moins de photos */ } }
  return false;
}
export function removeFromGallery(at) { try { localStorage.setItem(GALLERY_KEY, JSON.stringify(loadGallery().filter((x) => x.at !== at))); } catch { /* ignore */ } }

// Capture de la vue 3D (avec filtre), recadrée en 4:5 comme un post. Taille limitée pour le réseau.
export function capture(g, filter = 'none', width = 260) {
  const e = g.engine;
  e.renderer.render(e.scene, e.camera);
  const src = e.renderer.domElement, W = src.width, H = src.height;
  const ch = Math.min(H, W * 1.25), cw = ch / 1.25, sx = (W - cw) / 2, sy = (H - ch) / 2;
  const c = document.createElement('canvas');
  c.width = width; c.height = Math.round(width * 1.25);
  const x = c.getContext('2d');
  x.filter = filter;
  x.drawImage(src, sx, sy, cw, ch, 0, 0, c.width, c.height);
  for (const q of [0.7, 0.55, 0.42, 0.3]) { const d = c.toDataURL('image/jpeg', q); if (d.length < 36000) return d; }
  return c.toDataURL('image/jpeg', 0.2);
}

// Ouvre le viseur. onDone(photo | null).
export function openCamera(g, onDone) {
  const cam = g.cam, saved = { yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist, min: cam.minDist };
  let selfie = false, fi = 0, closed = false;
  const view = h('div.cam-frame');
  const label = h('span.cam-filter', FILTERS[0].name);
  const setFilter = (k) => { fi = (k + FILTERS.length) % FILTERS.length; g.engine.renderer.domElement.style.filter = FILTERS[fi].css; label.textContent = FILTERS[fi].name; };
  const setSelfie = (on) => {
    selfie = on;
    if (on) { cam.minDist = 1.6; cam.yaw = g.player.yaw; cam.pitch = 0.12; cam.dist = 3.1; g.player.setPose?.('wave', 2.5); }
    else { cam.minDist = saved.min; cam.yaw = saved.yaw; cam.pitch = saved.pitch; cam.dist = saved.dist; }
    ui.classList.toggle('selfie', on);
  };
  const close = (photo) => {
    if (closed) return; closed = true;
    g.engine.renderer.domElement.style.filter = '';
    setSelfie(false);
    ui.remove(); window.removeEventListener('keydown', key, true);
    g.cameraMode = false;
    document.body.classList.remove('camera-mode');
    onDone?.(photo);
  };
  const shoot = () => {
    ui.style.visibility = 'hidden';
    setTimeout(() => {
      const photo = capture(g, FILTERS[fi].css);
      ui.style.visibility = '';
      g.sfx?.('pop');
      const flash = h('div.cam-flash'); document.body.append(flash); setTimeout(() => flash.remove(), 350);
      review(photo);
    }, 30);
  };
  // aperçu : publier, garder, reprendre
  const review = (photo) => {
    const box = h('div.cam-review', h('img', { src: photo, alt: 'photo' }), h('div.cam-row',
      h('button.btn.ghost', { onclick: () => box.remove() }, '↩︎ Reprendre'),
      h('button.btn.ghost', { onclick: () => { saveToGallery(photo); g.ui.toast('🖼️ Photo gardée dans ta galerie.', 'good'); box.remove(); } }, '🖼️ Galerie'),
      h('button.btn', { onclick: () => { saveToGallery(photo); close(photo); } }, '📤 Publier')));
    ui.append(box);
  };
  const key = (e) => {
    if (closed) return;
    if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(null); }
    else if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); if (!ui.querySelector('.cam-review')) shoot(); }
    else if (e.code === 'KeyF') { e.stopImmediatePropagation(); setSelfie(!selfie); }
    else if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') { e.stopImmediatePropagation(); setFilter(fi + (e.code === 'ArrowRight' ? 1 : -1)); }
  };
  const ui = h('div.cam-ui', view,
    h('div.cam-top', h('button.btn.small.ghost', { onclick: () => close(null) }, '✕'), label, h('span.cam-hint', 'Espace : photo · F : selfie · ← → : filtres · souris : cadrer')),
    h('div.cam-bottom',
      h('button.cam-side', { onclick: () => setFilter(fi - 1), title: 'Filtre précédent' }, '◀'),
      h('button.cam-side', { onclick: () => setSelfie(!selfie), title: 'Selfie' }, '🔄'),
      h('button.cam-shutter', { onclick: shoot, 'aria-label': 'Prendre la photo' }),
      h('button.cam-side', { onclick: () => setFilter(fi + 1), title: 'Filtre suivant' }, '▶'),
      h('button.cam-side', { onclick: () => { cam.dist = Math.max(cam.minDist, cam.dist * 0.8); }, title: 'Zoom' }, '🔍')));
  g.cameraMode = true;
  document.body.classList.add('camera-mode');
  document.body.append(ui);
  window.addEventListener('keydown', key, true);
  return { close, shoot, selfie: setSelfie, filter: setFilter };
}
