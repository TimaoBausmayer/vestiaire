import * as THREE from 'three';
import { groundHeight, isPaved, BUILDINGS, WATER_LEVEL } from '../../shared/world-layout.js';
import { mulberry32 } from '../../shared/rng.js';

// HERBE 3D : des touffes de brins (une seule InstancedMesh) autour du joueur, qui ondulent au vent.
// Placées par cases de 16 m (calculées une fois, puis gardées en cache), jamais sur le goudron,
// dans les bâtiments, l'eau, le sable des plages et du désert, ni sur la roche des montagnes.
const CELL = 16;
// grille des bâtiments (avec leur cour) pour savoir vite si un point est construit
const BG = new Map();
for (const b of BUILDINGS) {
  const l = b.lot || b.yard, r = [Math.min(b.x - b.w / 2, l ? l.x1 : 1e9) - 1.5, Math.min(b.z - b.d / 2, l ? l.z1 : 1e9) - 1.5, Math.max(b.x + b.w / 2, l ? l.x2 : -1e9) + 1.5, Math.max(b.z + b.d / 2, l ? l.z2 : -1e9) + 1.5];
  for (let cx = Math.floor(r[0] / 32); cx <= Math.floor(r[2] / 32); cx++) for (let cz = Math.floor(r[1] / 32); cz <= Math.floor(r[3] / 32); cz++) { const k = `${cx},${cz}`; if (!BG.has(k)) BG.set(k, []); BG.get(k).push(r); }
}
const built = (x, z) => { const L = BG.get(`${Math.floor(x / 32)},${Math.floor(z / 32)}`); if (L) for (const r of L) if (x > r[0] && x < r[2] && z > r[1] && z < r[3]) return true; return false; };
const DENS = { medium: 55, high: 95 };
const RADIUS = { medium: 3, high: 4 };     // en cases autour du joueur

function tuftGeometry() {
  // 3 brins croisés, plus fins en haut ; couleur plus claire au sommet (attribut « tip »)
  const pos = [], tip = [];
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI, c = Math.cos(a) * 0.09, s = Math.sin(a) * 0.09, lean = (k - 1) * 0.04;
    pos.push(-c, 0, -s, c, 0, s, lean, 0.36, 0);
    tip.push(0, 0, 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('tip', new THREE.Float32BufferAttribute(tip, 1));
  g.computeVertexNormals();
  return g;
}

export class Grass {
  constructor(game) {
    this.game = game;
    this.cache = new Map();
    this.center = null;
    this.uniforms = { uTime: { value: 0 }, uWind: { value: 1 } };
    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, side: THREE.DoubleSide, vertexColors: false });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = this.uniforms.uTime; sh.uniforms.uWind = this.uniforms.uWind;
      sh.vertexShader = `attribute float tip;\nuniform float uTime; uniform float uWind;\nvarying float vTip;\n${sh.vertexShader}`
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vTip = tip;
          vec4 wp = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float sway = sin(uTime * 1.8 + wp.x * 0.35 + wp.z * 0.21) * 0.08 + sin(uTime * 3.1 + wp.x * 0.9) * 0.03;
          transformed.x += sway * tip * uWind; transformed.z += sway * 0.6 * tip * uWind;`);
      sh.fragmentShader = `varying float vTip;\n${sh.fragmentShader}`
        .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( diffuse * mix(0.55, 1.15, vTip), opacity );');
    };
    this.max = 81 * DENS.high;
    this.mesh = new THREE.InstancedMesh(tuftGeometry(), mat, this.max);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.max * 3), 3);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.receiveShadow = true;
    game.engine.scene.add(this.mesh);
  }

  // touffes d'une case (cache) : [x, y, z, rotation, échelle, r, g, b]...
  cell(cx, cz, dens) {
    const key = `${cx},${cz},${dens}`;
    let list = this.cache.get(key);
    if (list) return list;
    list = [];
    const r = mulberry32((cx * 73856093) ^ (cz * 19349663));
    const base = new THREE.Color();
    for (let i = 0; i < dens; i++) {
      const x = (cx + r()) * CELL, z = (cz + r()) * CELL;
      const y = groundHeight(x, z);
      if (y < WATER_LEVEL + 0.15 || y > 2.6) continue;               // eau, roche, cratère
      if (z > 60 && z < 140 && y < 0.6) continue;                    // plages
      if (x < -1880 || z < -3000) continue;                          // désert, montagne
      if (isPaved(x, z) || built(x, z)) continue;
      base.setHSL(0.27 + r() * 0.06, 0.45 + r() * 0.2, 0.32 + r() * 0.1);
      list.push([x, y, z, r() * Math.PI, 0.7 + r() * 0.7, base.r, base.g, base.b]);
    }
    if (this.cache.size > 600) this.cache.clear();
    this.cache.set(key, list);
    return list;
  }

  rebuild(px, pz) {
    const q = this.game.engine.quality, dens = DENS[q], R = RADIUS[q];
    const m = new THREE.Matrix4(), qt = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    let n = 0;
    const ccx = Math.floor(px / CELL), ccz = Math.floor(pz / CELL);
    for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
      if (dx * dx + dz * dz > (R + 0.5) * (R + 0.5)) continue;
      for (const [x, y, z, rot, s, cr, cg, cb] of this.cell(ccx + dx, ccz + dz, dens)) {
        if (n >= this.max) break;
        m.compose(v.set(x, y, z), qt.setFromEuler(e.set(0, rot, 0)), sc.set(s, s, s));
        this.mesh.setMatrixAt(n, m);
        this.mesh.instanceColor.setXYZ(n, cr, cg, cb);
        n++;
      }
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt, t) {
    const g = this.game, q = g.engine.quality;
    const on = q !== 'low' && g.player.zone === 'world' && !g.interiors?.inside;
    this.mesh.visible = on;
    if (!on) return;
    this.uniforms.uTime.value = t;
    const P = g.player.pos, key = `${Math.floor(P.x / CELL)},${Math.floor(P.z / CELL)},${q}`;
    if (key !== this.center) { this.center = key; this.rebuild(P.x, P.z); }
  }
}
