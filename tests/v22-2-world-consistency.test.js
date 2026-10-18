import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import R from '@dimforge/rapier3d-compat/rapier.es.js';
import {islands} from '../sources/config.js';
import {IslandWalkWorld,localToWorld,CHARACTER} from '../sources/core/character.js';
import {Game} from '../sources/game.js';

const layout=JSON.parse(await fs.readFile(new URL('../static/models/walk-layout.json',import.meta.url))).islands.find(i=>i.id==='experience');
const island=islands.find(i=>i.id==='experience');
await R.init();

async function exportedScene(quality){
 const data=await fs.readFile(new URL(`../static/models/${quality==='low'?'low/':''}experience.glb`,import.meta.url));
 const scene=(await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'')).scene;
 scene.updateMatrixWorld(true);return scene;
}
function triangles(mesh,transform,visit){
 const geometry=mesh.geometry,positions=geometry.attributes.position,index=geometry.index,count=index?.count??positions.count,triangle=new THREE.Triangle();
 for(let i=0;i<count;i+=3){
  for(let vertex=0;vertex<3;vertex++)[triangle.a,triangle.b,triangle.c][vertex].fromBufferAttribute(positions,index?index.getX(i+vertex):i+vertex).applyMatrix4(transform);
  visit(triangle);
 }
}
function rockMeshes(scene){const meshes=[];scene.traverse(object=>{if(object.isMesh&&object.name.startsWith('occluder_summit_rock_'))meshes.push(object);});return meshes;}

for(const quality of ['high','low']){
 const scene=await exportedScene(quality);
 test(`${quality}: all 310 stair treads have a continuous rendered character corridor, including between test lanes`,()=>{
  const meshes=[];scene.traverse(mesh=>{if(mesh.isMesh&&!/leaf|flower/.test(mesh.material.name))meshes.push(mesh);});
  const conflicts=[];let checked=0;
  for(const stair of layout.stairs){
   const inverse=new THREE.Matrix4().makeRotationY(-(stair.rotation||0)).multiply(new THREE.Matrix4().makeTranslation(-stair.x,0,-stair.z));
   const volumes=stair.treads.map((tread,index)=>{
    const center=new THREE.Vector3(tread.x,tread.y,tread.z).applyMatrix4(inverse);
    // Inspect the entire 3m walk corridor, not only its centreline. The former
    // cornice crossed between the three sampled lanes without blocking Rapier.
    const box=new THREE.Box3(new THREE.Vector3(-stair.width/2+.2,tread.y+.08,center.z-tread.depth/2+.015),new THREE.Vector3(stair.width/2-.2,tread.y+CHARACTER.height,center.z+tread.depth/2-.015));
    const rockBox=box.clone();rockBox.min.x=-stair.width/2-CHARACTER.radius;rockBox.max.x=stair.width/2+CHARACTER.radius;return{index,box,rockBox};
   });
   checked+=volumes.length;const bounds=new THREE.Box3();for(const{rockBox}of volumes)bounds.union(rockBox);
   for(const mesh of meshes){
    const transform=inverse.clone().multiply(mesh.matrixWorld),rock=mesh.name.startsWith('occluder_summit_rock_');
    triangles(mesh,transform,triangle=>{
     const aabb=new THREE.Box3().setFromPoints([triangle.a,triangle.b,triangle.c]);if(!bounds.intersectsBox(aabb))return;
     for(const{index,box,rockBox}of volumes)if((rock?rockBox:box).intersectsBox(aabb)&&(rock?rockBox:box).intersectsTriangle(triangle)){
      if(conflicts.length<12)conflicts.push(`${stair.id} tread ${index}: ${mesh.name}`);break;
     }
    });
   }
  }
  assert.equal(checked,310);assert.deepEqual(conflicts,[],'visible geometry must not occupy the stair corridor');
 });

 test(`${quality}: full station platforms and published path widths remain free of decorative rock`,()=>{
  const world=new R.World({x:0,y:0,z:0}),walk=new IslandWalkWorld(R,world,island,{...layout,solidRocks:[]}),meshes=rockMeshes(scene),conflicts=[];
  let checked=0;
  const inspect=(name,transform,boxes)=>{
   const bounds=new THREE.Box3();for(const box of boxes)bounds.union(box);checked+=boxes.length;
   for(const mesh of meshes)triangles(mesh,transform.clone().multiply(mesh.matrixWorld),triangle=>{
    const aabb=new THREE.Box3().setFromPoints([triangle.a,triangle.b,triangle.c]);if(!bounds.intersectsBox(aabb))return;
    if(boxes.some(box=>box.intersectsBox(aabb)&&box.intersectsTriangle(triangle))&&conflicts.length<12)conflicts.push(`${name}: ${mesh.name}`);
   });
  };
  try{
   for(const station of layout.railway.stations){
    const p=station.platform,margin=CHARACTER.radius;
    inspect(`platform ${station.id}`,new THREE.Matrix4(),[new THREE.Box3(new THREE.Vector3(p.x-p.width/2-margin,p.y+.08,p.z-p.depth/2-margin),new THREE.Vector3(p.x+p.width/2+margin,p.y+CHARACTER.height,p.z+p.depth/2+margin))]);
   }
   for(const path of layout.paths)for(let i=1;i<path.points.length;i++){
    const a=path.points[i-1],b=path.points[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(length<.001)continue;
    const angle=Math.atan2(dx,dz),transform=new THREE.Matrix4().makeRotationY(-angle).multiply(new THREE.Matrix4().makeTranslation(-a[0],0,-a[1])),boxes=[],width=path.width/2+CHARACTER.radius;
    const count=Math.ceil(length/.25);
    for(let n=0;n<count;n++){
     const from=n/count,to=(n+1)/count,t=(from+to)/2,point=localToWorld(island,{x:a[0]+dx*t,z:a[1]+dz*t}),y=walk.groundAt(point);
     boxes.push(new THREE.Box3(new THREE.Vector3(-width,y+.08,length*from+.005),new THREE.Vector3(width,y+CHARACTER.height,length*to-.005)));
    }
    inspect(`${path.id} segment ${i}`,transform,boxes);
   }
   assert.ok(checked>500);assert.deepEqual(conflicts,[],'rocks may frame the route but may not project into its full walking width');
  }finally{world.free();}
 });

 test(`${quality}: every rendered mountain rock uses the full exported physical shell`,()=>{
  const rocks=rockMeshes(scene);assert.equal(rocks.length,28);assert.equal(layout.solidRocks?.length,rocks.length);
  for(const mesh of rocks){
   const id=mesh.name.slice('occluder_summit_rock_'.length).replace(/_junction_rock$/,'');
   const solid=layout.solidRocks.find(rock=>rock.id===id);
   assert.ok(solid,`no collision shell for ${mesh.name}`);assert.ok(solid.vertices.length>=12&&solid.indices.length>=12);
   const expected=[];for(let i=0;i<solid.vertices.length;i+=3)expected.push(new THREE.Vector3(...solid.vertices.slice(i,i+3)));
   const actual=[];const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++)actual.push(new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld));
   // Compression may reorder/weld vertices. Compare geometric points in both
   // directions so neither a smaller collision box nor a low-LOD bulge passes.
   const tolerance=.005;
   for(const [from,to,label]of[[actual,expected,'rendered'],[expected,actual,'physical']])for(const point of from){
    const distance=Math.sqrt(Math.min(...to.map(candidate=>candidate.distanceToSquared(point))));
    assert.ok(distance<tolerance,`${mesh.name}: ${label} point differs by ${distance}m at ${point.toArray()}`);
   }
   assert.equal((mesh.geometry.index?.count??p.count)/3,solid.indices.length/3,`${mesh.name}: physical and visual topology must use the same shell`);
   const key=point=>point.toArray().map(value=>value.toFixed(6)).join(','),signature=keys=>[keys,keys.slice(1).concat(keys[0]),keys.slice(2).concat(keys.slice(0,2))].map(order=>order.join('|')).sort()[0];
   const faces=new Set();for(let i=0;i<solid.indices.length;i+=3)faces.add(signature(solid.indices.slice(i,i+3).map(index=>key(expected[index]))));
   const actualKeys=actual.map(point=>key(expected.reduce((nearest,candidate)=>candidate.distanceToSquared(point)<nearest.distanceToSquared(point)?candidate:nearest)));
   const index=mesh.geometry.index,count=index?.count??p.count;for(let i=0;i<count;i+=3){
    const face=signature([0,1,2].map(offset=>actualKeys[index?index.getX(i+offset):i+offset]));
    assert.ok(faces.has(face),`${mesh.name}: render face ${i/3} has different physical connectivity or winding`);
   }
  }
 });

 test(`${quality}: a capsule cannot occupy any sampled visible rock interior away from authored paths`,()=>{
  const world=new R.World({x:0,y:0,z:0}),walk=new IslandWalkWorld(R,world,island,layout),ray=new THREE.Raycaster();world.step();
  const failures=[];let samples=0,covered=0;
  try{
   for(const mesh of rockMeshes(scene)){
    const original=mesh.material;mesh.material=original.clone();mesh.material.side=THREE.DoubleSide;
    const bounds=new THREE.Box3().setFromObject(mesh);let checked=0;
    for(let x=bounds.min.x+.23;x<bounds.max.x;x+=.57)for(let z=bounds.min.z+.19;z<bounds.max.z;z+=.57){
     ray.set(new THREE.Vector3(x,bounds.max.y+.1,z),new THREE.Vector3(0,-1,0));ray.far=bounds.max.y-bounds.min.y+.2;
     const hits=ray.intersectObject(mesh,false),ys=[];for(const hit of hits)if(!ys.some(y=>Math.abs(y-hit.point.y)<.003))ys.push(hit.point.y);
     if(ys.length<2||ys[0]-ys.at(-1)<.15)continue;
     // Put the capsule's centre inside the real render shell. Its feet are
     // explicit: sampling the highest roof as ground would hide this defect.
     const middle=(ys[0]+ys.at(-1))/2,point=localToWorld(island,{x,z,y:middle-CHARACTER.height/2-CHARACTER.offset});
     samples++;checked++;if((!walk.rockIntersection(point)||walk.clear(point))&&failures.length<12)failures.push({mesh:mesh.name,x,z,y:point.y});
    }
    if(checked)covered++;mesh.material.dispose();mesh.material=original;
   }
   assert.equal(covered,28);assert.ok(samples>1500,`inspect off-route rock interiors, only ${samples} samples`);
   assert.deepEqual(failures,[],'a visually buried capsule must be rejected even where old terrain was clear');
  }finally{world.free();}
 });
}

test('Experience camera clearance sees the highest rendered rock, independently of foot support height',()=>{
 const calls=[],player={onLand:true,walking:true,island:{id:'experience',x:0,z:0,r:30,rotation:0},pauseReasons:new Set()},jack={root:new THREE.Group()};
 const walk={terrain:{},contains:point=>point.x>=0,nearStairs:()=>false,groundAt:()=>3,surfaceHeight:point=>{calls.push({...point});return 12;}};
 const game={player,jack,activeActor:{position:{x:0,y:3,z:0},velocity:{x:0,z:0},speed:0,yaw:0},character:{walkWorld:walk},focus:null,frozen:false,practice:{active:false},practiceFocus:()=>null,settings:{},cameraRig:{yaw:0},inputs:{read:()=>({}),readWalking:()=>({x:0,z:0})}};
 const camera=Game.prototype.cameraState.call(game),rayPoint={x:4,y:4,z:2};
 assert.equal(camera.terrainHeight(rayPoint),12,'a low camera ray cannot treat a tall visible rock as the floor below it');
 assert.deepEqual(calls,[rayPoint]);assert.equal(camera.terrainHeight({x:-4,y:4,z:2}),null,'water remains outside terrain obstruction queries');
});
