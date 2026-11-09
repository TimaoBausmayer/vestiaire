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
    const d = b.door;
    // vecteur sortant de la façade (n) et le long de la façade (t)
    const n = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[b.facing], tv = [-n[1], n[0]];
    // cordon qui bloque l'entrée (collision) tant que le club n'est pas débloqué
    const ax = d.x - n[0] * 1.2, az = d.z - n[1] * 1.2;
    this.rope = g.collision.addBox(Math.min(ax - tv[0] * 2.6, ax + tv[0] * 2.6) - Math.abs(n[0]) * 0.6, 0, Math.min(az - tv[1] * 2.6, az + tv[1] * 2.6) - Math.abs(n[1]) * 0.6, Math.max(ax - tv[0] * 2.6, ax + tv[0] * 2.6) + Math.abs(n[0]) * 0.6, 2.2, Math.max(az - tv[1] * 2.6, az + tv[1] * 2.6) + Math.abs(n[1]) * 0.6, { noCamera: true });
    this.bouncer = new Avatar({ ...DEFAULT_APPEARANCE, skin: '#8d5524', hair: 'chauve', body: 'costaud', top: 'sweat', topColor: '#0b0b10', bottom: 'jean', bottomColor: '#0b0b10', glasses: 'lunettes-soleil' }, {});
    this.bouncer.root.position.set(d.x + n[0] * 1.2 + tv[0] * 3, 0, d.z + n[1] * 1.2 + tv[1] * 3);
    this.bouncer.root.rotation.y = Math.atan2(n[0], n[1]);
    g.engine.scene.add(this.bouncer.root);
    g.labels.add(this.bouncer.root, h('div.wlabel', 'Le videur'), 2.3, 25);
    g.interactions.add({
      x: d.x + n[0] * 1.5, z: d.z + n[1] * 1.5, r: 3.2, priority: 5,
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
