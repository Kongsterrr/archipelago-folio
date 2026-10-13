// Original miniature steam locomotive and an open sightseeing coach.
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
const colors={navy:'#27495d',cream:'#f4e7c9',copper:'#b88550',wood:'#a67345',woodLight:'#cfab74',steel:'#48545b',rubber:'#293237',glass:'#aecbd0',lamp:'#ffe3a1',red:'#aa5147'};
const mats=Object.fromEntries(Object.entries(colors).map(([name,color])=>[name,new THREE.MeshStandardMaterial({name:'career_train_'+name,color,roughness:name==='glass'?.22:/copper|steel/.test(name)?.38:.72,metalness:/copper|steel/.test(name)?.55:0,transparent:name==='glass',opacity:name==='glass'?.34:1,depthWrite:name!=='glass',...(name==='lamp'?{emissive:'#ffc16b',emissiveIntensity:.65}:{})})]));
const root=new THREE.Group();root.name='career-train';
const owners=[],group=(name,parent=root,position=[0,0,0])=>{const g=new THREE.Group();g.name=name;g.position.set(...position);parent.add(g);owners.push(g);return g;};
const engine=group('career-locomotive'),coach=group('career-coach',root,[0,0,CAREER_TRAIN.coachOffset]);
function mesh(geometry,material,position,parent,rotation=[0,0,0]){const m=new THREE.Mesh(geometry,mats[material]);m.position.set(...position);m.rotation.set(...rotation);parent.add(m);return m;}
const box=(w,h,d,x,y,z,m,p)=>mesh(new THREE.BoxGeometry(w,h,d),m,[x,y,z],p);
const cyl=(rt,rb,h,x,y,z,m,p,rotation=[0,0,0],segments=18)=>mesh(new THREE.CylinderGeometry(rt,rb,h,segments),m,[x,y,z],p,rotation);
const torus=(r,t,x,y,z,m,p,rotation=[0,0,0])=>mesh(new THREE.TorusGeometry(r,t,6,24),m,[x,y,z],p,rotation);
function rod(a,b,r,m,p){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),delta=bv.clone().sub(av),o=cyl(r,r,delta.length(),...av.clone().add(bv).multiplyScalar(.5).toArray(),m,p);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return o;}
function text(word,size,x,y,z,m,p,rotation=[0,0,0]){const geometry=new TextGeometry(word,{font,size,depth:.005,curveSegments:3,bevelEnabled:false});geometry.computeBoundingBox();geometry.translate(-(geometry.boundingBox.max.x+geometry.boundingBox.min.x)/2,0,0);return mesh(geometry,m,[x,y,z],p,rotation);}
function rivet(x,y,z,p){mesh(new THREE.IcosahedronGeometry(.024,1),'copper',[x,y,z],p);}
function wheels(parent,kind,radius,axles){
  for(const [axle,z]of axles.entries()){
    rod([-.82,radius,z],[.82,radius,z],.095,'steel',parent);
    for(const side of[-1,1]){
      const pivot=group(`train-wheel-${kind}-${axle}-${side<0?'left':'right'}`,parent,[side*.81,radius,z]);
      cyl(radius,radius,.24,0,0,0,'steel',pivot,[0,0,Math.PI/2],24);
      torus(radius-.045,.035,side*.086,0,0,'copper',pivot,[0,Math.PI/2,0]);
      cyl(.105,.105,.19,0,0,0,'copper',pivot,[0,0,Math.PI/2],14);
      for(let n=0;n<10;n++){const a=n*Math.PI/5;rod([side*.089,Math.cos(a)*.11,Math.sin(a)*.11],[side*.089,Math.cos(a)*(radius-.08),Math.sin(a)*(radius-.08)],.023,'cream',pivot);}
    }
  }
}
function undercarriage(parent,length,kind,radius,axles){
  box(1.67,.18,length,0,.51,0,'navy',parent);box(.65,.23,length-.55,0,.33,0,'steel',parent);
  for(const side of[-1,1]){box(.10,.15,length-.3,side*.70,.40,0,'steel',parent);for(const z of axles){for(let k=0;k<3;k++)box(.105,.035,.60-k*.08,side*.70,.51+k*.055,z,'steel',parent);}}
  wheels(parent,kind,radius,axles);
  for(const z of[-length/2,length/2]){box(1.6,.18,.12,0,.64,z,'red',parent);for(const x of[-.53,.53])cyl(.095,.095,.14,x,.65,z+Math.sign(z)*.065,'copper',parent,[Math.PI/2,0,0]);}
}

undercarriage(engine,3.38,'engine',.42,[-1.08,0,1.08]);
// Round boiler, bands, firebox and a front smoke-box plate.
cyl(.56,.56,1.80,0,1.37,-.48,'navy',engine,[Math.PI/2,0,0],28);
for(const z of[-1.24,-.60,.05])torus(.565,.038,0,1.37,z,'copper',engine);
cyl(.52,.52,.085,0,1.37,-1.43,'steel',engine,[Math.PI/2,0,0],28);
torus(.48,.027,0,1.37,-1.48,'copper',engine);
for(let n=0;n<12;n++){const a=n*Math.PI/6;rivet(Math.cos(a)*.43,1.37+Math.sin(a)*.43,-1.485,engine);}
box(.39,.075,.035,0,1.37,-1.51,'copper',engine);text('J',.15,0,1.26,-1.54,'cream',engine,[0,Math.PI,0]);
cyl(.14,.20,.66,0,2.12,-.92,'navy',engine);cyl(.235,.17,.14,0,2.52,-.92,'copper',engine);cyl(.195,.195,.045,0,2.61,-.92,'steel',engine);
cyl(.24,.27,.26,0,1.96,-.05,'copper',engine);mesh(new THREE.SphereGeometry(.24,16,8,0,Math.PI*2,0,Math.PI/2),'copper',[0,2.09,-.05],engine);
for(const side of[-1,1]){
  rod([side*.57,1.73,-1.12],[side*.57,1.73,.33],.026,'copper',engine);
  rod([side*.49,1.34,-.93],[side*.74,.85,-.85],.043,'copper',engine);
  cyl(.15,.15,.40,side*.62,.75,-1.15,'steel',engine,[Math.PI/2,0,0]);
  box(.07,.095,2.04,side*.89,.42,0,'copper',engine);
}
// A framed cab remains readable as a cab: clear windows, visible controls,
// cream inset panels, corner posts and a shallow curved roof.
box(1.60,.61,1.28,0,1.10,.90,'navy',engine);
for(const side of[-1,1]){
  box(.052,.39,1.04,side*.82,1.20,.89,'cream',engine);
  box(.026,.71,.96,side*.805,1.95,.89,'glass',engine);
  for(const z of[.29,1.51])box(.095,1.43,.095,side*.785,1.96,z,'copper',engine);
  for(const y of[1.56,2.37])box(.105,.075,1.27,side*.785,y,.90,'cream',engine);
  box(.105,.79,.055,side*.80,1.97,.90,'cream',engine);
  text('JACK RAIL',.125,side*.853,1.18,.89,'navy',engine,[0,side*Math.PI/2,0]);
  for(const z of[.39,.67,.96,1.23])rivet(side*.855,1.02,z,engine);
  box(.27,.10,.42,side*.70,.73,.78,'steel',engine);
}
for(const z of[.29,1.51]){box(1.43,.72,.025,0,1.96,z,'glass',engine);box(1.6,.085,.095,0,2.37,z,'cream',engine);box(.065,.78,.065,0,1.98,z,'cream',engine);}
box(1.45,.15,.27,0,1.57,.42,'wood',engine);for(const x of[-.35,.35]){cyl(.105,.105,.026,x,1.77,.385,'cream',engine,[Math.PI/2,0,0],12);rod([x,1.77,.365],[x+.04,1.82,.365],.01,'navy',engine);}
const roofShape=new THREE.Shape();roofShape.moveTo(-.91,0);roofShape.quadraticCurveTo(0,.26,.91,0);roofShape.lineTo(.91,-.10);roofShape.quadraticCurveTo(0,.14,-.91,-.10);roofShape.closePath();const roofGeometry=new THREE.ExtrudeGeometry(roofShape,{depth:1.52,bevelEnabled:false,curveSegments:12});roofGeometry.translate(0,0,-.76);mesh(roofGeometry,'navy',[0,2.57,.91],engine);box(1.8,.04,1.51,0,2.49,.91,'copper',engine);
cyl(.19,.19,.18,0,1.97,-1.28,'copper',engine,[Math.PI/2,0,0]);cyl(.155,.155,.025,0,1.97,-1.385,'lamp',engine,[Math.PI/2,0,0]);
for(const x of[-.61,.61]){cyl(.07,.07,.10,x,.82,-1.73,'lamp',engine,[Math.PI/2,0,0],12);}

undercarriage(coach,3.28,'coach',.36,[-1.13,1.13]);
// Individual timber boards, two upholstered-free bench rows and two central
// side doorways. No roof hides the seated visitor or the view of each stop.
for(let n=0;n<11;n++)box(1.64,.075,.284,0,.5625,-1.45+n*.29,n%3?'woodLight':'wood',coach);
// Jack's imported sit clip uses a .336m forward seat offset. The actual
// seat boards sit beneath his pelvis, behind his shins, not beneath the anchor.
for(const [index,z]of[-.98,.61].entries()){
  const seat=group(index?'career-coach-seat-rear':'career-coach-seat-front',coach);
  for(const x of[-.59,.59]){box(.08,.45,.41,x,.82,z,'steel',seat);rod([x,.68,z+.21],[x,1.47,z+.21],.027,'copper',seat);}
  for(let n=0;n<4;n++)box(1.43,.072,.092,0,1.084-(n<2?.022:n===2?.006:0),z-.145+n*.097,n%2?'wood':'woodLight',seat);
  for(let n=0;n<3;n++)box(1.43,.095,.055,0,1.26+n*.115,z+.22,n%2?'woodLight':'wood',seat);
  for(const x of[-.72,.72]){rod([x,1.38,z-.20],[x,1.38,z+.22],.032,'copper',seat);rod([x,.97,z-.2],[x,1.38,z-.2],.024,'copper',seat);}
}
// Compact individual armrests support the shipped sit clip's relaxed hands.
// They stay inside the passenger bay, leaving both side doors unobstructed.
for(const side of[-1,1]){
  const rest=group(`career-coach-passenger-armrest-${side<0?'left':'right'}`,coach);
  box(.13,.052,.34,side*.245,1.197,-1.13,'woodLight',rest);
  for(const z of[-1.24,-1.02])rod([side*.255,1.095,z],[side*.255,1.173,z],.021,'copper',rest);
}
const footboard=group('career-coach-passenger-footboard',coach);
for(const x of[-.30,.30]){box(.055,.345,.24,x,.7825,-1.205,'steel',footboard);box(.15,.035,.30,x,.625,-1.205,'steel',footboard);}
for(let n=0;n<3;n++)box(.74,.06,.11,0,.964,-1.33+n*.115,n%2?'wood':'woodLight',footboard);
for(const side of[-1,1]){
  for(const [z,length]of[[-1.05,1.19],[1.08,1.13]]){
    box(.10,.32,length,side*.845,.85,z,'cream',coach);box(.03,.20,length-.12,side*.907,.85,z,'navy',coach);
    rod([side*.87,1.42,z-length/2],[side*.87,1.42,z+length/2],.032,'copper',coach);
    for(const q of[z-length/2,z+length/2])rod([side*.87,.61,q],[side*.87,1.42,q],.03,'copper',coach);
    for(const q of[z-.35,z,z+.35])rivet(side*.90,.85,q,coach);
  }
  box(.24,.09,.69,side*.75,.365,0,'steel',coach);box(.25,.05,.68,side*.75,.42,0,'wood',coach);
  text('CAREER JOURNEY',.096,side*.925,.81,1.08,'cream',coach,[0,side*Math.PI/2,0]);
}
for(const z of[-1.64,1.64]){box(1.66,.32,.10,0,.85,z,'cream',coach);rod([-.87,1.43,z],[.87,1.43,z],.035,'copper',coach);for(const x of[-.87,0,.87])rod([x,.62,z],[x,1.43,z],.026,'copper',coach);}
for(const side of[-1,1])cyl(.08,.08,.05,side*.66,.91,1.73,'red',coach,[Math.PI/2,0,0],12);

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
const manifest={version:19,file:'career-train.glb',bytes,source:'Original procedural geometry',coordinateSystem:'Y up, -Z forward, wheel contact Y=0; scene contains two independent car roots.',spec:CAREER_TRAIN,nodes:document.getRoot().listNodes().map(n=>n.getName()),triangles:document.getRoot().listMeshes().flatMap(m=>m.listPrimitives()).reduce((n,p)=>n+(p.getIndices()?.getCount()||p.getAttribute('POSITION').getCount())/3,0)};
await fs.writeFile(new URL('../static/models/career-train-manifest.json',import.meta.url),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({file:manifest.file,bytes,triangles:manifest.triangles}));
