// Original procedural models for Jack's toy archipelago.
// Run: node build-assets.mjs [path/to/three/package]
// Geometry only; no external textures, networks, copied assets, or build services.
import fs from 'node:fs/promises';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { fileURLToPath } from 'node:url';
const OUT = fileURLToPath(new URL('../static/models/', import.meta.url));
await fs.mkdir(OUT,{recursive:true});
globalThis.FileReader = class {
  async readAsArrayBuffer(blob) { this.result = await blob.arrayBuffer(); this.onloadend?.({ target: this }); }
  async readAsDataURL(blob) { this.result = `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`; this.onloadend?.({target:this}); }
};

const colors = {
  sand:'#f1dfad', sandEdge:'#dfc38c', grass:'#a6c76e', grassDark:'#86ad61',
  ivory:'#fff7e4', navy:'#254d64', orange:'#f47e45', teal:'#338e8b',
  terracotta:'#c86846', red:'#da6653', pink:'#efb7bd', lilac:'#b4a7d2',
  leaf:'#458760', leafLight:'#79ac69', trunk:'#997453', wood:'#c49465',
  woodLight:'#d8af7d', darkWood:'#84684c', glass:'#9cddd0', glassBlue:'#a4cee0',
  black:'#394447', metal:'#849898', stone:'#c1bdb0', stoneLight:'#ddd4bb',
  yellow:'#f3c863', cream:'#eadbbd', white:'#ffffff', blue:'#658cb5',
};
const mats = Object.fromEntries(Object.entries(colors).map(([name,color]) => [name,
  new THREE.MeshStandardMaterial({name, color, roughness:name==='glass'||name==='glassBlue'?0.3:0.76, metalness:name==='metal'?0.25:0})]));
let root, seed;
function random() { seed = (seed*1664525+1013904223)>>>0; return seed/4294967296; }
function mesh(geom, material='ivory', pos=[0,0,0], rot=[0,0,0], parent=root) {
  const m = new THREE.Mesh(geom,mats[material]); m.position.set(...pos); m.rotation.set(...rot); parent.add(m); return m;
}
function group(pos=[0,0,0], rot=[0,0,0], parent=root) { const g=new THREE.Group(); g.position.set(...pos);g.rotation.set(...rot);parent.add(g);return g; }
function box(w,h,d,x,y,z,mat='ivory',rot=[0,0,0],parent=root) { return mesh(new THREE.BoxGeometry(w,h,d),mat,[x,y,z],rot,parent); }
const bevelCache = new Map();
function bevel(w,h,d,x,y,z,mat='ivory',b=.06,rot=[0,0,0],parent=root) {
  b=Math.min(b,w/4,h/4,d/4); const key=[w,h,d,b].join(','); let g=bevelCache.get(key);
  if(!g) { const s=new THREE.Shape();const a=w/2-b,c=h/2-b;s.moveTo(-a,-c);s.lineTo(a,-c);s.lineTo(a,c);s.lineTo(-a,c);s.closePath();
    g=new THREE.ExtrudeGeometry(s,{depth:d-2*b,bevelEnabled:true,bevelThickness:b,bevelSize:b,bevelSegments:1,steps:1});g.translate(0,0,-d/2+b);bevelCache.set(key,g); }
  return mesh(g,mat,[x,y,z],rot,parent);
}
function cyl(rt,rb,h,x,y,z,mat='ivory',segments=12,rot=[0,0,0],parent=root) { return mesh(new THREE.CylinderGeometry(rt,rb,h,segments,1),mat,[x,y,z],rot,parent); }
function cone(r,h,x,y,z,mat='red',segments=10,parent=root) { return cyl(0,r,h,x,y,z,mat,segments,[0,0,0],parent); }
function sphere(r,x,y,z,mat='leaf',detail=0,parent=root) { return mesh(new THREE.IcosahedronGeometry(r,detail),mat,[x,y,z],[random(),random(),random()],parent); }
function rod(a,b,r,mat='wood',parent=root,segments=7) {
  const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),delta=bv.clone().sub(av);const m=cyl(r,r,delta.length(),...av.clone().add(bv).multiplyScalar(.5).toArray(),mat,segments,[0,0,0],parent);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return m;
}
function custom(vertices,indices,mat='ivory',parent=root) {
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices.flat(),3));g.setIndex(indices);g.computeVertexNormals();return mesh(g,mat,[0,0,0],[0,0,0],parent);
}
function ringShape(points,levels,mat='sand',parent=root) {
  const v=[], ix=[],n=points.length;
  for(const [scale,y] of levels) for(const [x,z]of points)v.push([x*scale,y,z*scale]);
  for(let j=0;j<levels.length-1;j++)for(let i=0;i<n;i++){const a=j*n+i,b=j*n+(i+1)%n,c=(j+1)*n+i,d=(j+1)*n+(i+1)%n;ix.push(a,c,b,b,c,d);}
  const top=v.length; v.push([0,levels.at(-1)[1],0]);for(let i=0;i<n;i++)ix.push(top,(levels.length-1)*n+(i+1)%n,(levels.length-1)*n+i);
  const m=custom(v,ix,mat,parent);m.geometry=m.geometry.toNonIndexed();m.geometry.computeVertexNormals();return m;
}
function shapePrism(points,y0,y1,mat,parent=root) {
  const shape=new THREE.Shape(points.map(([x,z])=>new THREE.Vector2(x,-z)));
  const g=new THREE.ExtrudeGeometry(shape,{depth:y1-y0,bevelEnabled:false,steps:1});g.rotateX(-Math.PI/2);g.translate(0,y0,0);return mesh(g,mat,[0,0,0],[0,0,0],parent);
}
function pathStone(x,z,r=.48,mat='stoneLight') {return cyl(r*.95,r,.10,x,.89,z,mat,7,[0,random(),0]);}
function shrub(x,z,s=1,mat='leafLight') { sphere(.53*s,x,1.12*s,z,mat);sphere(.44*s,x+.4*s,1.1*s,z+.12*s,mat);sphere(.38*s,x-.3*s,1.05*s,z+.24*s,'grassDark'); }
function rocks(x,z,s=1) {for(let i=0;i<3;i++){const m=sphere((.29+random()*.25)*s,x+i*.38*s,.89+(.13+random()*.1)*s,z+random()*.35,'stone');m.scale.set(1.25,.7,1);}}
function palm(x,z,h=4.2,angle=.3,parent=root) {
  const g=group([x,.78,z],[0,angle,0],parent); const p0=[0,0,0],p1=[.15,h*.36,0],p2=[.44,h*.7,-.06],p3=[.68,h,-.11];
  rod(p0,p1,.18,'trunk',g,7);rod(p1,p2,.155,'trunk',g,7);rod(p2,p3,.125,'trunk',g,7);
  for(let i=0;i<7;i++){const a=i*Math.PI*2/7,cs=Math.cos(a),sn=Math.sin(a),len=1.55+(i%3)*.17; const q=(r,y,w=0)=>[p3[0]+cs*r-sn*w,h+y,p3[2]+sn*r+cs*w];
    const vs=[q(0,.03),q(len*.45,.29,-.31),q(len*.45,.38),q(len*.45,.29,.31),q(len,-.52)];custom(vs,[0,1,2,0,2,3,1,4,2,2,4,3,2,1,0,3,2,0,2,4,1,3,4,2],i%2?'leaf':'leafLight',g);}
  sphere(.19,.65,h-.2,-.12,'trunk',0,g);sphere(.17,.78,h-.24,.07,'trunk',0,g);
}
function flag(x,y,z,h=2.2,mat='orange',parent=root) {
  cyl(.037,.046,h,x,y+h/2,z,'ivory',7,[0,0,0],parent);sphere(.065,x,y+h,z,'yellow',0,parent);
  custom([[x,y+h-.16,z],[x+.72,y+h-.29,z+.02],[x+.6,y+h-.74,z+.025],[x,y+h-.66,z]], [0,1,2,0,2,3,2,1,0,3,2,0],mat,parent);
}
function windowFront(x,y,z,w=.65,h=.9,parent=root,mat='glassBlue') {
  bevel(w+.15,h+.15,.13,x,y,z,'ivory',.025,[0,0,0],parent);box(w,h,.035,x,y,z+.081,mat,[0,0,0],parent);box(.055,h,.042,x,y,z+.11,'navy',[0,0,0],parent);
}
function pitchedRoof(w,d,y,x,z,mat='terracotta',parent=root,h=.8) {
  custom([[x-w/2,y,z-d/2],[x+w/2,y,z-d/2],[x,y+h,z-d/2],[x-w/2,y,z+d/2],[x+w/2,y,z+d/2],[x,y+h,z+d/2]], [0,2,1,3,4,5,0,3,5,0,5,2,2,5,4,2,4,1,0,1,4,0,4,3],mat,parent);
}
function steps(x,z,width=2,count=3,parent=root) {for(let i=0;i<count;i++)bevel(width,.14*(i+1),.42,x,.82+.07*(i+1),z-i*.32,'ivory',.03,[0,0,0],parent);}
function basicIsland(name,index) {
  root=new THREE.Group();root.name=name; seed=12731+index*891; const points=[];
  for(let i=0;i<24;i++){const a=i*Math.PI*2/24; const r=9.8+random()*.7;points.push([Math.cos(a)*r,Math.sin(a)*r]);}
  ringShape(points,[[.91,-.53],[1,.06],[.97,.31]],'sandEdge');
  ringShape(points,[[.972,.29],[.945,.54],[.90,.70]],'sand');
  ringShape(points,[[.854,.69],[.863,.81],[.845,.85]],'grass');
  // Consistent south-facing approach. Deck end = 15.8m; open water beyond.
  for(let i=0;i<19;i++)bevel(3,.20,.40,0,.45,8.10+i*.415,'woodLight',.025);
  for(const x of[-1.19,1.19]){
    box(.18,.24,7.9,x,.27,11.85,'darkWood');
    for(const z of[8.3,10.8,13.3,15.55]){cyl(.115,.145,1.3,x,.15,z,'wood',7);cyl(.143,.143,.10,x,.85,z,'woodLight',7);}
  }
  // A short walk up from the dock keeps each landmark visible from approach.
  for(const z of[7.3,6.35,5.4])pathStone((random()-.5)*.28,z,.49);
  rocks(-7.2,3.7,.9); shrub(6.25,3.6,.9);
  return root;
}

function harbor() {
  // Tapered, broad-banded lighthouse with an octagonal viewing gallery.
  const x=-2.6,z=-2.2;
  cyl(1.45,1.72,.34,x,1.02,z,'stoneLight',12);
  for(let i=0;i<5;i++)cyl(1.14-i*.075,1.215-i*.075,1.36,x,1.86+i*1.36,z,i%2?'red':'ivory',12);
  cyl(1.35,1.22,.24,x,8.88,z,'navy',12);cyl(.92,.94,1.32,x,9.65,z,'glassBlue',10);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;cyl(.055,.055,1.55,x+Math.cos(a)*.88,9.65,z+Math.sin(a)*.88,'ivory',6);}
  cyl(1.48,1.48,.12,x,9.04,z,'ivory',12);cone(1.33,.93,x,10.76,z,'red',10);cyl(.11,.11,.7,x,11.40,z,'navy',6);
  for(let i=0;i<12;i++){const a=i*Math.PI/6;rod([x+Math.cos(a)*1.35,9.04,z+Math.sin(a)*1.35],[x+Math.cos(a)*1.35,9.66,z+Math.sin(a)*1.35],.032,'ivory');}
  const rail=new THREE.TorusGeometry(1.35,.032,4,12);mesh(rail,'ivory',[x,9.64,z],[Math.PI/2,0,0]);
  bevel(.7,1.3,.16,x,1.74,z+1.21,'navy',.15);windowFront(x,4.6,z+1.07,.45,.7);windowFront(x,7.1,z+.88,.38,.55);
  bevel(3.5,2.3,2.5,3.4,2.0,-.65,'ivory',.1);pitchedRoof(3.95,2.85,3.2,3.4,-.65,'terracotta',root,.9);
  bevel(1.2,1.5,.2,3.4,1.77,.65,'teal',.05);windowFront(4.4,2.16,.63,.50,.68);steps(3.4,1.65,1.55);
  flag(4.85,.85,2.65,3.3,'orange');
  // Lifebuoy and stacked dockside crates.
  mesh(new THREE.TorusGeometry(.38,.11,5,12),'ivory',[2.6,2.3,.78]);box(.14,.88,.12,2.6,2.3,.90,'red');
  bevel(.78,.72,.78,2.7,1.2,3.6,'wood',.045);bevel(.64,.61,.65,3.4,1.16,3.72,'woodLight',.04);
  palm(-6.5,1.55,4.05,.65);palm(6,-4.3,3.65,-.7);shrub(-5.8,-5.8,1.1);rocks(4.7,-5.6);
}

function amtrak() {
  // Cream station, navy clock gable, tiny toy engine, and two rails.
  bevel(6.0,.36,3.2,0,1.02,-2.0,'stoneLight',.1);
  bevel(5.4,2.55,2.5,0,2.42,-2.3,'ivory',.09);pitchedRoof(5.9,2.95,3.72,0,-2.3,'navy',root,.96);
  bevel(1.4,1.8,.18,0,2.13,-.98,'teal',.05);
  for(const x of[-1.8,1.8])windowFront(x,2.6,-.99,1,.98);
  bevel(1.55,1.36,.32,0,4.13,-.8,'navy',.05);
  cyl(.48,.48,.10,0,4.25,-.585,'ivory',16,[Math.PI/2,0,0]);
  box(.048,.31,.035,0,4.36,-.511,'navy');box(.25,.045,.035,.1,4.25,-.512,'navy');
  for(let i=0;i<12;i++){const a=i*Math.PI/6;box(.032,.06,.022,Math.sin(a)*.395,4.25+Math.cos(a)*.395,-.51,'navy',[0,0,-a]);}
  box(5.5,.15,1.1,0,3.06,-.34,'orange');for(const x of[-2.35,2.35])cyl(.064,.064,2.1,x,1.95,.02,'ivory',7);
  // Railway runs east-west across the island; it is visual scenery only.
  for(let i=0;i<17;i++)bevel(.25,.13,1.45,-5.8+i*.71,.93,2.6,'darkWood',.025);
  for(const z of[2.07,3.13])box(12,.12,.10,0,1.045,z,'metal');
  const g=group([-1.7,0,2.6],[0,Math.PI/2,0]);
  bevel(1.18,1.15,2.4,0,1.95,0,'navy',.12,[0,0,0],g);bevel(1.29,.3,2.55,0,2.6,0,'ivory',.1,[0,0,0],g);
  bevel(1.18,.43,2.44,0,1.61,0,'orange',.08,[0,0,0],g);
  for(const x of[-.607,.607])for(const zz of[-.64,.57]){box(.035,.47,.55,x,2.12,zz,'glassBlue',[0,0,0],g);cyl(.25,.25,.16,x,1.21,zz,'black',10,[0,0,Math.PI/2],g);}
  box(.88,.47,.035,0,2.13,-1.22,'glassBlue',[0,0,0],g);cyl(.09,.09,.05,.37,1.77,-1.24,'yellow',8,[Math.PI/2,0,0],g);
  bevel(1.12,.85,1.85,0,1.81,2.4,'cream',.09,[0,0,0],g);box(1.16,.18,1.9,0,2.32,2.4,'navy',[0,0,0],g);
  for(const xx of[-.57,.57])for(const zz of[1.88,2.87]){box(.04,.34,.44,xx,1.99,zz,'glassBlue',[0,0,0],g);cyl(.22,.22,.13,xx,1.21,zz,'black',9,[0,0,Math.PI/2],g);}
  bevel(1.3,.16,.45,4.7,1.49,-.7,'wood');for(const xx of[4.25,5.15])box(.09,.63,.1,xx,1.11,-.7,'navy');
  palm(-6.35,-3.8,3.8,.6);shrub(5.9,-4.5,1.1);rocks(-4.8,5.6,.8);flag(6.2,.85,.4,2.8,'orange');
}

function beaconfire() {
  // Offset building volumes and chunky service pipes suggest a software factory.
  bevel(4.4,2.55,3.5,-1.1,2.23,-1.8,'blue',.16);bevel(4.65,.28,3.75,-1.1,3.58,-1.8,'navy',.06);
  bevel(2.9,2.1,2.4,1.95,1.92,-.35,'orange',.13);bevel(3.1,.24,2.65,1.95,3.03,-.35,'ivory',.05);
  for(const x of[-2.4,-1.1,.2])windowFront(x,2.32,.01,.8,1.05);
  bevel(1.05,1.53,.12,1.85,1.7,.90,'navy',.05);bevel(.73,.88,.04,1.85,2.02,.98,'glass',.015);
  // Roof modules, no text required: raised tiny circuit tiles.
  for(const [x,y,z,s,m]of[[-2,4.11,-1.8,1.0,'ivory'],[-.68,4.08,-1.4,.94,'teal'],[-1.34,4.99,-1.63,.84,'orange']]){
    bevel(s,s,s,x,y,z,m,.09);bevel(s*.42,s*.38,.035,x,y,z+s/2+.02,'navy',.025);}
  for(const x of[-3.9,-4.6]){
    rod([x,.9,-2],[x,3.8,-2],.19,'terracotta');rod([x,3.8,-2],[x,3.8,-.85],.19,'terracotta');
    cyl(.26,.26,.13,x,2.1,-2,'ivory',9);sphere(.23,x,3.8,-2,'terracotta');
  }
  // Workbench with a laptop and a bright status stack.
  bevel(2.15,.19,1.05,2.2,1.63,3.17,'woodLight',.04);for(const x of[1.4,3])for(const z of[2.85,3.48])box(.12,.7,.12,x,1.19,z,'teal');
  box(.69,.06,.47,2.12,1.77,3.19,'navy');bevel(.68,.47,.045,2.12,2.00,2.98,'navy',.03,[-.16,0,0]);box(.55,.34,.025,2.12,2.02,3.025,'glass');
  for(let i=0;i<3;i++)bevel(.6,.6,.6,4.9,1.18+i*.62,1.35,['teal','ivory','orange'][i],.075);
  palm(5.4,-4.6,4.0,.2);shrub(-5.8,1.9,1);shrub(4.1,4.7,.8);rocks(-4.8,-5.3);
  // Two raised angle brackets beside the workshop.
  rod([-1.9,1.25,2.6],[-2.35,1.65,2.6],.105,'ivory');rod([-2.35,1.65,2.6],[-1.9,2.05,2.6],.105,'ivory');
  rod([-.5,1.25,2.6],[-.05,1.65,2.6],.105,'ivory');rod([-.05,1.65,2.6],[-.5,2.05,2.6],.105,'ivory');
}

function visionx() {
  // Mint glass greenhouse; opaque tinted panels keep the silhouette crisp.
  const w=5.2,d=4.3,roofY=3.35;
  bevel(w+.35,.3,d+.35,0,1.0,-1.9,'ivory',.05);bevel(w,2.05,d,0,2.17,-1.9,'glass',.035);
  pitchedRoof(w,d,roofY,0,-1.9,'glassBlue',root,1.2);
  for(const x of[-w/2,0,w/2])for(const z of[-4.05,.25])rod([x,1.13,z],[x,3.36,z],.085,'teal');
  for(const z of[-4.05,-2.62,-1.19,.25]){
    rod([-w/2,1.15,z],[-w/2,3.36,z],.075,'teal');rod([w/2,1.15,z],[w/2,3.36,z],.075,'teal');
    rod([-w/2,3.36,z],[0,4.55,z],.085,'teal');rod([0,4.55,z],[w/2,3.36,z],.085,'teal');}
  rod([0,4.55,-4.1],[0,4.55,.3],.09,'teal');
  for(const y of[1.2,2.14,3.35]){rod([-2.64,y,.29],[2.64,y,.29],.07,'teal');for(const x of[-2.64,2.64])rod([x,y,-4.09],[x,y,.29],.07,'teal');}
  bevel(1.1,1.72,.15,0,2.0,.4,'teal',.035);box(.86,1.42,.045,0,2.08,.5,'glass');sphere(.065,.35,1.94,.56,'yellow');
  steps(0,1.44,1.65);
  for(const [x,z,s]of[[-4.25,-.6,1.2],[3.95,-1.4,1.35],[-3.4,2.7,.95],[2.6,3.2,1.05],[4.5,2.8,.7]]){
    cyl(.39*s,.29*s,.60*s,x,.85+.3*s,z,'terracotta',9);
    rod([x,.98,z],[x,1.1+1.45*s,z],.055,'leaf');
    for(let i=0;i<4;i++){const a=i*2.4; const m=sphere(.34*s,x+Math.cos(a)*.35*s,1.35+i*.28*s,z+Math.sin(a)*.25*s,i%2?'leaf':'leafLight');m.scale.set(1.2,.44,.8);}
  }
  // Seedling bed and little watering can.
  bevel(2.7,.32,1.0,-2.0,1.0,4.05,'wood',.04);box(2.4,.06,.73,-2.0,1.2,4.05,'darkWood');
  for(let i=0;i<5;i++)sphere(.2,-3+i*.5,1.38,4.05,'leafLight');
  cyl(.28,.23,.45,3.3,1.05,1.6,'yellow',9);rod([3.42,1.14,1.6],[3.99,1.43,1.6],.08,'yellow');mesh(new THREE.TorusGeometry(.24,.035,5,10),'yellow',[3.3,1.35,1.6]);
  palm(-5.6,-4.0,4.3,.5);shrub(5,-4.4,1);rocks(-6.4,3.4,.85);
}

function affirmation() {
  // A pastel garden of three stepped task-card gates with physical checkmarks.
  for(const [x,z,y,mat]of[[-3,-1.0,0,'pink'],[0,-2.15,.52,'lilac'],[3,-3.3,1.04,'teal']]){
    bevel(2.65,.28+y,2.45,x,.99+y/2,z,'stoneLight',.05);
    const base=1.13+y,top=base+3.6;
    bevel(.44,3.5,.54,x-1,base+1.75,z,mat,.13);bevel(.44,3.5,.54,x+1,base+1.75,z,mat,.13);
    bevel(2.42,.62,.54,x,top,z,mat,.14);
    bevel(1.42,1.75,.20,x,base+2.40,z+.10,'ivory',.08);
    rod([x-.41,base+2.4,z+.24],[x-.09,base+2.1,z+.24],.095,'leaf');rod([x-.09,base+2.1,z+.24],[x+.48,base+2.75,z+.24],.095,'leaf');
    for(let i=0;i<2;i++)bevel(.9-i*.25,.055,.035,x-.08,base+1.82-i*.15,z+.22,'cream',.015);
    steps(x,z+1.75,1.85,3+Math.round(y*2));
  }
  // Winding pebble path and round reflecting pool.
  for(const [x,z]of[[-1.5,3.8],[-2.6,3.0],[-3.3,2.25],[.7,3.45],[1.8,2.8],[2.8,1.7],[3.05,.65]])pathStone(x,z,.40);
  cyl(1.55,1.68,.19,-4.2,1,3.0,'ivory',18);cyl(1.34,1.34,.055,-4.2,1.12,3,'glass',18);cyl(.34,.44,.52,-4.2,1.39,3,'ivory',10);cyl(.71,.36,.17,-4.2,1.7,3,'ivory',12);
  for(const [x,z]of[[-5.8,-2],[-5.5,1],[4.8,.2],[5.3,-4.7],[2.6,4.4]]){
    shrub(x,z,.73);for(let i=0;i<3;i++){const dx=(i-1)*.26;rod([x+dx,.87,z+.33],[x+dx,1.65,z+.33],.028,'leaf');sphere(.17,x+dx,1.67,z+.33,i%2?'pink':'yellow');}}
  palm(-3.5,-5.75,3.65,.2);rocks(5.7,4.4,.75);
  bevel(1.8,.16,.62,4.5,1.5,2.25,'woodLight');for(const x of[3.82,5.18])box(.1,.6,.48,x,1.13,2.25,'ivory');bevel(1.8,.51,.12,4.5,1.91,1.98,'woodLight');
}

function research() {
  // Faceted observatory dome on a short drum, plus a sculptural film-reel wall.
  cyl(2.32,2.4,.32,-1.4,1.02,-2.0,'stoneLight',16);cyl(2.16,2.16,2.35,-1.4,2.3,-2,'ivory',16);
  const dome=new THREE.SphereGeometry(2.21,16,6,0,Math.PI*2,0,Math.PI/2);mesh(dome,'blue',[-1.4,3.49,-2]);
  // Raised observation slot with a slim orange rim.
  bevel(.48,1.77,.28,-1.4,4.68,-.41,'navy',.07,[-.48,0,0]);
  bevel(.66,1.98,.12,-1.4,4.68,-.49,'ivory',.035,[-.48,0,0]);
  bevel(.41,1.72,.10,-1.4,4.68,-.31,'navy',.02,[-.48,0,0]);
  bevel(.91,1.55,.13,-1.4,1.94,.2,'navy',.07);windowFront(-2.76,2.5,-.2,.62,.75);
  // Telescope on tripod looks toward the harbor.
  const g=group([3.45,.85,1.8],[0,-.4,0]);
  for(let i=0;i<3;i++){const a=i*Math.PI*2/3;rod([Math.cos(a)*.74,.03,Math.sin(a)*.74],[0,1.6,0],.068,'navy',g);}
  rod([0,1.5,0],[0,2.27,0],.12,'metal',g);
  rod([0,1.98,.68],[0,3.04,-1.05],.35,'ivory',g,12);
  const cap=rod([0,3.04,-1.05],[0,3.13,-1.2],.39,'navy',g,12);
  rod([0,3.13,-1.2],[0,3.145,-1.225],.29,'glassBlue',g,12);
  rod([0,2.02,.71],[0,1.9,.92],.13,'navy',g,8);
  // Film reel circles stand against a small terracotta pavilion.
  bevel(1.25,2.22,1.8,4.4,1.98,-3.0,'terracotta',.1);bevel(2.1,.19,2.1,4.4,3.14,-3,'ivory',.05);
  for(const [x,y]of[[3.82,3.96],[5.18,3.96]]){
    cyl(.86,.86,.24,x,y,-1.99,'navy',14,[Math.PI/2,0,0]);
    cyl(.68,.68,.055,x,y,-1.82,'ivory',14,[Math.PI/2,0,0]);
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5;cyl(.16,.16,.04,x+Math.sin(a)*.41,y+Math.cos(a)*.41,-1.775,'navy',9,[Math.PI/2,0,0]);}cyl(.095,.095,.05,x,y,-1.77,'orange',8,[Math.PI/2,0,0]);
  }
  box(.78,.72,.08,4.43,2.35,-2.05,'navy');for(let i=0;i<3;i++)box(.56,.08,.03,4.43,2.12+i*.22,-1.997,'yellow');
  palm(-6.25,-3.4,4.0,.6);shrub(-4.7,1.1,.9);rocks(5.6,4.3,.8);
}

function catering() {
  // Cream seaside café with terracotta gable and a hand-striped awning.
  bevel(5.0,2.5,3.25,-.6,2.15,-2.05,'ivory',.1);pitchedRoof(5.45,3.7,3.48,-.6,-2.05,'terracotta',root,.93);
  bevel(1.0,1.64,.12,-2.0,1.73,-.365,'teal',.055);windowFront(.30,2.26,-.36,2.38,1.14);
  for(let i=0;i<10;i++)box(.52,.14,1.8,-2.94+i*.52,3.05,.26,i%2?'ivory':'orange',[-.16,0,0]);
  for(let i=0;i<10;i++)bevel(.52,.31,.12,-2.94+i*.52,2.75,1.14,i%2?'ivory':'orange',.035);
  for(const x of[-3.2,2.02])cyl(.057,.065,1.97,x,1.83,1.09,'ivory',7);
  // Café sign: a real cup and saucer perched on the roof.
  cyl(.74,.74,.11,-.6,4.63,-2.05,'ivory',14);cyl(.50,.38,.63,-.6,4.96,-2.05,'orange',12);cyl(.4,.4,.035,-.6,5.30,-2.05,'darkWood',12);
  mesh(new THREE.TorusGeometry(.24,.08,5,10),'orange',[.0,5.03,-2.05],[0,0,0]);
  function table(x,z,umbrella=false){
    cyl(.72,.72,.14,x,1.66,z,'woodLight',12);cyl(.09,.12,.77,x,1.23,z,'teal',8);cyl(.40,.4,.08,x,.88,z,'teal',8);
    for(const a of[-Math.PI/2,Math.PI/2]){const xx=x+Math.cos(a)*1.1,zz=z+Math.sin(a)*1.1;bevel(.56,.13,.55,xx,1.2,zz,'ivory',.05);for(const dx of[-.18,.18])box(.065,.37,.32,xx+dx,.96,zz,'teal');bevel(.58,.6,.08,xx,1.5,zz+Math.sin(a)*.24,'teal',.04);}
    cyl(.19,.19,.035,x-.23,1.76,z,'ivory',10);sphere(.10,x-.23,1.86,z,'terracotta');cyl(.12,.095,.22,x+.27,1.84,z+.08,'ivory',8);
    if(umbrella){cyl(.05,.05,3.1,x,.88+1.55,z,'ivory',7);cone(1.43,.63,x,3.98,z,'orange',10);cyl(.05,.05,.28,x,4.37,z,'ivory',7);}
  }
  table(-3.8,3.1,true);table(.0,3.55);table(3.9,.3,true);
  // Bread counter outside and a chalkboard sandwich sign.
  bevel(1.8,.84,.70,4.1,1.30,-2.7,'wood',.05);box(1.96,.12,.87,4.1,1.8,-2.7,'ivory');
  for(let i=0;i<3;i++){const m=sphere(.21,3.55+i*.48,1.98,-2.7,'yellow');m.scale.set(1.2,.6,.75);}
  bevel(.9,1.18,.09,2.6,1.48,2.9,'wood',.04,[-.15,0,.05]);bevel(.7,.91,.035,2.6,1.5,2.98,'navy',.025,[-.15,0,.05]);
  for(let i=0;i<3;i++)box(.43-i*.08,.035,.025,2.6,1.68-i*.18,3.03,'ivory');
  palm(-6.1,-3.6,4.35,.55);palm(5.5,-4.65,3.6,-.4);shrub(5.5,3.6,.7);rocks(-5.8,5.1,.8);
}

function learning() {
  // Two small campus halls, a bell arch, and a giant open book on a low plinth.
  for(const [x,z,w,mat]of[[-3.1,-2.4,3.45,'terracotta'],[2.3,-3.45,3.9,'teal']]){
    bevel(w,2.8,2.9,x,2.27,z,'ivory',.08);pitchedRoof(w+.43,3.3,3.75,x,z,mat,root,.96);
    for(const dx of[-.99,.99])windowFront(x+dx,2.55,z+1.49,.58,.95);
    bevel(.86,1.52,.16,x,1.70,z+1.5,mat,.045);steps(x,z+2.1,1.4);
  }
  for(const x of[-.51,.51])bevel(.26,1.2,.52,x,4.42,-3.25,'ivory',.05);
  bevel(1.45,.30,.77,0,5.14,-3.25,'terracotta',.04);cyl(.28,.38,.46,0,4.58,-3.25,'yellow',10);sphere(.10,0,4.27,-3.25,'navy');
  bevel(4.3,.43,2.25,.1,1.08,2.7,'stoneLight',.08);
  const book=group([.1,1.32,2.7],[0,-.12,0]);
  // Spread slopes upward at the spine; colored hardcovers protrude beneath pages.
  for(const side of[-1,1]){
    const angle=-side*.23;
    bevel(1.98,.12,1.9,side*.95,.22,0,side<0?'orange':'teal',.045,[0,0,angle],book);
    bevel(1.82,.27,1.68,side*.93,.41,0,'ivory',.045,[0,0,angle],book);
    for(let i=0;i<4;i++)box(1.32,.025,.048,side*.93,.63+Math.sin(.23)*(.0),-.51+i*.30,'cream',[0,0,angle],book);
  }
  rod([0,.64,-.88],[0,.64,.88],.055,'wood',book);
  // Oversize pencil and a few stacked notebooks.
  const pencil=group([3.9,.85,2.55],[0,.3,-.21]);cyl(.19,.19,2.8,0,1.65,0,'yellow',6,[0,0,0],pencil);cone(.19,.48,0,3.29,0,'woodLight',6,pencil);cone(.065,.20,0,3.58,0,'navy',6,pencil);cyl(.20,.20,.20,0,.18,0,'pink',6,[0,0,0],pencil);
  for(let i=0;i<3;i++){bevel(1.25,.21,.88,-3.5,1.0+i*.24,2.65,['teal','pink','orange'][i],.03,[0,i*.12,0]);box(1.1,.1,.72,-3.5,1.02+i*.24,2.65,'ivory',[0,i*.12,0]);}
  palm(-6,-4.1,4.1,.5);shrub(5.5,-1.7,1);rocks(-5.0,4.9,.85);flag(5.3,.85,-4.9,3.4,'orange');
}

function connect() {
  // Four-legged communications tower with stacked signal bands and two dishes.
  for(const x of[-.85,.85])for(const z of[-2.85,-1.15])rod([x,.86,z],[x*.37,6.9,-2+(z+2)*.37],.115,'ivory');
  for(const y of[1.4,3,4.6,6.2]){
    const r=.85-(y-.86)/6.04*.535;
    for(const z of[-2-r,-2+r])rod([-r,y,z],[r,y,z],.07,'teal');
    for(const x of[-r,r])rod([x,y,-2-r],[x,y,-2+r],.07,'teal');
  }
  for(const z of[-2.85,-1.15]){rod([-.8,1.4,z],[.56,4.6,-2+(z+2)*.6],.055,'teal');rod([.8,1.4,z],[-.56,4.6,-2+(z+2)*.6],.055,'teal');}
  cyl(.20,.26,2.2,0,7.1,-2,'navy',9);cyl(.41,.41,.22,0,7.2,-2,'orange',10);cyl(.33,.33,.19,0,7.65,-2,'orange',10);sphere(.20,0,8.38,-2,'orange');
  for(const [x,y,z,a]of[[.55,5.9,-1.5,-.6],[-.47,4.4,-2.2,.8]]){
    const g=group([x,y,z],[.2,a,.4]);cyl(.73,.42,.27,0,0,0,'ivory',12,[Math.PI/2,0,0],g);cyl(.60,.60,.02,0,0,.15,'glassBlue',12,[Math.PI/2,0,0],g);rod([0,0,.15],[0,0,.82],.042,'navy',g);sphere(.09,0,0,.84,'orange',0,g);
  }
  // Mailbox with an envelope emblem and red raised flag.
  const mail=group([-3.9,.85,1.8],[0,-.13,0]);bevel(.27,1.33,.3,0,.67,0,'wood',.04,[0,0,0],mail);
  bevel(1.25,1.04,1.48,0,1.86,0,'teal',.16,[0,0,0],mail);bevel(.98,.66,.065,0,1.80,.777,'ivory',.04,[0,0,0],mail);
  rod([-.41,2.06,.817],[0,1.79,.817],.025,'teal',mail);rod([0,1.79,.817],[.41,2.06,.817],.025,'teal',mail);box(.06,.91,.08,.68,2.14,0,'orange',[0,0,0],mail);box(.42,.29,.08,.86,2.56,0,'orange',[0,0,0],mail);
  // Repository cubes and a visible branching diagram.
  for(const [x,y,z,s,mat]of[[3.4,1.42,-1.3,1.13,'navy'],[4.58,1.42,-1.3,1.13,'teal'],[3.99,2.61,-1.3,1.13,'orange'],[3.4,1.42,.0,1.13,'ivory']]){
    bevel(s,s,s,x,y,z,mat,.10);bevel(.61,.49,.05,x,y,z+s/2+.03,mat==='ivory'?'teal':'ivory',.035);}
  bevel(3.1,.24,1.1,.4,.97,3.6,'stoneLight',.06);
  rod([-.4,1.25,3.6],[-.4,2.67,3.6],.085,'teal');rod([-.4,1.96,3.6],[1.1,2.63,3.6],.085,'teal');rod([1.1,2.63,3.6],[1.1,3.17,3.6],.085,'teal');
  for(const [x,y]of[[-.4,1.3],[-.4,2.7],[1.1,3.18]])sphere(.24,x,y,3.6,'orange');
  palm(-5.75,-3.6,4.25,.4);palm(5.65,3.0,3.1,-.8);shrub(-4.5,-5.2,1.05);rocks(4.5,-4.5,.9);
}

function boat() {
  root=new THREE.Group();root.name='boat';seed=332;
  const hull=[[-.65,1.35],[-.76,.8],[-.78,-.55],[-.57,-1.35],[0,-2.02],[.57,-1.35],[.78,-.55],[.76,.8],[.65,1.35]];
  ringShape(hull,[[.70,.12],[.88,.28],[1,.68]],'ivory');
  ringShape(hull,[[1.001,.62],[1.004,.75]],'orange');
  shapePrism(hull,.75,.82,'ivory');
  // Recessed-looking dark cockpit, orange deck margin, and forward sun deck.
  bevel(1.13,.055,1.88,0,.86,.27,'navy',.09);
  shapePrism([[-.63,-.72],[-.45,-1.28],[0,-1.83],[.45,-1.28],[.63,-.72]],.83,.88,'orange');
  // Rear bench and two sculptural bucket seats.
  bevel(1.16,.22,.43,0,1.00,1.03,'ivory',.065);bevel(1.16,.37,.15,0,1.17,1.23,'orange',.055);
  for(const x of[-.31,.31]){bevel(.47,.19,.50,x,1.01,.08,'orange',.06);bevel(.47,.43,.14,x,1.20,.31,'ivory',.045,[.09,0,0]);}
  bevel(1.13,.34,.32,0,1.00,-.56,'ivory',.045);
  // Teal wraparound windscreen with slim ivory rails.
  custom([[-.61,1.08,-.72],[.61,1.08,-.72],[.51,1.49,-.91],[-.51,1.49,-.91]], [0,1,2,0,2,3,2,1,0,3,2,0],'glass');
  rod([-.61,1.08,-.72],[-.51,1.49,-.91],.028,'ivory');rod([.61,1.08,-.72],[.51,1.49,-.91],.028,'ivory');rod([-.51,1.49,-.91],[.51,1.49,-.91],.025,'ivory');
  mesh(new THREE.TorusGeometry(.13,.025,5,10),'navy',[.29,1.24,-.39],[-.65,0,0]);
  // Small black outboard at the stern; waterline fin remains below hull lip.
  bevel(.46,.65,.48,0,.77,1.65,'black',.085);box(.23,.65,.21,0,.25,1.75,'metal');bevel(.54,.14,.25,0,-.02,1.75,'black',.04);
  cyl(.15,.15,.055,0,.05,1.93,'black',6,[Math.PI/2,0,0]);
  rod([-.55,.87,1.16],[-.55,1.96,1.24],.025,'ivory');
  custom([[-.55,1.94,1.24],[.02,1.83,1.24],[-.10,1.48,1.24],[-.55,1.58,1.24]], [0,1,2,0,2,3,2,1,0,3,2,0],'orange');
  for(const x of[-.61,.61])bevel(.10,.07,.29,x,.89,-.18,'metal',.025);
  return root;
}

async function exportModel(name) {
  root.updateMatrixWorld(true);const bins=new Map();let sourceMeshes=0;
  root.traverse(o=>{if(!o.isMesh)return;sourceMeshes++;let g=o.geometry.clone();for(const a of Object.keys(g.attributes))if(a!=='position'&&a!=='normal')g.deleteAttribute(a);g.clearGroups();g.applyMatrix4(o.matrixWorld);
    if(!g.index)g.setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i));
    const k=o.material.name;if(!bins.has(k))bins.set(k,[]);bins.get(k).push(g);
  });
  const merged=new THREE.Group();merged.name=name;
  let vertices=0,triangles=0;
  for(const [key,gs]of bins){const combined=mergeGeometries(gs,false);if(!combined)throw Error('Geometry merge failed '+key);const geom=mergeVertices(combined,1e-6);geom.normalizeNormals();const m=new THREE.Mesh(geom,mats[key]);m.name=key;m.castShadow=true;m.receiveShadow=true;merged.add(m);vertices+=geom.attributes.position.count;triangles+=geom.index.count/3;}
  merged.userData={originalProceduralAsset:true,author:'Jack portfolio asset builder',forward:name==='boat'?'-Z':undefined,seaLevel:0,dock:name==='boat'?undefined:{direction:'+Z',width:3,endZ:15.8},colliders:'supplied by application'};
  const bbox=new THREE.Box3().setFromObject(merged);const data=await new GLTFExporter().parseAsync(merged,{binary:true,onlyVisible:true,trs:false});
  await fs.writeFile(path.join(OUT,`${name}.glb`),Buffer.from(data));
  return {name,file:`${name}.glb`,bytes:data.byteLength,sourceMeshes,drawCalls:bins.size,vertices,triangles,bounds:{min:bbox.min.toArray(),max:bbox.max.toArray()},dimensions:bbox.getSize(new THREE.Vector3()).toArray()};
}

const builders={harbor,amtrak,beaconfire,visionx,affirmation,research,catering,learning,connect};
const manifest={generator:'build-assets.mjs',units:'meters',coordinateSystem:'right-handed, Y up',seaLevel:0,boatForward:'-Z',islandOrigin:[0,0,0],dock:{direction:'+Z',centerX:0,width:3,deckY:.45,outerEndZ:15.8,clearWaterFromZ:16,boatSpawn:[0,0,19]},models:[]};
for(const [i,[name,fn]]of Object.entries(builders).entries()){basicIsland(name,i);fn();manifest.models.push(await exportModel(name));}
boat();manifest.models.push(await exportModel('boat'));
manifest.totalBytes=manifest.models.reduce((s,m)=>s+m.bytes,0);
await fs.writeFile(path.join(OUT,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest,null,2));
