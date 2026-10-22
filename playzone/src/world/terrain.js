import * as THREE from 'three';
import { groundHeight, WATER_LEVEL, POND, LAKE, MINIGAME_SPOTS, WORLD_BOUNDS } from '../../shared/world-layout.js';
import { MATS, PALETTE } from '../core/materials.js';

// Sol (herbe, sable, terre des champs) avec couleurs par sommet, et eau animée (mer + étang).

function noise(x, z) {
  return Math.sin(x * 0.13 + Math.sin(z * 0.07) * 2) * 0.5 + Math.sin(z * 0.11 + x * 0.05) * 0.5;
}

// Terrain découpé en morceaux : détaillé (5 m) dans la ville d'origine, plus grossier (12 m) ailleurs.
export function buildTerrain() {
  const B = WORLD_BOUNDS, g = new THREE.Group();
  g.name = 'terrain';
  const I = { x0: -945, x1: 945, z0: -1045, z1: 285 };
  const X0 = B.minX - 45, X1 = B.maxX + 45, Z0 = B.minZ - 45, Z1 = B.maxZ + 45;
  const M = { x0: -1896, x1: 1896, z0: -2048, z1: Z1 };   // ancienne grande carte (12 m)
  g.add(terrainPatch(I.x0, I.x1, I.z0, I.z1, 5));
  g.add(terrainPatch(M.x0, M.x1, M.z0, I.z0, 12));        // nord
  g.add(terrainPatch(M.x0, M.x1, I.z1, M.z1, 12));        // sud (mer)
  g.add(terrainPatch(M.x0, I.x0, I.z0, I.z1, 12));        // ouest
  g.add(terrainPatch(I.x1, M.x1, I.z0, I.z1, 12));        // est
  // carte géante (16 m) : massif au nord, désert à l'ouest, côte des Palmiers à l'est
  g.add(terrainPatch(X0, X1, Z0, M.z0, 16));
  g.add(terrainPatch(X0, M.x0, M.z0, Z1, 16));
  g.add(terrainPatch(M.x1, X1, M.z0, Z1, 16));
  return g;
}

function terrainPatch(px0, px1, pz0, pz1, step) {
  const B = WORLD_BOUNDS;
  const sx = px1 - px0, sz = pz1 - pz0;
  const geo = new THREE.PlaneGeometry(sx, sz, Math.max(1, Math.round(sx / step)), Math.max(1, Math.round(sz / step))).rotateX(-Math.PI / 2);
  geo.translate((px0 + px1) / 2, 0, (pz0 + pz1) / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const grass = new THREE.Color(PALETTE.grass), grassDark = new THREE.Color(PALETTE.grassDark);
  const sand = new THREE.Color(PALETTE.sand), wet = new THREE.Color(PALETTE.sandWet);
  const dirt = new THREE.Color('#a47148'), forest = new THREE.Color('#4e8a3e'), path = new THREE.Color('#cdb48a');
  const pen = MINIGAME_SPOTS.chickenRace.pen;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = groundHeight(x, z);
    pos.setY(i, h);
    const n = noise(x, z);
    c.copy(grass).lerp(grassDark, 0.5 + n * 0.5);
    const beachEdge = 64 + Math.sin(x * 0.08) * 2.5;
    // campagne plus verte, quartiers nord légèrement plus jaunes, forêt
    if (x < -136 && z < 56) c.lerp(new THREE.Color('#6fb14d'), 0.4);
    if (z < -340) c.lerp(new THREE.Color('#5fa045'), 0.5 + n * 0.2);
    if (z > beachEdge && !(x > 140 && x < 300)) c.copy(sand).lerp(wet, Math.min(1, Math.max(0, (z - 86) / 6)));
    else if (z > beachEdge - 2 && !(x > 140 && x < 300)) c.lerp(sand, (z - beachEdge + 2) / 2);
    if (x > 140 && x < 300 && z > 56) c.set('#a9a59c');
    if (x < -300 && x > -840 && z < 50 && z > -430 && Math.sin(z * 1.4) > 0.55) c.lerp(new THREE.Color('#3e6b2a'), 0.55); // rangs de vigne
    if (x < -62 && x > -136 && z < -62 && z > -136) c.copy(forest).lerp(grassDark, 0.5 + n * 0.3);
    if (x < -150 && x > -300 && z < -140 && z > -335) c.lerp(new THREE.Color('#8f9a7a'), 0.45); // zone industrielle
    if (x < B.minX - 2 || x > B.maxX + 2) c.copy(sand).lerp(wet, 0.5);
    // champs de la ferme (sillons)
    if (x > -125 && x < -95 && z > 14 && z < 58) c.copy(dirt).lerp(grassDark, Math.sin(x * 2.2) > 0.3 ? 0.55 : 0);
    // enclos à cochons boueux
    if (x > -90 && x < -72 && z > 40 && z < 56) c.copy(dirt).multiplyScalar(0.8);
    // allées du parc
    if (z < -64 && z > -126 && x > -56 && x < 56 && (Math.abs(x) < 3 || Math.abs(z + 78) < 2.5)) c.lerp(path, 0.9);
    // enclos à poulets (terre battue)
    if (Math.abs(x - pen.x) < pen.w / 2 && Math.abs(z - pen.z) < pen.d / 2) c.copy(path).lerp(dirt, 0.3);
    // bords de l'étang
    const dp = Math.hypot(x - POND.x, z - POND.z);
    if (dp < POND.r + 1.5 && dp > 1.6) c.lerp(wet, 0.6);
    // très grande carte : forêt noire, Nordville, aéroport, champs des campagnes, rives du lac
    if (x < -420 && z < -1000 && z > -1900) c.copy(forest).lerp(grassDark, 0.35 + n * 0.25).multiplyScalar(0.85);
    if (Math.abs(x) < 420 && z < -1230 && z > -1570) c.lerp(new THREE.Color('#9fb08a'), 0.45);
    if (x > 900 && x < 1750 && z < -1300 && z > -1750) c.lerp(new THREE.Color('#a7d27f'), 0.5);
    if ((x < -900 || x > 900) && z > -1000 && z < 50) { const f = Math.floor(x / 60) * 7 + Math.floor(z / 45) * 13; const k = ((f % 5) + 5) % 5; if (k === 1) c.set('#c9b458'); else if (k === 2) c.copy(dirt).lerp(grassDark, Math.sin(x * 1.7) > 0.2 ? 0.5 : 0); else if (k === 3) c.set('#8fbf4f'); }
    const dLake = Math.hypot(x - LAKE.x, (z - LAKE.z) * 1.3);
    if (dLake > LAKE.r - 2 && dLake < LAKE.r + 8) c.lerp(sand, 0.6);
    // carte géante : désert ocre et canyons, côte tropicale, alpages, roche et neiges éternelles
    if (x < -1880) { const dn = 0.5 + 0.5 * Math.sin(x * 0.05 + Math.sin(z * 0.03) * 2); c.copy(sand).lerp(new THREE.Color('#d9a066'), 0.35 + dn * 0.3); if (Math.sin(x * 0.011) * Math.sin(z * 0.013) > 0.55) c.lerp(new THREE.Color('#b5523b'), 0.45); }
    if (x > 1880) { c.copy(grass).lerp(new THREE.Color('#3fae5a'), 0.45 + n * 0.2); if (x > 2930) c.copy(sand).lerp(wet, Math.min(1, (x - 2960) / 30)); }
    if (z < -2010 && z > -2960) c.lerp(new THREE.Color('#8fc46a'), 0.35 + n * 0.15);
    if (h > 3) { c.copy(new THREE.Color('#7d7f7d')).lerp(new THREE.Color('#5e6b4f'), Math.max(0, 0.6 - h / 60) + n * 0.1); if (h > 55 + n * 12) c.set('#f4f7fb'); }
    // sous l'eau
    if (h < WATER_LEVEL) c.copy(wet).multiplyScalar(0.85);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, MATS.ground);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

const WATER_VERT = /* glsl */`
uniform float time;
varying vec3 vWorld;
#include <fog_pars_vertex>
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  wp.y += sin(wp.x * 0.15 + time * 1.2) * 0.08 + cos(wp.z * 0.21 + time * 0.9) * 0.08 + sin((wp.x + wp.z) * 0.4 + time * 2.0) * 0.03;
  vWorld = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const WATER_FRAG = /* glsl */`
uniform float time; uniform vec3 deep; uniform vec3 shallow; uniform vec3 foam; uniform float light;
varying vec3 vWorld;
#include <fog_pars_fragment>
// relief de vagues (somme de sinus) : sert à calculer une normale pour les reflets
float hgt(vec2 p) {
  return sin(p.x * 0.35 + time * 1.5 + sin(p.y * 0.25 + time)) * 0.12
       + sin(p.y * 0.52 - time * 1.9 + p.x * 0.17) * 0.08
       + sin((p.x + p.y) * 1.3 + time * 2.6) * 0.025
       + sin((p.x - p.y) * 1.9 - time * 3.1) * 0.018;
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
void main() {
  vec2 p = vWorld.xz;
  float e = 0.15;
  vec3 n = normalize(vec3(hgt(p - vec2(e, 0.0)) - hgt(p + vec2(e, 0.0)), 2.0 * e, hgt(p - vec2(0.0, e)) - hgt(p + vec2(0.0, e))));
  vec3 v = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(dot(n, v), 0.0), 4.0);
  vec3 sky = vec3(0.62, 0.80, 0.95);
  float w = noise(p * 0.05 + time * 0.03);
  vec3 col = mix(deep, shallow, 0.25 + w * 0.35);
  col = mix(col, sky, fres * 0.55);
  vec3 sunDir = normalize(vec3(0.35, 0.8, 0.45));
  float spec = pow(max(dot(reflect(-v, n), sunDir), 0.0), 120.0);
  col += vec3(1.0, 0.97, 0.88) * spec * 1.4 * light;
  // écume : petites crêtes blanches éparses qui bougent avec les vagues
  float fm = noise(p * 0.35 + vec2(time * 0.4, time * 0.25)) * noise(p * 1.1 - vec2(time * 0.3, 0.0));
  col = mix(col, foam, smoothstep(0.55, 0.8, fm) * 0.5);
  gl_FragColor = vec4(col * light, 0.88);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

export function buildWater() {
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    time: { value: 0 }, deep: { value: new THREE.Color('#1f7fbf') }, shallow: { value: new THREE.Color('#4cc3e6') },
    foam: { value: new THREE.Color('#ffffff') }, light: { value: 1 },
  }]);
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: WATER_VERT, fragmentShader: WATER_FRAG, transparent: true, fog: true, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(7400, 5400, 185, 135).rotateX(-Math.PI / 2).translate(0, 0, -1300), mat);
  mesh.position.y = WATER_LEVEL;
  mesh.renderOrder = 1;
  mesh.name = 'water';
  return mesh;
}
