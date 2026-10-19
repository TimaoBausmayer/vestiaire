import * as THREE from 'three';
import { SECRETS } from '../../shared/world-layout.js';
import { buildMergedGeometry, SHAPES as B } from '../core/static-builder.js';
import { actorMaterial } from '../core/materials.js';

// Canards dorés cachés dans toute la ville (objets secrets) : récompense à chaque trouvaille,
// gros bonus et titre quand on a les 10.
const DUCK = buildMergedGeometry((sb) => {
  sb.add(B.sphere(12), { y: 0.25, sx: 0.5, sy: 0.4, sz: 0.62, color: '#ffd23f' });
  sb.add(B.sphere(10), { y: 0.55, z: 0.18, sx: 0.32, sy: 0.32, sz: 0.32, color: '#ffd23f' });
  sb.add(B.box(), { y: 0.5, z: 0.38, sx: 0.18, sy: 0.06, sz: 0.16, color: '#ff9f1c' });
  for (const x of [-1, 1]) sb.add(B.sphere(5), { x: x * 0.08, y: 0.6, z: 0.31, sx: 0.06, sy: 0.07, sz: 0.04, color: '#1b1b24' });
  sb.add(B.box(), { y: 0.33, z: -0.32, sx: 0.2, sy: 0.12, sz: 0.12, rx: -0.5, color: '#f2b705' });
});
const RING = buildMergedGeometry((sb) => sb.add(B.ring(), { sx: 1.2, sy: 0.3, sz: 1.2, color: '#fff3b0' }));

export class Secrets {
  constructor(game) {
    this.game = game;
    this.items = SECRETS.map((s) => {
      const g = new THREE.Group();
      const duck = new THREE.Mesh(DUCK, actorMaterial);
      duck.castShadow = true;
      const ring = new THREE.Mesh(RING, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.6 }));
      g.add(duck, ring);
      g.position.set(s.x, s.y, s.z);
      game.engine.scene.add(g);
      const it = { s, g, duck, ring };
      it.inter = game.interactions.add({
        x: s.x, z: s.z, r: 2.4, priority: 2, label: 'Ramasser le canard doré !',
        enabled: () => !game.profile.secrets.includes(s.id) && Math.abs(game.player.pos.y - s.y) < 2.5,
        action: () => this.collect(it),
      });
      return it;
    });
    this.sync();
    game.on('profile', () => this.sync());
  }

  sync() {
    for (const it of this.items) it.g.visible = !this.game.profile.secrets.includes(it.s.id);
  }

  async collect(it) {
    try {
      const r = await this.game.net.request('secret.collect', { id: it.s.id });
      this.game.sfx('secret');
      this.game.reward(r, `🦆 Canard doré ${r.found}/${r.total}`);
      if (r.all) this.game.ui.toast('🏆 Tous les canards dorés ! Titre « Chasseur de canards » débloqué, +600 PC !', 'good', 7000);
      this.game.fx?.burst(it.g.position, '#ffd23f', 30);
    } catch (e) { this.game.ui.toast(e.message, 'bad'); }
  }

  update(dt, t) {
    for (const it of this.items) {
      if (!it.g.visible) continue;
      it.duck.rotation.y = t * 1.5;
      it.duck.position.y = Math.sin(t * 2.5) * 0.12;
      it.ring.scale.setScalar(1 + Math.sin(t * 3) * 0.15);
    }
  }
}
