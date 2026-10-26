import { h } from './dom.js';

// Barre « Parler » (solo) : Entrée (ou 💬) pour dire quelque chose à voix haute. Le texte apparaît en
// bulle au-dessus du personnage, et les habitants proches répondent et réagissent (suivre, danser...).
export class SpeakBar {
  constructor(g) {
    this.g = g;
    this.input = h('input.text-input', { maxlength: 160, placeholder: 'Dis quelque chose aux gens autour… (suis-moi, danse, salut !)', 'aria-label': 'Parler' });
    this.el = h('div.speak-bar.hidden', h('span', '💬'), this.input, h('button.btn.small', { onclick: () => this.send() }, 'Dire'));
    g.ui.root.append(this.el);
    this.input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') this.send();
      if (e.key === 'Escape') this.close();
    });
    this.input.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== this.input) this.close(); }, 150));
    g.hud.addButton('💬', 'Parler (Entrée)', () => this.focus());
  }

  focus() { this.el.classList.remove('hidden'); setTimeout(() => this.input.focus(), 10); }
  close() { this.el.classList.add('hidden'); this.input.blur(); }

  send() {
    const g = this.g, t = this.input.value.trim();
    this.input.value = '';
    this.close();
    if (!t) return;
    g.labels.bubble(g.avatar.root, t, 4500, 'player');
    const n = g.npcs?.hear(t);
    if (!n) g.ui.toast('Personne n\'est assez près pour t\'entendre.', '', 2000);
  }
}
