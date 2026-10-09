// V16 coastal-drive estate. All dimensions and colliders are in
// island-local coordinates; upper floors are scenic, never walk surfaces.
import * as THREE from 'three';
import {ESTATE_DRIVE,ESTATE_PARKING,ESTATE_WALK_PATHS,estateDriveRoute,estatePavingContours} from './coastal-drive.mjs';

export const estatePalette = {
 estate_stone:'#e3ddce',estate_stoneJoint:'#b4ab9b',estate_wood:'#b08d69',
 estate_woodDark:'#755b46',estate_frame:'#43565e',estate_glass:'#76969f',
 estate_clear:'#bdd5d9',estate_cushion:'#f0e6d3',estate_rug:'#9eaca5',
 estate_asphalt:'#85878a',estate_roadShoulder:'#cbc5b5',estate_paving:'#c5bfaf',estate_court:'#467b7c',estate_courtOuter:'#718e7d',
 estate_white:'#efe8d8',estate_green:'#74a46e',estate_fairway:'#8bae72',
 estate_rough:'#63875b',estate_sand:'#dfcc9f',estate_leaf:'#567457',
 estate_flower:'#c69b97',estate_navy:'#314c5e',estate_copper:'#aa8464',
};

export function buildAboutEstate(api) {
 const {root,layout,low,Y=.85,box,bevel,cyl,cone,mesh,rod,torus,text3D,group,solid,slatBench,lamp,books,harborPath}=api;
 const zero=[0,0,0];
 // Move an authored section at build time, with all model roots and spatial
 // metadata together. The produced GLB and layout contain final coordinates;
 // runtime actions never need an extra transform or a scaled collision shape.
 function section(dx,dz,build){
  const before=new Set();root.traverse(o=>before.add(o));
  const arrays=['surfaces','obstacles','stations','benches','landmarks','interiors'];
  const counts=Object.fromEntries(arrays.map(k=>[k,layout[k]?.length||0]));
  const previousSports=new Set(Object.keys(layout.sports||{}));build();
  const added=[];root.traverse(o=>{if(!before.has(o)&&before.has(o.parent))added.push(o);});
  for(const o of added){o.position.x+=dx;o.position.z+=dz;}
  const seen=new Set();
  function translate(item){
   if(!item||typeof item!=='object'||seen.has(item))return;seen.add(item);
   if(Array.isArray(item)){if(item.length===2&&item.every(Number.isFinite)){item[0]+=dx;item[1]+=dz;}else item.forEach(translate);return;}
   for(const key of ['x','minX','maxX','xMin','xMax'])if(Number.isFinite(item[key]))item[key]+=dx;
   for(const key of ['z','minZ','maxZ','zMin','zMax'])if(Number.isFinite(item[key]))item[key]+=dz;
   if(item.targets?.every(Number.isFinite))item.targets=item.targets.map(x=>x+dx);
   for(const value of Object.values(item))translate(value);
  }
  for(const key of arrays)layout[key]?.slice(counts[key]).forEach(translate);
  for(const key of Object.keys(layout.sports||{}))if(!previousSports.has(key))translate(layout.sports[key]);
 }

 const harbor=group();harbor.name='district_harbor';
 const connect=group();connect.name='district_connect';
 layout.districts=[{id:'harbor',x:0,z:0,rotation:0,group:'district_harbor'},{id:'connect',x:0,z:0,rotation:0,group:'district_connect'}];
 layout.landmarks=[];layout.interiors=[];layout.sports={};layout.garageBays=[];
 const b=(w,h,d,x,y,z,mat='estate_stone',parent=harbor,rot=zero)=>bevel(w,h,d,x,y,z,mat,.035,rot,parent);
 const bx=(w,h,d,x,y,z,mat='estate_stone',parent=harbor,rot=zero)=>box(w,h,d,x,y,z,mat,rot,parent);
 const tx=(s,size,x,y,z,mat='estate_frame',parent=harbor)=>text3D(s,size,x,y,z,mat,.006,parent);
 const named=(name,x=0,y=0,z=0,parent=harbor)=>{const g=group([x,y,z],zero,parent);g.name=name;return g;};
 const obstruction=(name,x,z,w,d,h=2.8,y=Y)=>solid(x,z,w,d,h,y,0,name);
 const landmark=(id,label,x,z,width,depth)=>layout.landmarks.push({id,label,x,z,width,depth});
 const floor=(x,z,w,d,mat='estate_paving')=>{bx(w,.04,d,x,Y+.005,z,mat);layout.surfaces.push({x,z,width:w,depth:d,y:Y+.025});};
 const sphere=(r,x,y,z,mat='estate_leaf',parent=harbor,scale=[1,1,1])=>{const m=mesh(new THREE.SphereGeometry(r,low?7:10,low?4:7),mat,[x,y,z],zero,parent);m.scale.set(...scale);return m;};
 function plant(x,z,w=1.6,d=.72,parent=harbor,block=true){
  b(w,.34,d,x,Y+.17,z,'estate_stone',parent);bx(w-.12,.035,d-.12,x,Y+.355,z,'estate_woodDark',parent);
  for(let i=0;i<(low?3:5);i++){const xx=x-w*.36+i*w*.72/((low?3:5)-1);sphere(.28,xx,Y+.55,z,'estate_leaf',parent,[1,.72,.9]);if(!low&&i%2===0)sphere(.105,xx,Y+.72,z+.04,'estate_flower',parent);}
  if(block)obstruction('estate planter',x,z,w,d,.78);
 }
 function tree(id,x,z,h=4.5){
  rod([x,Y,z],[x,Y+h*.74,z],.13,'estate_woodDark',harbor,7);const canopy=named('occluder_estate_tree_'+id);
  for(const[dx,dz,s]of[[-.48,.1,1],[.4,.16,.9],[0,-.43,.82]]){rod([x,Y+h*.4,z],[x+dx,Y+h*.78,z+dz],.055,'estate_woodDark',harbor,6);sphere(1.32,x+dx,Y+h*.77,z+dz,'estate_leaf',canopy,[s,.84*s,.85*s]);}
  obstruction('estate tree '+id,x,z,.38,.38,h);
 }
 function light(x,z){
  b(.32,.13,.32,x,Y+.065,z,'estate_stone');bx(.075,1.24,.075,x,Y+.74,z,'estate_frame');b(.30,.08,.27,x,Y+1.4,z,'estate_frame');bx(.20,.10,.17,x,Y+1.33,z,'warmWindow');obstruction('estate garden light',x,z,.32,.32,1.5);
 }
 function bench(id,x,z,yaw=0){
  slatBench(x,z,yaw);obstruction('estate seat '+id,x,z,2.0,.76,1.22);
  const s={id,contentId:'harbor',action:'harbor',x,z,y:Y+.56,yaw,rotation:yaw,approach:{x:x+Math.sin(yaw)*1.3,z:z+Math.cos(yaw)*1.3,y:Y}};
  layout.benches.push(s);layout.bench??=s;
 }
 function wall(id,x,z,w,d,h=3,mat='estate_stone',parent=harbor){bx(w,h,d,x,Y+h/2,z,mat,parent);obstruction(id,x,z,w,d,h);}
 function glassWall(id,x,z,w,d,parent){
  wall(id,x,z,w,d,2.8,'estate_clear',parent);
  bx(w+.07,.13,d+.07,x,Y+.07,z,'estate_frame',parent);bx(w+.07,.14,d+.07,x,Y+2.86,z,'estate_frame',parent);
  if(w>d)for(let i=0;i<=Math.round(w/1.4);i++)bx(.055,2.8,d+.05,x-w/2+i*w/Math.round(w/1.4),Y+1.43,z,'estate_frame',parent);
  else for(let i=0;i<=Math.round(d/1.4);i++)bx(w+.05,2.8,.055,x,Y+1.43,z-d/2+i*d/Math.round(d/1.4),'estate_frame',parent);
 }
 function desktop(x,z,w=2.5,d=.85,parent=harbor){
  b(w,.12,d,x,Y+.84,z,'estate_wood',parent);for(const dx of[-w*.4,w*.4])for(const dz of[-d*.34,d*.34])bx(.09,.80,.09,x+dx,Y+.40,z+dz,'estate_frame',parent);obstruction('estate table',x,z,w,d,1);
 }
 function sign(id,label,sub,x,z,contentId='harbor',parent=harbor){
  const g=named('station_'+id,0,0,0,parent),bz=z-1.6,w=3.25;
  for(const dx of[-1.25,1.25])b(.10,1.65,.16,x+dx,Y+.825,bz,'estate_frame',g);
  b(w,1.53,.22,x,Y+1.19,bz,'estate_stone',g);b(w+.1,.13,.30,x,Y+1.99,bz,'estate_wood',g);
  tx(label,.26,x,Y+1.55,bz+.125,'estate_navy',g);tx(sub,.112,x,Y+1.20,bz+.125,'estate_frame',g);
  bx(w-.34,.34,.027,x,Y+.83,bz+.126,'estate_navy',g);tx('READ MORE',.15,x,Y+.76,bz+.15,'estate_white',g);
  obstruction(label+' display',x,bz,w,.30,2.05);
  layout.stations.push({id,type:'read',contentId,label,primary:true,readFull:true,readLabel:'Read more',x,z,y:Y,cameraTarget:{x:-4,y:2.8,z:-14},camera:{distance:28},hitArea:{x,y:Y+1.23,z:bz+.145,width:w,height:1.55,yaw:0}});
 }
 // House detail is retained as one translated construction section.
 section(0,-8,()=>{
 floor(-4,-8,20,14,'estate_wood');floor(-4,-16.7,21,3.4);
 for(let x=-13.4;x<6;x+=.66)bx(.016,.008,13.82,x,Y+.030,-8,'estate_woodDark');
 if(!low)for(let z=-14.5;z<-.7;z+=2.4)for(let x=-12.8;x<6;x+=2.64)bx(.45,.006,.015,x,Y+.034,z,'estate_woodDark');
 landmark('jack-house',"Jack's House",-4,-8,20,14);
 // House: light stone piers and actual door gaps enclose the single traversable
 // ground floor. The living wing is low; the study wing carries a stepped top.
 const houseWalls=named('occluder_estate_house_walls'),houseRoof=named('occluder_estate_house_roof'),houseUpper=named('occluder_estate_house_upper'),houseGlazing=named('occluder_estate_house_glazing');
 wall('house west wall',-13.84,-8,.32,13.7,3.0,'estate_stone',houseWalls);
 wall('house east stone pier',5.84,-12,.32,5.7,3,'estate_stone',houseWalls);
 glassWall('house east glazing',5.84,-5.1,.16,7.8,houseGlazing);
 glassWall('house front west glass',-9.83,-1.13,7.7,.15,houseGlazing);
 glassWall('house front east glass',1.83,-1.13,7.7,.15,houseGlazing);
 glassWall('house rear west glass',-9.83,-14.87,7.7,.15,houseGlazing);
 glassWall('house rear east glass',1.83,-14.87,7.7,.15,houseGlazing);
 for(const z of[-1.1,-14.9])for(const x of[-5.73,-2.27]){b(.18,3.05,.25,x,Y+1.525,z,'estate_frame',houseWalls);obstruction('house door jamb',x,z,.18,.25,3.05);}
 // Flush thresholds and a long canopy identify the entrance without stairs.
 bx(3.24,.024,.45,-4,Y+.037,-1.1,'estate_stone');bx(3.24,.024,.45,-4,Y+.037,-14.9,'estate_stone');
 b(20.5,.34,14.45,-4,Y+3.22,-8,'estate_stone',houseRoof);
 bx(20.25,.075,14.25,-4,Y+3.005,-8,'estate_wood',houseRoof);
 b(8.0,.23,2.9,-3,Y+3.22,-.25,'estate_stone',houseRoof);
 for(const x of[-6.8,.8])bx(1.6,.025,.075,x,Y+3.064,1.06,'warmWindow',houseRoof);
 const upperX=-.5,upperZ=-9.1;
 b(12.6,2.75,8.9,upperX,Y+4.79,upperZ,'estate_stone',houseUpper);
 bx(11.7,2.10,.10,upperX,Y+4.79,-4.60,'estate_glass',houseUpper);
 for(let i=0;i<9;i++)bx(.065,2.22,.14,-6.26+i*1.44,Y+4.83,-4.52,'estate_frame',houseUpper);
 bx(12.05,.15,.17,upperX,Y+3.73,-4.49,'estate_frame',houseUpper);
 for(let i=0;i<(low?5:9);i++){const x=-6.16+i*(low?2.78:1.39);bx(.24,2.50,.25,x,Y+4.79,-4.34,'estate_wood',houseUpper);}
 b(13.1,.25,9.4,upperX,Y+6.29,upperZ,'estate_stone',houseUpper);bx(12.9,.10,9.2,upperX,Y+6.11,upperZ,'estate_frame',houseUpper);
 // Upper terrace over the low living wing: visible glass rails, no walk surface.
 bx(6.45,.12,11.7,-10.55,Y+3.48,-8,'estate_paving',houseUpper);
 for(const z of[-13.75,-2.25]){bx(6.35,.72,.06,-10.5,Y+3.90,z,'estate_clear',houseUpper);rod([-13.65,Y+4.28,z],[-7.35,Y+4.28,z],.045,'estate_frame',houseUpper,6);}
 bx(.06,.72,11.55,-13.66,Y+3.9,-8,'estate_clear',houseUpper);rod([-13.66,Y+4.28,-13.78],[-13.66,Y+4.28,-2.22],.045,'estate_frame',houseUpper,6);
 for(const z of[-12.7,-10.9]){b(2.1,.30,.67,-11.4,Y+3.65,z,'estate_cushion',houseUpper);b(.5,.36,.67,-12.15,Y+3.94,z,'estate_cushion',houseUpper);}
 // Recessed rain channels, fascia and wall joinery distinguish the material roles.
 for(const x of[-13.60,5.60])bx(.12,2.96,.12,x,Y+1.5,-14.62,'estate_copper',houseWalls);
 for(let i=0;i<(low?9:19);i++)bx(.15,2.8,.075,-13.4+i*(low?.57:.27),Y+1.5,-1.01,'estate_wood',houseWalls);
 b(4.15,.31,.08,-3,Y+3.22,1.235,'estate_navy',houseWalls);tx("JACK'S HOUSE",.23,-3,Y+3.13,1.286,'estate_white',houseWalls);
 for(const x of[-5.98,-2.02]){rod([x,Y+.93,-1],[x,Y+1.37,-1],.033,'estate_copper',houseWalls,6);}
 layout.interiors.push({landmarkId:'jack-house',floorY:Y,bounds:{x:-4,z:-8,width:20,depth:14},entrances:[{id:'front',x:-4,z:-1,width:3.24,yaw:0},{id:'rear',x:-4,z:-15,width:3.24,yaw:Math.PI}],cutawayGroups:['occluder_estate_house_roof','occluder_estate_house_upper','occluder_estate_house_walls','occluder_estate_house_glazing'],walkRoute:[[-4,2],[-4,-3],[-4,-12],[-4,-17]],rooms:[{id:'entry',x:-4,z:-3.2},{id:'living',x:-10,z:-6.3},{id:'study',x:2,z:-8}]});
 // Living room, a soft L sofa and low furnishings outside the axial through-way.
 b(4.1,.41,1.05,-10.6,Y+.33,-11.6,'estate_cushion');b(4.1,.76,.22,-10.6,Y+.8,-12.03,'estate_cushion');
 b(1.05,.41,2.5,-12.15,Y+.33,-10.75,'estate_cushion');b(.23,.72,2.5,-12.6,Y+.78,-10.75,'estate_cushion');
 obstruction('living sofa back',-10.6,-11.6,4.2,1.2,1.15);obstruction('living sofa side',-12.15,-10.3,1.15,2.8,1.15);
 for(const x of[-11.8,-10.65,-9.5])b(.78,.36,.24,x,Y+.94,-11.74,'estate_rug',harbor,[.08,0,0]);
 b(2.5,.16,1.3,-10.2,Y+.40,-8.75,'estate_wood');for(const dx of[-.92,.92])for(const dz of[-.42,.42])bx(.07,.34,.07,-10.2+dx,Y+.17,-8.75+dz,'estate_frame');obstruction('living low table',-10.2,-8.75,2.5,1.3,.5);
 bx(4.85,.012,4.6,-10.1,Y+.041,-9.25,'estate_rug');b(.57,.045,.38,-10.5,Y+.51,-8.65,'estate_cushion');b(.41,.032,.27,-10.43,Y+.55,-8.67,'estate_navy');
 cyl(.09,.075,.17,-9.62,Y+.59,-8.70,'estate_stone',8,zero,harbor);
 rod([-12.7,Y,-6.4],[-12.7,Y+1.95,-6.4],.027,'estate_frame',harbor,6);cone(.34,.4,-12.7,Y+2.00,-6.4,'estate_cushion',low?8:12,harbor);obstruction('living lamp',-12.7,-6.4,.4,.4,2.25);
 const sofaSeat={id:'harbor:living-seat',contentId:'harbor',action:'harbor',x:-10.4,z:-11.45,y:Y+.56,yaw:0,rotation:0,approach:{x:-10.4,z:-10.35,y:Y}};layout.benches.push(sofaSeat);layout.bench??=sofaSeat;
 // Study: desk and chair on the side wall, keeping a generous middle cross-route.
 desktop(2,-11.8,3.7,1.05,connect);b(1.50,.91,.08,2,Y+1.53,-12.0,'estate_frame',connect);bx(1.32,.73,.025,2,Y+1.53,-11.946,'estate_glass',connect);
 bx(.19,.27,.16,2,Y+1.06,-12,'estate_frame',connect);b(.77,.024,.30,2,Y+.927,-11.5,'estate_frame',connect);for(const dx of[-1.45,1.45])books(2+dx-.25,Y+.94,-11.85);
 b(.92,.15,.88,2,Y+.50,-10.4,'estate_navy',connect);b(.90,.75,.14,2,Y+.91,-10.77,'estate_navy',connect);rod([2,Y+.1,-10.4],[2,Y+.50,-10.4],.08,'estate_frame',connect,7);obstruction('study chair',2,-10.4,1,.95,1.3);
 b(.48,.9,.65,4.8,Y+.45,-12.8,'estate_wood',connect);for(let k=0;k<3;k++)bx(.40,.018,.025,4.8,Y+.20+k*.25,-12.46,'estate_frame',connect);
 // A shelf wall with deliberate empty intervals gives books legible silhouettes.
 bx(4.6,2.45,.12,2,Y+1.23,-14.59,'estate_frame',connect);for(const yy of[.11,.80,1.49,2.18])bx(4.7,.09,.46,2,Y+yy,-14.46,'estate_wood',connect);
 for(const yy of[.15,.85,1.54])for(let i=0;i<(low?8:16);i++){const x=-.03+i*(low?.56:.28),h=.28+(i%3)*.09;bx(.12,h,.26,x,Y+yy+h/2,-14.38,['estate_navy','estate_wood','estate_cushion'][i%3],connect);}obstruction('study shelving',2,-14.4,4.8,.53,2.5);
 // Slim wall-mounted reading plaques stay distinct from the outside directory.
 b(2.0,.83,.13,4.75,Y+1.25,-8.4,'estate_stone',connect,[0,-Math.PI/2,0]);
 tx('MY WORKSPACE',.18,2,Y+2.27,-14.07,'estate_cushion',connect);
 layout.stations.push({id:'harbor:study',type:'read',contentId:'harbor',label:'Meet Jack',readFull:true,readLabel:'Meet Jack',x:2,z:-8,y:Y});
 layout.stations.push({id:'connect:repository',type:'read',contentId:'connect',label:'Explore the code',contentSection:'links',readFull:true,x:3.5,z:-8,y:Y});
 // Entry cabinet, hooks and shoes add domestic scale without crossing the hall.
 b(1.45,.83,.42,-1,Y+.415,-2.45,'estate_wood');obstruction('entry console',-1,-2.45,1.45,.45,.9);
 for(const xx of[-1.5,-1,-.5]){rod([xx,Y+1.4,-2.64],[xx,Y+1.6,-2.64],.025,'estate_frame');b(.19,.28,.13,xx,Y+1.33,-2.54,'estate_cushion');}
 b(.49,.055,.37,-1.25,Y+.88,-2.4,'estate_navy');cyl(.085,.07,.18,-.55,Y+.91,-2.40,'estate_copper',8,zero,harbor);
 });
 // Four full-size bays. Their clear envelopes and door sizes drive both the
 // renderer and runtime vehicle spawn/access validation.
 floor(-20,2,19,10);landmark('garage','Four-bay garage',-20,2,19,10);
 const garageWalls=named('occluder_estate_garage_walls'),garageRoof=named('occluder_estate_garage_roof');
 wall('garage rear wall',-20,-2.88,18.98,.24,3.1,'estate_stone',garageWalls);
 wall('garage west wall',-29.37,2,.26,9.8,3.1,'estate_stone',garageWalls);
 wall('garage east wall',-10.63,2,.26,9.8,3.1,'estate_stone',garageWalls);
 b(19.4,.27,10.4,-20,Y+3.21,2,'estate_stone',garageRoof);bx(19.2,.10,10.2,-20,Y+3.025,2,'estate_wood',garageRoof);b(19.18,.35,.37,-20,Y+2.9,6.98,'estate_frame',garageRoof);
 const bayXs=[-26.9,-22.3,-17.7,-13.1],carWidths=[2.061,2.199,2.32,2.43];
 for(let i=0;i<5;i++){const x=-29.2+i*4.6;b(.60,2.9,.35,x,Y+1.45,6.95,'estate_stone',garageWalls);obstruction('garage front pier '+i,x,6.95,.60,.35,2.9);}
 for(let i=0;i<4;i++){
  const x=bayXs[i],id=String(i+1).padStart(2,'0');layout.garageBays.push({id,x,z:2.75,width:4.3,depth:8.5,entrance:{x,z:7,width:4},carEnvelope:{x,z:2.75,width:carWidths[i],depth:i===3?5.2:4.7}});
  bx(3.98,.12,1.1,x,Y+2.76,6.3,'estate_wood',garageRoof);for(let j=0;j<6;j++)bx(3.90,.011,.012,x,Y+2.687,5.86+j*.18,'estate_frame',garageRoof);
  for(const dx of[-1.95,1.95]){rod([x+dx,Y+2.57,6.7],[x+dx,Y+2.57,-1.4],.035,'estate_frame',garageRoof,6);bx(.022,.007,7.2,x+dx,Y+.033,2.5,'estate_white');}
  b(.48,.35,.05,x,Y+2.90,7.191,'estate_stone',garageRoof);tx(id,.20,x,Y+2.81,7.23,'estate_frame',garageRoof);bx(1.5,.05,.2,x,Y+2.9,2,'warmWindow',garageRoof);
  if(!low)for(const z of[-1,1,3,5])bx(4.25,.008,.018,x,Y+.031,z,'estate_stoneJoint');
 }
 layout.interiors.push({landmarkId:'garage',floorY:Y,bounds:{x:-20,z:2,width:19,depth:10},entrances:bayXs.map((x,i)=>({id:'bay-'+(i+1),x,z:7,width:4,yaw:0})),cutawayGroups:['occluder_estate_garage_roof','occluder_estate_garage_walls'],walkRoute:[[-20,14],[-17.7,14],[-17.7,2.75],[-17.7,-1.9]]});
 // A dedicated rear service strip stays behind every 8.5 m bay envelope.
 bx(6.8,1.4,.08,-20,Y+1.45,-2.68,'estate_frame');b(7,.14,.46,-20,Y+.86,-2.43,'estate_wood');obstruction('garage workbench',-20,-2.43,7,.46,.96);
 for(let i=0;i<(low?9:15);i++){const x=-23.1+i*(low?.75:.44);rod([x,Y+1.10,-2.58],[x+.07,Y+1.77-(i%3)*.12,-2.58],.023,'metal');if(i%3===0)torus(.10,.020,x+.07,Y+1.83,-2.57,'metal',zero,5,8,harbor);}
 for(let i=0;i<3;i++)b(.37,.06,.32,-20.52+i*.51,Y+.97,-2.43,['estate_navy','orange','black'][i]);
 b(1.45,1.62,.36,-28,Y+.81,-2.48,'estate_frame');for(const yy of[.40,.81,1.22])bx(1.26,.024,.024,-28,Y+yy,-2.289,'estate_stone');obstruction('garage storage',-28,-2.48,1.55,.36,1.7);
 tx('BOAT STUDIO',.19,-20,Y+2.44,-2.629,'estate_white');layout.stations.push({id:'harbor:studio',type:'studio',contentId:'harbor',action:'harbor',label:'Boat Studio',x:-20,z:-1.05,y:Y});
 bx(18.2,.009,.22,-20,Y+.03,7.38,'estate_frame');if(!low)for(let i=0;i<45;i++)bx(.035,.009,.19,-28.8+i*.4,Y+.035,7.38,'estate_paving');
 // Covered pedestrian link sits east of the garage, clear of every car door.
 const link=named('occluder_estate_link');b(3.4,.17,9.4,-7.8,Y+2.88,.7,'estate_stone',link);
 for(const z of[-3.8,5.2])for(const x of[-9.32]){bx(.11,2.8,.11,x,Y+1.4,z,'estate_frame',link);obstruction('covered link column',x,z,.13,.13,2.8);}
 section(7,-9,()=>{
 landmark('tennis','Tennis practice',16,-5,12,24);
 // Tennis court has one readable open entrance on its west edge. The net is
 // intentionally separate from boundary fences, with space to walk around it.
 floor(16,-5,12,24,'estate_courtOuter');bx(10,.016,20,16,Y+.032,-5,'estate_court');
 for(const x of[11.13,20.87])bx(.055,.009,19.75,x,Y+.047,-5,'estate_white');
 for(const z of[4.87,-14.87,-9.7,-.3])bx(9.75,.009,.055,16,Y+.047,z,'estate_white');
 for(const x of[12.15,19.85])bx(.04,.009,19.7,x,Y+.047,-5,'estate_white');bx(.04,.009,9.4,16,Y+.047,-5,'estate_white');
 const net=named('occluder_estate_tennis_net');for(const x of[10.9,21.1]){cyl(.073,.09,1.20,x,Y+.60,-5,'estate_frame',8,zero,net);obstruction('tennis net post',x,-5,.18,.18,1.25);}
 // Alpha-cutout square net replaces hundreds of separate wires at runtime.
 // Keep a faint geometric coarse weave as a robust offline/low-quality fallback.
 for(let i=0;i<=25;i++)rod([11+i*.4,Y+.12,-5],[11+i*.4,Y+.94,-5],.006,'estate_frame',net,3);
 for(let i=0;i<=4;i++)rod([11,Y+.14+i*.20,-5],[21,Y+.14+i*.20,-5],.006,'estate_frame',net,3);
 bx(10.2,.075,.035,16,Y+1.0,-5,'estate_white',net);obstruction('tennis playing net',16,-5,10.2,.06,1.05);
 const fences=named('occluder_estate_tennis_fence');
 const fence=(ax,az,bx0,bz0)=>{const length=Math.hypot(bx0-ax,bz0-az),n=Math.ceil(length/3);for(let i=0;i<=n;i++){const x=ax+(bx0-ax)*i/n,z=az+(bz0-az)*i/n;rod([x,Y,z],[x,Y+2.3,z],.04,'estate_frame',fences,6);}for(const yy of[.16,1.1,2.25])rod([ax,Y+yy,az],[bx0,Y+yy,bz0],.017,'estate_frame',fences,5);const vertical=ax===bx0;obstruction('tennis perimeter fence',(ax+bx0)/2,(az+bz0)/2,vertical?.10:length,vertical?length:.10,2.3);};
 fence(22,-17,22,7);fence(10,-17,22,-17);fence(10,-17,10,-1);fence(10,7,22,7);
 // Ball machine at the far baseline and storage sit beyond the playable lines.
 b(.95,.78,.83,16,Y+.63,-14,'estate_navy');b(.7,.35,.67,16,Y+1.15,-14,'estate_cushion');cyl(.12,.12,.28,16,Y+1.1,-13.50,'estate_frame',8,[Math.PI/2,0,0],harbor);obstruction('tennis ball machine',16,-14,1.15,1.1,1.4);
 for(const dx of[-.37,.37])cyl(.14,.14,.13,16+dx,Y+.17,-14,'estate_frame',8,[0,0,Math.PI/2],harbor);
 b(.67,.60,.67,20.9,Y+.42,5.75,'estate_frame');for(const dx of[-.23,0,.23])for(const dz of[-.23,0,.23])sphere(.08,20.9+dx,Y+.74,5.75+dz,'yellow');obstruction('tennis ball basket',20.9,5.75,.74,.74,1.0);
 bench('harbor:tennis-seat',13,9.5,0);plant(19,9.5,2.4,.8);
 b(1.4,.82,.16,11.8,Y+1.22,6.1,'estate_stone');tx('TENNIS',.20,11.8,Y+1.40,6.2,'estate_navy');tx('6 BALL PRACTICE',.087,11.8,Y+1.11,6.2,'estate_frame');obstruction('tennis entry sign',11.8,6.1,1.4,.20,1.7);
 layout.stations.push({id:'harbor:tennis',type:'practice',contentId:'harbor',action:'tennis',practiceId:'tennis',label:'Tennis practice',x:8.0,z:4,y:Y});
 layout.sports.tennis={id:'tennis',surfaceY:Y+.04,bounds:{x:16,z:-5,width:12,depth:24},entry:{x:8,z:4,y:Y},exit:{x:8,z:4,y:Y},baseline:{x:16,z:4,y:Y,minX:12,maxX:20},net:{z:-5,xMin:10.9,xMax:21.1,height:1.02},machine:{x:16,z:-13.5,y:Y+1.1},targets:[13,16,19],camera:{target:{x:16,y:1,z:-4},distance:44}};
 });
 section(0,-11,()=>{
 landmark('golf','Three putting greens',0,-24,20,10);
 // Three subtly contoured greens: one common equation is exported with each
 // hole and used to generate the geometry, so game ball sampling can match it.
 const holes=[{id:1,tee:{x:-7,z:-21},cup:{x:-1,z:-21},slopeX:0,slopeZ:0,undulation:0},{id:2,tee:{x:-7,z:-24},cup:{x:1,z:-24},slopeX:0,slopeZ:.012,undulation:.025},{id:3,tee:{x:-7,z:-27},cup:{x:3,z:-27},slopeX:0,slopeZ:0,undulation:.015}];
 const greenHeight=(hole,x,z)=>Y+.035+hole.slopeX*(x-hole.tee.x)+hole.slopeZ*(z-hole.tee.z)+hole.undulation*Math.sin((x+9)/18*Math.PI)**2;
 for(const hole of holes){
  const zz=hole.tee.z,verts=[],indices=[],steps=low?14:24;
  for(let iz=0;iz<=4;iz++)for(let ix=0;ix<=steps;ix++){const x=-8.5+17*ix/steps,z=zz-1.05+2.1*iz/4;verts.push(x,greenHeight(hole,x,z),z);}
  for(let iz=0;iz<4;iz++)for(let ix=0;ix<steps;ix++){const a=iz*(steps+1)+ix,b0=a+1,c=a+steps+1,d=c+1;indices.push(a,c,b0,b0,c,d);}
  const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geom.setIndex(indices);geom.computeVertexNormals();mesh(geom,'estate_green',zero,zero,harbor);
  bx(17.4,.025,2.6,0,Y+.012,zz,'estate_fairway');
  for(const side of[-1,1])for(let i=0;i<(low?5:10);i++)sphere(.17,-8+i*(low?4:1.77),Y+.16,zz+side*1.35,'estate_rough',harbor,[1.6,.35,.7]);
  const yy=greenHeight(hole,hole.cup.x,hole.cup.z);cyl(.19,.19,.013,hole.cup.x,yy+.008,hole.cup.z,'estate_frame',12,zero,harbor);torus(.205,.025,hole.cup.x,yy+.01,hole.cup.z,'estate_stone',[Math.PI/2,0,0],5,12,harbor);
  rod([hole.cup.x,yy,hole.cup.z],[hole.cup.x,yy+1.45,hole.cup.z],.026,'estate_white',harbor,6);bx(.46,.32,.025,hole.cup.x+.23,yy+1.28,hole.cup.z,'orange');
  cyl(.11,.11,.018,hole.tee.x,greenHeight(hole,hole.tee.x,zz)+.015,zz,'estate_white',12,zero,harbor);
  b(.72,.44,.1,-9.6,Y+.42,zz,'estate_wood');tx(String(hole.id).padStart(2,'0'),.21,-9.6,Y+.34,zz+.063,'estate_white');
  Object.assign(hole,{bounds:{minX:-9,maxX:9,minZ:zz-1.3,maxZ:zz+1.3},surface:{groundY:Y,baseOffset:.035,slopeX:hole.slopeX,slopeZ:hole.slopeZ,undulation:hole.undulation,minX:-8.5,maxX:8.5,halfWidth:1.05},length:hole.cup.x-hole.tee.x});
 }
 const bunker={x:-2,z:-26.4,rx:1.2,rz:.45};
 const sand=mesh(new THREE.CircleGeometry(1,low?16:26),'estate_sand',[bunker.x,Y+.070,bunker.z],[-Math.PI/2,0,0],harbor);sand.scale.set(bunker.rx,bunker.rz,1);
 holes[2].sand=bunker;
 layout.sports.golf={id:'golf',bounds:{x:0,z:-24,width:20,depth:10},entry:{x:0,z:-17.1,y:Y},exit:{x:0,z:-17.1,y:Y},holes,camera:{distance:26}};
 // Club rack and one quiet overlook support the miniature sporting garden.
 b(1.7,.70,.32,-10.5,Y+.4,-21,'estate_wood');for(let i=0;i<4;i++){rod([-11.4+i*.4,Y+.3,-21],[-11.4+i*.4,Y+1.48,-21],.017,'metal');b(.19,.09,.12,-11.34+i*.4,Y+.25,-21,'estate_frame');}obstruction('golf club rack',-10.5,-21,1.8,.43,1.6);
 b(3.3,.87,.20,0,Y+1.03,-18.8,'estate_stone');tx('PUTTING GARDEN',.23,0,Y+1.18,-18.685,'estate_navy');tx('THREE SHORT GREENS',.108,0,Y+.92,-18.685,'estate_frame');obstruction('golf guide',0,-18.8,3.3,.25,1.5);
 layout.stations.push({id:'harbor:golf',type:'practice',contentId:'harbor',action:'golf',practiceId:'golf',label:'Putting practice',x:0,z:-17.1,y:Y});
 });
 // Familiar lighthouse remains a readable shore landmark, moved away from doors.
 const lx=-28,lz=-17,lantern=named('occluder_estate_lighthouse');
 cyl(1.22,1.40,.22,lx,Y+.11,lz,'estate_stone',low?12:18,zero,harbor);obstruction('estate lighthouse',lx,lz,2.75,2.75,8.7);
 for(let i=0;i<5;i++)cyl(1.02-i*.1,1.11-i*.1,1.3,lx,Y+.82+i*1.30,lz,i%2?'estate_stone':'estate_wood',low?12:18,zero,harbor);
 cyl(.75,.75,.15,lx,Y+7.33,lz,'estate_frame',12,zero,lantern);cyl(.62,.62,.95,lx,Y+7.85,lz,'estate_glass',12,zero,lantern);cone(.9,.60,lx,Y+8.63,lz,'estate_frame',12,lantern);
 for(let i=0;i<8;i++){const a=i*Math.PI/4;rod([lx+Math.cos(a)*.63,Y+7.4,lz+Math.sin(a)*.63],[lx+Math.cos(a)*.63,Y+8.31,lz+Math.sin(a)*.63],.032,'estate_copper',lantern,6);}
 b(.61,1.33,.12,lx,Y+.70,lz+1.08,'estate_frame');landmark('lighthouse','Lighthouse',lx,lz,2.8,2.8);
 // Existing bell and signal actions remain attached to the same content IDs.
 const bell=named('anim_bell',-6,Y+2.05,19.1);cyl(.20,.34,.44,0,-.25,0,'yellow',12,zero,bell);rod([0,0,0],[0,-.61,0],.021,'estate_frame',bell,6);
 for(const x of[-6.6,-5.4])bx(.11,2.15,.13,x,Y+1.075,19.1,'estate_wood');bx(1.36,.13,.18,-6,Y+2.11,19.1,'estate_wood');obstruction('harbor bell frame',-6,19.1,1.4,.22,2.3);
 layout.stations.push({id:'harbor:bell',type:'action',contentId:'harbor',action:'harbor',label:'Harbor bell',x:-6,z:20,y:Y});
 for(let i=0;i<6;i++){const x=9,z=-10.0-i*2.15;bx(.12,.53,.12,x,Y+.265,z,'estate_frame',connect);const g=named('anim_signal_light_'+i,x,Y+.61,z,connect);sphere(.12,0,0,0,'yellow',g);}
 layout.stations.push({id:'connect:signal',type:'action',contentId:'connect',action:'connect',label:'Light up the garden',x:8,z:-9,y:Y});
 sign('harbor:welcome','MEET JACK','WELCOME TO THE COAST',-3.25,20.6,'harbor');sign('connect:hello','SAY HELLO','EMAIL / LINKEDIN / CODE',3.25,20.6,'connect',connect);
 // Landscape keeps the road shoulders, approach routes and full turn sweeps open.
 for(const[id,x,z,h]of[['west1',-41,4,4.8],['west2',-41,-24,4.7],['east1',41,-17,4.8],['east2',40,-3,4.0],['rear1',-18,-51.1,4.3],['rear2',18,-51.1,4.8],['garden',-21,-19,4.5]])tree(id,x,z,h);
 for(const[x,z,w,d]of[[-25,-21.8,2.8,.8],[3.5,-5.5,2.8,.8],[4.6,-24.5,2.2,.8]])plant(x,z,w,d);
 bench('harbor:terrace-seat',-10.3,-23.4,Math.PI);bench('harbor:overlook-seat',-22,-40.6,Math.PI);
 for(const[x,z]of[[-6.3,23.4],[6.3,23.4],[-40.1,-8],[40.1,-8],[-40.1,-32],[40.1,-32],[-11.8,-24.9],[14.2,-30.4],[-27,-51],[27,-51]])light(x,z);
 landmark('coast-overlook','Sunset parking',-22,-33,16,14);
 // Subtle parking lines remain inside the courtyard; no enclosing brown boxes.
 for(const stall of ESTATE_PARKING[2].stalls){
  for(const side of[-1,1])bx(stall.width,.009,.035,stall.x,Y+.033,stall.z+side*stall.depth/2,'estate_white');
  bx(.035,.009,stall.depth,stall.x+stall.width/2,Y+.033,stall.z,'estate_white');
 }
 const direction=(label,x,z)=>{
  const signRoot=named('direction_'+label.toLowerCase().replaceAll(' ','_'));
  bx(.09,1.20,.11,x,Y+.60,z,'estate_woodDark',signRoot);b(2.1,.40,.10,x,Y+1.34,z,'estate_wood',signRoot);tx(label.toUpperCase(),.13,x,Y+1.29,z+.058,'estate_white',signRoot);obstruction('estate direction '+label,x,z,.15,.15,1.6);
 };
 for(const[label,x,z]of[['Garage',-34,23.2],['House',8,-5],['Tennis',14.6,1.8],['Golf',14.6,-27],['Dock',4.7,23.4],['Sunset parking',-27,-41]])direction(label,x,z);
 const drive=estateDriveRoute(),driveLength=drive.slice(1).reduce((s,p,i)=>s+Math.hypot(p[0]-drive[i][0],p[1]-drive[i][1]),0);
 layout.driveRoute={width:ESTATE_DRIVE.width,points:drive,cornerRadius:ESTATE_DRIVE.radius,shoulder:ESTATE_DRIVE.shoulder,length:+driveLength.toFixed(3)};
 layout.parkingAreas=structuredClone(ESTATE_PARKING);
 layout.paths=[...structuredClone(ESTATE_WALK_PATHS),{id:'garage-front',kind:'walk',width:3.2,points:[[-26.9,11.5],[-7.8,11.5]]}];
 layout.roads=[{id:'coastal-drive',kind:'drive',width:6.5,points:drive.map(([x,z])=>[x,Y+.025,z])},...layout.paths.map(p=>({...p,points:p.points.map(([x,z])=>[x,Y+.025,z])})),{id:'overlook-access',kind:'drive',width:8,points:[[-35,Y+.025,-33],[-30,Y+.025,-33]]}];
 const dockZ=layout.dock?.endZ-2.5||29.5;
 layout.route=[[0,dockZ],[0,22],[1,7],[-4,-6],[-4,-12],[-4,-20],[-4,-26],[0,-28.1],[12,-28.1],[12,-42],[-13,-42],[-13,-27],[-17,-24],[-28,-24],[-28,-20.5],[-28,-24],[-31.5,-24],[-31.5,-17],[-31.5,0],[-32,14],[-17.7,14],[-7.8,14],[1,7],[12,7],[12,-5],[15,-5],[12,-5],[12,7],[1,7],[0,19],[0,22],[0,dockZ]];
 // Classify the complete exterior paving once so path/plaza/road intersections
 // cannot z-fight. Main asphalt, stone courts and light walking routes share
 // the same .875 top surface and authored support heights.
 const contours=estatePavingContours(),area=p=>p.reduce((s,a,i)=>{const b0=p[(i+1)%p.length];return s+a[0]*b0[1]-b0[0]*a[1];},0);
 const contains=(p,x,z)=>{let yes=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b0=p[j];if((a[1]>z)!==(b0[1]>z)&&x<(b0[0]-a[0])*(z-a[1])/(b0[1]-a[1])+a[0])yes=!yes;}return yes;};
 for(const[kind,loops]of Object.entries(contours))for(const outer of loops.filter(p=>area(p)>0)){
  const shape=new THREE.Shape(outer.map(([x,z])=>new THREE.Vector2(x,-z)));
  for(const hole of loops.filter(p=>area(p)<0&&contains(outer,...p[0])))shape.holes.push(new THREE.Path(hole.map(([x,z])=>new THREE.Vector2(x,-z))));
  const geometry=new THREE.ShapeGeometry(shape);geometry.rotateX(-Math.PI/2);const paving=mesh(geometry,kind==='drive'?'estate_asphalt':kind==='shoulder'?'estate_roadShoulder':'estate_paving',[0,Y+.025,0],zero,harbor);paving.name='estate_paving_'+kind;
 }
 for(const road of layout.roads){
  if(road.interior)continue;
  for(let i=1;i<road.points.length;i++){
   const a=road.points[i-1],b0=road.points[i],dx=b0[0]-a[0],dz=b0[2]-a[2];
   layout.surfaces.push({x:(a[0]+b0[0])/2,z:(a[2]+b0[2])/2,width:road.width+(road.kind==='drive'?1.5:0),depth:Math.hypot(dx,dz)+.06,y:Y+.025,rotation:Math.atan2(dx,dz)});
  }
 }
 for(const area0 of ESTATE_PARKING)layout.surfaces.push({x:area0.x,z:area0.z,width:area0.width,depth:area0.depth,y:Y+.025});
 layout.routeLength=+layout.route.slice(1).reduce((s,p,i)=>s+Math.hypot(p[0]-layout.route[i][0],p[1]-layout.route[i][1]),0).toFixed(2);
 layout.estimatedWalkingSeconds=+(layout.routeLength/2.4).toFixed(1);
 layout.validation={connectedFromDock:true,stationsReachable:layout.stations.length,pathWidth:3.2,driveWidth:6.5,routeClearance:1.5,garageBays:4,interiors:2};
 return {harbor,connect};
}
