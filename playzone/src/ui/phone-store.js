import * as THREE from 'three';
import { h, fmt } from './dom.js';
import { PHONES, phoneOf } from '../../shared/phones.js';

// RAYON TÉLÉPHONES (MégaTech, Pixel & Câbles) : liste des modèles, choix de la couleur et APERÇU 3D
// qui tourne (on voit l'écran, l'encoche / l'île / le poinçon, les capteurs photo au dos).

function rounded(w, hh, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -hh / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + hh - r); s.quadraticCurveTo(x + w, y + hh, x + w - r, y + hh);
  s.lineTo(x + r, y + hh); s.quadraticCurveTo(x, y + hh, x, y + hh - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// texture de l'écran d'accueil (dégradé + icônes + forme de l'encoche)
function screenTexture(P) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512;
  const x = c.getContext('2d');
  if (P.retro) {
    x.fillStyle = '#9bbc0f'; x.fillRect(0, 0, 256, 512);
    x.fillStyle = '#0f380f'; x.font = 'bold 34px monospace'; x.fillText('12:00', 70, 90); x.font = 'bold 22px monospace'; x.fillText('Menu', 96, 300); x.fillText('Serpent', 78, 340);
    return new THREE.CanvasTexture(c);
  }
  const g = x.createLinearGradient(0, 0, 256, 512); g.addColorStop(0, '#ff7eb3'); g.addColorStop(0.45, '#7a5cff'); g.addColorStop(1, '#0b1430');
  x.fillStyle = g; x.fillRect(0, 0, 256, 512);
  x.fillStyle = '#fff'; x.font = 'bold 64px sans-serif'; x.fillText('12:00', 50, 140);
  const cols = ['#ffbe0b', '#3a86ff', '#2ec4b6', '#e63946', '#8338ec', '#fb5607', '#06d6a0', '#ff006e'];
  for (let i = 0; i < 16; i++) { x.fillStyle = cols[i % cols.length]; const cx = 30 + (i % 4) * 54, cy = 200 + Math.floor(i / 4) * 64; x.beginPath(); x.roundRect(cx, cy, 40, 40, 11); x.fill(); }
  x.fillStyle = '#000';
  if (P.screen === 'notch') { x.beginPath(); x.roundRect(78, -10, 100, 34, 14); x.fill(); }
  else if (P.screen === 'island') { x.beginPath(); x.roundRect(90, 14, 76, 22, 11); x.fill(); }
  else if (P.screen === 'punch') { x.beginPath(); x.arc(128, 22, 8, 0, 7); x.fill(); }
  if (P.fold) { x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(126, 0, 4, 512); }
  return new THREE.CanvasTexture(c);
}

export function phoneMesh(P, hex) {
  const g = new THREE.Group();
  const w = P.retro ? 0.5 : P.fold ? 1.36 : 0.72 * (P.width / 370), hh = P.retro ? 1.15 : 1.5, d = P.retro ? 0.22 : 0.08;
  const r = P.square ? 0.05 : P.retro ? 0.16 : 0.12;
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(rounded(w, hh, r), { depth: d, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 3, curveSegments: 10 }),
    new THREE.MeshStandardMaterial({ color: hex, metalness: P.titanium ? 0.85 : 0.35, roughness: P.titanium ? 0.35 : 0.45 }));
  body.position.z = -d / 2; g.add(body);
  // écran
  const sw = P.retro ? w * 0.7 : w - 0.05, sh = P.retro ? hh * 0.36 : hh - 0.05;
  const scr = new THREE.Mesh(new THREE.ShapeGeometry(rounded(sw, sh, P.retro ? 0.02 : r * 0.85), 10), new THREE.MeshStandardMaterial({ map: screenTexture(P), emissive: '#ffffff', emissiveIntensity: 0.35, emissiveMap: screenTexture(P), roughness: 0.2 }));
  // UV de la ShapeGeometry : on les ramène dans [0, 1]
  const uv = scr.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / sw + 0.5, uv.getY(i) / sh + 0.5);
  scr.position.set(0, P.retro ? hh * 0.18 : 0, d / 2 + 0.014); g.add(scr);
  if (P.retro) {   // clavier de la brique
    for (let i = 0; i < 12; i++) { const k = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.02), new THREE.MeshStandardMaterial({ color: '#d9d9d9' })); k.position.set(-0.13 + (i % 3) * 0.13, -0.18 - Math.floor(i / 3) * 0.09, d / 2 + 0.015); g.add(k); }
  }
  // capteurs photo au dos
  const lensMat = new THREE.MeshStandardMaterial({ color: '#0a0d16', metalness: 0.6, roughness: 0.15 }), ringMat = new THREE.MeshStandardMaterial({ color: '#9aa0a6', metalness: 0.9, roughness: 0.2 });
  if (P.bar) { const bar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, 0.04), new THREE.MeshStandardMaterial({ color: '#202124', roughness: 0.3 })); bar.position.set(0, hh * 0.3, -d / 2 - 0.03); g.add(bar); }
  const bump = P.lenses >= 3 && !P.bar && !P.square ? new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.025), new THREE.MeshStandardMaterial({ color: hex, metalness: 0.5, roughness: 0.3 })) : null;
  if (bump) { bump.position.set(-w / 2 + 0.23, hh / 2 - 0.23, -d / 2 - 0.02); g.add(bump); }
  for (let i = 0; i < P.lenses; i++) {
    const L = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.03, 20), ringMat); ring.rotation.x = Math.PI / 2; L.add(ring);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.034, 20), lensMat); lens.rotation.x = Math.PI / 2; L.add(lens);
    let x, y;
    if (P.bar) { x = -w / 2 + 0.16 + i * 0.15; y = hh * 0.3; }
    else if (P.square) { x = -w / 2 + 0.12; y = hh / 2 - 0.14 - i * 0.15; }
    else { x = -w / 2 + 0.16 + (i % 2) * 0.14; y = hh / 2 - 0.16 - Math.floor(i / 2) * 0.14; }
    L.position.set(x, y, -d / 2 - 0.045); g.add(L);
  }
  // logo au dos
  const logo = new THREE.Mesh(new THREE.CircleGeometry(0.07, 24), new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 0.8, roughness: 0.25, transparent: true, opacity: 0.55 }));
  logo.rotation.y = Math.PI; logo.position.set(0, -0.05, -d / 2 - 0.013); g.add(logo);
  return g;
}

export function openPhoneStore(g, b, online = false) {
  let sel = phoneOf(g.profile).model, col = phoneOf(g.profile).color;
  // petite scène 3D dédiée à l'aperçu
  const canvas = h('canvas.ph-preview', { width: 300, height: 380 });
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.setSize(300, 380, false);
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(32, 300 / 380, 0.1, 20);
  cam.position.set(0, 0, 3.6);
  scene.add(new THREE.HemisphereLight('#ffffff', '#445', 1.4));
  const key = new THREE.DirectionalLight('#ffffff', 2.2); key.position.set(2, 3, 4); scene.add(key);
  const rim = new THREE.DirectionalLight('#9ad', 1.4); rim.position.set(-3, 1, -3); scene.add(rim);
  let mesh = null, spin = 0.6, drag = null, raf = 0, alive = true;
  const show = () => { if (mesh) scene.remove(mesh); const P = PHONES[sel]; mesh = phoneMesh(P, P.colors[col] || Object.values(P.colors)[0]); mesh.rotation.y = spin; scene.add(mesh); };
  canvas.addEventListener('pointerdown', (e) => { drag = e.clientX; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (drag !== null) { spin += (e.clientX - drag) * 0.012; drag = e.clientX; } });
  canvas.addEventListener('pointerup', () => { drag = null; });
  const loop = () => { if (!alive) return; if (drag === null) spin += 0.012; if (mesh) { mesh.rotation.y = spin; mesh.rotation.x = Math.sin(spin * 0.7) * 0.12; } renderer.render(scene, cam); raf = requestAnimationFrame(loop); };
  const m = g.ui.modal({
    title: online ? '📱 Téléphones · PlayAzon' : '📱 Rayon téléphones', sub: `${online ? 'Commande en ligne, livraison express par drone (+49 PC)' : b?.name || 'Magasin high-tech'} · fais tourner l'aperçu avec la souris ou le doigt`,
    width: 'min(820px, 96vw)',
    onClose: () => { alive = false; cancelAnimationFrame(raf); renderer.dispose(); },
    build: (body, mm) => {
      const P = PHONES[sel], owned = phoneOf(g.profile).owned || ['basique'], cur = phoneOf(g.profile);
      if (!P.colors[col]) col = Object.keys(P.colors)[0];
      const list = h('div.ph-list', Object.entries(PHONES).map(([id, Q]) => h(`div.list-item${id === sel ? '.sel' : ''}`, { style: { cursor: 'pointer' }, onclick: () => { sel = id; col = Object.keys(Q.colors)[0]; mm.refresh(); } },
        h('span', { style: { fontSize: '22px' } }, Q.retro ? '📟' : Q.fold ? '📖' : '📱'),
        h('div.grow', h('div.t', `${Q.name}${cur.model === id ? ' ✅' : owned.includes(id) ? ' (à toi)' : ''}`), h('div.d', `${Q.price ? `${fmt(Q.price)} PC` : 'Gratuit'} · 📷 ×${Q.cam}`)))));
      const info = h('div.ph-info',
        canvas,
        h('h3', P.name), h('p.muted', P.desc),
        h('div.d', `📷 ${P.lenses || 'aucun'} capteur(s) · photos ×${P.cam} · écran ${{ notch: 'à encoche', island: 'avec île dynamique', punch: 'à poinçon', retro: 'monochrome rétro' }[P.screen]}${P.fold ? ' · pliable (grand écran)' : ''}${P.titanium ? ' · titane' : ''}`),
        h('div.opt-row', { style: { margin: '8px 0' } }, Object.entries(P.colors).map(([cn, hex]) => h(`button.opt${cn === col ? '.sel' : ''}`, { onclick: () => { col = cn; mm.refresh(); } }, h('span', { style: { display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: hex, marginRight: '5px', verticalAlign: 'middle', boxShadow: '0 0 0 1px rgba(255,255,255,.4)' } }), cn))),
        h('button.btn', { onclick: async () => {
          try {
            const r = owned.includes(sel) ? await g.net.request('phone.equip', { model: sel, color: col }) : await g.net.request('phone.buy', { model: sel, color: col, online });
            g.sfx(r.price ? 'cash' : 'success');
            g.ui.toast(`📱 ${P.name} (${col})${r.price ? ` acheté : -${fmt(r.price)} PC` : ' : c\'est ton téléphone maintenant'} !`, 'good', 3500);
            g.phone?.restyle?.();
            mm.refresh();
          } catch (e) { g.sfx('error'); g.ui.toast(e.message, 'bad'); }
        } }, owned.includes(sel) ? (cur.model === sel && cur.color === col ? '✅ En main' : 'Utiliser ce téléphone') : `Acheter · ${fmt(P.price + (online && !g.profile.admin ? 49 : 0))} PC${online ? ' (livré)' : ''}`));
      body.append(h('div.ph-store', list, info));
      show();
    },
  });
  loop();
  return m;
}
