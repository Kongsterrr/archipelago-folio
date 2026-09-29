import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import R from '@dimforge/rapier3d-compat/rapier.es.js';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Box3,PropertyBinding,Raycaster,Vector3} from 'three';
import {islands,toWorld} from '../sources/config.js';
import {IslandWalkWorld,CharacterController,localToWorld,SEA_GROUP} from '../sources/core/character.js';
import {createIslandColliders} from '../sources/core/collisions.js';
import {islandMapGeometry,createMapProjection} from '../sources/core/minimap.js';
import {selectLandExhibit,exhibitReadLabel} from '../sources/core/project-exhibits.js';

const json=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url)));
const layout=json('../static/models/walk-layout.json').islands.find(i=>i.id==='education');
const island=islands.find(i=>i.id==='education');
const schools=()=>layout.stations.filter(s=>s.schoolId&&s.primary);
await R.init();await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});

function fixture(){
 const world=new R.World({x:0,y:0,z:0});world.timestep=1/60;
 createIslandColliders(R,world,island);world.forEachCollider(c=>c.setCollisionGroups(SEA_GROUP));
 const walk=new IslandWalkWorld(R,world,island,layout),character=new CharacterController(R,world);world.step();
 return{world,walk,character};
}

// Find routes independently of the author's loop, then traverse them with the
// production capsule controller. Four-neighbour grid steps cannot cut corners.
function walkingPath(walk,from,to){
 const size=.5,key=(x,z)=>`${x},${z}`,a=[Math.round(from.x/size),Math.round(from.z/size)],b=[Math.round(to.x/size),Math.round(to.z/size)];
 const queue=[a],parents=new Map([[key(...a),null]]);let found=false;
 for(let cursor=0;cursor<queue.length;cursor++){
  const [x,z]=queue[cursor];if(x===b[0]&&z===b[1]){found=true;break;}
  for(const[dx,dz]of[[1,0],[-1,0],[0,1],[0,-1]]){
   const next=[x+dx,z+dz],id=key(...next);if(parents.has(id))continue;
   const p=localToWorld(island,{x:next[0]*size,z:next[1]*size});
   if(!walk.clear(p,.28))continue;
   parents.set(id,[x,z]);queue.push(next);
  }
 }
 assert.ok(found,`no capsule-width route to ${to.x},${to.z}`);
 const path=[];for(let p=b;p;p=parents.get(key(...p)))path.unshift(p);
 const bends=path.filter((p,n)=>n===0||n===path.length-1||p[0]-path[n-1][0]!==path[n+1][0]-p[0]||p[1]-path[n-1][1]!==path[n+1][1]-p[1]);
 return [...bends.map(([x,z])=>({x:x*size,z:z*size})),to];
}
function follow(f,points){
 for(const point of points){
  const target=localToWorld(island,point);let reached=false;
  const budget=Math.ceil((Math.hypot(f.character.position.x-target.x,f.character.position.z-target.z)/2.4+3)*60);
  for(let n=0;n<budget;n++){
   const p=f.character.position,dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz);
   if(d<.075){reached=true;break;}
   const scale=Math.min(1,d/(2.4/60));f.character.step({x:dx/d*scale,z:dz/d*scale},1/60);f.world.step();f.character.afterStep();
   assert.ok(Math.abs(f.character.position.y-f.walk.groundAt(f.character.position))<.08,'feet stay on campus ground and pier');
  }
  assert.ok(reached,`actual character blocked at ${point.x},${point.z}`);
 }
}

test('campus layout retains four-island identity, two distinct schools and a legible walking network',()=>{
 assert.deepEqual(layout.districts.map(d=>d.id),['learning']);
 assert.deepEqual(layout.campuses.map(c=>c.schoolId),['bu','cmu']);
 assert.ok(layout.campuses.find(c=>c.schoolId==='bu').x<0);
 assert.ok(layout.campuses.find(c=>c.schoolId==='cmu').x>0);
 assert.equal(layout.groundY,.85);assert.equal(layout.berths.length,2);
 assert.equal(layout.dock.width,4);
 assert.ok(layout.paths.length>=4);
 assert.ok(layout.paths.every(path=>path.width>=2.4),'all authored campus paths have adequate width');
 assert.ok(layout.estimatedWalkingSeconds>=60&&layout.estimatedWalkingSeconds<=90,'loop fits the planned walking duration');
 assert.equal(layout.benches.length,3);
 assert.deepEqual(new Set(schools().map(s=>s.schoolId)),new Set(['bu','cmu']));
 for(const s of schools()){assert.equal(s.readFull,true);assert.equal(s.readLabel,'View education');assert.equal(s.contentId,'learning');}
});

for(const index of[0,1])test(`landing ${index+1}: actual character reaches BU, CMU, lighthouse and every rest point without rescue`,()=>{
 const f=fixture();try{
  const berth=layout.berths[index],landing=localToWorld(island,berth.landing),boat=localToWorld(island,berth.boat);
  assert.ok(f.walk.clear(landing),'landing is clear');
  assert.equal(f.world.intersectionWithShape({x:boat.x,y:.35,z:boat.z},{x:0,y:Math.sin(boat.yaw/2),z:0,w:Math.cos(boat.yaw/2)},new R.Cuboid(.85,.7,2.1),undefined,SEA_GROUP),null,'parked boat berth is clear');
  f.character.teleport(landing,f.walk);f.character.enable(true);f.world.step();
  let rescues=0;const teleport=f.character.teleport.bind(f.character);f.character.teleport=(...args)=>{rescues++;return teleport(...args);};
  const targets=[...schools(),layout.stations.find(s=>s.action==='lighthouse'),...layout.benches.map(b=>b.approach),berth.landing];
  let from=berth.landing;
  for(const target of targets){assert.ok(target);assert.ok(f.walk.clear(localToWorld(island,target)),`${target.id||'rest point'} is accessible`);follow(f,walkingPath(f.walk,from,target));from=target;}
  assert.equal(rescues,0,'a campus visit must not need a hidden reset');
 }finally{f.world.free();}
});

test('education exhibits have clear, visible front aprons and arrival keyboard selection never chooses an arbitrary school',()=>{
 const f=fixture();try{
  f.world.propagateModifiedBodyPositionsToColliders();f.world.updateSceneQueries();
  for(const station of schools())for(const x of[-1,0,1])for(const z of[0,.7]){
   const p=localToWorld(island,{...station,x:station.x+x,z:station.z+z});
   assert.ok(f.walk.clear(p,.24),`${station.schoolId} clear front apron ${x},${z}`);
   assert.ok(f.walk.visible(p,localToWorld(island,station)),`${station.schoolId} unobstructed read target`);
  }
  const overview=layout.stations.find(s=>s.directoryOverview),rows=layout.stations.filter(s=>s.directory);
  assert.ok(overview);assert.equal(overview.contentId,'education');assert.equal(overview.readFull,true);
  assert.deepEqual(rows.map(s=>s.schoolId),['bu','cmu']);
  assert.ok(rows.every(s=>s.readFull&&s.hitArea));
  assert.ok(overview.hitArea.y-overview.hitArea.height/2>Math.max(...rows.map(s=>s.hitArea.y+s.hitArea.height/2)),'overview and school row faces are distinct');
  const actions=[...rows,overview].map(station=>({kind:'read',station,distance:()=>0}));
  assert.equal(selectLandExhibit(actions,{},{}).station,overview);
  assert.equal(selectLandExhibit([...actions].reverse(),{},{}).station,overview);
  assert.equal(exhibitReadLabel(actions.at(-1)),'Browse education');
  for(const school of schools())assert.equal(exhibitReadLabel({station:school}),'View education');
 }finally{f.world.free();}
});

test('campus map identities, extents and school labels survive station and campus ordering changes',()=>{
 const geometry=islandMapGeometry(island,layout),reordered=islandMapGeometry(island,{...layout,campuses:[...layout.campuses].reverse(),stations:[...layout.stations].reverse()});
 assert.equal(geometry.campuses.length,2);
 for(const schoolId of['bu','cmu']){
  const a=geometry.campuses.find(c=>c.schoolId===schoolId),b=reordered.campuses.find(c=>c.schoolId===schoolId),source=layout.campuses.find(c=>c.schoolId===schoolId);
  assert.deepEqual(a,b);assert.equal(a.label,schoolId==='bu'?'Boston University':'Carnegie Mellon University');
  const expected=toWorld(island,source.x,source.z);assert.equal(a.x,expected.x);assert.equal(a.z,expected.z);
  assert.ok(a.polygon.length>=4,'campus tint has an authored extent');
  assert.deepEqual(geometry.stations.find(s=>s.schoolId===schoolId&&s.primary),reordered.stations.find(s=>s.schoolId===schoolId&&s.primary));
 }
 const {project}=createMapProjection([...geometry.shore,...geometry.campuses.flatMap(c=>c.polygon)],254,212,18);
 assert.ok(project(geometry.campuses.find(c=>c.schoolId==='bu')).x<project(geometry.campuses.find(c=>c.schoolId==='cmu')).x,'BU stays on the west side');
 const pier=project(geometry.dock[0]),north=project(toWorld(island,0,-16));assert.ok(north.y<pier.y,'campus map remains north-up');
});

for(const quality of['high','low'])test(`${quality}: shipped campus landmarks and full sign faces are present within resource budget`,async()=>{
 const folder=quality==='low'?'low/':'',url=new URL(`../static/models/${folder}education.glb`,import.meta.url),manifest=json(`../static/models/${folder}manifest.json`),metadata=manifest.models.find(m=>m.id==='education');
 const bytes=fs.statSync(url).size;
 assert.ok(bytes<=(quality==='high'?1_500_000:1_000_000),`${quality} model exceeds budget: ${bytes}`);
 assert.equal(metadata.bytes,bytes);assert.equal(metadata.revision,'v14-campus-shores');
 assert.equal(manifest.walkLayout,'walk-layout.json');assert.deepEqual(metadata.dock,layout.dock);
 for(const [n,point]of metadata.shorePolygon.entries())for(const axis of[0,1])assert.ok(Math.abs(layout.shore[n][axis]-point[axis]*.96)<1e-8,'character boundary retains the same inset of the visible coastline');
 const document=await io.read(fileURLToPath(url));
 for(const material of document.getRoot().listMaterials()){material.setBaseColorTexture(null);material.setNormalTexture(null);material.setMetallicRoughnessTexture(null);material.setOcclusionTexture(null);material.setEmissiveTexture(null);}
 for(const texture of[...document.getRoot().listTextures()])texture.dispose();
 for(const extension of[...document.getRoot().listExtensionsUsed()])if(extension.extensionName==='EXT_meshopt_compression')extension.dispose();
 const output=await io.writeBinary(document),gltf=await new GLTFLoader().parseAsync(output.buffer.slice(output.byteOffset,output.byteOffset+output.byteLength),'');gltf.scene.updateMatrixWorld(true);
 for(const suffix of['marsh_roof','cas_roof','hamerschlag_dome','hamburg_roof','brownstone_0','brownstone_1','brownstone_2']){
  const name='occluder_campus_'+suffix,node=gltf.scene.getObjectByName(name);assert.ok(node,`missing ${name}`);
  const size=new Box3().setFromObject(node).getSize(new Vector3());assert.ok(size.x>1&&size.z>1,`${name} is a real, sizeable building part`);
 }
 const ray=new Raycaster();
 for(const station of[...schools(),...layout.stations.filter(s=>s.directory||s.directoryOverview)]){
  const name=PropertyBinding.sanitizeNodeName(station.primary?'station_'+station.id:'station_education:overview'),group=gltf.scene.getObjectByName(name);assert.ok(group,`missing ${name}`);
  for(const x of[-.38,0,.38])for(const y of[-.35,0,.35]){
   const face=station.hitArea;ray.set(new Vector3(face.x+x*face.width,face.y+y*face.height,face.z+4),new Vector3(0,0,-1));
   const first=ray.intersectObject(gltf.scene,true).find(hit=>hit.distance<4.5);assert.ok(first,`${station.id} renders across its click face`);
   let owner=first.object;while(owner&&owner!==group)owner=owner.parent;
   assert.ok(owner,`${station.id} face obscured by ${first.object.name} at ${x},${y}`);
  }
 }
});
