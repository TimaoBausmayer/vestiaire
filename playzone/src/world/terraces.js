import { BUILDINGS, ROADS } from '../../shared/world-layout.js';
import { Avatar } from '../characters/avatar.js';
import { DEFAULT_APPEARANCE, SKINS, HAIR_STYLES, HAIR_COLORS, COLORS } from '../../shared/appearance.js';
import { mulberry32 } from '../../shared/rng.js';

// TERRASSES : tables, chaises et parasols devant les restaurants, cafés et fast-foods. Des clients
// (PNJ) s'y attablent selon l'heure : du monde à midi et le soir, personne au milieu de la nuit.

export const TERRACE_SEATS = [];   // { x, z, yaw }
const FRONT = { S: [0, 1], N: [0, -1], E: [1, 0], W: [-1, 0] };
const PARASOLS = ['#e63946', '#2a9d8f', '#ffd23f', '#3a86ff', '#f4f1ea', '#ff70a6'];
const onRoad = (x, z) => ROADS.some((r) => x > r[0] - 1 && x < r[2] + 1 && z > r[1] - 1 && z < r[3] + 1);
const inBuilding = (x, z) => BUILDINGS.some((b) => Math.abs(x - b.x) < b.w / 2 + 0.8 && Math.abs(z - b.z) < b.d / 2 + 0.8);

export function buildTerraces(sb, col) {
  let k = 0;
  for (const b of BUILDINGS) {
    if (!['restaurant', 'cafe', 'fastfood'].includes(b.interior) || !b.door) continue;
    const [fx, fz] = FRONT[b.facing] || FRONT.S, lx = -fz, lz = fx;
    for (const lat of [-6, -3, 3, 6]) {
      if (Math.abs(lat) * 2 > b.w + 2) continue;
      const x = b.door.x + fx * 3.6 + lx * lat, z = b.door.z + fz * 3.6 + lz * lat;
      if (onRoad(x, z) || inBuilding(x, z)) continue;
      k++;
      sb.cyl(x, 0, z, 0.08, 0.72, '#2b2d33', 8);
      sb.cyl(x, 0.72, z, 0.48, 0.05, '#f4f1ea', 14);
      sb.cyl(x, 0.77, z, 0.06, 1.5, '#d0d4da', 6);
      sb.cone(x, 2.2, z, 1.6, 0.55, PARASOLS[k % PARASOLS.length], 12);
      col.addCyl(x, z, 0.5, 0, 0.8);
      for (const sd of [-1, 1]) {
        const cx = x + lx * sd * 0.85, cz = z + lz * sd * 0.85;
        sb.box(cx, 0, cz, 0.45, 0.45, 0.45, '#a0703c');
        sb.box(cx + lx * sd * 0.2, 0.45, cz + lz * sd * 0.2, lx ? 0.06 : 0.45, 0.45, lz ? 0.06 : 0.45, '#a0703c');
        TERRACE_SEATS.push({ x: cx, z: cz, yaw: Math.atan2(x - cx, z - cz) });
      }
    }
  }
}

// Clients des terrasses : un petit groupe d'avatars réutilisés, installés sur les terrasses proches du joueur.
export class TerraceDiners {
  constructor(g) {
    this.g = g;
    this.t = 0;
    const r = mulberry32(777);
    const pk = (a) => a[Math.floor(r() * a.length)];
    this.pool = Array.from({ length: 14 }, () => {
      const av = new Avatar({ ...DEFAULT_APPEARANCE, skin: pk(SKINS.slice(0, 8)), hair: pk(HAIR_STYLES), hairColor: pk(HAIR_COLORS), topColor: pk(COLORS), top: pk(['tshirt', 'chemise', 'sweat', 'raye']) }, {});
      av.root.visible = false; g.engine.scene.add(av.root);
      return { av, seat: null, eat: r() < 0.6 };
    });
  }

  // affluence selon l'heure du jeu
  share() {
    const h = this.g.world?.dayNight?.hour ?? 13;
    if (h < 6) return 0; if (h < 8) return 0.2; if (h < 11.5) return 0.45; if (h < 14.5) return 1;
    if (h < 18.5) return 0.55; if (h < 22.5) return 0.95; return 0.35;
  }

  update(dt) {
    const g = this.g, P = g.player.pos;
    this.t -= dt;
    // rafraîchi régulièrement, et tout de suite après un grand déplacement (téléportation, voiture)
    if (this.t <= 0 || !this.lastP || Math.hypot(P.x - this.lastP.x, P.z - this.lastP.z) > 30) {
      this.t = 1.5; this.lastP = { x: P.x, z: P.z };
      const near = g.player.zone === 'world' ? TERRACE_SEATS.filter((s) => Math.hypot(s.x - P.x, s.z - P.z) < 110).sort((a, c) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(c.x - P.x, c.z - P.z)) : [];
      // les terrasses les plus proches d'abord ; chaque chaise est occupée ou non selon l'heure (tirage stable)
      const busy = (s) => ((Math.abs(Math.floor(s.x * 13.7 + s.z * 7.3)) % 100) / 100) < this.share() * 0.75;
      const want = near.filter(busy).slice(0, this.pool.length);
      this.pool.forEach((d, i) => {
        const s = want[i] || null;
        if (s !== d.seat) {
          d.seat = s;
          d.av.root.visible = !!s;
          if (s) { d.av.root.position.set(s.x, 0.05, s.z); d.av.root.rotation.y = s.yaw; }
        }
      });
    }
    for (const d of this.pool) if (d.seat) d.av.update(dt, { speed: 0, grounded: true, pose: d.eat ? 'sit-eat' : 'sit' });
  }
}
