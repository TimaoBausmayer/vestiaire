import * as THREE from 'three';

// SILLAGE : traînée d'écume blanche derrière une planche ou un jet ski (ruban qui s'efface).
export class Wake {
  constructor(scene, { n = 70, width = 1.2, y = -0.3 } = {}) {
    this.n = n; this.width = width; this.y = y;
    this.pts = [];
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 2 * 3);
    this.alpha = new Float32Array(n * 2);
    const idx = [];
    for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    this.geo.setIndex(idx);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      vertexShader: 'attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying float vA; void main(){ gl_FragColor = vec4(1.0, 1.0, 1.0, vA * 0.45); }',
    });
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    scene.add(this.mesh);
    this.t = 0;
  }
  // ajoute un point (position, cap, intensité 0..1)
  push(x, z, yaw, k) {
    this.pts.unshift({ x, z, yaw, k, age: 0 });
    if (this.pts.length > this.n) this.pts.pop();
  }
  update(dt) {
    for (const p of this.pts) p.age += dt;
    for (let i = 0; i < this.n; i++) {
      const p = this.pts[i] || this.pts[this.pts.length - 1];
      if (!p) break;
      const spread = this.width * (0.6 + p.age * 1.1);
      const nx = Math.cos(p.yaw) * spread / 2, nz = -Math.sin(p.yaw) * spread / 2;
      const a = Math.max(0, p.k * (1 - p.age / 2.5)) * (i < this.pts.length ? 1 : 0);
      this.pos.set([p.x - nx, this.y, p.z - nz, p.x + nx, this.y, p.z + nz], i * 6);
      this.alpha[i * 2] = a; this.alpha[i * 2 + 1] = a;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.alpha.needsUpdate = true;
  }
  clear() { this.pts = []; this.alpha.fill(0); this.geo.attributes.alpha.needsUpdate = true; }
}
