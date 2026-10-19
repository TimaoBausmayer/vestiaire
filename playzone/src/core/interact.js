// Points d'interaction ("Appuyer sur E pour...") : portes, stands, PNJ, objets...
export class Interactions {
  constructor() {
    this.list = new Set();
    this.current = null;
  }

  add(def) {
    const d = { r: 2.4, y: 0, zone: 'world', priority: 0, ...def };
    this.list.add(d);
    return d;
  }

  remove(def) { this.list.delete(def); if (this.current === def) this.current = null; }

  update(pos, zone) {
    let best = null, bestScore = Infinity;
    for (const d of this.list) {
      if (d.zone !== zone && !(d.zone === 'home' && zone.startsWith('home'))) continue;
      const x = typeof d.x === 'function' ? d.x() : d.x;
      const z = typeof d.z === 'function' ? d.z() : d.z;
      const dist = Math.hypot(pos.x - x, pos.z - z);
      if (dist > d.r) continue;
      if (d.enabled && !d.enabled()) continue;
      const score = dist - d.priority * 10;
      if (score < bestScore) { bestScore = score; best = d; }
    }
    this.current = best;
    return best;
  }

  label() {
    const d = this.current;
    if (!d) return null;
    return typeof d.label === 'function' ? d.label() : d.label;
  }

  trigger() {
    const d = this.current;
    if (d) d.action();
    return !!d;
  }
}
