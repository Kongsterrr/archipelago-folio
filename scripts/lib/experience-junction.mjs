// V19: one terraced coastal town, with shared civic space and a rear railway.
import * as THREE from 'three';
import {careerRailway} from './career-railway-layout.mjs';
import {careerTerraces} from './career-terraces.mjs';
import {sampleTrainPath,trainPathLength,trainDistanceAtPlan} from '../../sources/core/train-path.js';

export const experiencePalette={
 junction_sandstone:'#d6c3a1',junction_stone:'#e5dac4',junction_joint:'#b3a28b',
 junction_paving:'#cfbfa5',junction_navy:'#344f67',junction_steel:'#41545c',
 junction_brick:'#a76750',junction_brickJoint:'#ce9d7d',junction_copper:'#ba916b',
 junction_glass:'#7faaa8',junction_clear:'#b5d4ce',junction_wood:'#b18c63',
 junction_woodDark:'#755d46',junction_leaf:'#4e7b58',junction_leafLight:'#85a56e',
 junction_soil:'#735c49',junction_cream:'#f5ead5',junction_teal:'#4a8b87',
 junction_flower:'#caa59c',junction_lawn:'#9aaa72',junction_metal:'#a9b8b6',
};

export function buildExperienceJunction(api){
 const {root,layout,low,Y=.85,box,bevel,cyl,cone,mesh,rod,torus,text3D,group,solid,custom}=api;
 const zero=[0,0,0],CY=2.4,SY=5.8;
 const D={amtrak:group(),beaconfire:group(),visionx:group()};
 for(const[id,g]of Object.entries(D))g.name='district_'+id;
 const b=(w,h,d,x,y,z,m='junction_stone',p=D.amtrak,r=zero)=>bevel(w,h,d,x,y,z,m,.025,r,p);
 const bx=(w,h,d,x,y,z,m='junction_stone',p=D.amtrak,r=zero)=>box(w,h,d,x,y,z,m,r,p);
 // Low-detail text retains its exact visible front plane, without the tiny
 // extrusion sidewalls; this reserves geometry for the station architecture.
 const tx=(s,size,x,y,z,m='junction_steel',p=D.amtrak)=>{const o=text3D(s,size,x,y,z,m,.006,p);if(low){const previous=o.geometry,g=new THREE.ShapeGeometry(previous.parameters.shapes,1);g.computeBoundingBox();g.translate(-(g.boundingBox.max.x+g.boundingBox.min.x)/2,0,.006);o.geometry=g;previous.dispose();}return o;};
 const named=(n,x=0,y=0,z=0,p=D.amtrak)=>{const g=group([x,y,z],zero,p);g.name=n;return g;};
 const obstruction=(name,x,z,width,depth,height=2,y=Y,rotation=0)=>solid(x,z,width,depth,height,y,rotation,name);
 const sph=(r,x,y,z,m='junction_leaf',p=D.amtrak,scale=[1,1,1])=>{const o=mesh(new THREE.SphereGeometry(r,low?6:9,low?4:6),m,[x,y,z],zero,p);o.scale.set(...scale);return o;};
 layout.railway=careerRailway();layout.landmarks=[];layout.interiors=[];layout.paths=[];layout.crossings=[];layout.crossing=null;
 const terrain=careerTerraces(layout.shore,Y);layout.terrain=terrain.terrain;layout.ramps=terrain.ramps;layout.stairs=[terrain.stairs];layout.terraces={quayY:Y,courtY:3.65,gardenY:1.55,stationY:6.4,regions:terrain.regions};
 // Continuous sloped support avoids trimesh seam sweeps while matching the rendered planes.
 layout.surfaces.push(...terrain.ramps.map(r=>({...r,width:r.width+.20,depth:r.depth+(r.slope?.08:0)})),...terrain.stairs.treads,terrain.stairs.landing);
 for(const[material,indices]of Object.entries(terrain.materials))custom(terrain.vertices,indices,material,root);
 // Fine stone joints follow the exact shared floor, including graded streets.
 // These 6mm surface details have no collider and stop at gardens and risers.
 {
  const vertices=[],indices=[],half=.011;
  function joint(x0,z0,x1,z1){
   const alongX=Math.abs(x1-x0)>Math.abs(z1-z0),points=alongX?[[x0,z0-half],[x1,z1-half],[x1,z1+half],[x0,z0+half]]:[[x0-half,z0],[x0+half,z0],[x1+half,z1],[x1-half,z1]];
   if(!points.every(([x,z])=>terrain.isPaving(x,z)))return;
   const heights=points.map(([x,z])=>terrain.height(x,z)),mid=terrain.height((x0+x1)/2,(z0+z1)/2);
   if(Math.abs(mid-heights.reduce((sum,y)=>sum+y,0)/4)>.002||Math.max(...heights)-Math.min(...heights)>.17)return;
   const offset=vertices.length;vertices.push(...points.map(([x,z],i)=>[x,heights[i]+.006,z]));indices.push(offset,offset+2,offset+1,offset,offset+3,offset+2);
  }
  const rowDepth=low?3.2:1.8,tileWidth=low?4.5:2.4;
  for(let row=Math.floor(-28/rowDepth);row<=Math.ceil(31/rowDepth);row++){
   const z=row*rowDepth;
   for(let x=-38;x<38;x+=.8)joint(x,z,x+.8,z);
   for(let x=-38+(row%2)*tileWidth/2;x<38;x+=tileWidth)for(let dz=.011;dz<rowDepth-.01;dz+=.445)joint(x,z+dz,x,z+Math.min(rowDepth-.011,dz+.445));
  }
  const joints=custom(vertices,indices,'junction_stone',root);if(joints)joints.name='career_stone_paving_joints';
 }

 function rail(name,a,c,ay,by,p=D.amtrak,baseA=ay,baseB=by,stone=false){
  const length=Math.hypot(c[0]-a[0],c[1]-a[1]);if(length<.05)return;
  const angle=Math.atan2(c[0]-a[0],c[1]-a[1]),segments=Math.max(1,Math.ceil(length/.5));
  rod([a[0],ay+.76,a[1]],[c[0],by+.76,c[1]],stone?.045:.032,'junction_steel',p,6);
  if(stone)rod([a[0],ay+.20,a[1]],[c[0],by+.20,c[1]],.09,'junction_stone',p,5);
  const posts=Math.max(1,Math.ceil(length/2));for(let i=0;i<=posts;i++){const t=i/posts,x=a[0]+(c[0]-a[0])*t,z=a[1]+(c[1]-a[1])*t,y=ay+(by-ay)*t;bx(stone?.13:.085,.81,stone?.13:.085,x,y+.405,z,stone?'junction_stone':'junction_steel',p);}
  for(let i=0;i<segments;i++){const ta=Math.max(0,i/segments-.006/length),tb=Math.min(1,(i+1)/segments+.006/length),t=(ta+tb)/2,bottom=Math.min(baseA+(baseB-baseA)*ta,baseA+(baseB-baseA)*tb),top=Math.max(ay+(by-ay)*ta,ay+(by-ay)*tb)+.83;obstruction(name,a[0]+(c[0]-a[0])*t,a[1]+(c[1]-a[1])*t,.12,length*(tb-ta),top-bottom,bottom,angle);}
 }
 // Shared parapets follow the town silhouette; there are no employer enclosures.
 const railSamples=Array.from({length:Math.ceil(layout.railway.length/.35)},(_,i)=>sampleTrainPath(layout.railway.path,i*.35));
 for(const e of terrain.edges){
  const length=Math.hypot(e.b[0]-e.a[0],e.b[1]-e.a[1]),n=Math.ceil(length/.4),point=t=>e.a.map((v,i)=>v+(e.b[i]-v)*t+e.outward[i]*.09);let start=null;
  const flush=t=>{if(start!==null){rail('town retaining edge',point(start),point(t),e.top,e.top,D.amtrak,e.bottom,e.bottom,true);start=null;}};
  for(let i=0;i<n;i++){const m=point((i+.5)/n),near=railSamples.some(q=>Math.hypot(q.x-m[0],q.z-m[1])<2.2);if(near)flush(i/n);else if(start===null)start=i/n;}flush(1);
 }
 function rampGuards(r){if(!r.slope)return;const c=Math.cos(r.rotation||0),s=Math.sin(r.rotation||0);for(const side of[-1,1]){const xx=side*(r.width/2+.09),point=zz=>[r.x+xx*c+zz*s,r.z-xx*s+zz*c],inset=r.id==='station-west-street'?1.5:0,back=-r.depth/2+inset,front=r.depth/2-inset;rail('ramp side '+r.id,point(back),point(front),r.y+r.slope*back,r.y+r.slope*front,D.amtrak,Y,Y);}}
 for(const r of layout.ramps)rampGuards(r);
 for(const side of[-1,1]){const x=side*3.33;rail('grand stair lower balustrade',[x,-11.4],[x,-14.8],3.65,5.025,D.amtrak,3.65,3.65,true);rail('grand stair landing balustrade',[x,-14.8],[x,-16],5.025,5.025,D.amtrak,3.65,3.65,true);rail('grand stair upper balustrade',[x,-16],[x,-19.4],5.025,6.4,D.amtrak,3.65,3.65,true);}
 function arch(x,y,z,w,h,p,glass=true,material='junction_stone'){
  const stem=h-w/2,shape=new THREE.Shape();shape.moveTo(-w/2,0);shape.lineTo(w/2,0);shape.lineTo(w/2,stem);shape.absarc(0,stem,w/2,0,Math.PI,false);shape.closePath();if(glass)mesh(new THREE.ShapeGeometry(shape,low?7:12),'junction_glass',[x,y,z],zero,p);
  for(const dx of[-w/2,w/2])bx(.13,stem,.18,x+dx,y+stem/2,z+.035,material,p);
  for(let i=0,n=low?9:14;i<n;i++){const a=i*Math.PI/n,c=(i+1)*Math.PI/n;rod([x+Math.cos(a)*w/2,y+stem+Math.sin(a)*w/2,z+.05],[x+Math.cos(c)*w/2,y+stem+Math.sin(c)*w/2,z+.05],.10,material,p,6);}
  if(glass){bx(.065,h-.12,.06,x,y+h/2-.06,z+.06,material,p);bx(w,.055,.06,x,y+stem*.62,z+.06,material,p);b(w+.28,.13,.30,x,y-.055,z+.055,material,p);}
 }
 // These openings change the masonry render only. The existing solid wall
 // colliders continue to protect the glazed windows and their deep reveals.
 function piercedWall(x,y,z,w,h,d,openings,material,p){
  const shape=new THREE.Shape();shape.moveTo(-w/2,0);shape.lineTo(w/2,0);shape.lineTo(w/2,h);shape.lineTo(-w/2,h);shape.closePath();
  for(const q of openings){const hole=new THREE.Path(),xx=q.x-x,stem=q.height-(q.arch?q.width/2:0);hole.moveTo(xx-q.width/2,q.bottom);hole.lineTo(xx+q.width/2,q.bottom);hole.lineTo(xx+q.width/2,q.bottom+stem);if(q.arch)hole.absarc(xx,q.bottom+stem,q.width/2,0,Math.PI,false);else hole.lineTo(xx-q.width/2,q.bottom+q.height);hole.closePath();shape.holes.push(hole);}
  const g=new THREE.ExtrudeGeometry(shape,{depth:d,bevelEnabled:false,steps:1,curveSegments:low?8:12});g.translate(0,0,-d/2);return mesh(g,material,[x,y,z],zero,p);
 }
 function northSign(label,size,x,y,z,p){const face=named('career_railway_lettering',x,y,z,p);face.rotation.y=Math.PI;tx(label,size,0,0,0,'junction_cream',face);return face;}
 function canopy(name,x,z,w,d,y,rise,m,p){
  const g=named(name,0,0,0,p),n=low?12:18,v=[],ix=[];for(const zz of[z-d/2,z+d/2])for(let i=0;i<=n;i++){const a=i*Math.PI/n;v.push([x+Math.cos(a)*w/2,y+Math.sin(a)*rise,zz]);}for(let i=0;i<n;i++){const j=n+1+i;ix.push(i,i+1,j,i+1,j+1,j,j,i+1,i,j,j+1,i+1);}custom(v,ix,m,g);
  for(let j=0;j<=5;j++){const zz=z-d/2+d*j/5;for(let i=0;i<n;i++){const a=i*Math.PI/n,c=(i+1)*Math.PI/n;rod([x+Math.cos(a)*w/2,y+Math.sin(a)*rise+.035,zz],[x+Math.cos(c)*w/2,y+Math.sin(c)*rise+.035,zz],.046,'junction_teal',g,6);}}
  return g;
 }
 function planter(x,z,w,d,y,p,flowers=false){
  b(w,.36,d,x,y+.18,z,'junction_stone',p);bx(w-.13,.024,d-.13,x,y+.375,z,'junction_soil',p);
  for(let i=0,n=low?3:5;i<n;i++){const xx=x-w*.36+i*w*.72/(n-1);sph(.28,xx,y+.61,z,i%2?'junction_leafLight':'junction_leaf',p,[1,.82,.8]);if(flowers)sph(.10,xx,y+.81,z,'junction_flower',p);}
  obstruction('town planted border',x,z,w,d,.85,y);
 }
 function tree(id,x,z,y,p,h=4){const crown=named('occluder_junction_tree_'+id,0,0,0,p);rod([x,y,z],[x,y+h*.76,z],.12,'junction_woodDark',p,7);for(const[dx,dz,s]of[[-.55,.1,1],[.5,.15,.9],[0,-.5,.85]])sph(1.25,x+dx,y+h*.78,z+dz,'junction_leaf',crown,[s,.9*s,.9*s]);obstruction('town tree '+id,x,z,.34,.34,h,y);}
 function light(id,x,z,y,p){b(.25,.12,.25,x,y+.06,z,'junction_stone',p);rod([x,y+.08,z],[x,y+2.55,z],.043,'junction_steel',p,6);b(.36,.39,.32,x,y+2.57,z,'junction_steel',p);bx(.26,.29,.23,x,y+2.57,z,'warmWindow',p);b(.48,.07,.43,x,y+2.81,z,'junction_navy',p);obstruction('town lantern '+id,x,z,.26,.26,2.86,y);}
 function bench(id,contentId,x,z,y,yaw=0){const g=named('junction_bench_'+id,x,y,z,D[contentId]);g.rotation.y=yaw;for(const zz of[-.23,0,.23])b(2.05,.10,.19,0,.55,zz,'junction_wood',g);for(const yy of[.91,1.12])b(2.05,.16,.11,0,yy,-.33,'junction_wood',g);for(const xx of[-.74,.74]){rod([xx,0,-.2],[xx,1.23,-.33],.045,'junction_steel',g,6);rod([xx,0,.22],[xx,.55,.22],.045,'junction_steel',g,6);}obstruction('junction bench '+id,x,z,2.1,.77,1.27,y,yaw);const item={id:contentId+':'+id,contentId,action:contentId,x,z,y:y+.58,yaw,rotation:yaw,approach:{x:x+Math.sin(yaw)*1.5,z:z+Math.cos(yaw)*1.5,y}};layout.benches.push(item);layout.bench??=item;}
 const cameras={
  amtrak:{cameraTarget:{x:0,y:9.1,z:-10.5},camera:{distance:44,fitBounds:{min:{x:-14.5,y:SY,z:-18.1},max:{x:14.5,y:15.9,z:-2.2}}}},
  beaconfire:{cameraTarget:{x:-20.1,y:5.0,z:6},camera:{distance:34,fitBounds:{min:{x:-27,y:CY,z:-.6},max:{x:-9.9,y:9.5,z:13}}}},
  visionx:{cameraTarget:{x:20.1,y:4.9,z:6},camera:{distance:34,fitBounds:{min:{x:9.9,y:CY,z:-.6},max:{x:27,y:7.9,z:13}}}},
 };
 function reader(id,contentId,x,z,y,yaw,approach,lines,lift=0){const p=D[contentId],g=named('station_'+id,x,y+lift,z,p);g.rotation.y=yaw;const color={amtrak:'junction_navy',beaconfire:'junction_copper',visionx:'junction_teal'}[contentId];b(3.5,1.8,.065,0,1.46,0,'junction_cream',g);bx(.09,1.62,.015,-1.59,1.46,.041,color,g);tx(contentId==='beaconfire'?'BEACONFIRE':contentId.toUpperCase(),.25,0,1.97,.045,color,g);lines.forEach((line,i)=>tx(line,.095,0,1.62-i*.19,.045,'junction_steel',g));bx(3.15,.31,.018,0,.91,.045,color,g);tx('VIEW EXPERIENCE',.14,0,.86,.06,'junction_cream',g);layout.stations.push({id,type:'read',contentId,label:contentId==='beaconfire'?'BeaconFire':contentId==='amtrak'?'Amtrak':'VisionX',primary:true,readFull:true,readLabel:'View experience',x:approach[0],z:approach[1],y,...cameras[contentId],hitArea:{x:x+Math.sin(yaw)*.055,y:y+lift+1.46,z:z+Math.cos(yaw)*.055,width:3.52,height:1.82,yaw}});}
 // One compact port directory. Its three rows are direct pointer destinations;
 // its single nearby E interaction opens the Experience overview.
 {
  const x=-10.8,z=25.0,g=named('station_experience:directory',x,Y,z,D.amtrak);b(5.25,2.72,.27,0,1.62,0,'junction_stone',g);b(5.45,.16,.54,0,3.05,0,'junction_navy',g);for(const dx of[-2.13,2.13])bx(.13,1,.16,dx,.5,0,'junction_steel',g);tx('CAREER QUARTER',.31,0,2.76,.15,'junction_navy',g);
  for(const[i,id]of['amtrak','beaconfire','visionx'].entries()){const row=named('station_'+id+':directory',0,0,0,g),yy=2.22-i*.68,color={amtrak:'junction_navy',beaconfire:'junction_copper',visionx:'junction_teal'}[id];bx(4.86,.58,.026,0,yy,.151,color,row);tx((i+1)+'  '+(id==='beaconfire'?'BEACONFIRE':id.toUpperCase()),.225,-.45,yy-.06,.169,'junction_cream',row);tx('VIEW',.13,1.98,yy-.05,.169,'junction_cream',row);layout.stations.push({id:id+':directory',type:'read',contentId:id,label:id==='beaconfire'?'BeaconFire':id==='amtrak'?'Amtrak':'VisionX',directory:true,primary:false,readFull:true,readLabel:'View experience',x:x+(i-1)*.04,z:27.0,y:Y,...cameras[id],hitArea:{x,y:Y+yy,z:z+.18,width:4.9,height:.6,yaw:0}});}
  obstruction('port career directory',x,z,5.25,.35,3.2,Y);layout.stations.push({id:'experience:directory',type:'read',contentId:'experience',label:'Career Quarter directory',directoryOverview:true,readFull:true,readLabel:'Explore experience',x,z:27.0,y:Y});
 }

 function authored(id,dx,dy,dz,sz,build){
  const parent=D[id],part=named('career_'+id+'_architecture',0,0,0,parent),keys=['stations','obstacles','benches','landmarks','interiors'],starts=Object.fromEntries(keys.map(k=>[k,layout[k].length]));D[id]=part;build();D[id]=parent;part.position.set(dx,dy,dz);part.scale.z=sz;
  const point=q=>{if(q.x!==undefined)q.x+=dx;if(q.z!==undefined)q.z=q.z*sz+dz;if(q.y!==undefined)q.y+=dy;return q;};
  for(const q of layout.stations.slice(starts.stations)){point(q);if(q.hitArea){point(q.hitArea);q.hitArea.width*=Math.abs(Math.sin(q.hitArea.yaw||0))*sz+Math.abs(Math.cos(q.hitArea.yaw||0));}}
  for(const q of layout.obstacles.slice(starts.obstacles)){point(q);const a=q.rotation||0;q.width*=Math.abs(Math.sin(a))*sz+Math.abs(Math.cos(a));q.depth*=Math.abs(Math.cos(a))*sz+Math.abs(Math.sin(a));}
  for(const q of layout.benches.slice(starts.benches)){point(q);point(q.approach);}
  for(const q of layout.landmarks.slice(starts.landmarks)){point(q);q.depth*=sz;}
  for(const q of layout.interiors.slice(starts.interiors)){q.floorY+=dy;point(q.bounds);q.bounds.depth*=sz;for(const e of q.entrances){point(e);e.y=terrain.height(e.x,e.z);e.width*=Math.abs(Math.sin(e.yaw||0))*sz+Math.abs(Math.cos(e.yaw||0));}q.walkRoute=q.walkRoute.map(([x,z])=>[x+dx,z*sz+dz]);}
 }
 // Grand terminal: deep stone reveals, lower tiled wings and a clock fronton.
 {
  authored('amtrak',0,.6,-8,1,()=>{
  const p=D.amtrak,walls=named('occluder_junction_terminal_walls',0,0,0,p),roof=named('occluder_junction_terminal_roof',0,0,0,p),front=-6,back=-14.1,cz=-10.05;
  layout.landmarks.push({id:'career-station',contentId:'amtrak',label:'Amtrak Central',x:0,z:cz,width:24,depth:8.1,nodeGroup:walls.name});
  for(const xx of[-11.86,11.86])for(const [zz,dd] of xx<0?[[-13.4,1.4],[-7.65,3.3]]:[[cz,8.1]]){bx(.28,5.0,dd,xx,SY+2.5,zz,'junction_sandstone',walls);obstruction('terminal side wall',xx,zz,.28,dd,5,SY);}
  for(const zz of[front,back])for(const sign of[-1,1]){const xx=sign*7.68;if(zz===back)piercedWall(xx,SY,zz,8.64,5,.24,[5.7,9.5].map(x=>({x:sign*x,bottom:.83,width:2.18,height:3.15,arch:true})),'junction_sandstone',walls);else bx(8.64,5,.24,xx,SY+2.5,zz,'junction_sandstone',walls);obstruction('terminal portal wing',xx,zz,8.64,.24,5,SY);}
  arch(0,SY,front+.02,6.5,4.78,walls,false);for(const xx of[-9.5,-5.7,5.7,9.5])arch(xx,SY+.83,front+.14,2.18,3.15,walls,true);
  for(const zz of[front+.02,back-.02])bx(24.45,.22,.4,0,SY+4.75,zz,'junction_stone',walls);
  const rear=named('career_terminal_railway_facade',0,0,back-.17,walls);rear.rotation.y=Math.PI;arch(0,SY,0,6.5,4.78,rear,false);
  for(const xx of[-9.5,-5.7,5.7,9.5]){arch(xx,SY+.83,-.24,2.18,3.15,rear,true);arch(xx,SY+.77,0,2.34,3.32,rear,false);bx(2.60,.14,.48,xx,SY+.76,.01,'junction_stone',rear);}
  for(const xx of[-11.9,-3.38,3.38,11.9]){bx(.36,5.08,.42,xx,SY+2.54,back-.10,'junction_stone',walls);bx(.55,.22,.59,xx,SY+.16,back-.13,'junction_stone',walls);}
  for(const side of[-1,1]){bx(8.64,.15,.34,side*7.68,SY+.55,back-.07,'junction_stone',walls);bx(8.7,.15,.43,side*7.68,SY+4.40,back-.10,'junction_stone',walls);}
  bx(10.4,.62,.28,0,SY+4.88,back-.20,'junction_navy',walls);northSign('AMTRAK CENTRAL',.40,0,SY+4.73,back-.35,walls);
  for(let yy=SY+.5;yy<SY+4.5;yy+=low?.72:.43)for(const side of[-1,1])bx(8.62,.018,.018,side*7.68,yy,front+.129,'junction_joint',walls);
  for(const xx of[-11.9,-3.38,3.38,11.9]){bx(.36,5.23,.52,xx,SY+2.615,front,'junction_stone',walls);b(.52,.20,.65,xx,SY+.16,front,'junction_stone',walls);}
  for(const sign of[-1,1]){const x=sign*7.7;custom([[x-4.55,10.92,-14.5],[x+4.55,10.92,-14.5],[x,11.8,-14.5],[x-4.55,10.92,-5.65],[x+4.55,10.92,-5.65],[x,11.8,-5.65]],[0,3,5,0,5,2,2,5,4,2,4,1,0,2,1,3,4,5],'junction_navy',roof);for(let k=0;k<=(low?5:10);k++){const z=-14.25+k*(low?1.66:.83);rod([x-4.3,11.02,z],[x,11.88,z],.022,'junction_copper',roof,5);rod([x,11.88,z],[x+4.3,11.02,z],.022,'junction_copper',roof,5);}}
  canopy('occluder_junction_terminal_vault',0,cz,6.5,8.8,10.85,1.2,'junction_navy',p);
  b(10.4,.63,.30,0,10.97,front+.22,'junction_navy',walls);tx('AMTRAK CENTRAL',.40,0,10.83,front+.382,'junction_cream',walls);
  b(3.5,3.65,1.6,0,13.525,-7.2,'junction_sandstone',roof);b(3.82,.20,1.93,0,15.45,-7.2,'junction_stone',roof);b(3.12,.22,1.60,0,15.69,-7.2,'junction_navy',roof);
  cyl(1.05,1.05,.10,0,13.97,-6.34,'junction_cream',low?22:32,[Math.PI/2,0,0],roof);torus(1.10,.068,0,13.97,-6.26,'junction_copper',zero,6,low?24:36,roof);
  for(let i=0;i<12;i++){const a=i*Math.PI/6;bx(.048,i%3===0?.18:.10,.022,Math.sin(a)*.88,13.97+Math.cos(a)*.88,-6.245,'junction_navy',roof,[0,0,-a]);}rod([0,13.97,-6.21],[.51,14.25,-6.21],.035,'junction_navy',roof,7);rod([0,13.97,-6.21],[-.21,14.62,-6.21],.025,'junction_navy',roof,6);
  const clockBack=named('career_terminal_railway_clock',0,13.97,-8.08,roof);clockBack.rotation.y=Math.PI;cyl(1.05,1.05,.10,0,0,0,'junction_cream',low?18:28,[Math.PI/2,0,0],clockBack);torus(1.10,.055,0,0,.06,'junction_copper',zero,5,low?20:28,clockBack);for(let i=0;i<12;i++){const a=i*Math.PI/6;bx(.045,i%3===0?.18:.10,.024,Math.sin(a)*.88,Math.cos(a)*.88,.085,'junction_navy',clockBack,[0,0,-a]);}rod([0,0,.10],[.51,.28,.10],.035,'junction_navy',clockBack,6);rod([0,0,.10],[-.21,.65,.10],.025,'junction_navy',clockBack,6);
  for(const side of[-1,1]){bench('station-wait-'+side,'amtrak',side*7.5,-8.2,SY,0);b(1.15,.64,.52,side*9.3,SY+.32,-12.8,'junction_woodDark',p);obstruction('station luggage',side*9.3,-12.8,1.2,.6,.8,SY);}
  reader('amtrak:experience','amtrak',-7.6,-5.255,SY,0,[-7.6,-3.75],['FULL STACK ENGINEER','NOV 2024 - PRESENT','WORKFORCE SYSTEMS'],.75);
  layout.interiors.push({landmarkId:'career-station',floorY:SY,bounds:{x:0,z:cz,width:24,depth:8.1},entrances:[{id:'station-front',x:0,z:front,width:6.5,yaw:0},{id:'station-rear',x:0,z:back,width:6.5,yaw:Math.PI}],cutawayGroups:[walls.name,roof.name,'occluder_junction_terminal_vault'],walkRoute:[[0,-11.6],[0,-12.0],[0,-13.3]]});
  });
 }
 // The two lower wings open into the same arcaded court, sharing a floor datum.
 for(const[id,cx]of[['beaconfire',-20.1],['visionx',20.1]]){
  authored(id,id==='beaconfire'?3.1:-2.1,id==='beaconfire'?1.25:-.85,id==='beaconfire'?-.5:-1,id==='beaconfire'?1:.75,()=>{
  const p=D[id],side=Math.sign(cx),arc=named('occluder_junction_'+id+'_arcade',0,0,0,p),inner=side*14.1,columns=side*10.1;
  bx(4.5,.24,13.3,side*12.15,5.52,6.3,'junction_stone',arc);bx(4.67,.10,13.45,side*12.15,5.70,6.3,'junction_copper',arc);
  for(const z of id==='visionx'?[.25,3,11.75]:[.25,3,8.3,12.8]){bx(.19,3.03,.19,columns,CY+1.515,z,'junction_stone',arc);b(.36,.16,.36,columns,CY+.08,z,'junction_stone',arc);b(.39,.20,.39,columns,5.28,z,'junction_stone',arc);obstruction('court arcade pier',columns,z,.23,.23,3.1,CY);}
  if(id==='beaconfire'){
   const walls=named('occluder_junction_workshop_walls',0,0,0,p),roof=named('occluder_junction_workshop_roof',0,0,0,p);layout.landmarks.push({id:'software-workshop',contentId:id,label:'BeaconFire Works',x:cx,z:6,width:12,depth:12,nodeGroup:walls.name});
   bx(.26,5.1,12,-26.1,CY+2.55,6,'junction_brick',walls);obstruction('workshop outer wall',-26.1,6,.26,12,5.1,CY);for(const xx of[cx-4.1,cx+4.1]){piercedWall(xx,CY,0,3.8,5.1,.26,[{x:xx,bottom:.85,width:2.25,height:2.75}],'junction_brick',walls);obstruction('workshop rear wall',xx,0,3.8,.26,5.1,CY);
    const window=named('career_workshop_railway_window',xx,CY+.85,-.15,walls);window.rotation.y=Math.PI;bx(2.24,2.74,.025,0,1.375,-.21,'junction_glass',window);for(const dx of[-1.16,1.16])bx(.13,2.91,.32,dx,1.375,-.035,'junction_stone',window);for(const yy of[0,2.75])bx(2.48,.14,.36,0,yy,0,'junction_stone',window);for(const dx of[-.38,.38])bx(.055,2.65,.07,dx,1.375,-.10,'junction_cream',window);for(const yy of[.88,1.77])bx(2.20,.055,.07,0,yy,-.10,'junction_cream',window);bx(2.65,.15,.51,0,-.07,.045,'junction_stone',window);bx(2.57,.19,.35,0,2.89,-.015,'junction_copper',window);
   }
   for(const xx of[cx-6,cx-2.22,cx+2.22,cx+6]){bx(.27,5.18,.38,xx,CY+2.59,-.08,'junction_stone',walls);bx(.43,.22,.48,xx,CY+.18,-.12,'junction_stone',walls);}
   for(const xx of[cx-4.1,cx+4.1]){bx(3.8,.16,.35,xx,CY+.49,-.055,'junction_stone',walls);for(let yy=CY+.40;yy<CY+4.6;yy+=low?.70:.42)for(const side of[-1,1])bx(.68,.021,.018,xx+side*1.52,yy,-.141,'junction_brickJoint',walls);}
   bx(12.6,.20,.49,cx,CY+4.96,-.08,'junction_stone',walls);bx(12.75,.10,.62,cx,CY+5.10,-.10,'junction_copper',walls);bx(9.2,.66,.29,cx,CY+4.32,-.19,'junction_navy',walls);northSign('BEACONFIRE WORKS',.35,cx,CY+4.18,-.35,walls);
   for(const z of[1.9,10.1]){bx(.26,4.8,3.8,inner,CY+2.4,z,'junction_brick',walls);obstruction('workshop court wing',inner,z,.26,3.8,4.8,CY);}
   for(const x of[cx-4.13,cx+4.13]){bx(3.74,4.8,.24,x,CY+2.4,12,'junction_brick',walls);obstruction('workshop front wing',x,12,3.74,.24,4.8,CY);arch(x,CY+.80,12.15,2.25,2.7,walls,true,'junction_copper');}
   for(let yy=CY+.35;yy<CY+4.65;yy+=low?.68:.4)for(const x of[cx-4.13,cx+4.13])bx(3.73,.025,.018,x,yy,12.14,'junction_brickJoint',walls);
   for(const x of[cx-6,cx-2.25,cx+2.25,cx+6])bx(.32,5.2,.39,x,CY+2.6,12,'junction_stone',walls);
   bx(12.6,.18,12.7,cx,7.54,6,'junction_steel',roof);for(const x of[cx-3,cx+3]){custom([[x-2.92,7.64,-.25],[x+2.92,7.64,-.25],[x+1.28,8.66,-.25],[x-2.92,7.64,12.3],[x+2.92,7.64,12.3],[x+1.28,8.66,12.3]],[0,3,5,0,5,2,2,5,4,2,4,1,0,2,1,3,4,5],'junction_navy',roof);bx(.08,.92,11.9,x+1.3,8.14,6,'junction_glass',roof);
    custom([[x-2.14,7.76,-.28],[x+1.20,8.47,-.28],[x+2.35,7.76,-.28]],[0,1,2],'junction_glass',roof);for(const [a,c]of[[[x-2.92,7.66,-.31],[x+1.28,8.68,-.31]],[[x+1.28,8.68,-.31],[x+2.92,7.66,-.31]],[[x+1.28,8.68,-.31],[x+1.28,8.68,12.3]]])rod(a,c,.045,'junction_copper',roof,5);for(const [xx,yy]of[[x,8.18],[x+1.2,8.45]])bx(.065,yy-7.77,.06,xx,(yy+7.77)/2,-.315,'junction_cream',roof);
   }
   b(9.2,.66,.26,cx,6.74,12.22,'junction_navy',walls);tx('BEACONFIRE WORKS',.35,cx,6.60,12.365,'junction_cream',walls);
   for(const x of[cx-3.6,cx+3.6])for(const z of[2.15,10]){b(2.25,.13,1.35,x,CY+.90,z,'junction_wood',p);for(const dx of[-.88,.88])bx(.08,.83,.8,x+dx,CY+.42,z,'junction_steel',p);b(.88,.64,.065,x,CY+1.29,z-.25,'junction_steel',p);bx(.77,.51,.021,x,CY+1.29,z-.208,'junction_glass',p);obstruction('workshop desk',x,z,2.3,1.4,1.63,CY);}
   // Tools and a task lamp sit inside the existing northern bench footprint;
   // the open central doorway and its platform ramp remain completely clear.
   bx(.07,.58,1.12,cx+2.53,CY+1.27,2.15,'junction_copper',p);for(let i=0;i<3;i++){const zz=1.78+i*.33;rod([cx+2.48,CY+1.13,zz],[cx+2.48,CY+1.45,zz],.033,'junction_steel',p,5);bx(.10,.065,.16,cx+2.47,CY+1.46,zz,'junction_metal',p);}bx(.38,.21,.32,cx+2.96,CY+1.07,1.76,'junction_steel',p);bx(.52,.07,.40,cx+2.96,CY+1.21,1.76,'junction_metal',p);rod([cx+4.26,CY+.98,1.68],[cx+4.26,CY+1.48,1.68],.035,'junction_steel',p,5);cone(.18,.16,cx+4.26,CY+1.51,1.68,'junction_copper',7,p);sph(.075,cx+4.26,CY+1.43,1.68,'warmWindow',p);
   rod([cx-2.55,CY+3.65,.30],[cx+2.55,CY+3.65,.30],.095,'junction_copper',p,6);for(const side of[-1,1]){rod([cx+side*2.55,CY+1.0,.30],[cx+side*2.55,CY+3.65,.30],.09,'junction_copper',p,6);for(const yy of[CY+1.85,CY+3.05])bx(.29,.11,.21,cx+side*2.55,yy,.30,'junction_steel',p);}
   const rotor=named('anim_rotor',cx-3.6,9.03,2.0,p);cyl(.35,.48,.72,cx-3.6,8.60,2,'junction_copper',12,zero,roof);cyl(.37,.37,.47,cx-3.6,9.13,2,'warmWindow',12,zero,roof);cone(.56,.32,cx-3.6,9.51,2,'junction_navy',10,roof);for(let j=0;j<4;j++)bx(.65,.05,.14,Math.cos(j*Math.PI/2)*.29,0,Math.sin(j*Math.PI/2)*.29,'junction_metal',rotor,[0,-j*Math.PI/2,0]);
   const nodeX=-23.7;for(let i=0;i<3;i++){const z=4.4+i*1.4;b(.85,.87,.73,nodeX,CY+.435,z,'junction_stone',p);const packet=named('anim_packet_'+i,nodeX,CY+1.43,z,p);b(.28,.28,.28,0,0,0,i===1?'junction_teal':'junction_copper',packet);obstruction('workflow console',nodeX,z,.95,.8,1.25,CY);tx(['RETRIEVE','CONTEXT','RESPONSE'][i],.085,nodeX,CY+.56,z+.377,'junction_navy',p);tx('CONCEPT ILLUSTRATION',.044,nodeX,CY+.36,z+.377,'junction_steel',p);}layout.stations.push({id:'beaconfire:pipeline',type:'action',contentId:id,action:id,label:'Run the pipeline',x:-22,z:6,y:CY});
   reader('beaconfire:fullstack',id,-13.955,10.05,CY,Math.PI/2,[-12.05,10.05],['FULL STACK ENGINEER','FEB 2024 - SEP 2024','SERVICES / MESSAGING / AI SEARCH']);
   layout.interiors.push({landmarkId:'software-workshop',floorY:CY,bounds:{x:cx,z:6,width:12,depth:12},entrances:[{id:'workshop-court',x:inner,z:6,width:4.4,yaw:Math.PI/2},{id:'workshop-front',x:cx,z:12,width:4.5,yaw:0}],cutawayGroups:[walls.name,roof.name,arc.name],walkRoute:[[-12,6],[cx,6],[cx,14]]});
  }else{
   const frame=named('occluder_junction_conservatory_frame',0,0,0,p),glass=named('occluder_junction_conservatory_glazing',0,0,0,p);layout.landmarks.push({id:'visionx-conservatory',contentId:id,label:'VisionX Conservatory',x:cx,z:6,width:12,depth:12,nodeGroup:frame.name});
   for(const x of[14.1,26.1])for(const [z,d]of x===14.1?[[1.9,3.8],[10.1,3.8]]:[[6,12]]){bx(.24,.59,d,x,CY+.295,z,'junction_stone',frame);bx(.045,2.47,d-.12,x,CY+1.81,z,'junction_clear',glass);obstruction('conservatory side wall',x,z,.24,d,3.1,CY);}
   for(const[z,open]of[[0,false],[12,true]])for(const[x,w]of open?[[cx-4.2,3.6],[cx+4.2,3.6]]:[[cx,12]]){bx(w,.6,.24,x,CY+.3,z,'junction_stone',frame);bx(w-.12,2.46,.048,x,CY+1.83,z,'junction_clear',glass);obstruction('conservatory end wall',x,z,w,.24,3.1,CY);}
   for(const x of[14.1,26.1])for(const z of[0,2,4,8,10,12])bx(.095,3.15,.12,x,CY+1.575,z,'junction_teal',frame);for(const z of[0,12])for(const x of[14.1,16.1,18.1,22.1,24.1,26.1])bx(.10,3.2,.10,x,CY+1.6,z,'junction_teal',frame);
   canopy('occluder_junction_conservatory_roof',cx,6,12.25,12.4,5.55,2.15,'junction_clear',p);for(const z of[-.08,12.08]){for(let i=0,n=low?14:20;i<n;i++){const a=i*Math.PI/n,c=(i+1)*Math.PI/n;rod([cx+Math.cos(a)*6,5.55+Math.sin(a)*2.15,z],[cx+Math.cos(c)*6,5.55+Math.sin(c)*2.15,z],.07,'junction_teal',frame,6);}}
   b(9.5,.61,.27,cx,5.95,12.25,'junction_teal',frame);tx('VISIONX CONSERVATORY',.315,cx,5.82,12.4,'junction_cream',frame);
   for(const x of[17,23.25])for(const z of[2,10]){b(2.3,.36,1.9,x,CY+.68,z,'junction_wood',p);for(const dx of[-.86,.86])bx(.1,.57,1.25,x+dx,CY+.285,z,'junction_steel',p);obstruction('greenhouse growing bed',x,z,2.35,1.95,1.0,CY);}
   for(let i=0;i<8;i++){const x=(i%2?23.25:17)+(i%4<2?-.48:.48),z=i<4?2:10;const plant=named('anim_plant_'+i,x,CY+1.04,z,p);cyl(.27,.22,.40,x,CY+1.03,z,'junction_copper',low?7:10,zero,p);rod([0,.08,0],[0,1.12,0],.025,'junction_leaf',plant,5);for(let k=0;k<(low?4:6);k++){const a=k*2.25,o=sph(.29,Math.cos(a)*.20,.25+k*.13,Math.sin(a)*.20,i%2?'junction_leaf':'junction_leafLight',plant,[.44,.24,1.2]);o.rotation.set(0,a,-.45);}if(i%3===0)sph(.13,0,1.16,0,'junction_flower',plant);}
   const sx=24.7,sz=6;rod([sx,CY,sz],[sx,CY+1.25,sz],.045,'junction_metal',p,6);const sprinkler=named('anim_sprinkler',sx,CY+1.25,sz,p);rod([-.5,0,0],[.5,0,0],.047,'junction_metal',sprinkler,6);obstruction('irrigation console',sx,sz,.3,.3,1.35,CY);layout.stations.push({id:'visionx:water',type:'action',contentId:id,action:id,label:'Water the garden',x:23.1,z:6,y:CY});
   reader('visionx:plants',id,13.955,10.05,CY,-Math.PI/2,[12.05,10.05],['SOFTWARE ENGINEER INTERN','MAY 2023 - AUG 2023','PLANT RECOMMENDATIONS']);
   layout.interiors.push({landmarkId:'visionx-conservatory',floorY:CY,bounds:{x:cx,z:6,width:12,depth:12},entrances:[{id:'conservatory-court',x:inner,z:6,width:4.4,yaw:-Math.PI/2},{id:'conservatory-front',x:cx,z:12,width:4.8,yaw:0}],cutawayGroups:[frame.name,glass.name,'occluder_junction_conservatory_roof',arc.name],walkRoute:[[cx,14],[cx,6],[12,6]]});
  }
  });
 }


 // Platforms are raised exactly to the coach deck; inclined stone approaches
 // share their visible plane with the production cuboid support contract.
 function platformRamp(id,x,z,width,depth,frontY,backY,rotation=0,guards=true){
  const r={id,x,z,width,depth,frontY,backY,y:(frontY+backY)/2,slope:(frontY-backY)/depth,rotation};layout.ramps.push(r);layout.surfaces.push({...r,width:width+.20,depth:depth+.08});
  const c=Math.cos(rotation),s=Math.sin(rotation),point=(xx,zz,yy)=>[x+xx*c+zz*s,yy,z-xx*s+zz*c],w=width/2+.10,d=depth/2,base=Math.min(frontY,backY)-.18;
  const vs=[point(-w,-d,backY),point(w,-d,backY),point(w,d,frontY),point(-w,d,frontY),point(-w,-d,base),point(w,-d,base),point(w,d,base),point(-w,d,base)];
  custom(vs,[0,2,1,0,3,2,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7],'junction_stone',D.amtrak);if(guards)rampGuards(r);return r;
 }
 const platformRamps={
  harbor:platformRamp('harbor-platform-ramp',7.5,27.1,2.1,5,.85,1.55,-Math.PI/2),
  visionx:platformRamp('visionx-platform-ramp',8.5,8.9,2.1,5,1.55,2.25,-Math.PI/2),
  beaconfire:platformRamp('beaconfire-platform-ramp',-17,-.2,3.2,5,3.65,4.35),
  amtrak:platformRamp('amtrak-platform-ramp',0,-21.75,3.2,2.9,6.4,7.1),
 };
 const rw=layout.railway,path=rw.path,length=rw.length;
 for(const st of rw.stations){
  const p=st.platform,g=named('career_platform_'+st.id),ground=terrain.height(p.x,p.z),base=Math.min(st.groundY,ground),height=p.y-base;
  bx(p.width,height,p.depth,p.x,base+height/2,p.z,'junction_sandstone',g);bx(p.width,.10,p.depth,p.x,p.y-.05,p.z,'junction_stone',g);layout.surfaces.push({id:'platform-'+st.id,...p});
  // The rail-side edge is continuous stone with a contrasting tactile strip.
  const toward=Math.sign(st.door.z-p.z),edge=p.z+toward*(p.depth/2-.12);bx(9.8,.012,.22,p.x,p.y+.006,edge,'junction_copper',g);
  const tag=named('career_platform_label_'+st.id,p.x+4.3,p.y,p.z,g);for(const dx of[-.55,.55])bx(.06,2.6,.06,dx,1.3,0,'junction_steel',tag);b(1.5,.61,.12,0,2.38,0,'junction_navy',tag);tx(st.id==='harbor'?'CAREER LINE':st.id.toUpperCase(),st.id==='beaconfire'?.105:.13,0,2.34,.07,'junction_cream',tag);
  if(st.id==='beaconfire'||st.id==='amtrak')northSign(st.id.toUpperCase(),st.id==='beaconfire'?.105:.13,0,2.34,-.07,tag);
  obstruction('platform sign '+st.id,p.x+4.3,p.z,1.5,.15,2.8,p.y);
  // Open the approach end and boarding edge; guard the remaining exposed end.
  const freeSide=st.id==='harbor'||st.id==='visionx'?-1:0;
  for(const side of[-1,1])if(side!==freeSide)rail('platform end '+st.id,[p.x+side*5.08,p.z-1.05],[p.x+side*5.08,p.z+1.05],p.y,p.y,D.amtrak,base,base);
  st.walkRoute=st.id==='harbor'?[[0,26.5],[5,26.5],[5,27.1],[10,27.1],[st.boarding.x,st.boarding.z]]:st.id==='visionx'?[[12,3.5],[11.5,7.5],[6,7.5],[6,8.9],[11,8.9],[st.boarding.x,st.boarding.z]]:st.id==='beaconfire'?[[-17,5.5],[-17,2.3],[-17,-2.7],[st.boarding.x,st.boarding.z]]:[[0,-19.5],[0,-23.2],[st.boarding.x,st.boarding.z]];
 }
 // An open timber harbor canopy frames the waiting coach without enclosing it.
 for(const x of[17.5,20.5]){bx(.14,3.05,.14,x,3.075,27.18,'junction_woodDark',D.amtrak);obstruction('harbor canopy post',x,27.18,.16,.16,3.05,1.55);}
 bx(3.2,.14,2.0,19,4.60,26.6,'junction_navy',D.amtrak);b(3.35,.12,.20,19,4.70,27.65,'junction_copper',D.amtrak);tx('CAREER LINE',.20,19,4.43,27.77,'junction_cream',D.amtrak);
 // Continuous planted borders mark the retaining walls, with openings for streets.
 for(const [x,z,w,d,y,p] of [[-23.7,12.8,3,.7,3.65,D.beaconfire],[-14,-12.3,3,.65,6.4,D.beaconfire],[9,-11.0,7,.65,3.65,D.amtrak],[20,-12,7,.8,6.4,D.amtrak],[25.9,3.5,.65,5,1.55,D.visionx]])planter(x,z,w,d,y,p,true);
 // Rails, sleepers and ballast are sampled from the very same 3D curve used
 // by the vehicle. The coastal portion sits on a stone arcade above low shore.
 const count=Math.ceil(length/(low?.8:.55)),ballastV=[],ballastI=[];
 const offset=(q,n,y=q.y)=>{const h=Math.hypot(q.tangentX,q.tangentZ);return[q.x-q.tangentZ/h*n,y,q.z+q.tangentX/h*n];};
 for(let i=0;i<=count;i++){const q=sampleTrainPath(path,length*i/count);ballastV.push(offset(q,-1.24,q.y-.075),offset(q,1.24,q.y-.075));if(i<count){const j=i*2;ballastI.push(j,j+1,j+2,j+1,j+3,j+2);}}
 const ballast=custom(ballastV,ballastI,'junction_soil',D.amtrak);ballast.name='career_railway_ballast';
 const supportV=[],supportI=[];for(let i=0;i<count;i++){const a=sampleTrainPath(path,length*i/count),c=sampleTrainPath(path,length*(i+1)/count);if(a.x>30&&a.z>-17&&a.z<15)continue;for(const side of[-1,1]){const aa=offset(a,side*1.24,a.y-.075),cc=offset(c,side*1.24,c.y-.075),baseA=Math.min(aa[1]-.12,terrain.height(aa[0],aa[2])),baseB=Math.min(cc[1]-.12,terrain.height(cc[0],cc[2])),o=supportV.length;supportV.push(aa,cc,[aa[0],baseA,aa[2]],[cc[0],baseB,cc[2]]);supportI.push(o,o+1,o+2,o+1,o+3,o+2,o+2,o+1,o,o+2,o+3,o+1);}}custom(supportV,supportI,'junction_sandstone',D.amtrak);
 for(let d=0;d<length;d+=low?.90:.65){const q=sampleTrainPath(path,d);const sleeper=bx(2.15,.055,.17,q.x,q.y-.055,q.z,'junction_woodDark',D.amtrak,[0,q.yaw,0]);sleeper.rotateX(q.pitch);}
 for(let i=0;i<count;i++){const a=sampleTrainPath(path,length*i/count),c=sampleTrainPath(path,length*(i+1)/count);for(const side of[-1,1])rod(offset(a,side*rw.train.gauge/2,a.y-.025),offset(c,side*rw.train.gauge/2,c.y-.025),.03,'junction_metal',D.amtrak,5);}
 function wrappedGap(a,b){return Math.abs(((a-b+length*1.5)%length)-length/2);}
 // Walking never uses the viaduct underside. Ground-to-track retaining walls
 // and the visible handrails block lateral entry, except at the one crossing.
 for(let d=0,step=2;d<length;d+=step){const end=Math.min(length,d+step),a=sampleTrainPath(path,d),c=sampleTrainPath(path,end),mid=(d+end)/2;
  for(const side of[-1,1]){
   if(rw.crossings.some(k=>wrappedGap(mid,k.distance)<3))continue;
   const platformHere=rw.stations.some(st=>wrappedGap(mid,st.centerDistance)<5.2&&(st.side==='right'?1:-1)===side);
   if(platformHere)continue;
   const aa=offset(a,side*1.40),cc=offset(c,side*1.40),baseA=Math.min(a.y-.08,terrain.height(aa[0],aa[2])),baseB=Math.min(c.y-.08,terrain.height(cc[0],cc[2]));
   rail('rail corridor guard',[aa[0],aa[2]],[cc[0],cc[2]],a.y-.06,c.y-.06,D.amtrak,baseA,baseB,d>rw.stations[3].centerDistance+10);
  }
 }
 // The outside descent reads as a continuous coastal aqueduct, with actual
 // recessed arch openings; its footprint has no pedestrian entry.
 const coast=path.planSegments.find(s=>s.id==='coastal-viaduct');
 const bays=Math.ceil(32.5/(low?5.8:4.8)),coastTop=z=>sampleTrainPath(path,trainDistanceAtPlan(path,coast.start+z+17.5)).y-.13;
 for(let i=0;i<bays;i++){const a=-17.5+32.5*i/bays,c=-17.5+32.5*(i+1)/bays,z=(a+c)/2,ya=coastTop(a),yc=coastTop(c),h=coastTop(z)-.85;
  custom([[30.71,ya,a],[33.29,ya,a],[33.29,yc,c],[30.71,yc,c],[30.71,ya-.27,a],[33.29,ya-.27,a],[33.29,yc-.27,c],[30.71,yc-.27,c]],[0,2,1,0,3,2,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7],'junction_stone',D.amtrak);
  for(const zz of i===0?[a,c]:[c]){const height=Math.max(.3,coastTop(zz)-.85);bx(2.45,height,.65,32,.85+height/2,zz,'junction_sandstone',D.amtrak);}
  if(h>1.7){const ar=named('coastal_viaduct_arch',32,.85,z,D.amtrak);ar.rotation.y=Math.PI/2;arch(0,0,1.3,Math.min(3.45,c-a-.8),Math.min(h,3.5),ar,false);}
 }
 layout.trainTrack={path,railY:null,points:Array.from({length:251},(_,i)=>{const q=sampleTrainPath(path,length*i/250);return[q.x,q.y,q.z];}),protected:true,crossings:rw.crossings};
 const crossing=rw.crossings[0];layout.crossings=[crossing];
 platformRamp('crossing-south-apron',0,-3.95,4.4,.6,3.65,3.75,0,false);platformRamp('crossing-north-apron',0,-8.05,4.4,.6,3.75,3.65,0,false);
 bx(4.4,.10,3.5,0,3.70,-6,'junction_wood',D.amtrak);layout.surfaces.push({id:crossing.id,x:0,z:-6,width:4.4,depth:3.5,y:3.75});
 for(let i=0;i<2;i++){const z=i===0?-4.65:-7.35,pivot=named('anim_career_gate_'+i,-2.35,4.48,z,D.amtrak);bx(4.7,.12,.12,2.35,0,0,'junction_cream',pivot);for(let x=.5;x<4.7;x+=.8)bx(.32,.13,.13,x,0,0,'junction_copper',pivot);pivot.rotation.z=Math.PI/2;bx(.20,1,.20,-2.35,4.15,z,'junction_steel',D.amtrak);obstruction('crossing gate pedestal',-2.35,z,.22,.22,1.05,3.65);const lamp=named('anim_career_crossing_signal_'+i,-2.35,5.12,z,D.amtrak);sph(.12,0,0,0,'orange',lamp);}
 // Company actions retain their identity. The station dispatch is now the
 // physical railway call point, beside the actual coach boarding position.
 b(1.3,.77,.36,-4.15,7.485,-23.75,'junction_navy',D.amtrak);tx('CALL TRAIN',.13,-4.15,7.67,-23.55,'junction_cream',D.amtrak);tx('POSTINGS / BIDS / AWARDS',.048,-4.15,7.42,-23.55,'junction_cream',D.amtrak);tx('CONCEPT ILLUSTRATION',.043,-4.15,7.25,-23.55,'junction_cream',D.amtrak);obstruction('dispatch cabinet',-4.15,-23.75,1.32,.4,.9,7.1);
 northSign('CALL TRAIN',.13,-4.15,7.59,-23.945,D.amtrak);
 layout.stations.push({id:'amtrak:dispatch',type:'action',contentId:'amtrak',action:'career-train',label:'Call train',x:-3.3,z:-24.25,y:7.1});
 const signal=named('anim_signal',4.1,8.6,-24.2,D.amtrak);bx(.25,.65,.15,0,0,0,'junction_navy',signal);sph(.07,0,.12,.1,'orange',signal);
 const order=named('anim_order',0,9.65,-22.3,D.amtrak);b(3.2,.62,.12,0,0,0,'junction_navy',order);tx('CAREER LINE',.2,0,-.05,.08,'junction_cream',order);
 northSign('CAREER LINE',.2,0,-.05,-.08,order);
 // Small gardens and lamps articulate the connected streets without blocking
 // the central stair or the arrival view of the waiting locomotive.
 bench('port-seat','amtrak',-15,24,Y,0);bench('court-west','beaconfire',-5.9,9.8,3.65,Math.PI/2);bench('court-east','visionx',25,6.9,1.55,-Math.PI/2);bench('station-west','amtrak',-23.3,-16.0,6.4,0);bench('station-east','amtrak',17,-15.5,6.4,0);
 tree('quay-west',-18,21,Y,D.beaconfire,3.6);tree('court-west',-6.3,8,3.65,D.beaconfire,3.4);tree('garden-east',25.5,1.2,1.55,D.visionx,3.3);tree('upper-east',20,-18,6.4,D.amtrak,3.2);
 for(const[id,x,z,y,p]of[['quay',-7.3,27,Y,D.amtrak],['court',-8.5,12.6,3.65,D.beaconfire],['garden',25.7,7.8,1.55,D.visionx],['upper',15,-12.6,6.4,D.amtrak]])light(id,x,z,y,p);
 planter(6.7,.4,3.5,1.1,1.55,D.visionx,true);planter(22,-20.5,3,1.1,6.4,D.amtrak,true);
 // A nursery/pergola forms a lower foreground to the conservatory glass vault.
 for(const x of[22.0,24.5])for(const z of[7.9,9.3])bx(.09,2.25,.09,x,2.675,z,'junction_wood',D.visionx);
 for(let x=22;x<=24.5;x+=.45)bx(.08,.10,2.2,x,3.85,8.6,'junction_wood',D.visionx);
 planter(23.25,8.6,2.4,.85,1.55,D.visionx,true);
 layout.interiors[0].entrances.push({id:'station-west',x:-12,z:-19,width:3.4,y:6.4,yaw:-Math.PI/2});
 layout.interiors[1].entrances.push({id:'workshop-platform',x:-17,z:-.5,width:4.4,y:3.65,yaw:Math.PI});
 layout.interiors[1].walkRoute=[[-8.9,5.5],[-17,5.5]];
 layout.interiors[2].walkRoute=[[18,6],[18,3.5],[9.9,3.5]];
 const court=[[0,26.5],[-3.5,26.5],[-3.5,24.5],[-3.5,11.5],[-3.5,5.5],[-8.9,5.5],[-17,5.5],[-8.9,5.5],[-3.5,5.5],[0,5.5],[0,3.5],[2,3.5],[12,3.5],[18,3.5],[18,6],[18,3.5],[12,3.5],[2,3.5],[0,3.5],[0,-3.5],[0,-9.5]];
 const upper=[[0,-9.5],[-22.3,-9.5],[-21.5,-11.4],[-17,-23.2],[-13.8,-23.2],[-13.8,-19],[-12,-19],[-7.5,-19],[-7.5,-19.8],[0,-19.8]];
 const steps=[...terrain.stairs.walkRoute].reverse();
 layout.route=[[0,layout.dock.endZ-2.5],...court,...upper,...layout.interiors[0].walkRoute,[0,-19.55],...steps,[0,-9.5],[0,-3.5],[0,5.5],[-3.5,5.5],[-3.5,11.5],[-3.5,24.5],[-3.5,26.5],[0,26.5],[0,layout.dock.endZ-2.5]];
 layout.paths=[{id:'career-loop',kind:'walk',main:true,width:3.2,points:court},{id:'station-street',kind:'walk',main:true,width:3.2,points:upper.slice(0,-3)},{id:'station-avenue',kind:'stair',main:true,width:6.4,points:terrain.stairs.walkRoute},{id:'harbor-approach',kind:'walk',width:3.2,points:[[0,layout.dock.startZ],[0,26.5]]}];
 layout.pedestrianRoutes={harbor:rw.stations[0].walkRoute,visionx:[[0,5.5],[0,3.5],[2,3.5],...rw.stations[1].walkRoute],beaconfire:[[-3.5,5.5],[-8.9,5.5],...rw.stations[2].walkRoute],amtrak:[[0,-9.5],...terrain.stairs.walkRoute,...rw.stations[3].walkRoute]};
 layout.routeLength=+layout.route.slice(1).reduce((sum,q,i)=>sum+Math.hypot(q[0]-layout.route[i][0],q[1]-layout.route[i][1]),0).toFixed(2);layout.estimatedWalkingSeconds=+(layout.routeLength/2.4).toFixed(1);layout.width=3.2;
 layout.validation={connectedFromDock:true,routeClearance:1.3,pathWidth:3.2,mainPathWidth:3.2,terraces:3,stationsReachable:layout.stations.length,primaryExperienceEntries:3,portDirectoryLinks:3,openInteriors:3,stepFreeRamps:layout.ramps.length,realStairTreads:20,unifiedTerrain:true,railwayLength:length,railwayStations:4};
 const actualCameras={amtrak:{cameraTarget:{x:0,y:10,z:-18},camera:{distance:46,azimuth:Math.PI*1.5-.20,fitBounds:{min:{x:-14.5,y:6.4,z:-28},max:{x:14.5,y:16.5,z:-11.3}}}},beaconfire:{cameraTarget:{x:-17,y:6,z:5},camera:{distance:35,azimuth:Math.PI*1.5+.20,fitBounds:{min:{x:-24,y:3.65,z:-1},max:{x:-6,y:10.9,z:12.7}}}},visionx:{cameraTarget:{x:18,y:4,z:3.5},camera:{distance:33,fitBounds:{min:{x:7.7,y:1.55,z:-1.6},max:{x:26.4,y:7.1,z:11}}}}};
 for(const st of layout.stations)if(actualCameras[st.contentId])Object.assign(st,actualCameras[st.contentId]);
 layout.districts=[['amtrak',0,-18.05],['beaconfire',-17,5.5],['visionx',18,3.5]].map(([id,x,z])=>{const g=D[id];for(const child of g.children){child.position.x-=x;child.position.z-=z;}g.position.set(x,0,z);const a=actualCameras[id];return{id,x,y:0,z,rotation:0,group:g.name,cameraTarget:a.cameraTarget,camera:a.camera};});
 layout.districts[2].animation={sprinkler:{position:[4.6,2.8,0],surfaceY:1.55}};
 return{districts:D};
}
