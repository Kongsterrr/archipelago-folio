import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import R from '@dimforge/rapier3d-compat/rapier.es.js';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {islands, toWorld} from '../sources/config.js';
import {CharacterController, IslandWalkWorld, localToWorld, SEA_GROUP} from '../sources/core/character.js';
import {createIslandColliders} from '../sources/core/collisions.js';
import {campusStationFocus} from '../sources/core/campus-focus.js';
import {CameraRig} from '../sources/core/camera.js';
import {campusReadingRect} from '../sources/core/focus-framing.js';
import {exhibitTarget} from '../sources/core/portfolio-navigation.js';
import {exhibitReadLabel, selectLandExhibit} from '../sources/core/project-exhibits.js';
import {IslandController} from '../sources/world/island.js';
import {applySunsetMaterials, releaseSunsetMaterials} from '../sources/world/sunset-materials.js';
import {sampleTrainPath} from '../sources/core/train-path.js';
import {CareerTrainController,CAREER_TRAIN} from '../sources/core/career-train.js';

const json = async path => JSON.parse(await fs.readFile(new URL(path, import.meta.url), 'utf8'));
const layout = (await json('../static/models/walk-layout.json')).islands.find(i => i.id === 'experience');
const manifests = {high:await json('../static/models/manifest.json'), low:await json('../static/models/low/manifest.json')};
const metadata = quality => manifests[quality].models.find(m => m.id === 'experience');
const island = islands.find(i => i.id === 'experience');
const content = await json('../sources/content.json');
const STEP = 1 / 60;
const companyIds = ['amtrak', 'beaconfire', 'visionx'];
const originalShore = [[-3.84,28.8],[-17.9712,27.936],[-29.5776,23.328],[-35.568,14.688],[-37.44,1.44],[-35.1936,-13.536],[-26.5824,-24.192],[-10.8576,-28.8],[7.1136,-28.224],[22.464,-25.344],[33.3216,-18.432],[37.44,-3.744],[36.3168,12.096],[28.8288,23.328],[14.976,27.648],[3.84,28.8]];
await R.init();

async function model(quality) {
  const bytes = await fs.readFile(new URL(`../static/models/${quality === 'low' ? 'low/' : ''}experience.glb`, import.meta.url));
  const scene = (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
  scene.updateMatrixWorld(true);
  return scene;
}

function physicsFixture(berth = layout.berths[0]) {
  const world = new R.World({x:0,y:0,z:0});
  world.timestep = STEP;
  createIslandColliders(R, world, island);
  world.forEachCollider(collider => collider.setCollisionGroups(SEA_GROUP));
  const walk = new IslandWalkWorld(R, world, island, layout);
  const actor = new CharacterController(R, world);
  actor.teleport(localToWorld(island, berth.landing), walk);
  actor.enable(true);
  world.step();
  let rescues = 0;
  const teleport = actor.teleport.bind(actor);
  actor.teleport = (...args) => { rescues++; return teleport(...args); };
  return {world, walk, actor, get rescues() { return rescues; }};
}

function traverse(fixture, route) {
  let highest = fixture.actor.position.y;
  for (const [x,z] of route) {
    const target = localToWorld(island, {x,z});
    const distance = Math.hypot(fixture.actor.position.x - target.x, fixture.actor.position.z - target.z);
    let reached = false;
    for (let frame = 0; frame < Math.ceil((distance / 2.4 + 4) / STEP); frame++) {
      const before = fixture.actor.position, dx = target.x - before.x, dz = target.z - before.z, d = Math.hypot(dx,dz);
      if (d < .085) { reached = true; break; }
      const scale = Math.min(1, d / (2.4 * STEP));
      fixture.actor.step({x:dx/d*scale,z:dz/d*scale}, STEP);
      fixture.world.step();
      fixture.actor.afterStep();
      const after = fixture.actor.position;
      assert.ok(Math.abs(after.y - fixture.walk.groundAt(after)) < .18, `feet leave the tread approaching ${x},${z}: feet=${after.y.toFixed(5)}, support=${fixture.walk.groundAt(after).toFixed(5)}, world=${after.x.toFixed(5)},${after.z.toFixed(5)}`);
      assert.ok(Math.hypot(after.x-before.x, after.z-before.z) < .08 && Math.abs(after.y-before.y)<.18, `abrupt step approaching ${x},${z}`);
      highest = Math.max(highest, after.y);
    }
    assert.ok(reached, `real character cannot reach ${x},${z}; world position=${JSON.stringify(fixture.actor.position)}`);
  }
  return highest;
}

test('Career Railway modestly extends the rear coast while preserving the harbor, pier and both boat berths', () => {
  assert.equal(layout.shore.length,originalShore.length,'the shoreline keeps its existing coastal silhouette');
  for(const [index,point]of originalShore.entries())if(point[1]>=0)assert.deepEqual(layout.shore[index],point,'the front coast and existing dock connection stay fixed');
  assert.deepEqual(layout.dock, {width:4,deckY:.85,startZ:27.499999999999996,endZ:38});
  assert.deepEqual(layout.berths, [-1,1].map(side => ({boat:{x:side*4.3,z:35.55,yaw:Math.PI},landing:{x:side*.5,z:35.5,y:.85,yaw:Math.PI}})));
  const shore = metadata('high').shorePolygon;
  assert.equal(Math.max(...shore.map(p => p[0])) - Math.min(...shore.map(p => p[0])), 78);
  assert.equal(Math.max(...shore.map(p => p[1])) - Math.min(...shore.map(p => p[1])), 62);
  assert.ok(Math.min(...layout.shore.map(p=>p[1]))>=-32,'walkable shore remains inside the modest rear extension');
});

test('high and low Experience exports share scene contracts and meet compressed byte budgets', async () => {
  const high = metadata('high'), low = metadata('low');
  assert.match(high.revision, /^v23-/);
  assert.equal(low.revision, high.revision);
  assert.equal(manifests.high.walkLayout, manifests.low.walkLayout);
  for (const key of ['dock','shorePolygon','districts','occluders']) assert.deepEqual(high[key], low[key], key);
  assert.deepEqual(high.districts, layout.districts);
  assert.deepEqual(high.animationNodes.map(n => [n.name,n.position,n.rotation,n.scale]), low.animationNodes.map(n => [n.name,n.position,n.rotation,n.scale]));
  for (const [quality,budget] of [['high',2_000_000],['low',1_200_000]]) {
    const size = (await fs.stat(new URL(`../static/models/${quality === 'low' ? 'low/' : ''}experience.glb`, import.meta.url))).size;
    assert.equal(metadata(quality).bytes, size);
    assert.ok(size <= budget, `${quality}: ${size} bytes exceeds ${budget}`);
  }
  assert.ok(low.triangles < high.triangles, 'low quality retains a lower geometry cost');
});

test('one harbor directory and each company entry read the complete corresponding experience', () => {
  const primaries = layout.stations.filter(station => station.primary);
  assert.deepEqual(primaries.map(station => station.contentId).sort(), [...companyIds].sort());
  const fullReads = layout.stations.filter(station => station.readFull&&!station.directoryOverview);
  assert.ok(primaries.every(station => station.readFull), 'all three company entrances open the complete experience');
  for (const id of companyIds) assert.ok(fullReads.some(station => station.contentId === id && !station.primary), `${id}: company entry is readable`);
  for (const station of fullReads) {
    assert.equal(station.type, 'read');
    assert.equal(station.readLabel, 'View experience');
    assert.ok(station.hitArea?.width > 1 && station.hitArea?.height > .5, `${station.id}: full face has a pointer target`);
    assert.equal(exhibitReadLabel({station}), 'View experience');
    const target = exhibitTarget(station, 'experience', content, islands);
    assert.equal(target.entry.id, station.contentId);
    assert.equal(target.island.id, 'experience');
  }
  const harbor = fullReads.filter(station => station.directory);
  assert.equal(harbor.length, 3, 'the compact harbor directory retains three direct story links');
  assert.equal(layout.stations.filter(station=>station.directoryOverview).length,1,'one shared directory owns the harbor keyboard action');
  const overview=layout.stations.find(station=>station.directoryOverview);
  assert.equal(overview.contentId,'experience');
  assert.equal(exhibitReadLabel({station:overview}),overview.readLabel);
  assert.match(overview.readLabel,/experience/i,'the overview action identifies this island');
  assert.equal(exhibitTarget(overview,'experience',content,islands).island.id,'experience');
  assert.ok(Math.max(...harbor.map(station=>station.x))-Math.min(...harbor.map(station=>station.x)) < 6, 'the links belong to one compact directory');
  for (const station of harbor) assert.ok(station.z >= 20 && Math.abs(station.y-layout.groundY)<.01, 'directory remains accessible before any ramp');
});

test('all Experience reading, action and bench approaches are clear and correctly grounded', () => {
  const f = physicsFixture();
  try {
    const actions = layout.stations.map(station => {
      const position = localToWorld(island, station);
      return {id:station.id,station,kind:station.type,position,distance:p => Math.hypot(p.x-position.x,p.z-position.z)};
    });
    for (const action of actions) {
      assert.ok(f.walk.clear(action.position, .24), `${action.id}: capsule approach is blocked`);
      assert.ok(Math.abs(action.position.y - f.walk.groundAt(action.position)) < .035, `${action.id}: interaction floats above its support`);
      if (action.station.readFull&&!action.station.directory || action.station.directoryOverview) assert.equal(selectLandExhibit(actions, action.position, {visible:candidate => f.walk.visible(action.position,candidate.position)}), action, `${action.id}: E selects its own complete experience or shared directory`);
    }
    assert.ok(layout.benches.length >= 3);
    for (const bench of layout.benches) {
      const approach = localToWorld(island, bench.approach);
      assert.ok(f.walk.clear(approach, .24), `${bench.id}: seated approach is blocked`);
      assert.ok(Math.abs(approach.y-f.walk.groundAt(approach)) < .035, `${bench.id}: approach floats`);
    }
    for (const berth of layout.berths) {
      const position = localToWorld(island, berth.boat);
      assert.equal(f.world.intersectionWithShape({x:position.x,y:.35,z:position.z},{x:0,y:Math.sin(position.yaw/2),z:0,w:Math.cos(position.yaw/2)},new R.Cuboid(.85,.7,2.1),undefined,SEA_GROUP), null, 'existing sea berth stays clear');
    }
  } finally { f.world.free(); }
});

for (const [index,berth] of layout.berths.entries()) test(`Experience berth ${index+1}: real Rapier character completes the entire elevated tour and returns without a rescue`, () => {
  const f = physicsFixture(berth);
  try {
    assert.ok(layout.route.length > 1, 'a continuous tour is exported');
    const highest = traverse(f, [...layout.route,[berth.landing.x,berth.landing.z]]);
    assert.ok(highest >= Math.max(...layout.interiors.map(interior => interior.floorY)) - .08, 'the route reaches every terrace level');
    assert.equal(f.rescues, 0, 'the route must not rely on a safety teleport');
    assert.ok(Math.abs(f.actor.position.y-layout.groundY) < .035, 'visitor returns to the harbor level');
  } finally { f.world.free(); }
});

test('an alternate harbor approach cannot sink the Rapier character into the broad Amtrak floor on the return walk', () => {
  const f = physicsFixture(layout.berths[0]);
  try {
    // This approach leaves a small lateral offset that previously made Rapier
    // miss one downward sweep on the flat station floor, then recover slowly.
    const route = [[0,35.5],[0,30.5],[.6,30.5],[0,30.5],...layout.route,...layout.route.slice(0,-1).reverse(),[0,30.5],[0,35.5]];
    traverse(f,route);
    assert.equal(f.rescues,0,'floor support must remain continuous without a safety teleport');
  } finally { f.world.free(); }
});

for (const ramp of (layout.ramps || layout.surfaces.filter(surface=>surface.slope)).filter(surface=>Math.abs(surface.slope)>1e-6&&surface.depth>1)) {
  for (const fromBelow of [false,true]) test(`${ramp.id}: real Rapier ${fromBelow?'wrong-side approaches cannot enter beneath the ramp':'sideways walking cannot leave through gaps between railing posts'}`, () => {
    const f=physicsFixture();
    try {
      const rotation=ramp.rotation||0, yaw=rotation+island.rotation;
      let approaches=0;const lowerTerrainClearances=[];
      for (const side of [-1,1]) for (const gap of [-.375,-.125,.125,.375]) {
        const along=ramp.depth*gap, across=side*(ramp.width/2+(fromBelow?.6:-.55));
        const center=localToWorld(island,{x:ramp.x+along*Math.sin(rotation),z:ramp.z+along*Math.cos(rotation)});
        const start=localToWorld(island,{x:ramp.x+across*Math.cos(rotation)+along*Math.sin(rotation),z:ramp.z-across*Math.sin(rotation)+along*Math.cos(rotation)});
        start.y=f.walk.groundAt(start);
        const surfaceY=f.walk.groundAt(center);
        // The seaside platform ramp has water outside its outer guard; only
        // actual land approaches can exercise entering beneath the ramp.
        if (fromBelow&&!f.walk.contains(start,.22)) continue;
        if(fromBelow)lowerTerrainClearances.push(surfaceY-start.y);
        // Near a ramp's low end there is no space underneath to test.
        if (fromBelow&&surfaceY-start.y<.3) continue;
        approaches++;
        f.actor.teleport(start,f.walk); f.world.step();
        const rescues=f.rescues, direction=side*(fromBelow?-1:1);
        for (let frame=0;frame<40;frame++) {
          f.actor.step({x:direction*Math.cos(yaw),z:-direction*Math.sin(yaw)},STEP);
          f.world.step(); f.actor.afterStep();
          const position=f.actor.position, offset=side*((position.x-center.x)*Math.cos(yaw)-(position.z-center.z)*Math.sin(yaw));
          assert.equal(f.rescues,rescues,`${ramp.id}: side ${side}, gap ${gap} requires a safety teleport`);
          if (fromBelow) assert.ok(offset>=ramp.width/2,`${ramp.id}: visitor enters the solid ramp wedge from its lower side`);
          else {
            assert.ok(offset<ramp.width/2,`${ramp.id}: visitor leaves the ramp through its visible railing`);
            assert.ok(Math.abs(position.y-f.walk.groundAt(position))<.08,`${ramp.id}: feet lose support while pressing against the ramp railing`);
          }
        }
      }
      assert.ok(approaches>0||(fromBelow&&lowerTerrainClearances.length>0&&lowerTerrainClearances.every(clearance=>clearance<.3)),`${ramp.id}: exercise every accessible lower approach or prove the neighboring terrain fills the ramp underside`);
    } finally { f.world.free(); }
  });
}

for (const quality of ['high','low']) test(`${quality}: actual Experience GLB retains three substantial landmarks, animation owners and fadeable architecture`, async () => {
  const scene = await model(quality);
  const names = ['occluder_junction_terminal_walls','occluder_junction_workshop_walls','occluder_junction_conservatory_frame'];
  const bounds = names.map(name => {
    const node = scene.getObjectByName(name);
    assert.ok(node, `${name}: exported landmark exists`);
    const box = new THREE.Box3().setFromObject(node), size = box.getSize(new THREE.Vector3());
    assert.ok(size.x > 5 && size.y > 2 && size.z > 3, `${name}: landmark is rendered architecture`);
    return box;
  });
  assert.ok(bounds[0].getCenter(new THREE.Vector3()).z < -8, 'Amtrak anchors the rear of the junction');
  assert.ok(bounds[1].getCenter(new THREE.Vector3()).z+9 < bounds[2].getCenter(new THREE.Vector3()).z, 'workshop and greenhouse form separate depth layers');
  for (const id of companyIds) assert.ok(scene.getObjectByName(`district_${id}`), `${id}: independent district root survives export`);
  const controller = new IslandController(island, new THREE.Group());
  controller.bind(scene);
  try {
    for (const {name} of metadata(quality).animationNodes) {
      const node = scene.getObjectByName(name);
      assert.ok(node, `${name}: animated owner survives export`);
      assert.ok(!new THREE.Box3().setFromObject(node).isEmpty(), `${name}: animated owner contains geometry`);
      assert.equal(node.isMesh, undefined, `${name}: owner receives animation once`);
    }
    for (const name of metadata(quality).occluders) {
      const node = scene.getObjectByName(name);
      assert.ok(node, `${name}: manifest occluder is present`);
      node.traverse(object => { if (object.isMesh) assert.ok(controller.occluders.includes(object), `${name}: architecture can fade around the visitor`); });
    }
    let paving = 0;
    scene.traverse(object => {
      if (object.isMesh && (Array.isArray(object.material) ? object.material : [object.material]).some(material => material.name === 'junction_paving')) {
        paving++;
        assert.ok(!controller.occluders.includes(object), `${object.name}: paving remains opaque beneath the visitor`);
      }
    });
    assert.ok(paving > 0, 'terraces have visible paving');
  } finally { controller.release(); }
});

for (const quality of ['high','low']) test(`${quality}: each complete Experience read target matches its first visible sign face`, async () => {
  const scene = await model(quality), ray = new THREE.Raycaster();
  for (const station of layout.stations.filter(item => item.readFull&&!item.directoryOverview)) {
    const group = scene.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(`station_${station.id}`));
    assert.ok(group, `${station.id}: visible reading sign exists`);
    const face = station.hitArea, yaw = face.yaw || 0;
    const normal = new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw));
    const tangent = new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
    for (const dx of [-.38,0,.38]) for (const dy of [-.35,0,.35]) {
      const origin = new THREE.Vector3(face.x,face.y + face.height*dy,face.z).addScaledVector(tangent,face.width*dx).addScaledVector(normal,4);
      ray.set(origin,normal.clone().negate());
      const hit = ray.intersectObject(scene,true).find(intersection => intersection.distance < 4.5);
      assert.ok(hit, `${station.id}: rendered face is missing at ${dx},${dy}`);
      let owner = hit.object;
      while (owner && owner !== group) owner = owner.parent;
      assert.ok(owner, `${station.id}: face is blocked by ${hit.object.name} at ${dx},${dy}`);
    }
  }
});

for (const quality of ['high','low']) test(`${quality}: company reading cameras frame the actual architecture beside desktop and phone readers`, async () => {
  const scene = await model(quality), outer = new THREE.Group();
  outer.position.set(island.x,0,island.z); outer.rotation.y=island.rotation; outer.add(scene); outer.updateMatrixWorld(true);
  const landmarks = new Map();
  for (const interior of layout.interiors) {
    const landmark = layout.landmarks.find(item=>item.id===interior.landmarkId), vertices=[];
    for (const name of interior.cutawayGroups) {
      const group=scene.getObjectByName(name);
      assert.ok(group, `${name}: visible architecture exists for camera verification`);
      group.traverse(mesh=>{
        if (!mesh.isMesh) return;
        const positions=mesh.geometry.getAttribute('position');
        for (let n=0;n<positions.count;n++) vertices.push(new THREE.Vector3().fromBufferAttribute(positions,n).applyMatrix4(mesh.matrixWorld));
      });
    }
    assert.ok(vertices.length>0);
    landmarks.set(landmark.contentId,vertices);
  }
  const readers = [...layout.districts.map(district=>({...district,contentId:district.id})),...layout.stations.filter(station=>station.readFull&&!station.directoryOverview)];
  for (const reader of readers) {
    assert.ok(reader.camera?.fitBounds, `${reader.id}: company reader provides architectural framing`);
    const focus=campusStationFocus(island,reader), vertices=landmarks.get(reader.contentId);
    assert.equal(focus.contentId,reader.contentId);
    for (const [width,height] of [[1440,900],[1920,1080],[390,844],[844,390]]) {
      const camera=new THREE.PerspectiveCamera(28,width/height,.2,600), rig=new CameraRig(camera,{zoom:1,walkZoom:1,reduced:false},width,height);
      rig.update(0,{position:localToWorld(island,reader),focus,locomotion:'walking'},true);
      const rect=campusReadingRect(width,height);
      for (const vertex of vertices) {
        const p=vertex.clone().project(camera), x=(p.x+1)*width/2, y=(1-p.y)*height/2;
        assert.ok(p.z>=-1&&p.z<=1&&x>=rect.left-.1&&x<=rect.right+.1&&y>=rect.top-.1&&y<=rect.bottom+.1,
          `${reader.id} at ${width}×${height}: architecture is hidden by the reader or clipped by the viewport; vertex ${vertex.toArray().map(v=>v.toFixed(3))}, screen ${x.toFixed(2)},${y.toFixed(2)}, allowed ${JSON.stringify(rect)}`);
      }
    }
  }
});

test('actual brick, steel, greenhouse glass and paving retain their authored finishes under sunset lighting', async () => {
  const scene = await model('high'), authored = [];
  scene.traverse(mesh => {
    if (!mesh.isMesh) return;
    for (const [index,material] of (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).entries()) {
      if (material.name.startsWith('junction_')) authored.push({mesh,index,name:material.name,color:material.color.clone(),opacity:material.opacity,roughness:material.roughness,metalness:material.metalness});
    }
  });
  const names = new Set(authored.map(item => item.name));
  for (const name of ['junction_brick','junction_steel','junction_glass','junction_clear','junction_paving']) assert.ok(names.has(name), `${name}: finish is used on actual geometry`);
  applySunsetMaterials(scene,'experience');
  try {
    for (const item of authored) {
      const material = (Array.isArray(item.mesh.material) ? item.mesh.material : [item.mesh.material])[item.index];
      assert.ok(material.color.equals(item.color), `${item.name}: authored color`);
      for (const key of ['opacity','roughness','metalness']) assert.equal(material[key],item[key], `${item.name}: authored ${key}`);
      assert.equal(material.userData.sunsetMaterial?.role,item.name, `${item.name}: explicit finish role`);
      if (item.name === 'junction_clear') assert.ok(material.transparent && material.opacity < .5, 'clear conservatory panes reveal the planting inside');
    }
  } finally { releaseSunsetMaterials(scene); }
});

test('the real career railway yields to an elevated track visitor, ignores the inaccessible lower plane and freezes on pause', () => {
  const railway=layout.railway;
  assert.ok(railway?.path,'functional railway replaces the old Amtrak decoration');
  const train=new CareerTrainController(railway,{island});
  const highStop=railway.stations.find(station=>station.id==='amtrak');
  // Load a valid elevated starting pose without changing the shared route.
  train.distance=highStop.distance;train.previousDistance=train.distance;train.stationId='amtrak';
  assert.equal(train.board(),true);assert.equal(train.continue(),true);
  const coach=sampleTrainPath(railway.path,train.distance-CAREER_TRAIN.coachOffset),position=train.worldPoint(coach);position.y+=CAREER_TRAIN.floorY;
  assert.ok(position.y-layout.groundY>1.2,'the actual high-station track is elevated');
  train.step(STEP,{pedestrians:[position]});
  assert.equal(train.distance,highStop.distance,'a visitor inside the trailing carriage envelope holds the whole train');
  train.step(STEP,{pedestrians:[{...position,y:position.y-3}]});
  assert.ok(train.distance<highStop.distance,'an inaccessible lower plane does not block the high rail route');
  const before={distance:train.distance,position:train.position};
  train.step(10,{paused:true});
  assert.equal(train.distance,before.distance,'a background pause cannot advance the rail clock');
  assert.deepEqual(train.position,before.position,'pausing retains the passenger location');
  train.step(STEP);
  assert.ok(train.distance<before.distance,'the functional train resumes even without any island decoration animation');
});

for (const quality of ['high','low']) test(`${quality}: terrace and ramp rendering agrees with exported walking heights and real Rapier support`, async () => {
  const scene = await model(quality), f = physicsFixture(), ray = new THREE.Raycaster();
  try {
    const elevated = [...layout.stairs.flatMap(stair=>stair.treads.filter((_,index)=>index%5===0)),...layout.railway.stations.map(station=>station.platform)];
    assert.ok(layout.stairs.length >= 12, 'the mountain levels are connected by real supported stairs');
    for (const surface of elevated) {
      assert.ok(Math.atan(Math.abs(surface.slope || 0)) < Math.PI/12, 'architectural ramps stay below 15 degrees');
      const angle = surface.rotation || 0;
      for (const across of [-.32,0,.32]) for (const along of [-.42,-.2,0,.2,.42]) {
        const dx = surface.width*across, dz = surface.depth*along;
        const x = surface.x + dx*Math.cos(angle) + dz*Math.sin(angle);
        const z = surface.z - dx*Math.sin(angle) + dz*Math.cos(angle);
        const point = localToWorld(island,{x,z}), height = f.walk.groundAt(point);
        const hit = f.world.castRay(new R.Ray({x:point.x,y:45,z:point.z},{x:0,y:-1,z:0}),50,true,undefined,undefined,undefined,undefined,collider => f.walk.colliders.includes(collider) && !f.walk.obstacles.includes(collider));
        assert.ok(hit, `support collider missing at ${x},${z}`);
        assert.ok(Math.abs(45-hit.timeOfImpact-height) < .008, `Rapier support and ground sample disagree at ${x},${z}`);
        ray.set(new THREE.Vector3(x,45,z),new THREE.Vector3(0,-1,0));
        assert.ok(ray.intersectObject(scene,true).some(intersection => Math.abs(intersection.point.y-height) < .065), `${quality}: visible support floats away from walking plane at ${x},${z}`);
      }
    }
  } finally { f.world.free(); }
});

test('the exported main streets retain their full clear walking width', () => {
  const f = physicsFixture();
  try {
    const mainPaths = layout.paths.filter(path => path.main);
    assert.ok(mainPaths.length >= 1, 'the continuous main scenic circuit is documented');
    for (const path of mainPaths) {
      assert.ok(path.width >= (path.kind==='bridge'?2.8:3.2) && path.width <= 7.2, `${path.id}: main circulation width`);
      for (let segment = 1; segment < path.points.length; segment++) {
        const a = path.points[segment-1], b = path.points[segment];
        const dx = b[0]-a[0], dz = b[1]-a[1], length = Math.hypot(dx,dz);
        if(length<1e-8)continue;
        const steps = Math.max(1,Math.ceil(length/.35));
        for (let step = 0; step <= steps; step++) for (const offset of [-path.width/2+.06,0,path.width/2-.06]) {
          const x = a[0]+dx*step/steps+dz/length*offset;
          const z = a[1]+dz*step/steps-dx/length*offset;
          const point = localToWorld(island,{x,z});point.y=f.walk.groundAt(point);
          assert.ok(f.walk.clear(point,.025), `${path.id}: obstruction narrows segment ${segment} at ${x.toFixed(2)},${z.toFixed(2)}`);
          assert.ok(f.walk.groundSample(point).slope < Math.PI/12, `${path.id}: a steep edge enters the walking width`);
        }
      }
    }
  } finally { f.world.free(); }
});

test('the complete tour passes through all three open interiors with clear public entrances', () => {
  const f = physicsFixture();
  try {
    assert.deepEqual(layout.interiors.map(interior => interior.landmarkId).sort(), ['career-station','software-workshop','visionx-conservatory']);
    for (const interior of layout.interiors) {
      assert.ok(interior.entrances.length >= 2, `${interior.landmarkId}: public through-route`);
      assert.ok(interior.entrances.every(entrance => entrance.width >= 3.2), `${interior.landmarkId}: generous entrances`);
      for(const entrance of interior.entrances){const position=localToWorld(island,entrance);assert.ok(f.walk.clear(position,.3),`${interior.landmarkId}: the actual doorway admits Jack`);assert.ok(f.walk.safeGround(position,.22),`${interior.landmarkId}: doorway support is walkable`);}
      for (const [pointIndex,point] of interior.walkRoute.entries()) {
        const [x,z] = point;
        const worldPoint = localToWorld(island,{x,z});worldPoint.y=f.walk.groundAt(worldPoint);
        assert.ok(f.walk.clear(worldPoint,.3), `${interior.landmarkId}: center aisle remains open`);
        let authoredHeight=interior.walkRouteHeights?.[pointIndex]??interior.floorY;
        for(const ramp of layout.ramps||[]){
          const angle=ramp.rotation||0,dx=x-ramp.x,dz=z-ramp.z,across=dx*Math.cos(angle)-dz*Math.sin(angle),along=dx*Math.sin(angle)+dz*Math.cos(angle);
          if(Math.abs(across)<=ramp.width/2&&Math.abs(along)<=ramp.depth/2)authoredHeight=Math.max(authoredHeight,ramp.y+ramp.slope*along);
        }
        assert.ok(Math.abs(f.walk.groundAt(worldPoint)-authoredHeight) < .035, `${interior.landmarkId}: aisle follows its floor or the authored platform access ramp`);
        const nearest = Math.min(...layout.route.slice(1).map((end,index) => {
          const start = layout.route[index], dx = end[0]-start[0], dz = end[1]-start[1];
          const ratio = Math.max(0,Math.min(1,((x-start[0])*dx+(z-start[1])*dz)/(dx*dx+dz*dz || 1)));
          return Math.hypot(x-start[0]-dx*ratio,z-start[1]-dz*ratio);
        }));
        const bounds=interior.bounds,inside=Math.abs(x-bounds.x)<=bounds.width/2&&Math.abs(z-bounds.z)<=bounds.depth/2;
        if(inside)assert.ok(nearest < .1, `${interior.landmarkId}: real traversal route includes the through-aisle`);
      }
    }
    assert.ok(layout.route.some(([x,z]) => z < -11), 'tour reaches the upper station hall');
  } finally { f.world.free(); }
});

for(const station of layout.railway.stations)test(`${station.id}: the exported station approach is directly walkable from the existing boat berth`,()=>{
 const f=physicsFixture();
 try{
  traverse(f,station.walkRoute);
  const target=localToWorld(island,station.boarding),p=f.actor.position;
  assert.ok(Math.hypot(p.x-target.x,p.z-target.z)<.09);
  assert.ok(Math.abs(p.y-target.y)<.035,'feet finish on the platform floor');
  assert.equal(f.rescues,0,'no teleport or pathfinding detour repairs the exported approach');
 }finally{f.world.free();}
});

for(const quality of ['high','low'])test(`${quality}: both conservatory domes have opaque outward-facing blue-green glass shells`,async()=>{
 const scene=await model(quality),ray=new THREE.Raycaster();
 for(const[name,x,y,z]of[['east',21.1,14.7,12],['west',11.8,13.4,12]]){
  const dome=scene.getObjectByName('occluder_junction_conservatory_dome_'+name);assert.ok(dome);
  ray.set(new THREE.Vector3(x+.6,y+3,z+.4),new THREE.Vector3(0,-1,0));
  const hit=ray.intersectObject(dome,true).find(h=>h.object.material.name==='junction_glass');
  assert.ok(hit,`${name}: a visitor-facing ray must hit the glass shell, not only its ribs`);assert.equal(hit.object.material.opacity,1);assert.equal(hit.object.material.transparent,false);
  assert.ok(hit.point.y>y-.7&&hit.point.y<y+.1);
 }
});

for(const quality of ['high','low'])test(`${quality}: platform lamps leave the disembarked visitor visible at the fixed 38 degree walking view`,async()=>{
 const scene=await model(quality),ray=new THREE.Raycaster(),direction=new THREE.Vector3(0,Math.sin(38*Math.PI/180),Math.cos(38*Math.PI/180));
 const lamps=layout.obstacles.filter(obstacle=>obstacle.name.startsWith('station lamp ')),lampMeshes=[];
 scene.traverse(mesh=>{if(mesh.isMesh&&['sunsetLantern','junction_steel'].includes(mesh.material.name))lampMeshes.push(mesh);});
 for(const station of layout.railway.stations)assert.equal(lamps.filter(lamp=>lamp.name==='station lamp '+station.id).length,station.id==='beaconfire'?1:2,'BeaconFire keeps only its rear lamp so the widened reader is clear');
 assert.ok(lampMeshes.some(mesh=>mesh.material.name==='sunsetLantern'),'real exported lamp shades must be tested');
 const isLampHit=hit=>hit.object.material.name==='sunsetLantern'||lamps.some(lamp=>Math.abs(hit.point.x-lamp.x)<=lamp.width/2+.005&&Math.abs(hit.point.z-lamp.z)<=lamp.depth/2+.005&&hit.point.y>=lamp.y&&hit.point.y<=lamp.y+2.25);
 for(const station of layout.railway.stations)for(const height of [.08,.30,.55,.80,1.05])for(const across of [-.15,0,.15]){
  const target=new THREE.Vector3(station.boarding.x+across,station.boarding.y+height,station.boarding.z);
  ray.set(target.clone().addScaledVector(direction,80),direction.clone().negate());ray.far=79.98;
  // Lamp posts share a merged steel mesh with rails. Test only their authored
  // volumes, allowing necessary railings and other partial scene occlusion.
  const hit=ray.intersectObjects(lampMeshes,false).find(isLampHit);
  assert.ok(!hit,`${station.id}: visitor at height ${height} is hidden by ${hit?.object.name}`);
 }
});
