import { h } from '../ui/dom.js';
import { Avatar } from '../characters/avatar.js';
import { DEFAULT_APPEARANCE } from '../../shared/appearance.js';
import { BUILDING_BY_ID } from '../../shared/world-layout.js';

// LE VELOURS : club privé secret. Un videur garde la porte (et un cordon de velours la bloque) tant
// qu'on n'a pas tapé le bon code sur la carte du téléphone. Dedans : la même ambiance qu'une boîte
// de nuit (piste de danse, bar, carré VIP, DJ), en plus chic.
export class VipClub {
  constructor(g) {
    this.g = g;
    const b = this.b = BUILDING_BY_ID['club-vip'];
    const d = b.door, fx = d.x - b.x > 0 ? 1 : -1;   // façade ouest
    // cordon qui bloque l'entrée (collision) tant que le club n'est pas débloqué
    this.rope = g.collision.addBox(d.x - 1.2, 0, d.z - 2.4, d.x + 0.3, 2.2, d.z + 2.4, { noCamera: true });
    this.bouncer = new Avatar({ ...DEFAULT_APPEARANCE, skin: '#8d5524', hair: 'chauve', body: 'costaud', top: 'sweat', topColor: '#0b0b10', bottom: 'jean', bottomColor: '#0b0b10', glasses: 'lunettes-soleil' }, {});
    this.bouncer.root.position.set(d.x + fx * 1.5, 0, d.z + 2.6);
    this.bouncer.root.rotation.y = fx > 0 ? Math.PI / 2 : -Math.PI / 2;
    g.engine.scene.add(this.bouncer.root);
    g.labels.add(this.bouncer.root, h('div.wlabel', 'Le videur'), 2.3, 25);
    g.interactions.add({
      x: d.x + fx * 1.2, z: d.z + 1.6, r: 2.6, priority: 5,
      enabled: () => g.player.zone === 'world',
      label: () => (this.open() ? '🍾 Le Velours : « Bonsoir, entrez ! »' : '🔒 Le Velours : club privé'),
      action: () => {
        if (this.open()) g.ui.toast('🍾 Bienvenue au Velours ! Piste, bar, carré VIP et DJ t\'attendent.', 'good', 3500);
        else this.askCode();
      },
    });
  }
  // le videur demande le code : on peut le taper ici, à la porte
  askCode() {
    const g = this.g;
    let code = '';
    const m = g.ui.modal({
      title: '🔒 Le Velours (club privé)', sub: 'Le videur : « C\'est privé. Le code ? »', width: 'min(420px, 94vw)',
      build: (body) => {
        const inp = h('input.input', { type: 'password', inputmode: 'numeric', placeholder: 'Code du club', autocomplete: 'off', oninput: (e) => { code = e.target.value; }, onkeydown: (e) => { e.stopPropagation(); if (e.key === 'Enter') go(); } });
        body.append(inp, h('button.btn.block', { style: { marginTop: '8px' }, onclick: () => go() }, 'Donner le code'));
        setTimeout(() => inp.focus(), 60);
      },
    });
    const go = async () => {
      try { await g.net.request('secret.code', { code }); m.close(); g.sfx('levelup'); g.ui.toast('🍾 Le videur s\'écarte : « Bonsoir, entrez ! » Le cordon est retiré.', 'good', 4000); }
      catch (e) { g.sfx('error'); g.ui.toast('🚫 « Mauvais code. » Le videur ne bouge pas.', 'bad', 2500); }
    };
  }

  open() { return !!this.g.profile?.unlocks?.vip || !!this.g.profile?.admin; }
  update(dt) {
    const P = this.g.player.pos, b = this.b;
    if (Math.abs(P.x - b.x) > 80 || Math.abs(P.z - b.z) > 80) return;
    this.rope.enabled = !this.open();
    this.bouncer.update(dt, { speed: 0, grounded: true, pose: 'idle' });
  }
}
