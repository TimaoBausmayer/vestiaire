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

export const MATS = {
  main: withCut(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 }), 'pz-main'),
  ground: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 }),
  // Vitres : sombres et réfléchissantes le jour, éclairées (teinte des sommets) la nuit.
  windows: withCut(new THREE.MeshStandardMaterial({ vertexColors: true, color: 0x3a4a60, roughness: 0.08, metalness: 0.6, emissive: 0xffffff, emissiveIntensity: 0 }), 'pz-windows',
    (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vColor.rgb;'); }),
  // Ampoules et néons : s'allument la nuit.
  glow: withCut(new THREE.MeshBasicMaterial({ vertexColors: true, color: 0x777777 }), 'pz-glow'),
  // Ombres des parties escamotables (le toit escamoté ne fait plus d'ombre à l'intérieur).
  cutDepth: withCut(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), 'pz-cut-depth'),
};

// Matériau pour objets mobiles individuels (personnages, animaux...).
export const actorMaterial = MATS.main;

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
