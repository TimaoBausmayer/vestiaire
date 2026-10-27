import * as THREE from 'three';
import { BUILDINGS } from '../../shared/world-layout.js';
import { SHAPES } from '../core/static-builder.js';

// BÂTIMENTS : générés à partir du plan partagé. Les bâtiments "visitables" (champ interior) sont des
// coques creuses : murs épais (façade + doublage intérieur) avec une vraie ouverture de porte, sol
// intérieur, étages et toit. Chaque partie porte un code d'escamotage (toit / mur N, S, O, E) : quand
// le joueur entre, le toit et les murs tournés vers la caméra disparaissent (vue "maison de poupée").

const ROT = { S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 };
export const PART = { ROOF: 1, N: 2, S: 3, W: 4, E: 5 };
const T = 0.3; // épaisseur des murs

// Couleur du sol et des murs intérieurs selon le type d'intérieur.
export const INTERIOR_STYLE = {
  shop: { floor: '#d9d2c4', alt: '#c9c0ae', wall: '#efe8da' }, restaurant: { floor: '#b9875a', alt: '#a8784e', wall: '#f3e3c9' },
  fastfood: { floor: '#f1f1f1', alt: '#e63946', wall: '#fff3d6' }, cafe: { floor: '#9c6b43', alt: '#8a5c37', wall: '#efe0c8' },
  bakery: { floor: '#efe3cf', alt: '#d9c7a6', wall: '#fbf2e2' }, supermarket: { floor: '#bdbcb5', alt: '#acaba4', wall: '#e4e3dd' },
  minimarket: { floor: '#bdbcb5', alt: '#acaba4', wall: '#e4e3dd' }, showroom: { floor: '#c9ced6', alt: '#b8bec8', wall: '#f4f4f4' },
  workshop: { floor: '#8d939b', alt: '#7d838b', wall: '#c9cdd3' }, warehouse: { floor: '#9a9a96', alt: '#8c8c88', wall: '#c8c6c0' },
  factory: { floor: '#8f8f8a', alt: '#7f7f7a', wall: '#bcb8b0' }, office: { floor: '#8fa3b8', alt: '#7f93a8', wall: '#eef2f6' },
  agency: { floor: '#c9b79c', alt: '#b9a78c', wall: '#f7f3ec' }, police: { floor: '#9aa8bc', alt: '#8a98ac', wall: '#e2e6ee' },
  hospital: { floor: '#cfe0e2', alt: '#bdd2d5', wall: '#f2f6f6' }, firestation: { floor: '#8d939b', alt: '#c1121f', wall: '#e9e2d6' },
  house: { floor: '#b88a5a', alt: '#a97c4f', wall: '#f4ecdf' }, salon: { floor: '#f1e4f3', alt: '#e2cfe6', wall: '#fff0f6' }, lobby: { floor: '#d6ccc2', alt: '#c7bdb3', wall: '#f5ebe0' },
  bank: { floor: '#e9dfc4', alt: '#d4c49c', wall: '#fbf6e9' }, mairie: { floor: '#c9b38f', alt: '#b59f7b', wall: '#f8f0dd' },
  arcade: { floor: '#2b2350', alt: '#3b2f6e', wall: '#1d1838' }, cinema: { floor: '#5a1e2c', alt: '#4a1824', wall: '#2a1b3d' },
  bowling: { floor: '#c9a46a', alt: '#b8945a', wall: '#24243e' }, gym: { floor: '#3a3a44', alt: '#2f2f38', wall: '#f1f1f1' }, boxing: { floor: '#2b2118', alt: '#3a2c20', wall: '#7f1d1d' }, museum: { floor: '#e9e4da', alt: '#d8d1c4', wall: '#fbf8f2' }, club: { floor: '#14121f', alt: '#1d1a2e', wall: '#120f1f' },
  school: { floor: '#e9c46a', alt: '#d9b45a', wall: '#fdf3e3' }, prison: { floor: '#9a9a9a', alt: '#8a8a8a', wall: '#c8c8c8' },
  barn: { floor: '#a47148', alt: '#94643e', wall: '#8a3b2a' }, cabin: { floor: '#7a5230', alt: '#6a4628', wall: '#8a6040' },
  casino: { floor: '#7a1027', alt: '#5e0c1e', wall: '#2a1b3d' }, range: { floor: '#8a8a84', alt: '#7a7a74', wall: '#b9b6ad' },
  karting: { floor: '#3a3a44', alt: '#2f2f38', wall: '#f4f1ea' },
};

function shade(hex, f) { const c = new THREE.Color(hex); c.multiplyScalar(f); return `#${c.getHexString()}`; }

export function buildingFrame(b) {
  const th = ROT[b.facing];
  const cos = Math.cos(th), sin = Math.sin(th);
  const W = b.facing === 'N' || b.facing === 'S' ? b.w : b.d;
  const D = b.facing === 'N' || b.facing === 'S' ? b.d : b.w;
  const L = (lx, lz) => [b.x + lx * cos + lz * sin, b.z - lx * sin + lz * cos];
  // côté du monde (N, S, O, E) d'une normale locale
  const side = (lnx, lnz) => {
    const wx = lnx * cos + lnz * sin, wz = -lnx * sin + lnz * cos;
    return Math.abs(wx) > Math.abs(wz) ? (wx > 0 ? PART.E : PART.W) : (wz > 0 ? PART.S : PART.N);
  };
  return { th, W, D, L, side };
}

export const isEnterable = (b) => !!b.interior && b.id !== 'residence';

// Hauteur du rez-de-chaussée visitable.
export function groundStorey(b) {
  const floors = b.floors || 1;
  return floors > 1 ? Math.min(b.h / floors, 4.4) : b.h;
}

// Ouvertures de la façade (en x local) : porte principale + portes de garage.
export function facadeOpenings(b, W) {
  const gH = groundStorey(b);
  const ops = [];
  const n = b.garageDoors || 0;
  const bigDoor = ['supermarket', 'showroom', 'hospital', 'mall'].includes(b.interior) || b.w * b.d > 600;
  const doorW = b.kind === 'house' || b.interior === 'house' ? 1.5 : bigDoor ? 3.4 : 2.2;
  const doorH = Math.min(gH - 0.5, 2.8);
  if (n) {
    const gw = Math.min(5.5, (W - doorW - 3) / n - 1.2);
    for (let i = 0; i < n; i++) ops.push({ x: -W / 2 + 1 + gw / 2 + i * (gw + 1.2), w: gw, h: Math.min(gH - 0.6, 4.6), garage: true });
    const last = ops[ops.length - 1];
    ops.push({ x: Math.min(W / 2 - doorW / 2 - 0.8, last.x + last.w / 2 + 1 + doorW / 2), w: doorW, h: doorH, door: true });
  } else ops.push({ x: 0, w: doorW, h: doorH, door: true });
  return ops;
}

export function buildBuildings(sb, collision, atlas) {
  BUILDINGS.forEach((b, i) => {
    b.bid = i + 1;
    if (isEnterable(b)) buildShell(sb, collision, atlas, b); else buildSolid(sb, collision, atlas, b);
    sb.cut = 0;
  });
}

// --------------------------------------------------------------------------------------------- utilitaires
function makeTools(sb, b, F) {
  const { th, L } = F;
  const box = (lx, y, lz, w, h, d, color, mat) => { const [x, z] = L(lx, lz); sb.box(x, y, z, w, h, d, color, th, mat); };
  const setPart = (p) => { sb.cut = p ? b.bid * 8 + p : 0; };
  return { box, setPart };
}

function winRow(len, place, spacing = 3) {
  const n = Math.max(1, Math.floor((len - 1.5) / spacing));
  const step = len / n;
  for (let i = 0; i < n; i++) place(-len / 2 + step * (i + 0.5));
}

// --------------------------------------------------------------------------------------------- coque visitable
function buildShell(sb, col, atlas, b) {
  const F = buildingFrame(b);
  const { th, W, D, L, side } = F;
  const { box, setPart } = makeTools(sb, b, F);
  const h = b.h, floors = b.floors || 1;
  const gH = groundStorey(b);
  const st = INTERIOR_STYLE[b.interior] || INTERIOR_STYLE.shop;
  const ext = b.color, trim = shade(b.color, 0.75);
  const bid = b.bid;
  const cs = (lnx, lnz) => side(lnx, lnz);
  const P = { front: cs(0, 1), back: cs(0, -1), left: cs(-1, 0), right: cs(1, 0) };
  const ops = facadeOpenings(b, W);
  b.openings = ops;
  b.gH = gH;
  const glassFront = ['showroom', 'minimarket'].includes(b.interior) || b.style === 'station' || b.style === 'showroom' || b.style === 'tower';

  // mur générique en local : axe 'x' (avant/arrière, à lz) ou 'z' (côtés, à lx), de a à b, hauteur y0..y1
  const wallX = (lz, a, c, y0, y1, outward, part) => {
    if (c - a < 0.05 || y1 - y0 < 0.05) return;
    setPart(part);
    const mid = (a + c) / 2, len = c - a;
    box(mid, y0, lz - outward * 0.1, len, y1 - y0, 0.2, ext);
    box(mid, y0, lz - outward * 0.25, len, y1 - y0, 0.1, st.wall);
    addLocalBox(col, L, a, lz - outward * T, c, lz, y0, y1, { bid });
  };
  const wallZ = (lx, a, c, y0, y1, outward, part) => {
    if (c - a < 0.05) return;
    setPart(part);
    const mid = (a + c) / 2, len = c - a;
    box(lx - outward * 0.1, y0, mid, 0.2, y1 - y0, len, ext);
    box(lx - outward * 0.25, y0, mid, 0.1, y1 - y0, len, st.wall);
    addLocalBox(col, L, lx - outward * T, a, lx, c, y0, y1, { bid });
  };

  // --- façade avant (ouvertures)
  const fz = D / 2;
  let cur = -W / 2;
  for (const o of [...ops].sort((p, q) => p.x - q.x)) {
    wallX(fz, cur, o.x - o.w / 2, 0, gH, 1, P.front);
    wallX(fz, o.x - o.w / 2, o.x + o.w / 2, o.h, gH, 1, P.front); // linteau
    cur = o.x + o.w / 2;
  }
  wallX(fz, cur, W / 2, 0, gH, 1, P.front);
  // --- arrière et côtés
  wallX(-fz, -W / 2, W / 2, 0, gH, -1, P.back);
  wallZ(-W / 2, -D / 2 + T, D / 2 - T, 0, gH, -1, P.left);
  wallZ(W / 2, -D / 2 + T, D / 2 - T, 0, gH, 1, P.right);

  // --- sol intérieur (carrelage en damier léger) — jamais escamoté
  setPart(0);
  const tile = b.interior === 'house' || b.interior === 'restaurant' || b.interior === 'cafe' || b.interior === 'barn' || b.interior === 'cabin' ? 1.2 : 2;
  const nx = Math.max(1, Math.round((W - 2 * T) / (tile * 4))), nz = Math.max(1, Math.round((D - 2 * T) / (tile * 4)));
  const iw = (W - 2 * T) / nx, idd = (D - 2 * T) / nz;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    box(-W / 2 + T + iw * (i + 0.5), 0, -D / 2 + T + idd * (j + 0.5), iw, 0.04, idd, (i + j) % 2 ? st.floor : st.alt);
  }
  // seuil + marche devant chaque ouverture
  for (const o of ops) {
    box(o.x, 0, fz - 0.15, o.w, 0.08, T + 0.02, '#b8b2a6');
    if (!o.garage) box(o.x, 0, fz + 0.55, o.w + 0.8, 0.14, 1.1, '#c9c3b6');
  }

  // --- encadrements, vitrines, fenêtres du rez-de-chaussée
  setPart(P.front);
  for (const o of ops) {
    box(o.x - o.w / 2 - 0.12, 0, fz + 0.05, 0.24, o.h + 0.12, 0.12, o.garage ? '#7d838b' : '#f4f1ea');
    box(o.x + o.w / 2 + 0.12, 0, fz + 0.05, 0.24, o.h + 0.12, 0.12, o.garage ? '#7d838b' : '#f4f1ea');
    box(o.x, o.h, fz + 0.05, o.w + 0.48, 0.18, 0.12, o.garage ? '#7d838b' : '#f4f1ea');
    if (o.garage) { box(o.x, o.h - 0.55, fz - 0.45, o.w, 0.55, 0.55, '#c3c8cf'); } // rideau métallique enroulé (ouvert)
  }
  const shopFront = ['shop', 'service', 'job'].includes(b.kind) && !['warehouse', 'factory', 'barn', 'prison'].includes(b.interior);
  const winH = Math.min(1.5, gH * 0.32), winY = Math.min(1.1, gH * 0.3);
  // vitrines entre les ouvertures (façade avant)
  let pos = -W / 2 + 0.6;
  const fronts = [];
  for (const o of [...ops].sort((p, q) => p.x - q.x)) { fronts.push([pos, o.x - o.w / 2 - 0.5]); pos = o.x + o.w / 2 + 0.5; }
  fronts.push([pos, W / 2 - 0.6]);
  for (const [a, c] of fronts) {
    const len = c - a;
    if (len < 1.2) continue;
    if (shopFront || glassFront) {
      const vh = glassFront ? Math.min(gH - 1.0, 3.2) : Math.min(2.4, gH - 1.6);
      box((a + c) / 2, 0.55, fz + 0.03, len, vh, 0.12, '#cfe8ff', 'windows');
      box((a + c) / 2, 0.55, fz - T - 0.03, len, vh, 0.06, '#d6ecfa');
      box((a + c) / 2, 0.4, fz + 0.1, len + 0.2, 0.18, 0.3, trim);
    } else {
      winRow(len, (lx) => {
        box((a + c) / 2 + lx, winY, fz + 0.03, 1.2, winH, 0.12, '#ffe9a8', 'windows');
        box((a + c) / 2 + lx, winY, fz - T - 0.03, 1.2, winH, 0.06, '#d6ecfa');
        box((a + c) / 2 + lx, winY - 0.15, fz + 0.12, 1.5, 0.15, 0.25, '#f4f1ea');
      });
    }
  }
  // fenêtres des côtés et de l'arrière (rez-de-chaussée)
  if (!['warehouse', 'factory', 'cinema', 'bowling'].includes(b.interior)) {
    setPart(P.left); winRow(D - 2, (lz) => { box(-W / 2 - 0.03, winY, lz, 0.12, winH, 1.2, '#ffe9a8', 'windows'); box(-W / 2 + T + 0.03, winY, lz, 0.06, winH, 1.2, '#d6ecfa'); }, 4);
    setPart(P.right); winRow(D - 2, (lz) => { box(W / 2 + 0.03, winY, lz, 0.12, winH, 1.2, '#ffe9a8', 'windows'); box(W / 2 - T - 0.03, winY, lz, 0.06, winH, 1.2, '#d6ecfa'); }, 4);
    setPart(P.back); winRow(W - 2, (lx) => { box(lx, winY, -D / 2 - 0.03, 1.2, winH, 0.12, '#ffe9a8', 'windows'); box(lx, winY, -D / 2 + T + 0.03, 1.2, winH, 0.06, '#d6ecfa'); }, 4);
  } else {
    // bardage nervuré (entrepôts, usines) : nervures verticales
    for (const [part, lenA, place] of [[P.left, D, (t) => box(-W / 2 - 0.05, 0, t, 0.1, gH - 0.2, 0.12, trim)], [P.right, D, (t) => box(W / 2 + 0.05, 0, t, 0.1, gH - 0.2, 0.12, trim)], [P.back, W, (t) => box(t, 0, -D / 2 - 0.05, 0.12, gH - 0.2, 0.1, trim)]]) {
      setPart(part);
      for (let t = -lenA / 2 + 1; t < lenA / 2 - 0.5; t += 1.6) place(t);
    }
    setPart(P.front);
    for (let t = -W / 2 + 0.8; t < W / 2 - 0.5; t += 1.6) if (!ops.some((o) => Math.abs(t - o.x) < o.w / 2 + 0.6)) box(t, 0, fz + 0.05, 0.12, gH - 0.2, 0.1, trim);
    // fenêtres hautes
    setPart(P.left); winRow(D - 2, (lz) => box(-W / 2 - 0.03, gH - 2, lz, 0.12, 0.9, 2.2, '#cfe8ff', 'windows'), 5);
    setPart(P.right); winRow(D - 2, (lz) => box(W / 2 + 0.03, gH - 2, lz, 0.12, 0.9, 2.2, '#cfe8ff', 'windows'), 5);
  }
  // soubassement
  setPart(P.front); box(0, 0, fz + 0.02, W + 0.05, 0.35, 0.1, trim);

  // --- étages + toit (partie "toit", escamotée en vue intérieure)
  setPart(PART.ROOF);
  if (floors > 1) {
    box(0, gH, 0, W, h - gH, D, ext);
    addLocalBox(col, L, -W / 2, -D / 2, W / 2, D / 2, gH, h, { bid });
    const fh = (h - gH) / (floors - 1);
    for (let f = 1; f < floors; f++) {
      const y = gH + (f - 1) * fh + fh * 0.3;
      const wh = Math.min(1.6, fh * 0.5);
      const isTower = b.style === 'tower';
      if (isTower) {
        // mur-rideau vitré + meneaux
        box(0, y - fh * 0.2, D / 2 + 0.03, W - 0.4, fh * 0.8, 0.1, '#9fc4e8', 'windows');
        box(0, y - fh * 0.2, -D / 2 - 0.03, W - 0.4, fh * 0.8, 0.1, '#9fc4e8', 'windows');
        box(W / 2 + 0.03, y - fh * 0.2, 0, 0.1, fh * 0.8, D - 0.4, '#9fc4e8', 'windows');
        box(-W / 2 - 0.03, y - fh * 0.2, 0, 0.1, fh * 0.8, D - 0.4, '#9fc4e8', 'windows');
        box(0, gH + f * fh - 0.12, 0, W + 0.1, 0.24, D + 0.1, shade(ext, 0.8));
        continue;
      }
      winRow(W, (lx) => {
        box(lx, y, D / 2 + 0.02, 1.2, wh, 0.15, '#ffe9a8', 'windows');
        box(lx, y - 0.15, D / 2 + 0.12, 1.5, 0.15, 0.25, '#f4f1ea');
        box(lx, y, -D / 2 - 0.02, 1.2, wh, 0.15, '#ffe9a8', 'windows');
        if (b.style === 'prison') for (let k = -2; k <= 2; k++) box(lx + k * 0.22, y, D / 2 + 0.12, 0.05, wh, 0.05, '#3a3a3a');
      });
      winRow(D, (lz) => { box(W / 2 + 0.02, y, lz, 0.15, wh, 1.2, '#ffe9a8', 'windows'); box(-W / 2 - 0.02, y, lz, 0.15, wh, 1.2, '#ffe9a8', 'windows'); });
      box(0, gH + (f - 1) * fh - 0.15, 0, W + 0.15, 0.3, D + 0.15, shade(ext, 0.85));
      if (b.style === 'apartment') winRow(W, (lx) => {
        box(lx, gH + (f - 1) * fh, D / 2 + 0.7, 2.2, 0.15, 1.4, '#e8e8e8');
        box(lx, gH + (f - 1) * fh + 0.15, D / 2 + 1.35, 2.2, 0.8, 0.08, '#ffffff', 'windows');
      });
    }
  }
  // toit
  if (b.roof === 'gable') {
    const along = W >= D;
    const rh = Math.min(4, Math.max(W, D) * 0.25);
    const [x, z] = L(0, 0);
    if (floors === 1) box(0, h - 0.3, 0, W, 0.25, D, st.wall); // plafond (sous la toiture, sans la toucher)
    if (along) sb.gable(x, h, z, W + 1.2, rh, D + 1.2, b.roofColor, th);
    else sb.gable(x, h, z, D + 1.2, rh, W + 1.2, b.roofColor, th + Math.PI / 2);
    if (b.kind === 'house' || b.interior === 'house') { const [cx, cz] = L(W * 0.25, -D * 0.15); sb.box(cx, h, cz, 0.9, rh + 0.8, 0.9, '#8a5a44', th); }
    addLocalBox(col, L, -W / 2, -D / 2, W / 2, D / 2, h - 0.25, h + rh * 0.6, { bid, noStand: true });
  } else {
    box(0, h - 0.3, 0, W, 0.3, D, b.roofColor);
    box(0, h, D / 2 - 0.15, W + 0.2, 0.8, 0.3, shade(b.roofColor, 1.1));
    box(0, h, -D / 2 + 0.15, W + 0.2, 0.8, 0.3, shade(b.roofColor, 1.1));
    box(W / 2 - 0.15, h, 0, 0.3, 0.8, D, shade(b.roofColor, 1.1));
    box(-W / 2 + 0.15, h, 0, 0.3, 0.8, D, shade(b.roofColor, 1.1));
    if (W > 12) { box(-W * 0.25, h, -D * 0.2, 1.6, 1, 1.2, '#c7ccd4'); box(W * 0.2, h, -D * 0.1, 1.2, 0.8, 1.2, '#b4bac4'); }
    if (floors === 1) addLocalBox(col, L, -W / 2, -D / 2, W / 2, D / 2, h - 0.3, h, { bid });
  }
  // corniche (sous le toit, sans toucher la dalle pour éviter le scintillement)
  if (b.roof !== 'gable') { setPart(floors > 1 ? PART.ROOF : P.front); box(0, (floors > 1 ? gH : h) - 0.75, D / 2 + 0.1, W + 0.3, 0.35, 0.2, shade(ext, 0.88)); }
  decorate(sb, col, atlas, b, F, { gH, ops, P, setPart, box });
}

// Collider (boîte alignée sur les axes du monde) d'un rectangle local, entre y0 et y1.
function addLocalBox(col, L, ax, az, bx, bz, y0, y1, opts) {
  const [x1, z1] = L(ax, az), [x2, z2] = L(bx, bz);
  return col.addBox(Math.min(x1, x2), y0, Math.min(z1, z2), Math.max(x1, x2), y1, Math.max(z1, z2), opts);
}

// --------------------------------------------------------------------------------------------- bâtiment plein (non visitable)
function buildSolid(sb, col, atlas, b) {
  const F = buildingFrame(b);
  const { W, D, L, th } = F;
  const { box } = makeTools(sb, b, F);
  const h = b.h, trim = shade(b.color, 0.75);
  sb.cut = 0;
  box(0, 0, 0, W, h, D, b.color);
  box(0, 0, 0, W + 0.3, 0.6, D + 0.3, trim);
  box(0, h - 0.4, 0, W + 0.4, 0.4, D + 0.4, shade(b.color, 0.88));
  col.addBoxC(b.x, b.z, b.w, b.d, 0, h + 0.6);
  box(0, h, 0, W + 0.2, 0.25, D + 0.2, b.roofColor);
  for (const [x, z, w, d] of [[0, D / 2 - 0.15, W + 0.2, 0.3], [0, -D / 2 + 0.15, W + 0.2, 0.3], [W / 2 - 0.15, 0, 0.3, D], [-W / 2 + 0.15, 0, 0.3, D]]) box(x, h, z, w, 0.8, d, shade(b.roofColor, 1.1));
  const floors = b.floors || Math.max(1, Math.floor(h / 3.2));
  const fh = h / floors;
  for (let f = 0; f < floors; f++) {
    const y = f * fh + fh * 0.32, wh = Math.min(1.6, fh * 0.5);
    winRow(W, (lx) => {
      if (f === 0 && Math.abs(lx) < 2.2) return;
      box(lx, y, D / 2 + 0.02, 1.2, wh, 0.15, '#ffe9a8', 'windows');
      box(lx, y - 0.15, D / 2 + 0.12, 1.5, 0.15, 0.25, '#f4f1ea');
      box(lx, y, -D / 2 - 0.02, 1.2, wh, 0.15, '#ffe9a8', 'windows');
    });
    winRow(D, (lz) => { box(W / 2 + 0.02, y, lz, 0.15, wh, 1.2, '#ffe9a8', 'windows'); box(-W / 2 - 0.02, y, lz, 0.15, wh, 1.2, '#ffe9a8', 'windows'); });
    if (f > 0) {
      box(0, f * fh - 0.15, 0, W + 0.15, 0.3, D + 0.15, shade(b.color, 0.85));
      winRow(W, (lx) => { box(lx, f * fh, D / 2 + 0.7, 2.2, 0.15, 1.4, '#e8e8e8'); box(lx, f * fh + 0.15, D / 2 + 1.35, 2.2, 0.8, 0.08, '#ffffff', 'windows'); });
    }
  }
  box(0, 0, D / 2 + 0.02, 2.2, 2.7, 0.2, '#f4f1ea');
  box(0, 0, D / 2 + 0.06, 1.7, 2.45, 0.2, '#4a3328');
  box(0.55, 1.2, D / 2 + 0.2, 0.15, 0.15, 0.12, '#ffd23f');
  box(0, 0, D / 2 + 0.6, 2.8, 0.18, 1.1, '#c9c3b6');
  if (b.sign) addSign(atlas, b, F, Math.min(h - 1.2, 3.6), 0);
}

// --------------------------------------------------------------------------------------------- décors de façade
function addSign(atlas, b, F, y, part) {
  const { W, D, L, th } = F;
  const sw = Math.min(W - 1, Math.max(6, b.sign.length * 0.62));
  const colors = b.neon ? { bg: '#14102b', fg: '#29e6ff', border: '#ff3fa4' } : b.style === 'police' ? { bg: '#1d3557', fg: '#ffffff', border: '#e63946' } : b.style === 'hospital' ? { bg: '#ffffff', fg: '#d62828', border: '#d62828' } : b.sign === 'À VENDRE' ? { bg: '#ffd23f', fg: '#1b1446', border: '#e63946' } : { bg: '#2b2350', fg: '#ffffff', border: '#ffd23f' };
  const [x, z] = L(0, D / 2 + 0.14);
  atlas.add(b.sign, { x, y, z, ry: th, w: sw, h: 1.3, cut: part ? b.bid * 8 + part : 0, ...colors });
}

function decorate(sb, col, atlas, b, F, { gH, ops, P, setPart, box }) {
  const { th, W, D, L } = F;
  const h = b.h;
  const door = ops.find((o) => o.door);
  // auvent rayé au-dessus des vitrines
  if (b.awning) {
    setPart(P.front);
    const aw = W - 1.5, n = Math.max(4, Math.floor(aw / 1.2));
    for (let i = 0; i < n; i++) {
      const lx = -aw / 2 + (aw / n) * (i + 0.5);
      const [x, z] = L(lx, D / 2 + 0.9);
      sb.add(SHAPES.box(), { x, y: Math.min(3.1, gH - 0.6), z, sx: aw / n, sy: 0.12, sz: 1.9, rx: -0.35, ry: th, color: i % 2 ? b.awning : '#ffffff' });
    }
  }
  // colonnes (banque)
  if (b.columns) {
    setPart(P.front);
    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue;
      const [x, z] = L(i * 2.6, D / 2 + 1.1);
      sb.cyl(x, 0, z, 0.4, gH - 0.5, '#f8f3e3', 10);
      col.addCyl(x, z, 0.45, 0, gH, { bid: b.bid });
    }
    box(0, gH - 1.1, D / 2 + 0.7, W, 0.7, 1.6, '#f8f3e3');
  }
  // tour de l'horloge (mairie)
  if (b.tower) {
    setPart(PART.ROOF);
    box(0, h, -1, 5, 6, 5, b.color);
    const [x, z] = L(0, -1);
    sb.add(SHAPES.cone(4), { x, y: h + 6, z, sx: 5.6 * 1.414, sy: 4, sz: 5.6 * 1.414, ry: th + Math.PI / 4, color: b.roofColor });
    const [cx, cz] = L(0, 1.55);
    sb.add(SHAPES.cyl(16), { x: cx, y: h + 3.3, z: cz, sx: 3, sy: 0.2, sz: 3, rx: Math.PI / 2, ry: th, color: '#ffffff' });
    const [hx, hz] = L(0, 1.72);
    sb.add(SHAPES.box(), { x: hx, y: h + 3.3, z: hz, sx: 0.15, sy: 1.1, sz: 0.06, ry: th, color: '#222' });
    sb.add(SHAPES.box(), { x: hx, y: h + 3.3, z: hz, sx: 0.8, sy: 0.12, sz: 0.06, ry: th, rz: 0.5, color: '#222' });
    const [fx, fz] = L(-W / 2 + 1.5, D / 2 - 1);
    sb.cyl(fx, h, fz, 0.08, 5, '#dddddd', 6);
    box(-W / 2 + 2.3, h + 3.8, D / 2 - 1, 1.6, 1, 0.05, '#ff5a5f');
  }
  // néons
  if (b.neon) {
    setPart(P.front);
    box(0, gH - 1.0, D / 2 + 0.1, W - 1, 0.15, 0.1, '#ff3fa4', 'glow');
    box(0, Math.min(3.4, gH - 0.5), D / 2 + 0.1, W - 1, 0.15, 0.1, '#29e6ff', 'glow');
    box(-W / 2 + 0.4, 0.5, D / 2 + 0.1, 0.15, gH - 1.5, 0.1, '#ffe14d', 'glow');
    box(W / 2 - 0.4, 0.5, D / 2 + 0.1, 0.15, gH - 1.5, 0.1, '#ffe14d', 'glow');
  }
  // grange : croisillons + silo
  if (b.barn) {
    setPart(P.front);
    const [x, z] = L(W / 2 - 3.5, D / 2 + 0.15);
    sb.add(SHAPES.box(), { x, y: 0.5, z, sx: 0.3, sy: 6, sz: 0.1, ry: th, rz: 0.6, color: '#ffffff' });
    sb.add(SHAPES.box(), { x, y: 0.5, z, sx: 0.3, sy: 6, sz: 0.1, ry: th, rz: -0.6, color: '#ffffff' });
    box(0, gH - 1.6, D / 2 + 0.05, 2.4, 1.6, 0.15, '#f4f1ea');
    setPart(0);
    const [sx, sz] = L(W / 2 + 3.5, -2);
    sb.cyl(sx, 0, sz, 2.6, 13, '#c9ccd2', 14);
    sb.add(SHAPES.sphere(12), { x: sx, y: 13, z: sz, sx: 5.2, sy: 3.2, sz: 5.2, color: '#8b95a5' });
    col.addCyl(sx, sz, 2.7, 0, 14);
  }
  // maisons : boîte aux lettres, haies, jardinières
  setPart(0);
  if (b.kind === 'house' || b.interior === 'house') {
    const [mx, mz] = L(1.8, D / 2 + 1.6);
    sb.cyl(mx, 0, mz, 0.06, 1.1, '#555', 6);
    sb.box(mx, 1.1, mz, 0.5, 0.4, 0.35, '#3c78d8', th);
    for (const s of [-1, 1]) box(s * (W / 2 - 1.2), 0, D / 2 + 1.9, W / 2 - 1.6, 0.9, 0.7, '#3f8f3a');
    setPart(P.front);
    box(-W * 0.3, 0.7, D / 2 + 0.3, 1.5, 0.25, 0.35, '#7a4b2a');
    box(-W * 0.3, 0.95, D / 2 + 0.3, 1.3, 0.2, 0.25, '#e05780');
  }
  // styles particuliers
  if (b.style === 'hospital') {
    setPart(P.front);
    box(0, gH - 0.5, 0, W + 0.1, 0.5, D + 0.1, '#4ea8de');
    box(door.x, door.h + 0.2, D / 2 + 2, door.w + 4, 0.25, 4, '#ffffff'); // marquise
    for (const s of [-1, 1]) { const [x, z] = L(door.x + s * (door.w / 2 + 1.6), D / 2 + 3.7); sb.cyl(x, 0, z, 0.12, door.h + 0.2, '#d0d4da', 8); col.addCyl(x, z, 0.15, 0, door.h); }
    setPart(PART.ROOF);
    box(W / 2 - 3, b.h, D / 2 - 3, 2.2, 0.7, 0.7, '#d62828'); box(W / 2 - 3, b.h - 0.05, D / 2 - 3, 0.7, 0.8, 2.2, '#d62828');
    box(-W / 4, b.h, 0, 10, 0.08, 10, '#3a3a3a'); // héliport
    box(-W / 4, b.h + 0.02, 0, 6, 0.1, 0.8, '#ffffff'); box(-W / 4 - 2.6, b.h + 0.02, 0, 0.8, 0.1, 4, '#ffffff'); box(-W / 4 + 2.6, b.h + 0.02, 0, 0.8, 0.1, 4, '#ffffff');
  }
  if (b.style === 'police') {
    setPart(P.front);
    box(0, gH - 0.6, D / 2 + 0.06, W, 0.35, 0.1, '#1d3557');
    box(0, gH - 0.25, D / 2 + 0.06, W, 0.12, 0.1, '#e63946');
    setPart(0);
    for (const [s, c] of [[-1, '#1d3557'], [0, '#ffffff'], [1, '#e63946']]) { const [x, z] = L(W / 2 - 2 + s * 0.01, D / 2 + 2.5); if (s === 0) sb.cyl(x, 0, z, 0.07, 7, '#dddddd', 6); box(W / 2 - 1.6 + s * 0.5, 5.6, D / 2 + 2.5, 0.5, 1.0, 0.04, c); }
  }
  if (b.style === 'cinema') {
    setPart(P.front);
    box(0, gH * 0.45, D / 2 + 1.2, W - 2, 0.3, 2.4, '#2a0f45');
    box(0, gH * 0.45 + 0.3, D / 2 + 2.35, W - 2, 1.2, 0.12, '#ffd23f', 'glow');
    for (let i = -6; i <= 6; i++) box(i * (W - 3) / 12, gH * 0.45 - 0.1, D / 2 + 2.38, 0.15, 0.15, 0.1, '#fff3b0', 'glow');
  }
  if (b.style === 'big-box') {
    setPart(P.front);
    box(0, gH - 1.8, D / 2 + 0.06, W, 1.0, 0.1, '#d00000');
    box(door.x, door.h + 0.25, D / 2 + 1.6, door.w + 6, 0.3, 3.2, '#d00000');
  }
  if (b.style === 'showroom') {
    setPart(P.front);
    box(0, gH - 1.2, D / 2 + 0.06, W, 1.2, 0.12, '#212529');
    // drapeaux de la concession
    setPart(0);
    for (let i = 0; i < 5; i++) { const [x, z] = L(-W / 2 + 2 + i * 3.6, D / 2 + 4); sb.cyl(x, 0, z, 0.06, 6, '#dddddd', 6); sb.box(x + 0.5, 4.6, z, 1, 1.3, 0.04, ['#ff5a5f', '#ffd23f', '#2ec4b6', '#c77dff', '#ff9f1c'][i], th); col.addCyl(x, z, 0.1, 0, 6, { noCamera: true }); }
  }
  if (b.style === 'factory') {
    setPart(PART.ROOF);
    for (let i = 0; i < 4; i++) { const [x, z] = L(-W / 2 + W / 8 + i * W / 4, 0); sb.add(SHAPES.box(), { x, y: h - 0.2, z, sx: W / 4, sy: 0.25, sz: D, rx: 0, rz: 0.35, ry: th, color: shade(b.roofColor, 0.9) }); }
    setPart(0);
    const [cx, cz] = L(W / 2 - 3, -D / 2 + 3);
    sb.cyl(cx, h, cz, 1.1, 10, '#8d6e63', 12); sb.cyl(cx, h + 9.5, cz, 1.2, 0.6, '#e63946', 12);
  }
  if (b.style === 'prison') {
    setPart(P.front);
    for (let i = -6; i <= 6; i++) box(i * 0.8, 0, D / 2 + 0.08, 0.06, gH - 0.4, 0.06, '#3a3a3a');
  }
  // enseigne (atlas)
  if (b.sign) {
    const y = b.style === 'cinema' ? gH * 0.45 + 0.9 : b.awning ? Math.min(4.3, gH - 0.2) : b.garageDoors ? Math.min(gH - 0.9, 5.4) : Math.min(gH - 0.7, 3.8);
    addSign(atlas, b, F, b.style === 'tower' ? gH + 0.2 : y, b.style === 'tower' ? PART.ROOF : P.front);
  }
  setPart(0);
}
