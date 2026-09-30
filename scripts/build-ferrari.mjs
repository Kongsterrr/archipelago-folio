// Rebuild the owner-supplied Ferrari Purosangue without altering other cars.
// node scripts/build-ferrari.mjs --project . --source /path/ferrari.glb --output /tmp/ferrari-assets
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const args=new Map();for(let i=2;i<process.argv.length;i+=2)args.set(process.argv[i],process.argv[i+1]);
const project=path.resolve(args.get('--project')||path.join(path.dirname(fileURLToPath(import.meta.url)),'..'));
const source=args.get('--source');if(!source)throw Error('Provide --source /path/to/ferrari.glb');
const output=path.resolve(args.get('--output')||path.join(project,'.asset-build/ferrari'));
const require=createRequire(path.join(project,'package.json'));
const {NodeIO}=require('@gltf-transform/core'),{ALL_EXTENSIONS}=require('@gltf-transform/extensions');
const {weld,simplifyPrimitive,prune,meshopt}=require('@gltf-transform/functions');
const {MeshoptEncoder,MeshoptDecoder,MeshoptSimplifier}=require('meshoptimizer');
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready,MeshoptSimplifier.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
await fs.mkdir(path.join(output,'low'),{recursive:true});await fs.mkdir(path.join(output,'source-rigged'),{recursive:true});
const doc=await io.read(source),root=doc.getRoot(),scene=root.listScenes()[0],originalNode=root.listNodes()[0],originalMesh=originalNode.getMesh(),original=originalMesh.listPrimitives()[0],material=original.getMaterial(),buffer=root.listBuffers()[0],p=original.getAttribute('POSITION').getArray(),n=original.getAttribute('NORMAL').getArray(),uv=original.getAttribute('TEXCOORD_0').getArray(),idx=original.getIndices().getArray();
// The source fuses the inner cushion edge to a gray console skirt. Its brown
// leather atlas distinguishes the movable cushion from the stationary skirt.
const colorJPEG=path.join(output,'ferrari-partition-basecolor.jpg'),colorBMP=path.join(output,'ferrari-partition-basecolor.bmp');
await fs.writeFile(colorJPEG,material.getBaseColorTexture().getImage());const decodedColor=spawnSync('sips',['-s','format','bmp',colorJPEG,'--out',colorBMP],{encoding:'utf8'});if(decodedColor.status!==0)throw Error(decodedColor.stderr);
const colorBytes=await fs.readFile(colorBMP),colorOffset=colorBytes.readUInt32LE(10),colorWidth=colorBytes.readUInt32LE(18),colorHeight=colorBytes.readInt32LE(22),colorStride=Math.ceil(colorWidth*24/32)*4;
const colorAt=(u,v)=>{const x=Math.max(0,Math.min(colorWidth-1,Math.floor(u*colorWidth))),y=Math.max(0,Math.min(Math.abs(colorHeight)-1,Math.floor(v*Math.abs(colorHeight)))),i=colorOffset+(colorHeight>0?colorHeight-1-y:y)*colorStride+x*3;return[colorBytes[i+2],colorBytes[i+1],colorBytes[i]];};
await fs.unlink(colorJPEG);await fs.unlink(colorBMP);
function bounds(p,ids){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const i of ids)for(let a=0;a<3;a++){min[a]=Math.min(min[a],p[i*3+a]);max[a]=Math.max(max[a],p[i*3+a]);}return{min,max,size:max.map((v,i)=>v-min[i]),center:max.map((v,i)=>(v+min[i])/2)};}
const b=bounds(p,idx),scale=4.7/b.size[2],map=v=>[-(v[0]-b.center[0])*scale,(v[1]-b.min[1])*scale,-(v[2]-b.center[2])*scale];
// Centers are fitted to the original yellow hub caps; per-wheel tread profiles
// are measured from triangle intersections through the axle's bottom meridian.
const specs={
 'front-left':{y:.0719,z:.2982,rim:.066,cut:.081},
 'front-right':{y:.0733,z:.2980,rim:.0665,cut:.082},
 'rear-left':{y:.0771,z:-.2996,rim:.0680,cut:.086},
 'rear-right':{y:.0775,z:-.2993,rim:.0680,cut:.086}
};
const profiles={};
function reducedProfile(points,eps=.00018){const result=[points[0]];function rec(a,b){let best=eps,at=-1;for(let i=a+1;i<b;i++){let u=(points[i][0]-points[a][0])/(points[b][0]-points[a][0]),r=points[a][1]*(1-u)+points[b][1]*u,err=Math.abs(r-points[i][1]);if(err>best){best=err;at=i;}}if(at<0)result.push(points[b]);else{rec(a,at);rec(at,b);}}rec(0,points.length-1);return result;}
for(const[key,s]of Object.entries(specs)){
 const sign=key.endsWith('left')?1:-1,pts=[];
 for(let i=0;i<idx.length;i+=3)for(let j=0;j<3;j++){
  const a=idx[i+j]*3,c=idx[i+(j+1)%3]*3,za=p[a+2]-s.z,zc=p[c+2]-s.z;if(za*zc>=0)continue;
  const t=za/(za-zc),x=sign*(p[a]+t*(p[c]-p[a])),y=p[a+1]+t*(p[c+1]-p[a+1]);if(x>.135&&x<.216&&y<s.y-.045)pts.push([x,s.y-y]);
 }
 // Broad windows avoid isolated missing intersections on the source's UV seams.
 let profile=Array.from({length:40},(_,i)=>.137+i*.002).map(x=>[x,Math.max(...pts.filter(p=>Math.abs(p[0]-x)<.0021).map(p=>p[1]))]).filter(v=>Number.isFinite(v[1]));
 const max=Math.max(...profile.map(p=>p[1]));profile=profile.map(([x,r])=>[x,Math.min(s.y,r+s.y-max)]);
 // Close each sidewall behind the original rim, without an exposed annular edge.
 profile.unshift([.135,.054]);profile.push([.2155,s.rim-.004],[.211,s.rim-.009]);
 profiles[key]=reducedProfile(profile.slice(0,-1));profiles[key].push(profile.at(-1));
}
function profileRadius(key,x){const a=profiles[key].slice(0,-1);for(let i=1;i<a.length;i++)if(x<=a[i][0]){const u=Math.max(0,Math.min(1,(x-a[i-1][0])/(a[i][0]-a[i-1][0])));return a[i-1][1]*(1-u)+a[i][1]*u;}return a.at(-1)[1];}
const parts=new Map([['car-body',[]],['car-driver-seat',[]]]),wheelCenters={},wheelRadii={};
for(const[key,s]of Object.entries(specs)){const name='car-wheel-'+key;parts.set(name,[]);parts.set(name.replace('wheel','brake'),[]);wheelCenters[name]=map([(key.endsWith('left')?1:-1)*.175,s.y,s.z]);wheelRadii[name]=s.y*scale;}
let replacedRubberTriangles=0;
for(let i=0;i<idx.length;i+=3){const ids=[idx[i],idx[i+1],idx[i+2]],c=[0,0,0];for(const v of ids)for(let a=0;a<3;a++)c[a]+=p[v*3+a]/3;let name='car-body';for(const[key,s]of Object.entries(specs)){
 const side=key.endsWith('left')?1:-1,x=c[0]*side,r=Math.hypot(c[1]-s.y,c[2]-s.z);if(x<.133||r>s.cut)continue;
 // The upper annulus is the source wheel-well liner, not rotating rubber.
 // Preserve it so splitting the wheel cannot expose a hole through the body.
 if(r>s.rim&&c[1]>s.y&&r>profileRadius(key,x)-.0005)break;
 // Inner brake disk/caliper/backing surfaces are stationary; the detailed alloy
 // rim/spokes in front of them roll, and the front assembly steers together.
 if(r>s.rim){name=null;replacedRubberTriangles++;}else name=`car-${x<.196?'brake':'wheel'}-${key}`;break;
 }
 // The driver chair occupies a separate source-space volume behind the wheel.
 // These bounds exclude the steering ring, center console, rear seats and roof.
 if(name==='car-body'&&c[1]>.10&&c[1]<.299&&((c[0]>.023&&c[0]<.148&&c[1]<.140&&c[2]>-.067&&c[2]<.0555)||(c[0]>.021&&c[0]<.146&&c[1]>.14&&c[2]>-.123&&c[2]<-.030)))name='car-driver-seat';
 if(name==='car-driver-seat'&&c[0]<.032&&c[1]<.15){const tex=[0,0];for(const id of ids){tex[0]+=uv[id*2]/3;tex[1]+=uv[id*2+1]/3;}const color=colorAt(...tex);if(color[0]<color[1]*1.25)name='car-body';}
 if(name)parts.get(name).push(...ids);
}
// The chair is a single connected component once the surrounding cabin is cut
// away. Return disconnected window/ceiling/console fragments to static body.
{
 const ids=parts.get('car-driver-seat'),parent=new Map(),find=x=>{while(parent.get(x)!==x){parent.set(x,parent.get(parent.get(x)));x=parent.get(x);}return x;},union=(a,b)=>{a=find(a);b=find(b);if(a!==b)parent.set(b,a);},coincident=new Map();
 for(const id of ids)if(!parent.has(id)){parent.set(id,id);const key=p[id*3]+','+p[id*3+1]+','+p[id*3+2],other=coincident.get(key);if(other===undefined)coincident.set(key,id);else union(id,other);}
 for(let i=0;i<ids.length;i+=3){union(ids[i],ids[i+1]);union(ids[i],ids[i+2]);}
 const groups=new Map();for(let i=0;i<ids.length;i+=3){const key=find(ids[i]);let group=groups.get(key);if(!group)groups.set(key,group=[]);group.push(ids[i],ids[i+1],ids[i+2]);}
 const sorted=[...groups.values()].sort((a,b)=>b.length-a.length);parts.set('car-driver-seat',sorted[0]);for(const group of sorted.slice(1))for(const id of group)parts.get('car-body').push(id);
 console.log('Seat connected components:',sorted.map(g=>g.length/3));
}
const totalOriginal=[...parts.values()].reduce((s,a)=>s+a.length/3,0);if(totalOriginal+replacedRubberTriangles!==idx.length/3)throw Error('Triangle partition mismatch');
const car=doc.createNode('car-ferrari-purosangue');scene.removeChild(originalNode);scene.addChild(car);
// Contacts were measured from the original seat, steering ring and actual Jack
// skin. Calibration preserves Jack's scale and bind-bone translations. The small
// footrests accommodate his short legs with the supplied driver chair lowered 30 mm as a complete unit.
const calibration={
  "grips": {
    "Left": [
      -0.5660177091909342,
      1.1032548568975837,
      -0.15565487002750691
    ],
    "Right": [
      -0.24943153286380151,
      1.1032548568975837,
      -0.15570283762998072
    ]
  },
  "feet": {
    "Left": [
      -0.5177245,
      0.485,
      -0.337
    ],
    "Right": [
      -0.2977245,
      0.485,
      -0.337
    ]
  },
  "pelvis": [
    -0.40772450000000005,
    0.6,
    -0.033
  ],
  "seatSurface": [
    -0.40772450000000005,
    0.5766318782055074,
    -0.033
  ],
  "torsoLean": 0.2,
  "headPitch": -0.05,
  "handPitch": 1.1,
  "footPitch": 0,
  "roofProbeBounds": {
    "minY": 1.44,
    "maxY": 1.64,
    "minX": -0.78,
    "maxX": -0.08,
    "minZ": -0.3,
    "maxZ": 0.65
  },
  "headrestProbeBounds": {
    "lo": 0.26,
    "hi": 0.56,
    "top": 1.46
  },
  "driverSeatDrop": 0.03,
  "driverSeatAdjustment": {
    "node": "car-driver-seat",
    "translation": [
      0,
      -0.03,
      0
    ],
    "description": "Original driver cushion, backrest and headrest lowered together by 30 mm; original shape, material and all passenger/body/roof geometry retained."
  },
  "driverFootrest": {
    "description": "Two compact graphite supports inside the existing front footwell, below and ahead of the lowered driver seat cushion; supports measured Jack soles without stretching the original skeleton.",
    "originalFloorY": 0.432,
    "topY": 0.4795,
    "soleMarkerOffsetY": 0.0055,
    "platforms": [
      {
        "side": "left",
        "min": [
          -0.579555,
          0.425,
          -0.409
        ],
        "max": [
          -0.438737,
          0.4795,
          -0.256
        ]
      },
      {
        "side": "right",
        "min": [
          -0.373864,
          0.425,
          -0.409
        ],
        "max": [
          -0.23666,
          0.4795,
          -0.256
        ]
      }
    ]
  }
};
const {seatSurface,pelvis,grips,feet}=calibration,steeringCenter=map([.085,.222,.033]);
const contactTargets={pelvis,grips,feet,torsoLean:calibration.torsoLean,headPitch:calibration.headPitch,handPitch:calibration.handPitch,footPitch:calibration.footPitch};
const rig={id:'ferrari-purosangue',forward:[0,0,-1],up:[0,1,0],dimensions:b.size.map(v=>v*scale),wheelRadius:Object.values(wheelRadii).reduce((s,r)=>s+r,0)/4,wheelRadii,wheelRollAxis:[1,0,0],wheelRollSign:-1,steerAxis:[0,1,0],steerNodes:['car-steer-front-left','car-steer-front-right'],wheelNodes:Object.keys(wheelCenters),wheelCenters,wheelContactPoints:Object.fromEntries(Object.entries(wheelCenters).map(([k,c])=>[k,[c[0],0,c[2]]])),wheelbase:(specs['front-left'].z-specs['rear-left'].z)*scale,seatSurface,steeringCenter,...contactTargets,contactTargets,...calibration,anchorConfidence:'Seat cushion and steering grips measured on original source triangles; actual Jack skin and unchanged skeleton verified in both LODs, with complete roof/headrest clearance and compact footrests supporting the soles.',sourceLength:b.size[2],sourceScale:scale,roofCutawayNode:null,roofCutawayDescription:'Complete supplied roof remains in car-body and visible in every occupancy state.',sourceWheelSeparation:'Geometric hub-cap fitted axles; original outer alloys retained, inner brake/caliper surfaces stationary; source-bottom-meridian profiles revolved into complete circular rubber shells.',sourceTriangleCount:idx.length/3,replacedRubberTriangles,rubberRepair:'Full circular tread and closed sidewall shells measured independently from each source wheel; original alloy design retained.',partitionTriangleCounts:Object.fromEntries([...parts].map(([n,v])=>[n,v.length/3])),tireProfiles:profiles};car.setExtras({carRig:rig});
for(const[name,ids]of parts){const remap=new Map(),vertices=[];for(const id of ids)if(!remap.has(id)){remap.set(id,vertices.length);vertices.push(id);}const outP=new Float32Array(vertices.length*3),outN=new Float32Array(vertices.length*3),outUV=new Float32Array(vertices.length*2),pivot=/^car-(wheel|brake)-/.test(name)?wheelCenters[name.replace('brake','wheel')]:[0,0,0];for(let j=0;j<vertices.length;j++){let id=vertices[j],point=map([p[id*3],p[id*3+1],p[id*3+2]]);for(let a=0;a<3;a++){outP[j*3+a]=point[a]-pivot[a];outN[j*3+a]=n[id*3+a]*(a===1?1:-1);}outUV[j*2]=uv[id*2];outUV[j*2+1]=uv[id*2+1];}const pr=doc.createPrimitive().setMaterial(material).setAttribute('POSITION',doc.createAccessor(name+'-position',buffer).setType('VEC3').setArray(outP)).setAttribute('NORMAL',doc.createAccessor(name+'-normal',buffer).setType('VEC3').setArray(outN)).setAttribute('TEXCOORD_0',doc.createAccessor(name+'-uv',buffer).setType('VEC2').setArray(outUV)).setIndices(doc.createAccessor(name+'-indices',buffer).setType('SCALAR').setArray(Uint32Array.from(ids,id=>remap.get(id)))),node=doc.createNode(name),mesh=doc.createMesh(name).addPrimitive(pr);if(name.startsWith('car-wheel'))node.addChild(doc.createNode(name+'-surface').setMesh(mesh));else node.setMesh(mesh);if(/^car-(wheel|brake)-front-/.test(name)){const steerName=name.replace(/wheel|brake/,'steer');let steer=root.listNodes().find(n=>n.getName()===steerName);if(!steer){steer=doc.createNode(steerName).setTranslation(pivot);car.addChild(steer);}steer.addChild(node);}else{node.setTranslation(pivot);car.addChild(node);}if(name==='car-driver-seat')node.setTranslation(calibration.driverSeatAdjustment.translation);node.setExtras({carPart:name,sourceTriangles:ids.length/3});}
for(const[name,v]of Object.entries({'car-anchor-seat':seatSurface,'car-anchor-pelvis':pelvis,'car-anchor-steering':steeringCenter,'car-anchor-grip-left':grips.Left,'car-anchor-grip-right':grips.Right,'car-anchor-foot-left':feet.Left,'car-anchor-foot-right':feet.Right}))car.addChild(doc.createNode(name).setTranslation(v).setExtras({carAnchor:true}));
originalNode.dispose();originalMesh.dispose();await doc.transform(prune({keepLeaves:true}));
function addTires(d,segments){const r=d.getRoot(),buf=r.listBuffers()[0];let rubber=r.listMaterials().find(m=>m.getName()==='ferrari-rubber');if(!rubber)rubber=d.createMaterial('ferrari-rubber').setBaseColorFactor([.013,.015,.017,1]).setRoughnessFactor(.9).setMetallicFactor(0);for(const[key,profile]of Object.entries(profiles)){const name='car-tire-'+key,wheel=r.listNodes().find(n=>n.getName()==='car-wheel-'+key),old=wheel.listChildren().find(n=>n.getName()===name);if(old){const m=old.getMesh();old.dispose();m.dispose();}const sign=key.endsWith('left')?1:-1,pivot=wheelCenters['car-wheel-'+key],pos=[],norm=[],uv=[],ids=[];for(let i=0;i<profile.length;i++){const[x,rad]=profile[i],a=profile[Math.max(0,i-1)],b=profile[Math.min(profile.length-1,i+1)],dx=b[0]-a[0],dr=b[1]-a[1],length=Math.hypot(dx,dr);for(let j=0;j<=segments;j++){let angle=j*Math.PI*2/segments,c=Math.cos(angle),s=Math.sin(angle);pos.push(-sign*x*scale-pivot[0],c*rad*scale,s*rad*scale);norm.push(sign*dr/length,c*dx/length,s*dx/length);uv.push(j/segments,i/(profile.length-1));}}for(let i=0;i<profile.length-1;i++)for(let j=0;j<segments;j++){let a=i*(segments+1)+j,b=a+segments+1;if(sign===1)ids.push(a,b,a+1,a+1,b,b+1);else ids.push(a,a+1,b,a+1,b+1,b);}let pr=d.createPrimitive().setMaterial(rubber).setAttribute('POSITION',d.createAccessor(name+'-position',buf).setType('VEC3').setArray(new Float32Array(pos))).setAttribute('NORMAL',d.createAccessor(name+'-normal',buf).setType('VEC3').setArray(new Float32Array(norm))).setAttribute('TEXCOORD_0',d.createAccessor(name+'-uv',buf).setType('VEC2').setArray(new Float32Array(uv))).setIndices(d.createAccessor(name+'-indices',buf).setType('SCALAR').setArray(new Uint32Array(ids)));wheel.addChild(d.createNode(name).setMesh(d.createMesh(name).addPrimitive(pr)).setExtras({carPart:'source-profile-rubber',angularSegments:segments,profilePoints:profile.length}));}}
function addFootrest(d,rig){
 if(!rig.driverFootrest)return;
 const r=d.getRoot(),buf=r.listBuffers()[0],car=r.listNodes().find(n=>n.getExtras().carRig),group=d.createNode('car-driver-footrest').setExtras({carPart:'driver-footrest',...rig.driverFootrest}),material=d.createMaterial('ferrari-footrest-graphite').setBaseColorFactor([.012,.014,.017,1]).setMetallicFactor(.02).setRoughnessFactor(.94);
 car.addChild(group);
 for(const spec of rig.driverFootrest.platforms){
  const name='car-driver-footrest-'+spec.side,lo=spec.min,hi=spec.max,center=lo.map((v,i)=>(v+hi[i])/2),half=lo.map((v,i)=>(hi[i]-v)/2);
  const faces=[[[1,0,0],[[1,-1,-1],[1,1,-1],[1,1,1],[1,-1,1]]],[[-1,0,0],[[-1,-1,1],[-1,1,1],[-1,1,-1],[-1,-1,-1]]],[[0,1,0],[[-1,1,-1],[-1,1,1],[1,1,1],[1,1,-1]]],[[0,-1,0],[[-1,-1,1],[-1,-1,-1],[1,-1,-1],[1,-1,1]]],[[0,0,1],[[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]]],[[0,0,-1],[[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]]]],positions=[],normals=[],indices=[];
  for(const [normal,points]of faces){const start=positions.length/3;for(const point of points){positions.push(...point.map((v,i)=>v*half[i]));normals.push(...normal);}indices.push(start,start+1,start+2,start,start+2,start+3);}
  const primitive=d.createPrimitive().setMaterial(material).setAttribute('POSITION',d.createAccessor(name+'-position',buf).setType('VEC3').setArray(new Float32Array(positions))).setAttribute('NORMAL',d.createAccessor(name+'-normal',buf).setType('VEC3').setArray(new Float32Array(normals))).setIndices(d.createAccessor(name+'-indices',buf).setType('SCALAR').setArray(new Uint16Array(indices)));
  group.addChild(d.createNode(name).setTranslation(center).setMesh(d.createMesh(name).addPrimitive(primitive)).setExtras({carPart:'driver-footrest-platform',...spec}));
 }
}
function count(d){return d.getRoot().listMeshes().flatMap(m=>m.listPrimitives()).reduce((s,p)=>s+p.getIndices().getCount()/3,0);}
function smooth(d){for(const m of d.getRoot().listMeshes())for(const pr of m.listPrimitives()){let p=pr.getAttribute('POSITION').getArray(),n=pr.getAttribute('NORMAL').getArray(),sums=new Map();for(let i=0;i<p.length;i+=3){let key=p[i]+','+p[i+1]+','+p[i+2],v=sums.get(key)||[0,0,0];for(let a=0;a<3;a++)v[a]+=n[i+a];sums.set(key,v);}for(let i=0;i<p.length;i+=3){let v=sums.get(p[i]+','+p[i+1]+','+p[i+2]),len=Math.hypot(...v)||1;for(let a=0;a<3;a++)n[i+a]=v[a]/len;}}}
async function reduce(d,target,error){await d.transform(weld());const all=d.getRoot().listMeshes().flatMap(m=>m.listPrimitives().map(p=>({m,p}))),fixed=all.filter(({m})=>(m.getName().startsWith('car-tire-')||m.getName().startsWith('car-driver-footrest'))).reduce((s,{p})=>s+p.getIndices().getCount()/3,0),moving=all.filter(({m})=>!(m.getName().startsWith('car-tire-')||m.getName().startsWith('car-driver-footrest'))),count=moving.reduce((s,{p})=>s+p.getIndices().getCount()/3,0);for(const{p}of moving)simplifyPrimitive(p,{simplifier:MeshoptSimplifier,ratio:(target-fixed)/count,error});await d.transform(prune({keepLeaves:true}));}
addFootrest(doc,rig);addTires(doc,128);const rigged=path.join(output,'source-rigged/ferrari-purosangue.glb');await io.write(rigged,doc);await fs.writeFile(path.join(output,'rig.json'),JSON.stringify(rig,null,2)+'\n');console.log('Rigged',rigged,JSON.stringify(rig.dimensions),rig.partitionTriangleCounts);
const entry={id:'ferrari-purosangue',source:path.basename(source),sourceBytes:(await fs.stat(source)).size,sourceSHA256:createHash('sha256').update(await fs.readFile(source)).digest('hex'),rig,variants:{}};
for(const quality of['high','low']){const d=await io.read(rigged),target=quality==='high'?112000:42000,max=quality==='high'?120000:45000;addTires(d,quality==='high'?128:80);smooth(d);await reduce(d,target,quality==='high'?.008:.02);if(count(d)>max)await reduce(d,target,quality==='high'?.018:.04);if(count(d)>max)throw Error('Triangle budget exceeded');if(quality==='low')for(const texture of d.getRoot().listTextures()){let temp=path.join(output,texture.getName()+'-low.jpg');await fs.writeFile(temp,texture.getImage());let proc=spawnSync('sips',['-Z','1024',temp,'--out',temp],{encoding:'utf8'});if(proc.status!==0)throw Error(proc.stderr);texture.setImage(new Uint8Array(await fs.readFile(temp)));await fs.unlink(temp);}await d.transform(meshopt({encoder:MeshoptEncoder,level:'high'}));const file=path.join(output,quality==='low'?'low':'','car-ferrari.glb');await io.write(file,d);const check=await io.read(file);entry.variants[quality]={file:path.relative(output,file),bytes:(await fs.stat(file)).size,triangles:count(check),vertices:check.getRoot().listMeshes().flatMap(m=>m.listPrimitives()).reduce((s,p)=>s+p.getAttribute('POSITION').getCount(),0),textures:check.getRoot().listTextures().map(t=>({name:t.getName(),bytes:t.getImage().length,mimeType:t.getMimeType(),size:t.getSize()})),meshNames:check.getRoot().listNodes().filter(n=>n.getMesh()).map(n=>n.getName())};console.log(quality,entry.variants[quality]);await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify({version:2,coordinateSystem:'Meters; Y up, ground Y=0; forward -Z; driver -X.',sourceGeometry:'Original Ferrari body, roof, cabin, materials, UVs and alloy design retained. Independent round rubber profiles measured from source triangle sections; brakes stationary. Two small graphite footrests support Jack above the original driver footwell; driver chair preserves its original shape and is lowered together by 30 mm for a natural seated eye line; exterior and roof geometry are unchanged.',models:[entry]},null,2)+'\n');}
