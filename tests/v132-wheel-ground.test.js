import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
import R from '@dimforge/rapier3d-compat/rapier.es.js';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {IslandWalkWorld} from '../sources/core/character.js';
import {QuadBikeController, quadGroundPose, quadFootprintClear} from '../sources/core/quad-bike.js';

await R.init();
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const layout = JSON.parse(await fs.readFile(new URL('../static/models/walk-layout.json',import.meta.url))).islands.find(i => i.id === 'projects');
const manifest = JSON.parse(await fs.readFile(new URL('../static/models/quad-bike-manifest.json',import.meta.url)));

async function model(quality) {
  const doc = await io.read(fileURLToPath(new URL(`../static/models/${manifest.variants[quality].file}`,import.meta.url)));
  for (const material of doc.getRoot().listMaterials()) material.setBaseColorTexture(null);
  for (const texture of [...doc.getRoot().listTextures()]) texture.dispose();
  for (const extension of doc.getRoot().listExtensionsUsed()) if (extension.extensionName === 'EXT_meshopt_compression') extension.dispose();
  const data = await io.writeBinary(doc);
  return (await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'')).scene;
}

function tireClearance(wheel,walk) {
  let minimum = Infinity;
  const point = new THREE.Vector3();
  wheel.traverse(mesh => {
    if (!mesh.isMesh) return;
    const positions = mesh.geometry.getAttribute('position');
    for (let n = 0; n < positions.count; n++) {
      point.fromBufferAttribute(positions,n).applyMatrix4(mesh.matrixWorld);
      minimum = Math.min(minimum,point.y-walk.groundAt(point));
    }
  });
  return minimum;
}

for (const quality of ['high','low']) {
  test(`actual ${quality} quad tires contact irregular mountain crests without parked oscillation`, async () => {
    const world = new R.World({x:0,y:0,z:0});
    const walk = new IslandWalkWorld(R,world,{x:0,z:0,rotation:0},layout);
    const start = {x:2.5,z:27,y:.85,yaw:0};
    const bike = new QuadBikeController(R,world,walk,start);
    try {
      bike.setModel(await model(quality),quality);
      assert.equal(bike.wheelPivots.length,4);
      for (const location of [{x:13,z:-7},{x:9,z:-2}]) for (const yaw of [Math.PI/4,Math.PI*5/4]) for (const spin of [0,1.2]) {
        const point = {...location,yaw};
        point.y = quadGroundPose(walk,point,yaw).height;
        assert.ok(quadFootprintClear(walk,point,yaw), 'test uses a genuinely traversable offroad crease');
        bike.teleport(point); bike.wheelAngle = spin; bike.steering = .3;
        bike.updateVisual(1/60,true);
        bike.group.updateMatrixWorld(true);
        const positions = bike.wheelPivots.map(wheel => wheel.getWorldPosition(new THREE.Vector3()));
        for (const wheel of bike.wheelPivots) {
          const clearance = tireClearance(wheel,walk);
          assert.ok(clearance > -.055 && clearance < .055, `${wheel.name} actual mesh clearance ${clearance} at ${location.x},${location.z}, yaw ${yaw}`);
        }
        for (const alpha of [0,.25,.75,1]) {
          bike.updateVisual(1/60,false,alpha);
          bike.group.updateMatrixWorld(true);
          bike.wheelPivots.forEach((wheel,n) => assert.ok(wheel.getWorldPosition(new THREE.Vector3()).distanceTo(positions[n]) < 1e-7, 'a parked wheel correction must be deterministic, not accumulate or bounce'));
        }
      }
    } finally { bike.dispose(); world.free(); }
  });
}
