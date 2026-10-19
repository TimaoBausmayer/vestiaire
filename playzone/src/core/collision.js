import { groundHeight } from '../../shared/world-layout.js';

// Collisions simples et rapides : boîtes alignées (AABB) et cylindres verticaux, rangés dans une grille.
// Les personnages sont des cylindres (rayon, hauteur) : on les repousse hors des obstacles,
// et on peut marcher SUR les boîtes (plateformes, marches, toits).

const CELL = 8;

export class Collision {
  constructor() {
    this.grid = new Map();
    this.dynamic = new Set(); // colliders mobiles (plateformes, véhicules...) testés à chaque fois
    this._stamp = 0;
  }

  _cells(minX, minZ, maxX, maxZ, fn) {
    const x1 = Math.floor(minX / CELL), x2 = Math.floor(maxX / CELL);
    const z1 = Math.floor(minZ / CELL), z2 = Math.floor(maxZ / CELL);
    for (let i = x1; i <= x2; i++) for (let j = z1; j <= z2; j++) fn(`${i},${j}`);
  }

  _insert(c) {
    if (c.dynamic) { this.dynamic.add(c); return c; }
    const [minX, minZ, maxX, maxZ] = c.type === 'box' ? [c.minX, c.minZ, c.maxX, c.maxZ] : [c.x - c.r, c.z - c.r, c.x + c.r, c.z + c.r];
    this._cells(minX, minZ, maxX, maxZ, (k) => {
      let arr = this.grid.get(k);
      if (!arr) { arr = []; this.grid.set(k, arr); }
      arr.push(c);
    });
    return c;
  }

  addBox(minX, minY, minZ, maxX, maxY, maxZ, opts = {}) {
    return this._insert({ type: 'box', minX, minY, minZ, maxX, maxY, maxZ, enabled: true, _s: 0, ...opts });
  }

  // Boîte centrée en (x, z), base à y0.
  addBoxC(x, z, w, d, y0, h, opts) {
    return this.addBox(x - w / 2, y0, z - d / 2, x + w / 2, y0 + h, z + d / 2, opts);
  }

  addCyl(x, z, r, y0, h, opts = {}) {
    return this._insert({ type: 'cyl', x, z, r, minY: y0, maxY: y0 + h, enabled: true, _s: 0, ...opts });
  }

  remove(c) {
    if (c.dynamic) { this.dynamic.delete(c); return; }
    const [minX, minZ, maxX, maxZ] = c.type === 'box' ? [c.minX, c.minZ, c.maxX, c.maxZ] : [c.x - c.r, c.z - c.r, c.x + c.r, c.z + c.r];
    this._cells(minX, minZ, maxX, maxZ, (k) => {
      const arr = this.grid.get(k);
      const i = arr ? arr.indexOf(c) : -1;
      if (i >= 0) arr.splice(i, 1);
    });
  }

  // Appelle fn pour chaque collider proche (sans doublon).
  near(x, z, r, fn) {
    const s = ++this._stamp;
    this._cells(x - r, z - r, x + r, z + r, (k) => {
      const arr = this.grid.get(k);
      if (!arr) return;
      for (const c of arr) { if (c._s !== s && c.enabled) { c._s = s; fn(c); } }
    });
    for (const c of this.dynamic) if (c.enabled) fn(c);
  }

  // Hauteur du support sous (x, z) pour des pieds situés à y (on peut monter une marche de stepH).
  supportAt(x, z, y, r = 0.3, stepH = 0.5, ignore = null) {
    let best = groundHeight(x, z);
    this.near(x, z, r, (c) => {
      if (c.maxY > y + stepH || c.noStand || (ignore && c.owner === ignore)) return;
      if (c.type === 'box') {
        if (x > c.minX - r * 0.5 && x < c.maxX + r * 0.5 && z > c.minZ - r * 0.5 && z < c.maxZ + r * 0.5) best = Math.max(best, c.maxY);
      } else if (Math.hypot(x - c.x, z - c.z) < c.r + r * 0.5) best = Math.max(best, c.maxY);
    });
    return best;
  }

  // Repousse un cylindre (pos.x, pos.z, rayon r, pieds pos.y, hauteur h) hors des obstacles.
  // Renvoie le collider touché le plus récent (ou null). ignore : propriétaire dont on ignore les colliders.
  pushOut(pos, r, h, stepH = 0.5, ignore = null) {
    let hit = null;
    for (let iter = 0; iter < 2; iter++) {
      this.near(pos.x, pos.z, r + 1, (c) => {
        if (c.maxY <= pos.y + stepH || c.minY >= pos.y + h || (ignore && c.owner === ignore)) return;
        if (c.type === 'box') {
          const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
          const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
          let dx = pos.x - cx, dz = pos.z - cz;
          const d = Math.hypot(dx, dz);
          if (d >= r) return;
          hit = c;
          if (d > 1e-6) {
            pos.x = cx + (dx / d) * r;
            pos.z = cz + (dz / d) * r;
          } else {
            // centre à l'intérieur : sortie par le côté le plus proche
            const pens = [pos.x - c.minX, c.maxX - pos.x, pos.z - c.minZ, c.maxZ - pos.z];
            const m = Math.min(...pens);
            if (m === pens[0]) pos.x = c.minX - r; else if (m === pens[1]) pos.x = c.maxX + r;
            else if (m === pens[2]) pos.z = c.minZ - r; else pos.z = c.maxZ + r;
          }
        } else {
          const dx = pos.x - c.x, dz = pos.z - c.z;
          const d = Math.hypot(dx, dz);
          const min = r + c.r;
          if (d >= min) return;
          hit = c;
          if (d > 1e-6) { pos.x = c.x + (dx / d) * min; pos.z = c.z + (dz / d) * min; } else pos.x += min;
        }
      });
    }
    return hit;
  }

  // Le point est-il dans un obstacle ? (utilisé pour la caméra)
  pointBlocked(x, y, z, pad = 0.25) {
    let blocked = false;
    this.near(x, z, pad, (c) => {
      if (blocked || c.noCamera || (this.camIgnore && c.bid === this.camIgnore)) return;
      if (c.type === 'box') {
        if (x > c.minX - pad && x < c.maxX + pad && z > c.minZ - pad && z < c.maxZ + pad && y > c.minY - pad && y < c.maxY + pad) blocked = true;
      } else if (y > c.minY && y < c.maxY && Math.hypot(x - c.x, z - c.z) < c.r + pad) blocked = true;
    });
    return blocked;
  }

  // Fraction [0..1] du segment a->b libre d'obstacles.
  segmentFree(ax, ay, az, bx, by, bz, steps = 14) {
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (this.pointBlocked(ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t)) return Math.max(0, (i - 1) / steps);
    }
    return 1;
  }
}
