import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import R from '@dimforge/rapier3d-compat/rapier.es.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {islands} from '../sources/config.js';
import {IslandWalkWorld, localToWorld} from '../sources/core/character.js';

const layout = JSON.parse(await fs.readFile(new URL('../static/models/walk-layout.json', import.meta.url))).islands.find(i => i.id === 'experience');
const island = islands.find(i => i.id === 'experience');
await R.init();

async function model(quality) {
  const bytes = await fs.readFile(new URL(`../static/models/${quality === 'low' ? 'low/' : ''}experience.glb`, import.meta.url));
  const scene = (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
  scene.updateMatrixWorld(true);
  return scene;
}

const signedArea = p => p.reduce((sum, a, i) => { const b = p[(i+1)%p.length]; return sum + a[0]*b[1] - b[0]*a[1]; }, 0) / 2;
const ccw = p => signedArea(p) < 0 ? p.toReversed() : p;
const cross = (a,b,p) => (b[0]-a[0])*(p[1]-a[1]) - (b[1]-a[1])*(p[0]-a[0]);
function intersection(subject, boundary, inset = 0) {
  let polygon = subject;
  for (let i = 0; i < boundary.length && polygon.length; i++) {
    const a = boundary[i], b = boundary[(i+1)%boundary.length], next = [], edgeTolerance = inset*Math.hypot(b[0]-a[0],b[1]-a[1]);
    for (let j = 0; j < polygon.length; j++) {
      const p = polygon[j], q = polygon[(j+1)%polygon.length], dp = cross(a,b,p)-edgeTolerance, dq = cross(a,b,q)-edgeTolerance;
      if (dp >= 0) next.push(p);
      if ((dp >= 0) !== (dq >= 0)) { const t = dp / (dp-dq); next.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])]); }
    }
    polygon = next;
  }
  return polygon;
}

// Inspect decoded triangles, including separate meshes/material batches. A ray
// accepting any correct-height hit would also pass with two fighting floors.
function floorFaces(scene, platform) {
  const faces = [], {x,y,z,width,depth} = platform, margin = .03;
  const rectangle = [[x-width/2+margin,z-depth/2+margin],[x+width/2-margin,z-depth/2+margin],[x+width/2-margin,z+depth/2-margin],[x-width/2+margin,z+depth/2-margin]];
  scene.traverse(mesh => {
    if (!mesh.isMesh) return;
    const position = mesh.geometry.attributes.position, index = mesh.geometry.index, count = index?.count ?? position.count;
    // The exporter uses meshopt's 14-bit position grid. Independent points at
    // a terrain T-junction can round to either side of their shared edge; only
    // that decoded grid-sized boundary band is excluded from overlap checks.
    const size = new THREE.Box3().setFromBufferAttribute(position).applyMatrix4(mesh.matrixWorld).getSize(new THREE.Vector3());
    const quantum = position.normalized ? Math.max(size.x,size.y,size.z)/16383 : 1e-6;
    for (let i = 0; i < count; i += 3) {
      const triangle = [0,1,2].map(j => new THREE.Vector3().fromBufferAttribute(position,index ? index.getX(i+j) : i+j).applyMatrix4(mesh.matrixWorld));
      if (!triangle.every(v => Math.abs(v.y-y)<.01)) continue;
      if (new THREE.Triangle(...triangle).getNormal(new THREE.Vector3()).y < .999) continue;
      const polygon = intersection(ccw(triangle.map(v => [v.x,v.z])), rectangle);
      if (polygon.length >= 3 && Math.abs(signedArea(polygon)) > 1e-8) faces.push({polygon,name:mesh.name,quantum});
    }
  });
  return faces;
}

for (const quality of ['high','low']) {
  test(`${quality}: each funicular platform has one visible floor, without coplanar slabs or joint overlays`, async () => {
    const scene = await model(quality);
    for (const station of layout.railway.stations) {
      const p = station.platform, faces = floorFaces(scene,p);
      assert.ok(faces.length > 0, `${station.id}: platform floor is missing`);
      const area = faces.reduce((sum,f) => sum+Math.abs(signedArea(f.polygon)),0), expected = (p.width-.06)*(p.depth-.06);
      assert.ok(Math.abs(area-expected)<.012, `${station.id}: rendered floor area ${area.toFixed(5)} differs from its ${expected.toFixed(5)} m² footprint`);
      for (let i=0; i<faces.length; i++) for (let j=i+1; j<faces.length; j++) {
        const overlap = Math.abs(signedArea(intersection(faces[i].polygon,faces[j].polygon,2*Math.max(faces[i].quantum,faces[j].quantum))));
        assert.ok(overlap<.0002, `${station.id}: ${faces[i].name} overlaps ${faces[j].name} by ${overlap.toFixed(6)} m² at the floor`);
      }
    }
  });

  test(`${quality}: the single rendered platform floor matches exact walking and Rapier support`, async () => {
    const scene = await model(quality), ray = new THREE.Raycaster(), world = new R.World({x:0,y:0,z:0});
    const walk = new IslandWalkWorld(R,world,island,layout);
    world.step();
    try {
      for (const station of layout.railway.stations) {
        const p = station.platform;
        assert.deepEqual(layout.surfaces.find(s => s.id === 'platform-'+station.id),{id:'platform-'+station.id,...p});
        for (const across of [-.35,-.1,.17,.39]) for (const along of [-.39,-.12,.13,.38]) {
          const x = p.x+across*p.width, z = p.z+along*p.depth, point = localToWorld(island,{x,z});
          assert.ok(Math.abs(walk.groundAt(point)-p.y)<1e-6, `${station.id}: walking height changed`);
          const support = world.castRay(new R.Ray({x:point.x,y:p.y+.08,z:point.z},{x:0,y:-1,z:0}),.16,true,undefined,undefined,undefined,undefined,c => walk.colliders.includes(c) && !walk.obstacles.includes(c));
          assert.ok(support && Math.abs(.08-support.timeOfImpact)<.001, `${station.id}: collision floor differs at ${x},${z}`);
          ray.set(new THREE.Vector3(x,p.y+.04,z),new THREE.Vector3(0,-1,0));
          ray.far=.08;
          const rendered=ray.intersectObject(scene,true);
          assert.equal(rendered.length,1, `${station.id}: ${x},${z} has ${rendered.length} visible floor intersections`);
          assert.ok(Math.abs(rendered[0].point.y-p.y)<.0035, `${station.id}: GLB floor does not meet the character's feet`);
        }
      }
    } finally { world.free(); }
  });
}
