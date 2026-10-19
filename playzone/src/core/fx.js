import * as THREE from 'three';

// Particules (confettis, eau, feu, fumée, éclaboussures de tarte...) : un seul objet Points
// avec un réservoir de particules réutilisées, donc très peu coûteux.
const MAX = 3000;

function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 30);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.6, 'rgba(255,255,255,0.9)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.beginPath(); g.arc(32, 32, 30, 0, 7); g.fill();
  const t = new THREE.CanvasTexture(c);
  return t;
}

export class FX {
  constructor(scene) {
    this.pos = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 3);
    this.size = new Float32Array(MAX);
    this.vel = new Float32Array(MAX * 3);
    this.life = new Float32Array(MAX);
    this.maxLife = new Float32Array(MAX);
    this.grav = new Float32Array(MAX);
    this.grow = new Float32Array(MAX);
    this.next = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: dotTexture() }, scale: { value: innerHeight / 2 } },
      vertexShader: `attribute float size; attribute vec3 color; varying vec3 vColor; uniform float scale;
        void main(){ vColor = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; varying vec3 vColor;
        void main(){
          vec4 t = texture2D(map, gl_PointCoord);
          if (t.a < 0.35) discard;
          gl_FragColor = vec4(vColor, 1.0);
          #include <colorspace_fragment>
        }`,
      transparent: false, depthWrite: true,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
    scene.add(this.points);
    this.geo = geo;
    this._c = new THREE.Color();
    addEventListener('resize', () => { mat.uniforms.scale.value = innerHeight / 2; });
  }

  // o = { x,y,z, n, colors[], speed, spread, dir:{x,y,z}, gravity, life, size, grow }
  emit(o) {
    const n = o.n || 10;
    const colors = o.colors || ['#ffffff'];
    for (let k = 0; k < n; k++) {
      const i = this.next;
      this.next = (this.next + 1) % MAX;
      this.pos[i * 3] = o.x + (Math.random() - 0.5) * (o.jitter || 0.2);
      this.pos[i * 3 + 1] = o.y + (Math.random() - 0.5) * (o.jitter || 0.2);
      this.pos[i * 3 + 2] = o.z + (Math.random() - 0.5) * (o.jitter || 0.2);
      const d = o.dir || { x: 0, y: 1, z: 0 };
      const sp = (o.speed || 4) * (0.6 + Math.random() * 0.6);
      const s = o.spread ?? 1;
      this.vel[i * 3] = (d.x + (Math.random() - 0.5) * s) * sp;
      this.vel[i * 3 + 1] = (d.y + (Math.random() - 0.5) * s) * sp;
      this.vel[i * 3 + 2] = (d.z + (Math.random() - 0.5) * s) * sp;
      this._c.set(colors[Math.floor(Math.random() * colors.length)]);
      this.col[i * 3] = this._c.r; this.col[i * 3 + 1] = this._c.g; this.col[i * 3 + 2] = this._c.b;
      this.maxLife[i] = this.life[i] = (o.life || 1) * (0.7 + Math.random() * 0.6);
      this.size[i] = o.size || 0.3;
      this.grav[i] = o.gravity ?? 9;
      this.grow[i] = o.grow || 0;
    }
  }

  burst(p, color = '#ffd23f', n = 24) {
    this.emit({ x: p.x, y: p.y + 0.8, z: p.z, n, colors: [color, '#ffffff', '#ff5a5f', '#2ec4b6'], speed: 6, spread: 1.6, gravity: 12, life: 1.1, size: 0.28 });
  }

  confetti(p, n = 60) {
    this.emit({ x: p.x, y: p.y + 2.5, z: p.z, n, colors: ['#ff5a5f', '#ffd23f', '#2ec4b6', '#8b5cf6', '#7ac74f', '#ffffff'], speed: 7, spread: 2, gravity: 6, life: 2, size: 0.25 });
  }

  update(dt) {
    let any = false;
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) { if (this.size[i] !== 0) { this.size[i] = 0; any = true; } continue; }
      any = true;
      this.life[i] -= dt;
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] = Math.max(0, this.size[i] + this.grow[i] * dt);
      if (this.life[i] <= 0) this.size[i] = 0;
    }
    if (any) {
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.color.needsUpdate = true;
      this.geo.attributes.size.needsUpdate = true;
    }
  }
}
