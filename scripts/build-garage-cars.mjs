// Reproducible asset build: owner source GLBs -> rigged meter-scale high/low cars.
// npm run models:garage-cars -- --911 /path/to/911-grey.glb --g63 /path/to/g63.glb --install true
// High keeps the original 2k JPEG textures; low resizes copies to 1k through sips.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
const args=new Map();for(let i=2;i<process.argv.length;i+=2)args.set(process.argv[i],process.argv[i+1]);
const project=args.get('--project')||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=args.get('--output')||path.join(project,'.asset-build/garage-cars');
const require=createRequire(path.join(project,'package.json'));
const {NodeIO}=require('@gltf-transform/core');
const {ALL_EXTENSIONS}=require('@gltf-transform/extensions');
const {weld,simplify,prune,meshopt}=require('@gltf-transform/functions');
const {MeshoptEncoder,MeshoptDecoder,MeshoptSimplifier}=require('meshoptimizer');
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready,MeshoptSimplifier.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
await fs.mkdir(path.join(output,'low'),{recursive:true});await fs.mkdir(path.join(output,'source-rigged'),{recursive:true});
const list=[{id:'porsche-911',source:args.get('--911'),kind:'911'}, {id:'mercedes-g63',source:args.get('--g63'),kind:'g63'}];
if(list.some(item=>!item.source))throw Error('Provide --911 and --g63 source GLB paths.');
const manifest={version:1,coordinateSystem:'Meters; Y up, ground Y=0; forward -Z; driver -X.',sourceGeometry:'Every original triangle is assigned exactly once to a rig part before simplification; original opaque source materials and UVs retained; coincident source seam normals averaged before LOD reduction.',models:[]};
function bounds(positions,indices){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const i of indices)for(let a=0;a<3;a++){const v=positions[i*3+a];min[a]=Math.min(min[a],v);max[a]=Math.max(max[a],v);}return {min,max,size:max.map((v,i)=>v-min[i]),center:max.map((v,i)=>(v+min[i])/2)};}
function exactComponents(p,idx){const n=p.length/3,parent=Int32Array.from({length:n},(_,i)=>i),rank=new Uint8Array(n),find=x=>{while(parent[x]!==x){parent[x]=parent[parent[x]];x=parent[x];}return x;},union=(a,b)=>{a=find(a);b=find(b);if(a===b)return;if(rank[a]<rank[b])[a,b]=[b,a];parent[b]=a;if(rank[a]===rank[b])rank[a]++;};for(let i=0;i<idx.length;i+=3){union(idx[i],idx[i+1]);union(idx[i],idx[i+2]);}const seen=new Map();for(let i=0;i<n;i++){const key=p[i*3]+','+p[i*3+1]+','+p[i*3+2],other=seen.get(key);if(other===undefined)seen.set(key,i);else union(i,other);}for(let i=0;i<n;i++)parent[i]=find(i);const groups=new Map();for(let i=0;i<idx.length;i+=3){const root=parent[idx[i]];let group=groups.get(root);if(!group)groups.set(root,group=[]);group.push(idx[i],idx[i+1],idx[i+2]);}return [...groups.values()].sort((a,b)=>b.length-a.length);}
function smoothSourceSeamNormals(doc){for(const mesh of doc.getRoot().listMeshes())for(const prim of mesh.listPrimitives()){const p=prim.getAttribute('POSITION').getArray(),n=prim.getAttribute('NORMAL').getArray(),sum=new Map();for(let i=0;i<p.length;i+=3){const key=p[i]+','+p[i+1]+','+p[i+2],v=sum.get(key)||[0,0,0];v[0]+=n[i];v[1]+=n[i+1];v[2]+=n[i+2];sum.set(key,v);}for(let i=0;i<p.length;i+=3){const v=sum.get(p[i]+','+p[i+1]+','+p[i+2]),len=Math.hypot(...v)||1;n[i]=v[0]/len;n[i+1]=v[1]/len;n[i+2]=v[2]/len;}}}
function count(doc){return doc.getRoot().listMeshes().flatMap(m=>m.listPrimitives()).reduce((n,p)=>n+p.getIndices().getCount()/3,0);}
for(const source of list){
 console.log('Rigging',source.id);const doc=await io.read(source.source),root=doc.getRoot(),scene=root.listScenes()[0],originalNode=root.listNodes()[0],originalMesh=originalNode.getMesh(),original=originalMesh.listPrimitives()[0],material=original.getMaterial(),buffer=root.listBuffers()[0],p=original.getAttribute('POSITION').getArray(),normal=original.getAttribute('NORMAL').getArray(),uv=original.getAttribute('TEXCOORD_0').getArray(),indices=original.getIndices().getArray(),rawBounds=bounds(p,indices),scale=4.7/rawBounds.size[2],center=[rawBounds.center[0],rawBounds.min[1],rawBounds.center[2]],map=v=>[-(v[0]-center[0])*scale,(v[1]-center[1])*scale,-(v[2]-center[2])*scale];
 const parts=new Map([['car-body',[]]]),wheelCenters={},wheelSourceBounds={};
 if(source.kind==='g63'){
  const components=exactComponents(p,indices);if(components.length!==5)throw new Error('G63 expected body + four exact welded components.');parts.set('car-body',components[0]);for(const component of components.slice(1)){const b=bounds(p,component),name=`car-wheel-${b.center[2]>0?'front':'rear'}-${b.center[0]>0?'left':'right'}`;parts.set(name,component);wheelCenters[name]=b.center;wheelSourceBounds[name]=b;}
 }else{
  const specs=[{z:.2599,y:.0738,halfWidth:.0325,r:.0758},{z:-.2581,y:.0739,halfWidth:.034,r:.0764}];
  for(const end of ['front','rear'])for(const side of ['left','right']){const s=specs[end==='front'?0:1],name=`car-wheel-${end}-${side}`;parts.set(name,[]);wheelCenters[name]=[(side==='left'?1:-1)*(end==='front'?.1675:.1683),s.y,s.z];}
  for(let i=0;i<indices.length;i+=3){const ids=[indices[i],indices[i+1],indices[i+2]],c=[0,0,0];for(const id of ids)for(let a=0;a<3;a++)c[a]+=p[id*3+a]/3;let name='car-body';for(let s=0;s<specs.length;s++){const spec=specs[s];if(Math.abs(c[0])>.130&&Math.hypot(c[1]-spec.y,c[2]-spec.z)<spec.r){name=`car-wheel-${s===0?'front':'rear'}-${c[0]>0?'left':'right'}`;break;}}parts.get(name).push(...ids);}
  for(const [name,ids] of parts)if(name.startsWith('car-wheel'))wheelSourceBounds[name]=bounds(p,ids);
 }
 if(source.kind==='g63'){
  const body=parts.get('car-body'),kept=[],roof=[];for(let i=0;i<body.length;i+=3){const ids=[body[i],body[i+1],body[i+2]],roofOnly=ids.every(id=>p[id*3+1]>.359&&Math.abs(p[id*3])<.184&&p[id*3+2]>-.35&&p[id*3+2]<.125);(roofOnly?roof:kept).push(...ids);}parts.set('car-body',kept);parts.set('car-roof-cutaway',roof);
 }
 const totalOriginal=[...parts.values()].reduce((n,x)=>n+x.length/3,0);if(totalOriginal!==indices.length/3)throw new Error('Partition changed source triangle count.');
 const car=doc.createNode('car-'+source.id);scene.removeChild(originalNode);scene.addChild(car);
 const sourceSeat=source.kind==='911'?[.085,.0816,.015]:[.085,.167,.04],seat=map(sourceSeat),pelvis=[seat[0],seat[1]+.085,seat[2]],steering=map(source.kind==='911'?[.085,.147,.061]:[.085,.248,.093]),gripHalf=source.kind==='911'?.150:.177;
 const grips={Left:[steering[0]-gripHalf,steering[1],steering[2]],Right:[steering[0]+gripHalf,steering[1],steering[2]]},feet={Left:[pelvis[0]-.11,source.kind==='911'?.285:.675,pelvis[2]-(source.kind==='911'?.15:.14)],Right:[pelvis[0]+.11,source.kind==='911'?.285:.675,pelvis[2]-(source.kind==='911'?.15:.14)]};
 const contactTargets={pelvis,grips,feet,torsoLean:.08,handPitch:1.1};
 const rig={id:source.id,forward:[0,0,-1],up:[0,1,0],dimensions:rawBounds.size.map(v=>v*scale),wheelRadius:source.kind==='911'?.07385*scale:.08025*scale,wheelRollAxis:[1,0,0],wheelRollSign:-1,steerAxis:[0,1,0],steerNodes:['car-steer-front-left','car-steer-front-right'],wheelNodes:[...parts.keys()].filter(n=>n.startsWith('car-wheel-')),wheelCenters:Object.fromEntries(Object.entries(wheelCenters).map(([name,v])=>[name,map(v)])),wheelContactPoints:Object.fromEntries(Object.entries(wheelCenters).map(([name,v])=>{const c=map(v);return[name,[c[0],0,c[2]]];})),seatSurface:seat,steeringCenter:steering,...contactTargets,contactTargets,anchorConfidence:'Seat surface measured by source triangle rays; pelvis/grips/feet are anatomical starting points requiring final avatar pose visual verification.',sourceLength:rawBounds.size[2],sourceScale:scale,roofCutawayNode:source.kind==='g63'?'car-roof-cutaway':null,roofCutawayDescription:source.kind==='g63'?'Only central roof/ceiling panel above 1.72m; pillars, windscreen header and outer roof rim remain. Hide only while occupied for view cutaway.':null,sourceWheelSeparation:source.kind==='g63'?'Four exact disconnected geometric components.':'Conservative cylindrical partition of fused source wheels. Every source triangle retained; inspect wheel turns for fender seam.',sourceTriangleCount:indices.length/3,partitionTriangleCounts:Object.fromEntries([...parts].map(([n,ids])=>[n,ids.length/3]))};
 car.setExtras({carRig:rig});
 for(const [name,ids] of parts){const remap=new Map(),vertices=[];for(const id of ids)if(!remap.has(id)){remap.set(id,vertices.length);vertices.push(id);}const outP=new Float32Array(vertices.length*3),outN=new Float32Array(vertices.length*3),outUV=new Float32Array(vertices.length*2),pivot=name.startsWith('car-wheel')?map(wheelCenters[name]):[0,0,0];for(let j=0;j<vertices.length;j++){const id=vertices[j],point=map([p[id*3],p[id*3+1],p[id*3+2]]);for(let a=0;a<3;a++){outP[j*3+a]=point[a]-pivot[a];outN[j*3+a]=normal[id*3+a]*(a===1?1:-1);}outUV[j*2]=uv[id*2];outUV[j*2+1]=uv[id*2+1];}const idx=Uint32Array.from(ids,id=>remap.get(id)),prim=doc.createPrimitive().setMaterial(material).setAttribute('POSITION',doc.createAccessor(name+'-position',buffer).setType('VEC3').setArray(outP)).setAttribute('NORMAL',doc.createAccessor(name+'-normal',buffer).setType('VEC3').setArray(outN)).setAttribute('TEXCOORD_0',doc.createAccessor(name+'-uv',buffer).setType('VEC2').setArray(outUV)).setIndices(doc.createAccessor(name+'-indices',buffer).setType('SCALAR').setArray(idx)),mesh=doc.createMesh(name).addPrimitive(prim),node=doc.createNode(name);if(name.startsWith('car-wheel'))node.addChild(doc.createNode(name+'-surface').setMesh(mesh));else node.setMesh(mesh);if(name.includes('wheel-front')){const steer=doc.createNode(name.replace('wheel','steer')).setTranslation(pivot);car.addChild(steer);steer.addChild(node);}else{node.setTranslation(pivot);car.addChild(node);}node.setExtras({carPart:name,sourceTriangles:ids.length/3});}
 for(const [name,position] of Object.entries({'car-anchor-seat':seat,'car-anchor-pelvis':pelvis,'car-anchor-steering':steering,'car-anchor-grip-left':grips.Left,'car-anchor-grip-right':grips.Right,'car-anchor-foot-left':feet.Left,'car-anchor-foot-right':feet.Right})){car.addChild(doc.createNode(name).setTranslation(position).setExtras({carAnchor:true}));}
 originalNode.dispose();originalMesh.dispose();await doc.transform(prune({keepLeaves:true}));
 const rigged=path.join(output,'source-rigged',source.id+'.glb');await io.write(rigged,doc);console.log(source.id,'partition',rig.partitionTriangleCounts);
 const entry={id:source.id,source:path.basename(source.source),sourceBytes:(await fs.stat(source.source)).size,sourceSHA256:createHash('sha256').update(await fs.readFile(source.source)).digest('hex'),rig,variants:{}};
 for(const quality of ['high','low']){const d=await io.read(rigged),max=quality==='high'?120000:45000,target=quality==='high'?112000:42000;
  smoothSourceSeamNormals(d);await d.transform(weld(),simplify({simplifier:MeshoptSimplifier,ratio:target/totalOriginal,error:quality==='high'?.008:.02}),prune({keepLeaves:true}));
  let tris=count(d);if(tris>max){await d.transform(simplify({simplifier:MeshoptSimplifier,ratio:target/tris,error:quality==='high'?.018:.04}),prune({keepLeaves:true}));tris=count(d);}
  if(tris>max)throw new Error(source.id+'/'+quality+' could only reach '+tris+' triangles; limit '+max);
  if(quality==='low'){for(const texture of d.getRoot().listTextures()){const temp=path.join(output,texture.getName()+'-low.jpg');await fs.writeFile(temp,texture.getImage());const proc=spawnSync('sips',['-Z','1024',temp,'--out',temp],{encoding:'utf8'});if(proc.status!==0)throw new Error(proc.stderr);texture.setImage(new Uint8Array(await fs.readFile(temp)));await fs.unlink(temp);}}
  await d.transform(meshopt({encoder:MeshoptEncoder,level:'high'}));const file=path.join(output,quality==='low'?'low':'','car-'+source.kind+'.glb');await io.write(file,d);const check=await io.read(file),meshNodes=check.getRoot().listNodes().filter(n=>n.getMesh());entry.variants[quality]={file:path.relative(output,file),bytes:(await fs.stat(file)).size,triangles:count(check),vertices:check.getRoot().listMeshes().flatMap(m=>m.listPrimitives()).reduce((n,p)=>n+p.getAttribute('POSITION').getCount(),0),textures:check.getRoot().listTextures().map(t=>({name:t.getName(),bytes:t.getImage().length,mimeType:t.getMimeType(),size:t.getSize()})),meshNames:meshNodes.map(n=>n.getName())};if(!check.getRoot().listNodes().some(n=>n.getName()==='car-'+source.id&&n.getExtras().carRig))throw new Error('carRig metadata missing');console.log(source.id,quality,entry.variants[quality]);
 }
 manifest.models.push(entry);await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
}
console.log('Finished',path.join(output,'manifest.json'));

if(args.get('--install')==='true'){
 const target=path.join(project,'static/models');await fs.mkdir(path.join(target,'low'),{recursive:true});
 for(const entry of manifest.models)for(const variant of Object.values(entry.variants))await fs.copyFile(path.join(output,variant.file),path.join(target,variant.file));
 await fs.copyFile(path.join(output,'manifest.json'),path.join(target,'garage-cars.json'));
 console.log('Installed runtime cars; uncompressed rig sources stay outside static/.');
}
