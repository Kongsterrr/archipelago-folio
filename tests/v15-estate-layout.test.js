// Copy into tests/v15-estate-layout.test.js after integrating the V15 generator.
// The small scene helper records actual vertex data and authored colliders,
// independently checking the generator before GLB merging or quantization.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {buildAboutEstate} from '../scripts/lib/about-estate.mjs';

const shipped=JSON.parse(await fs.readFile(new URL('../static/models/walk-layout.json',import.meta.url),'utf8')).islands.find(i=>i.id==='about');
function fixture(low=false){
 const layout={id:'about',groundY:.85,shore:shipped.shore,surfaces:[],obstacles:[],stations:[],benches:[],dock:shipped.dock};
 const root=new THREE.Group(),materials=new Map();
 const mesh=(g,m,p=[0,0,0],r=[0,0,0],parent=root)=>{if(!materials.has(m))materials.set(m,new THREE.MeshBasicMaterial({name:m}));const o=new THREE.Mesh(g,materials.get(m));o.position.set(...p);o.rotation.set(...r);parent.add(o);return o;};
 const group=(p=[0,0,0],r=[0,0,0],parent=root)=>{const o=new THREE.Group();o.position.set(...p);o.rotation.set(...r);parent.add(o);return o;};
 const box=(w,h,d,x,y,z,m,r=[0,0,0],p=root)=>mesh(new THREE.BoxGeometry(w,h,d),m,[x,y,z],r,p);
 const bevel=(w,h,d,x,y,z,m,b,r=[0,0,0],p=root)=>box(w,h,d,x,y,z,m,r,p);
 const cyl=(rt,rb,h,x,y,z,m,n=10,r=[0,0,0],p=root)=>mesh(new THREE.CylinderGeometry(rt,rb,h,n),m,[x,y,z],r,p);
 const cone=(r,h,x,y,z,m,n,p=root)=>cyl(0,r,h,x,y,z,m,n,[0,0,0],p);
 const rod=(a,b,r,m,p=root,n=8)=>{const aa=new THREE.Vector3(...a),bb=new THREE.Vector3(...b);const o=cyl(r,r,aa.distanceTo(bb),...aa.clone().add(bb).multiplyScalar(.5).toArray(),m,n,[0,0,0],p);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),bb.sub(aa).normalize());return o;};
 const torus=(r,t,x,y,z,m,rot=[0,0,0],n=8,v=12,p=root)=>mesh(new THREE.TorusGeometry(r,t,n,v),m,[x,y,z],rot,p);
 const solid=(x,z,w,d,h=1,y=.85,rotation=0,name='obstacle')=>layout.obstacles.push({x,z,width:w,depth:d,height:h,y,rotation,name});
 buildAboutEstate({root,layout,low,Y:.85,box,bevel,cyl,cone,mesh,rod,torus,text3D:()=>{},group,solid,slatBench:()=>{},lamp:()=>{},books:()=>{},harborPath:()=>{}});
 root.updateMatrixWorld(true);return{root,layout};
}
function blockers(l,x,z,r=.3){return l.obstacles.filter(o=>{const c=Math.cos(o.rotation||0),s=Math.sin(o.rotation||0),dx=x-o.x,dz=z-o.z;return Math.abs(dx*c-dz*s)<o.width/2+r&&Math.abs(dx*s+dz*c)<o.depth/2+r;});}
function inside(poly,x,z){let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const[a,b]=poly[i],[d,e]=poly[j];if((b>z)!=(e>z)&&x<(d-a)*(z-b)/(e-b)+a)c=!c;}return c;}
function edge(poly,x,z){return Math.min(...poly.map((a,i)=>{const b=poly[(i+1)%poly.length],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);}));}
function samples(points){const out=[];for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.15);for(let j=0;j<=n;j++)out.push([a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n]);}return out;}
const high=fixture(),low=fixture(true);

test('estate has four usable empty bays with genuinely clear full-size vehicle envelopes',()=>{
 const l=high.layout;assert.equal(l.garageBays.length,4);assert.deepEqual(l.garageBays.map(b=>b.id),['01','02','03','04']);
 for(const bay of l.garageBays){assert.ok(bay.width>=3&&bay.depth>=6.5);assert.ok(bay.entrance.width>=3);const car=bay.carEnvelope;assert.ok(car.width>=2.3&&car.depth>=5.2);
  const hits=l.obstacles.filter(o=>Math.abs(o.x-car.x)<(o.width+car.width)/2&&Math.abs(o.z-car.z)<(o.depth+car.depth)/2);
  assert.equal(hits.length,0,`bay ${bay.id}: ${hits.map(o=>o.name)}`);
  for(const[x,z]of samples([[bay.x,15.6],[bay.x,bay.z]]))assert.equal(blockers(l,x,z,1.14).length,0,`bay ${bay.id} can be approached straight through its own door`);
 }
});

test('estate continuous 2.6 m touring paths and every station remain clear inside the expanded shore',()=>{
 const l=high.layout;
 for(const path of l.paths){assert.ok(path.width>=2.6);for(const[x,z]of samples(path.points)){
  const collision=blockers(l,x,z,1.19);assert.equal(collision.length,0,`${path.id} ${x},${z}: ${collision.map(o=>o.name)}`);
  if(Math.abs(x)<l.dock.width/2&&z>l.dock.startZ-.6)continue;
  assert.ok(inside(l.shore,x,z),`${path.id} stays on the real coast`);assert.ok(edge(l.shore,x,z)>=1.19,`${path.id} has shore-edge clearance`);
 }}
 for(const station of l.stations){assert.equal(blockers(l,station.x,station.z,.28).length,0,station.id+' approach is clear');assert.ok(inside(l.shore,station.x,station.z),station.id+' stays on shore');}
 for(const bench of l.benches)assert.equal(blockers(l,bench.approach.x,bench.approach.z,.24).length,0,bench.id+' seat approach is clear');
 for(const floor of l.surfaces)for(const x of[floor.x-floor.width/2,floor.x+floor.width/2])for(const z of[floor.z-floor.depth/2,floor.z+floor.depth/2])assert.ok(inside(l.shore,x,z),'estate floor corners stay on shore');
});

test('open house has real front/rear portals and only the ground level is navigable',()=>{
 const l=high.layout,house=l.interiors.find(i=>i.landmarkId==='jack-house');assert.equal(house.floorY,.85);assert.equal(house.entrances.length,2);assert.ok(house.entrances.every(e=>e.width>=3.2));
 for(const[x,z]of samples(house.walkRoute))assert.equal(blockers(l,x,z,1.19).length,0,'full clear hall from front to rear');
 for(const room of house.rooms)assert.equal(blockers(l,room.x,room.z,.24).length,0,room.id+' room has usable ground');
 assert.ok(l.surfaces.every(s=>s.y>=.85&&s.y<=.875001),'no roof or upper-floor visual geometry becomes a support surface');
 assert.ok(!l.obstacles.some(o=>/upper|roof/.test(o.name)),'no cantilever casts a ground-level invisible box');
 const names=house.cutawayGroups;assert.ok(names.includes('occluder_estate_house_upper')&&names.includes('occluder_estate_house_roof'));
 for(const i of l.interiors)for(const name of i.cutawayGroups){const node=high.root.getObjectByName(name);assert.ok(node,'explicit cutaway group exists');assert.ok(!new THREE.Box3().setFromObject(node).isEmpty());assert.ok(name.startsWith('occluder_'),'standard exporter prefix retains the group');}
});

test('high and low estate metadata preserve precisely the same navigation and sport rules',()=>{
 for(const key of['stations','surfaces','obstacles','paths','garageBays','interiors','sports','districts'])assert.deepEqual(low.layout[key],high.layout[key],key+' is independent of visual detail');
 assert.deepEqual(high.layout.districts.map(d=>d.id),['harbor','connect']);
 assert.ok(high.layout.stations.some(s=>s.type==='studio'&&s.id==='harbor:studio'));
 assert.ok(high.layout.stations.some(s=>s.action==='harbor'&&s.id==='harbor:bell'));
 assert.ok(high.layout.stations.some(s=>s.action==='connect'&&s.id==='connect:signal'));
});

test('golf visible vertices follow the exported slope equation and give the three intended distances',()=>{
 const l=high.layout;assert.deepEqual(l.sports.golf.holes.map(h=>h.length),[6,8,10]);
 for(const fixture of[high,low]){let count=0;fixture.root.traverse(o=>{if(!o.isMesh||o.material.name!=='estate_green')return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){
   const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld),hole=l.sports.golf.holes.find(h=>Math.abs(v.z-h.tee.z)<1.1);assert.ok(hole);
   const expected=l.groundY+.035+hole.slopeX*(v.x-hole.tee.x)+hole.slopeZ*(v.z-hole.tee.z)+hole.undulation*Math.sin((v.x+9)/18*Math.PI)**2;
   assert.ok(Math.abs(v.y-expected)<1e-6,'ball and visible green use the same ground equation');count++;
  }});assert.ok(count>150,'actual green surfaces are present');}
});

for(const quality of ['high','low'])test(`${quality}: exported estate retains both action roots, complete cutaways and ground-floor door gaps`,async()=>{
 const bytes=await fs.readFile(new URL(`../static/models/${quality==='low'?'low/':''}about.glb`,import.meta.url));
 assert.ok(bytes.length<=(quality==='low'?1_000_000:1_500_000),'estate fits its compressed model budget');
 const model=(await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;model.updateMatrixWorld(true);
 for(const name of['district_harbor','district_connect','anim_bell','anim_signal_light_0','anim_signal_light_5',...high.layout.interiors.flatMap(i=>i.cutawayGroups)])assert.ok(model.getObjectByName(name),name+' survives export');
 const hall=new THREE.Raycaster(new THREE.Vector3(-4,1.5,1),new THREE.Vector3(0,0,-1),0,18);
 const hits=hall.intersectObject(model,true).filter(hit=>hit.object.material?.name!=='estate_clear');
 assert.equal(hits.length,0,'real opaque mesh does not block the clear front-to-rear hall');
 const upper=new THREE.Box3().setFromObject(model.getObjectByName('occluder_estate_house_upper'));assert.ok(upper.min.y>=3.9&&upper.max.y>7,'two-storey silhouette remains scenic above ground');
});
