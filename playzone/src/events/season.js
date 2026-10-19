import * as THREE from 'three';
import { buildContent } from '../../shared/content/registry.js';
import { buildMergedGeometry } from '../core/static-builder.js';
import { actorMaterial } from '../core/materials.js';
import { groundHeight } from '../../shared/world-layout.js';
import { PUMPKIN_GEO } from './events.js';

// Décorations saisonnières : ajoutées automatiquement par les packs de contenu actifs
// (ex. Halloween du 15 octobre au 8 novembre). Rien à modifier dans le moteur pour une nouvelle saison.
const GHOST = buildMergedGeometry((sb) => {
  sb.cone(0, 0, 0, 0.7, 1.6, '#f4f1ea', 12);
  sb.sphere(0, 1.55, 0, 0.5, '#f4f1ea', 12);
  for (const x of [-0.17, 0.17]) sb.sphere(x, 1.65, 0.42, 0.09, '#1b1b24', 6);
});

export class Season {
  constructor(game) {
    this.game = game;
    this.ghosts = [];
    const content = buildContent(Date.now());
    this.active = content.packs.filter((p) => p.start);
    for (const deco of content.decorations) {
      for (const [x, z] of deco.at) {
        if (deco.type === 'pumpkin') {
          const m = new THREE.Mesh(PUMPKIN_GEO, actorMaterial);
          m.position.set(x, groundHeight(x, z), z);
          m.rotation.y = Math.random() * 6;
          m.scale.setScalar(0.9 + Math.random() * 0.5);
          m.castShadow = true;
          game.engine.scene.add(m);
        } else if (deco.type === 'ghost') {
          const m = new THREE.Mesh(GHOST, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, transparent: true, opacity: 0.8 }));
          m.position.set(x, 1.5, z);
          game.engine.scene.add(m);
          this.ghosts.push({ m, x, z, p: Math.random() * 6 });
        }
      }
    }
  }

  update(dt, t) {
    for (const g of this.ghosts) {
      g.m.position.set(g.x + Math.sin(t * 0.4 + g.p) * 3, 1.6 + Math.sin(t * 1.3 + g.p) * 0.4, g.z + Math.cos(t * 0.3 + g.p) * 3);
      g.m.rotation.y = t * 0.5 + g.p;
    }
  }
}
