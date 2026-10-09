import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
import {NodeIO, getBounds} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {islands, toWorld} from '../sources/config.js';
import layouts from '../static/models/walk-layout.json' with {type:'json'};
import {CameraRig} from '../sources/core/camera.js';
import {Game} from '../sources/game.js';
import {arrivalFrameRect, arrivalBounds, arrivalOverviewPose, arrivalApproachPose} from '../sources/core/island-arrival-framing.js';

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const viewports = [[1440,900], [1920,1080], [390,844], [844,390]];
const yawError = (a,b) => Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
const poseYaw = pose => {
  const direction = pose.position.clone().sub(pose.target);
  return Math.atan2(direction.x,direction.z);
};
function cameraFor(pose,width,height) {
  const camera = new THREE.PerspectiveCamera(28,width/height,.2,600);
  camera.position.copy(pose.position);
  camera.lookAt(pose.target);
  Game.prototype.updateArrivalAtmosphere.call({arrival:{active:true},cameraRig:pose,scene:{fog:new THREE.Fog('white',145,330)},camera});
  camera.updateMatrixWorld();
  return camera;
}
function corners(bounds) {
  const points = [];
  for (const x of [bounds.min[0],bounds.max[0]])
    for (const y of [bounds.min[1],bounds.max[1]])
      for (const z of [bounds.min[2],bounds.max[2]]) points.push(new THREE.Vector3(x,y,z));
  return points;
}
const fixtures = [];
for (const island of islands) for (const quality of ['high','low']) {
  const file = new URL(`../static/models/${quality==='low'?'low/':''}${island.id}.glb`,import.meta.url);
  const doc = await io.read(fileURLToPath(file));
  const scene = doc.getRoot().getDefaultScene() || doc.getRoot().listScenes()[0];
  const local = getBounds(scene);
  const matrix = new THREE.Matrix4().makeRotationY(island.rotation).setPosition(island.x,0,island.z);
  const world = new THREE.Box3().setFromPoints(corners(local).map(p=>p.applyMatrix4(matrix)));
  const bounds = arrivalBounds(island,world);
  fixtures.push({island,quality,doc,matrix,bounds,layout:layouts.islands.find(i=>i.id===island.id)});
}

for (const fixture of fixtures) for (const [width,height] of viewports) {
  const {island,quality,doc,matrix,bounds} = fixture;
  test(`${island.id} ${quality}: every decoded GLB vertex and shore halo fits ${width}×${height}`,()=>{
    const pose = arrivalOverviewPose(bounds,{width,height,azimuth:island.rotation});
    const camera = cameraFor(pose,width,height), rect = arrivalFrameRect(width,height);
    const point = new THREE.Vector3(), element = [];
    let count = 0;
    const check = world => {
      const clip = world.clone().project(camera);
      const x = (clip.x+1)*width/2, y = (1-clip.y)*height/2;
      assert.ok(x>=rect.left-1e-5 && x<=rect.right+1e-5 && y>=rect.top-1e-5 && y<=rect.bottom+1e-5,
        `${island.id}: clipped asset point ${world.toArray()}`);
      assert.ok(clip.z>=-1 && clip.z<=1,'the actual camera near/far planes contain the island');
      count++;
    };
    for (const node of doc.getRoot().listNodes()) {
      const mesh = node.getMesh();
      if (!mesh) continue;
      const transform = matrix.clone().multiply(new THREE.Matrix4().fromArray(node.getWorldMatrix()));
      for (const primitive of mesh.listPrimitives()) {
        const positions = primitive.getAttribute('POSITION');
        // getElement decodes normalized KHR_mesh_quantization coordinates.
        for (let n=0;n<positions.getCount();n++) check(point.fromArray(positions.getElement(n,element)).applyMatrix4(transform));
      }
    }
    for (const [x,z] of island.shore) check(point.set(x*1.17,-.055,z*1.17).applyMatrix4(matrix));
    assert.ok(count>1000,'inspect actual geometry, not only metadata corners');
    assert.ok(yawError(poseYaw(pose),island.rotation)<1e-12,'overview retains the island walking azimuth');
  });
}

test('both real berths and every walking zoom: approach keeps Jack visible, keeps azimuth, and meets the exact ordinary pose',()=>{
  for (const fixture of fixtures.filter(f=>f.quality==='high')) for (const [width,height] of viewports) {
    const {island,bounds,layout} = fixture;
    assert.equal(layout.berths.length,2);
    for (const berth of layout.berths) for (const walkZoom of [0,1,2]) {
      const {x,y,z} = berth.landing, entry = toWorld(island,x,z,y);
      const position = new THREE.Vector3(entry.x,entry.y,entry.z);
      const rig = new CameraRig(new THREE.PerspectiveCamera(),{walkZoom,reduced:false},width,height);
      rig.update(0,{position,yaw:island.rotation,locomotion:'walking',landAzimuth:island.rotation},true);
      const walking = {position:rig.position.clone(),target:rig.target.clone()};
      const overview = arrivalOverviewPose(bounds,{width,height,azimuth:island.rotation});
      let previous = Infinity;
      for (let step=0;step<=100;step++) {
        const pose = arrivalApproachPose(overview,walking,step/100);
        const clip = position.clone().add(new THREE.Vector3(0,.7,0)).project(cameraFor(pose,width,height));
        assert.ok(yawError(poseYaw(pose),island.rotation)<1e-12,'no azimuth swing');
        assert.ok(pose.distance<=previous+1e-10,'approach moves monotonically toward Jack');
        previous = pose.distance;
        assert.ok(Math.abs(clip.x)<1 && Math.abs(clip.y)<1,'Jack stays on screen throughout approach');
      }
      const finish = arrivalApproachPose(overview,walking,1);
      assert.ok(finish.position.distanceTo(walking.position)<1e-12 && finish.target.distanceTo(walking.target)<1e-12,'no handoff jump');
      const start = arrivalApproachPose(overview,walking,0);
      assert.ok(start.position.equals(overview.position) && start.target.equals(overview.target),'hold is exactly the overview');
    }
  }
});

test('terrain-raised endpoint preserves azimuth, and framing does not mutate cached inputs',()=>{
  for (const {island,bounds} of fixtures.filter(f=>f.quality==='high')) {
    const overview = arrivalOverviewPose(bounds,{width:390,height:844,azimuth:island.rotation});
    const raisedDirection = new THREE.Vector3(Math.sin(island.rotation)*30,20,Math.cos(island.rotation)*30);
    const walking = {target:overview.target.clone(),position:overview.target.clone().add(raisedDirection)};
    const before = JSON.stringify({overview,walking,bounds});
    for (let step=0;step<=100;step++) assert.ok(yawError(poseYaw(arrivalApproachPose(overview,walking,step/100)),island.rotation)<1e-12);
    assert.equal(JSON.stringify({overview,walking,bounds}),before);
    assert.throws(()=>arrivalBounds(island,{min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]}));
  }
});

function entryState(fixture) {
  const {island,layout} = fixture, {x,y,z} = layout.berths[0].landing;
  return {position:toWorld(island,x,z,y),yaw:island.rotation,speed:0,locomotion:'walking',landAzimuth:island.rotation};
}
function assertPose(rig,pose,label) {
  assert.ok(rig.position.distanceTo(pose.position)<1e-9,`${label}: eye`);
  assert.ok(rig.target.distanceTo(pose.target)<1e-9,`${label}: target`);
  assert.ok(rig.camera.position.distanceTo(pose.position)<1e-9,`${label}: rendered eye`);
  assert.ok(Math.abs(rig.distance-pose.position.distanceTo(pose.target))<1e-9,`${label}: distance used by atmosphere`);
}

test('CameraRig applies the full overview on its first update without ordinary follow damping',()=>{
  for (const fixture of fixtures.filter(f=>f.quality==='high')) for (const [width,height] of viewports) {
    const state = entryState(fixture), rig = new CameraRig(new THREE.PerspectiveCamera(),{walkZoom:1},width,height);
    rig.update(0,state,true);
    const overview = arrivalOverviewPose(fixture.bounds,{width,height,azimuth:fixture.island.rotation});
    // Zero delta and snap=false would leave the previous close view unchanged
    // if arrival accidentally went through the normal camera smoothing.
    rig.update(0,{...state,arrival:{bounds:fixture.bounds,progress:0}});
    assertPose(rig,overview,'first overview frame');
    assert.ok(yawError(rig.yaw,fixture.island.rotation)<1e-12);
  }
});

test('CameraRig holds a paused arrival exactly and refits it after portrait resize',()=>{
  for (const fixture of fixtures.filter(f=>f.quality==='high')) {
    const state = entryState(fixture), rig = new CameraRig(new THREE.PerspectiveCamera(),{walkZoom:1},1440,900);
    const arrival = {bounds:fixture.bounds,progress:.43};
    rig.update(0,{...state,arrival},true);
    const held = {position:rig.position.clone(),target:rig.target.clone()};
    for (let frame=0;frame<120;frame++) {
      rig.update(frame%2?1/60:.1,{...state,arrival});
      assertPose(rig,held,'unchanged paused progress');
    }
    rig.resize(390,844);
    const ordinary = new CameraRig(new THREE.PerspectiveCamera(),{walkZoom:1},390,844);
    ordinary.update(0,state,true);
    const overview = arrivalOverviewPose(fixture.bounds,{width:390,height:844,azimuth:fixture.island.rotation});
    const expected = arrivalApproachPose(overview,ordinary,arrival.progress);
    rig.update(0,{...state,arrival});
    assertPose(rig,expected,'resize refit');
    assert.equal(rig.camera.aspect,390/844);
    assert.ok(yawError(rig.yaw,fixture.island.rotation)<1e-12);
  }
});

test('CameraRig hands off all zoom settings to walking without a second ease or stale follow position',()=>{
  for (const fixture of fixtures.filter(f=>f.quality==='high')) for (const [width,height] of viewports) for (const walkZoom of [0,1,2]) {
    const state = entryState(fixture), settings = {walkZoom,reduced:false};
    const rig = new CameraRig(new THREE.PerspectiveCamera(),settings,width,height);
    const ordinary = new CameraRig(new THREE.PerspectiveCamera(),settings,width,height);
    ordinary.update(0,state,true);
    rig.update(1/60,{...state,arrival:{bounds:fixture.bounds,progress:.5}});
    rig.update(1/60,{...state,arrival:{bounds:fixture.bounds,progress:1}});
    assertPose(rig,ordinary,'last arrival frame');
    rig.update(1/60,state);
    assertPose(rig,ordinary,'first ordinary frame');
    const delta = new THREE.Vector3(.08,0,-.05);
    const moved = {...state,position:new THREE.Vector3(state.position.x,state.position.y,state.position.z).add(delta)};
    const expected = {position:ordinary.position.clone().add(delta),target:ordinary.target.clone().add(delta)};
    rig.update(1/60,moved);
    assertPose(rig,expected,'first walking displacement');
    assert.equal(settings.walkZoom,walkZoom,'arrival preserves the chosen zoom');
  }
});

test('CameraRig gives reading focus priority, then resumes the exact retained arrival progress',()=>{
  for (const fixture of fixtures.filter(f=>f.quality==='high')) {
    const state = entryState(fixture), settings = {walkZoom:1};
    const rig = new CameraRig(new THREE.PerspectiveCamera(),settings,390,844);
    const focused = new CameraRig(new THREE.PerspectiveCamera(),settings,390,844);
    const ordinary = new CameraRig(new THREE.PerspectiveCamera(),settings,390,844);
    const arrival = {bounds:fixture.bounds,progress:.6};
    const focus = {x:fixture.island.x,z:fixture.island.z,camera:{distance:32,height:4,azimuth:fixture.island.rotation}};
    focused.update(0,{...state,focus},true);
    rig.update(0,{...state,arrival},true);
    rig.update(0,{...state,focus,arrival},true);
    assert.ok(rig.position.distanceTo(focused.position)<1e-9 && rig.target.distanceTo(focused.target)<1e-9,'arrival never overrides a reading focus');
    ordinary.update(0,state,true);
    const overview = arrivalOverviewPose(fixture.bounds,{width:390,height:844,azimuth:fixture.island.rotation});
    const expected = arrivalApproachPose(overview,ordinary,arrival.progress);
    rig.update(1/60,{...state,arrival});
    assertPose(rig,expected,'resume after reading');
  }
});
