import * as THREE from 'three';
import { StaticBuilder, buildMergedGeometry } from '../core/static-builder.js';
import { MATS, actorMaterial } from '../core/materials.js';
import { buildTerrain, buildWater } from './terrain.js';
import { buildBuildings } from './buildings.js';
import { buildProps } from './props.js';
import { buildRoads } from './roads.js';
import { buildCityProps } from './city-props.js';
import { buildExpansionProps, buildGiantProps } from './expansion-props.js';
import { SignAtlas } from './signs.js';
import { DayNight } from './daynight.js';
import { mulberry32 } from '../../shared/rng.js';

const _box = new THREE.Box3(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3();

// Assemble le monde : terrain, eau, bâtiments, décor fusionné, éléments animés (grande roue, nuages).

export class World {
  constructor(engine, collision) {
    this.engine = engine;
    this.collision = collision;
    this.scene = engine.scene;
    this.animated = [];
    this.contributors = []; // modules qui ajoutent du décor statique (mini-jeux, saisons...)
    this.actorMaterial = actorMaterial;
    this._cullT = 0;
  }

  addContributor(fn) { this.contributors.push(fn); }

  build() {
    const { scene, collision } = this;
    this.terrain = buildTerrain();
    scene.add(this.terrain);
    this.water = buildWater();
    scene.add(this.water);

    const sb = new StaticBuilder(64);
    const atlas = new SignAtlas();
    buildBuildings(sb, collision, atlas);
    this.trafficLights = buildRoads(sb, collision, scene);
    buildProps(sb, collision, scene);
    buildCityProps(sb, collision, scene, this);
    buildExpansionProps(sb, collision);
    buildGiantProps(sb, collision);
    for (const fn of this.contributors) fn(sb, collision, scene);
    this.static = sb.build(MATS, { shadows: true });
    scene.add(this.static);
    this.signs = atlas.build();
    scene.add(this.signs);

    this.buildFerrisWheel();
    this.buildClouds();
    this.dayNight = new DayNight(this.engine, this.water);
  }

  buildFerrisWheel() {
    const geo = buildMergedGeometry((sb) => {
      const R = 9;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        sb.add(SHAPES_BOX, { x: Math.cos(a) * R / 2, y: Math.sin(a) * R / 2 - 0.1, z: 0, sx: R, sy: 0.2, sz: 0.2, rz: a, color: '#ffffff' });
        sb.add(SHAPES_BOX, { x: Math.cos(a) * R, y: Math.sin(a) * R - 0.1, z: 0, sx: 0.25, sy: 0.25, sz: 3.6, color: '#ff5a5f' });
      }
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        sb.add(SHAPES_BOX, { x: Math.cos(a) * R, y: Math.sin(a) * R - 0.15, z: 1.7, sx: 1.3, sy: 0.3, sz: 0.3, rz: a + Math.PI / 2, color: '#ffd23f' });
        sb.add(SHAPES_BOX, { x: Math.cos(a) * R, y: Math.sin(a) * R - 0.15, z: -1.7, sx: 1.3, sy: 0.3, sz: 0.3, rz: a + Math.PI / 2, color: '#ffd23f' });
      }
    });
    const wheel = new THREE.Mesh(geo, actorMaterial);
    wheel.position.set(-50, 12, -110);
    wheel.rotation.y = Math.PI / 2;
    wheel.castShadow = true;
    this.scene.add(wheel);
    // nacelles qui restent à l'horizontale
    const cabins = [];
    const colors = ['#2ec4b6', '#ff9f1c', '#c77dff', '#ff5a5f'];
    for (let i = 0; i < 8; i++) {
      const g = buildMergedGeometry((sb) => {
        sb.box(0, -1.6, 0, 1.6, 1.3, 1.4, colors[i % 4]);
        sb.box(0, -0.3, 0, 1.8, 0.15, 1.6, '#ffffff');
        sb.box(0, -0.3, 0, 0.1, 0.4, 0.1, '#888');
      });
      const m = new THREE.Mesh(g, actorMaterial);
      this.scene.add(m);
      cabins.push(m);
    }
    this.animated.push((dt, t) => {
      const a0 = t * 0.12;
      wheel.rotation.z = a0;
      cabins.forEach((m, i) => {
        const a = a0 + (i / 8) * Math.PI * 2;
        m.position.set(-50, 12 + Math.sin(a) * 9, -110 - Math.cos(a) * 9);
      });
    });
  }

  buildClouds() {
    const rand = mulberry32(99);
    const group = new THREE.Group();
    this.cloudMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.92, fog: false });
    for (let i = 0; i < 14; i++) {
      const g = buildMergedGeometry((sb) => {
        const n = 3 + Math.floor(rand() * 4);
        for (let k = 0; k < n; k++) sb.blob((k - n / 2) * 3.2, rand() * 1.5, (rand() - 0.5) * 3, 3 + rand() * 2.5, '#ffffff', 0.7);
      });
      const m = new THREE.Mesh(g, this.cloudMat);
      m.position.set(-250 + rand() * 500, 70 + rand() * 25, -250 + rand() * 450);
      m.userData.speed = 1.5 + rand() * 2;
      group.add(m);
    }
    this.clouds = group;
    this.scene.add(group);
    this.animated.push((dt) => {
      for (const c of group.children) {
        c.position.x += c.userData.speed * dt;
        if (c.position.x > 260) c.position.x = -260;
      }
    });
  }

  // Les morceaux de décor trop loin (au-delà du brouillard) ne sont pas dessinés du tout.
  cull(camPos) {
    const far = this.engine.scene.fog.far + 30;
    for (const m of this.static.children) {
      const bs = m.geometry.boundingSphere;
      m.visible = camPos.distanceTo(bs.center) - bs.radius < far;
    }
    // grands ensembles animés (domaine skiable, stade, parcours de course) : chaque élément est masqué
    // au-delà du brouillard (rayon estimé une fois, position suivie pour les objets mobiles)
    for (const root of this.scene.children) {
      if (root.name !== 'ski' && root.name !== 'stade' && root.name !== 'courses') continue;
      for (const c of root.children) {
        if (c.userData.cullR === undefined) {
          const box = _box.setFromObject(c);
          c.userData.cullR = box.isEmpty() ? 0 : box.getSize(_v).length() / 2;
          c.userData.cullC = box.isEmpty() ? null : box.getCenter(new THREE.Vector3()).sub(c.getWorldPosition(_v2));
          c.userData.cullOn = c.visible;
        }
        if (!c.userData.cullC) continue;
        if (c.visible !== c.userData.cullShown) c.userData.cullOn = c.visible;   // visibilité changée par le jeu
        if (!c.userData.cullOn) continue;
        c.getWorldPosition(_v2).add(c.userData.cullC);
        c.visible = c.userData.cullShown = camPos.distanceTo(_v2) - c.userData.cullR < far;
      }
    }
  }

  update(dt, t, nowMs) {
    this._cullT -= dt;
    if (this._cullT <= 0) { this._cullT = 0.25; this.cull(this.engine.camera.position); }
    this.water.material.uniforms.time.value = t;
    for (const fn of this.animated) fn(dt, t);
    this.dayNight.update(nowMs);
    const n = this.dayNight.night;
    this.cloudMat.color.setScalar(1 - n * 0.65);
  }
}

import { SHAPES } from '../core/static-builder.js';
const SHAPES_BOX = SHAPES.box();
