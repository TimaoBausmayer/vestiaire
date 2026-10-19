import * as THREE from 'three';

// Identité graphique : rendu "cel-shading" en 3 tons (MeshToonMaterial + dégradé en escalier),
// couleurs portées par les sommets. Un seul matériau sert à presque tout le décor et aux personnages.

function makeGradient(steps) {
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((v, i) => { const c = Math.round(v * 255); data.set([c, c, c, 255], i * 4); });
  const tex = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

export const gradientMap = makeGradient([0.42, 0.72, 0.9, 1.0]);

export const MATS = {
  main: new THREE.MeshToonMaterial({ vertexColors: true, gradientMap }),
  ground: new THREE.MeshToonMaterial({ vertexColors: true, gradientMap }),
  // Vitres : sombres le jour, chaudes la nuit (on change seulement la couleur du matériau).
  windows: new THREE.MeshBasicMaterial({ vertexColors: true, color: 0x5d6b8a }),
  // Ampoules et néons : s'allument la nuit.
  glow: new THREE.MeshBasicMaterial({ vertexColors: true, color: 0x777777 }),
};

// Matériau pour objets mobiles individuels (personnages, animaux...).
export const actorMaterial = MATS.main;

export function toonColor(color) {
  return new THREE.MeshToonMaterial({ color, gradientMap });
}

export const PALETTE = {
  grass: '#79c25a', grassDark: '#5ea64a', sand: '#f2d59b', sandWet: '#d9b97c', road: '#4a4e5a',
  roadLine: '#f5f1e3', sidewalk: '#c9c3b6', plaza: '#e8d5b5', plazaAlt: '#d9bf98', wood: '#a0703c',
  woodDark: '#6e4a26', leaf: '#4f9a3b', leafAlt: '#6db33f', trunk: '#7a5230', rock: '#9a9a9a',
  water: '#2e9fd6', white: '#ffffff', metal: '#a9b1bd', dark: '#2a2a33', red: '#e23d3d',
  coral: '#ff5a5f', yellow: '#ffd23f', teal: '#2ec4b6', purple: '#5b3fa6',
};
