// V21: Terraced Summit. Original architecture around a straight cable railway.
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
 junction_rock:'#7d8c80',junction_rockDark:'#586e64',junction_rockLight:'#a4b09a',junction_soil:'#735c49',junction_cream:'#f5ead5',junction_teal:'#4a8b87',
 junction_flower:'#caa59c',junction_lawn:'#9aaa72',junction_metal:'#a9b8b6',
};

export function buildExperienceJunction(api){
 const {root,layout,low,Y=.85,box,bevel,cyl,cone,mesh,rod:baseRod,torus,text3D,group,solid,custom}=api;
 const rod=(a,b,r,m,p,segments=7)=>baseRod(a,b,r,m,p,low?Math.min(segments,4):segments);
 const zero=[0,0,0],CY=14.55,SY=21.55;
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
 const terrain=careerTerraces(layout.shore,Y);layout.terrain=terrain.terrain;layout.ramps=terrain.ramps;layout.stairs=terrain.stairways;layout.terraces={quayY:Y,courtY:14.55,gardenY:8.05,stationY:21.55,concourseY:21.55,regions:terrain.regions};
 // Continuous sloped support avoids trimesh seam sweeps while matching the rendered planes.
 layout.surfaces.push(...terrain.ramps.map(r=>({...r,width:r.width+.20,depth:r.depth+(r.slope?.08:0)})),...terrain.stairways.flatMap(s=>s.treads));
 for(const[material,indices]of Object.entries(terrain.materials))custom(terrain.vertices,indices,material,root);
 // Fine stone joints follow the exact shared floor, including graded streets.
 // These 6mm surface details have no collider and stop at gardens, risers and
 // boarding decks. Platforms use the terrain itself as their only floor face.
 {
  const vertices=[],indices=[],half=.011;
  function joint(x0,z0,x1,z1){
   const alongX=Math.abs(x1-x0)>Math.abs(z1-z0),points=alongX?[[x0,z0-half],[x1,z1-half],[x1,z1+half],[x0,z0+half]]:[[x0-half,z0],[x0+half,z0],[x1+half,z1],[x1-half,z1]];
   const xs=points.map(p=>p[0]),zs=points.map(p=>p[1]);
   if(layout.railway.stations.some(({platform:p})=>Math.max(...xs)>=p.x-p.width/2-.03&&Math.min(...xs)<=p.x+p.width/2+.03&&Math.max(...zs)>=p.z-p.depth/2-.03&&Math.min(...zs)<=p.z+p.depth/2+.03))return;
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
  for(let i=0;i<n;i++){const m=point((i+.5)/n),near=railSamples.some(q=>Math.hypot(q.x-m[0],q.z-m[1])<2.2);const platform=layout.railway.stations.some(({platform:p})=>Math.abs(p.y-e.top)<.02&&Math.abs(m[0]-p.x)<p.width/2+.15&&Math.abs(m[1]-p.z)<p.depth/2+.15);if(near||platform)flush(i/n);else if(start===null)start=i/n;}flush(1);
 }
 function rampGuards(r){if(!r.slope)return;const c=Math.cos(r.rotation||0),s=Math.sin(r.rotation||0);for(const side of[-1,1]){const xx=side*(r.width/2+.09),point=zz=>[r.x+xx*c+zz*s,r.z-xx*s+zz*c],inset=r.id==='station-west-street'?1.5:0,back=-r.depth/2+inset,front=r.depth/2-inset-(r.id==='town-valley-street'?.55:0);rail('ramp side '+r.id,point(back),point(front),r.y+r.slope*back,r.y+r.slope*front,D.amtrak,Y,Y);}}
 for(const r of layout.ramps)rampGuards(r);
 for(const st of terrain.stairways)for(const side of[-1,1]){const c=Math.cos(st.rotation||0),s=Math.sin(st.rotation||0),point=z=>[st.x+side*(st.width/2+.09)*c+z*s,st.z-side*(st.width/2+.09)*s+z*c];rail('stair balustrade '+st.id,point(st.depth/2),point(-st.depth/2),st.frontY,st.backY,D.amtrak,Math.min(st.frontY,st.backY),Math.min(st.frontY,st.backY),true);}
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
 // The frontage is custom for this mountain, with an open public hall at each level.
 function roof(x,z,w,d,y,h,p){const v=[[x-w/2,y,z-d/2],[x+w/2,y,z-d/2],[x,y+h,z-d/2],[x-w/2,y,z+d/2],[x+w/2,y,z+d/2],[x,y+h,z+d/2]];custom(v,[0,3,5,0,5,2,2,5,4,2,4,1,0,2,1,3,4,5],'junction_navy',p);for(let i=0,n=low?5:11;i<=n;i++){const zz=z-d/2+d*i/n;rod([x-w/2,y+.035,zz],[x,y+h+.035,zz],.025,'junction_copper',p,5);rod([x,y+h+.035,zz],[x+w/2,y+.035,zz],.025,'junction_copper',p,5);}}
 function wall(name,x,z,w,d,y,h,p,m='junction_sandstone'){bx(w,h,d,x,y+h/2,z,m,p);obstruction(name,x,z,w,d,h,y);}
 function frontWindow(x,z,y,w,h,p,m='junction_stone'){arch(x,y,z,w,h,p,true,m);}
 function dome(name,x,z,rx,rz,y,h,p){const g=named(name,0,0,0,p),v=[],ix=[],n=low?16:28,k=low?7:12;for(let j=0;j<=k;j++){const a=j*Math.PI/(2*k);for(let i=0;i<=n;i++){const t=i*Math.PI*2/n;v.push([x+Math.sin(a)*Math.cos(t)*rx,y+Math.cos(a)*h,z+Math.sin(a)*Math.sin(t)*rz]);}}for(let j=0;j<k;j++)for(let i=0;i<n;i++){const a=j*(n+1)+i,b=a+n+1;ix.push(a,a+1,b,a+1,b+1,b);}custom(v,ix,'junction_glass',g);for(let i=0;i<(low?8:14);i++){const t=i*Math.PI*2/(low?8:14);for(let j=0;j<k;j++){const a=j*Math.PI/(2*k),b=(j+1)*Math.PI/(2*k);rod([x+Math.sin(a)*Math.cos(t)*rx,y+Math.cos(a)*h,z+Math.sin(a)*Math.sin(t)*rz],[x+Math.sin(b)*Math.cos(t)*rx,y+Math.cos(b)*h,z+Math.sin(b)*Math.sin(t)*rz],.095,'junction_stone',g,6);}}for(const a of[.45,.85,1.2,Math.PI/2])for(let i=0;i<n;i++){const t=i*2*Math.PI/n,u=(i+1)*2*Math.PI/n;rod([x+Math.sin(a)*Math.cos(t)*rx,y+Math.cos(a)*h,z+Math.sin(a)*Math.sin(t)*rz],[x+Math.sin(a)*Math.cos(u)*rx,y+Math.cos(a)*h,z+Math.sin(a)*Math.sin(u)*rz],.055,'junction_stone',g,6);}cyl(.14,.18,.45,x,y+h+.18,z,'junction_copper',8,zero,g);}
 {
  const p=D.visionx,y=8.05,frame=named('occluder_junction_conservatory_frame',0,0,0,p),glass=named('occluder_junction_conservatory_glazing',0,0,0,p);
  for(const[x,w]of[[11.55,5.1],[22.45,5.1]]){wall('conservatory front wing',x,16.5,w,.22,y,.65,frame);bx(w-.2,2,.04,x,y+1.68,16.48,'junction_clear',glass);for(const dx of[-w/2,0,w/2])bx(.08,2.9,.15,x+dx,y+1.45,16.5,'junction_teal',frame);}
  wall('conservatory rear wall',17,7.5,16,.24,y,.7,frame);bx(15.8,2.1,.05,17,y+1.75,7.5,'junction_clear',glass);
  for(const x of[9,25])for(const[zz,dd]of[[8.45,1.9],[15.55,1.9]])wall('conservatory side return',x,zz,.22,dd,y,2.9,frame);
  for(const x of[9,25])for(const z of[7.5,9.4,14.6,16.5])bx(.10,3.1,.12,x,y+1.55,z,'junction_teal',frame);
  dome('occluder_junction_conservatory_dome_east',21.1,12,3.8,4.3,y+2.25,4.4,p);dome('occluder_junction_conservatory_dome_west',11.8,12,2.8,3.8,y+2.25,3.1,p);
  canopy('occluder_junction_conservatory_roof',16.3,12,4.5,9, y+2.75,1.65,'junction_glass',p);
  arch(17,y,16.62,4.8,3.7,frame,false,'junction_teal');b(6.1,.65,.22,17,y+4.15,16.7,'junction_teal',frame);tx('VISIONX',.46,17,y+4.02,16.84,'junction_cream',frame);
  let plantIndex=0;for(const[x,z]of[[11,9.5],[23,9.5],[11,14.3],[23,14.3]]){planter(x,z,2.2,1.25,y,p,true);for(let i=0;i<3;i++){const plant=named('anim_plant_'+plantIndex++,x-.6+i*.6,y+.6,z,p);rod([0,0,0],[0,1.7,0],.03,'junction_leaf',plant);for(let k=0;k<4;k++)sph(.28,Math.sin(k*2)*.24,.5+k*.28,Math.cos(k*2)*.2,'junction_leafLight',plant,[.4,.3,1]);}}
  const sprinkler=named('anim_sprinkler',23.4,y+1.4,12,p);rod([-.55,0,0],[.55,0,0],.045,'junction_metal',sprinkler);rod([23.4,y,12],[23.4,y+1.4,12],.045,'junction_metal',p);obstruction('irrigation console',23.4,12,.3,.3,1.5,y);
  layout.stations.push({id:'visionx:water',type:'action',contentId:'visionx',action:'visionx',label:'Water the garden',x:21.8,z:12,y});
  layout.landmarks.push({id:'visionx-conservatory',contentId:'visionx',label:'VisionX Conservatory',x:17,z:12,width:16,depth:9,nodeGroup:frame.name});
  layout.interiors.push({landmarkId:'visionx-conservatory',floorY:y,bounds:{x:17,z:12,width:16,depth:9},entrances:[{id:'conservatory-front',x:17,z:16.5,y,width:4.8,yaw:0},{id:'conservatory-west',x:9,z:12,y,width:5.2,yaw:-Math.PI/2}],cutawayGroups:[frame.name,glass.name,'occluder_junction_conservatory_roof','occluder_junction_conservatory_dome_east','occluder_junction_conservatory_dome_west'],walkRoute:[[17,18.1],[17,16.5],[17,12],[9,12],[7,12]]});
 }
 {
  const p=D.beaconfire,y=14.55,walls=named('occluder_junction_workshop_walls',0,0,0,p),roofGroup=named('occluder_junction_workshop_roof',0,0,0,p),arc=named('occluder_junction_beaconfire_arcade',0,0,0,p);
  for(const z of[-5,5])for(const[x,w]of[[-20.6,6.8],[-9.4,6.8]]){wall('workshop portal wing',x,z,w,.28,y,7,walls,'junction_brick');for(const xx of[x-1.7,x+1.7]){frontWindow(xx,z+(z>0?.17:-.17),y+.7,2.5,3.1,walls,'junction_copper');frontWindow(xx,z+(z>0?.18:-.18),y+4.5,2.4,2.1,walls,'junction_stone');}}
  for(const x of[-24,-6])for(const[z,d]of[[-3.6,2.8],[3.6,2.8]])wall('workshop side return',x,z,.28,d,y,7,walls,'junction_brick');
  for(const z of[-5,5]){bx(18.5,.22,.6,-15,y+4.15,z,'junction_stone',walls);bx(18.6,.25,.55,-15,y+7.0,z,'junction_stone',walls);}
  for(const x of[-24,-20.3,-9.7,-6]){bx(.28,3.6,.28,x,y+1.8,7.3,'junction_stone',arc);b(.5,.18,.5,x,y+.09,7.3,'junction_stone',arc);obstruction('workshop arcade column',x,7.3,.32,.32,3.8,y);}
  bx(18.8,.25,2.8,-15,y+3.8,6.25,'junction_stone',arc);for(const x of[-22,-18.5,-11.5,-8])arch(x,y,7.45,3.2,3.6,arc,false);
  for(const x of[-20,-10])roof(x,0,9.7,10.8,y+7.1,1.45,roofGroup);
  for(const[x,z]of[[-22,-2.8],[-8,-2.8],[-17,2]]){wall('workshop chimney',x,z,.75,.8,y+7.1,2.9,roofGroup,'junction_brick');bx(1,.19,1,x,y+10,z,'junction_copper',roofGroup);}
  b(8.8,.9,.3,-15,y+5.4,5.2,'junction_navy',walls);tx('BEACONFIRE',.50,-15,y+5.17,5.38,'junction_cream',walls);tx('AUTOMATION WORKSHOP',.13,-15,y+4.9,5.39,'junction_cream',walls);
  for(const[x,z]of[[-21,-2],[-9,-2],[-21,2],[-9,2]]){b(2.4,.16,1.2,x,y+.85,z,'junction_wood',p);for(const dx of[-.9,.9])bx(.1,.8,.7,x+dx,y+.4,z,'junction_steel',p);obstruction('workshop desk',x,z,2.5,1.3,1.5,y);b(.9,.55,.08,x,y+1.18,z-.2,'junction_navy',p);}
  for(let i=0;i<3;i++){const packet=named('anim_packet_'+i,-19+i*1.15,y+1.2,0,p);b(.3,.3,.3,0,0,0,'junction_copper',packet);}const rotor=named('anim_rotor',-8,y+10.1,-2.8,p);for(let i=0;i<4;i++)bx(.75,.06,.18,Math.cos(i*Math.PI/2)*.3,0,Math.sin(i*Math.PI/2)*.3,'junction_copper',rotor,[0,-i*Math.PI/2,0]);
  layout.stations.push({id:'beaconfire:pipeline',type:'action',contentId:'beaconfire',action:'beaconfire',label:'Run the pipeline',x:-17,z:0,y});
  layout.landmarks.push({id:'software-workshop',contentId:'beaconfire',label:'BeaconFire Works',x:-15,z:0,width:18,depth:10,nodeGroup:walls.name});
  layout.interiors.push({landmarkId:'software-workshop',floorY:y,bounds:{x:-15,z:0,width:18,depth:10},entrances:[{id:'workshop-front',x:-15,z:5,y,width:4.4,yaw:0},{id:'workshop-east',x:-6,z:0,y,width:4.4,yaw:Math.PI/2},{id:'workshop-rear',x:-15,z:-5,y,width:4.4,yaw:Math.PI}],cutawayGroups:[walls.name,roofGroup.name,arc.name],walkRoute:[[-15,8],[-15,5],[-15,0],[-6,0],[-15,0],[-15,-5],[-15,-7]]});
 }
 {
  const p=D.amtrak,y=21.55,walls=named('occluder_junction_terminal_walls',0,0,0,p),rg=named('occluder_junction_terminal_roof',0,0,0,p);
  for(const z of[-17,-25])for(const[x,w]of[[-6.2,3.6],[10.2,11.6]]){wall('terminal portal wing',x,z,w,.3,y,6.8,walls);for(let xx=x-w/2+1.5;xx<x+w/2-1;xx+=3.1)frontWindow(xx,z+(z===-17?.19:-.19),y+.7,2.2,4.6,walls);}
  for(const x of[-8,16])for(const[z,d]of[[-24,2],[-18,2]])wall('terminal side return',x,z,.3,d,y,6.8,walls);
  arch(0,y,-16.8,7.2,6.2,walls,false);arch(0,y+3.3,-17.02,6.1,3.2,walls,true,'junction_copper');
  for(const z of[-17,-25]){bx(24.6,.3,.7,4,y+6.75,z,'junction_stone',walls);bx(24.9,.16,.8,4,y+7,z,'junction_copper',walls);}
  roof(-6,-21,4.8,8.8,y+7,1.1,rg);roof(10,-21,12.5,8.8,y+7,1.8,rg);canopy('occluder_junction_terminal_vault',0,-21,8.2,8.7,y+6.5,2.3,'junction_navy',p);
  b(8.4,.9,.35,0,y+7.6,-16.75,'junction_navy',walls);tx('AMTRAK',.62,0,y+7.36,-16.53,'junction_cream',walls);tx('SUMMIT STATION',.18,0,y+7.03,-16.51,'junction_cream',walls);
  const tower=named('occluder_junction_clocktower',0,0,0,p);b(3.5,5.8,3.0,12,y+8.2,-19,'junction_sandstone',tower);for(const xx of[10.4,13.6])bx(.21,6.1,3.2,xx,y+8.2,-19,'junction_stone',tower);for(const yy of[y+5.4,y+9.3,y+11.2])bx(3.9,.22,3.5,12,yy,-19,'junction_stone',tower);roof(12,-19,4.2,3.7,y+11.3,1.05,tower);
  cyl(1.18,1.18,.10,12,y+9.5,-17.43,'junction_cream',low?24:36,[Math.PI/2,0,0],tower);torus(1.23,.065,12,y+9.5,-17.35,'junction_copper',zero,6,low?24:40,tower);for(let i=0;i<12;i++){const a=i*Math.PI/6;bx(.05,.16,.03,12+Math.sin(a)*.96,y+9.5+Math.cos(a)*.96,-17.30,'junction_navy',tower,[0,0,-a]);}rod([12,y+9.5,-17.25],[12.55,y+9.8,-17.25],.04,'junction_navy',tower);rod([12,y+9.5,-17.24],[11.85,y+10.23,-17.24],.035,'junction_navy',tower);
  for(const x of[-2.8,9.5])bench('summit-wait-'+x,'amtrak',x,-23.3,y,0);
  const signal=named('anim_signal',14,y+2,-23,p);sph(.10,0,0,0,'orange',signal);const order=named('anim_order',6,y+3.4,-24.6,p);b(4,.6,.1,0,0,0,'junction_navy',order);tx('ARRIVALS / DEPARTURES',.16,0,-.04,.07,'junction_cream',order);
  layout.landmarks.push({id:'career-station',contentId:'amtrak',label:'Amtrak Summit',x:4,z:-21,width:24,depth:8,nodeGroup:walls.name});
  layout.interiors.push({landmarkId:'career-station',floorY:y,bounds:{x:4,z:-21,width:24,depth:8},entrances:[{id:'station-front',x:0,z:-17,y,width:7.2,yaw:0},{id:'station-east',x:16,z:-21,y,width:4,yaw:Math.PI/2},{id:'station-west',x:-8,z:-21,y,width:4,yaw:-Math.PI/2}],cutawayGroups:[walls.name,rg.name,'occluder_junction_terminal_vault'],walkRoute:[[17.5,-21],[16,-21],[4,-21],[0,-19],[0,-16],[-5,-16],[-5,-14]]});
 }
 // Interlocking, blunt fractured masses create a broad ridge, not isolated spires.
 const decorativeRockMeshes=[];
 function rock(id,x,z,w,d,y,h,collision=true){const g=named('occluder_summit_rock_'+id),geometry=new THREE.IcosahedronGeometry(1,low?0:1),position=geometry.attributes.position;for(let i=0;i<position.count;i++){const xx=position.getX(i),yy=position.getY(i),zz=position.getZ(i),noise=1+.13*Math.sin(xx*11+yy*7+zz*17);position.setXYZ(i,xx*w*.5*noise,y+(yy+1)*h*.5,zz*d*.5*(1+.08*Math.sin(yy*13+xx*9)));}geometry.computeVertexNormals();decorativeRockMeshes.push(mesh(geometry,'junction_rock',[x,0,z],zero,g));if(collision)obstruction('summit rock '+id,x,z,w*.64,d*.64,h,y);}
 for(const[id,x,z,w,d,y,h]of[['ridge-root',-19,-24,20,13,15,17],['west-ledge',-25,-23,12,11,11,16],['main-peak',-17,-26,13,10,28,13.5],['peak-left',-24,-25,10,9,24,11],['peak-right',-10,-28,11,5.5,24,12],['rear-ridge',-3,-28.5,9,4.8,21.5,8],['west-coast',-33,2,8,22,.5,11],['east-coast',33,-4,7,25,.4,13]])rock(id,x,z,w,d,y,h);
 // Lower rock shelves break the terrain silhouette below short white retaining bands.
 for(const[i,x,z,w,d,y,h]of[[0,10,-6,10,8,9,10],[1,19,-5,10,9,8.5,11],[2,23,-8,8,8,11,9],[3,5,-2,5,7,7,8],[4,-17,12.3,13,7,3,9],[5,-8,9,8,6,4,8],[6,22,21,7,5,1.4,5],[7,30,12,6,8,3,6]])rock('terrace-'+i,x,z,w,d,i<6?terrain.height(x,z)-h*.52:y,h,false);
 for(const[x,z,y,w,h,d]of[[7,-8,16,5,5,4],[12,-8,15,6,5.5,5],[18,-9,17,5,4.5,5],[24,-11,17,6,5,5],[9,-1,9,6,4,6],[17,0,8.5,7,5,5],[24,-1,10,6,4.7,6],[-23,12,7,5,5,5],[-18,12,4,6,6,5],[-13,12,6,5,4.5,5],[-8,10,8,4,4,4],[28,17,5,4,4,5]])rock('fissure-'+x+'-'+z,x,z,w,d,x===28?y:terrain.height(x,z)-h*.52,h,false);
 // Root plants on the visible rock relief, including the newly exposed blocks.
 const decorationRay=new THREE.Raycaster();for(const m of decorativeRockMeshes)m.updateWorldMatrix(true,false);
 const decorationHeight=(x,z)=>{decorationRay.set(new THREE.Vector3(x,60,z),new THREE.Vector3(0,-1,0));const hit=decorationRay.intersectObjects(decorativeRockMeshes,false)[0];return Math.max(terrain.height(x,z),hit?.point.y??-Infinity);};
 for(const[x,z,y]of[[7,-5,12],[12,-7,15],[20,-8,17],[25,-9,16],[-23,10,10],[-17,10.5,11],[-13.8,11.8,12],[24.8,0,8],[17.5,1,7.5]])for(const[dx,dz,h]of[[-.8,.1,2.8],[.6,.2,3.6],[0,-.6,3.1]]){const rootY=decorationHeight(x+dx,z+dz);rod([x+dx,rootY,z+dz],[x+dx,rootY+h,z+dz],.055,'junction_woodDark',D.amtrak);for(const[k,r]of[[.35,.7],[.6,.55],[.82,.32]])cone(r,h*.58,x+dx,rootY+h*k,z+dz,'junction_leaf',low?6:9,D.amtrak);sph(.55,x+dx,rootY+.25,z+dz,'junction_leafLight',D.amtrak,[1.3,.5,.8]);}
 // Short arcaded cornices belong to the terrace edge; the mountain remains exposed.
 for(const[x,z,y,w]of[[-17,9.8,12.85,21],[19,21.7,6.35,13],[14,-11.7,19.85,17]])for(let dx=-w/2+1.4;dx<w/2;dx+=2.8)arch(x+dx,y,z,2.2,1.55,D.amtrak,false,'junction_stone');
 // Hanging foliage follows masonry joints and planted rock fissures.
 for(const[x,z,y]of[[-24,9.7,14.45],[-18,10.6,14.45],[-10,9.4,14.45],[10,-9.7,21.45],[19,-11,21.45],[25,-13,21.45],[11,18.7,7.95],[25,21.5,7.95]])for(let i=0;i<5;i++)sph(.42,x+Math.sin(i*2)*.23,y-i*.55,z+.18,'junction_leaf',D.amtrak,[.9,1.45,.5]);
 for(const[x,z,y,h]of[[-29,-15,16,4.5],[-23,-23,26,5],[-20,-28,30,4.5],[-14,-28,33,4],[-8,-28,27,4.5],[-29,-8,13,5],[-31,4,7,4],[8,-5,13,4.5],[15,-7,15,5],[23,-7,14,4.2],[31.5,-13,18,4.5],[31,9,9,3.5],[25,21,8.05,3]]){const rootY=decorationHeight(x,z),treeHeight=Math.min(h,(42.5-rootY)/1.1);rod([x,rootY,z],[x,rootY+treeHeight,z],.09,'junction_woodDark',D.amtrak);for(const[k,r]of[[.32,1.05],[.58,.85],[.8,.55]])cone(r,treeHeight*.6,x,rootY+treeHeight*k,z,'junction_leaf',low?7:10,D.amtrak);}
 const rw=layout.railway,path=rw.path,length=rw.length,parts=Math.ceil(length/.35);
 // Inclined sleepers, paired rails, and a central haul cable share the exact physical curve.
 for(let d=0;d<=length;d+=low?.75:.52){const q=sampleTrainPath(path,d),o=bx(2.18,.09,.17,q.x,q.y-.075,q.z,'junction_woodDark',D.amtrak);o.rotation.x=q.pitch;}
 for(let i=0;i<parts;i++){const a=sampleTrainPath(path,length*i/parts),c=sampleTrainPath(path,length*(i+1)/parts);for(const x of[-.81,.81])rod([x,a.y-.028,a.z],[x,c.y-.028,c.z],.032,'junction_metal',D.amtrak,6);rod([0,a.y-.045,a.z],[0,c.y-.045,c.z],.024,'junction_steel',D.amtrak,5);}
 // The unified terrain already fills every boarding deck at exactly p.y.
 // Keep its precise support surface, without a second coplanar rendered slab.
 for(const st of rw.stations){const p=st.platform,g=named('career_platform_'+st.id);layout.surfaces.push({id:'platform-'+st.id,...p});const side=Math.sign(p.x),lampX=p.x+side*(p.width/2-.2);bx(.16,.013,5.5,side*1.44,p.y+.008,p.z,'junction_copper',g);for(const dz of[-2.55,2.55]){bx(.08,2.25,.08,lampX,p.y+1.125,p.z+dz,'junction_steel',g);obstruction('station lamp '+st.id,lampX,p.z+dz,.10,.10,2.4,p.y);b(.34,.35,.34,lampX,p.y+2.32,p.z+dz,'sunsetLantern',g);}const tag=named('career_platform_label_'+st.id,lampX,p.y+2.7,p.z-2.55,g);b(2.35,.5,.14,0,0,0,'junction_navy',tag);tx(st.label.toUpperCase(),st.id==='beaconfire'?.13:.16,0,-.06,.09,'junction_cream',tag);}
 for(let i=0;i<parts;i++){const a=sampleTrainPath(path,length*i/parts),c=sampleTrainPath(path,length*(i+1)/parts),z=(a.z+c.z)/2;for(const side of[-1,1]){if(rw.stations.some(st=>Math.sign(st.platform.x)===side&&Math.abs(z-st.platform.z)<2.9))continue;const x=side*1.43,ay=Math.max(a.y+.02,terrain.height(x,a.z)),cy=Math.max(c.y+.02,terrain.height(x,c.z));rail('funicular corridor',[x,a.z],[x,c.z],ay,cy,D.amtrak,Math.min(a.y-.2,ay),Math.min(c.y-.2,cy));}}
 for(const q of[path.from,path.to]){bx(2.65,.32,.22,0,q[1]+.28,q[2],'junction_woodDark',D.amtrak);obstruction('funicular buffer',0,q[2],2.8,.35,1.1,q[1]-.2);}
 layout.trainTrack={path,railY:null,points:Array.from({length:81},(_,i)=>{const q=sampleTrainPath(path,length*i/80);return[q.x,q.y,q.z];}),protected:true,crossings:[]};
 // A small off-axis lower station leaves the ascending carriage visible from the quay.
 {const p=D.amtrak,y=3.85,g=named('occluder_summit_lower_station',0,0,0,p);for(const x of[-9.4,-3.6])wall('lower station side',x,22,.25,4,y,3.3,g);wall('lower station rear',-6.5,20,6,.25,y,3.3,g);for(const x of[-8.55,-4.45])wall('lower station front',x,24,1.8,.25,y,3.3,g);arch(-6.5,y,24.15,2.4,2.9,g,false);roof(-6.5,22,7,5,y+3.35,1.7,g);tx('SUMMIT LINE',.27,-6.5,y+3.6,24.55,'junction_cream',g);}
 reader('visionx:plants','visionx',7,15.8,8.05,0,[7,16.7],['SOFTWARE ENGINEER INTERN','MAY 2023 - AUG 2023','PLANT RECOMMENDATIONS']);
 reader('beaconfire:fullstack','beaconfire',-10,7.8,14.55,0,[-10,8.5],['FULL STACK ENGINEER','FEB 2024 - SEP 2024','SERVICES / MESSAGING / AI SEARCH']);
 reader('amtrak:experience','amtrak',8,-15.5,21.55,0,[8,-14.3],['FULL STACK ENGINEER','NOV 2024 - PRESENT','WORKFORCE SYSTEMS']);
 layout.stations.push({id:'amtrak:dispatch',type:'action',contentId:'amtrak',action:'career-train',label:'Board funicular',x:-3.4,z:-12,y:21.55});
 {const g=named('station_experience:directory',-4,.85,26.9,D.amtrak);b(4.8,2.55,.25,0,1.6,0,'junction_stone',g);tx('TERRACED SUMMIT',.27,0,2.65,.15,'junction_navy',g);for(const[i,id]of['visionx','beaconfire','amtrak'].entries()){const yy=2.13-i*.63,row=named('station_'+id+':directory',0,yy,0,g);bx(4.4,.54,.025,0,0,.15,'junction_navy',row);tx(`0${i+1} ${id.toUpperCase()}`,.23,0,-.06,.18,'junction_cream',row);layout.stations.push({id:id+':directory',type:'read',contentId:id,label:id,directory:true,primary:false,readFull:true,readLabel:'View experience',x:-4,z:28.1,y:.85,hitArea:{x:-4,y:.85+yy,z:27.08,width:4.4,height:.54,yaw:0}});}layout.stations.push({id:'experience:directory',type:'read',contentId:'experience',label:'Terraced Summit',readLabel:'Experience overview',readFull:true,directoryOverview:true,x:-4,z:28.1,y:.85});obstruction('port directory',-4,26.9,4.8,.3,3,.85);}
 bench('garden-rest','visionx',24,21.5,8.05,0);bench('workshop-rest','beaconfire',-20,8.3,14.55,0);bench('port-rest','amtrak',10,24.85,3.85,-Math.PI/2);
 for(const[id,x,z,y,h]of[['garden',26,5,8.05,4],['garden-west',6,6,8.05,3.5],['workshop',-22,-9,14.55,4],['summit-east',22,-23,21.55,5],['summit-west',-16,-22,21.55,5],['quay',16,26,.85,4]])tree(id,x,z,y,D.amtrak,h);
 for(const[x,z,y]of[[7,7,8.05],[23,17.8,8.05],[-22,8.4,14.55],[-7,7.5,14.55],[13,-14.7,21.55],[20,-19,21.55]])planter(x,z,2.5,.7,y,D.amtrak,true);
 // Tall slender evergreen groups echo the concept without hiding the three nameplates.
 for(const[x,z,y,h]of[[-18,-23,21.55,5],[-15,-24,21.55,6],[17,-24,21.55,5],[20,-22,21.55,6],[24,-18,21.55,4.5],[27,8,8.05,4],[-25,7,14.55,4]]){rod([x,y,z],[x,y+h,z],.075,'junction_woodDark',D.amtrak);for(const[k,r]of[[.35,.8],[.6,.65],[.8,.4]])cone(r,h*.55,x,y+h*k,z,'junction_leaf',low?7:10,D.amtrak);}
 const tr=terrain.routes,arrival=[[0,35.5],[0,27.5],[6.1,27.5]],harbor=[...arrival,...tr.harborRight,[6.1,18.5],[2.1,18.5],[2.1,22],[2.7,22]],garden=[[2.7,22],[2.1,22],[2.1,18.5],[6.1,18.5],[8.5,18.5],[8.5,22],...tr.garden,[20.8,22],[20.8,18],[17,18],[17,12],[9,12],[7,12],[17,12]],east=[[17,12],[17,18],[20.8,18],[20.8,22],[22,22],[22,22.7],[26,22.7],[26,22],[28,22],...tr.east,[28,-20],[20,-20],[17.5,-21],[16,-21],[4,-21],[0,-19],[0,-16],[-5,-16],[-5,-14]],westTop=[[-5,-14],[-5,-15],...tr.summit.slice().reverse(),[-27,-15],[-27,-12.3]],beacon=[[-27,-12.3],[-24.3,-12.3],[-24.3,-7],[-15,-7],[-15,0],[-15,5],[-15,8],[-15,0],[-6,0],[-2.7,1.446327684]],westDown=[[-15,-7],[-24.3,-7],[-24.3,-12.3],[-27,-12.3],...tr.west.slice().reverse(),[-27,23],[-15,23],[-15,18.5],[-12,18.5],...tr.harborLeft.slice().reverse(),[-12,27.5],[0,27.5],[0,35.5]];
 rw.stations[0].walkRoute=harbor;rw.stations[1].walkRoute=[...harbor,...garden,[7,12],[5,12],[2.7,13.93220339]];rw.stations[2].walkRoute=[[0,35.5],[0,27.5],[-12,27.5],...tr.harborLeft,[-12,18.5],[-15,18.5],[-15,23],[-27,23],...tr.west,[-27,-12.3],...beacon];rw.stations[3].walkRoute=[...rw.stations[1].walkRoute,[5,12],[17,12],...east,[-2.7,-12]];
 layout.paths=[{id:'harbor-approach',kind:'bridge',main:true,width:2.8,points:[[0,35.5],[0,29.2]]},{id:'garden-approach',kind:'walk',main:false,width:3.2,points:garden},{id:'summit-east-route',kind:'stair',main:false,width:3.2,points:east},{id:'summit-west-route',kind:'stair',main:false,width:3.2,points:westTop}];
 layout.pedestrianRoutes={harbor,visionx:rw.stations[1].walkRoute,beaconfire:rw.stations[2].walkRoute,amtrak:rw.stations[3].walkRoute};layout.route=[...harbor,...garden,...east,...westTop,...beacon,...beacon.slice().reverse(),...westDown];
 for(const interior of layout.interiors)interior.walkRouteHeights=interior.walkRoute.map(([x,z])=>terrain.height(x,z));
 layout.routeLength=+layout.route.slice(1).reduce((s,p,i)=>s+Math.hypot(p[0]-layout.route[i][0],p[1]-layout.route[i][1]),0).toFixed(2);layout.estimatedWalkingSeconds=+(layout.routeLength/2.4).toFixed(1);layout.width=3.4;
 layout.overviewBounds={min:[-34,.43,-30],max:[34,43,38]};layout.overviewCamera={elevation:28*Math.PI/180,azimuthOffset:.18};
 const views={visionx:{cameraTarget:{x:17,y:11,z:12},camera:{distance:38,azimuth:Math.PI/2+.10,fitBounds:{min:{x:1,y:6,z:3},max:{x:30,y:16,z:23}}}},beaconfire:{cameraTarget:{x:-15,y:19,z:0},camera:{distance:42,azimuth:Math.PI/2-.10,fitBounds:{min:{x:-30,y:12,z:-10},max:{x:-1,y:25,z:11}}}},amtrak:{cameraTarget:{x:4,y:27,z:-20},camera:{distance:44,azimuth:Math.PI/2,fitBounds:{min:{x:-10,y:20,z:-26},max:{x:19,y:34,z:-9}}}}};
 for(const q of layout.stations)if(views[q.contentId])Object.assign(q,views[q.contentId]);
 layout.districts=[['amtrak',4,-21],['beaconfire',-15,0],['visionx',17,12]].map(([id,x,z])=>{const g=D[id];for(const child of g.children){child.position.x-=x;child.position.z-=z;}g.position.set(x,0,z);return{id,x,y:0,z,rotation:0,group:g.name,...views[id]};});layout.districts[2].animation={sprinkler:{position:[6.4,9.45,0],surfaceY:8.05}};
 layout.validation={connectedFromDock:true,routeClearance:1.3,pathWidth:3.4,mainPathWidth:3.4,terraces:3,stationsReachable:layout.stations.length,primaryExperienceEntries:3,portDirectoryLinks:3,openInteriors:3,stepFreeRamps:0,realStairTreads:terrain.stairways.reduce((s,t)=>s+t.stepCount,0),unifiedTerrain:true,railwayLength:length,railwayStations:4,railwayCrossings:0};return{districts:D};
}
