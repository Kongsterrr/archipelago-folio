// Original single-cabin coastal funicular with a level cabin and inclined chassis.
// Run independently: node scripts/build-career-train.mjs
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup,meshopt} from '@gltf-transform/functions';
import {MeshoptEncoder,MeshoptDecoder} from 'meshoptimizer';
import {CAREER_TRAIN} from '../sources/core/career-train.js';

globalThis.FileReader=class{async readAsArrayBuffer(blob){this.result=await blob.arrayBuffer();this.onloadend?.({target:this});}async readAsDataURL(blob){this.result=`data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`;this.onloadend?.({target:this});}};
const font=new FontLoader().parse(JSON.parse(await fs.readFile(new URL('../node_modules/three/examples/fonts/helvetiker_bold.typeface.json',import.meta.url),'utf8')));
const colors={navy:'#234557',inset:'#193947',cream:'#f4e7c9',copper:'#b88550',wood:'#a67345',woodLight:'#cfab74',steel:'#48545b',rubber:'#293237',glass:'#b9d4d4',lamp:'#ffe3a1',red:'#aa5147'};
const mats=Object.fromEntries(Object.entries(colors).map(([name,color])=>[name,new THREE.MeshStandardMaterial({name:'career_train_'+name,color,roughness:name==='glass'?.22:/copper|steel/.test(name)?.38:.72,metalness:/copper|steel/.test(name)?.55:0,transparent:name==='glass',opacity:name==='glass'?.17:1,depthWrite:name!=='glass',side:name==='glass'?THREE.DoubleSide:THREE.FrontSide,...(name==='lamp'?{emissive:'#ffc16b',emissiveIntensity:.65}:{})})]));
const root=new THREE.Group();root.name='career-train';
const owners=[],group=(name,parent=root,position=[0,0,0])=>{const g=new THREE.Group();g.name=name;g.position.set(...position);parent.add(g);owners.push(g);return g;};
function mesh(geometry,material,position,parent,rotation=[0,0,0]){const m=new THREE.Mesh(geometry,mats[material]);m.position.set(...position);m.rotation.set(...rotation);parent.add(m);return m;}
const box=(w,h,d,x,y,z,m,p)=>mesh(new THREE.BoxGeometry(w,h,d),m,[x,y,z],p);
const cyl=(rt,rb,h,x,y,z,m,p,rotation=[0,0,0],segments=18)=>mesh(new THREE.CylinderGeometry(rt,rb,h,segments),m,[x,y,z],p,rotation);
const torus=(r,t,x,y,z,m,p,rotation=[0,0,0])=>mesh(new THREE.TorusGeometry(r,t,6,24),m,[x,y,z],p,rotation);
function rod(a,b,r,m,p){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),delta=bv.clone().sub(av),o=cyl(r,r,delta.length(),...av.clone().add(bv).multiplyScalar(.5).toArray(),m,p);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return o;}
function text(word,size,x,y,z,m,p,rotation=[0,0,0]){const geometry=new TextGeometry(word,{font,size,depth:.005,curveSegments:3,bevelEnabled:false});geometry.computeBoundingBox();geometry.translate(-(geometry.boundingBox.max.x+geometry.boundingBox.min.x)/2,0,0);return mesh(geometry,m,[x,y,z],p,rotation);}
function rivet(x,y,z,p){mesh(new THREE.IcosahedronGeometry(.018,1),'copper',[x,y,z],p);}
const DESIGN_PITCH=27.50095*Math.PI/180,FLOOR=1.65,DECK=.075,ROOF=3.48;
const cabin=group('career-funicular'),chassis=group('funicular-chassis',cabin);chassis.rotation.x=DESIGN_PITCH;
function roundedPanel(w,h,d,r,x,y,z,m,p,rotation=[0,0,0]){const s=new THREE.Shape();s.moveTo(-w/2+r,-h/2);s.lineTo(w/2-r,-h/2);s.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);s.lineTo(w/2,h/2-r);s.quadraticCurveTo(w/2,h/2,w/2-r,h/2);s.lineTo(-w/2+r,h/2);s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);s.lineTo(-w/2,-h/2+r);s.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);const g=new THREE.ExtrudeGeometry(s,{depth:d,bevelEnabled:false,curveSegments:5});g.translate(0,0,-d/2);return mesh(g,m,[x,y,z],p,rotation);}

// Inclined lower beams, a cable grip and brake assembly form the mechanical
// chassis. A separate wedge of slender supports carries the horizontal floor.
for(const x of[-.70,.70])box(.16,.18,4.55,x,.29,0,'steel',chassis);
for(const z of[-1.95,-1.05,0,1.05,1.95])box(1.60,.14,.14,0,.31,z,'steel',chassis);
box(.35,.23,1.25,0,.16,0,'steel',chassis);box(.12,.20,.80,0,.015,0,'copper',chassis);
for(const z of[-.44,.44])cyl(.085,.085,.48,0,.10,z,'copper',chassis,[0,0,Math.PI/2],12);
const supports=group('funicular-wedge-supports',cabin);
for(const side of[-1,1]){
 box(.14,.16,4.58,side*.71,FLOOR-.17,0,'navy',supports);
 const zs=[-1.95,-.72,.54,1.95],lower=z=>-z*Math.tan(DESIGN_PITCH)+.29/Math.cos(DESIGN_PITCH);
 for(const z of zs){const bottom=lower(z),top=FLOOR-.23;box(.105,Math.max(.08,top-bottom),.105,side*.71,(top+bottom)/2,z,'steel',supports);}
 for(let i=1;i<zs.length;i++)rod([side*.71,lower(zs[i]),zs[i]],[side*.71,FLOOR-.23,zs[i-1]],.045,'copper',supports);
}
// Axle centres are spaced in the level cabin's horizontal coordinates. Their
// circular tread contacts the slope along its normal, not straight below it.
for(const[axle,z]of[-1.50,1.50].entries()){
 const y=-z*Math.tan(DESIGN_PITCH)+.30/Math.cos(DESIGN_PITCH);rod([-.88,y,z],[.88,y,z],.072,'steel',cabin);
 for(const side of[-1,1]){
  const pivot=group(`train-wheel-funicular-${axle}-${side<0?'left':'right'}`,cabin,[side*.81,y,z]);
  cyl(.30,.30,.19,0,0,0,'steel',pivot,[0,0,Math.PI/2],32);
  cyl(.322,.322,.035,-side*.079,0,0,'steel',pivot,[0,0,Math.PI/2],32);
  torus(.243,.025,side*.103,0,0,'copper',pivot,[0,Math.PI/2,0]);cyl(.088,.088,.225,0,0,0,'copper',pivot,[0,0,Math.PI/2],16);
  for(let n=0;n<8;n++){const a=n*Math.PI/4;rod([side*.10,Math.cos(a)*.09,Math.sin(a)*.09],[side*.10,Math.cos(a)*.222,Math.sin(a)*.222],.025,'cream',pivot);}
  for(const dx of[-.072,.072])box(.075,.10,.26,side*.81+dx,y+.30,z,'steel',cabin);
 }
}
const deck=group('funicular-level-deck',cabin);
box(2.08,DECK,4.82,0,FLOOR-DECK/2,0,'navy',deck);
for(let n=0;n<18;n++)box(1.98,.022,.254,0,FLOOR-.011,-2.25+n*.265,n%3?'woodLight':'wood',deck);
for(const side of[-1,1]){box(.045,.075,4.78,side*1.055,FLOOR-.005,0,'copper',deck);for(const z of[-2.46,2.46])box(.12,.13,.06,side*.73,FLOOR-.09,z,'steel',deck);}

// Round low panels, deeply framed glazing and open central portals. The glass
// and observation skylight remain separate from opaque shadow-casting trim.
const shell=group('funicular-level-cabin',cabin);
for(const end of[-1,1]){
 roundedPanel(2.07,.49,.095,.10,0,FLOOR+.245,end*2.37,'navy',shell);
 roundedPanel(1.80,.30,.025,.06,0,FLOOR+.245,end*2.427,'inset',shell);
 box(2.08,.045,.075,0,2.16,end*2.38,'copper',shell);
 roundedPanel(1.91,1.24,.012,.11,0,2.82,end*2.36,'glass',shell);box(1.91,.06,.075,0,3.46,end*2.36,'cream',shell);
 for(const x of[-.99,.99])box(.11,1.34,.11,x,2.81,end*2.34,'cream',shell);
 for(const x of[-.51,.51])box(.034,1.25,.035,x,2.82,end*2.39,'copper',shell);
 for(const x of[-.77,.77]){cyl(.098,.098,.055,x,2.02,end*2.44,'copper',shell,[Math.PI/2,0,0],18);cyl(.073,.073,.01,x,2.02,end*2.475,'lamp',shell,[Math.PI/2,0,0],18);}
 const badge=group('funicular-end-badge-'+end,shell,[0,1.94,end*2.448]);badge.rotation.y=end>0?0:Math.PI;
 torus(.13,.018,0,0,0,'copper',badge);for(let n=0;n<8;n++){const a=n*Math.PI/4;rod([Math.cos(a)*.03,Math.sin(a)*.03,.005],[Math.cos(a)*.10,Math.sin(a)*.10,.005],.009,'copper',badge);}
 for(const x of[-.9,-.6,-.3,.3,.6,.9])rivet(x,1.76,end*2.43,shell);
}
for(const side of[-1,1]){
 for(const[z,len]of[[-1.54,1.72],[1.54,1.72]]){
  roundedPanel(len,.49,.07,.075,side*1.015,FLOOR+.245,z,'navy',shell,[0,side*Math.PI/2,0]);
  roundedPanel(len-.18,.30,.018,.045,side*1.059,FLOOR+.245,z,'inset',shell,[0,side*Math.PI/2,0]);
  roundedPanel(len-.12,1.22,.012,.10,side*1.015,2.82,z,'glass',shell,[0,side*Math.PI/2,0]);
  for(const y of[2.16,3.46])box(.09,.055,len,side*1.015,y,z,'copper',shell);
  for(const q of[z-len/2,z+len/2])box(.105,1.34,.105,side*1.015,2.81,q,'cream',shell);
  box(.04,1.24,.035,side*1.036,2.82,z,'cream',shell);
  for(const q of[z-.58,z-.29,z,z+.29,z+.58])rivet(side*1.075,1.76,q,shell);
 }
 text('CAREER LINE',.105,side*1.077,1.86,1.54,'cream',shell,[0,side*Math.PI/2,0]);
 const portal=group('funicular-door-'+(side<0?'left':'right'),cabin);
 for(const z of[-.66,.66]){box(.10,1.83,.08,side*1.02,2.565,z,'cream',portal);rod([side*.93,2.06,z],[side*.93,2.94,z],.026,'copper',portal);}
 box(.10,.085,1.40,side*1.02,3.47,0,'cream',portal);box(.20,.025,1.30,side*.96,FLOOR+.004,0,'steel',portal);
 for(const z of[-.48,-.24,0,.24,.48])box(.19,.006,.012,side*.96,FLOOR+.019,z,'copper',portal);
}
const roof=group('funicular-arched-roof',cabin);
function roofPatch(x0,x1,z0,z1,material){const positions=[],indices=[],nx=16;for(let j=0;j<=1;j++)for(let i=0;i<=nx;i++){const x=x0+(x1-x0)*i/nx;positions.push(x,ROOF+.29*(1-(x/1.10)**2),z0+(z1-z0)*j);}for(let i=0;i<nx;i++){const a=i,b=i+1,c=i+nx+1,d=c+1;indices.push(a,c,b,b,c,d);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return mesh(g,material,[0,0,0],roof);}
roofPatch(-1.10,1.10,-2.46,-.24,'navy');roofPatch(-1.10,-1.03,-.24,2.46,'navy');roofPatch(1.03,1.10,-.24,2.46,'navy');roofPatch(-1.03,1.03,-.24,2.46,'glass');
for(const x of[-1.075,1.075])rod([x,3.48,-2.46],[x,3.48,2.46],.025,'copper',roof);
for(const z of[-2.40,-.24,1.02,2.40])for(let n=0;n<20;n++){const x0=-1.07+n*2.14/20,x1=-1.07+(n+1)*2.14/20;rod([x0,ROOF+.29*(1-(x0/1.10)**2)+.012,z],[x1,ROOF+.29*(1-(x1/1.10)**2)+.012,z],.016,'copper',roof);}
for(const x of[-1.03,1.03])rod([x,ROOF+.29*(1-(x/1.1)**2),-.24],[x,ROOF+.29*(1-(x/1.1)**2),2.46],.018,'copper',roof);
box(.86,.045,.60,0,3.778,-1.35,'inset',roof);for(let z=-1.58;z<-1.12;z+=.07)box(.65,.028,.016,0,3.814,z,'copper',roof);

// Preserve all verified contacts of the imported seated clip, shifting the
// whole bay upward and rotating it to the downhill observation window (+Z).
const passenger=group('funicular-passenger-bay',cabin,[0,1.05,0]);passenger.rotation.y=Math.PI;
const seat=group('funicular-passenger-seat',passenger),seatZ=-.98;
for(const x of[-.59,.59]){box(.08,.45,.41,x,.82,seatZ,'steel',seat);rod([x,.68,seatZ+.21],[x,1.47,seatZ+.21],.027,'copper',seat);}
for(let n=0;n<4;n++)box(1.43,.072,.092,0,1.084-(n<2?.022:n===2?.006:0),seatZ-.145+n*.097,n%2?'wood':'woodLight',seat);
for(let n=0;n<3;n++)box(1.43,.095,.055,0,1.26+n*.115,seatZ+.22,n%2?'woodLight':'wood',seat);
for(const x of[-.72,.72]){rod([x,1.38,seatZ-.20],[x,1.38,seatZ+.22],.032,'copper',seat);rod([x,.97,seatZ-.20],[x,1.38,seatZ-.20],.024,'copper',seat);}
for(const side of[-1,1]){const rest=group('funicular-passenger-armrest-'+(side<0?'left':'right'),passenger);box(.13,.052,.34,side*.245,1.197,-1.13,'woodLight',rest);for(const z of[-1.24,-1.02])rod([side*.255,1.095,z],[side*.255,1.173,z],.021,'copper',rest);}
const footboard=group('funicular-passenger-footboard',passenger);
for(const x of[-.30,.30]){box(.055,.345,.24,x,.7825,-1.205,'steel',footboard);box(.15,.035,.30,x,.625,-1.205,'steel',footboard);}
for(let n=0;n<3;n++)box(.74,.06,.11,0,.964,-1.33+n*.115,n%2?'wood':'woodLight',footboard);
const furniture=group('funicular-cabin-furniture',cabin);
for(let n=0;n<4;n++)box(1.46,.055,.10,0,2.12,-1.65+n*.105,n%2?'woodLight':'wood',furniture);
for(let n=0;n<3;n++)box(1.46,.09,.055,0,2.30+n*.115,-1.79,n%2?'woodLight':'wood',furniture);
for(const x of[-.60,.60]){box(.07,.45,.38,x,1.87,-1.50,'steel',furniture);rod([x,1.85,-1.79],[x,2.61,-1.79],.025,'copper',furniture);}
for(const side of[-1,1])for(const z of[-1.94,1.94]){box(.08,.19,.10,side*.92,3.26,z,'copper',furniture);box(.04,.12,.06,side*.875,3.26,z,'lamp',furniture);}

// Batch only static geometry within each independently animated owner.
root.updateMatrixWorld(true);
for(const owner of owners){
  const bins=new Map(),remove=[],inverse=owner.matrixWorld.clone().invert();
  for(const child of owner.children)if(child.isMesh){const geometry=child.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,child.matrixWorld));const key=child.material;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(geometry.index?geometry.toNonIndexed():geometry);remove.push(child);}
  for(const child of remove){owner.remove(child);child.geometry.dispose();}
  for(const [material,geometries]of bins){const geometry=mergeVertices(mergeGeometries(geometries,false),1e-5);geometry.normalizeNormals();const m=new THREE.Mesh(geometry,material);m.name=owner.name+'_'+material.name;owner.add(m);}
}
const raw=await new GLTFExporter().parseAsync(root,{binary:true,trs:true,onlyVisible:true});await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const document=await io.readBinary(new Uint8Array(raw));await document.transform(dedup(),meshopt({encoder:MeshoptEncoder,level:'high'}));
const file=new URL('../static/models/career-train.glb',import.meta.url);await io.write(fileURLToPath(file),document);const bytes=(await fs.stat(file)).size;
if(bytes>350000)throw new Error(`Career train exceeds 350KB: ${bytes}`);
const manifest={version:21,file:'career-train.glb',bytes,source:'Original single-cabin coastal funicular geometry',coordinateSystem:'Y up, -Z uphill, level cabin; +Z downhill observation window; independent inclined chassis.',designPitch:DESIGN_PITCH,doors:{clearWidth:1.24,sillY:FLOOR},roof:{eavesY:ROOF,skylight:[-1.03,1.03,-.24,2.46]},wheelAxles:[-1.5,1.5],wheelRadius:.30,spec:CAREER_TRAIN,nodes:document.getRoot().listNodes().map(n=>n.getName()),triangles:document.getRoot().listMeshes().flatMap(m=>m.listPrimitives()).reduce((n,p)=>n+(p.getIndices()?.getCount()||p.getAttribute('POSITION').getCount())/3,0)};
await fs.writeFile(new URL('../static/models/career-train-manifest.json',import.meta.url),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({file:manifest.file,bytes,triangles:manifest.triangles}));
