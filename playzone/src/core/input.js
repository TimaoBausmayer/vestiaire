import { Emitter } from './emitter.js';

// Entrées : clavier (QWERTY et AZERTY grâce aux codes physiques), souris (glisser = caméra, clic = action),
// tactile (joystick virtuel à gauche, glisser à droite = caméra, boutons d'action).

const MOVE_KEYS = {
  KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0],
};

export class Input extends Emitter {
  constructor(canvas) {
    super();
    this.canvas = canvas;
    this.keys = new Set();
    this.move = { x: 0, y: 0 };
    this.look = { dx: 0, dy: 0 };
    this.zoom = 0;
    this.sprintToggle = false;
    this.actionHeld = false;
    this.enabled = true;
    this._edges = new Set();
    this._joy = null;      // { id, ox, oy, x, y }
    this._drag = null;     // { id, x, y, sx, sy, moved }
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

    addEventListener('keydown', (e) => this._key(e, true));
    addEventListener('keyup', (e) => this._key(e, false));
    addEventListener('blur', () => { this.keys.clear(); this.actionHeld = false; });
    canvas.addEventListener('pointerdown', (e) => this._down(e));
    addEventListener('pointermove', (e) => this._moveP(e));
    addEventListener('pointerup', (e) => this._up(e));
    addEventListener('pointercancel', (e) => this._up(e));
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom += Math.sign(e.deltaY); }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  typing() {
    const a = document.activeElement;
    return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable);
  }

  _key(e, down) {
    if (this.typing()) return;
    if (down) {
      if (!this.keys.has(e.code)) {
        this._edges.add(e.code);
        this.emit('key', e);
      }
      this.keys.add(e.code);
      if (e.code === 'Space' || e.code.startsWith('Arrow') || e.code === 'Tab') e.preventDefault();
    } else {
      this.keys.delete(e.code);
    }
  }

  _down(e) {
    if (!this.enabled) return;
    this.canvas.setPointerCapture?.(e.pointerId);
    const left = e.clientX < innerWidth * 0.42;
    if (e.pointerType === 'touch' && left && !this._joy) {
      this._joy = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 };
      this.emit('joystick', this._joy);
      return;
    }
    if (!this._drag) this._drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, button: e.button };
    if (e.pointerType !== 'touch' && e.button === 0) this.actionHeld = true;
  }

  _moveP(e) {
    if (this._joy && e.pointerId === this._joy.id) {
      const R = 55;
      let dx = e.clientX - this._joy.ox, dy = e.clientY - this._joy.oy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
      this._joy.x = dx / R; this._joy.y = -dy / R;
      this.emit('joystick', this._joy);
      return;
    }
    const d = this._drag;
    if (d && e.pointerId === d.id) {
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      d.x = e.clientX; d.y = e.clientY;
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 6) d.moved = true;
      if (d.moved) { this.look.dx += dx; this.look.dy += dy; }
    }
    this.pointer = { x: e.clientX, y: e.clientY };
  }

  _up(e) {
    if (this._joy && e.pointerId === this._joy.id) {
      this._joy = null;
      this.emit('joystick', null);
      return;
    }
    const d = this._drag;
    if (d && e.pointerId === d.id) {
      if (!d.moved) this.emit('click', { x: e.clientX, y: e.clientY, button: d.button });
      this._drag = null;
    }
    if (e.pointerType !== 'touch' && e.button === 0) this.actionHeld = false;
  }

  // Appuis "fronts montants" (une seule fois par appui).
  pressed(code) {
    if (this._edges.has(code)) { this._edges.delete(code); return true; }
    return false;
  }

  press(code) { this._edges.add(code); } // utilisé par les boutons tactiles

  update() {
    let x = 0, y = 0;
    if (this.enabled && !this.typing()) {
      for (const [code, v] of Object.entries(MOVE_KEYS)) if (this.keys.has(code)) { x += v[0]; y += v[1]; }
    }
    if (this._joy) { x += this._joy.x; y += this._joy.y; }
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    this.move.x = x; this.move.y = y;
    this.sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.sprintToggle || (this._joy && Math.hypot(this._joy.x, this._joy.y) > 0.95);
    this.jumpHeld = this.keys.has('Space');
  }

  endFrame() {
    this.look.dx = 0; this.look.dy = 0; this.zoom = 0;
    this._edges.clear();
  }
}
