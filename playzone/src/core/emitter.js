// Petit système d'événements (abonnement / émission).
export class Emitter {
  constructor() { this._h = new Map(); }
  on(name, fn) {
    if (!this._h.has(name)) this._h.set(name, new Set());
    this._h.get(name).add(fn);
    return () => this._h.get(name)?.delete(fn);
  }
  once(name, fn) {
    const off = this.on(name, (...a) => { off(); fn(...a); });
    return off;
  }
  emit(name, ...args) {
    const set = this._h.get(name);
    if (set) for (const fn of [...set]) { try { fn(...args); } catch (e) { console.error(`[${name}]`, e); } }
  }
}
