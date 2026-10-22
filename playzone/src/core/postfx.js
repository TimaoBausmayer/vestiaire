import * as THREE from 'three';

// Post-traitement maison (qualité moyenne et haute) : la scène est rendue dans une image HDR
// (anticrénelage MSAA), puis on ajoute un halo lumineux (bloom) sur les zones très claires — soleil,
// néons, phares, reflets sur l'eau —, un étalonnage des couleurs (contraste, saturation, teinte chaude)
// et un léger vignetage. Le tone mapping et la conversion sRGB sont faits dans la passe finale.

const QUAD_VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// extraction des zones claires (seuil doux)
const BRIGHT_FRAG = /* glsl */`
uniform sampler2D tSrc; uniform float threshold;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tSrc, vUv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float k = smoothstep(threshold, threshold + 0.6, l);
  gl_FragColor = vec4(c * k, 1.0);
}`;

// flou gaussien séparable (9 échantillons, poids linéaires)
const BLUR_FRAG = /* glsl */`
uniform sampler2D tSrc; uniform vec2 dir;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tSrc, vUv).rgb * 0.2270270270;
  c += texture2D(tSrc, vUv + dir * 1.3846153846).rgb * 0.3162162162;
  c += texture2D(tSrc, vUv - dir * 1.3846153846).rgb * 0.3162162162;
  c += texture2D(tSrc, vUv + dir * 3.2307692308).rgb * 0.0702702703;
  c += texture2D(tSrc, vUv - dir * 3.2307692308).rgb * 0.0702702703;
  gl_FragColor = vec4(c, 1.0);
}`;

const FINAL_FRAG = /* glsl */`
uniform sampler2D tScene; uniform sampler2D tBloom; uniform sampler2D tBloom2;
uniform float bloom; uniform float saturation; uniform float contrast; uniform vec3 tint; uniform float vignette;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tScene, vUv).rgb;
  c += (texture2D(tBloom, vUv).rgb * 0.6 + texture2D(tBloom2, vUv).rgb * 0.8) * bloom;
  c *= tint;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = max(mix(vec3(l), c, saturation), 0.0);
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  // contraste en espace d'affichage, puis vignetage
  vec3 d = gl_FragColor.rgb;
  d = clamp((d - 0.5) * contrast + 0.5, 0.0, 1.0);
  vec2 q = vUv - 0.5;
  d *= 1.0 - vignette * smoothstep(0.25, 0.75, dot(q, q) * 2.2);
  gl_FragColor.rgb = d;
}`;

export class PostFX {
  constructor(renderer) {
    this.renderer = renderer;
    const opts = { type: THREE.HalfFloatType, depthBuffer: false };
    this.scene = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.a = new THREE.WebGLRenderTarget(1, 1, opts); this.b = new THREE.WebGLRenderTarget(1, 1, opts);
    this.c = new THREE.WebGLRenderTarget(1, 1, opts); this.d = new THREE.WebGLRenderTarget(1, 1, opts);
    const mk = (frag, uniforms, extra = {}) => new THREE.ShaderMaterial({ vertexShader: QUAD_VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, ...extra });
    this.bright = mk(BRIGHT_FRAG, { tSrc: { value: null }, threshold: { value: 1.5 } }, { toneMapped: false });
    this.blur = mk(BLUR_FRAG, { tSrc: { value: null }, dir: { value: new THREE.Vector2() } }, { toneMapped: false });
    this.final = mk(FINAL_FRAG, {
      tScene: { value: this.scene.texture }, tBloom: { value: this.b.texture }, tBloom2: { value: this.d.texture },
      bloom: { value: 0.25 }, saturation: { value: 1.03 }, contrast: { value: 1.06 }, tint: { value: new THREE.Color(1.02, 1.0, 0.97) }, vignette: { value: 0.22 },
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.final);
    this.quad.frustumCulled = false;
    this.qScene = new THREE.Scene(); this.qScene.add(this.quad);
    this.qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.w = 0; this.h = 0;
  }

  setSize(w, h) {
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    this.scene.setSize(w, h);
    const hw = Math.max(1, w >> 1), hh = Math.max(1, h >> 1), qw = Math.max(1, w >> 3), qh = Math.max(1, h >> 3);
    this.a.setSize(hw, hh); this.b.setSize(hw, hh); this.c.setSize(qw, qh); this.d.setSize(qw, qh);
  }

  pass(mat, target) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.qScene, this.qCam);
  }

  blurInto(src, tmp, dst, step) {
    this.blur.uniforms.tSrc.value = src.texture; this.blur.uniforms.dir.value.set(step / src.width, 0); this.pass(this.blur, tmp);
    this.blur.uniforms.tSrc.value = tmp.texture; this.blur.uniforms.dir.value.set(0, step / src.height); this.pass(this.blur, dst);
  }

  render(scene, camera) {
    const r = this.renderer;
    const size = r.getDrawingBufferSize(this._v || (this._v = new THREE.Vector2()));
    this.setSize(size.x, size.y);
    r.setRenderTarget(this.scene);
    r.render(scene, camera);
    // halo : grand (1/2) puis très large (1/8)
    this.bright.uniforms.tSrc.value = this.scene.texture; this.pass(this.bright, this.a);
    this.blurInto(this.a, this.b, this.a, 1.2);
    this.blur.uniforms.tSrc.value = this.a.texture; this.blur.uniforms.dir.value.set(0, 0); this.pass(this.blur, this.b);
    this.blurInto(this.b, this.c, this.d, 1);
    this.blurInto(this.d, this.c, this.d, 2);
    this.quad.material = this.final;
    r.setRenderTarget(null);
    r.render(this.qScene, this.qCam);
  }

  dispose() { for (const t of [this.scene, this.a, this.b, this.c, this.d]) t.dispose(); }
}
