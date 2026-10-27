import { h } from './dom.js';

// Contrôles tactiles (téléphones, tablettes) : joystick virtuel à gauche (il apparaît sous le pouce),
// glisser à droite pour tourner la caméra, boutons d'action.
export class TouchControls {
  constructor(game) {
    this.game = game;
    const input = game.input;
    this.joy = h('div.joy', this.knob = h('div.knob'));
    const btn = (label, cls, title, down, up) => {
      const b = h(`button.tbtn${cls ? `.${cls}` : ''}`, { 'aria-label': title, title }, label);
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); b.setPointerCapture?.(e.pointerId); down?.(b); });
      b.addEventListener('pointerup', (e) => { e.preventDefault(); up?.(b); });
      b.addEventListener('pointercancel', () => up?.(b));
      b.addEventListener('contextmenu', (e) => e.preventDefault());
      return b;
    };
    this.actionBtn = btn('💦', '', 'Arroser (maintenir)', () => { input.actionHeld = true; }, () => { input.actionHeld = false; });
    this.sprintBtn = btn('🏃', '', 'Courir', (b) => { input.sprintToggle = !input.sprintToggle; b.classList.toggle('on', input.sprintToggle); });
    this.danceBtn = btn('💃', '', 'Danser', () => { const p = game.player; p.dance = p.pose === 'dance' ? (p.dance + 1) % 3 : 0; p.setPose('dance'); game.emit('dance'); });
    this.punchBtn = btn('👊', '', 'Frapper (G)', () => { if (game.boxing?.f) game.boxing.punch('jab'); else if (game.boxing?.bagS) game.boxing.bagHit(false); else game.crimes?.punch(); });
    this.useBtn = btn('✋', 'big', 'Interagir', () => game.interact());
    this.jumpBtn = btn('⤒', 'big', 'Sauter', () => input.press('Space'));
    this.el = h('div.touch', this.joy, h('div.tbtns', this.actionBtn, this.punchBtn, this.sprintBtn, this.danceBtn, this.useBtn, this.jumpBtn));
    game.ui.root.append(this.el);
    this.el.classList.toggle('on', input.isTouch);
    input.on('joystick', (j) => {
      if (!j) { this.joy.style.display = 'none'; return; }
      this.joy.style.display = 'block';
      this.joy.style.left = `${j.ox}px`;
      this.joy.style.top = `${j.oy}px`;
      this.knob.style.transform = `translate(${j.x * 34}px, ${-j.y * 34}px)`;
    });
    this.refresh();
  }

  refresh() {
    const g = this.game;
    this.actionBtn.style.visibility = g.jobs?.active?.job.id === 'firefighter' ? 'visible' : 'hidden';
  }

  update(dt) {
    this._t = (this._t || 0) + dt;
    if (this._t > 0.5) { this._t = 0; this.refresh(); }
  }
}
