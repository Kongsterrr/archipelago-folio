import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {campusStationFocus} from '../sources/core/campus-focus.js';
import {islandMapGeometry} from '../sources/core/minimap.js';
import {exhibitHeightReachable, selectLandExhibit} from '../sources/core/project-exhibits.js';
import {IslandDetails} from '../sources/world/island-details.js';
import {SurfaceLibrary} from '../sources/world/surface-library.js';

const near = (a,b,message) => assert.ok(Math.abs(a-b) < 1e-5, `${message}: ${a} differs from ${b}`);

test('an elevated reader cannot win the nearby action from the lower promenade, including retained focus', () => {
  const lower = {x:0,y:.85,z:0};
  const action = (id,position) => ({id,kind:'read',station:{readFull:true,readLabel:'View experience'},position,distance:p=>Math.hypot(p.x-position.x,p.z-position.z)});
  const terrace = action('amtrak',{x:0,y:3.15,z:0});
  const harbor = action('amtrak-harbor',{x:2,y:.85,z:0});
  assert.equal(exhibitHeightReachable(terrace,lower), false, 'a pointer hit on the upper sign is out of reach');
  assert.equal(selectLandExhibit([terrace,harbor],lower,{previous:terrace}), harbor);
  assert.equal(selectLandExhibit([terrace],lower,{riding:true}), null);
  assert.equal(selectLandExhibit([harbor,terrace],{x:0,y:3.15,z:0}), terrace);
  assert.equal(selectLandExhibit([terrace,harbor],lower,{visible:()=>false}), null);
  assert.equal(selectLandExhibit([harbor],{x:0,y:1.15,z:0}), harbor, 'a nearby point on a gentle approach remains usable');
});

test('each company reading focus keeps its identity and transforms the authored architectural bounds', () => {
  const island = {id:'experience',x:-76,z:8,rotation:Math.PI/2};
  for (const contentId of ['amtrak','beaconfire','visionx']) {
    const station = {contentId,x:0,y:.85,z:23,cameraTarget:{x:4,y:3,z:-12},camera:{fitBounds:{min:[-2,1,-18],max:[10,8,-6]}}};
    const saved = structuredClone(station), focus = campusStationFocus(island,station);
    assert.equal(focus.id,'experience');
    assert.equal(focus.islandId,'experience');
    assert.equal(focus.contentId,contentId);
    near(focus.x,-88,'camera target x'); near(focus.y,3,'camera target y'); near(focus.z,4,'camera target z');
    for (const [index,value] of [-94,1,-2].entries()) near(focus.camera.fitBounds.min[index],value,'minimum world bounds');
    for (const [index,value] of [-82,8,10].entries()) near(focus.camera.fitBounds.max[index],value,'maximum world bounds');
    assert.deepEqual(station,saved,'opening the reader does not rewrite authored local coordinates');
  }
  assert.equal(campusStationFocus(island,{x:0,z:0}).contentId,'learning','existing education focus retains its default identity');
});

test('the north-up map rail loop follows both the island and district transforms', () => {
  const island = {id:'experience',x:-76,z:8,rotation:.83};
  const district = {id:'amtrak',x:3,z:-14,rotation:-.37,animation:{train:{trackCentre:[2,3.15,-1],trackRadii:[12.3,6.5]}}};
  const layout = {districts:[district,{id:'visionx',x:20,z:0}],paths:[{width:3.6,points:[[0,20],[0,-8]]}]};
  const saved = structuredClone(layout), map = islandMapGeometry(island,layout);
  assert.equal(map.tracks.length,1,'only the railway district adds a rail loop');
  const points = map.tracks[0].points;
  assert.ok(points.length >= 24,'the ellipse has enough segments to be legible');
  near(Math.hypot(points[0].x-points.at(-1).x,points[0].z-points.at(-1).z),0,'rail loop closes');
  const parent = new THREE.Group(), child = new THREE.Group();
  parent.position.set(island.x,0,island.z); parent.rotation.y = island.rotation;
  child.position.set(district.x,0,district.z); child.rotation.y = district.rotation;
  parent.add(child); parent.updateMatrixWorld(true);
  const local = points.map(point=>child.worldToLocal(new THREE.Vector3(point.x,0,point.z)));
  for (const point of local) near(((point.x-2)/12.3)**2+((point.z+1)/6.5)**2,1,'map point lies on rendered local track');
  near(Math.min(...local.map(point=>point.x)),2-12.3,'track reaches left extent');
  near(Math.max(...local.map(point=>point.z)),-1+6.5,'track reaches front extent');
  assert.equal(map.roads[0].width,3.6,'rail geometry does not change walking path widths');
  assert.deepEqual(layout,saved);
  assert.deepEqual(islandMapGeometry(null).tracks,[]);
});

function mistFixture() {
  const scene = new THREE.Scene(), settings = {quality:'high',reduced:false};
  const details = new IslandDetails(scene,settings,{loadAsync:async()=>{throw new Error('unexpected legacy detail asset request');}});
  details.v4 = true;
  const outer = new THREE.Group(), model = new THREE.Group(), sprinkler = new THREE.Object3D();
  outer.position.set(-76,1.1,8); outer.rotation.y = .7;
  model.position.set(21,1.3,-4); model.rotation.y = -.2;
  sprinkler.name = 'anim_sprinkler'; sprinkler.position.set(6.2,2.08,8.3);
  outer.add(model); model.add(sprinkler); scene.add(outer);
  const controller = {model,island:{id:'visionx',rotation:.5},elapsed:0,duration:6};
  const controllers = new Map([['experience',{children:[controller]}]]);
  const update = () => {const p=sprinkler.getWorldPosition(new THREE.Vector3()); details.update(1/60,p,.2,.2,controllers);};
  const particles = () => Array.from({length:details.mist.count},(_,index)=>{
    const matrix = new THREE.Matrix4(); details.mist.getMatrixAt(index,matrix);
    return {position:new THREE.Vector3().setFromMatrixPosition(matrix),scale:matrix.getMaxScaleOnAxis()};
  });
  return {scene,settings,details,outer,model,sprinkler,controller,update,particles};
}

test('greenhouse mist follows the authored emitter through parent transforms and model replacement', () => {
  const f = mistFixture();
  f.update();
  const origin = f.sprinkler.getWorldPosition(new THREE.Vector3()), before = f.particles();
  assert.ok(before.every(p=>p.scale>0),'active high-quality greenhouse emits all particles');
  for (const {position} of before) {
    assert.ok(Math.hypot(position.x-origin.x,position.z-origin.z) < 1.9,'mist is around the authored sprinkler');
    assert.ok(position.y > origin.y-.65 && position.y < origin.y+.55,'mist uses the elevated sprinkler height');
  }
  f.outer.position.add(new THREE.Vector3(9,2,-5));
  f.update();
  f.particles().forEach(({position},index)=>assert.ok(position.distanceTo(before[index].position.clone().add(new THREE.Vector3(9,2,-5))) < 1e-5,'moving the parent moves the entire mist cloud'));
  const previous = f.particles(), pivot = f.outer.position.clone(), rotation = new THREE.Matrix4().makeRotationY(.4);
  f.outer.rotation.y += .4; f.controller.island.rotation += .4;
  f.update();
  f.particles().forEach(({position},index)=>assert.ok(position.distanceTo(previous[index].position.clone().sub(pivot).applyMatrix4(rotation).add(pivot)) < 1e-5,'a rotated district rotates the cloud with the emitter'));
  const replacement = new THREE.Group(), nextEmitter = new THREE.Object3D();
  nextEmitter.name='anim_sprinkler'; nextEmitter.position.set(1,7,2); replacement.add(nextEmitter); f.scene.add(replacement); f.controller.model=replacement;
  f.update();
  assert.ok(f.particles().every(({position})=>position.distanceTo(nextEmitter.position)<2),'quality replacement uses its new emitter rather than the retired model');
  f.controller.model = new THREE.Group(); f.update();
  assert.ok(f.particles().every(p=>p.scale===0),'an absent emitter hides stale mist');
});

test('greenhouse mist respects animation, reduced motion, distance and quality settings', () => {
  const f = mistFixture();
  f.settings.quality='low'; f.update();
  assert.equal(f.particles().filter(p=>p.scale>0).length,12,'low quality reduces visible particles');
  f.settings.reduced=true; f.update();
  assert.ok(f.particles().every(p=>p.scale===0));
  f.settings.reduced=false; f.controller.elapsed=f.controller.duration; f.update();
  assert.ok(f.particles().every(p=>p.scale===0),'completed greenhouse action stops mist');
  f.controller.elapsed=0;
  f.details.update(1/60,{x:1000,z:1000},.2,.2,new Map([['experience',{children:[f.controller]}]]));
  assert.ok(f.particles().every(p=>p.scale===0),'distant mist is culled');
});

test('junction masonry and timber gain surface detail without losing authored color or albedo on quality swaps', async () => {
  const root = new THREE.Group(), albedo = new THREE.Texture();
  const names = ['sandstone','stone','joint','paving','brick','brickJoint','wood','woodDark'];
  const sources = names.map((name,index)=>new THREE.MeshStandardMaterial({name:`junction_${name}`,color:index<6?'#b85e43':'#755334',map:albedo,roughness:.73}));
  for (const material of sources) root.add(new THREE.Mesh(new THREE.BoxGeometry(),material));
  const glass = new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial({name:'junction_clear',transparent:true,opacity:.28}));
  root.add(glass); const glazing = glass.material;
  const qualities = Object.fromEntries(['high','low'].map(quality=>[quality,{surfaces:Object.fromEntries(['stone','wood'].map(profile=>[profile,Object.fromEntries(['color','normal','orm'].map(channel=>[channel,{url:`/${quality}/${profile}/${channel}`}]))]))}]));
  const library = new SurfaceLibrary({loader:{loadAsync:async()=>new THREE.Texture(),dispose(){}},fetchManifest:async()=>({qualities})});
  library.bind(root); const bound = root.children.slice(0,sources.length).map(mesh=>mesh.material);
  try {
    for (const quality of ['high','low','high']) {
      assert.equal(await library.loadQuality(quality),true);
      for (const [index,material] of bound.entries()) {
        assert.equal(root.children[index].material,material,'quality swaps keep controller material references valid');
        assert.ok(material.color.equals(sources[index].color));
        assert.equal(material.map,albedo,'authored albedo survives shared texture loading');
        assert.ok(material.normalMap?.isTexture && material.roughnessMap?.isTexture,'masonry and timber receive detail textures');
        assert.equal(material.userData.v5Surface,index<6?'stone':'wood');
        assert.ok(material.normalScale.x>0 && material.normalScale.x<.4,'detail stays subtle on architecture');
        assert.equal(material.roughness,.73);
      }
      assert.equal(glass.material,glazing,'surface packs preserve greenhouse transparency');
      assert.equal(glass.material.opacity,.28);
    }
    library.release(root);
    sources.forEach((material,index)=>assert.equal(root.children[index].material,material));
  } finally { library.dispose(); }
});
