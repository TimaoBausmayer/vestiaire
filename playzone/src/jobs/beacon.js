import * as THREE from 'three';

// Balise lumineuse au-dessus d'un objectif (colonne de lumière + anneau au sol).
export class Beacon {
  constructor(scene, color = '#ffd23f') {
    this.g = new THREE.Group();
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 30, 12, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    col.position.y = 15;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.12, 6, 24), new THREE.MeshBasicMaterial({ color }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.15;
    this.ring = ring;
    this.g.add(col, ring);
    scene.add(this.g);
    this.scene = scene;
  }
  at(x, y, z) { this.g.position.set(x, y, z); this.g.visible = true; return this; }
  update(t) { this.ring.scale.setScalar(1 + Math.sin(t * 4) * 0.15); }
  dispose() { this.scene.remove(this.g); }
}
