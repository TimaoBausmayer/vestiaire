// ARÈNES DE TIR LUDIQUE : paintball (billes de peinture, en plein air, avec bunkers gonflables) et
// laser game (labyrinthe néon, pistolets laser et gilets). Modes en équipes contre des bots IA,
// et « Dernier debout » : tous contre tous dans une zone qui rétrécit, le dernier en jeu gagne.
// Règles pures partagées (client + autorité) : arènes, abris (déterministes), modes, primes.
import { mulberry32 } from './rng.js';

export const ARENAS = {
  paintball: { id: 'paintball', kind: 'paintball', name: 'Paintball des Hauts', cx: -400, cz: -830, w: 140, d: 140, desk: 'paintball-club' },
  laser: { id: 'laser', kind: 'laser', name: 'Laser Quest Néon', cx: 410, cz: -830, w: 64, d: 48, desk: 'laser-game' },
};

export const MODES = {
  paintball: {
    equipes: { name: '🔴🔵 Équipes 5 contre 5', team: 5, target: 20, secs: 300, respawn: 4, fee: 30, prize: { win: 250, draw: 80, loss: 30 }, desc: 'Première équipe à 20 éliminations. Une bille = éliminé·e, retour à la base 4 s.' },
    survie: { name: '👑 Dernier debout (zone qui rétrécit)', ffa: 12, secs: 260, zone: true, fee: 40, prize: { 1: 600, 2: 300, 3: 150 }, desc: 'Tous contre tous, 12 joueurs, une seule vie. La zone se resserre : reste dedans ! Le dernier en jeu gagne.' },
  },
  laser: {
    equipes: { name: '🟢🟣 Équipes 4 contre 4', team: 4, secs: 240, stun: 3, fee: 20, prize: { win: 180, draw: 60, loss: 20 }, desc: '4 minutes. Chaque tir touché = 1 point pour l\'équipe, le gilet touché s\'éteint 3 s.' },
    solo: { name: '⚡ Chacun pour soi (8 joueurs)', ffa: 8, secs: 240, stun: 3, fee: 20, prize: { 1: 300, 2: 150, 3: 70 }, desc: '4 minutes, le meilleur score gagne.' },
  },
};

// Abris : [x, z, w, d, h, type] en coordonnées locales (centre de l'arène = 0, 0)
export function arenaCovers(A) {
  const r = mulberry32(A.kind === 'paintball' ? 4242 : 777), out = [];
  if (A.kind === 'paintball') {
    // symétrique (miroir) pour l'équité des équipes : bases au nord (z < 0) et au sud (z > 0)
    const half = [];
    const types = ['dorito', 'cylindre', 'mur', 'cube', 'pneus', 'palette'];
    for (let i = 0; i < 26; i++) {
      const x = (r() - 0.5) * (A.w - 16), z = 6 + r() * (A.d / 2 - 22);
      const t = types[Math.floor(r() * types.length)];
      const big = t === 'mur' ? [6 + r() * 4, 1] : t === 'palette' ? [3, 2.4] : t === 'pneus' ? [2.4, 2.4] : [2 + r() * 1.6, 2 + r() * 1.6];
      const hh = t === 'mur' ? 2.1 : t === 'pneus' ? 1.1 : t === 'dorito' ? 1.6 : t === 'palette' ? 1.4 : 1.9;
      if (half.some((c) => Math.abs(c[0] - x) < (c[2] + big[0]) / 2 + 3 && Math.abs(c[1] - z) < (c[3] + big[1]) / 2 + 3)) continue;
      half.push([x, z, big[0], big[1], hh, t]);
    }
    for (const c of half) out.push(c, [-c[0], -c[1], c[2], c[3], c[4], c[5]]);
    out.push([0, 0, 8, 2.4, 2.2, 'mur'], [0, 0, 2.4, 8, 2.2, 'mur']);   // la croix du centre
  } else {
    // labyrinthe : murs sur une grille, avec des passages
    const cw = 8, nx = Math.floor(A.w / cw), nz = Math.floor(A.d / cw);
    for (let i = 1; i < nx; i++) for (let j = 0; j < nz; j++) if (r() < 0.42) out.push([-A.w / 2 + i * cw, -A.d / 2 + j * cw + cw / 2, 0.6, cw * (0.55 + r() * 0.3), 2.6, 'mur']);
    for (let i = 0; i < nx; i++) for (let j = 1; j < nz; j++) if (r() < 0.38) out.push([-A.w / 2 + i * cw + cw / 2, -A.d / 2 + j * cw, cw * (0.55 + r() * 0.3), 0.6, 2.6, 'mur']);
    for (let k = 0; k < 10; k++) out.push([(r() - 0.5) * (A.w - 10), (r() - 0.5) * (A.d - 10), 1.4, 1.4, 1.2, 'cube']);
  }
  return out;
}

// bases des équipes (local)
export const basesOf = (A) => [{ x: 0, z: -A.d / 2 + 5 }, { x: 0, z: A.d / 2 - 5 }];
// zone du « Dernier debout » : rayon selon le temps (s depuis le départ)
export function zoneRadius(A, t, secs) { const start = Math.min(A.w, A.d) * 0.62, u = Math.max(0, Math.min(1, (t - 25) / (secs - 70))); return start + (7 - start) * u; }

// fin de partie : limites pour l'autorité
export const MAX_KILL_RATE = 1 / 1.5;   // au plus une élimination toutes les 1,5 s
