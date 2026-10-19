import * as THREE from 'three';
import { lodGeometry, makeCarMaterial, dimsOf } from './car-models.js';
import { CAR_PAINTS } from '../../shared/content/vehicles.js';
import { BUILDINGS } from '../../shared/world-layout.js';
import { PARKING_SPOTS } from '../world/city-props.js';
import { buildingFrame } from '../world/buildings.js';
import { mulberry32 } from '../../shared/rng.js';

// VOITURES GARÉES (parkings, allées des maisons) : une instance par voiture, un seul appel de dessin
// par modèle. Une voiture garée peut être "prise" (elle devient alors un vrai véhicule conduisible).
const PARKED_MIX = ['citadine', 'citadine', 'berline', 'berline', 'break', 'suv', 'pickup', 'fourgon', 'coupe', 'voiturette', 'sportive', 'citadine', 'berline', 'suv'];

export class ParkedCars {
  constructor(game) {
    this.game = game;
    const rand = mulberry32(31337);
    const spots = [...PARKING_SPOTS.map((s) => ({ ...s }))];
    // allées des maisons (une maison sur trois a sa voiture devant)
    for (const b of BUILDINGS) {
      if (b.kind !== 'house' || rand() > 0.38) continue;
      const F = buildingFrame(b);
      const side = rand() < 0.5 ? -1 : 1;
      const [x, z] = F.L(side * (F.W / 2 + 1.7), F.D / 2 - 2.4);
      spots.push({ x, z, yaw: F.th, lot: `allee-${b.id}`, owner: b.id });
    }
    this.cars = [];
    const byModel = new Map();
    for (const s of spots) {
      if (rand() > 0.72) continue;
      const model = PARKED_MIX[Math.floor(rand() * PARKED_MIX.length)];
      const car = { ...s, model, paint: CAR_PAINTS[Math.floor(rand() * CAR_PAINTS.length)], locked: rand() < 0.65, taken: false };
      this.cars.push(car);
      if (!byModel.has(model)) byModel.set(model, []);
      byModel.get(model).push(car);
    }
    this.meshes = [];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    for (const [model, list] of byModel) {
      const geo = lodGeometry(model).clone();
      const paint = new Float32Array(list.length * 3);
      const c = new THREE.Color();
      list.forEach((car, i) => { c.set(car.paint); paint.set([c.r, c.g, c.b], i * 3); });
      geo.setAttribute('ipaint', new THREE.InstancedBufferAttribute(paint, 3));
      const mesh = new THREE.InstancedMesh(geo, makeCarMaterial({ instanced: true }), list.length);
      list.forEach((car, i) => {
        m.compose(p.set(car.x, 0, car.z), q.setFromAxisAngle(up, car.yaw), one);
        mesh.setMatrixAt(i, m);
        car.mesh = mesh; car.index = i;
        const d = dimsOf(model);
        const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
        car.colliders = [-1, 1].map((k) => game.collision.addCyl(car.x + fx * k * (d.L / 2 - d.W / 2), car.z + fz * k * (d.L / 2 - d.W / 2), d.W / 2, 0, 1.5, { noCamera: true, parked: car }));
      });
      mesh.castShadow = true;
      mesh.receiveShadow = false;
      game.engine.scene.add(mesh);
      this.meshes.push(mesh);
    }
  }

  // Voiture garée la plus proche (non prise).
  nearest(pos, r = 3) {
    let best = null, bd = r;
    for (const c of this.cars) {
      if (c.taken) continue;
      const d = Math.hypot(c.x - pos.x, c.z - pos.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  // La voiture quitte le décor (on la remplace par un vrai véhicule).
  take(car) {
    car.taken = true;
    const m = new THREE.Matrix4().makeScale(0, 0, 0);
    car.mesh.setMatrixAt(car.index, m);
    car.mesh.instanceMatrix.needsUpdate = true;
    for (const c of car.colliders) this.game.collision.remove(c);
    car.colliders = [];
  }

  update() {}
}
