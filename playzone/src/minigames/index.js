import { PieToss } from './pie-toss.js';
import { ChickenRace } from './chicken-race.js';
import { ObstacleCourse } from './obstacle-course.js';
import { buildContent } from '../../shared/content/registry.js';
import { MINIGAME_SPOTS } from '../../shared/world-layout.js';

// Registre des mini-jeux. Ajouter un mini-jeu :
//   1. sa définition (règles, durée, récompenses) dans un pack de shared/content/packs/
//   2. sa validation côté autorité (shared/authority.js, actions mg.event) si nécessaire
//   3. sa classe (qui étend Minigame) ici, dans REGISTRY
export const REGISTRY = { tartes: PieToss, poulets: ChickenRace, parcours: ObstacleCourse };

export class Minigames {
  constructor(game) {
    this.game = game;
    this.current = null;
    this.list = [];
    const content = buildContent(Date.now());
    // décor statique de chaque stand (ajouté au monde fusionné)
    for (const Cls of Object.values(REGISTRY)) if (Cls.buildStatic) game.world.addContributor((sb, col, scene) => Cls.buildStatic(sb, col, scene));
    for (const def of Object.values(content.minigames)) {
      const Cls = REGISTRY[def.id];
      if (!Cls) continue;
      const mg = new Cls(game, def);
      this.list.push(mg);
      const spot = MINIGAME_SPOTS[def.spot];
      game.interactions.add({
        x: spot.x, z: spot.z, r: 3.2, label: `Jouer : ${def.name}`,
        enabled: () => !this.current, action: () => mg.openIntro(),
      });
    }
  }

  update(dt, t) {
    for (const mg of this.list) {
      mg.ambient?.(dt, t);
      if (mg === this.current) mg.update(dt);
    }
  }

  mapMarkers() { return this.current ? this.current.mapMarkers() : []; }
}
