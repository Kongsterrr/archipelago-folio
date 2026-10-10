import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import R from '@dimforge/rapier3d-compat/rapier.es.js';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {islands} from '../sources/config.js';
import {TerrainSurface} from '../sources/core/terrain.js';
import {CharacterController, IslandWalkWorld, localToWorld} from '../sources/core/character.js';
import {pointInPolygon} from '../sources/core/dock.js';
import {sampleTrainMotion,trainDuration} from '../sources/core/train-path.js';

const layout=JSON.parse(await fs.readFile(new URL('../static/models/walk-layout.json',import.meta.url),'utf8')).islands.find(item=>item.id==='experience');
const island=islands.find(item=>item.id==='experience');
const DT=1/60;
await R.init();

async function loadModel(quality) {
  const bytes=await fs.readFile(new URL(`../static/models/${quality==='low'?'low/':''}experience.glb`,import.meta.url));
  const {scene}=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  scene.updateMatrixWorld(true);return scene;
}

function fixture(localPoint) {
  const world=new R.World({x:0,y:0,z:0});world.timestep=DT;
  const walk=new IslandWalkWorld(R,world,island,layout),actor=new CharacterController(R,world);
  const start=localToWorld(island,localPoint);start.y=walk.groundAt(start);
  actor.teleport(start,walk);actor.enable(true);world.step();
  let rescues=0;const teleport=actor.teleport.bind(actor);
  actor.teleport=(...args)=>{rescues++;return teleport(...args);};
  return {world,walk,actor,get rescues(){return rescues;}};
}

function walkRoute(f,route,{maxFrameHeight=.19,run=false}={}) {
  const speed=run?4.8:2.4;
  let highest=f.actor.position.y,lowest=highest;
  for(const [x,z] of route) {
    const target=localToWorld(island,{x,z});
    const frames=Math.ceil((Math.hypot(target.x-f.actor.position.x,target.z-f.actor.position.z)/speed+5)/DT);
    let reached=false;
    for(let frame=0;frame<frames;frame++) {
      const before=f.actor.position,dx=target.x-before.x,dz=target.z-before.z,distance=Math.hypot(dx,dz);
      if(distance<.065){reached=true;break;}
      const amount=Math.min(1,distance/(speed*DT));
      f.actor.step({x:dx/distance*amount,z:dz/distance*amount,run},DT);f.world.step();f.actor.afterStep();
      const after=f.actor.position;
      assert.ok(Math.abs(after.y-before.y)<=maxFrameHeight,`abrupt height change before ${x},${z}: ${before.y} -> ${after.y}`);
      assert.ok(Math.hypot(after.x-before.x,after.z-before.z)<speed*DT+.025,`unexpected horizontal movement before ${x},${z}: ${JSON.stringify({before,after,rescues:f.rescues})}`);
      // A capsule can sit slightly ahead of the tread under its centre while
      // climbing. One riser of tolerance is intentional, never a floor drop.
      assert.ok(Math.abs(after.y-f.walk.groundAt(after))<.18,`feet lose tread support before ${x},${z}: feet=${after.y}, ground=${f.walk.groundAt(after)}`);
      highest=Math.max(highest,after.y);lowest=Math.min(lowest,after.y);
    }
    assert.ok(reached,`real Rapier character stalled approaching ${x},${z}; last world position ${JSON.stringify(f.actor.position)}`);
  }
  return {highest,lowest};
}

function containingTriangles(surface,x,z,strict=false) {
  return (surface.bins.get(`${Math.floor(x/surface.cell)},${Math.floor(z/surface.cell)}`)||[]).filter(t=>{
    const {a,b,c,determinant}=t;
    const u=((b.z-c.z)*(x-c.x)+(c.x-b.x)*(z-c.z))/determinant;
    const v=((c.z-a.z)*(x-c.x)+(a.x-c.x)*(z-c.z))/determinant;
    return [u,v,1-u-v].every(n=>strict?n>1e-7:n>=-1e-7);
  });
}

test('the Experience terrain is a single-valued surface with one broad court and a higher station',()=>{
  assert.ok(layout.terrain?.indices.length>300,'Career Terraces must have a shared indexed terrain');
  const surface=new TerrainSurface(layout.terrain);
  assert.ok(Math.abs(surface.sample(0,25).height-.85)<.001,'quay elevation remains unchanged');
  assert.ok(Math.abs(surface.sample(0,12).height-2.4)<.001,'court is genuinely elevated');
  assert.ok(Math.abs(surface.sample(0,-5).height-5.8)<.001,'station terrace rises above the court');
  assert.equal(layout.terrain.navigation?.maxClimbSlopeDegrees,undefined,'architectural stairs use the capsule and actual support, not mountain snapping');
  for(const triangle of surface.triangles) {
    const x=(triangle.a.x+triangle.b.x+triangle.c.x)/3,z=(triangle.a.z+triangle.b.z+triangle.c.z)/3;
    assert.equal(containingTriangles(surface,x,z,true).length,1,`overlapping walkable terrain at ${x},${z}`);
    assert.ok(pointInPolygon({x,z},layout.shore),`terrain leaves the preserved shore at ${x},${z}`);
    assert.ok(Math.abs(surface.sample(x,z).height-(triangle.a.y+triangle.b.y+triangle.c.y)/3)<1e-5,'height queries agree with each authored triangle');
  }
});

test('terrain covers the island without holes or conflicting height samples on public streets',()=>{
  const surface=new TerrainSurface(layout.terrain);
  for(let x=-37;x<37;x+=.71)for(let z=-28;z<29;z+=.73) {
    if(!pointInPolygon({x,z},layout.shore))continue;
    assert.ok(surface.sample(x,z),`terrain has a hole at ${x},${z}`);
  }
  const f=fixture({x:0,z:35.5});
  try {
    for(const path of layout.paths.filter(item=>item.main))for(let n=1;n<path.points.length;n++) {
      const a=path.points[n-1],b=path.points[n],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
      for(let t=.12;t<length;t+=.43) {
        const x=a[0]+(b[0]-a[0])*t/length,z=a[1]+(b[1]-a[1])*t/length,point=localToWorld(island,{x,z});
        const height=f.walk.groundAt(point);
        const hit=f.world.castRay(new R.Ray({x:point.x,y:20,z:point.z},{x:0,y:-1,z:0}),25,true,undefined,undefined,undefined,undefined,c=>f.walk.colliders.includes(c)&&!f.walk.obstacles.includes(c));
        assert.ok(hit,`${path.id}: terrain collider missing`);
        assert.ok(Math.abs(20-hit.timeOfImpact-height)<.012,`${path.id}: visual height and real collision disagree at ${x},${z}`);
      }
    }
  } finally {f.world.free();}
});

for(const run of [false,true])for(const offset of [-2.2,0,2.2])test(`real Rapier visitor ${run?'runs':'walks'} up and down the broad central stairs at x=${offset}`,()=>{
  const f=fixture({x:offset,z:10.6});
  try {
    const {highest,lowest}=walkRoute(f,[[offset,-3.6],[offset,10.6]],{run});
    assert.ok(highest>5.76&&lowest<2.45,'the route covers the complete 3.4m rise');
    assert.equal(f.rescues,0,'stairs must not rely on recovery teleportation');
    assert.ok(Math.abs(f.actor.position.y-2.4)<.035,'feet return to the courtyard floor');
  } finally {f.world.free();}
});

test('diagonal approaches cross real stair treads without turning a seam into an invisible wall',()=>{
  const f=fixture({x:-2.2,z:10.6});
  try {
    const {highest}=walkRoute(f,[[2.2,-3.6],[-2.2,10.6]]);
    assert.ok(highest>5.76,'diagonal walking reaches the upper terrace');
    assert.equal(f.rescues,0);
    assert.ok(Math.abs(f.actor.position.y-2.4)<.035);
  } finally {f.world.free();}
});

test('leaving the stairs restores ordinary street and harbor-ramp movement',()=>{
  const f=fixture({x:0,z:10.6});
  try {
    walkRoute(f,[[0,-4.2],[-14.2,-4.2],[-28.1,-4.2],[-28.1,-2.2],[-28.1,17.8],[-28.1,19.8],[-20.1,14],[-20.1,6],[-12,6],[-12,10.5],[0,10.5],[0,12.5],[0,24.5],[0,27]],{run:true});
    assert.equal(f.rescues,0,'stair profile cannot remain active or recover a broken slope transition');
    assert.ok(Math.abs(f.actor.position.y-.85)<.035,'visitor returns down both ordinary slopes to quay level');
  } finally {f.world.free();}
});

test('long architectural ramps preserve controlled walk and run speeds in either direction',()=>{
  for(const ramp of layout.ramps)for(const run of [false,true])for(const direction of [-1,1]) {
    const start={x:ramp.x,z:ramp.z-direction*(ramp.depth/2-1.2)},f=fixture(start),speed=run?4.8:2.4;
    try {
      const end=localToWorld(island,{x:ramp.x,z:ramp.z+direction*(ramp.depth/2-1.2)});
      const initial={...f.actor.position},distance=Math.hypot(end.x-initial.x,end.z-initial.z);
      let frames=0,travelled=0;
      while(frames<Math.ceil(distance/speed*1.15/DT)) {
        const before=f.actor.position,dx=end.x-before.x,dz=end.z-before.z,d=Math.hypot(dx,dz);
        if(d<.065)break;
        f.actor.step({x:dx/d,z:dz/d,run},DT);f.world.step();f.actor.afterStep();frames++;
        const after=f.actor.position,step=Math.hypot(after.x-before.x,after.z-before.z);travelled+=step;
        assert.ok(step<=speed*DT*1.1,`${ramp.id}: descending support must not propel Jack faster than his input`);
        assert.ok(Math.abs(after.y-f.walk.groundAt(after))<.045,`${ramp.id}: actual capsule stays on the incline`);
      }
      assert.ok(Math.hypot(end.x-f.actor.position.x,end.z-f.actor.position.z)<.065,`${ramp.id}: climbing must not fight excessive downward movement`);
      assert.ok(travelled/(frames*DT)>speed*.88,`${ramp.id}: ordinary climbing remains close to the selected speed`);
      const parked={...f.actor.position};
      for(let n=0;n<120;n++){f.actor.step({x:0,z:0},DT);f.world.step();f.actor.afterStep();}
      assert.ok(Math.hypot(parked.x-f.actor.position.x,parked.z-f.actor.position.z)<.025,`${ramp.id}: releasing the controls cannot slide Jack down the road`);
      assert.equal(f.rescues,0);
    } finally {f.world.free();}
  }
});

test('real ramp and stair movement agrees at 30, 60 and 120 rendering frames per second',()=>{
  for(const scenario of [{start:{x:-28.1,z:16.3},seconds:9,run:false},{start:{x:0,z:9.5},seconds:7,run:false},{start:{x:2.2,z:9.5},seconds:3.5,run:true}]) {
    const positions=[];
    for(const fps of [30,60,120]) {
      const f=fixture(scenario.start);
      try {
        const forward={x:-Math.sin(island.rotation),z:-Math.cos(island.rotation),run:scenario.run};
        let accumulated=0;
        for(let frame=0;frame<fps*scenario.seconds;frame++) {
          accumulated+=1/fps;
          while(accumulated+1e-9>=DT){f.actor.step(forward,DT);f.world.step();f.actor.afterStep();accumulated-=DT;}
        }
        assert.equal(f.rescues,0);positions.push(f.actor.position);
      } finally {f.world.free();}
    }
    for(const p of positions)assert.ok(Math.hypot(p.x-positions[0].x,p.y-positions[0].y,p.z-positions[0].z)<.01,'render schedule cannot change the actual terrace journey');
    assert.ok(positions[0].y>5.4,`each schedule genuinely climbs to the upper part of the island: ${JSON.stringify({scenario,position:positions[0]})}`);
  }
});

for(const berth of layout.berths)test(`both directions of the complete Career Terraces tour work from dock x=${berth.landing.x}`,()=>{
  const f=fixture(berth.landing);
  try {
    const tour=layout.route;
    walkRoute(f,[...tour,...[...tour].reverse(),[berth.landing.x,berth.landing.z]]);
    assert.equal(f.rescues,0,'the complete circuit must not rescue visitors across a broken seam');
    assert.ok(Math.abs(f.actor.position.y-.85)<.035,'tour returns to the original dock level');
  } finally {f.world.free();}
});

for(const quality of ['high','low'])test(`${quality}: visible stairs agree with their exported height and actual support collision`,async()=>{
  const scene=await loadModel(quality),f=fixture({x:0,z:12}),ray=new THREE.Raycaster();
  try {
    const stairs=layout.stairs[0];
    assert.ok(stairs&&stairs.stepCount>=25,'the central rise uses real small stair risers');
    assert.ok(stairs.treadHeight<=.14&&stairs.treadDepth>=.34);
    const heights=new Set();
    for(const tread of [...stairs.treads,stairs.landing])for(const x of [-2.2,0,2.2]) {
      const z=tread.z;
      const point=localToWorld(island,{x,z}),height=f.walk.groundAt(point);
      heights.add(height.toFixed(3));
      const hit=f.world.castRay(new R.Ray({x:point.x,y:20,z:point.z},{x:0,y:-1,z:0}),25,true,undefined,undefined,undefined,undefined,c=>f.walk.colliders.includes(c)&&!f.walk.obstacles.includes(c));
      assert.ok(hit&&Math.abs(20-hit.timeOfImpact-height)<.006,`actual stair collision differs at ${x},${z}`);
      ray.set(new THREE.Vector3(x,20,z),new THREE.Vector3(0,-1,0));
      assert.ok(ray.intersectObject(scene,true).some(hit=>Math.abs(hit.point.y-height)<.018),`${quality}: rendered tread and support do not meet at ${x},${z}`);
    }
    assert.ok(heights.size>=24,'height samples resolve individual treads instead of one invisible ramp');
  } finally {f.world.free();}
});

function polygonsOverlap(a,b) {
  for(const polygon of [a,b])for(let n=0;n<polygon.length;n++) {
    const p=polygon[n],q=polygon[(n+1)%polygon.length],nx=q[1]-p[1],nz=p[0]-q[0];
    const projection=points=>points.map(([x,z])=>x*nx+z*nz),pa=projection(a),pb=projection(b);
    if(Math.max(...pa)<=Math.min(...pb)+1e-7||Math.max(...pb)<=Math.min(...pa)+1e-7)return false;
  }
  return true;
}
function rectangle(x,z,width,depth,yaw=0) {
  const c=Math.cos(yaw),s=Math.sin(yaw);
  return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>[x+a*width/2*c+b*depth/2*s,z-a*width/2*s+b*depth/2*c]);
}

for(const quality of ['high','low'])test(`${quality}: both complete train cars stay behind the station and clear architecture around their whole loop`,async()=>{
  const scene=await loadModel(quality),district=layout.districts.find(item=>item.id==='amtrak'),track=district.animation.train,duration=trainDuration(track);
  assert.ok(track.path&&track.cars?.length===2,'rear railroad has two independent following car owners');
  assert.ok(duration>=38&&duration<=43,'the loop runs near its planned two metres per second');
  const cars=track.cars.map(car=>{
    const node=scene.getObjectByName(car.name);assert.ok(node,`${car.name}: complete train geometry exists`);
    node.position.set(0,0,0);node.rotation.set(0,0,0);scene.updateMatrixWorld(true);
    const box=new THREE.Box3();
    node.traverse(mesh=>{if(!mesh.isMesh)return;const p=mesh.geometry.attributes.position;for(let n=0;n<p.count;n++)box.expandByPoint(node.worldToLocal(new THREE.Vector3().fromBufferAttribute(p,n).applyMatrix4(mesh.matrixWorld)));});
    const size=box.getSize(new THREE.Vector3());
    assert.ok(size.x>.7&&size.z>1.5&&size.y>.8,`${car.name}: test covers complete carriage geometry`);
    return {car,node,box};
  });
  for(let sample=0;sample<160;sample++) {
   const carFootprints=[];
   for(const {car,node,box} of cars) {
    const pose=sampleTrainMotion(track,sample/160*duration,duration,car.offset);
    node.position.set(pose.x,pose.y,pose.z);node.rotation.y=pose.yaw;scene.updateMatrixWorld(true);
    const corners=[[box.min.x,box.min.z],[box.max.x,box.min.z],[box.max.x,box.max.z],[box.min.x,box.max.z]].map(([x,z])=>node.localToWorld(new THREE.Vector3(x,box.min.y,z)));
    for(const corner of corners) {
      assert.ok(pointInPolygon(corner,layout.shore),`${quality}: ${car.name} leaves the preserved shore at step ${sample}`);
      assert.ok(corner.z<-17.6,`${car.name} cuts into the rear pedestrian platform`);
    }
    const footprint=corners.map(p=>[p.x,p.z]),lowest=node.localToWorld(new THREE.Vector3(0,box.min.y,0)).y,highest=node.localToWorld(new THREE.Vector3(0,box.max.y,0)).y;
    carFootprints.push(footprint);
    for(const obstacle of layout.obstacles) {
      const bottom=obstacle.y??layout.groundY,top=bottom+obstacle.height;
      if(top<=lowest+.03||bottom>=highest-.03)continue;
      assert.ok(!polygonsOverlap(footprint,rectangle(obstacle.x,obstacle.z,obstacle.width,obstacle.depth,obstacle.rotation)),`${quality}: ${car.name} intersects ${obstacle.id||obstacle.name||'architecture'} at sample ${sample}`);
    }
   }
   assert.ok(!polygonsOverlap(carFootprints[0],carFootprints[1]),`${quality}: complete carriage geometry overlaps in turn ${sample}`);
  }
});
