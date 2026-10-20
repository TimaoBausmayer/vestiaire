// MODÈLES D'INTÉRIEURS : chaque type de bâtiment visitable a son aménagement (meubles, comptoirs,
// rayons, produits, personnel, points d'interaction). Coordonnées locales : x le long de la façade
// (-W/2..W/2), z de l'arrière (-D/2) vers la porte (+D/2). t = outils fournis par interiors.js.

const PRODUCT_COLORS = ['#ff5a5f', '#2ec4b6', '#ffd23f', '#8b5cf6', '#7ac74f', '#ff9f1c', '#3d8ee8', '#f4f1ea'];

// --------------------------------------------------------------------------------------------- mobilier commun
function shelf(t, lx, lz, len, ry = 0, h = 2.0, colors = PRODUCT_COLORS, kind = 'boxes') {
  // étagère le long de l'axe x local (ry tourne l'ensemble)
  const c = Math.cos(ry), s = Math.sin(ry);
  const P = (ax, az) => [lx + ax * c + az * s, lz - ax * s + az * c];
  const [x0, z0] = P(0, 0);
  t.box(x0, 0, z0, len, h, 0.55, '#c9b79c', 'main', ry);
  for (let r = 0; r < 4; r++) {
    const y = 0.12 + r * (h / 4);
    const [bx, bz] = P(0, 0.05);
    t.box(bx, y - 0.04, bz, len - 0.08, 0.04, 0.5, '#a8956f', 'main', ry);
    for (let i = 0; i < Math.floor(len / 0.3); i++) {
      const ax = -len / 2 + 0.2 + i * 0.3;
      const [px, pz] = P(ax, 0.12);
      const col = colors[(i + r * 3 + Math.floor(lx * 7 + lz * 3)) % colors.length];
      if (kind === 'bottles') t.cyl(px, y, pz, 0.07, 0.3, col, 6);
      else if (kind === 'round') t.sphere(px, y + 0.12, pz, 0.12, col);
      else t.box(px, y, pz, 0.22, 0.3 + ((i * 7 + r) % 3) * 0.06, 0.28, col, 'main', ry);
    }
  }
  t.solid(x0, z0, len, 0.6, h, ry);
}

function counter(t, lx, lz, len, ry = 0, color = '#8d6e63', top = '#e9e4da') {
  t.box(lx, 0, lz, len, 1.0, 0.8, color, 'main', ry);
  t.box(lx, 1.0, lz, len + 0.1, 0.06, 0.9, top, 'main', ry);
  t.solid(lx, lz, len, 0.9, 1.1, ry);
}

function register(t, lx, lz, ry = 0) {
  t.box(lx, 1.06, lz, 0.45, 0.22, 0.35, '#2b2d33', 'main', ry);
  t.box(lx, 1.28, lz - 0.05, 0.4, 0.22, 0.05, '#29e6ff', 'glow', ry);
}

function rack(t, lx, lz, len, ry = 0, colors = PRODUCT_COLORS) {
  // portant de vêtements
  const c = Math.cos(ry), s = Math.sin(ry);
  for (const e of [-len / 2, len / 2]) t.cyl(lx + e * c, 0, lz - e * s, 0.04, 1.6, '#9aa0a8', 6);
  t.box(lx, 1.55, lz, len, 0.05, 0.05, '#9aa0a8', 'main', ry);
  for (let i = 0; i < Math.floor(len / 0.32); i++) {
    const ax = -len / 2 + 0.25 + i * 0.32;
    t.box(lx + ax * c, 0.75, lz - ax * s, 0.08, 0.75, 0.55, colors[i % colors.length], 'main', ry);
  }
  t.solid(lx, lz, len, 0.6, 1.6, ry);
}

function tableSet(t, lx, lz, seats = 4, round = false, color = '#a0703c') {
  if (round) { t.cyl(lx, 0, lz, 0.07, 0.75, '#4a4e5a', 6); t.cyl(lx, 0.72, lz, 0.55, 0.05, color, 14); }
  else { t.box(lx, 0.72, lz, 1.3, 0.06, 0.8, color); for (const [x, z] of [[-0.55, -0.32], [0.55, -0.32], [-0.55, 0.32], [0.55, 0.32]]) t.box(lx + x, 0, lz + z, 0.06, 0.72, 0.06, '#5a3d2b'); }
  t.solid(lx, lz, round ? 1.0 : 1.3, round ? 1.0 : 0.8, 0.8);
  const places = seats === 2 ? [[0, -0.75, 0], [0, 0.75, Math.PI]] : [[-0.4, -0.75, 0], [0.4, -0.75, 0], [-0.4, 0.75, Math.PI], [0.4, 0.75, Math.PI]];
  for (const [x, z, ry] of places) {
    t.furn('chaise', lx + x, lz + z, ry);
    t.seat(lx + x, lz + z, ry, 0.5);
  }
}

function plant(t, lx, lz, s = 1) { t.furn('plante', lx, lz, 0, s); }
function poster(t, lx, lz, ry, color, w = 1.4, h = 1.0) { t.box(lx, 1.6, lz, w, h, 0.04, color, 'main', ry); t.box(lx, 1.6 + 0.05, lz + 0.01, w - 0.2, h - 0.2, 0.045, '#ffffff', 'main', ry); }
function wallLamp(t, lx, lz, ry) { t.box(lx, 2.4, lz, 0.5, 0.18, 0.2, '#fff3c4', 'glow', ry); }

// Lampes murales tout autour (éclairage la nuit).
function lightsAround(t) {
  const I = t.inner;
  for (let x = I.x1 + 2; x < I.x2 - 1; x += 5) wallLamp(t, x, I.z1 + 0.12, 0);
  for (let z = I.z1 + 3; z < I.z2 - 2; z += 5) { wallLamp(t, I.x1 + 0.12, z, Math.PI / 2); wallLamp(t, I.x2 - 0.12, z, -Math.PI / 2); }
}

// Comptoir de vente au fond, avec caisse et vendeur·se. Renvoie la position du comptoir.
function shopCounter(t, label, action, role = 'vendeur', side = 1) {
  const I = t.inner;
  const cx = side * (I.x2 - 2.6), cz = I.z1 + 2.0;
  counter(t, cx, cz, 3.2);
  register(t, cx + 0.8, cz);
  t.staff(cx, cz - 1.0, 0, role);
  t.spot(cx, cz + 1.1, { label, action, r: 2.2, priority: 2 });
  return { cx, cz };
}

// --------------------------------------------------------------------------------------------- modèles
export const TEMPLATES = {
  shop(t) {
    const I = t.inner, b = t.b, kind = b.shop;
    lightsAround(t);
    shopCounter(t, `🛒 Acheter : ${b.name}`, 'shop', kind === 'electronics' ? 'geek' : kind === 'pets' || kind === 'pet-acc' ? 'soigneur' : 'vendeur', t.rand() < 0.5 ? 1 : -1);
    const midZ = (I.z1 + I.z2) / 2;
    if (kind === 'clothes' || kind === 'clothes-used') {
      for (let x = I.x1 + 2; x < I.x2 - 4; x += 3.2) rack(t, x, midZ - 1, 2.4, Math.PI / 2);
      rack(t, 0, I.z1 + 0.8, Math.min(6, I.x2 - I.x1 - 8));
      // cabine d'essayage
      const fx = I.x1 + 1.2, fz = I.z1 + 1.2;
      t.box(fx + 0.9, 0, fz, 0.08, 2.2, 1.8, '#c77dff'); t.box(fx, 0, fz + 0.9, 1.8, 2.2, 0.08, '#c77dff');
      t.box(fx - 0.2, 2.1, fz + 0.9, 1.6, 0.06, 0.06, '#9aa0a8');
      t.spot(fx + 0.3, fz + 1.6, { label: '🪞 Cabine d\'essayage (garde-robe)', action: 'wardrobe', r: 1.6 });
    } else if (kind === 'furniture' || kind === 'furniture-used') {
      const pieces = ['canape', 'lit', 'table', 'etagere', 'lampe', 'tele', 'piano', 'aquarium', 'trone', 'frigo'];
      let k = 0;
      for (let x = I.x1 + 2.2; x < I.x2 - 4.5; x += 3.6) for (let z = I.z1 + 4; z < I.z2 - 2.5; z += 3.4) {
        const id = pieces[(k++ + (kind === 'furniture-used' ? 3 : 0)) % pieces.length];
        t.furn(id, x, z, 0); t.solid(x, z, 1.6, 1.2, 1);
        if (id === 'canape') t.seat(x, z + 0.1, 0, 0.45);
        t.box(x + 0.7, 0, z + 0.9, 0.35, 0.5, 0.05, '#ffd23f');
      }
    } else if (kind === 'electronics') {
      for (let x = I.x1 + 2; x < I.x2 - 4; x += 3) for (const z of [midZ - 1.2, midZ + 1.8]) {
        t.box(x, 0, z, 2.2, 0.9, 0.9, '#2b2d42'); t.solid(x, z, 2.2, 0.9, 1);
        for (let i = -1; i <= 1; i++) { t.box(x + i * 0.65, 0.9, z, 0.55, 0.38, 0.05, '#14141c'); t.box(x + i * 0.65, 0.93, z + 0.03, 0.48, 0.3, 0.02, ['#29e6ff', '#ff3fa4', '#7ac74f'][(i + 1) % 3], 'glow'); }
      }
      t.furn('tele', 0, I.z1 + 0.6, 0, 1.6);
      shelf(t, I.x1 + 0.6, midZ, Math.min(6, I.z2 - I.z1 - 4), Math.PI / 2, 2, ['#2b2d42', '#14141c', '#3d8ee8'], 'boxes');
    } else if (kind === 'pets' || kind === 'pet-acc') {
      for (let x = I.x1 + 1.5; x < I.x2 - 4; x += 2.6) {
        t.box(x, 0, I.z1 + 0.7, 2.2, 0.8, 1.0, '#a0703c'); t.box(x, 0.8, I.z1 + 0.7, 2.1, 0.9, 0.95, '#cfe8ff', 'windows');
        t.solid(x, I.z1 + 0.7, 2.2, 1, 1.7);
      }
      t.furn('aquarium', I.x1 + 1.2, midZ, Math.PI / 2); t.solid(I.x1 + 1.2, midZ, 0.6, 1.4, 1.4);
      shelf(t, 0, midZ + 0.5, Math.min(5, I.x2 - I.x1 - 8), 0, 1.6, ['#c2410c', '#ffd23f', '#7ac74f'], 'boxes');
      t.pets(['chat', 'lapin', 'poulet', 'tortue'].slice(0, 3), I.x1 + 1.5, I.z1 + 0.9);
    } else if (kind === 'bikes') {
      for (let i = 0; i < 4; i++) t.vehicleDisplay(['velo', 'scooter', 'moto', 'velo'][i], I.x1 + 2 + i * 2.6, midZ, Math.PI / 2);
      shelf(t, 0, I.z1 + 0.6, Math.min(6, I.x2 - I.x1 - 8), 0, 1.8, ['#2b2d42', '#ff5a5f', '#ffd23f'], 'round');
      t.box(0, 0, midZ + 2.5, 3, 0.4, 1.2, '#495057'); t.solid(0, midZ + 2.5, 3, 1.2, 0.5);
    } else if (kind === 'brocante' || kind === 'depot') {
      const odd = ['statue-poulet', 'piano', 'trone', 'nain-jardin', 'aquarium', 'lampe', 'boule-disco', 'etagere'];
      let k = 0;
      for (let x = I.x1 + 2; x < I.x2 - 4; x += 3) for (let z = I.z1 + 3.5; z < I.z2 - 2.5; z += 3) { const id = odd[k++ % odd.length]; t.furn(id, x, z, t.rand() * 6.28); t.solid(x, z, 1.2, 1.2, 1); }
      shelf(t, I.x1 + 0.6, (I.z1 + I.z2) / 2, Math.min(8, I.z2 - I.z1 - 4), Math.PI / 2, 2, ['#bc6c25', '#606c38', '#dda15e', '#283618'], 'round');
    } else {
      for (let x = I.x1 + 2; x < I.x2 - 4; x += 3) shelf(t, x, midZ, Math.min(4, (I.z2 - I.z1) * 0.45), Math.PI / 2);
    }
    plant(t, I.x1 + 0.6, I.z2 - 0.8); plant(t, I.x2 - 0.6, I.z2 - 0.8);
  },

  bakery(t) {
    const I = t.inner;
    lightsAround(t);
    // vitrine réfrigérée avec pâtisseries + caisse
    const cz = I.z1 + 2.2;
    t.box(0, 0, cz, I.x2 - I.x1 - 2.5, 0.9, 0.9, '#f4f1ea'); t.box(0, 0.9, cz, I.x2 - I.x1 - 2.5, 0.45, 0.85, '#cfe8ff', 'windows');
    t.solid(0, cz, I.x2 - I.x1 - 2.5, 1, 1.4);
    for (let x = I.x1 + 2; x < I.x2 - 2; x += 0.7) { t.sphere(x, 0.98, cz, 0.16, ['#e9c46a', '#d4a373', '#7f4f24', '#ffcad4'][Math.floor((x + 50) * 3) % 4]); }
    register(t, I.x2 - 2, cz);
    t.staff(0, cz - 1.0, 0, 'boulanger');
    t.spot(0, cz + 1.2, { label: `🥐 Acheter : ${t.b.name}`, action: 'shop', r: 2.4, priority: 2 });
    // baguettes au mur
    for (let i = 0; i < 12; i++) t.box(I.x1 + 1 + i * 0.25, 1.2, I.z1 + 0.3, 0.12, 1.1, 0.12, '#c8893c', 'main', 0.15);
    if (t.b.interior === 'bakery' && t.b.shop === 'farm') for (let i = 0; i < 5; i++) t.box(I.x1 + 2 + i * 1.2, 0, (I.z1 + I.z2) / 2 + 1, 1, 0.6, 0.8, '#a0703c');
    tableSet(t, I.x2 - 1.6, I.z2 - 1.8, 2, true);
  },

  cafe(t) {
    const I = t.inner;
    lightsAround(t);
    const bz = I.z1 + 1.8;
    counter(t, I.x1 + 3, bz, Math.min(5, I.x2 - I.x1 - 4), 0, '#5a3d2b', '#c9a46a');
    t.box(I.x1 + 1.8, 1.06, bz, 0.6, 0.6, 0.45, '#9aa0a8'); // machine à café
    t.box(I.x1 + 1.8, 1.4, bz + 0.24, 0.2, 0.12, 0.02, '#ff5a5f', 'glow');
    t.staff(I.x1 + 3, bz - 1, 0, 'serveur');
    t.spot(I.x1 + 3, bz + 1.2, { label: `☕ Commander : ${t.b.name}`, action: 'shop', r: 2.4, priority: 2 });
    for (let x = I.x1 + 2.5; x < I.x2 - 1.5; x += 3) for (let z = bz + 3; z < I.z2 - 1.2; z += 3) tableSet(t, x, z, 2, true);
    plant(t, I.x2 - 0.6, I.z1 + 0.6);
  },

  restaurant(t) {
    const I = t.inner;
    lightsAround(t);
    // cuisine au fond derrière un muret
    const kz = I.z1 + 2.4;
    t.wall(I.x1 + 0.2, kz, I.x2 - 3.2, kz, 1.1, '#d9cdb8');
    for (let x = I.x1 + 1; x < I.x2 - 3.5; x += 1.4) { t.box(x, 0, I.z1 + 0.6, 1.2, 0.95, 0.8, '#c7ccd4'); t.box(x, 0.95, I.z1 + 0.6, 0.9, 0.04, 0.6, '#2b2d33'); t.cyl(x - 0.2, 0.99, I.z1 + 0.6, 0.18, 0.2, '#9aa0a8', 10); }
    t.solid((I.x1 + I.x2 - 3) / 2, I.z1 + 0.6, I.x2 - I.x1 - 3.5, 0.9, 1);
    t.staff(I.x1 + 2.5, I.z1 + 1.6, Math.PI, 'cuisinier');
    // comptoir d'accueil
    const cx = I.x2 - 1.8, cz = kz + 1.2;
    counter(t, cx, cz, 2.2, Math.PI / 2, '#6d2e46', '#e9e4da'); register(t, cx, cz, Math.PI / 2);
    t.staff(cx + 0.9, cz, -Math.PI / 2, 'serveur');
    t.spot(cx - 1.2, cz, { label: `🍽️ Commander : ${t.b.name}`, action: 'shop', r: 2.4, priority: 2 });
    for (let x = I.x1 + 2; x < I.x2 - 3.5; x += 3.2) for (let z = kz + 2.6; z < I.z2 - 1.4; z += 3.2) tableSet(t, x, z, 4, false, t.b.shop === 'homard' ? '#f4f1ea' : '#a0703c');
    plant(t, I.x2 - 0.6, I.z2 - 0.8);
  },

  fastfood(t) {
    const I = t.inner;
    lightsAround(t);
    const cz = I.z1 + 2.2;
    counter(t, 0, cz, I.x2 - I.x1 - 3, 0, '#e63946', '#f4f1ea');
    register(t, -1.5, cz); register(t, 1.5, cz);
    // menu lumineux
    for (let i = -1; i <= 1; i++) t.box(i * 2.2, 2.3, I.z1 + 0.12, 2, 1.1, 0.06, ['#ffd23f', '#ff9f1c', '#ffd23f'][i + 1], 'glow');
    t.staff(-1.5, cz - 1, 0, 'equipier'); t.staff(1.5, cz - 1, 0, 'equipier');
    t.box(I.x2 - 1.2, 0, cz - 0.9, 1, 1.6, 0.7, '#2b2d42'); // fontaine à soda
    t.spot(0, cz + 1.2, { label: `🍔 Commander : ${t.b.name}`, action: 'shop', r: 3, priority: 2 });
    // banquettes
    for (let x = I.x1 + 2; x < I.x2 - 1.5; x += 3.4) for (let z = cz + 3; z < I.z2 - 1.3; z += 3) {
      t.box(x, 0, z, 1.2, 0.75, 0.75, '#f4f1ea'); t.solid(x, z, 1.2, 0.75, 0.8);
      for (const s of [-1, 1]) { t.box(x, 0, z + s * 0.85, 1.3, 0.5, 0.5, '#e63946'); t.box(x, 0.5, z + s * 1.05, 1.3, 0.6, 0.12, '#c1121f'); t.seat(x, z + s * 0.85, s < 0 ? 0 : Math.PI, 0.5); }
    }
  },

  supermarket(t) {
    const I = t.inner;
    lightsAround(t);
    // rayons
    const cats = [['🍎 Fruits et légumes', ['#7ac74f', '#ff5a5f', '#ffd23f'], 'round'], ['🥫 Épicerie', PRODUCT_COLORS, 'boxes'], ['🥤 Boissons', ['#3d8ee8', '#ff5a5f', '#7ac74f', '#ff9f1c'], 'bottles'], ['🍫 Gourmandises', ['#7f4f24', '#ff5a5f', '#ffd23f'], 'boxes'], ['🧀 Crèmerie', ['#fff3b0', '#f4f1ea', '#ffd23f'], 'boxes']];
    const aisleLen = Math.min(10, (I.z2 - I.z1) - 8);
    let k = 0;
    for (let x = I.x1 + 3; x < I.x2 - 3; x += 3.6) {
      const [label, cols, kind] = cats[k++ % cats.length];
      shelf(t, x, I.z1 + 2.5 + aisleLen / 2, aisleLen, Math.PI / 2, 1.8, cols, kind);
      t.spot(x + 1.2, I.z1 + 2.5 + aisleLen / 2, { label: `🧺 Rayon ${label} : remplir le panier`, action: 'basket', r: 2.2 });
    }
    // frigos au fond
    for (let x = I.x1 + 1; x < I.x2 - 1; x += 1.6) { t.box(x, 0, I.z1 + 0.5, 1.5, 2.1, 0.8, '#d0d4da'); t.box(x, 0.2, I.z1 + 0.92, 1.35, 1.8, 0.04, '#cfe8ff', 'glow'); }
    t.solid(0, I.z1 + 0.5, I.x2 - I.x1 - 1, 0.9, 2.1);
    // caisses près de l'entrée
    const cz = I.z2 - 3.2;
    const nCheck = Math.max(1, Math.min(3, Math.floor((I.x2 - I.x1) / 8)));
    for (let i = 0; i < nCheck; i++) {
      const cx = I.x1 + 2.5 + i * 4;
      t.box(cx, 0, cz, 0.9, 0.9, 2.6, '#495057'); t.box(cx + 0.05, 0.9, cz, 0.7, 0.05, 2.4, '#2b2d33'); register(t, cx, cz - 0.9, Math.PI / 2);
      t.solid(cx, cz, 0.9, 2.6, 1);
      t.staff(cx - 0.9, cz - 0.6, Math.PI / 2, 'caissier');
      t.spot(cx + 1.0, cz, { label: '💳 Passer en caisse (payer le panier)', action: 'checkout', r: 2.2, priority: 3 });
    }
    // caddies
    for (let i = 0; i < 4; i++) t.vehicleDisplay('caddie', I.x2 - 1.2, I.z2 - 1.2 - i * 0.6, Math.PI, true);
  },

  minimarket(t) { TEMPLATES.supermarket(t); },

  showroom(t) {
    const I = t.inner;
    lightsAround(t);
    const models = t.b.shop === 'cars-new' ? ['sportive', 'suv', 'berline', 'coupe', 'citadine'] : ['berline', 'citadine', 'pickup'];
    const n = Math.min(models.length, Math.floor((I.x2 - I.x1) / 7));
    for (let i = 0; i < n; i++) {
      const x = I.x1 + 4 + i * ((I.x2 - I.x1 - 8) / Math.max(1, n - 1));
      t.box(x, 0, -1, 5.5, 0.12, 8, '#e9ecef'); // podium
      t.showcar(models[i], x, -1, 0.5 + i * 0.35);
    }
    const dx = I.x2 - 2.5, dz = I.z2 - 3;
    t.furn('bureau', dx, dz, Math.PI); t.solid(dx, dz, 1.8, 1, 1);
    t.staff(dx, dz - 1, 0, 'commercial');
    t.spot(dx, dz + 1.3, { label: '📋 Catalogue complet de la concession', action: 'shop', r: 2.2, priority: 2 });
    plant(t, I.x1 + 0.7, I.z2 - 0.7); plant(t, I.x2 - 0.7, I.z1 + 0.7);
  },

  workshop(t) {
    const I = t.inner;
    lightsAround(t);
    // pont élévateur avec une voiture en réparation
    const lx = (I.x1 + I.x2) / 2 - 2, lz = (I.z1 + I.z2) / 2;
    for (const s of [-1, 1]) { t.box(lx + s * 1.7, 0, lz, 0.4, 2.6, 0.4, '#ffb703'); t.solid(lx + s * 1.7, lz, 0.4, 0.4, 2.6); }
    t.showcar(t.rand() < 0.5 ? 'citadine' : 'break', lx, lz, 0, 1.4, true);
    // établis + outils
    for (let x = I.x1 + 1.2; x < I.x2 - 1; x += 2.4) { t.box(x, 0, I.z1 + 0.5, 2.2, 0.9, 0.7, '#6c757d'); t.box(x, 0.9, I.z1 + 0.5, 2.2, 0.05, 0.7, '#adb5bd'); t.box(x, 1.2, I.z1 + 0.12, 2, 1, 0.05, '#495057'); for (let k = 0; k < 4; k++) t.box(x - 0.7 + k * 0.45, 1.4, I.z1 + 0.16, 0.08, 0.5, 0.04, '#d00000'); }
    t.solid(0, I.z1 + 0.5, I.x2 - I.x1 - 1, 0.8, 1);
    for (let i = 0; i < 4; i++) t.cyl(I.x2 - 1, i * 0.32, I.z2 - 2.5, 0.38, 0.3, '#17171c', 14);
    t.solid(I.x2 - 1, I.z2 - 2.5, 0.8, 0.8, 1.3);
    t.cyl(I.x1 + 1, 0, I.z2 - 2.2, 0.35, 1, '#2a6f97', 10); t.cyl(I.x1 + 1.8, 0, I.z2 - 2.2, 0.35, 1, '#d62828', 10);
    t.staff(lx + 2.6, lz + 1, -Math.PI / 2, 'mecano');
    if (t.b.shop) t.spot(lx + 3.6, lz + 1, { label: t.b.shop === 'vehicles' ? `🛵 Garage : acheter, appeler, repeindre` : '🔧 Atelier : réparer, faire le plein, repeindre', action: t.b.shop === 'repair' ? 'repair' : 'shop', r: 2.4, priority: 2 });
  },

  warehouse(t) {
    const I = t.inner;
    lightsAround(t);
    for (let x = I.x1 + 2; x < I.x2 - 2; x += 4.5) {
      const len = Math.min(10, I.z2 - I.z1 - 7);
      const z = (I.z1 + I.z2) / 2 - 1;
      for (let lv = 0; lv < 3; lv++) {
        t.box(x, lv * 1.6 + 1.5, z, 1.4, 0.08, len, '#ff9f1c');
        for (let k = 0; k < Math.floor(len / 1.3); k++) t.box(x, lv * 1.6 + 1.58, z - len / 2 + 0.7 + k * 1.3, 1.1, 0.9, 1.1, ['#b08a58', '#d4a373', '#a47148'][(k + lv) % 3]);
      }
      for (const e of [-len / 2, len / 2]) t.box(x, 0, z + e, 1.5, 5, 0.12, '#2a6f97');
      t.solid(x, z, 1.5, len, 5);
    }
    t.showcar('fourgon', I.x2 - 4, I.z2 - 4.5, Math.PI / 2, 0, true);
    t.staff(I.x1 + 2, I.z2 - 2.5, Math.PI / 2, 'manutentionnaire');
    t.spot(I.x1 + 3.2, I.z2 - 2.5, { label: '📦 Discuter avec le chef d\'entrepôt', action: 'talk', r: 2.2 });
  },

  factory(t) {
    const I = t.inner;
    lightsAround(t);
    const z = (I.z1 + I.z2) / 2;
    t.box(0, 0.7, z, I.x2 - I.x1 - 4, 0.15, 1.6, '#495057'); // tapis roulant
    for (let x = I.x1 + 3; x < I.x2 - 3; x += 1.2) t.box(x, 0, z, 0.15, 0.7, 1.6, '#343a40');
    t.solid(0, z, I.x2 - I.x1 - 4, 1.6, 1);
    const sock = t.b.id === 'usine-chaussettes';
    for (let x = I.x1 + 3.5; x < I.x2 - 3; x += 2) sock ? t.box(x, 0.85, z, 0.3, 0.12, 0.9, PRODUCT_COLORS[Math.floor(x) % 8]) : t.cyl(x, 0.85, z, 0.4, 0.05, '#e9c46a', 14);
    for (let x = I.x1 + 4; x < I.x2 - 3; x += 7) {
      t.box(x, 0, z - 4, 3, 3, 2.4, '#6c757d'); t.box(x, 2, z - 2.78, 2, 0.6, 0.05, '#29e6ff', 'glow'); t.solid(x, z - 4, 3, 2.4, 3);
      t.cyl(x, 3, z - 4, 0.3, 2, '#adb5bd', 8);
    }
    t.staff(I.x1 + 2, z + 2.5, 0, 'ouvrier');
    t.spot(I.x1 + 2, z + 3.6, { label: sock ? '🧦 Observer la production de chaussettes' : '🥞 Goûter la pâte à crêpes', action: 'talk', r: 2.2 });
  },

  office(t) {
    const I = t.inner;
    lightsAround(t);
    // accueil
    const rx = 0, rz = I.z2 - 3;
    counter(t, rx, rz, 3, 0, '#3d5a80', '#f4f1ea');
    t.staff(rx, rz - 0.9, 0, 'accueil');
    t.spot(rx, rz + 1.2, { label: '🛎️ Parler à l\'accueil', action: 'talk', r: 2.2, priority: 2 });
    // open space
    for (let x = I.x1 + 2; x < I.x2 - 2; x += 3) for (let z = I.z1 + 2; z < rz - 2.5; z += 3) {
      t.furn('bureau', x, z, 0); t.solid(x, z, 1.8, 0.9, 1);
      t.box(x, 0.98, z - 0.15, 0.7, 0.45, 0.05, '#14141c'); t.box(x, 1.0, z - 0.12, 0.62, 0.38, 0.02, '#3d8ee8', 'glow');
      t.furn('chaise', x, z + 0.75, Math.PI); t.seat(x, z + 0.75, Math.PI, 0.5);
    }
    t.box(I.x1 + 0.6, 0, I.z2 - 1.5, 0.6, 1.4, 0.6, '#f4f1ea'); t.box(I.x1 + 0.6, 1.4, I.z2 - 1.5, 0.35, 0.5, 0.35, '#90e0ef'); // fontaine à eau
    t.spot(I.x1 + 1.3, I.z2 - 1.5, { label: '💧 Boire à la fontaine', action: 'drink', r: 1.6 });
    plant(t, I.x2 - 0.6, I.z2 - 0.6);
  },

  agency(t) {
    const I = t.inner;
    lightsAround(t);
    const dx = 0, dz = (I.z1 + I.z2) / 2 - 0.5;
    t.furn('bureau', dx, dz, 0); t.solid(dx, dz, 1.8, 1, 1);
    t.staff(dx, dz - 0.9, 0, t.b.shop === 'scrapyard' ? 'ferrailleur' : 'agent');
    t.furn('chaise', dx - 0.5, dz + 0.9, Math.PI); t.furn('chaise', dx + 0.5, dz + 0.9, Math.PI);
    const labels = { immo: '🏡 Voir les annonces immobilières', rental: '🔑 Louer un véhicule', 'cars-used': '🚙 Voir les voitures d\'occasion', scrapyard: '🔩 Vendre une épave / pièces détachées' };
    t.spot(dx, dz + 1.5, { label: labels[t.b.shop] || '💬 Parler à l\'agent', action: t.b.shop ? 'shop' : 'talk', r: 2.2, priority: 2 });
    for (let x = I.x1 + 1; x < I.x2 - 1; x += 1.8) poster(t, x, I.z1 + 0.1, 0, PRODUCT_COLORS[Math.floor(x + 20) % 8], 1.3, 0.9);
    plant(t, I.x1 + 0.6, I.z2 - 0.6); plant(t, I.x2 - 0.6, I.z2 - 0.6);
  },

  police(t) {
    const I = t.inner;
    lightsAround(t);
    const rz = I.z2 - 3.5;
    counter(t, 0, rz, 4, 0, '#1d3557', '#e9edf2');
    t.staff(0, rz - 0.9, 0, 'policier');
    t.spot(0, rz + 1.2, { label: '👮 Accueil du commissariat', action: 'police', r: 2.4, priority: 2 });
    for (let i = 0; i < 4; i++) { t.furn('chaise', I.x1 + 1 + i * 0.8, I.z2 - 1, Math.PI); t.seat(I.x1 + 1 + i * 0.8, I.z2 - 1, Math.PI, 0.5); }
    // bureaux
    for (let x = I.x1 + 2.5; x < I.x2 - 2; x += 3.5) { t.furn('bureau', x, rz - 4, 0); t.solid(x, rz - 4, 1.8, 1, 1); t.box(x, 0.98, rz - 4.15, 0.7, 0.45, 0.05, '#14141c'); }
    // cellules au fond (barreaux)
    const cw = 3.2;
    for (let i = 0; i < Math.min(3, Math.floor((I.x2 - I.x1) / (cw + 0.5))); i++) {
      const cx = I.x1 + 1.8 + i * (cw + 0.4);
      for (let k = 0; k < 9; k++) t.box(cx - cw / 2 + k * (cw / 8), 0, I.z1 + 3, 0.06, 2.6, 0.06, '#3a3a3a');
      t.box(cx, 2.6, I.z1 + 3, cw, 0.1, 0.1, '#3a3a3a');
      t.box(cx + cw / 2, 0, I.z1 + 1.5, 0.12, 2.6, 3, '#9a8c98');
      t.solid(cx, I.z1 + 3, cw, 0.15, 2.6);
      t.box(cx, 0, I.z1 + 0.8, 1.8, 0.45, 0.7, '#6c757d');
    }
  },

  hospital(t) {
    const I = t.inner;
    lightsAround(t);
    const rz = I.z2 - 4;
    counter(t, 0, rz, 5, 0, '#4ea8de', '#ffffff');
    t.staff(-1, rz - 0.9, 0, 'infirmier'); t.staff(1.2, rz - 0.9, 0, 'medecin');
    t.spot(0, rz + 1.2, { label: '🩺 Consultation (bilan de santé)', action: 'hospital', r: 2.6, priority: 2 });
    for (let i = 0; i < 6; i++) { t.furn('chaise', I.x1 + 1 + i * 0.8, I.z2 - 1, Math.PI); t.seat(I.x1 + 1 + i * 0.8, I.z2 - 1, Math.PI, 0.5); }
    for (let x = I.x1 + 2; x < I.x2 - 2; x += 3.4) {
      t.furn('lit', x, I.z1 + 1.6, 0); t.solid(x, I.z1 + 1.6, 1.8, 2.3, 1);
      t.box(x + 1.4, 0, I.z1 + 1.6, 0.05, 2.2, 2.6, '#a2d2ff');
      t.box(x - 1.1, 0, I.z1 + 0.6, 0.5, 1.3, 0.4, '#d0d4da'); t.box(x - 1.1, 1.3, I.z1 + 0.6, 0.4, 0.3, 0.05, '#7ac74f', 'glow');
      t.bed(x, I.z1 + 1.6, 0);
    }
  },

  firestation(t) {
    const I = t.inner;
    lightsAround(t);
    t.showcar('pompiers', I.x1 + 4.5, (I.z1 + I.z2) / 2 + 0.5, 0, 0, true);
    for (let x = I.x2 - 6; x < I.x2 - 0.8; x += 0.9) { t.box(x, 0, I.z1 + 0.5, 0.8, 2, 0.6, '#d62828'); t.box(x, 1.2, I.z1 + 0.82, 0.6, 0.6, 0.04, '#ffd23f'); }
    t.solid(I.x2 - 3.4, I.z1 + 0.5, 5.4, 0.7, 2);
    t.cyl(I.x2 - 2, 0, (I.z1 + I.z2) / 2, 0.07, t.gH, '#d0d4da', 8); // mât de descente
    t.staff(I.x2 - 3, I.z2 - 3, Math.PI, 'pompier');
    t.spot(I.x2 - 2, (I.z1 + I.z2) / 2 + 0.7, { label: '🧯 Glisser le long du mât', action: 'pole', r: 1.5 });
  },

  house(t) {
    const I = t.inner;
    lightsAround(t);
    // cloison : salon devant, chambre + cuisine au fond
    const pz = (I.z1 + I.z2) / 2 - 0.5;
    // cloisons à mi-hauteur : on voit toutes les pièces depuis la vue plongeante
    t.wall(I.x1, pz, -0.8, pz, 1.25, t.st.wall); t.wall(0.8, pz, I.x2, pz, 1.25, t.st.wall);
    // salon
    t.furn('canape', I.x1 + 2, I.z2 - 1.4, Math.PI / 2); t.solid(I.x1 + 2, I.z2 - 1.4, 1, 2.4, 1); t.seat(I.x1 + 2, I.z2 - 1.4, Math.PI / 2, 0.45);
    t.furn('tapis', 0, I.z2 - 2, 0);
    t.furn('tele', I.x2 - 1, I.z2 - 1.8, -Math.PI / 2); t.solid(I.x2 - 1, I.z2 - 1.8, 0.6, 1.6, 1.4);
    t.spot(I.x2 - 1.8, I.z2 - 1.8, { label: '📺 Regarder la télé', action: 'tv', r: 1.6 });
    plant(t, I.x1 + 0.6, pz + 0.7);
    // chambre (gauche) et cuisine (droite)
    t.furn('lit', I.x1 + 1.5, I.z1 + 1.4, 0); t.solid(I.x1 + 1.5, I.z1 + 1.4, 1.8, 2.3, 1); t.bed(I.x1 + 1.5, I.z1 + 1.4, 0);
    t.furn('frigo', I.x2 - 0.7, I.z1 + 0.6, 0); t.solid(I.x2 - 0.7, I.z1 + 0.6, 0.8, 0.7, 1.9);
    t.spot(I.x2 - 0.7, I.z1 + 1.5, { label: '🧊 Ouvrir le frigo', action: 'fridge', r: 1.4 });
    t.box(I.x2 - 2.1, 0, I.z1 + 0.5, 1.6, 0.92, 0.65, '#e9e4da'); t.box(I.x2 - 2.1, 0.92, I.z1 + 0.5, 1.6, 0.04, 0.65, '#6c757d');
    t.solid(I.x2 - 2.1, I.z1 + 0.5, 1.6, 0.65, 1);
    t.staff(0.2, I.z2 - 2.8, Math.PI, 'habitant');
    t.spot(0.2, I.z2 - 1.8, { label: '💬 Parler à l\'habitant', action: 'talk', r: 1.8 });
  },

  // Maison d'un joueur : ses propres meubles (posés depuis le mode Décoration), utilisables.
  home(t) {
    lightsAround(t);
    const FUN = { tele: ['📺 Regarder la télé', 'tv'], 'tele-geante': ['📺 Regarder la télé géante', 'tv'], frigo: ['🧊 Ouvrir le frigo', 'fridge'] };
    for (const f of t.home.furniture) {
      const ry = (f.r || 0) * Math.PI / 2;
      t.furn(f.i, f.x, f.z, ry);
      const [fw, fd] = t.footprint(f.i, f.r || 0);
      if (fw > 0 && !['tapis', 'tapis-rond', 'lampe', 'douche'].includes(f.i)) t.solid(f.x, f.z, fw, fd, f.i === 'lit' || f.i === 'canape' ? 0.6 : 1.1);
      if (f.i === 'lit') { const [x, z] = t.F.L(f.x, f.z); t.spot(f.x, f.z, { label: '🛏️ Dormir', action: 'sleep', r: 1.6, seat: { x, z, yaw: t.F.th + ry, y: 0.6, lie: true } }); }
      else if (f.i === 'cuisiniere') t.spot(f.x + Math.sin(ry) * 1, f.z + Math.cos(ry) * 1, { label: '🍳 Cuisiner', action: 'cook', r: 1.5 });
      else if (f.i === 'douche') t.spot(f.x, f.z, { label: '🚿 Prendre une douche', action: 'shower', r: 1.4 });
      else if (f.i === 'canape' || f.i === 'chaise' || f.i === 'trone') t.seat(f.x, f.z, ry + Math.PI, f.i === 'chaise' ? 0.5 : 0.45);
      else if (FUN[f.i]) t.spot(f.x + Math.sin(ry) * 1.2, f.z + Math.cos(ry) * 1.2, { label: FUN[f.i][0], action: FUN[f.i][1], r: 1.5 });
      else if (t.funLabel(f.i)) t.spot(f.x, f.z, { label: t.funLabel(f.i), action: 'homefun', item: f.i, r: 1.6 });
    }
  },

  lobby(t) {
    const I = t.inner;
    lightsAround(t);
    for (let i = 0; i < 12; i++) t.box(I.x1 + 0.8 + (i % 6) * 0.45, 1 + Math.floor(i / 6) * 0.45, I.z1 + 0.15, 0.4, 0.4, 0.15, '#c9a46a');
    t.spot(I.x1 + 2, I.z1 + 1, { label: '📬 Relever le courrier', action: 'mail', r: 1.6 });
    t.box(I.x2 - 2, 0, I.z1 + 0.15, 1.6, 2.4, 0.1, '#adb5bd'); t.box(I.x2 - 2, 0, I.z1 + 0.2, 0.04, 2.4, 0.1, '#495057');
    t.spot(I.x2 - 2, I.z1 + 1, { label: '🛗 Prendre l\'ascenseur', action: 'elevator', r: 1.6 });
    plant(t, I.x1 + 0.6, I.z2 - 0.6); plant(t, I.x2 - 0.6, I.z2 - 0.6);
    t.furn('canape', 0, (I.z1 + I.z2) / 2, Math.PI / 2); t.solid(0, (I.z1 + I.z2) / 2, 1, 2.4, 1); t.seat(0, (I.z1 + I.z2) / 2, Math.PI / 2, 0.45);
    t.staff(I.x1 + 1.5, (I.z1 + I.z2) / 2, Math.PI / 2, 'concierge');
  },

  bank(t) {
    const I = t.inner;
    lightsAround(t);
    const cz = I.z1 + 3;
    counter(t, 0, cz, I.x2 - I.x1 - 3, 0, '#9c7a1c', '#f8f3e3');
    t.box(0, 1.06, cz, I.x2 - I.x1 - 3, 1.2, 0.05, '#cfe8ff', 'windows');
    t.staff(-1.5, cz - 0.9, 0, 'banquier'); t.staff(1.8, cz - 0.9, 0, 'banquier');
    t.spot(0, cz + 1.3, { label: '🏦 Consulter mon compte', action: 'bank', r: 2.6, priority: 2 });
    t.cyl(0, 0.3, I.z1 + 0.25, 1.1, 0.25, '#adb5bd', 24, Math.PI / 2); // porte du coffre
    t.spot(0, I.z1 + 1.4, { label: '🔒 Coffre-fort', action: 'vault', r: 1.4 });
    t.box(I.x2 - 1, 0, I.z2 - 1.5, 0.8, 1.7, 0.6, '#2b2d42'); t.box(I.x2 - 1, 1, I.z2 - 1.18, 0.5, 0.35, 0.04, '#29e6ff', 'glow');
    t.spot(I.x2 - 1, I.z2 - 0.6, { label: '🏧 Distributeur', action: 'bank', r: 1.4 });
  },

  mairie(t) {
    const I = t.inner;
    lightsAround(t);
    const cz = I.z1 + 3;
    counter(t, 0, cz, 8, 0, '#34407a', '#f8f0dd');
    t.staff(-2, cz - 0.9, 0, 'secretaire'); t.staff(2, cz - 0.9, 0, 'maire');
    t.spot(-2.6, cz + 1.2, { label: '📜 Bureau des réclamations absurdes', action: 'mairie', r: 1.8, priority: 2 });
    t.spot(2.6, cz + 1.2, { label: '🏢 Registre du commerce (créer une entreprise)', action: 'company', r: 1.8, priority: 2 });
    t.furn('statue-poulet', 0, (I.z1 + I.z2) / 2 + 1.5, 0); t.solid(0, (I.z1 + I.z2) / 2 + 1.5, 0.8, 0.8, 2);
    for (let i = 0; i < 6; i++) { t.furn('chaise', I.x1 + 1 + i * 0.8, I.z2 - 1, Math.PI); t.seat(I.x1 + 1 + i * 0.8, I.z2 - 1, Math.PI, 0.5); }
    for (const x of [I.x1 + 0.8, I.x2 - 0.8]) { t.cyl(x, 0, I.z1 + 0.8, 0.05, 2.6, '#d0d4da', 6); t.box(x + 0.35, 1.9, I.z1 + 0.8, 0.7, 0.5, 0.03, '#ff5a5f'); }
  },

  arcade(t) {
    const I = t.inner;
    lightsAround(t);
    for (let x = I.x1 + 1; x < I.x2 - 1; x += 1.3) { t.furn('borne-arcade', x, I.z1 + 0.6, 0); t.spot(x, I.z1 + 1.5, { label: '🕹️ Jouer à la borne (1 PC)', action: 'arcade', r: 0.9 }); }
    t.solid(0, I.z1 + 0.6, I.x2 - I.x1 - 2, 0.8, 1.8);
    for (let x = I.x1 + 1; x < I.x2 - 3; x += 1.3) t.furn('borne-arcade', x, (I.z1 + I.z2) / 2, Math.PI);
    t.solid((I.x1 + I.x2 - 2) / 2, (I.z1 + I.z2) / 2, I.x2 - I.x1 - 4, 0.8, 1.8);
    // pince à peluches
    t.box(I.x2 - 1.2, 0, I.z2 - 2, 1.2, 0.9, 1.2, '#ff3fa4'); t.box(I.x2 - 1.2, 0.9, I.z2 - 2, 1.15, 1.2, 1.15, '#cfe8ff', 'windows');
    t.solid(I.x2 - 1.2, I.z2 - 2, 1.2, 1.2, 2.1);
    t.spot(I.x2 - 2.2, I.z2 - 2, { label: '🧸 Pince à peluches (2 PC)', action: 'claw', r: 1.4 });
    t.staff(I.x1 + 1.5, I.z2 - 1.5, Math.PI / 2, 'gerant');
  },

  cinema(t) {
    const I = t.inner;
    t.box(0, 1.2, I.z1 + 0.15, I.x2 - I.x1 - 2, 3.4, 0.06, '#f4f1ea', 'glow'); // écran
    for (let r = 0; r < 4; r++) for (let x = I.x1 + 2; x < I.x2 - 1.5; x += 0.9) {
      const z = I.z1 + 5 + r * 1.6;
      if (z > I.z2 - 4) break;
      t.box(x, r * 0.2, z, 0.75, 0.45, 0.7, '#c1121f'); t.box(x, r * 0.2 + 0.45, z + 0.3, 0.75, 0.6, 0.12, '#9b0f1a');
      t.seat(x, z, Math.PI, 0.5 + r * 0.2);
    }
    t.solid(0, I.z1 + 5 + 2.4, I.x2 - I.x1 - 3, 6, 0.5);
    counter(t, I.x2 - 2.5, I.z2 - 2.2, 3, 0, '#5b2a86', '#ffd23f');
    t.staff(I.x2 - 2.5, I.z2 - 3.1, 0, 'vendeur');
    t.spot(I.x2 - 2.5, I.z2 - 1, { label: '🍿 Acheter du pop-corn', action: 'shop', r: 2, priority: 2 });
    t.spot(0, I.z1 + 4, { label: '🎬 Regarder la séance', action: 'movie', r: 3 });
  },

  bowling(t) {
    const I = t.inner;
    lightsAround(t);
    const lanes = Math.min(4, Math.floor((I.x2 - I.x1) / 3));
    for (let i = 0; i < lanes; i++) {
      const x = I.x1 + 1.8 + i * 3;
      t.box(x, 0.02, (I.z1 + I.z2) / 2 - 1, 1.8, 0.06, I.z2 - I.z1 - 6, '#e9c46a');
      for (let k = 0; k < 10; k++) { const row = k < 1 ? 0 : k < 3 ? 1 : k < 6 ? 2 : 3; const idx = k - [0, 1, 3, 6][row]; t.cyl(x - row * 0.15 + idx * 0.3, 0.06, I.z1 + 1.5 - row * 0.28, 0.06, 0.38, '#ffffff', 8); }
      t.spot(x, I.z2 - 3, { label: '🎳 Lancer une boule', action: 'bowling', r: 1.3 });
    }
    counter(t, I.x2 - 2, I.z2 - 1.8, 2.5, 0, '#3a86ff', '#ff006e');
    t.staff(I.x2 - 2, I.z2 - 2.6, 0, 'gerant');
  },

  gym(t) {
    const I = t.inner;
    lightsAround(t);
    for (let x = I.x1 + 2; x < I.x2 - 2; x += 3) {
      t.box(x, 0, I.z1 + 1.5, 0.6, 0.5, 1.6, '#2b2d42'); t.box(x, 1.1, I.z1 + 1.1, 1.8, 0.06, 0.06, '#adb5bd');
      for (const s of [-0.85, 0.85]) t.cyl(x + s, 0.95, I.z1 + 1.1, 0.25, 0.1, '#14141c', 12);
      t.solid(x, I.z1 + 1.5, 1.8, 1.8, 1.2);
      t.spot(x, I.z1 + 2.8, { label: '🏋️ Soulever des haltères', action: 'gym', r: 1.4 });
    }
    t.box(0, 0.01, (I.z1 + I.z2) / 2 + 1, I.x2 - I.x1 - 4, 0.04, 3, '#ff70a6');
    t.staff(I.x2 - 2, I.z2 - 2.5, Math.PI, 'coach');
    t.box(I.x1 + 0.12, 0.4, (I.z1 + I.z2) / 2, 0.04, 2, I.z2 - I.z1 - 4, '#cfe8ff', 'windows'); // miroir
    // vestiaires : douches
    for (const dx of [0.7, 2.1]) t.furn('douche', I.x1 + dx, I.z2 - 0.8, Math.PI);
    t.spot(I.x1 + 1.4, I.z2 - 1.2, { label: '🚿 Douche des vestiaires (2 PC)', action: 'publicshower', r: 1.4 });
  },

  school(t) {
    const I = t.inner;
    lightsAround(t);
    t.box(0, 1, I.z1 + 0.12, 6, 1.6, 0.06, '#2d6a4f');
    for (let x = I.x1 + 2.5; x < I.x2 - 2; x += 2.4) for (let z = I.z1 + 3.5; z < I.z2 - 2; z += 2) {
      t.box(x, 0.72, z, 1.2, 0.05, 0.6, '#d4a373'); t.box(x, 0, z, 0.08, 0.72, 0.5, '#7f5539'); t.solid(x, z, 1.2, 0.6, 0.8);
      t.furn('chaise', x, z + 0.6, Math.PI); t.seat(x, z + 0.6, Math.PI, 0.5);
    }
    t.staff(0, I.z1 + 1.4, 0, 'professeur');
    t.spot(0, I.z1 + 2.6, { label: '📚 Assister au cours (question du jour)', action: 'quiz', r: 2.2, priority: 2 });
    // secrétariat : inscriptions aux formations et examens
    t.box(I.x2 - 1.6, 0, I.z2 - 2.4, 2.2, 1.05, 0.7, '#ffd166'); t.solid(I.x2 - 1.6, I.z2 - 2.4, 2.2, 0.7, 1.1);
    t.staff(I.x2 - 1.6, I.z2 - 3.1, 0, 'accueil');
    t.spot(I.x2 - 1.6, I.z2 - 1.5, { label: '🎓 Formations, diplômes et examens', action: 'training', r: 2, priority: 3 });
  },

  prison(t) {
    const I = t.inner;
    lightsAround(t);
    const cw = 3;
    for (let x = I.x1 + 1.8; x < I.x2 - 1.5; x += cw + 0.4) {
      for (let k = 0; k < 9; k++) t.box(x - cw / 2 + k * (cw / 8), 0, I.z1 + 3.2, 0.06, 2.6, 0.06, '#3a3a3a');
      t.box(x + cw / 2, 0, I.z1 + 1.6, 0.12, 2.6, 3.2, '#9a8c98');
      t.box(x, 0, I.z1 + 0.7, 1.8, 0.45, 0.7, '#6c757d');
      t.solid(x, I.z1 + 3.2, cw, 0.15, 2.6);
    }
    for (let x = I.x1 + 3; x < I.x2 - 3; x += 4) tableSet(t, x, I.z2 - 4, 4, false, '#adb5bd');
    t.staff(I.x2 - 2, I.z2 - 2, Math.PI, 'gardien');
    t.spot(I.x2 - 2, I.z2 - 1, { label: '💂 Parler au gardien', action: 'prison', r: 1.8, priority: 2 });
  },

  barn(t) {
    const I = t.inner;
    for (let i = 0; i < 6; i++) t.add('hay', I.x1 + 1.5 + (i % 3) * 1.6, I.z1 + 1.2 + Math.floor(i / 3) * 1.4);
    t.solid(I.x1 + 3, I.z1 + 2, 5, 3, 1.4);
    for (let x = 0; x < I.x2 - 1; x += 3) { t.box(x, 0, (I.z1 + I.z2) / 2, 0.15, 1.2, 3, '#7a5230'); t.solid(x, (I.z1 + I.z2) / 2, 0.2, 3, 1.2); }
    t.pets(['vache', 'cochon', 'poulet'], 1.5, (I.z1 + I.z2) / 2);
    t.staff(I.x1 + 1.5, I.z2 - 2, Math.PI, 'fermier');
    t.spot(I.x1 + 1.5, I.z2 - 1, { label: '🧑‍🌾 Parler au fermier', action: 'talk', r: 1.8 });
  },

  cabin(t) {
    const I = t.inner;
    t.box(0, 0, (I.z1 + I.z2) / 2, 1.2, 0.75, 0.8, '#5a3d2b'); t.solid(0, (I.z1 + I.z2) / 2, 1.2, 0.8, 0.8);
    t.furn('chaise', 0, (I.z1 + I.z2) / 2 + 0.8, Math.PI);
    t.box(I.x2 - 1, 0, I.z1 + 0.6, 1.2, 0.6, 0.7, '#7f5539'); t.box(I.x2 - 1, 0.6, I.z1 + 0.6, 1.25, 0.1, 0.75, '#ffd23f');
    t.spot(I.x2 - 1, I.z1 + 1.4, { label: '🗝️ Ouvrir le coffre mystérieux', action: 'chest', r: 1.4 });
    t.box(0, 0.75, (I.z1 + I.z2) / 2, 0.2, 0.3, 0.2, '#fff3c4', 'glow');
  },
};

// Répliques du personnel (au hasard quand on s'approche ou qu'on leur parle).
export const STAFF_LINES = {
  vendeur: ['Bonjour ! Tout est en promo, sauf ce que vous voulez.', 'Je peux vous aider ? Non ? Je vais quand même essayer.', 'C\'est la dernière taille. Il y en a douze.'],
  geek: ['Ce câble ? Il est compatible avec rien. C\'est pour ça qu\'il est en solde.', 'Avez-vous essayé de l\'éteindre et de le rallumer ?'],
  soigneur: ['Ne tapotez pas la vitre, le lapin fait sa méditation.', 'Les croquettes premium ? Mon chat ne mange que ça. Moi aussi, parfois.'],
  boulanger: ['Chaud, chaud, le pain ! Attention les doigts !', 'La baguette du jour est encore plus croustillante que celle d\'hier.'],
  serveur: ['Une table pour une personne et son ego ?', 'Le plat du jour est... délicieux. Je crois.', 'Je vous apporte la carte ? Elle est en carton.'],
  cuisinier: ['QUI A MIS DE L\'ANANAS DANS LA SAUCE ?!', 'Oui chef ! Euh... c\'est moi le chef.'],
  equipier: ['Bienvenue au restaurant ! Vous prendrez une portion de bonne humeur ?', 'Frites ou frites ? On n\'a plus que des frites.'],
  caissier: ['Vous avez la carte de fidélité ? Elle donne droit à 0 % de réduction.', 'Bip. Bip. Bip. J\'adore mon métier.'],
  commercial: ['Celle-ci ? Elle fait 0 à 100 en un temps record... de paperasse.', 'Un essai ? Bien sûr, mais vous ramenez la voiture avant le dîner.'],
  mecano: ['Votre moteur fait "pof" ? C\'est normal, il est fatigué.', 'J\'ai réparé une trottinette ce matin. Avec du scotch.'],
  manutentionnaire: ['Ce carton pèse 3 tonnes. Ou 3 kilos. Je ne lis pas les étiquettes.'],
  ouvrier: ['On produit 10 000 chaussettes par jour. Toutes dépareillées.', 'La pâte à crêpes, c\'est 80 % de bonne humeur.'],
  accueil: ['Bienvenue chez PlayCorp ! Vous avez rendez-vous ? Non ? Moi non plus.', 'L\'ascenseur est en réunion.'],
  agent: ['J\'ai une affaire en or pour vous ! (en plaqué or)', 'Signez ici, ici, ici, et là où il n\'y a rien.'],
  ferrailleur: ['Une épave ? J\'adore les épaves ! Même les humains.', 'Tout se recycle, sauf les mauvaises blagues.'],
  policier: ['Circulez, il n\'y a rien à voir ! Sauf moi.', 'On cherche un voleur de croissants. Vous avez des miettes sur le menton...'],
  infirmier: ['Toussez. Plus fort. Merci, c\'était très mélodieux.'],
  medecin: ['Votre diagnostic : vous êtes un humain. C\'est incurable.', 'Prenez deux siestes et rappelez-moi demain.'],
  pompier: ['Le mât de descente, c\'est 90 % de notre entraînement.', 'Un chat dans un arbre ? Encore ?!'],
  habitant: ['Oh ! Vous êtes le nouveau voisin ? Vous voulez du gâteau ? Il est d\'hier... d\'avant-hier.', 'Ne marchez pas sur le tapis, le chat vient de le "décorer".', 'Vous venez pour le compteur d\'eau ? Il est dans la baignoire.'],
  concierge: ['Le courrier ? Il arrive quand le pigeon voyageur a le temps.', 'L\'ascenseur ? Il est en grève depuis 1997.'],
  banquier: ['Votre argent est en sécurité. Surtout de vous.', 'Un prêt ? Remplissez ces 46 formulaires.'],
  secretaire: ['Pour une réclamation, prenez un ticket. Il n\'y a plus de tickets.'],
  maire: ['Je déclare cette journée... ouverte !', 'Ma statue de poulet vous plaît ? Je l\'ai gagnée au loto.'],
  gerant: ['Le record de cette borne ? C\'est moi. Évidemment.', 'Une partie ? C\'est 1 PlayCoin, la gloire est gratuite.'],
  coach: ['ALLEZ ! Encore 47 ! Je compte en kilos de croissants.', 'Pas de muscle sans croquette protéinée.'],
  professeur: ['Silence au fond ! Oui, toi, la plante verte.', 'Question du jour : combien de pattes a un poulet en pyjama ?'],
  gardien: ['Pas de lime à ongles dans les gâteaux, merci.', 'Ici, l\'heure de promenade dure 15 minutes. Les escargots trouvent ça court.'],
  fermier: ['Ma vache donne du lait. Mon cochon donne des opinions.', 'Ne réveillez pas les poules, elles sont de mauvais poil.'],
};
