// V11 Four Isles: unified walkable coastlines with nine original themed districts.
// Run: node scripts/build-walk-islands.mjs (preserves the existing boat asset)
// Original geometry; V6 keeps UVs across all islands for the shared surface library.
import fs from 'node:fs/promises';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { fileURLToPath } from 'node:url';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {meshopt, dedup, prune} from '@gltf-transform/functions';
import {MeshoptEncoder,MeshoptDecoder} from 'meshoptimizer';
const font = new FontLoader().parse(JSON.parse(await fs.readFile(new URL('../node_modules/three/examples/fonts/helvetiker_bold.typeface.json', import.meta.url),'utf8')));
const OUT = process.env.ARCHIPELAGO_OUTPUT || fileURLToPath(new URL('../static/models/', import.meta.url));
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
// Palette aliases keep the entire toy world within a practical material budget.
for (const [alias,key] of Object.entries({grassDark:'grass', leafLight:'leaf', trunk:'darkWood', woodLight:'wood', glassBlue:'glass', stoneLight:'stone', cream:'ivory', white:'ivory', red:'terracotta'})) mats[alias]=mats[key];
const harborMaterialNames={wood:'v5_dock_wood',darkWood:'v5_dock_darkwood',stone:'v5_stone',sand:'v5_sand',sandEdge:'v5_wetsand',leaf:'v5_foliage'};
mats.rope=new THREE.MeshStandardMaterial({name:'v5_rope',color:'#e9ddbd',roughness:.91});
// Evening fixture roles are separate from animated signals and puzzle colors.
mats.sunsetLantern=new THREE.MeshStandardMaterial({name:'sunsetLantern',color:'#ffe1a0',emissive:'#ffb54e',emissiveIntensity:.72,roughness:.36});
mats.warmWindow=new THREE.MeshStandardMaterial({name:'warmWindow',color:'#f5d8ab',emissive:'#ffc67b',emissiveIntensity:.20,roughness:.48});
const harborMaterials=new Map();
let root, seed, layout, low=false,currentIsland='';
function authoredUV(geometry,material){
 if(material==='rope'&&geometry.attributes.uv){const g=geometry.clone();if(g.type==='TubeGeometry'){const uv=g.attributes.uv;for(let i=0;i<uv.count;i++){const u=uv.getX(i),v=uv.getY(i);uv.setXY(i,v,u);}}return g;}
 const g=geometry.index?geometry.toNonIndexed():geometry,p=g.attributes.position,n=g.attributes.normal;
 g.computeBoundingBox();const b=g.boundingBox,s=b.getSize(new THREE.Vector3()),uv=[];
 for(let i=0;i<p.count;i++){const x=(p.getX(i)-b.min.x)/Math.max(s.x,.001),y=(p.getY(i)-b.min.y)/Math.max(s.y,.001),z=(p.getZ(i)-b.min.z)/Math.max(s.z,.001),nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i)),nz=Math.abs(n.getZ(i));
  let pair=ny>=nx&&ny>=nz?[x,z]:nx>nz?[z,y]:[x,y];
  if((material==='wood'||material==='darkWood')&&s.x>s.z&&ny>nz)pair=[z,x];
  uv.push(...pair);}
 g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));return g;
}
const SHORELINES = {};
const TRACK={center:[0,1.05,-1.4],radiusX:8.8,radiusZ:5.8,clockwise:false,initialAngle:0,speed:0.22};
function random() { seed = (seed*1664525+1013904223)>>>0; return seed/4294967296; }
function mesh(geom, material='ivory', pos=[0,0,0], rot=[0,0,0], parent=root) {
  let mtl=mats[material];
  geom=authoredUV(geom,material);
  if(currentIsland==='harbor'){
   const name=harborMaterialNames[mtl.name]||mtl.name;
   if(!harborMaterials.has(name)){const c=mtl.clone();c.name=name;if(['v5_foliage','orange'].includes(name))c.side=THREE.DoubleSide;harborMaterials.set(name,c);}mtl=harborMaterials.get(name);
  }
  const m = new THREE.Mesh(geom,mtl); m.position.set(...pos); m.rotation.set(...rot); parent.add(m); return m;
}
function group(pos=[0,0,0], rot=[0,0,0], parent=root) { const g=new THREE.Group(); g.position.set(...pos);g.rotation.set(...rot);parent.add(g);return g; }
function box(w,h,d,x,y,z,mat='ivory',rot=[0,0,0],parent=root) { return mesh(new THREE.BoxGeometry(w,h,d),mat,[x,y,z],rot,parent); }
const bevelCache = new Map();
function bevel(w,h,d,x,y,z,mat='ivory',b=.06,rot=[0,0,0],parent=root) {
  b=Math.min(b,w/4,h/4,d/4); const key=[w,h,d,b].join(','); let g=bevelCache.get(key);
  if(!g) { const s=new THREE.Shape();const a=w/2-b,c=h/2-b;s.moveTo(-a,-c);s.lineTo(a,-c);s.lineTo(a,c);s.lineTo(-a,c);s.closePath();
    g=new THREE.ExtrudeGeometry(s,{depth:d-2*b,bevelEnabled:true,bevelThickness:b,bevelSize:b,bevelSegments:2,steps:1});g.translate(0,0,-d/2+b);bevelCache.set(key,g); }
  return mesh(g,mat,[x,y,z],rot,parent);
}
function cyl(rt,rb,h,x,y,z,mat='ivory',segments=12,rot=[0,0,0],parent=root) { return mesh(new THREE.CylinderGeometry(rt,rb,h,segments,1),mat,[x,y,z],rot,parent); }
function cone(r,h,x,y,z,mat='red',segments=10,parent=root) { return cyl(0,r,h,x,y,z,mat,segments,[0,0,0],parent); }
function sphere(r,x,y,z,mat='leaf',detail=0,parent=root) { return mesh(new THREE.IcosahedronGeometry(r,detail),mat,[x,y,z],[random(),random(),random()],parent); }
function rod(a,b,r,mat='wood',parent=root,segments=7) {
  const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),delta=bv.clone().sub(av);const m=cyl(r,r,delta.length(),...av.clone().add(bv).multiplyScalar(.5).toArray(),mat,segments,[0,0,0],parent);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return m;
}
function custom(vertices,indices,mat='ivory',parent=root) {
  let g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices.flat(),3));
  if(currentIsland==='harbor'){const seen=new Set(),front=[];for(let i=0;i<indices.length;i+=3){const tri=indices.slice(i,i+3),key=[...tri].sort((a,b)=>a-b).join(',');if(!seen.has(key)){seen.add(key);front.push(...tri);}}indices=front;}
  g.setIndex(indices);if(currentIsland==='harbor'&&mat!=='leaf'&&g.index)g=g.toNonIndexed();g.computeVertexNormals();return mesh(g,mat,[0,0,0],[0,0,0],parent);
}
function ringShape(points,levels,mat='sand',parent=root) {
  const v=[], ix=[],n=points.length;
  for(const [scale,y] of levels) for(const [x,z]of points)v.push([x*scale,y,z*scale]);
  for(let j=0;j<levels.length-1;j++)for(let i=0;i<n;i++){const a=j*n+i,b=j*n+(i+1)%n,c=(j+1)*n+i,d=(j+1)*n+(i+1)%n;ix.push(a,c,b,b,c,d);}
  const triangles=THREE.ShapeUtils.triangulateShape(points.map(([x,z])=>new THREE.Vector2(x,z)),[]);
  // Coast is a ring only; the separate walk plateau supplies its top surface.
  const m=custom(v,ix,mat,parent);if(m.geometry.index)m.geometry=m.geometry.toNonIndexed();m.geometry.computeVertexNormals();return m;
}
function shapePrism(points,y0,y1,mat,parent=root) {
  const shape=new THREE.Shape(points.map(([x,z])=>new THREE.Vector2(x,-z)));
  const g=new THREE.ExtrudeGeometry(shape,{depth:y1-y0,bevelEnabled:false,steps:1});g.rotateX(-Math.PI/2);g.translate(0,y0,0);return mesh(g,mat,[0,0,0],[0,0,0],parent);
}
function pathStone(x,z,r=.48,mat='stoneLight') {return cyl(r*.95,r,.10,x,.89,z,mat,7,[0,random(),0]);}
function shrub(x,z,s=1,mat='leafLight') { sphere(.53*s,x,1.12*s,z,mat);sphere(.44*s,x+.4*s,1.1*s,z+.12*s,mat);sphere(.38*s,x-.3*s,1.05*s,z+.24*s,'grassDark'); }
function rocks(x,z,s=1) {for(let i=0;i<3;i++){const m=sphere((.29+random()*.25)*s,x+i*.38*s,.89+(.13+random()*.1)*s,z+random()*.35,'stone');m.scale.set(1.25,.7,1);}}
function sculptedPalm(x,z,h,angle,parent){
 const g=group([x,.78,z],[0,angle,0],parent),p=[new THREE.Vector3(0,0,0),new THREE.Vector3(.08,h*.3,0),new THREE.Vector3(.3,h*.7,-.03),new THREE.Vector3(.68,h,-.11)];
 const curve=new THREE.CatmullRomCurve3(p),tg=new THREE.TubeGeometry(curve,low?8:14,.14,low?7:10,false);mesh(tg,'trunk',[0,0,0],[0,0,0],g);
 for(let j=1;j<9;j++){const at=curve.getPoint(j/9);torus(.145,.018,...at.toArray(),'wood',[Math.PI/2,0,-.14],5,low?9:14,g);}
 for(let i=0;i<8;i++){const a=i*Math.PI/4,cs=Math.cos(a),sn=Math.sin(a),length=1.55+(i%3)*.16,points=[],ix=[],steps=low?5:9;
  for(let j=0;j<=steps;j++){const t=j/steps,r=t*length,w=Math.sin(Math.PI*t)*.30,py=h+.42*Math.sin(Math.PI*t)-.5*t*t;
   for(const u of[-1,0,1])points.push([.68+cs*r-sn*w*u,py+(u===0?.07*Math.sin(Math.PI*t):0),-.11+sn*r+cs*w*u]);}
  for(let j=0;j<steps;j++)for(let k=0;k<2;k++){const q=j*3+k;ix.push(q,q+3,q+1,q+1,q+3,q+4,q+1,q+3,q,q+4,q+3,q+1);}
  custom(points,ix,'leaf',g);if(!low){const mid=points.filter((_,j)=>j%3===1);rope(mid,.011,'grass',g);}
 }
 for(const[dx,dz]of[[.1,.06],[-.09,.13],[0,-.14]]){const m=mesh(new THREE.SphereGeometry(.15,low?8:12,6),'trunk',[.68+dx,h-.13,-.11+dz],[0,0,0],g);m.scale.y=1.16;}
}
function palm(x,z,h=4.2,angle=.3,parent=root) {
  if(currentIsland==='harbor')return sculptedPalm(x,z,h,angle,parent);
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
// Hand-authored, consistently counterclockwise coastlines. Forward dock neck is narrow.
const outlines={
  harbor:[[-3,8],[-5,8.5],[-8,11],[-11.5,10],[-14,6],[-15,1],[-14,-5],[-10,-10],[-5,-12],[1,-12.8],[7,-11.5],[12,-8],[14,-3],[14,3],[12,8],[8,10.5],[5,8.3],[3,8]],
  amtrak:[[-3,8],[-7,8],[-12,6.5],[-15,3],[-16,-1],[-15,-5],[-11,-8.5],[-5,-10],[4,-10.5],[11,-8.8],[15,-5],[16,-1],[14.7,3.8],[11,6.5],[6,8],[3,8]],
  beaconfire:[[-3,8],[-7,8],[-7,10],[-11,9],[-13,5],[-13,0],[-15,-2],[-15,-7],[-10,-11],[-5,-11],[-3,-14],[4,-14],[7,-11],[12,-11],[15,-6],[13,-2],[14,4],[10,7],[6,7],[3,8]],
  visionx:[[-3,8],[-6,8],[-10,6],[-12,2],[-12,-3],[-9,-7],[-8,-11],[-4,-14],[1,-16],[6,-15],[9,-12],[10,-7],[13,-3],[14,1],[12,5],[7,7],[3,8]],
  affirmation:[[-3,8],[-6,9.5],[-10,10],[-13,8],[-15,3],[-15,-2],[-12,-7],[-7,-10],[0,-12],[7,-10.5],[12,-7],[14,-2],[14,3],[12,7.5],[9,10],[6,9.5],[3,8]],
  research:[[-3,8],[-7,8],[-10,6],[-11.5,2],[-12,-2],[-11,-5],[-13,-8],[-10,-12],[-5,-14],[3,-14],[7,-11],[12,-10],[14,-6],[12,-3],[12,2],[9,6],[5,8],[3,8]],
  catering:[[-3,8],[-6,8],[-8,11],[-11,12],[-14,9],[-15,4],[-13,-1],[-14,-5],[-10,-10],[-4,-12],[3,-12],[8,-10],[12,-6],[14,-1],[13,4],[10,7],[7,7.5],[5,6],[3,8]],
  learning:[[-3,8],[-6,8],[-9,10],[-13,8],[-15,3],[-15,-3],[-13,-8],[-9,-11],[-5,-12],[-1,-9],[2,-10],[7,-13],[12,-11],[15,-7],[16,-2],[14,3],[11,7],[7,8.5],[3,8]],
  connect:[[-3,8],[-5,7],[-8,4],[-10,0],[-11,-4],[-10,-8],[-7,-11],[-2,-13],[4,-13],[9,-10],[12,-6],[12,-2],[10,2],[7,5],[3,8]],
};
function torus(radius,tube,x,y,z,mat='ivory',rot=[0,0,0],radial=6,tubular=16,parent=root){return mesh(new THREE.TorusGeometry(radius,tube,radial,tubular),mat,[x,y,z],rot,parent);}
function rope(points,r=.035,mat='ivory',parent=root){for(let i=1;i<points.length;i++)rod(points[i-1],points[i],r,mat,parent,6);}
function dynamic(name,pos=[0,0,0],rot=[0,0,0]){const g=group(pos,rot);g.name=name;g.userData={animated:true};return g;}
function animatedFlag(x,y,z,h,name){
  cyl(.048,.06,h,x,y+h/2,z,'ivory',8);sphere(.085,x,y+h,z,'yellow');
  const g=dynamic(name,[x,y+h-.18,z]);
  const pts=[[0,0,0],[.48,-.06,.10],[1.0,-.17,0],[.8,-.76,.03],[.43,-.64,.1],[0,-.55,0]];
  custom(pts,[0,1,5,1,4,5,1,2,4,2,3,4,5,1,0,5,4,1,4,2,1,4,3,2],'orange',g);
}
function text3D(label,size,x,y,z,mat='navy',depth=.07,parent=root){
  const geo=new TextGeometry(label,{font,size,depth,curveSegments:2,bevelEnabled:false});
  geo.computeBoundingBox();geo.translate(-(geo.boundingBox.max.x+geo.boundingBox.min.x)/2,0,0);
  return mesh(geo,mat,[x,y,z],[0,0,0],parent);
}
function slatBench(x,z,a=0){
  const g=group([x,.85,z],[0,a,0]);
  for(const dz of[-.22,0,.22])bevel(1.95,.12,.18,0,.55,dz,'wood',.025,[0,0,0],g);
  for(const yy of[.89,1.13])bevel(1.95,.18,.11,0,yy,-.33,'wood',.025,[.12,0,0],g);
  for(const xx of[-.69,.69]){rod([xx,0,-.2],[xx,.61,-.2],.06,'teal',g);rod([xx,0,.23],[xx,.61,.23],.06,'teal',g);rod([xx,.32,-.23],[xx,1.23,-.33],.055,'teal',g);}
}
function crate(x,y,z,s=.8){
  bevel(s,s,s,x,y+s/2,z,'wood',.05);
  for(const dx of[-.36,.36])bevel(.07,s*.93,.035,x+dx*s,y+s/2,z+s*.51,'darkWood',.01);
  for(const dy of[.1,.9])bevel(s*.96,.065,.035,x,y+dy*s,z+s*.52,'darkWood',.01);
  rod([x-s*.35,y+s*.13,z+s*.54],[x+s*.35,y+s*.85,z+s*.54],.038,'darkWood');
}
function bollard(x,z){cyl(.20,.25,.20,x,.92,z,'stone',10);cyl(.08,.11,.53,x,1.25,z,'navy',8);rod([x-.22,1.42,z],[x+.22,1.42,z],.06,'navy');}
function lamp(x,z,mat='teal',h=2.8){
 cyl(.18,.22,.12,x,.9,z,'stone',10);rod([x,.92,z],[x,h+.85,z],.055,mat);
 bevel(.34,.48,.34,x,h+.7,z,'sunsetLantern',.08);bevel(.49,.08,.49,x,h+1.02,z,'navy',.03);cone(.3,.22,x,h+1.17,z,'navy',8);
 bevel(.43,.07,.43,x,h+.43,z,'metal',.025);
 for(const dx of[-.18,.18])for(const dz of[-.18,.18])rod([x+dx,h+.44,z+dz],[x+dx,h+.97,z+dz],.022,'navy');
 if(!low)torus(.09,.016,x,h+1.35,z,'metal',[0,0,0],5,12);
}
function pottedPlant(x,z,s=1,parent=root,y=.85){
  cyl(.34*s,.24*s,.54*s,x,y+.27*s,z,'terracotta',9,[0,0,0],parent);
  cyl(.36*s,.34*s,.09*s,x,y+.52*s,z,'terracotta',9,[0,0,0],parent);
  cyl(.285*s,.285*s,.025*s,x,y+.56*s,z,'darkWood',9,[0,0,0],parent);
  leafy(x,y+.56*s,z,s,parent);
}
function leafy(x,y,z,s=1,parent=root){
  rod([x,y,z],[x,y+1.2*s,z],.035*s,'leaf',parent);
  for(let i=0;i<7;i++){const a=i*2.4;const m=sphere(.29*s,x+Math.cos(a)*.24*s,y+.18*s+i*.145*s,z+Math.sin(a)*.23*s,'leaf',0,parent);m.scale.set(1.5,.35,.7);m.rotation.z=Math.cos(a)*.4;}
}
function flowers(x,z,s=.8){
  shrub(x,z,s,'leaf');
  for(let i=0;i<5;i++){const a=i*2.4,dx=Math.cos(a)*.42*s,dz=Math.sin(a)*.4*s;rod([x+dx,.86,z+dz],[x+dx,1.45,z+dz],.018,'leaf');sphere(.095,x+dx,1.45,z+dz,i%2?'pink':'yellow');}
}
function conifer(x,z,h=3.8){rod([x,.85,z],[x,.85+h,z],.13,'darkWood');for(let i=0;i<3;i++)cone(1.0-i*.22,1.7,x,1.65+i*.82,z,i%2?'leaf':'grass',9);}
function pathLine(points){for(let i=1;i<points.length;i++){const a=new THREE.Vector2(...points[i-1]),b=new THREE.Vector2(...points[i]),n=Math.ceil(a.distanceTo(b)/.85);for(let j=0;j<n;j++){const p=a.clone().lerp(b,j/n);pathStone(p.x,p.y,.37);}}}
function gardenBed(x,z,w,d,a=0){
  const g=group([x,.85,z],[0,a,0]);bevel(w,.32,d,0,.16,0,'wood',.045,[0,0,0],g);bevel(w-.2,.07,d-.2,0,.34,0,'darkWood',.03,[0,0,0],g);
  const n=Math.max(2,Math.floor(w/.58));for(let i=0;i<n;i++){for(const zz of[-d*.22,d*.22])leafy(-w*.38+i*w*.76/(n-1),.39,zz,.45,g);}
}
function inside(poly,x,z){let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const[a,b]=poly[i],[d,e]=poly[j];if(((b>z)!=(e>z))&&(x<(d-a)*(z-b)/(e-b)+a))c=!c;}return c;}

// V4 walking islands. Geometry and navigation are authored together; all measurements are local meters.
const Y=.85;
const THEMES={harbor:['HARBOR','#254d64'],amtrak:['AMTRAK','#254d64'],beaconfire:['BEACONFIRE','#338e8b'],visionx:['VISION X','#458760'],affirmation:['ONE SMALL STEP','#b4a7d2'],research:['OBSERVATORY','#658cb5'],catering:['GOOD TASTE','#f47e45'],learning:['KEEP LEARNING','#254d64'],connect:['SAY HELLO','#338e8b']};
function solid(x,z,w,d,h=1,y=Y,rotation=0,name='obstacle'){layout.obstacles.push({name,x,z,width:w,depth:d,height:h,y,rotation});}
function occluder(name,fn){const owner=root,g=group();g.name='occluder_'+name;root=g;fn();root=owner;return g;}
function cubeSolid(w,h,d,x,y,z,mat='ivory',rotation=0,name='building'){bevel(w,h,d,x,y,z,mat,.06,[0,rotation,0]);solid(x,z,w,d,h,y-h/2,rotation,name);}
// A single union surface avoids coplanar dark joins where the scenic route doubles back.
function harborPath(points,width,y){
 const step=.12,r=width/2,loX=Math.floor((Math.min(...points.map(p=>p[0]))-r)/step)-1,hiX=Math.ceil((Math.max(...points.map(p=>p[0]))+r)/step)+1,loZ=Math.floor((Math.min(...points.map(p=>p[1]))-r)/step)-1,hiZ=Math.ceil((Math.max(...points.map(p=>p[1]))+r)/step)+1;
 const filled=new Set(),key=(x,z)=>x+','+z;
 for(let x=loX;x<=hiX;x++)for(let z=loZ;z<=hiZ;z++)if(points.slice(1).some((b,i)=>distanceToSegment((x+.5)*step,(z+.5)*step,points[i],b)<=r))filled.add(key(x,z));
 const edges=new Map(),add=(a,b)=>edges.set(key(...a),b);
 for(const k of filled){const[x,z]=k.split(',').map(Number);if(!filled.has(key(x,z-1)))add([x,z],[x+1,z]);if(!filled.has(key(x+1,z)))add([x+1,z],[x+1,z+1]);if(!filled.has(key(x,z+1)))add([x+1,z+1],[x,z+1]);if(!filled.has(key(x-1,z)))add([x,z+1],[x,z]);}
 const loops=[];
 while(edges.size){let at=edges.keys().next().value;const start=at,loop=[];do{const next=edges.get(at);if(!next)break;loop.push(at.split(',').map(v=>Number(v)*step));edges.delete(at);at=key(...next);}while(at!==start);if(loop.length>3)loops.push(loop.filter((p,i)=>{const a=loop[(i+loop.length-1)%loop.length],b=loop[(i+1)%loop.length];return Math.abs((p[0]-a[0])*(b[1]-p[1])-(p[1]-a[1])*(b[0]-p[0]))>1e-7;}));}
 function simplify(points,tolerance=.075){if(points.length<4)return points;let best=0,index=0;for(let i=1;i<points.length-1;i++){const d=distanceToSegment(...points[i],points[0],points.at(-1));if(d>best){best=d;index=i;}}if(best<=tolerance)return[points[0],points.at(-1)];return[...simplify(points.slice(0,index+1),tolerance).slice(0,-1),...simplify(points.slice(index),tolerance)];}
 for(let i=0;i<loops.length;i++){const p=loops[i],middle=Math.floor(p.length/2);loops[i]=[...simplify(p.slice(0,middle+1)).slice(0,-1),...simplify([...p.slice(middle),p[0]]).slice(0,-1)];}
 const area=p=>p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0);
 for(const outer of loops.filter(p=>area(p)>0)){
  const shape=new THREE.Shape(outer.map(([x,z])=>new THREE.Vector2(x,-z)));
  for(const hole of loops.filter(p=>area(p)<0&&inside(outer,...p[0])))shape.holes.push(new THREE.Path(hole.map(([x,z])=>new THREE.Vector2(x,-z))));
  const g=new THREE.ShapeGeometry(shape);g.rotateX(-Math.PI/2);mesh(g,'sand',[0,y+.009,0]);
 }
}
function pathStrip(points,width=2.2,y=Y+.009){
 if(currentIsland==='harbor')return harborPath(points,width,y);
 for(let i=1;i<points.length;i++){const [ax,az]=points[i-1],[bx,bz]=points[i],dx=bx-ax,dz=bz-az,len=Math.hypot(dx,dz);box(width,.018,len,(ax+bx)/2,y,(az+bz)/2,'sand',[0,Math.atan2(dx,dz),0]);}
 for(const[x,z]of points)cyl(width/2,width/2,.018,x,y,z,'sand',12);
}
function rail(points,y=Y,mat='teal'){for(let i=0;i<points.length;i++){const[x,z]=points[i];rod([x,y,z],[x,y+.73,z],.035,mat);if(i)rod([points[i-1][0],y+.7,points[i-1][1]],[x,y+.7,z],.031,mat);}}
function harborPier(){
 for(let i=0;i<19;i++){const z=8.1+i*.415;bevel(3,.20,.40,0,.75,z,'wood',.035);
  for(const x of[-1.05,1.05]){cyl(.026,.026,.008,x,.854,z,'metal',low?6:10);if(!low)box(.028,.002,.004,x,.859,z,'darkWood',[0,.4,0]);}
  if(!low&&i%4===1){const mark=mesh(new THREE.RingGeometry(.027,.033,12),'darkWood',[.5*Math.sin(i*2),.853,z],[ -Math.PI/2,0,0]);mark.scale.set(1,.6,1);}
 }
 for(const x of[-1.19,1.19]){
  bevel(.17,.23,7.9,x,.56,11.85,'darkWood',.025);
  for(const z of[8.3,10.8,13.3,15.55]){
   const post=mesh(new THREE.CylinderGeometry(.14,.18,1.6,low?10:16,3),'wood',[x,.19,z]);
   bevel(.32,.10,.32,x,1.01,z,'wood',.025);
   for(const y of[.94,.985])torus(.162,.024,x,y,z,'rope',[Math.PI/2,0,0],low?4:6,low?12:20);
   if(!low){const knot=[new THREE.Vector3(x+.12,1.005,z),new THREE.Vector3(x+.23,.97,z+.04),new THREE.Vector3(x+.20,.85,z+.09),new THREE.Vector3(x+.12,.91,z+.02)];mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(knot),10,.024,5,false),'rope');}
   solid(x,z,.33,.33,.28,.85,0,'pier piling');
  }
  for(const z of[11.15,13.8]){
   const f=mesh(new THREE.CapsuleGeometry(.17,.49,low?3:5,low?8:12),'navy',[x*1.31,.44,z]);f.rotation.z=x<0?.10:-.10;
   torus(.065,.018,x*1.31,.855,z,'rope',[0,0,0],5,12);
   const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(x,.95,z-.1),new THREE.Vector3(x*1.13,.96,z-.02),new THREE.Vector3(x*1.31,.82,z)]);mesh(new THREE.TubeGeometry(curve,8,.022,5,false),'rope');
   if(!low){for(const side of[-1,1])rod([x*1.31+side*.085,.2,z+.135],[x*1.31+side*.085,.66,z+.135],.009,'black');}
  }
  for(const z of[8.3,10.8]){const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(x,1.03,z),new THREE.Vector3(x,.855,z+1.25),new THREE.Vector3(x,1.03,z+2.5)]);mesh(new THREE.TubeGeometry(curve,low?8:20,.035,low?5:7,false),'rope');}
 }
 layout.surfaces.push({x:0,z:11.85,width:3,depth:7.9,y:Y});
 box(3,.16,1.8,0,.77,7.3,'wood');layout.surfaces.push({x:0,z:7.3,width:3,depth:1.8,y:Y});
}
function woodenPier(){
 if(currentIsland==='harbor')return harborPier();
 for(let i=0;i<19;i++){const z=8.1+i*.415;bevel(3,.20,.40,0,.75,z,'wood',.025);if(!low)for(const x of[-1.05,1.05])cyl(.035,.035,.012,x,.858,z,'darkWood',6);}
 for(const x of[-1.19,1.19]){
  box(.17,.23,7.9,x,.56,11.85,'darkWood');
  for(const z of[8.3,10.8,13.3,15.55]){cyl(.14,.18,1.6,x,.19,z,'wood',9);cyl(.17,.17,.12,x,1.02,z,'wood',9);if(!low)torus(.148,.023,x,.955,z,'ivory',[Math.PI/2,0,0]);solid(x,z,.33,.33,.28,.85,0,'pier piling');}
  for(const z of[11.15,13.8]){torus(.32,.085,x*1.28,.44,z,'black',[0,Math.PI/2,0]);rod([x,.94,z-.12],[x*1.28,.7,z],.025,'ivory');}
  rope([[x,1.05,8.3],[x,.89,9.55],[x,1.05,10.8],[x,.88,12.1],[x,1.05,13.3]],.025,'ivory');
 }
 layout.surfaces.push({x:0,z:11.85,width:3,depth:7.9,y:Y});
 // A short neck guarantees a level connection even at the irregular Connect coastline.
 box(3,.16,1.8,0,.77,7.3,'wood');layout.surfaces.push({x:0,z:7.3,width:3,depth:1.8,y:Y});
}
function plaque(station,index){
 const {x,z,label}=station,by=station.y??Y;const g=group();g.name='station_'+station.id;
 for(const xx of[x-.47,x+.47])rod([xx,by,z-.9],[xx,by+1.18,z-.9],.045,'teal',g);
 bevel(1.62,.94,.12,x,by+1.02,z-.9,'navy',.045,[0,0,0],g);
 bevel(1.45,.78,.023,x,by+1.02,z-.823,'ivory',.025,[0,0,0],g);
 let words=label.toUpperCase().split(' '),lines=[''];for(const w of words){if((lines.at(-1)+' '+w).trim().length>14)lines.push(w);else lines[lines.length-1]=(lines.at(-1)+' '+w).trim();}
 const size=Math.min(.145,1.27/Math.max(...lines.map(s=>s.length))/.7);
 lines.slice(0,3).forEach((line,n)=>text3D(line,size,x,by+1.16-n*.19,z-.797,'navy',.012,g));
 text3D(String(index+1).padStart(2,'0'),.11,x,by+.70,z-.795,'teal',.009,g);
 if(station.type==='action')text3D('TRY IT',.09,x,by+.54,z-.795,'orange',.009,g);
 solid(x,z-.9,1.62,.15,1.5,by,0,'plaque '+station.id);
}
function putBench(x,z,yaw=0){layout.bench={x,z,y:Y+.55,yaw,approach:{x:x+Math.sin(yaw)*.9,z:z+Math.cos(yaw)*.9,y:Y}};slatBench(x,z,yaw);solid(x,z,1.95,.8,1.25,Y,yaw,'rest bench');}
function floorGrid(x,z,w,d){box(w,.04,d,x,Y-.02,z,'stone');if(!low){for(let xx=x-w/2+.8;xx<x+w/2;xx+=.8)box(.014,.005,d-.03,xx,Y+.007,z,'sand');for(let zz=z-d/2+.8;zz<z+d/2;zz+=.8)box(w-.03,.005,.014,x,Y+.007,zz,'sand');}}
function table(x,z,w=1.6,d=.75,mat='wood'){bevel(w,.13,d,x,Y+.79,z,mat,.04);for(const dx of[-w*.4,w*.4])for(const dz of[-d*.32,d*.32])rod([x+dx,Y,z+dz],[x+dx,Y+.77,z+dz],.045,'navy');solid(x,z,w,d,.9,Y,0,'table');}
function books(x,y,z){for(let i=0;i<4;i++)bevel(.17,.43+.04*(i%2),.35,x+i*.20,y+.23,z,['orange','ivory','teal','blue'][i],.015);}
function detailPlant(x,z,s=1){pottedPlant(x,z,s);if(s>.65)solid(x,z,.65*s,.65*s,.6*s,Y,0,'plant pot');}
function nameSign(name,x,y,z,size=.3){text3D(name,size,x,y,z,'navy',.025);}
function barrel(x,z){cyl(.31,.32,.68,x,Y+.34,z,'wood',12);for(const yy of[Y+.12,Y+.52])torus(.314,.025,x,yy,z,'navy',[Math.PI/2,0,0]);solid(x,z,.64,.64,.7,Y,0,'barrel');}
function terrain(name,index){
 currentIsland=name;root=new THREE.Group();root.name=name;seed=12731+index*891;
 const points=outlines[name];if(points.reduce((s,p,i)=>{const q=points[(i+1)%points.length];return s+p[0]*q[1]-q[0]*p[1]},0)<0)points.reverse();SHORELINES[name]=points;
 ringShape(points,[[.92,-.62],[1,.04],[.986,.28]],'sandEdge');ringShape(points,[[.986,.27],[.968,.58],[.94,Y]],'sand');
 // Flat, level island plateaus are the authoritative walking surface.
 shapePrism(points.map(([x,z])=>[x*.94,z*.94]),Y-.08,Y,'grass');
 layout={id:name,groundY:Y,shore:points.map(([x,z])=>[+(x*.94).toFixed(5),+(z*.94).toFixed(5)]),surfaces:[],obstacles:[],route:[[0,14],[0,5.8],[6,3.4],[7,-4.8],[4.5,-7.4],[-4.5,-7.4],[-7,-4.8],[-6,3.4],[0,5.8],[0,14]],stations:[],bench:null,berths:[{boat:{x:-3.5,z:13.25,yaw:Math.PI},landing:{x:-.4,z:13.5,y:Y,yaw:Math.PI}},{boat:{x:3.5,z:13.25,yaw:Math.PI},landing:{x:.4,z:13.5,y:Y,yaw:Math.PI}}]};
 woodenPier();
 for(const x of[-2.15,2.15]){lamp(x,6,'teal',2.0);solid(x,6,.36,.36,3,Y,0,'path light');}
}
function coastalPlant(x,z,s=1){
 for(let k=0;k<(low?4:7);k++){const a=k*2.399,cs=Math.cos(a),sn=Math.sin(a),len=s*(.57+(k%3)*.12),v=[],ix=[],steps=low?3:5;
  for(let j=0;j<=steps;j++){const t=j/steps,r=t*len,w=Math.sin(Math.PI*t)*s*.17,py=Y+.04+.55*s*Math.sin(t*Math.PI*.84);for(const side of[-1,0,1])v.push([x+cs*r-sn*w*side,py+(side===0?.045:0),z+sn*r+cs*w*side]);}
  for(let j=0;j<steps;j++)for(let n=0;n<2;n++){const q=j*3+n;ix.push(q,q+3,q+1,q+1,q+3,q+4);}custom(v,ix,'leaf');
 }
}
function coastDetails(name){
 const points=SHORELINES[name];for(let i=0;i<points.length;i++){
  const[x,z]=points[i];if(Math.abs(x)<4&&z>4)continue;
  if(layout.route.slice(1).some((p,j)=>distanceToSegment(x*.86,z*.86,layout.route[j],p)<2.2))continue;
  if(i%4===0){const px=x*.86,pz=z*.86;occluder(name+'_tree_'+i,()=>{if(name==='learning'||name==='research')conifer(px,pz,3.3);else palm(px,pz,3.2+random()*.6,.4);});solid(px+.15,pz,.48,.48,3,Y,0,'tree trunk');}
  else if(!low&&i%3===0)flowers(x*.875,z*.875,.55);
  if(!low){rocks(x*.966,z*.966,.45);for(let j=0;j<3;j++){const s=sphere(.055,x*.96+(j-1)*.17,.65,z*.96,'ivory');s.scale.set(1.3,.45,1);}}
  if(name==='harbor'){
   coastalPlant(x*.89,z*.89,.7+(i%3)*.14);
   if(!low)coastalPlant(x*.87+.47,z*.87-.25,.56);
   if(i%2===0){const rock=mesh(new THREE.SphereGeometry(.36,low?8:12,low?5:8),'stone',[x*.94,.69,z*.94]);rock.scale.set(1.4,.54,.95);rock.rotation.y=i*.7;}
  }
 }
}
function harbor(){
 const x=-1.7,z=-1.8;cyl(1.4,1.5,.18,x,.94,z,'stone',low?12:24);solid(x,z,2.9,2.9,8.5,Y,0,'lighthouse');
 for(let i=0;i<5;i++)cyl(1.05-i*.09,1.14-i*.09,1.30,x,1.59+i*1.3,z,i%2?'terracotta':'ivory',low?12:24);
 occluder('harbor_lantern',()=>{cyl(1.07,1.07,.14,x,7.88,z,'navy',12);cyl(.7,.72,1.1,x,8.50,z,'glass',10);cone(1.05,.7,x,9.40,z,'terracotta',12);for(let i=0;i<8;i++){let a=i*Math.PI/4;rod([x+Math.cos(a)*.66,7.95,z+Math.sin(a)*.66],[x+Math.cos(a)*.66,9.07,z+Math.sin(a)*.66],.038,'ivory');}});
 bevel(.67,1.25,.12,x,Y+.64,z+1.18,'teal',.12);text3D('01',.24,x,Y+2,z+1.10,'navy',.025);
 cubeSolid(3.3,2.2,2.45,3.1,Y+1.1,-2.6,'ivory',0,'harbor office');occluder('harbor_roof',()=>pitchedRoof(3.65,2.75,Y+2.2,3.1,-2.6,'terracotta',root,.65));windowFront(3.75,2.17,-1.34,.55,.7);bevel(.7,1.45,.10,2.4,Y+.74,-1.34,'teal');sphere(.048,2.6,1.6,-1.265,'yellow');nameSign('HARBOR',3.1,2.75,-1.31,.22);
 const bell=dynamic('anim_bell',[-5.1,3.1,2.0]);cyl(.22,.37,.5,0,-.30,0,'yellow',12,[0,0,0],bell);rod([0,0,0],[0,-.72,0],.025,'navy',bell);for(const xx of[-5.65,-4.55])rod([xx,Y,2],[xx,3.2,2],.075,'wood');rod([-5.7,3.17,2],[-4.5,3.17,2],.09,'wood');solid(-5.1,2,1.3,.2,2.4,Y,0,'bell frame');
 animatedFlag(5.2,Y,-5.7,2.8,'anim_flag');
 table(5.1,-5.15,1.8,.7);for(let j=0;j<3;j++)box(.34,.03,.32,4.65+j*.44,Y+.9,-5.15,['navy','orange','black'][j]);rod([4.52,Y+.94,-5.07],[4.9,Y+.94,-5.3],.027,'metal');
 for(const zz of[1.5,2.5]){torus(.4,.09,3.5,1.8,zz,'orange',[0,Math.PI/2,0]);}
 nameSign('JACK',3.1,3.56,-1.31,.42);nameSign('WELCOME ABOARD',3.1,3.36,-1.31,.11);
 // Small joinery and hardware reward the walking camera without adding collision clutter.
 for(const side of[-1,1]){box(.035,1.12,.04,2.4+side*.29,1.65,-1.271,'ivory');}
 for(const y of[1.35,1.80])bevel(.12,.04,.04,2.69,y,-1.265,'metal',.008);
 for(const x of[4.45,5.75]){cyl(.10,.10,.025,x,1.80,-5.07,'navy',12);torus(.14,.015,x,1.805,-5.05,'rope',[Math.PI/2,0,0],5,16);}
 for(let j=0;j<5;j++){bevel(.13,.04,.25,4.45+j*.28,1.85,-5.26,j%2?'metal':'navy',.015,[0,.16*j,0]);}
 for(const[x,z]of[[-10,-6],[10,-6],[-11,3],[10,5]]){
  const pl=mesh(new THREE.SphereGeometry(.75,low?8:14,low?5:8),'stone',[x,1.03,z]);pl.scale.set(1.1,.44,.8);pl.rotation.y=x*.13;
  if(!low)for(let j=0;j<3;j++){const shell=mesh(new THREE.SphereGeometry(.10,10,5,0,Math.PI*2,0,Math.PI/2),'ivory',[x+.7+j*.14,.86,z+.45]);shell.scale.set(1.3,.3,1);}
 }
 layout.stations=[{id:'welcome',type:'read',label:'Meet Jack',x:2.8,z:3.5,y:Y,contentSection:'summary'},{id:'bell',type:'action',label:'Harbor bell',x:-4.7,z:3.7,y:Y,action:'harbor'},{id:'studio',type:'studio',label:'Boat Studio',x:5.2,z:-3.6,y:Y}];putBench(-6.0,-4.2,.25);
}
function amtrak(){
 const tr=TRACK;
 cubeSolid(5.2,2.45,2.7,0,Y+1.225,-2.5,'ivory',0,'station');occluder('amtrak_roof',()=>pitchedRoof(5.7,3.15,3.30,0,-2.5,'navy',root,.84));bevel(.9,1.7,.11,0,Y+.87,-1.1,'teal');for(const x of[-1.6,1.6])windowFront(x,2.2,-1.1,.8,.85);nameSign('JACK CENTRAL',0,2.93,-1.02,.19);
 occluder('amtrak_canopy',()=>{box(5.7,.14,1.4,0,2.8,-.50,'orange');});for(const x of[-2.5,2.5]){rod([x,Y,-.1],[x,2.8,-.1],.045,'navy');solid(x,-.1,.14,.14,2,Y,0,'canopy post');}
 // Clock hands and a wheeled luggage trolley reward the closer camera.
 cyl(.39,.39,.10,0,3.84,-.95,'ivory',16,[Math.PI/2,0,0]);box(.04,.23,.035,0,3.92,-.88,'navy');box(.20,.04,.035,.08,3.84,-.88,'navy');
 for(let j=0;j<80;j++){const a=j*Math.PI*2/80,x=tr.radiusX*Math.cos(a),z=tr.center[2]+tr.radiusZ*Math.sin(a);bevel(1.2,.055,.20,x,Y+.027,z,'darkWood',.01,[0,Math.atan2(-tr.radiusX*Math.sin(a),tr.radiusZ*Math.cos(a)),0]);}
 for(const o of[-.43,.43]){let ps=[];for(let j=0;j<=90;j++){const a=j*Math.PI*2/90;ps.push([(tr.radiusX+o)*Math.cos(a),Y+.07,tr.center[2]+(tr.radiusZ+o)*Math.sin(a)]);}rope(ps,.032,'metal');}
 const train=dynamic('anim_train',[tr.radiusX,0,tr.center[2]],[0,Math.PI,0]);bevel(1.05,1.0,2.3,0,1.54,0,'navy',.09,[0,0,0],train);box(1.13,.20,2.38,0,2.14,0,'ivory',[0,0,0],train);box(1.07,.24,2.32,0,1.24,0,'orange',[0,0,0],train);for(const x of[-.55,.55])for(const z of[-.72,.63]){cyl(.19,.19,.12,x,Y+.21,z,'black',10,[0,0,Math.PI/2],train);box(.022,.4,.56,x,1.65,z,'glass',[0,0,0],train);}bevel(1.05,.9,1.8,0,1.47,2.4,'ivory',.06,[0,0,0],train);box(1.11,.17,1.88,0,1.99,2.4,'navy',[0,0,0],train);
 const signal=dynamic('anim_signal',[4.0,2.2,2.5]);rod([4,Y,2.5],[4,2.75,2.5],.05,'navy');bevel(.33,.73,.2,0,.15,0,'navy',.07,[0,0,0],signal);for(const[y,m]of[[.33,'orange'],[-.01,'yellow']])cyl(.09,.09,.024,0,y,.12,m,10,[Math.PI/2,0,0],signal);solid(4,2.5,.25,.25,2,Y,0,'signal');
 // The only formal pedestrian crossing is south of the station; runtime pauses the train here.
 layout.crossing={x:0,z:4.4,width:3.0,depth:2.5,trackCenter:[0,-1.4],trackRadii:[8.8,5.8]};
 for(const x of[-2,2]){rail([[x,5.4],[x,3.4]],Y);solid(x,4.4,.1,2.0,.8,Y,0,'crossing rail');}
 for(let i=0;i<5;i++)box(2.4,.027,.18,0,Y+.08,3.65+i*.34,'ivory');
 for(const x of[-3.5,3.5]){rod([x,Y,4.5],[x,2.2,4.5],.03,'navy');bevel(.72,.30,.045,x,2.2,4.5,'yellow',.015);text3D('LOOK',.09,x,2.17,4.535,'navy',.01);}
 layout.route=[[0,14],[0,5.8],[0,2.4],[5.8,1.6],[6,-4.5],[4,-5.5],[-4,-5.5],[-6,-4.2],[-5.8,1.6],[0,2.4],[0,5.8],[0,14]];
 layout.stations=[{id:'experience',type:'read',label:'The journey',x:-4.4,z:1.1,y:Y,contentSection:'summary'},{id:'dispatch',type:'action',label:'Dispatch train',x:4.7,z:1.0,y:Y,action:'amtrak'},{id:'workflow',type:'read',label:'Post bid award',x:4.8,z:-4.2,y:Y,contentSection:'contributions'}];putBench(-4.8,-4.3,0);
 table(-3.8,-.5,1.2,.6);for(let j=0;j<3;j++)bevel(.3,.4,.3,-4.1+j*.33,Y+1.1,-.5,['wood','blue','orange'][j],.04);
}
function beaconfire(){
 floorGrid(0,-2.1,6.3,5.6);
 // Open workshop: no solid center box, a broad through aisle and collision-matched posts.
 for(const x of[-3,3])for(const z of[-4.7,.5]){cubeSolid(.18,3.3,.18,x,Y+1.65,z,'navy',0,'workshop column');}
 occluder('beaconfire_roof',()=>{bevel(6.6,.23,5.9,0,4.2,-2.1,'blue');box(6.7,.11,.28,0,4.07,.84,'orange');});nameSign('BUILD / CONNECT',0,3.55,.8,.22);
 for(const x of[-2.2,2.2]){table(x,-2.2,1.2,3.5);for(let j=0;j<2;j++){box(.65,.05,.42,x,Y+.89,-3.1+j*1.8,'navy');bevel(.65,.48,.05,x,Y+1.1,-3.25+j*1.8,'navy',.02);box(.52,.34,.02,x,Y+1.11,-3.21+j*1.8,'glass');}}
 for(let j=0;j<3;j++){const x=-3.6+j*3.6;cubeSolid(.7,.8,.6,x,Y+.4,-6.0,['teal','orange','blue'][j],0,'pipeline node');const p=dynamic('anim_packet_'+j,[x,1.80,-6]);bevel(.32,.32,.32,0,0,0,'orange',.045,[0,0,0],p);nameSign(['RETRIEVE','CONTEXT','RESPOND'][j],x,2.1,-5.94,.12);}rod([-3.6,1.95,-6],[3.6,1.95,-6],.09,'teal');
 const rotor=dynamic('anim_rotor',[-2.1,4.55,-3.3]);for(let j=0;j<4;j++)box(1.1,.08,.16,Math.cos(j*Math.PI/2)*.4,0,Math.sin(j*Math.PI/2)*.4,'ivory',[0,-j*Math.PI/2,0],rotor);
 for(const x of[-10.2,10.2]){barrel(x,-7.1);}
 layout.route=[[0,14],[0,5.8],[5.7,3.2],[7,-3.3],[6,-7.8],[0,-8],[-6,-7.8],[-7,-3.3],[-5.7,3.2],[0,3],[0,-4.4],[0,3],[0,5.8],[0,14]];
 layout.stations=[{id:'fullstack',type:'read',label:'Inside the stack',x:4.6,z:3.3,y:Y,contentSection:'summary'},{id:'pipeline',type:'action',label:'Run pipeline',x:5.7,z:-3.5,y:Y,action:'beaconfire'},{id:'rag',type:'read',label:'Retrieval to reply',x:-5.6,z:-3.5,y:Y,contentSection:'contributions'}];putBench(-5.3,2.0,0);
}
function visionx(){
 floorGrid(0,-2.5,6.4,6.0);
 for(const x of[-3,3])for(const z of[-5.3,-2.5,.3]){cubeSolid(.14,2.75,.14,x,Y+1.375,z,'teal',0,'greenhouse frame');}
 // Side panes are split from the roof for local occlusion. Front and back central doorways remain fully open.
 for(const x of[-3,3]){for(const z of[-3.9,-1.1]){bevel(.05,1.9,2.6,x,2.03,z,'glass',.01);solid(x,z,.06,2.6,2.2,Y,0,'greenhouse glazing');}}
 occluder('visionx_roof',()=>{pitchedRoof(6.3,6.1,3.63,0,-2.5,'glass',root,1.0);for(const z of[-5.45,-2.5,.45]){rod([-3.1,3.61,z],[0,4.66,z],.06,'teal');rod([0,4.66,z],[3.1,3.61,z],.06,'teal');}rod([0,4.66,-5.5],[0,4.66,.5],.07,'teal');});nameSign('GROW WITH CARE',0,3.35,.54,.2);
 for(const x of[-2.1,2.1]){table(x,-2.5,1.1,4.4);for(let j=0;j<4;j++){const g=dynamic('anim_plant_'+(j+(x<0?0:4)),[x,1.91,-4.0+j]);leafy(0,0,0,.52+j*.05,g);cyl(.24,.20,.35,x,1.69,-4+j,'terracotta',8);}}
 const sprinkler=dynamic('anim_sprinkler',[4.8,1.75,-4.1]);rod([4.8,Y,-4.1],[4.8,1.75,-4.1],.04,'metal');rod([-.5,0,0],[.5,0,0],.045,'metal',sprinkler);
 for(const[x,z]of[[-4.5,-10],[4.5,-10],[-9,0],[9,0]]){gardenBed(x,z,2,1.0);solid(x,z,2,1,.5,Y,0,'raised bed');}
 layout.route=[[0,14],[0,5.8],[5.7,3.3],[7,-3.5],[5.8,-8],[0,-8],[-5.8,-8],[-7,-3.5],[-5.7,3.3],[0,2],[0,5.8],[0,14]];
 layout.stations=[{id:'plants',type:'read',label:'Plant companions',x:4.5,z:3.4,y:Y,contentSection:'summary'},{id:'water',type:'action',label:'Water the garden',x:5.0,z:-2.6,y:Y,action:'visionx'},{id:'assistant',type:'read',label:'Virtual assistant',x:-5.5,z:-4.3,y:Y,contentSection:'results'}];putBench(-4.8,2.2,0);
}
function affirmation(){
 for(let j=0;j<3;j++){const x=-3+j*3,z=-1.8;for(const xx of[x-.94,x+.94])cubeSolid(.18,2.3,.2,xx,Y+1.15,z,['pink','lilac','teal'][j],0,'card frame');bevel(2.06,.25,.26,x,Y+2.4,z,['pink','lilac','teal'][j]);const card=dynamic('anim_card_'+j,[x,2.25,z]);bevel(1.45,1.35,.15,0,0,0,'ivory',.06,[0,0,0],card);text3D(['BREATHE','ONE STEP','YOU DID IT'][j],.11,0,.05,.10,'navy',.014,card);rod([-.36,-.22,.12],[-.09,-.45,.12],.055,'teal',card);rod([-.09,-.45,.12],[.41,.17,.12],.055,'teal',card);solid(x,z,1.45,.2,2.2,Y,0,'task card');}
 for(const[x,z]of[[-4,-5.5],[0,-5.9],[4,-5.5]]){cyl(1.2,1.25,.17,x,.935,z,'ivory',16);if(!low)flowers(x,z,.9);solid(x,z,2.4,2.4,.25,Y,0,'flower bed');}
 const wind=dynamic('anim_wind_chime',[-5.7,2.9,1.4]);rod([-5.7,Y,1.4],[-5.7,3.1,1.4],.06,'wood');rod([-.65,0,0],[.65,0,0],.04,'wood',wind);for(let j=0;j<4;j++){rod([-.5+j*.33,0,0],[-.5+j*.33,-.3,0],.012,'ivory',wind);rod([-.5+j*.33,-.3,0],[-.5+j*.33,-.8+(j%2)*.15,0],.033,'metal',wind);}solid(-5.7,1.4,.16,.16,2.4,Y,0,'wind chime pole');
 layout.stations=[{id:'affirmation',type:'read',label:'One small step',x:4.5,z:3.3,y:Y,contentSection:'summary'},{id:'cards',type:'action',label:'Turn a task card',x:0,z:.1,y:Y,action:'affirmation'},{id:'design',type:'read',label:'Made for focus',x:5.5,z:-4.0,y:Y,contentSection:'contributions'}];putBench(-5.4,2.7,0);
}
function research(){
 cyl(2,2.1,2.25,-.8,1.975,-1.4,'ivory',16);solid(-.8,-1.4,4.2,4.2,2.5,Y,0,'observatory');occluder('research_dome',()=>mesh(new THREE.SphereGeometry(2.06,16,8,0,Math.PI*2,0,Math.PI/2),'blue',[-.8,3.1,-1.4]));nameSign('OBSERVATORY',-.8,2.6,.76,.16);bevel(.54,1.5,.14,-.8,4.2,.10,'navy',.035,[-.35,0,0]);
 // Reachable viewing deck; a 3m-long 7.6-degree ramp is the sole step-free entrance.
 const px=1.0,pz=-7.6;box(9.6,.4,2.8,px,1.05,pz,'stone');layout.surfaces.push({x:px,z:pz,width:9.6,depth:2.8,y:1.25});
 const ramp={x:5.3,z:-4.95,width:2.2,depth:2.5,y:1.05,slope:-.16,rotation:0};
 custom([[4.2,.85,-3.7],[6.4,.85,-3.7],[4.2,1.25,-6.2],[6.4,1.25,-6.2]],[0,1,2,1,3,2],'stone');layout.surfaces.push(ramp);
 rail([[-3.7,-9],[1,-9],[5.7,-9]],1.25);solid(1,-9,9.5,.10,.75,1.25,0,'platform rail');
 for(const x of[-2.7,3.3]){rod([x,1.25,-7.7],[x,2.55,-7.7],.05,'navy');rod([x,2.56,-7.4],[x,2.9,-8.05],.15,'ivory');solid(x,-7.7,.5,.7,1.7,1.25,0,'telescope');}
 const dish=dynamic('anim_dish',[-5,2.45,.6],[-.4,.1,0]);rod([-5,Y,.6],[-5,2.45,.6],.07,'navy');cyl(.77,.32,.22,0,0,0,'ivory',12,[Math.PI/2,0,0],dish);rod([-.5,0,.12],[0,0,.65],.02,'navy',dish);rod([.5,0,.12],[0,0,.65],.02,'navy',dish);solid(-5,.6,1.65,.9,2.2,Y,0,'dish');
 for(let j=0;j<3;j++){let x=2.7+j*.75;cubeSolid(.6,.35+j*.2,.6,x,Y+.175+j*.1,1.5,'navy',0,'data plinth');const n=dynamic('anim_data_'+j,[x,Y+.7+j*.2,1.5]);bevel(.28,.28,.28,0,0,0,'yellow',.03,[0,0,0],n);}
 layout.route=[[0,14],[0,5.8],[5.5,3.5],[5.3,-3.7],[5.3,-7.2],[0,-7.2],[5.3,-7.2],[5.3,-3.7],[6,3.5],[0,4.2],[-6,3],[-6,1.8],[-6,3],[0,5.8],[0,14]];
 layout.stations=[{id:'research',type:'read',label:'Research questions',x:3.6,z:3.6,y:Y,contentSection:'summary'},{id:'analysis',type:'action',label:'Run the analysis',x:-4.8,z:2.4,y:Y,action:'research'},{id:'results',type:'read',label:'Methods and results',x:0,z:-7.3,y:1.25,contentSection:'results'}];putBench(-6,-3.8,0);
}
function catering(){
 floorGrid(0,-1.8,6.1,4.2);
 // Open serving pavilion with a service counter along the rear, no invisible shop interior.
 for(const x of[-2.8,2.8])for(const z of[-3.6,.05])cubeSolid(.14,2.75,.14,x,Y+1.375,z,'teal',0,'cafe post');
 occluder('catering_canopy',()=>{pitchedRoof(6.2,4.3,3.55,0,-1.8,'terracotta',root,.6);for(let j=0;j<10;j++)box(.61,.13,.83,-2.75+j*.61,3.44,.51,j%2?'ivory':'orange');});nameSign('GOOD TASTE',0,3.03,.15,.25);
 table(0,-3.0,4.65,.8);for(let j=0;j<5;j++){cyl(.11,.12,.32,-1.5+j*.28,1.91,-2.99,['teal','orange','yellow'][j%3],8);}
 table(4.1,-2.1,1.1,3.3);const meal=dynamic('anim_meal',[3.75,1.76,-2.1]);bevel(.46,.23,.4,0,.13,0,'ivory',.025,[0,0,0],meal);box(.44,.035,.38,0,.27,0,'orange',[0,0,0],meal);const order=dynamic('anim_order',[3.6,2.58,-2.8]);bevel(.9,.62,.06,0,0,0,'navy',.035,[0,0,0],order);text3D('ORDER 01',.11,0,0,.055,'ivory',.012,order);
 table(-5.3,-3.5,1.7,1.2);for(const z of[-2.3,-4.7]){bevel(.75,.13,.7,-5.3,Y+.49,z,'wood',.03);for(const x of[-5.6,-5])rod([x,Y,z],[x,Y+.5,z],.04,'navy');solid(-5.3,z,.8,.75,.6,Y,0,'dining chair');}for(const [x,z]of[[-5.55,-3.5],[-5.02,-3.5]])cyl(.2,.2,.028,x,1.74,z,'ivory',12);
 for(const x of[-2,0,2]){detailPlant(x,-6.1,.6);}
 layout.stations=[{id:'dashboard',type:'read',label:'Business catering',x:4.5,z:3.3,y:Y,contentSection:'summary'},{id:'order',type:'action',label:'Order up',x:4.9,z:-.2,y:Y,action:'catering'},{id:'services',type:'read',label:'From kitchen to desk',x:-5.2,z:1.2,y:Y,contentSection:'contributions'}];putBench(5.4,-5.3,0);
}
function learning(){
 for(const[x,z,label,col]of[[-3.4,-2.5,'BU','terracotta'],[3.4,-2.5,'CMU','teal']]){cubeSolid(3.2,2.8,3,x,Y+1.4,z,'ivory',0,label+' campus');occluder('learning_'+label+'_roof',()=>pitchedRoof(3.65,3.4,3.65,x,z,col,root,.8));bevel(.65,1.6,.1,x,Y+.8,z+1.55,col);for(const dx of[-1,1])windowFront(x+dx,2.2,z+1.55,.5,.9);nameSign(label,x,3.16,z+1.59,.3);}
 const book=dynamic('anim_book',[0,1.22,2.8]);bevel(2.1,.16,1.3,0,0,0,'navy',.04,[0,0,0],book);bevel(.93,.14,1.18,-.51,.11,0,'ivory',.03,[0,0,-.12],book);bevel(.93,.14,1.18,.51,.11,0,'ivory',.03,[0,0,.12],book);solid(0,2.8,2.1,1.3,.6,Y,0,'book sculpture');
 const beacon=dynamic('anim_beacon',[0,5.1,-4.5]);cyl(.55,.8,3.6,0,2.65,-4.5,'ivory',12);cyl(.5,.5,.7,0,0,0,'yellow',12,[0,0,0],beacon);cone(.8,.6,0,5.76,-4.5,'teal',12);solid(0,-4.5,1.6,1.6,5.2,Y,0,'navigation tower');
 table(-5.8,-5.8,1.6,.6);books(-6.35,1.71,-5.8);for(const x of[4.8,5.4,6]){torus(.28,.025,x,1.3,-5.9,'navy');rod([x,Y,-6.0],[x,1.6,-6],.025,'navy');}
 layout.stations=[{id:'bu',type:'read',label:'Boston University',x:-4.9,z:1.2,y:Y,contentSection:'summary'},{id:'cmu',type:'read',label:'Carnegie Mellon',x:4.9,z:1.2,y:Y,contentSection:'contributions'},{id:'books',type:'action',label:'Keep learning',x:1.8,z:3.5,y:Y,action:'learning-book'},{id:'lighthouse',type:'challenge',label:'Lighthouse Link',x:4.8,z:-5.0,y:Y,action:'lighthouse'}];putBench(-6.1,2.8,0);
}
function connect(){
 // Open-air post office on one side and a narrow antenna mast on the other.
 cubeSolid(3.6,2.15,2.6,-2.8,Y+1.075,-2.7,'ivory',0,'post office');occluder('connect_roof',()=>pitchedRoof(4,3,3.0,-2.8,-2.7,'teal',root,.68));bevel(2.4,.76,.13,-2.8,2.06,-1.34,'glass',.035);table(-2.8,-.7,2.7,.65);nameSign('POST & HELLO',-2.8,2.63,-1.3,.18);for(let j=0;j<3;j++)bevel(.3,.21,.23,-3.6+j*.38,1.81,-.7,'wood',.02);
 for(const x of[2.0,3.7])for(const z of[-3.6,-2]){rod([x,Y,z],[2.85,7.5,-2.8],.085,'navy');}solid(2.85,-2.8,2.1,2.05,7,Y,0,'signal tower');const ant=dynamic('anim_antenna',[2.85,7.5,-2.8]);rod([0,0,0],[0,1.2,0],.045,'navy',ant);for(const y of[.5,.9])rod([-.6,y,0],[.6,y,0],.035,'ivory',ant);
 for(let j=0;j<3;j++){const li=dynamic('anim_light_'+j,[2.85,5.2+j*.6,-1.99]);sphere(.11,0,0,0,'yellow',1,li);}
 // Low signal posts form a visible path from the dock to the communications mast.
 for(let j=0;j<5;j++){const x=1.7+j*.25,z=4.5-j*1.1;rod([x,Y,z],[x,1.18,z],.035,'navy');const li=dynamic('anim_signal_light_'+j,[x,1.25,z]);sphere(.11,0,0,0,'yellow',0,li);}
 table(-3.4,-6.0,2.2,.65);for(let j=0;j<4;j++){bevel(.35,.25,.025,-4.1+j*.42,1.81,-6,'ivory',.015,[.2,0,0]);rod([-4.18+j*.42,1.8,-5.97],[-4.03+j*.42,1.91,-5.97],.012,'teal');}
 layout.route=[[0,14],[0,5.6],[4.8,2.0],[6,-3.5],[4.5,-7],[0,-8],[-5.3,-6.4],[-6,-3.5],[-4.8,2],[0,5.6],[0,14]];
 layout.stations=[{id:'hello',type:'read',label:'Say hello',x:-3.2,z:2.5,y:Y,contentSection:'links'},{id:'repository',type:'read',label:'Explore the code',x:-4.1,z:-4.6,y:Y,contentSection:'links'},{id:'signal',type:'action',label:'Light up the bay',x:4.8,z:1.0,y:Y,action:'connect'}];putBench(4.6,-5.6,0);
}


// V6 detail sits on existing solids. It deliberately adds no navigation data.
// All animated embellishments remain children of the original named device.
function eveningDetails(name){
 const n=low?10:16,ring=(r,t,x,y,z,mat='metal',rot=[0,0,0],parent=root)=>torus(r,t,x,y,z,mat,rot,low?4:6,n,parent);
 const rounded=(r,x,y,z,mat,parent=root)=>mesh(new THREE.SphereGeometry(r,low?8:12,low?5:8),mat,[x,y,z],[0,0,0],parent);
 const strip=(w,h,d,x,y,z,mat='metal',parent=root)=>bevel(w,h,d,x,y,z,mat,.012,[0,0,0],parent);
 const bookDetails=(x,y,z,w=.17,h=.43)=>{strip(w*.72,.035,.018,x,y+h*.78,z+.184,'ivory');if(!low)strip(w*.72,.021,.018,x,y+.08,z+.184,'yellow');};
 if(name==='harbor'){
  const g=root.getObjectByName('occluder_harbor_lantern');
  if(g){for(const y of[8.01,9.03])ring(.73,.038,-1.7,y,-1.8,'metal',[Math.PI/2,0,0],g);cyl(.29,.31,.52,-1.7,8.5,-1.8,'sunsetLantern',n,[0,0,0],g);ring(.41,.042,-1.7,8.2,-1.8,'yellow',[Math.PI/2,0,0],g);}
  const b=root.getObjectByName('anim_bell');ring(.35,.037,0,-.55,0,'metal',[Math.PI/2,0,0],b);rounded(.073,0,-.68,0,'yellow',b);
  bevel(.62,.65,.018,3.75,2.17,-1.247,'warmWindow',.015);strip(.025,.65,.03,3.75,2.17,-1.228,'navy');
  for(const x of[-5.65,-4.55])for(const y of[1.02,3.12])cyl(.024,.024,.016,x,y,2.082,'metal',8,[Math.PI/2,0,0]);
 }
 if(name==='amtrak'){
  const roof=root.getObjectByName('occluder_amtrak_roof');for(const x of[-2.77,2.77])strip(.11,.16,3.16,x,3.30,-2.5,'metal',roof);
  strip(3.05,.10,.06,0,2.82,-1.00,'metal');strip(3.05,.07,.06,0,3.14,-1.00,'metal');
  ring(.4,.036,0,3.84,-.879,'metal');
  for(let i=0;i<(low?4:12);i++){const a=i*Math.PI*2/(low?4:12);cyl(.018,.018,.012,Math.sin(a)*.31,3.84+Math.cos(a)*.31,-.819,'navy',6,[Math.PI/2,0,0]);}
  if(!low)for(let j=0;j<40;j++){const a=j*Math.PI*2/40;for(const r of[-.43,.43])cyl(.022,.022,.017,(TRACK.radiusX+r)*Math.cos(a),Y+.094,TRACK.center[2]+(TRACK.radiusZ+r)*Math.sin(a),'metal',6);}
  const canopy=root.getObjectByName('occluder_amtrak_canopy');for(const x of[-1.8,0,1.8])bevel(.48,.055,.12,x,2.706,-.18,'sunsetLantern',.015,[0,0,0],canopy);
  for(let j=0;j<3;j++){strip(.055,.29,.025,-4.1+j*.33,Y+1.1,-.333,'metal');bevel(.16,.07,.13,-4.1+j*.33,Y+1.33,-.5,'darkWood',.025);}
 }
 if(name==='beaconfire'){
  for(const x of[-3.35,-.22,.22,3.35])ring(.115,.024,x,1.95,-6,'metal',[0,Math.PI/2,0]);
  for(let j=0;j<3;j++){const x=-3.6+j*3.6;strip(.30,.15,.018,x,Y+.48,-5.688,'warmWindow');if(!low)for(const dx of[-.25,.25])cyl(.020,.020,.013,x+dx,Y+.62,-5.687,'metal',6,[Math.PI/2,0,0]);}
  for(const x of[-2.2,2.2]){rod([x-.3,Y+.91,-2.1],[x+.2,Y+.91,-2.1],.021,'metal');ring(.075,.018,x+.23,Y+.91,-2.1,'metal',[Math.PI/2,0,0]);bevel(.30,.11,.22,x,Y+.93,-1.66,'terracotta',.04);strip(.19,.03,.23,x,Y+1.00,-1.66,'metal');}
  const roof=root.getObjectByName('occluder_beaconfire_roof');for(const x of[-2.4,2.4])bevel(.18,.055,1.15,x,4.03,-2.1,'sunsetLantern',.025,[0,0,0],roof);
 }
 if(name==='visionx'){
  for(const x of[-3.03,3.03]){for(const z of[-5.2,-3.9,-2.5,-1.1,.2])rod([x,1.08,z],[x,2.95,z],.021,'ivory');for(const y of[1.10,2.93])rod([x,y,-5.25],[x,y,.24],.025,'teal');}
  for(const x of[-2.1,2.1])for(let j=0;j<4;j++){const z=-4+j;rod([x+.15,1.9,z+.1],[x+.15,2.19,z+.1],.016,'wood');bevel(.20,.13,.02,x+.15,2.19,z+.1,'ivory',.02);if(!low)strip(.12,.018,.006,x+.15,2.19,z+.115,'leaf');}
  const roof=root.getObjectByName('occluder_visionx_roof');for(const x of[-1.55,1.55])rod([x,4.15,-5.4],[x,4.15,.4],.031,'ivory',roof);
  const sprinkler=root.getObjectByName('anim_sprinkler');for(const x of[-.43,.43]){ring(.065,.012,x,0,0,'metal',[0,Math.PI/2,0],sprinkler);cyl(.063,.063,.03,x,.015,0,'navy',8,[0,0,0],sprinkler);}
 }
 if(name==='affirmation'){
  const wind=root.getObjectByName('anim_wind_chime');for(let j=0;j<4;j++){const x=-.5+j*.33,y=-.8+(j%2)*.15;ring(.042,.010,x,y,0,'yellow',[Math.PI/2,0,0],wind);rounded(.045,x,y-.09,0,'wood',wind);}
  for(const[x,z]of[[-4,-5.5],[0,-5.9],[4,-5.5]])ring(1.16,.035,x,1.02,z,'wood',[Math.PI/2,0,0]);
  // Cushions stay below the seated avatar and outside the seat contact patch.
  for(const x of[-6.10,-4.7])bevel(.32,.45,.13,x,1.85,2.38,'pink',.065,[-.10,0,0]);
  for(let j=0;j<3;j++){const card=root.getObjectByName('anim_card_'+j);for(const x of[-.67,.67])cyl(.024,.024,.01,x,.55,.087,'yellow',8,[Math.PI/2,0,0],card);}
 }
 if(name==='research'){
  const dish=root.getObjectByName('anim_dish');ring(.75,.036,0,0,.12,'metal',[0,0,0],dish);rounded(.074,0,0,.66,'teal',dish);
  for(const x of[-2.7,3.3]){ring(.155,.024,x,2.88,-8.00,'metal',[.482,0,0]);ring(.13,.021,x,2.62,-7.51,'navy',[.482,0,0]);cyl(.055,.055,.05,x+.18,2.65,-7.65,'metal',n,[0,0,Math.PI/2]);}
  for(let j=0;j<3;j++){const x=2.7+j*.75;strip(.37,.15,.022,x,Y+.19+j*.16,1.812,'warmWindow');if(!low)for(let k=0;k<4;k++)strip(.025,.037+k*.017,.008,x-.13+k*.086,Y+.18+j*.16,1.829,'navy');}
  const dome=root.getObjectByName('occluder_research_dome');ring(2.06,.031,-.8,3.12,-1.4,'metal',[Math.PI/2,0,0],dome);
 }
 if(name==='catering'){
  const canopy=root.getObjectByName('occluder_catering_canopy');for(const x of[-2.75,-1.53,-.31,.91,2.13]){const y=4.15-.60*Math.abs(x)/3.10+.018;rod([x,y,-3.92],[x,y,.32],.017,'ivory',canopy);}
  for(const x of[-2,0,2])bevel(.13,.13,.13,x,3.38,.96,'sunsetLantern',.045,[0,0,0],canopy);
  const meal=root.getObjectByName('anim_meal');bevel(.47,.055,.41,0,.259,0,'ivory',.025,[0,0,0],meal);strip(.11,.012,.24,0,.303,0,'teal',meal);if(!low)for(const x of[-.205,.205])strip(.012,.12,.32,x,.13,0,'cream',meal);
  for(const[x,z]of[[-5.55,-3.5],[-5.02,-3.5]]){ring(.16,.013,x,1.758,z,'metal',[Math.PI/2,0,0]);rod([x+.27,1.76,z-.17],[x+.27,1.76,z+.17],.013,'metal');}
  for(let j=0;j<5;j++)cyl(.083,.085,.043,-1.5+j*.28,2.09,-2.99,'ivory',n);
 }
 if(name==='learning'){
  const book=root.getObjectByName('anim_book');strip(.07,.035,1.09,0,.24,0,'yellow',book);for(const x of[-.94,.94])strip(.024,.037,1.02,x,.195,0,'yellow',book);
  if(!low)for(const x of[-.51,.51])for(let k=0;k<5;k++)strip(.60,.009,.016,x,.27,-.38+k*.15,'cream',book);
  for(let j=0;j<4;j++)bookDetails(-6.35+j*.2,1.71,-5.8,.17,.43+.04*(j%2));
  for(const x of[-3.4,3.4]){strip(1.05,.065,.13,x,3.55,-.91,'stone');for(const dx of[-.40,.40])bevel(.06,.19,.045,x+dx,3.26,-.885,'metal',.014);}
  for(const y of[4.73,5.48])ring(.53,.039,0,y,-4.5,'metal',[Math.PI/2,0,0]);
 }
 if(name==='connect'){
  bevel(.92,.35,.13,-2.8,1.43,-1.315,'teal',.04);bevel(.64,.085,.026,-2.8,1.49,-1.235,'navy',.025);strip(.73,.035,.06,-2.8,1.55,-1.215,'metal');
  for(let j=0;j<3;j++){const x=-3.6+j*.38;strip(.028,.21,.236,x,1.81,-.7,'ivory');strip(.302,.027,.234,x,1.81,-.7,'ivory');}
  const ant=root.getObjectByName('anim_antenna');for(const y of[.12,.49,.88])ring(.075,.018,0,y,0,'metal',[Math.PI/2,0,0],ant);
  for(const x of[-3.7,-1.9])bevel(.27,.21,.035,x,2.1,-1.262,'warmWindow',.025);
  const roof=root.getObjectByName('occluder_connect_roof');strip(3.86,.08,.11,-2.8,3.00,-1.2,'metal',roof);
 }
}

function segmentClear(a,b,margin=.32){const n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.2);for(let i=0;i<=n;i++){const x=a[0]+(b[0]-a[0])*i/n,z=a[1]+(b[1]-a[1])*i/n;if(layout.obstacles.some(o=>{const c=Math.cos(o.rotation||0),s=Math.sin(o.rotation||0),dx=x-o.x,dz=z-o.z;return Math.abs(dx*c-dz*s)<o.width/2+margin&&Math.abs(dx*s+dz*c)<o.depth/2+margin;}))return false;}return true;}
function routeLength(p){return p.slice(1).reduce((s,q,i)=>s+Math.hypot(q[0]-p[i][0],q[1]-p[i][1]),0);}
function distanceToSegment(x,z,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],v=dx*dx+dz*dz,t=v?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/v)):0;return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);}
function routeFree(x,z,margin=1.03){
 const inPier=Math.abs(x)<1.5&&z>6.4&&z<15.8;
 if(!inside(layout.shore,x,z)&&!inPier)return false;
 if(inPier&&z>7.8){if(Math.abs(x)>.20||z>14.65)return false;}else{
  const edge=Math.min(...layout.shore.map((p,i)=>distanceToSegment(x,z,p,layout.shore[(i+1)%layout.shore.length])));
  if(edge<margin&&!(Math.abs(x)<.35&&z>6.0))return false;
 }
 for(const o of layout.obstacles){const c=Math.cos(o.rotation||0),s=Math.sin(o.rotation||0),dx=x-o.x,dz=z-o.z,xx=dx*c-dz*s,zz=dx*s+dz*c;const gap=o.name==='pier piling'?.72:margin;if(Math.abs(xx)<o.width/2+gap&&Math.abs(zz)<o.depth/2+gap)return false;}
 return true;
}
function safeScenicRoute(points){
 const grid=.25,min=-64,max=64,key=(x,z)=>x+','+z;const free=new Set();
 for(let x=min;x<=max;x++)for(let z=min;z<=max;z++)if(routeFree(x*grid,z*grid))free.add(key(x,z));
 const snap=p=>{let result=null,best=Infinity;for(const k of free){const[x,z]=k.split(',').map(Number),d=Math.hypot(x*grid-p[0],z*grid-p[1]);if(d<best){best=d;result=k;}}if(best>3.6)throw Error('Cannot clear scenic waypoint '+layout.id+JSON.stringify(p));return result;};
 const entry=snap(points[0]),reachable=new Set([entry]),flood=[entry];for(let i=0;i<flood.length;i++){const[x,z]=flood[i].split(',').map(Number);for(const[dx,dz]of[[1,0],[-1,0],[0,1],[0,-1]]){const k=key(x+dx,z+dz);if(free.has(k)&&!reachable.has(k)){reachable.add(k);flood.push(k);}}}for(const k of free)if(!reachable.has(k))free.delete(k);
 const waypoints=points.map(snap),out=[];
 for(let i=1;i<waypoints.length;i++){
  const start=waypoints[i-1],goal=waypoints[i],q=[start],parent=new Map([[start,null]]);let index=0;
  while(index<q.length&&!parent.has(goal)){const current=q[index++],[x,z]=current.split(',').map(Number);for(const[dx,dz]of[[1,0],[-1,0],[0,1],[0,-1]]){const k=key(x+dx,z+dz);if(!free.has(k)||parent.has(k))continue;parent.set(k,current);q.push(k);}}
  if(!parent.has(goal))throw Error('Scenic route disconnected '+layout.id+' '+i);
  const segment=[];let k=goal;while(k!==null){segment.push(k.split(',').map(n=>+n*grid));k=parent.get(k);}segment.reverse();
  // Keep only turns. Right-angle joints receive round caps with the same 2.2m clear width.
  const corners=segment.filter((p,j)=>j===0||j===segment.length-1||(p[0]-segment[j-1][0]!==segment[j+1][0]-p[0])||(p[1]-segment[j-1][1]!==segment[j+1][1]-p[1]));out.push(...(i===1?corners:corners.slice(1)));
 }
 return out;
}
function buildPaths(){
 layout.stations.forEach((s,i)=>plaque(s,i));
 layout.route=safeScenicRoute(layout.route);
 pathStrip(layout.route.filter(p=>p[1]<7.95),2.05);
 if(layout.id==='beaconfire'||layout.id==='visionx')pathStrip([[0,4],[0,-5.4]],2.05);
 layout.routeLength=+routeLength(layout.route).toFixed(2);layout.estimatedWalkingSeconds=+(layout.routeLength/2.4).toFixed(1);layout.width=2.05;
}
async function exportIsland(name){
 root.updateMatrixWorld(true);const kept=[];root.traverse(o=>{if(/^(district_|anim_|occluder_|station_)/.test(o.name))kept.push(o);});
 const batches=new Map([[root,new Map()]]);for(const n of kept)batches.set(n,new Map());let sourceMeshes=0;
 root.traverse(o=>{if(!o.isMesh)return;sourceMeshes++;let owner=o.parent;while(owner!==root&&!batches.has(owner))owner=owner.parent;
  const geom=o.geometry.clone();for(const a of Object.keys(geom.attributes))if(!['position','normal','color','uv'].includes(a))geom.deleteAttribute(a);geom.clearGroups();geom.applyMatrix4(new THREE.Matrix4().copy(owner.matrixWorld).invert().multiply(o.matrixWorld));
  if(!geom.index)geom.setIndex(Array.from({length:geom.attributes.position.count},(_,i)=>i));const bins=batches.get(owner),mat=o.material;if(!bins.has(mat))bins.set(mat,[]);bins.get(mat).push(geom);
 });
 const output=new THREE.Group();output.name=name;let triangles=0,vertices=0,drawCalls=0;const animationNodes=[];const exportedOwners=new Map([[root,output]]);
 for(const[owner,bins]of batches){let group=output;if(owner!==root){group=new THREE.Group();group.name=owner.name;let parent=owner.parent;while(parent!==root&&!batches.has(parent))parent=parent.parent;new THREE.Matrix4().copy(parent.matrixWorld).invert().multiply(owner.matrixWorld).decompose(group.position,group.quaternion,group.scale);group.userData={animated:owner.name.startsWith('anim_'),occluder:owner.name.startsWith('occluder_'),station:owner.name.startsWith('station_'),district:owner.name.startsWith('district_')};exportedOwners.get(parent).add(group);exportedOwners.set(owner,group);if(group.userData.animated)animationNodes.push({name:group.name,position:group.position.toArray(),rotation:group.rotation.toArray().slice(0,3),quaternion:group.quaternion.toArray(),scale:group.scale.toArray()});}
  for(const[mat,geometries]of bins){const geo=mergeVertices(mergeGeometries(geometries,false),1e-6);geo.normalizeNormals();const m=new THREE.Mesh(geo,mat);m.name=(owner===root?'static':owner.name)+'_'+mat.name;m.castShadow=true;m.receiveShadow=true;group.add(m);triangles+=geo.index.count/3;vertices+=geo.attributes.position.count;drawCalls++;}
 }
 output.userData={originalProceduralAsset:true,version:11,author:'Archipelago-folio original walkable island builder',walkable:true,seaLevel:0,animationNodes:animationNodes.map(n=>n.name)};
 const bounds=new THREE.Box3().setFromObject(output);const raw=await new GLTFExporter().parseAsync(output,{binary:true,onlyVisible:true,trs:true});if(name==='harbor'&&!low&&process.env.ARCHIPELAGO_SOURCE_OUT){await fs.mkdir(process.env.ARCHIPELAGO_SOURCE_OUT,{recursive:true});root.traverse(o=>{if(o.isMesh&&!o.name)o.name='part_'+o.material.name+'_'+o.id;});const source=await new GLTFExporter().parseAsync(root,{binary:true,onlyVisible:true,trs:true});await fs.writeFile(path.join(process.env.ARCHIPELAGO_SOURCE_OUT,'harbor.glb'),Buffer.from(source));}const doc=await io.readBinary(new Uint8Array(raw));await doc.transform(dedup(),prune({keepAttributes:true}),meshopt({encoder:MeshoptEncoder,level:'medium'}));const file=path.join(OUT,low?'low':'',name+'.glb');await io.write(file,doc);const bytes=(await fs.stat(file)).size;
 const data={id:name,name,file:name+'.glb',bytes,rawBytes:raw.byteLength,revision:'v11-four-isles',sourceMeshes,drawCalls,staticDrawCalls:batches.get(root).size,vertices,triangles,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},dimensions:bounds.getSize(new THREE.Vector3()).toArray(),animationNodes,nodes:animationNodes,shorePolygon:SHORELINES[name],shorelineXZ:SHORELINES[name],shorelineWinding:'CCW viewed in xz coordinate plane',walkwayY:Y,dock:{...layout.dock},clearApproach:{min:[-7,0,layout.dock.endZ+2],max:[7,0,layout.dock.endZ+18],spawn:[0,0,layout.dock.endZ+8]},districts:layout.districts,camera:{target:[0,2,0],distance:Math.max(PARENTS[name].width,PARENTS[name].depth)*1.18},quality:low?'low':'high',occluders:kept.filter(n=>n.name.startsWith('occluder_')).map(n=>n.name)};
 if(name==='amtrak'){data.animation={train:{trackCentre:[0,0,-1.4],trackRadii:[8.8,5.8],initialAngle:0,rootY:0,forward:'-Z',duration:10}};data.trainTrack={...TRACK,points:Array.from({length:64},(_,i)=>{const a=i*Math.PI*2/64;return[TRACK.radiusX*Math.cos(a),0,TRACK.center[2]+TRACK.radiusZ*Math.sin(a)];}),trainForward:'-Z',rootY:0,railY:Y+.07};}
 return data;
}
// Four physical destinations. District geometry stays in local frames so original
// animation controllers can work without baking the offset into their key poses.
const PARENTS={
 about:{label:'JACK KONG',width:56,depth:48,districts:[['harbor',-13,-3],['connect',13,-3]]},
 experience:{label:'EXPERIENCE',width:78,depth:60,districts:[['amtrak',-24,-4],['beaconfire',0,-4],['visionx',24,-4]]},
 projects:{label:'PROJECTS',width:78,depth:60,districts:[['affirmation',-24,-4],['research',0,-4],['catering',24,-4]]},
 education:{label:'EDUCATION',width:56,depth:44,districts:[['learning',0,-3]]},
};
const builders={harbor,amtrak,beaconfire,visionx,affirmation,research,catering,learning,connect};
const transformItem=(item,dx,dz)=>({...item,x:item.x+dx,z:item.z+dz});
function combinedCoast(w,d){const x=w/2,z=d/2;return[
 [-4,z],[-x*.48,z*.97],[-x*.79,z*.81],[-x*.95,z*.51],[-x,z*.05],[-x*.94,-z*.47],[-x*.71,-z*.84],[-x*.29,-z],
 [x*.19,-z*.98],[x*.60,-z*.88],[x*.89,-z*.64],[x,-z*.13],[x*.97,z*.42],[x*.77,z*.81],[x*.4,z*.96],[4,z]
 ];}
function parentPier(front){
 const startZ=front*.96-1.3,endZ=front+8,width=4;
 layout.dock={width,deckY:Y,startZ,endZ};
 for(let z=startZ+.2;z<endZ;z+=.42){bevel(width,.20,.40,0,.75,z,'wood',.025);if(!low)for(const x of[-1.43,1.43])cyl(.033,.033,.009,x,.856,z,'metal',8);}
 for(const x of[-1.72,1.72]){
  bevel(.18,.22,endZ-startZ,x,.55,(startZ+endZ)/2,'darkWood',.025);
  for(let z=startZ+.8;z<=endZ-.25;z+=2.35){cyl(.16,.21,1.7,x,.17,z,'wood',low?8:12);bevel(.36,.1,.36,x,1.06,z,'wood',.025);torus(.18,.026,x,1,z,'rope',[Math.PI/2,0,0],5,low?10:16);solid(x,z,.39,.39,.35,Y,0,'pier piling');}
  for(const z of[endZ-2.1,endZ-4.8]){const f=mesh(new THREE.CapsuleGeometry(.19,.54,3,10),'navy',[x*1.17,.42,z]);rod([x,1.05,z],[x*1.17,.79,z],.025,'rope');}
 }
 layout.surfaces.push({x:0,z:(startZ+endZ)/2,width,depth:endZ-startZ,y:Y});
 layout.berths=[-1,1].map(side=>({boat:{x:side*4.3,z:endZ-2.45,yaw:Math.PI},landing:{x:side*.5,z:endZ-2.5,y:Y,yaw:Math.PI}}));
}
function parentTerrain(name,index){
 const spec=PARENTS[name];currentIsland=name;root=new THREE.Group();root.name=name;seed=89731+index*891;
 const shore=combinedCoast(spec.width,spec.depth);SHORELINES[name]=shore;
 ringShape(shore,[[.97,-.65],[1,.04],[.99,.30]],'sandEdge');ringShape(shore,[[.99,.28],[.973,.61],[.96,Y]],'sand');
 shapePrism(shore.map(([x,z])=>[x*.96,z*.96]),Y-.08,Y,'grass');
 layout={id:name,groundY:Y,shore:shore.map(([x,z])=>[+(x*.96).toFixed(5),+(z*.96).toFixed(5)]),surfaces:[],obstacles:[],route:[],stations:[],benches:[],bench:null,berths:[],districts:[],crossings:[]};
 parentPier(spec.depth/2);
 const headingZ=spec.depth*.5-5.5;
 // Entry identity is readable from the sea; the broad path passes to both sides.
 for(const x of[-5.8,5.8]){lamp(x,headingZ,'teal',2.4);solid(x,headingZ,.4,.4,3.4,Y,0,'arrival lamp');}
 nameSign(spec.label,0,1.75,headingZ-.8,.49);
 for(const x of[-spec.width*.38,spec.width*.38]){
  if(name==='education')occluder(name+'_avenue_'+x,()=>conifer(x,-spec.depth*.15,4.5));
  else occluder(name+'_avenue_'+x,()=>palm(x,-spec.depth*.31,4.8,.4));
  solid(x+.1,name==='education'?-spec.depth*.15:-spec.depth*.31,.5,.5,4,Y,0,'landmark tree');
 }
}
function assembleDistrict(parent,contentId,dx,dz){
 const parentRoot=root,parentLayout=layout;const district=group([dx,0,dz]);district.name='district_'+contentId;
 root=district;currentIsland=contentId;seed=12731+Object.keys(builders).indexOf(contentId)*891;
 layout={id:contentId,groundY:Y,surfaces:[],obstacles:[],route:[[0,5.8],[6,3.4],[7,-4.8],[4.5,-7.4],[-4.5,-7.4],[-7,-4.8],[-6,3.4],[0,5.8]],stations:[],bench:null};
 builders[contentId]();eveningDetails(contentId);
 if(contentId==='connect'){const repo=layout.stations.find(s=>s.id==='repository');repo.x=-6.4;repo.z=-4.5;}
 if(contentId==='learning'){const light=layout.stations.find(s=>s.id==='lighthouse');light.x=7.5;light.z=-4.5;}
 if(contentId==='catering'){const order=layout.stations.find(s=>s.id==='order');order.x=5.8;order.z=.1;}
 // These signs identify districts without recreating each former island's dock.
 nameSign(THEMES[contentId][0],0,1.45,7.8,.31);
 layout.stations.forEach((station,index)=>{station.id=contentId+':'+station.id;station.contentId=contentId;station.action=station.action||contentId;plaque(station,index);});
 const districtLayout=layout;root=parentRoot;layout=parentLayout;currentIsland=parent;
 layout.surfaces.push(...districtLayout.surfaces.map(s=>transformItem(s,dx,dz)));
 layout.obstacles.push(...districtLayout.obstacles.map(s=>({...transformItem(s,dx,dz),name:contentId+': '+s.name})));
 layout.stations.push(...districtLayout.stations.map(s=>transformItem(s,dx,dz)));
 const b=districtLayout.bench;if(b){const bench={...transformItem(b,dx,dz),id:contentId+':bench',contentId,action:contentId,approach:transformItem(b.approach,dx,dz)};layout.benches.push(bench);layout.bench??=bench;}
 const districtData={id:contentId,x:dx,z:dz,rotation:0,group:'district_'+contentId};
 if(districtLayout.crossing){const c={...transformItem(districtLayout.crossing,dx,dz),contentId,trackCenter:[districtLayout.crossing.trackCenter[0]+dx,districtLayout.crossing.trackCenter[1]+dz]};layout.crossings.push(c);layout.crossing=c;districtData.crossing=c;
  districtData.animation={train:{trackCentre:[0,0,-1.4],trackRadii:[8.8,5.8],initialAngle:0,rootY:0,forward:'-Z',duration:10}};}
 layout.districts.push(districtData);
 // Trim obsolete pier legs from the old scenic loop. Stations and scenic points
 // become visits on the one connected parent path rather than separate islands.
 return {entry:[dx,dz+10],visits:districtLayout.route.filter(p=>p[1]<6).map(([x,z])=>[x+dx,z+dz]),stations:districtLayout.stations.map(s=>[s.x+dx,s.z+dz]),bench:b?[b.approach.x+dx,b.approach.z+dz]:null};
}
function parentRouteFree(x,z,margin=1.05){
 const dock=layout.dock,inPier=Math.abs(x)<dock.width/2-margin&&z>=dock.startZ&&z<=dock.endZ-.75;
 if(!inside(layout.shore,x,z)&&!inPier)return false;
 if(!inPier){const edge=Math.min(...layout.shore.map((p,i)=>distanceToSegment(x,z,p,layout.shore[(i+1)%layout.shore.length])));if(edge<margin&&!(Math.abs(x)<dock.width/2-margin&&z>dock.startZ-1))return false;}
 return !layout.obstacles.some(o=>{const c=Math.cos(o.rotation||0),s=Math.sin(o.rotation||0),dx=x-o.x,dz=z-o.z;return Math.abs(dx*c-dz*s)<o.width/2+margin&&Math.abs(dx*s+dz*c)<o.depth/2+margin;});
}
function parentSurfaceY(x,z){
 let y=layout.groundY;
 for(const f of layout.surfaces){const c=Math.cos(f.rotation||0),s=Math.sin(f.rotation||0),dx=x-f.x,dz=z-f.z,lx=dx*c-dz*s,lz=dx*s+dz*c;if(Math.abs(lx)<=f.width/2&&Math.abs(lz)<=f.depth/2)y=Math.max(y,f.y+(f.slope||0)*lz);}
 return y;
}
function parentStepFree(a,b){
 const[ax,az]=a.split(',').map(v=>Number(v)*.5),[bx,bz]=b.split(',').map(v=>Number(v)*.5);
 return Math.abs(parentSurfaceY(ax,az)-parentSurfaceY(bx,bz))<=.13;
}
function parentPaths(districts){
 const grid=.5,key=(x,z)=>x+','+z,front=layout.dock.endZ-2.5;
 const {width,depth}=PARENTS[layout.id],free=new Set();
 for(let x=-width;x<=width;x++)for(let z=-depth;z<=Math.ceil(layout.dock.endZ/grid);z++)if(parentRouteFree(x*grid,z*grid))free.add(key(x,z));
 const snap=p=>{let best=Infinity,result;for(const k of free){const[x,z]=k.split(',').map(Number),d=Math.hypot(x*grid-p[0],z*grid-p[1]);if(d<best){best=d;result=k;}}if(!result||best>3.6)throw Error('No parent path near '+layout.id+' '+p);return result;};
 const start=snap([0,front]),reachable=new Set([start]),flood=[start];
 for(let i=0;i<flood.length;i++){const[x,z]=flood[i].split(',').map(Number);for(const[dx,dz]of[[1,0],[-1,0],[0,1],[0,-1]]){const k=key(x+dx,z+dz);if(free.has(k)&&!reachable.has(k)&&parentStepFree(flood[i],k)){reachable.add(k);flood.push(k);}}}for(const k of free)if(!reachable.has(k))free.delete(k);
 const pathBetween=(a,b)=>{const start=snap(a),goal=snap(b),q=[start],parents=new Map([[start,null]]);for(let i=0;i<q.length&&!parents.has(goal);i++){const[x,z]=q[i].split(',').map(Number);for(const[dx,dz]of[[1,0],[-1,0],[0,1],[0,-1]]){const k=key(x+dx,z+dz);if(free.has(k)&&!parents.has(k)&&parentStepFree(q[i],k)){parents.set(k,q[i]);q.push(k);}}}if(!parents.has(goal))throw Error('Disconnected path '+layout.id);const route=[];for(let k=goal;k!==null;k=parents.get(k))route.push(k.split(',').map(v=>Number(v)*grid));route.reverse();return route.filter((p,i)=>i===0||i===route.length-1||p[0]-route[i-1][0]!==route[i+1][0]-p[0]||p[1]-route[i-1][1]!==route[i+1][1]-p[1]);};
 const waypoints=[[0,front],[0,depth/2-8]];
 for(const d of districts){waypoints.push(d.entry,...d.stations);if(d.bench)waypoints.push(d.bench);waypoints.push(d.entry);}
 if(layout.id==='education')waypoints.push([14,3],[17,-9],[0,-15],[-17,-9],[-14,3]);
 waypoints.push([0,depth/2-8],[0,front]);
 layout.route=[];for(let i=1;i<waypoints.length;i++){const p=pathBetween(waypoints[i-1],waypoints[i]);layout.route.push(...(i===1?p:p.slice(1)));}
 // Union meshing avoids dark overlapping strips across the shared promenade.
 const onLand=layout.route.filter(p=>p[1]<=layout.dock.startZ+.35);harborPath(onLand,2.05,Y+.012);
 for(const d of districts){for(const v of d.visits){if(!parentRouteFree(...v,.4))continue;const p=pathBetween(d.entry,v);harborPath(p.filter(v=>v[1]<layout.dock.startZ),2.05,Y+.013);}}
 layout.routeLength=+routeLength(layout.route).toFixed(2);layout.estimatedWalkingSeconds=+(layout.routeLength/2.4).toFixed(1);layout.width=2.05;
 // Validate every station has a reachable path point within the 1.8m interaction
 // radius, and no sampled path point overlaps a principal obstacle.
 for(const s of layout.stations){const nearest=snap([s.x,s.z]).split(',').map(v=>Number(v)*grid);if(Math.hypot(nearest[0]-s.x,nearest[1]-s.z)>1.55)throw Error('Station out of reach '+s.id);if(!parentRouteFree(s.x,s.z,.26))throw Error('Station actor clearance '+s.id);}
 for(let i=1;i<layout.route.length;i++){const a=layout.route[i-1],b=layout.route[i],steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.2));for(let j=0;j<=steps;j++)if(!parentRouteFree(a[0]+(b[0]-a[0])*j/steps,a[1]+(b[1]-a[1])*j/steps,.8))throw Error('Blocked route '+layout.id);}
 layout.validation={connectedFromDock:true,stationsReachable:layout.stations.length,routeClearance:.8,pathWidth:2.05};
}
function arrivalGarden(name){
 const {width,depth}=PARENTS[name],shore=SHORELINES[name];
 // Grouped coastal details preserve clear walking interiors and a readable edge.
 for(let i=0;i<shore.length;i++){const[x,z]=shore[i];if(Math.abs(x)<7&&z>0)continue;const px=x*.85,pz=z*.85;
  if(layout.route.slice(1).some((p,j)=>distanceToSegment(px,pz,layout.route[j],p)<2.4))continue;
  if(i%2===0){occluder(name+'_coast_'+i,()=>name==='education'?conifer(px,pz,4):palm(px,pz,4.2,.3));solid(px+.1,pz,.5,.5,4,Y,0,'coast tree');}
  else{shrub(px,pz,1.4);flowers(px+.5,pz+.3,.7);}
  if(!low){rocks(x*.965,z*.965,.85);coastalPlant(x*.88,z*.88,.8);}
 }
 // Benches and foliage bring scale to the new common spaces without scattering
 // decorative collision objects into the access paths.
 for(const z of[depth*.23,depth*.34])for(const x of[-width*.3,width*.3]){
  if(layout.route.slice(1).some((p,j)=>distanceToSegment(x,z,layout.route[j],p)<2.2))continue;
  flowers(x,z,1.1);lamp(x+1.4,z,'teal',2);solid(x+1.4,z,.3,.3,3,Y,0,'promenade lamp');
 }
}
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
await fs.mkdir(path.join(OUT,'low'),{recursive:true});
const prior=JSON.parse(await fs.readFile(path.join(OUT,'manifest.json'),'utf8').catch(()=>'{"models":[]}'));
const priorLow=JSON.parse(await fs.readFile(path.join(OUT,'low/manifest.json'),'utf8').catch(()=>JSON.stringify(prior)));
const layouts=[],reports=[];
for(const quality of['high','low']){
 low=quality==='low';const models=[];
 for(const[i,[name,spec]]of Object.entries(PARENTS).entries()){
  parentTerrain(name,i);const districts=spec.districts.map(([contentId,x,z])=>assembleDistrict(name,contentId,x,z));
  parentPaths(districts);arrivalGarden(name);
  const asset=await exportIsland(name);models.push(asset);
  if(!low)layouts.push(structuredClone(layout));else if(JSON.stringify(layout)!==JSON.stringify(layouts.find(l=>l.id===name)))throw Error('High/low walk data differs: '+name);
  reports.push({id:name,quality,bytes:asset.bytes,triangles:asset.triangles,drawCalls:asset.drawCalls,routeSeconds:layout.estimatedWalkingSeconds,...layout.validation});
 }
 const boat=(low?priorLow:prior).models.find(m=>m.id==='boat');if(boat)models.push(boat);
 const manifest={...prior,generator:'build-walk-islands.mjs',version:11,quality,walkLayout:'walk-layout.json',dock:{direction:'+Z',dimensions:'per-model metadata'},models,totalBytes:models.reduce((s,m)=>s+m.bytes,0),totalTriangles:models.reduce((s,m)=>s+m.triangles,0)};
 await fs.writeFile(path.join(OUT,low?'low':'','manifest.json'),JSON.stringify(manifest,null,2)+'\n');
}
await fs.writeFile(path.join(OUT,'walk-layout.json'),JSON.stringify({version:11,units:'meters',coordinates:'island-local; Y up; rotation around Y in radians',surfaceHeight:'y is top/center height; ramp y at center, y += slope * localZ',obstacleHeight:'y is bottom; height extends upward',islands:layouts},null,2)+'\n');
await fs.writeFile(path.join(OUT,'walk-assets-report.json'),JSON.stringify({version:11,assets:reports,totalBytes:reports.reduce((s,r)=>s+r.bytes,0)},null,2)+'\n');
const highReport=JSON.parse(await fs.readFile(path.join(OUT,'manifest.json'),'utf8')),lowReport=JSON.parse(await fs.readFile(path.join(OUT,'low/manifest.json'),'utf8'));
const comparison={version:11,models:highReport.models.map(hi=>{const lo=lowReport.models.find(m=>m.id===hi.id);return{id:hi.id,highTriangles:hi.triangles,lowTriangles:lo.triangles,highCompressedBytes:hi.bytes,lowCompressedBytes:lo.bytes,drawCalls:hi.drawCalls,animatedGeometry:'same named district and animation nodes',dock:'same walkable footprint and collision metadata'};}),highTotalBytes:highReport.totalBytes,lowTotalBytes:lowReport.totalBytes};
await fs.writeFile(path.join(OUT,'low/comparison.json'),JSON.stringify(comparison,null,2)+'\n');
await fs.writeFile(path.join(OUT,'compression.json'),JSON.stringify(highReport.models.map(m=>({name:m.file,before:m.rawBytes??m.bytes,after:m.bytes})),null,2)+'\n');
console.log(JSON.stringify(reports,null,2));
