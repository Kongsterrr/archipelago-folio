import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const project=process.env.GARAGE_TEST_PROJECT||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const assetRoot=process.env.GARAGE_TEST_ASSETS||path.join(project,'static/models');
const require=createRequire(path.join(project,'package.json'));
const {NodeIO}=require('@gltf-transform/core');
const {ALL_EXTENSIONS}=require('@gltf-transform/extensions');
const {MeshoptDecoder}=require('meshoptimizer');
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
function meshData(node){
 const primitive=node.getMesh().listPrimitives()[0],position=primitive.getAttribute('POSITION'),normal=primitive.getAttribute('NORMAL'),index=primitive.getIndices(),matrix=node.getMatrix(),points=[],normals=[],v=[],n=[];
 for(let i=0;i<position.getCount();i++){position.getElement(i,v);normal.getElement(i,n);points.push([0,1,2].map(a=>matrix[a]*v[0]+matrix[a+4]*v[1]+matrix[a+8]*v[2]+matrix[a+12]));normals.push(n.slice());}
 return {primitive,points,normals,index};
}
function radialSection(points,index,x){
 const segments=[];
 for(let i=0;i<index.getCount();i+=3){const ids=[index.getScalar(i),index.getScalar(i+1),index.getScalar(i+2)],hits=[];for(let e=0;e<3;e++){const a=points[ids[e]],b=points[ids[(e+1)%3]],dx=b[0]-a[0];if(Math.abs(dx)<1e-12)continue;const t=(x-a[0])/dx;if(t>=0&&t<1)hits.push([a[1]+t*(b[1]-a[1]),a[2]+t*(b[2]-a[2])]);}if(hits.length===2)segments.push(hits);}
 const radii=[];
 for(let i=0;i<128;i++){const angle=i*2*Math.PI/128,dy=Math.cos(angle),dz=Math.sin(angle);let radius=-Infinity;for(const [a,b]of segments){const vy=b[0]-a[0],vz=b[1]-a[1],den=dy*vz-dz*vy;if(Math.abs(den)<1e-12)continue;const t=(a[0]*dz-a[1]*dy)/den,r=(a[0]*vz-a[1]*vy)/den;if(t>=0&&t<=1&&r>radius)radius=r;}if(radius>0)radii.push(radius);}
 return radii;
}
for(const quality of ['high','low'])test(`911 ${quality}: complete round tires and non-rolling calipers`,async()=>{
 const file=path.join(assetRoot,quality==='low'?'low':'','car-911.glb'),document=await io.read(file),nodes=document.getRoot().listNodes(),find=name=>nodes.find(n=>n.getName()===name),rig=nodes.find(n=>n.getExtras().carRig).getExtras().carRig;
 assert.equal(rig.wheelNodes.length,4);
 for(const name of rig.wheelNodes){
  const wheel=find(name),suffix=name.replace('car-wheel-',''),front=suffix.startsWith('front'),side=suffix.endsWith('left')?1:-1,tire=find('car-tire-'+suffix+'-surface'),brake=find('car-brake-'+suffix),alloy=find(name+'-surface');
  assert(wheel&&tire&&brake&&alloy,`${suffix}: missing preserved alloy, tire, or brake`);
  assert.equal(tire.getParentNode(),wheel);assert.equal(alloy.getParentNode(),wheel);
  assert.equal(brake.getParentNode(),wheel.getParentNode(),`${suffix}: brake must be sibling of rolling wheel`);
  if(front)assert.equal(wheel.getParentNode().getName(),'car-steer-'+suffix);
  assert(rig.wheelRadii[name]>.3&&rig.wheelRadii[name]<.4);
  const pivot=rig.wheelCenters[name],matrix=wheel.getWorldMatrix();assert(Math.hypot(matrix[12]-pivot[0],matrix[13]-pivot[1],matrix[14]-pivot[2])<1e-8);
  const {points,index,normals}=meshData(tire);
  for(let i=0;i<index.getCount();i+=3){const ids=[index.getScalar(i),index.getScalar(i+1),index.getScalar(i+2)],[a,b,c]=ids.map(id=>points[id]),ab=b.map((v,k)=>v-a[k]),ac=c.map((v,k)=>v-a[k]),cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]],n=normals[ids[0]];assert(cross[0]*n[0]+cross[1]*n[1]+cross[2]*n[2]>0,`${suffix}: inward tire face`);}
  for(const absX of front?[.143,.148,.17,.19,.194,.196]:[.143,.148,.17,.194,.198,.2]){const x=-side*absX*rig.sourceScale-pivot[0],radii=radialSection(points,index,x);assert.equal(radii.length,128,`${suffix}: incomplete sidewall/tread at source x=${absX}`);assert(Math.max(...radii)-Math.min(...radii)<.001,`${suffix}: radial variation exceeds 1mm at source x=${absX}`);}
  const before=brake.getWorldMatrix().slice();for(const angle of [Math.PI/2,Math.PI,Math.PI*1.5]){wheel.setRotation([Math.sin(angle/2),0,0,Math.cos(angle/2)]);assert.deepEqual(brake.getWorldMatrix(),before,`${suffix}: caliper rolls with wheel`);}wheel.setRotation([0,0,0,1]);
  if(front){const steer=wheel.getParentNode();steer.setRotation([0,Math.sin(.2),0,Math.cos(.2)]);assert.notDeepEqual(brake.getWorldMatrix(),before,`${suffix}: caliper must follow steering`);steer.setRotation([0,0,0,1]);}
 }
});
