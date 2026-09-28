import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import R from '@dimforge/rapier3d-compat/rapier.es.js';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Raycaster, Vector3} from 'three';
import {islands} from '../sources/config.js';
import {IslandWalkWorld, localToWorld} from '../sources/core/character.js';
import {QuadBikeController, quadFootprintClear, quadGroundPose} from '../sources/core/quad-bike.js';
import {selectLandExhibit} from '../sources/core/project-exhibits.js';

const layout = JSON.parse(fs.readFileSync(new URL('../static/models/walk-layout.json', import.meta.url))).islands.find(i => i.id === 'projects');
const island = islands.find(i => i.id === 'projects');
const DT = 1 / 60;
await R.init();
await MeshoptDecoder.ready;

function fixture() {
  const world = new R.World({x:0,y:0,z:0});
  world.timestep = DT;
  const walk = new IslandWalkWorld(R, world, island, layout);
  world.propagateModifiedBodyPositionsToColliders();
  world.updateSceneQueries();
  return {world, walk, dispose:() => world.free()};
}

function roadSamples(road, offsets, visit) {
  for (let n = 1; n < road.points.length; n++) {
    const a = road.points[n - 1], b = road.points[n];
    const dx = b[0] - a[0], dz = b[2] - a[2], length = Math.hypot(dx, dz);
    const count = Math.max(1, Math.ceil(length / .3));
    const yaw = island.rotation + Math.atan2(-dx, -dz);
    for (let j = 0; j <= count; j++) for (const offset of offsets) {
      const x = a[0] + dx * j / count + dz / length * offset;
      const z = a[2] + dz * j / count - dx / length * offset;
      visit(localToWorld(island, {x,z}), yaw, `${road.id} segment ${n}, offset ${offset}, point ${j}/${count}`);
    }
  }
}

test('Projects has a genuinely elevated continuous circuit, three numbered complete-project entries and harbor shortcuts', () => {
  assert.ok(layout.terrain.indices.length > 3000, 'the walking terrain is a real indexed surface');
  assert.equal(layout.width, 5);
  assert.ok(layout.routeLength >= 160 && layout.routeLength <= 190, 'dock-to-loop scenic route keeps the planned scale');
  const ring = layout.roads.find(r => r.id === 'highlands-loop');
  assert.equal(ring.closed, true);
  assert.equal(ring.width, 5);
  assert.ok(Math.hypot(ring.points[0][0] - ring.points.at(-1)[0], ring.points[0][2] - ring.points.at(-1)[2]) < .001);
  assert.ok(Math.max(...ring.points.map(p => p[1])) - Math.min(...ring.points.map(p => p[1])) > 5, 'loop actually climbs toward Research');
  const entries = layout.stations.filter(s => s.primary);
  assert.deepEqual(entries.map(s => s.contentId), ['affirmation','research','catering']);
  assert.deepEqual(entries.map(s => s.number), ['01','02','03']);
  for (const station of entries) {
    assert.equal(station.type, 'read'); assert.equal(station.readFull, true);
    assert.ok(station.hitArea.width >= 2.6 && station.hitArea.height >= 1.8, 'whole kiosk face is clickable');
  }
  assert.deepEqual(layout.stations.filter(s => s.directory && s.readFull).map(s => s.contentId), entries.map(s => s.contentId));
});

test('the entire five-metre drivable road has <=12 degree terrain and unobstructed full quad footprints in both directions', () => {
  const f = fixture();
  try {
    for (const road of layout.roads.filter(r => r.kind !== 'footpath')) {
      assert.equal(road.width, 5);
      roadSamples(road, [-2.5,-2,-1,0,1,2,2.5], (p, yaw, where) => {
        assert.ok(f.walk.contains(p, .01), `${where}: visible road remains on the island`);
        assert.ok(f.walk.clear(p, 0), `${where}: solid object narrows the road`);
        assert.ok(f.walk.groundSample(p).slope <= Math.PI / 15 + 1e-4, `${where}: road cross-slope exceeds 12 degrees`);
      });
      // ±1.7 leaves the full 1.28m-wide chassis and its safety margin inside 5m.
      roadSamples(road, [-1.7,0,1.7], (p, yaw, where) => {
        assert.ok(quadFootprintClear(f.walk, p, yaw), `${where}: outbound full chassis clearance`);
        assert.ok(quadFootprintClear(f.walk, p, yaw + Math.PI), `${where}: inbound full chassis clearance`);
      });
    }
  } finally { f.dispose(); }
});

test('actual primary exhibit aprons permit riding, direct full-story selection and a safe grounded dismount', () => {
  const f = fixture();
  try {
    const actions = layout.stations.map(station => {
      const position = localToWorld(island, station);
      return {id:station.id,station,kind:station.type,position,distance:p => Math.hypot(p.x-position.x,p.z-position.z)};
    });
    for (const action of actions.filter(a => a.station.primary)) {
      const p = {...action.position,yaw:island.rotation};
      assert.ok(Math.abs(f.walk.groundAt(p) - p.y) < .06, `${action.id}: station is on actual terrain`);
      p.y = quadGroundPose(f.walk, p, p.yaw).height;
      assert.ok(quadFootprintClear(f.walk, p, p.yaw), `${action.id}: vehicle fits the reading apron`);
      const visible = a => f.walk.visible(p, a.position);
      assert.equal(selectLandExhibit(actions,p,{riding:true,visible}),action, `${action.id}: F reads the intended full project`);
      assert.equal(selectLandExhibit(actions,p,{visible}),action, `${action.id}: E reads the same project on foot`);
      const bike = new QuadBikeController(R,f.world,f.walk,p);
      const landing = bike.dismountPoint();
      assert.ok(landing, `${action.id}: a safe dismount exists`);
      assert.ok(f.walk.clear(landing,.24) && f.walk.safeGround(landing,.24,Math.PI/15));
      assert.ok(Math.abs(landing.y-p.y)<=.25);
      assert.ok(Math.abs(landing.y-f.walk.groundAt(landing))<1e-7);
      bike.dispose();
    }
  } finally { f.dispose(); }
});

test('shipped terrain collider agrees with actual ground queries around the complete mountain circuit', () => {
  const f = fixture();
  try {
    const ring = layout.roads.find(r => r.id === 'highlands-loop');
    for (let n=0;n<ring.points.length;n+=8) {
      const [x,,z]=ring.points[n],p=localToWorld(island,{x,z});
      const hit=f.world.castRay(new R.Ray({x:p.x,y:20,z:p.z},{x:0,y:-1,z:0}),30,true,undefined,undefined,undefined,undefined,c=>c.handle===f.walk.terrainCollider.handle);
      assert.ok(hit,`terrain ray hit at road point ${n}`);
      assert.ok(Math.abs(20-hit.timeOfImpact-f.walk.groundAt(p))<.003,`collider/height disagreement at ${n}`);
    }
  } finally { f.dispose(); }
});

for (const reversed of [false,true]) test(`actual quad completes the mountain circuit ${reversed?'clockwise':'counterclockwise'} without a rescue`, () => {
  const f=fixture(); let bike;
  try {
    const points=[...layout.roads.find(r=>r.id==='highlands-loop').points];
    if(reversed)points.reverse();
    const route=points.map(([x,y,z])=>localToWorld(island,{x,y,z}));
    const spawn={...route[0],yaw:Math.atan2(route[0].x-route[1].x,route[0].z-route[1].z)};
    spawn.y=quadGroundPose(f.walk,spawn,spawn.yaw).height;
    bike=new QuadBikeController(R,f.world,f.walk,spawn);bike.park(false);
    let rescues=0,index=1,steps=0,previous={...bike.position},highest=previous.y;
    const teleport=bike.teleport.bind(bike);bike.teleport=(...args)=>{rescues++;return teleport(...args);};
    // Drive with ordinary throttle/steering, without rewriting pose or velocity.
    // The modest target speed accommodates bends while visiting every road waypoint.
    for(;steps<3600&&index<route.length;steps++) {
      const p=bike.position;
      while(index<route.length&&Math.hypot(route[index].x-p.x,route[index].z-p.z)<1.5)index++;
      if(index>=route.length)break;
      const target=route[Math.min(index+4,route.length-1)];
      const heading=Math.atan2(p.x-target.x,p.z-target.z);
      const turn=Math.atan2(Math.sin(heading-bike.yaw),Math.cos(heading-bike.yaw));
      bike.step({throttle:bike.speed<5.8?1:0,steer:Math.max(-1,Math.min(1,turn*2.5))},DT);
      f.world.step();bike.afterStep();
      const next=bike.position;
      assert.ok(Math.hypot(next.x-previous.x,next.y-previous.y,next.z-previous.z)<.15,'no collision teleport or abrupt vertical jump');
      assert.ok(Math.abs(next.y-quadGroundPose(f.walk,next,bike.yaw).height)<.003,'four-wheel support stays on the mountain');
      highest=Math.max(highest,next.y);previous={...next};
    }
    assert.equal(index,route.length,`quad stalled before completing the loop at waypoint ${index}`);
    assert.equal(rescues,0,'mountain driving must not rely on safety teleports');
    assert.ok(highest>6.4,'drive actually reached the Research summit');
    assert.ok(Math.hypot(bike.position.x-spawn.x,bike.position.z-spawn.z)<1.6,'complete circuit returns to its starting approach');
  } finally { bike?.dispose();f.dispose(); }
});

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
for (const [quality,relative,budget] of [['high','projects.glb',1_500_000],['low','low/projects.glb',1_000_000]]) {
  test(`${quality}: shipped Projects GLB fits its budget and visibly retains all elevated platforms and terrain`, async () => {
    const url=new URL('../static/models/'+relative,import.meta.url);
    assert.ok(fs.statSync(url).size<=budget,`${quality} asset exceeds ${budget} bytes`);
    const document=await io.read(fileURLToPath(url));
    for(const district of layout.districts) {
      const node=document.getRoot().listNodes().find(n=>n.getName()==='district_'+district.id);
      assert.ok(node,`${district.id} platform has a named district in ${quality}`);
      assert.ok(Math.abs(node.getTranslation()[1]-district.y)<1e-6,`${district.id} model/platform height mismatch`);
    }
    for(const station of layout.stations.filter(s=>s.primary))assert.ok(document.getRoot().listNodes().some(n=>n.getName()==='station_'+station.id),`${station.id} full kiosk stays available in ${quality}`);
    // Strip textures only for this headless geometry inspection; the shipped file is untouched.
    for(const material of document.getRoot().listMaterials()) {
      material.setBaseColorTexture(null); material.setNormalTexture(null); material.setMetallicRoughnessTexture(null); material.setOcclusionTexture(null); material.setEmissiveTexture(null);
    }
    for(const texture of [...document.getRoot().listTextures()])texture.dispose();
    for(const extension of [...document.getRoot().listExtensionsUsed()])if(extension.extensionName==='EXT_meshopt_compression')extension.dispose();
    const data=await io.writeBinary(document);
    const gltf=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
    gltf.scene.updateMatrixWorld(true);
    const ray=new Raycaster(),ring=layout.roads.find(r=>r.id==='highlands-loop');
    for(let n=0;n<ring.points.length;n+=16) {
      const [x,y,z]=ring.points[n];ray.set(new Vector3(x,20,z),new Vector3(0,-1,0));
      const hits=ray.intersectObject(gltf.scene,true);
      assert.ok(hits.some(hit=>Math.abs(hit.point.y-y)<.075),`${quality} visible road/terrain meets collision height at ${n}`);
    }
  });
}
