import * as THREE from 'three';

// Traces de pneus au sol : un tampon circulaire de segments (un seul maillage, un seul appel de dessin).
// Les traces les plus anciennes sont réutilisées ; elles s'estompent avec l'âge.
const MAX = 900;

export class SkidMarks {
  constructor(scene) {
    this.pos = new Float32Array(MAX * 6 * 3);
    this.alpha = new Float32Array(MAX * 6);
    this.born = new Float32Array(MAX);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      vertexShader: 'attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying float vA; void main(){ gl_FragColor = vec4(0.06, 0.06, 0.07, vA * 0.55); }',
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    scene.add(this.mesh);
    this.geo = geo;
    this.next = 0;
    this.last = new Map(); // clé de roue -> dernier point
    this.time = 0;
  }

  // Ajoute un morceau de trace pour la roue `key` jusqu'au point (x, y, z), largeur w, intensité a.
  add(key, x, y, z, w, a) {
    const prev = this.last.get(key);
    this.last.set(key, { x, y, z, t: this.time });
    if (!prev || this.time - prev.t > 0.2) return;
    const dx = x - prev.x, dz = z - prev.z, len = Math.hypot(dx, dz);
    if (len < 0.05 || len > 3) return;
    const nx = -dz / len * w / 2, nz = dx / len * w / 2;
    const i = this.next;
    this.next = (this.next + 1) % MAX;
    const yy = y + 0.03, py = prev.y + 0.03;
    const quad = [prev.x - nx, py, prev.z - nz, prev.x + nx, py, prev.z + nz, x + nx, yy, z + nz, prev.x - nx, py, prev.z - nz, x + nx, yy, z + nz, x - nx, yy, z - nz];
    this.pos.set(quad, i * 18);
    for (let k = 0; k < 6; k++) this.alpha[i * 6 + k] = a;
    this.born[i] = this.time;
    this.dirty = true;
  }

  // Coupe la trace d'une roue (elle ne touche plus le sol ou ne dérape plus).
  lift(key) { this.last.delete(key); }

  update(dt) {
    this.time += dt;
    // estompage lent (une trace dure ~40 s)
    this._fade = (this._fade || 0) + dt;
    if (this._fade > 0.5) {
      this._fade = 0;
      for (let i = 0; i < MAX; i++) {
        if (this.alpha[i * 6] <= 0) continue;
        const a = Math.max(0, this.alpha[i * 6] - 0.5 / 40);
        for (let k = 0; k < 6; k++) this.alpha[i * 6 + k] = a;
      }
      this.geo.attributes.alpha.needsUpdate = true;
    }
    if (this.dirty) {
      this.dirty = false;
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.alpha.needsUpdate = true;
    }
  }
}
