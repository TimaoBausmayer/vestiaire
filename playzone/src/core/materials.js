import * as THREE from 'three';

// Identité graphique : rendu "semi-réaliste avec une touche cartoon". Matériaux physiques (PBR) éclairés
// par le soleil, le ciel et une carte d'environnement (reflets), couleurs vives portées par les sommets.
// Un seul matériau sert à presque tout le décor et aux personnages : très peu d'appels de dessin.

export const MATS = {
  main: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 }),
  ground: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 }),
  // Vitres : sombres et réfléchissantes le jour, éclairées (teinte des sommets) la nuit.
  windows: windowMaterial(),
  // Ampoules et néons : s'allument la nuit.
  glow: new THREE.MeshBasicMaterial({ vertexColors: true, color: 0x777777 }),
};

function windowMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0x3a4a60, roughness: 0.08, metalness: 0.6, emissive: 0xffffff, emissiveIntensity: 0 });
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vColor.rgb;');
  };
  m.customProgramCacheKey = () => 'pz-windows';
  return m;
}

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
