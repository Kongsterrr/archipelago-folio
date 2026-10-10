// V18: one terraced coastal town, with shared civic space and a rear railway.
import * as THREE from 'three';
import {careerTerraces} from './career-terraces.mjs';
import {sampleTrainPath,trainPathLength} from '../../sources/core/train-path.js';

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
 const tx=(s,size,x,y,z,m='junction_steel',p=D.amtrak)=>text3D(s,size,x,y,z,m,.006,p);
 const named=(n,x=0,y=0,z=0,p=D.amtrak)=>{const g=group([x,y,z],zero,p);g.name=n;return g;};
 const obstruction=(name,x,z,width,depth,height=2,y=Y,rotation=0)=>solid(x,z,width,depth,height,y,rotation,name);
 const sph=(r,x,y,z,m='junction_leaf',p=D.amtrak,scale=[1,1,1])=>{const o=mesh(new THREE.SphereGeometry(r,low?6:9,low?4:6),m,[x,y,z],zero,p);o.scale.set(...scale);return o;};
 layout.landmarks=[];layout.interiors=[];layout.paths=[];layout.crossings=[];layout.crossing=null;
 const terrain=careerTerraces(layout.shore,Y);layout.terrain=terrain.terrain;layout.ramps=terrain.ramps;layout.stairs=[terrain.stairs];layout.terraces={quayY:Y,courtY:CY,stationY:SY,regions:terrain.regions};
 // Continuous sloped support avoids trimesh seam sweeps while matching the rendered planes.
 layout.surfaces.push(...terrain.ramps,...terrain.stairs.treads,terrain.stairs.landing);
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
  const rowDepth=low?2.4:1.8,tileWidth=low?3.2:2.4;
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
 for(const e of terrain.edges){const a=e.a.map((v,i)=>v+e.outward[i]*.09),b=e.b.map((v,i)=>v+e.outward[i]*.09);rail('town retaining edge',a,b,e.top,e.top,D.amtrak,e.bottom,e.bottom,true);}
 for(const r of layout.ramps)for(const side of[-1,1]){const x=r.x+side*(r.width/2+.09),a=[x,r.z-r.depth/2],c=[x,r.z+r.depth/2];rail('ramp side '+r.id,a,c,r.backY,r.frontY,D.amtrak,Y,Y);}
 for(const side of[-1,1]){
  const x=side*3.73;rail('grand stair lower balustrade',[x,7.7],[x,3.28],CY,4.168,D.amtrak,CY,CY,true);rail('grand stair landing balustrade',[x,3.28],[x,1.88],4.168,4.168,D.amtrak,CY,CY,true);rail('grand stair upper balustrade',[x,1.88],[x,-2.2],4.168,SY,D.amtrak,CY,CY,true);
 }
 function arch(x,y,z,w,h,p,glass=true,material='junction_stone'){
  const stem=h-w/2,shape=new THREE.Shape();shape.moveTo(-w/2,0);shape.lineTo(w/2,0);shape.lineTo(w/2,stem);shape.absarc(0,stem,w/2,0,Math.PI,false);shape.closePath();if(glass)mesh(new THREE.ShapeGeometry(shape,low?7:12),'junction_glass',[x,y,z],zero,p);
  for(const dx of[-w/2,w/2])bx(.13,stem,.18,x+dx,y+stem/2,z+.035,material,p);
  for(let i=0,n=low?9:14;i<n;i++){const a=i*Math.PI/n,c=(i+1)*Math.PI/n;rod([x+Math.cos(a)*w/2,y+stem+Math.sin(a)*w/2,z+.05],[x+Math.cos(c)*w/2,y+stem+Math.sin(c)*w/2,z+.05],.10,material,p,6);}
  if(glass){bx(.065,h-.12,.06,x,y+h/2-.06,z+.06,material,p);bx(w,.055,.06,x,y+stem*.62,z+.06,material,p);b(w+.28,.13,.30,x,y-.055,z+.055,material,p);}
 }
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
  const x=-6.4,z=23.4,g=named('station_experience:directory',x,Y,z,D.amtrak);b(5.25,2.72,.27,0,1.62,0,'junction_stone',g);b(5.45,.16,.54,0,3.05,0,'junction_navy',g);for(const dx of[-2.13,2.13])bx(.13,1,.16,dx,.5,0,'junction_steel',g);tx('CAREER QUARTER',.31,0,2.76,.15,'junction_navy',g);
  for(const[i,id]of['amtrak','beaconfire','visionx'].entries()){const row=named('station_'+id+':directory',0,0,0,g),yy=2.22-i*.68,color={amtrak:'junction_navy',beaconfire:'junction_copper',visionx:'junction_teal'}[id];bx(4.86,.58,.026,0,yy,.151,color,row);tx((i+1)+'  '+(id==='beaconfire'?'BEACONFIRE':id.toUpperCase()),.225,-.45,yy-.06,.169,'junction_cream',row);tx('VIEW',.13,1.98,yy-.05,.169,'junction_cream',row);layout.stations.push({id:id+':directory',type:'read',contentId:id,label:id==='beaconfire'?'BeaconFire':id==='amtrak'?'Amtrak':'VisionX',directory:true,primary:false,readFull:true,readLabel:'View experience',x:x+(i-1)*.04,z:25.35,y:Y,...cameras[id],hitArea:{x,y:Y+yy,z:z+.18,width:4.9,height:.6,yaw:0}});}
  obstruction('port career directory',x,z,5.25,.35,3.2,Y);layout.stations.push({id:'experience:directory',type:'read',contentId:'experience',label:'Career Quarter directory',directoryOverview:true,readFull:true,readLabel:'Explore experience',x,z:25.35,y:Y});
 }
 // Grand terminal: deep stone reveals, lower tiled wings and a clock fronton.
 {
  const p=D.amtrak,walls=named('occluder_junction_terminal_walls',0,0,0,p),roof=named('occluder_junction_terminal_roof',0,0,0,p),front=-6,back=-14.1,cz=-10.05;
  layout.landmarks.push({id:'career-station',contentId:'amtrak',label:'Amtrak Central',x:0,z:cz,width:24,depth:8.1,nodeGroup:walls.name});
  for(const xx of[-11.86,11.86]){bx(.28,5.0,8.1,xx,SY+2.5,cz,'junction_sandstone',walls);obstruction('terminal side wall',xx,cz,.28,8.1,5,SY);}
  for(const zz of[front,back])for(const sign of[-1,1]){const xx=sign*7.68;bx(8.64,5,.24,xx,SY+2.5,zz,'junction_sandstone',walls);obstruction('terminal portal wing',xx,zz,8.64,.24,5,SY);}
  for(const zz of[front+.02,back-.02]){arch(0,SY,zz,6.5,4.78,walls,false);for(const xx of[-9.5,-5.7,5.7,9.5])arch(xx,SY+.83,zz+.12,2.18,3.15,walls,true);bx(24.45,.22,.4,0,SY+4.75,zz,'junction_stone',walls);}
  for(let yy=SY+.5;yy<SY+4.5;yy+=low?.72:.43)for(const side of[-1,1])bx(8.62,.018,.018,side*7.68,yy,front+.129,'junction_joint',walls);
  for(const xx of[-11.9,-3.38,3.38,11.9]){bx(.36,5.23,.52,xx,SY+2.615,front,'junction_stone',walls);b(.52,.20,.65,xx,SY+.16,front,'junction_stone',walls);}
  for(const sign of[-1,1]){const x=sign*7.7;custom([[x-4.55,10.92,-14.5],[x+4.55,10.92,-14.5],[x,11.8,-14.5],[x-4.55,10.92,-5.65],[x+4.55,10.92,-5.65],[x,11.8,-5.65]],[0,3,5,0,5,2,2,5,4,2,4,1,0,2,1,3,4,5],'junction_navy',roof);for(let k=0;k<=(low?5:10);k++){const z=-14.25+k*(low?1.66:.83);rod([x-4.3,11.02,z],[x,11.88,z],.022,'junction_copper',roof,5);rod([x,11.88,z],[x+4.3,11.02,z],.022,'junction_copper',roof,5);}}
  canopy('occluder_junction_terminal_vault',0,cz,6.5,8.8,10.85,1.2,'junction_navy',p);
  b(10.4,.63,.30,0,10.97,front+.22,'junction_navy',walls);tx('AMTRAK CENTRAL',.40,0,10.83,front+.382,'junction_cream',walls);
  b(3.5,3.65,1.6,0,13.525,-7.2,'junction_sandstone',roof);b(3.82,.20,1.93,0,15.45,-7.2,'junction_stone',roof);b(3.12,.22,1.60,0,15.69,-7.2,'junction_navy',roof);
  cyl(1.05,1.05,.10,0,13.97,-6.34,'junction_cream',low?22:32,[Math.PI/2,0,0],roof);torus(1.10,.068,0,13.97,-6.26,'junction_copper',zero,6,low?24:36,roof);
  for(let i=0;i<12;i++){const a=i*Math.PI/6;bx(.048,i%3===0?.18:.10,.022,Math.sin(a)*.88,13.97+Math.cos(a)*.88,-6.245,'junction_navy',roof,[0,0,-a]);}rod([0,13.97,-6.21],[.51,14.25,-6.21],.035,'junction_navy',roof,7);rod([0,13.97,-6.21],[-.21,14.62,-6.21],.025,'junction_navy',roof,6);
  for(const side of[-1,1]){bench('station-wait-'+side,'amtrak',side*7.5,-10.2,SY,0);b(1.15,.64,.52,side*9.3,SY+.32,-12.8,'junction_woodDark',p);obstruction('station luggage',side*9.3,-12.8,1.2,.6,.8,SY);}
  reader('amtrak:experience','amtrak',-7.6,-5.255,SY,0,[-7.6,-3.75],['FULL STACK ENGINEER','NOV 2024 - PRESENT','WORKFORCE SYSTEMS'],.75);
  layout.interiors.push({landmarkId:'career-station',floorY:SY,bounds:{x:0,z:cz,width:24,depth:8.1},entrances:[{id:'station-front',x:0,z:front,width:6.5,yaw:0},{id:'station-rear',x:0,z:back,width:6.5,yaw:Math.PI}],cutawayGroups:[walls.name,roof.name,'occluder_junction_terminal_vault'],walkRoute:[[0,-4.2],[0,-10.05],[0,-16.1]]});
 }
 // The two lower wings open into the same arcaded court, sharing a floor datum.
 for(const[id,cx]of[['beaconfire',-20.1],['visionx',20.1]]){
  const p=D[id],side=Math.sign(cx),arc=named('occluder_junction_'+id+'_arcade',0,0,0,p),inner=side*14.1,columns=side*10.1;
  bx(4.5,.24,13.3,side*12.15,5.52,6.3,'junction_stone',arc);bx(4.67,.10,13.45,side*12.15,5.70,6.3,'junction_copper',arc);
  for(const z of[.25,3,8.3,12.8]){bx(.19,3.03,.19,columns,CY+1.515,z,'junction_stone',arc);b(.36,.16,.36,columns,CY+.08,z,'junction_stone',arc);b(.39,.20,.39,columns,5.28,z,'junction_stone',arc);obstruction('court arcade pier',columns,z,.23,.23,3.1,CY);}
  // Recessed wall bays make the taller station bank part of the town architecture.
  for(const x of[side*8,side*17,side*23]){const niche=named('town_bank_niche_'+id+'_'+x,x,CY,-2.14,p);arch(0,0,0,2.3,2.9,niche,true,'junction_stone');}
  if(id==='beaconfire'){
   const walls=named('occluder_junction_workshop_walls',0,0,0,p),roof=named('occluder_junction_workshop_roof',0,0,0,p);layout.landmarks.push({id:'software-workshop',contentId:id,label:'BeaconFire Works',x:cx,z:6,width:12,depth:12,nodeGroup:walls.name});
   bx(.26,5.1,12,-26.1,CY+2.55,6,'junction_brick',walls);obstruction('workshop outer wall',-26.1,6,.26,12,5.1,CY);bx(12,5.1,.26,cx,CY+2.55,0,'junction_brick',walls);obstruction('workshop rear wall',cx,0,12,.26,5.1,CY);
   for(const z of[1.9,10.1]){bx(.26,4.8,3.8,inner,CY+2.4,z,'junction_brick',walls);obstruction('workshop court wing',inner,z,.26,3.8,4.8,CY);}
   for(const x of[cx-4.13,cx+4.13]){bx(3.74,4.8,.24,x,CY+2.4,12,'junction_brick',walls);obstruction('workshop front wing',x,12,3.74,.24,4.8,CY);arch(x,CY+.80,12.15,2.25,2.7,walls,true,'junction_copper');}
   for(let yy=CY+.35;yy<CY+4.65;yy+=low?.68:.4)for(const x of[cx-4.13,cx+4.13])bx(3.73,.025,.018,x,yy,12.14,'junction_brickJoint',walls);
   for(const x of[cx-6,cx-2.25,cx+2.25,cx+6])bx(.32,5.2,.39,x,CY+2.6,12,'junction_stone',walls);
   bx(12.6,.18,12.7,cx,7.54,6,'junction_steel',roof);for(const x of[cx-3,cx+3]){custom([[x-2.92,7.64,-.25],[x+2.92,7.64,-.25],[x+1.28,8.66,-.25],[x-2.92,7.64,12.3],[x+2.92,7.64,12.3],[x+1.28,8.66,12.3]],[0,3,5,0,5,2,2,5,4,2,4,1,0,2,1,3,4,5],'junction_navy',roof);bx(.08,.92,11.9,x+1.3,8.14,6,'junction_glass',roof);}
   b(9.2,.66,.26,cx,6.74,12.22,'junction_navy',walls);tx('BEACONFIRE WORKS',.35,cx,6.60,12.365,'junction_cream',walls);
   for(const x of[cx-3.6,cx+3.6])for(const z of[2.15,10]){b(2.25,.13,1.35,x,CY+.90,z,'junction_wood',p);for(const dx of[-.88,.88])bx(.08,.83,.8,x+dx,CY+.42,z,'junction_steel',p);b(.88,.64,.065,x,CY+1.29,z-.25,'junction_steel',p);bx(.77,.51,.021,x,CY+1.29,z-.208,'junction_glass',p);obstruction('workshop desk',x,z,2.3,1.4,1.63,CY);}
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
 }
 // A railway behind the station, separated from its entrance and passenger gallery.
 const path={type:'racetrack',center:[0,SY,-21.8],halfStraight:16,radius:2.7},length=trainPathLength(path);
 for(let distance=0;distance<length;distance+=low?.76:.58){const q=sampleTrainPath(path,distance);bx(1.28,.045,.18,q.x,SY+.024,q.z,'junction_woodDark',D.amtrak,[0,q.yaw,0]);}
 for(const side of[-1,1])for(let distance=0,n=Math.ceil(length/(low?.42:.28)),i=0;i<n;i++){const a=sampleTrainPath(path,length*i/n),c=sampleTrainPath(path,length*(i+1)/n),offset=.43*side;rod([a.x-a.tangentZ*offset,SY+.07,a.z+a.tangentX*offset],[c.x-c.tangentZ*offset,SY+.07,c.z+c.tangentX*offset],.03,'junction_metal',D.amtrak,6);}
 rail('rear railway gallery fence',[-20,-17.95],[20,-17.95],SY,SY,D.amtrak,SY,SY);
 const signal=named('anim_signal',-11.3,SY+2.1,-18.1,D.amtrak);bx(.35,.83,.22,0,0,0,'junction_navy',signal);for(const yy of[-.21,.21])cyl(.10,.10,.028,0,yy,.14,yy>0?'orange':'yellow',10,[Math.PI/2,0,0],signal);rod([-11.3,SY,-18.1],[-11.3,SY+2.3,-18.1],.046,'junction_navy',D.amtrak,6);obstruction('rail signal',-11.3,-18.1,.4,.3,2.6,SY);
 const order=named('anim_order',7.7,SY+1.75,-17.75,D.amtrak);b(3.5,.95,.16,0,0,0,'junction_navy',order);tx('DEPARTURES',.17,0,.17,.1,'junction_cream',order);tx('JACK CENTRAL',.15,0,-.15,.1,'junction_cream',order);
 b(1.4,.73,.4,10,SY+.365,-18,'junction_stone',D.amtrak);tx('DISPATCH',.14,10,SY+.93,-17.78,'junction_navy',D.amtrak);obstruction('dispatch cabinet',10,-18,1.45,.4,1.2,SY);tx('POSTINGS / BIDS / AWARDS',.060,10,SY+.48,-17.788,'junction_navy',D.amtrak);tx('CONCEPT ILLUSTRATION',.053,10,SY+.27,-17.788,'junction_steel',D.amtrak);layout.stations.push({id:'amtrak:dispatch',type:'action',contentId:'amtrak',action:'amtrak',label:'Dispatch train',x:10,z:-16.15,y:SY});
 function trainCar(name,distance,engine){const q=sampleTrainPath(path,distance),g=named(name,q.x,SY,q.z,D.amtrak);g.rotation.y=q.yaw;const len=engine?2.4:2.05;b(engine?1.22:1.18,.80,len,0,.76,0,engine?'junction_navy':'junction_cream',g);b(1.30,.16,len+.08,0,1.22,0,engine?'junction_cream':'junction_navy',g);bx(1.23,.15,len+.02,0,.39,0,engine?'orange':'junction_copper',g);for(const x of engine?[-.63,.63]:[-.62,.62])for(const z of[-.66,.66]){cyl(.22,.22,.13,x,.25,z,'junction_steel',10,[0,0,Math.PI/2],g);bx(.024,.38,.60,x,.94,z,'junction_glass',g);}if(engine){b(1.13,.40,.05,0,1.02,-1.22,'junction_glass',g);for(const x of[-.37,.37])sph(.085,x,.60,-1.29,'warmWindow',g);}return g;}
 trainCar('anim_train_engine',0,true);trainCar('anim_train_car_1',-3.2,false);
 layout.trainTrack={path,center:[0,SY,-21.8],railY:SY+.07,points:Array.from({length:129},(_,i)=>{const q=sampleTrainPath(path,length*i/128);return[q.x,SY,q.z];}),protected:true,gallery:{x:0,z:-16.1,width:32,depth:3.4,y:SY},crossings:[]};
 // Furniture belongs to the edges of rooms and courts, never the clear streets.
 bench('port-seat','amtrak',6.8,24.3,Y,0);bench('court-west','beaconfire',-7.4,13.9,CY,Math.PI/2);bench('court-east','visionx',7.4,13.9,CY,-Math.PI/2);bench('station-west','amtrak',-20,-6.7,SY,0);bench('station-east','amtrak',20,-6.7,SY,0);
 for(const[x,z,y,id,p,h]of[[-8,4.8,CY,'court-west',D.beaconfire,4],[8,4.8,CY,'court-east',D.visionx,4],[-24,-13,SY,'upper-west',D.amtrak,3.9],[24,-13,SY,'upper-east',D.amtrak,3.9],[-14,22,Y,'quay-west',D.beaconfire,3.6],[14,22,Y,'quay-east',D.visionx,3.6]])tree(id,x,z,y,p,h);
 for(const[id,x,z,y,p]of[['quay-west',-3.6,26,Y,D.amtrak],['quay-east',3.6,26,Y,D.amtrak],['court-west',-9.2,14.7,CY,D.beaconfire],['court-east',9.2,14.7,CY,D.visionx],['upper-west',-17,-8,SY,D.amtrak],['upper-east',17,-8,SY,D.amtrak]])light(id,x,z,y,p);
 planter(-18.5,-9.2,3.1,1.2,SY,D.amtrak,true);planter(18.5,-9.2,3.1,1.2,SY,D.amtrak,true);planter(-24.4,12.9,2.0,.85,CY,D.beaconfire,true);planter(24.4,12.9,2.0,.85,CY,D.visionx,true);
 const loop=[[0,25.8],[0,24.5],[0,12.5],[0,10.5],[-12,10.5],[-12,6],[-20.1,6],[-20.1,14],[-24,19.8],[-28.1,19.8],[-28.1,17.8],[-28.1,-2.2],[-28.1,-4.2],[-14.2,-4.2],[0,-4.2],[0,-10.05],[0,-16.1],[14.2,-16.1],[14.2,-4.2],[28.1,-4.2],[28.1,-2.2],[28.1,17.8],[28.1,19.8],[24,19.8],[20.1,14],[20.1,6],[12,6],[12,10.5],[0,10.5],[0,12.5],[0,24.5],[0,25.8]];
 layout.route=[[0,layout.dock.endZ-2.5],...loop,[0,layout.dock.endZ-2.5]];
 layout.paths=[{id:'career-loop',kind:'walk',main:true,width:3.2,points:loop},{id:'station-avenue',kind:'stair',main:false,width:7.2,points:[[0,10.5],[0,7.7],[0,3.28],[0,1.88],[0,-2.2],[0,-4.2]]},{id:'harbor-approach',kind:'walk',width:3.2,points:[[0,layout.dock.startZ],[0,25.8]]}];
 layout.routeLength=+layout.route.slice(1).reduce((sum,q,i)=>sum+Math.hypot(q[0]-layout.route[i][0],q[1]-layout.route[i][1]),0).toFixed(2);layout.estimatedWalkingSeconds=+(layout.routeLength/2.4).toFixed(1);layout.width=3.2;
 layout.validation={connectedFromDock:true,routeClearance:1.3,pathWidth:3.2,mainPathWidth:3.2,terraces:2,stationsReachable:layout.stations.length,primaryExperienceEntries:3,portDirectoryLinks:3,openInteriors:3,stepFreeRamps:3,realStairTreads:25,unifiedTerrain:true};
 const specs=[['amtrak',0,-10.05],['beaconfire',-20.1,6],['visionx',20.1,6]];
 layout.districts=specs.map(([id,x,z])=>{const g=D[id];for(const child of g.children){child.position.x-=x;child.position.z-=z;}g.position.set(x,0,z);return{id,x,y:0,z,rotation:0,group:g.name,...cameras[id]};});
 const ad=layout.districts[0];ad.animation={train:{path:{...path,center:[0,SY,-11.75]},speed:2,rootY:SY,surfaceY:SY,forward:'-Z',duration:length/2,cars:[{name:'anim_train_engine',offset:0,halfLength:1.4,halfWidth:.71},{name:'anim_train_car_1',offset:3.2,halfLength:1.2,halfWidth:.69}]}};
 layout.districts[2].animation={sprinkler:{position:[4.6,CY+1.25,0],surfaceY:CY}};
 return{districts:D};
}
