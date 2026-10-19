import { h, clear } from './dom.js';

// Gestionnaire d'interface : fenêtres (modales), notifications, textes flottants, invite d'interaction.
export class UI {
  constructor(root, game) {
    this.root = root;
    this.game = game;
    this.stack = [];
    this.labels = h('div.labels.passthrough');
    this.toasts = h('div.toasts.passthrough');
    this.promptEl = h('div.prompt', { onclick: () => game.interact() });
    root.append(this.labels, this.toasts, this.promptEl);
    addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.stack.length) { e.preventDefault(); this.closeTop(); }
    });
  }

  get blocking() { return this.stack.some((m) => m.blocking !== false); }

  // Ouvre une fenêtre. build(body, close) remplit le contenu. Renvoie { el, close, refresh }.
  modal({ title, sub, build, foot, width, blocking = true, onClose, tabs, className }) {
    const body = h('div.panel-body');
    const footEl = h('div.panel-foot');
    const panel = h(`div.panel${className ? `.${className}` : ''}`, { style: width ? { width } : null },
      h('div.panel-head', h('h2', title, sub ? h('span.sub', sub) : null), h('button.close-x', { 'aria-label': 'Fermer', onclick: () => m.close() }, '✕')),
      tabs ? tabs : null,
      body, foot ? footEl : null);
    const el = h('div.modal', { onclick: (e) => { if (e.target === el) m.close(); } }, panel);
    const m = {
      el, body, foot: footEl, blocking,
      close: () => {
        if (m.closed) return;
        m.closed = true;
        el.remove();
        this.stack = this.stack.filter((x) => x !== m);
        onClose?.();
        this.game.onUiChange?.();
      },
      refresh: () => { clear(body); build(body, m); if (foot) { clear(footEl); foot(footEl, m); } },
    };
    this.stack.push(m);
    this.root.append(el);
    m.refresh();
    this.game.onUiChange?.();
    return m;
  }

  closeTop() { this.stack[this.stack.length - 1]?.close(); }
  closeAll() { [...this.stack].forEach((m) => m.close()); }

  toast(text, kind = '', ms = 3200) {
    const el = h(`div.toast${kind ? `.${kind}` : ''}`, text);
    this.toasts.append(el);
    while (this.toasts.children.length > 4) this.toasts.firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 450); }, ms);
    return el;
  }

  // Texte qui s'envole depuis un point de l'écran (ex. "+25 PC").
  floater(text, x, y, color) {
    const el = h('div.floater', { style: { left: `${x}px`, top: `${y}px`, color } }, text);
    this.root.append(el);
    setTimeout(() => el.remove(), 1500);
  }

  prompt(label) {
    if (!label) { this.promptEl.classList.remove('show'); this._pl = null; return; }
    if (this._pl === label) return;
    this._pl = label;
    clear(this.promptEl);
    this.promptEl.append(h('span.key', this.game.input.isTouch ? '✋' : 'E'), h('span', label));
    this.promptEl.classList.add('show');
  }

  // Petite boîte de confirmation.
  confirm(title, text, okLabel = 'Confirmer') {
    return new Promise((resolve) => {
      const m = this.modal({
        title, width: 'min(420px, 94vw)',
        build: (b) => b.append(h('p', text)),
        foot: (f) => f.append(h('button.btn.ghost', { onclick: () => { m.close(); resolve(false); } }, 'Annuler'), h('button.btn', { onclick: () => { m.close(); resolve(true); } }, okLabel)),
        onClose: () => resolve(false),
      });
    });
  }
}
