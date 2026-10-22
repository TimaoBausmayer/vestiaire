import * as THREE from 'three';
import { PostFX } from './postfx.js';

// Moteur : rendu WebGL, scène, caméra, lumières, ciel et boucle de jeu. Gère la qualité graphique
// (ombres, résolution) pour rester fluide sur les petites machines et les téléphones.

const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;
const SKY_FRAG = /* glsl */`
uniform vec3 topColor; uniform vec3 horizonColor; uniform vec3 bottomColor;
uniform vec3 sunDir; uniform vec3 sunColor; uniform float starAmount; uniform float time; uniform float cloudLight;
varying vec3 vDir;
float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453); }
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), f.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * n2(p); p = p * 2.03 + 17.1; a *= 0.5; } return v; }
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = h > 0.0 ? mix(horizonColor, topColor, pow(min(h * 1.6, 1.0), 0.7)) : mix(horizonColor, bottomColor, min(-h * 4.0, 1.0));
  float s = max(dot(d, normalize(sunDir)), 0.0);
  col += sunColor * (smoothstep(0.9975, 0.999, s) * 3.0 + pow(s, 24.0) * 0.3 + pow(s, 4.0) * 0.08);
  // nuages : couche plane projetée sur la voûte, qui dérive avec le vent
  if (h > 0.0) {
    vec2 uv = d.xz / (h + 0.12) * 1.6 + vec2(time * 0.006, time * 0.002);
    float c = fbm(uv);
    float cov = smoothstep(0.5, 0.78, c) * smoothstep(0.0, 0.18, h);
    float shade = 0.75 + 0.25 * fbm(uv * 2.0 + 3.0);
    vec3 cloud = mix(horizonColor, vec3(1.0), 0.65) * shade * cloudLight + sunColor * pow(s, 6.0) * 0.35;
    col = mix(col, cloud, cov * 0.85);
  }
  if (starAmount > 0.0 && h > 0.05) {
    vec3 q = floor(d * 220.0);
    float st = step(0.9965, hash(q));
    col += vec3(st * starAmount * smoothstep(0.05, 0.3, h));
  }
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

// Carte d'environnement (reflets sur la carrosserie, les vitres...) : ciel en dégradé, soleil,
// silhouettes de la ville à l'horizon et sol. Recalculée quand l'heure change.
const ENV_VERT = /* glsl */`
varying vec3 vDir;
void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const ENV_FRAG = /* glsl */`
uniform vec3 top; uniform vec3 hor; uniform vec3 ground; uniform vec3 sunDir; uniform vec3 sunColor;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = h > 0.0 ? mix(hor, top, pow(min(h * 1.5, 1.0), 0.6)) : mix(hor * 0.7, ground, min(-h * 6.0, 1.0));
  float a = atan(d.z, d.x);
  float sky = 0.035 + 0.05 * abs(sin(a * 7.0) * sin(a * 19.0 + 1.3)) + 0.03 * step(0.6, fract(a * 6.0));
  float city = step(h, sky) * step(-0.01, h);
  col = mix(col, ground * 0.9 + hor * 0.25, city * 0.8);
  float s = max(dot(d, normalize(sunDir)), 0.0);
  col += sunColor * (pow(s, 90.0) * 12.0 + pow(s, 6.0) * 0.25);
  gl_FragColor = vec4(col, 1.0);
}`;

export function detectQuality() {
  let saved = null;
  try { saved = localStorage.getItem('playzone.quality'); } catch { /* stockage indisponible */ }
  if (saved) return saved;
  const mobile = matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency || 4;
  if (mobile || cores <= 2) return 'low';
  return cores >= 8 ? 'high' : 'medium';
}

export class Engine {
  constructor(container, quality = detectQuality()) {
    this.container = container;
    this.quality = quality;
    this.renderer = new THREE.WebGLRenderer({ antialias: quality !== 'low', powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 0.94;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);
    this.canvas = this.renderer.domElement;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xbfe3f5, 70, 230);
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 700);

    // Lumières : ciel/sol + soleil (avec ombres autour du joueur).
    this.hemi = new THREE.HemisphereLight(0xdff3ff, 0x6c8a4a, 1.6);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
    this.sun.position.set(40, 80, 30);
    this.sun.shadow.camera.left = -45; this.sun.shadow.camera.right = 45;
    this.sun.shadow.camera.top = 45; this.sun.shadow.camera.bottom = -45;
    this.sun.shadow.camera.near = 1; this.sun.shadow.camera.far = 220;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.12;
    this.scene.add(this.sun, this.sun.target);
    this.sunOffset = new THREE.Vector3(40, 80, 30);

    // Ciel
    this.skyUniforms = {
      topColor: { value: new THREE.Color(0x3d8ee8) }, horizonColor: { value: new THREE.Color(0xbfe3f5) },
      bottomColor: { value: new THREE.Color(0x8fb7c9) }, sunDir: { value: new THREE.Vector3(0.4, 0.8, 0.3) },
      sunColor: { value: new THREE.Color(0xfff3c4) }, starAmount: { value: 0 }, time: { value: 0 }, cloudLight: { value: 1 },
    };
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(500, 32, 16),
      new THREE.ShaderMaterial({ uniforms: this.skyUniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false }),
    );
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -1;
    this.scene.add(this.sky);

    this.updaters = [];
    this.time = 0;
    this.fps = 60;
    this._last = performance.now();
    this.applyQuality(quality);
    addEventListener('resize', () => this.resize());
    this.resize();
  }

  applyQuality(q) {
    this.quality = q;
    const pr = Math.min(devicePixelRatio || 1, q === 'low' ? 1 : q === 'medium' ? 1.25 : 2);
    this.renderer.setPixelRatio(pr);
    this.renderer.shadowMap.enabled = q !== 'low';
    this.renderer.shadowMap.type = q === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    if (q === 'low' && this.scene.environment) { this.envRT?.dispose(); this.envRT = null; this.scene.environment = null; }
    this.envDirty = true;
    const size = q === 'high' ? 4096 : 2048;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    this.sun.castShadow = q !== 'low';
    // grande carte : on voit loin (brume plus lointaine) en qualité haute
    this.scene.fog.near = q === 'high' ? 110 : 70;
    this.scene.fog.far = q === 'low' ? 170 : q === 'medium' ? 260 : 340;
    this.camera.far = q === 'low' ? 400 : q === 'medium' ? 800 : 1200;
    // post-traitement (halo, étalonnage, vignetage) hors qualité basse
    if (q === 'low' || this.noPost) { this.post?.dispose(); this.post = null; } else if (!this.post) this.post = new PostFX(this.renderer);
    this.camera.updateProjectionMatrix();
    // Les matériaux doivent être recompilés quand on active/désactive les ombres.
    this.scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
    this.resize();
  }

  // Met à jour la carte d'environnement (appelé par le cycle jour/nuit, seulement si les couleurs changent).
  updateEnvironment(top, hor, ground, sunDir, sunColor) {
    if (this.quality === 'low') return;
    if (!this.pmrem) {
      this.pmrem = new THREE.PMREMGenerator(this.renderer);
      this.envUniforms = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, ground: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, sunColor: { value: new THREE.Color() } };
      this.envScene = new THREE.Scene();
      this.envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 48, 24), new THREE.ShaderMaterial({ uniforms: this.envUniforms, vertexShader: ENV_VERT, fragmentShader: ENV_FRAG, side: THREE.BackSide, depthWrite: false })));
    }
    const u = this.envUniforms;
    u.top.value.copy(top); u.hor.value.copy(hor); u.ground.value.copy(ground); u.sunDir.value.copy(sunDir).normalize(); u.sunColor.value.copy(sunColor);
    const rt = this.pmrem.fromScene(this.envScene, 0, 0.1, 50, { size: 128 });
    this.envRT?.dispose();
    this.envRT = rt;
    this.scene.environment = rt.texture;
  }

  setQuality(q) {
    try { localStorage.setItem('playzone.quality', q); } catch { /* stockage indisponible */ }
    this.applyQuality(q);
  }

  resize() {
    const w = this.container.clientWidth || innerWidth, h = this.container.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 72 : 60; // téléphone en portrait : champ plus large
    this.camera.updateProjectionMatrix();
  }

  onUpdate(fn) { this.updaters.push(fn); return () => { this.updaters = this.updaters.filter((f) => f !== fn); }; }

  // Les ombres suivent une cible (le joueur).
  followShadow(x, z) {
    const snap = 2;
    const sx = Math.round(x / snap) * snap, sz = Math.round(z / snap) * snap;
    this.sun.target.position.set(sx, 0, sz);
    this.sun.position.set(sx + this.sunOffset.x, this.sunOffset.y, sz + this.sunOffset.z);
    this.sky.position.copy(this.camera.position);
  }

  start() {
    const loop = (now) => {
      requestAnimationFrame(loop);
      let dt = (now - this._last) / 1000;
      this._last = now;
      if (dt > 0.1) dt = 0.1; // onglet en pause, gros ralentissement : on évite les sauts
      if (dt <= 0) return;
      this.fps = this.fps * 0.95 + (1 / dt) * 0.05;
      this.time += dt;
      for (const fn of this.updaters) {
        try { fn(dt, this.time); } catch (e) { console.error(e); }
      }
      this.skyUniforms.time.value = this.time;
      if (this.post) this.post.render(this.scene, this.camera); else this.renderer.render(this.scene, this.camera);
    };
    requestAnimationFrame(loop);
  }
}
