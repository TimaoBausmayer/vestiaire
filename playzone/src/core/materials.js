import * as THREE from 'three';

// Identité graphique : rendu "semi-réaliste avec une touche cartoon". Matériaux physiques (PBR) éclairés
// par le soleil, le ciel et une carte d'environnement (reflets), couleurs vives portées par les sommets.
// Un seul matériau sert à presque tout le décor et aux personnages : très peu d'appels de dessin.

// "Maison de poupée" : quand le joueur est dans un bâtiment visitable, le toit, les étages et les murs
// tournés vers la caméra sont escamotés dans le shader (attribut `cut` = bâtiment * 8 + partie ;
// partie 1 = toit/étages, 2 = mur nord, 3 = sud, 4 = ouest, 5 = est).
export const CUT = { uCutB: { value: 0 }, uCutMask: { value: new THREE.Vector4() }, uCutRoof: { value: 0 } };
const CUT_HEAD = 'attribute float cut;\nuniform float uCutB; uniform vec4 uCutMask; uniform float uCutRoof;\n';
const CUT_BODY = `#include <begin_vertex>
  if (uCutB > 0.5 && cut > 0.5) {
    float cb = floor(cut / 8.0 + 0.01);
    float cp = cut - cb * 8.0;
    if (abs(cb - uCutB) < 0.5) {
      float hide = cp < 1.5 ? uCutRoof : cp < 2.5 ? uCutMask.x : cp < 3.5 ? uCutMask.y : cp < 4.5 ? uCutMask.z : uCutMask.w;
      if (hide > 0.5) transformed = vec3(0.0, -500.0, 0.0);
    }
  }`;
export function withCut(mat, key, extra) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev?.call(mat, sh, r);
    Object.assign(sh.uniforms, CUT);
    sh.vertexShader = CUT_HEAD + sh.vertexShader.replace('#include <begin_vertex>', CUT_BODY);
    extra?.(sh);
  };
  mat.customProgramCacheKey = () => key;
  return mat;
}

// Grain de surface procédural (position dans le monde) : variations douces + petit grain, qui
// donnent de la matière à l'herbe, au bitume, aux façades sans aucune texture à charger.
// L'effet s'estompe au loin pour ne pas scintiller.
const DETAIL_V_HEAD = 'varying vec3 vPzW;\n';
const DETAIL_V_BODY = `#include <project_vertex>
  vec4 pzW = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    pzW = instanceMatrix * pzW;
  #endif
  vPzW = (modelMatrix * pzW).xyz;`;
const DETAIL_F_HEAD = `varying vec3 vPzW;
float pzH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float pzN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(pzH(i), pzH(i + vec2(1.0, 0.0)), f.x), mix(pzH(i + vec2(0.0, 1.0)), pzH(i + vec2(1.0, 1.0)), f.x), f.y); }
`;
function withDetail(mat, strength, ground) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev?.call(mat, sh, r);
    sh.vertexShader = DETAIL_V_HEAD + sh.vertexShader.replace('#include <project_vertex>', DETAIL_V_BODY);
    sh.fragmentShader = DETAIL_F_HEAD + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
  {
    vec3 wp = vPzW;
    // projection selon la face : sol (xz) ou murs (xy / zy)
    vec2 q = wp.xz;
    vec3 nW = normalize(cross(dFdx(wp), dFdy(wp)));
    if (abs(nW.y) < 0.6) q = abs(nW.x) > abs(nW.z) ? wp.zy : wp.xy;
    float fade = 1.0 - smoothstep(25.0, 140.0, distance(cameraPosition, wp));
    float macro = pzN(q * 0.045) * 0.6 + pzN(q * 0.13) * 0.4;
    float micro = pzN(q * 2.3) * 0.55 + pzN(q * 7.1) * 0.45;
    float d = (macro - 0.5) * ${ground ? '0.42' : '0.08'} + (micro - 0.5) * ${strength.toFixed(3)} * fade;
    diffuseColor.rgb *= 1.0 + d;
    ${ground ? '// brins d\'herbe plus clairs, éparpillés\n    float blade = step(0.83, pzN(q * 11.0)) * fade * step(0.0, diffuseColor.g - diffuseColor.r);\n    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.12, 1.2, 0.95), blade * 0.6);' : ''}
  }`);
  };
  return mat;
}

// Personnages et objets mobiles : léger liseré de lumière sur les contours (lisibilité, aspect « film »).
function withRim(mat) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev?.call(mat, sh, r);
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `
  {
    float rim = pow(1.0 - clamp(dot(normalize(vViewPosition) * -1.0, normal), 0.0, 1.0), 3.0);
    outgoingLight += diffuseColor.rgb * rim * 0.35 + vec3(0.9, 0.95, 1.0) * rim * 0.08;
  }
#include <opaque_fragment>`);
  };
  return mat;
}

export const MATS = {
  main: withCut(withDetail(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 }), 0.07, false), 'pz-main'),
  ground: withDetail(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 }), 0.16, true),
  // Vitres : sombres et réfléchissantes le jour, éclairées (teinte des sommets) la nuit.
  windows: withCut(new THREE.MeshStandardMaterial({ vertexColors: true, color: 0x3a4a60, roughness: 0.08, metalness: 0.6, emissive: 0xffffff, emissiveIntensity: 0 }), 'pz-windows',
    (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vColor.rgb;'); }),
  // Ampoules et néons : s'allument la nuit.
  glow: withCut(new THREE.MeshBasicMaterial({ vertexColors: true, color: 0x777777 }), 'pz-glow'),
  // Ombres des parties escamotables (le toit escamoté ne fait plus d'ombre à l'intérieur).
  cutDepth: withCut(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), 'pz-cut-depth'),
};

// Matériau pour objets mobiles individuels (personnages, animaux...).
// matière physique avec reflet velouté (peau, tissus) : plus douce et plus réaliste à la lumière rasante
export const actorMaterial = withCut(withRim(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.66, metalness: 0, sheen: 0.4, sheenRoughness: 0.75, sheenColor: new THREE.Color('#fff4ea') })), 'pz-actor');

// Matériau uni (une couleur), même rendu que le décor.
export function solidMaterial(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...opts });
}

export const PALETTE = {
  grass: '#79c25a', grassDark: '#5ea64a', sand: '#f2d59b', sandWet: '#d9b97c', road: '#4a4e5a',
  roadLine: '#f5f1e3', sidewalk: '#c9c3b6', plaza: '#e8d5b5', plazaAlt: '#d9bf98', wood: '#a0703c',
  woodDark: '#6e4a26', leaf: '#4f9a3b', leafAlt: '#6db33f', trunk: '#7a5230', rock: '#9a9a9a',
  water: '#2e9fd6', white: '#ffffff', metal: '#a9b1bd', dark: '#2a2a33', red: '#e23d3d',
  coral: '#ff5a5f', yellow: '#ffd23f', teal: '#2ec4b6', purple: '#5b3fa6',
};
