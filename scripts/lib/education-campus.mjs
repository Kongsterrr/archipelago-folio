// V14: original campus miniatures, based on the public silhouettes of CMU and BU.
// Model and walk metadata are authored together; no campus image is baked into the asset.
import * as THREE from 'three';

export const campusPalette = {
 campus_limestone:'#d8d1b9',campus_sandstone:'#c9b681',campus_brick:'#945d4e',
 campus_brickDark:'#74483d',campus_copper:'#63877a',campus_slate:'#596574',
 campus_glass:'#567b83',campus_trim:'#f2e6cd',campus_red:'#a63842',
 campus_paving:'#d6ccad',campus_leaf:'#547753',campus_iron:'#374951',
 campus_lawn:'#93af69',campus_tram:'#417766',campus_paintBlue:'#668da7',
 campus_paintGold:'#e4b761',campus_paintRose:'#c07a8a',
};

export function buildEducationCampus(api) {
 const {root,layout,low,Y,schools,box,bevel,cyl,cone,mesh,rod,torus,text3D,group,solid,pitchedRoof,slatBench,lamp,books,harborPath,inside}=api;
 const district=group();district.name='district_learning';
 const schoolById=new Map(schools.map(s=>[s.schoolId,s]));
 layout.districts=[{id:'learning',x:0,z:0,rotation:0,group:'district_learning'}];
 layout.campuses=[
  {schoolId:'bu',label:'Boston University',shortLabel:'BU',color:'#a63842',x:-12,z:1,bounds:{x:-16,z:-2,width:19,depth:28}},
  {schoolId:'cmu',label:'Carnegie Mellon University',shortLabel:'CMU',color:'#b89b57',x:12,z:1,bounds:{x:15,z:-2,width:19,depth:28}},
 ];
 layout.landmarks=[];
 for(const campus of layout.campuses){const b=campus.bounds;campus.polygon=[[b.x-b.width/2,b.z-b.depth/2],[b.x+b.width/2,b.z-b.depth/2],[b.x+b.width/2,b.z+b.depth/2],[b.x-b.width/2,b.z+b.depth/2]];}
 const pos=(x,y,z)=>[x,y,z],zero=[0,0,0];
 const b=(w,h,d,x,y,z,mat='campus_trim',parent=district,rot=zero)=>bevel(w,h,d,x,y,z,mat,.025,rot,parent);
 const bx=(w,h,d,x,y,z,mat='campus_trim',parent=district,rot=zero)=>box(w,h,d,x,y,z,mat,rot,parent);
 const tx=(s,size,x,y,z,mat='campus_iron',parent=district)=>text3D(s,size,x,y,z,mat,.009,parent);
 const named=(name,x=0,y=0,z=0,parent=district)=>{const g=group([x,y,z],zero,parent);g.name=name;return g;};
 const roof=(name,fn)=>{const g=named('occluder_campus_'+name);fn(g);return g;};
 // Exterior walls must participate in the same occlusion island as their roof.
 // Keep plazas, walk surfaces and physics metadata outside these visual groups.
 const includeBuilding=(name,before)=>{const owner=district.getObjectByName('occluder_campus_'+name);for(const child of [...district.children])if(child!==owner&&!before.has(child))owner.add(child);};
 const obstacle=(name,x,z,w,d,h)=>solid(x,z,w,d,h,Y,0,name);
 const footprint=(id,schoolId,label,x,z,width,depth)=>layout.landmarks.push({id,schoolId,label,x,z,width,depth});
 const facadeWindow=(x,y,z,w,h,parent=district,mat='campus_glass')=>{
  b(w+.16,h+.18,.16,x,y,z,'campus_trim',parent);bx(w,h,.08,x,y,z+.09,mat,parent);
  bx(.055,h,.06,x,y,z+.15,'campus_trim',parent);bx(w,.055,.065,x,y,z+.15,'campus_trim',parent);
  b(w+.3,.10,.27,x,y-h/2-.08,z+.04,'campus_limestone',parent);
 };
 function pointedWindow(x,y,z,w,h,parent=district) {
  const shape=new THREE.Shape();shape.moveTo(-w/2,0);shape.lineTo(w/2,0);shape.lineTo(w/2,h*.63);shape.quadraticCurveTo(w*.44,h*.84,0,h);shape.quadraticCurveTo(-w*.44,h*.84,-w/2,h*.63);shape.closePath();
  const g=new THREE.ExtrudeGeometry(shape,{depth:.07,bevelEnabled:false,curveSegments:low?3:6});mesh(g,'campus_glass',pos(x,y,z),zero,parent);
  const pts=[[-w/2,0],[-w/2,h*.63],[-w*.29,h*.87],[0,h],[w*.29,h*.87],[w/2,h*.63],[w/2,0]];
  for(let i=1;i<pts.length;i++)rod([x+pts[i-1][0],y+pts[i-1][1],z+.085],[x+pts[i][0],y+pts[i][1],z+.085],.065,'campus_trim',parent,6);
  bx(w,.09,.14,x,y,z+.08,'campus_trim',parent);rod([x,y,z+.11],[x,y+h*.84,z+.11],.035,'campus_trim',parent,6);
 }
 function entrance(x,z,w=1.45,h=2.1,parent=district) {
  b(w+.34,h+.24,.23,x,Y+h/2,z,'campus_trim',parent);b(w,h,.15,x,Y+h/2,z+.15,'campus_iron',parent);
  for(const side of[-1,1]){bx(w*.42,h*.70,.05,x+side*w*.24,Y+h*.58,z+.25,'campus_glass',parent);rod([x+side*.12,Y+.72,z+.30],[x+side*.12,Y+1.02,z+.30],.032,'metal',parent);}
 }
 function courses(x,z,w,h,d,mat,parent=district) {
  b(w,.20,d,x,Y+.1,z,'campus_limestone',parent);b(w+.18,.16,d+.18,x,Y+h-.11,z,'campus_trim',parent);
  if(!low)for(let i=1;i<h/.46;i++)bx(w,.018,.015,x,Y+i*.46,z+d/2+.013,'campus_limestone',parent);
 }
 function plaque(schoolId,label,x,z,width=3.5) {
  const parent=named('station_learning:'+schoolId),bz=z-2.1,school=schoolById.get(schoolId);
  if(!school)throw Error('Missing school source '+schoolId);
  b(width+.16,.13,.95,x,Y+.06,bz,'campus_limestone',parent);
  for(const dx of[-width*.38,width*.38])b(.14,2.2,.16,x+dx,Y+1.1,bz,'campus_iron',parent);
  b(width,1.87,.23,x,Y+1.28,bz,'campus_trim',parent);
  const accent=schoolId==='bu'?'campus_red':'campus_sandstone';
  b(width,.19,.28,x,Y+2.25,bz,accent,parent);
  tx(school.title.replace(/ University$/,'').toUpperCase(),schoolId==='bu'?.25:.195,x,Y+1.86,bz+.13,'campus_iron',parent);
  tx(schoolId==='bu'?'UNIVERSITY':'UNIVERSITY',.22,x,Y+1.56,bz+.13,'campus_iron',parent);
  const words=school.degree.replace('Bachelor of Arts','BA').toUpperCase().split(' '),degreeLines=[''];for(const word of words){if((degreeLines.at(-1)+' '+word).trim().length>26)degreeLines.push(word);else degreeLines[degreeLines.length-1]=(degreeLines.at(-1)+' '+word).trim();}
  degreeLines.forEach((line,i)=>tx(line,.105,x,Y+1.19-i*.19,bz+.13,'campus_iron',parent));
  tx(school.period.toUpperCase(),.123,x,Y+.78,bz+.13,'campus_iron',parent);
  b(width-.4,.34,.045,x,Y+.54,bz+.14,accent,parent);tx('VIEW EDUCATION',.17,x,Y+.47,bz+.18,'campus_trim',parent);
  if(!low)for(const dx of[-width*.43,width*.43])for(const yy of[.5,2.04])cyl(.025,.025,.014,x+dx,Y+yy,bz+.133,'metal',7,[Math.PI/2,0,0],parent);
  obstacle(label+' education display',x,bz,width,.45,2.36);
  layout.stations.push({id:'learning:'+schoolId,type:'read',contentId:'learning',schoolId,label,primary:true,readFull:true,readLabel:'View education',cameraTarget:schoolId==='bu'?{x:-12,y:3,z:-3}:{x:13,y:3,z:-1},camera:{distance:30},x,z,y:Y,hitArea:{x,y:Y+1.27,z:bz+.15,width:width+.1,height:1.94,yaw:0}});
 }
 function bench(id,x,z,rotation=0){
  slatBench(x,z,rotation);obstacle('campus bench '+id,x,z,2.0,.72,1.24);
  const s=Math.sin(rotation),c=Math.cos(rotation),entry={id:'learning:'+id,contentId:'learning',action:'learning',x,z,y:Y+.60,rotation,yaw:rotation,approach:{x:x+s*1.2,z:z+c*1.2,y:Y}};
  layout.benches.push(entry);layout.bench??=entry;
 }
 function broadleaf(id,x,z,h=4.0,r=1.55){
  const canopy=named('occluder_campus_tree_'+id);rod([x,Y,z],[x,Y+h*.72,z],.13,'darkWood',district,8);
  for(const[a,dx,dz]of[[0,-.52,.1],[1,.5,.2],[2,0,-.4]]){rod([x,Y+h*.44,z],[x+dx,Y+h*.77,z+dz],.07,'darkWood',district,7);const tree=mesh(new THREE.IcosahedronGeometry(r,low?0:1),'campus_leaf',pos(x+dx,Y+h*.79+a*.07,z+dz),zero,canopy);tree.scale.set(.82,.79,.8);}
  obstacle('campus tree '+id,x,z,.34,.34,h);
 }
 function planter(x,z,w=2.2,d=.85){b(w,.25,d,x,Y+.125,z,'campus_limestone');bx(w-.16,.035,d-.16,x,Y+.27,z,'darkWood');for(let i=0;i<(low?3:5);i++){const xx=x-w*.35+i*w*.7/((low?3:5)-1);mesh(new THREE.IcosahedronGeometry(.31,0),'campus_leaf',pos(xx,Y+.5,z),zero,district);if(!low)cyl(.10,.05,.08,xx,Y+.77,z,'campus_paintRose',7,zero,district);}obstacle('campus planter',x,z,w,d,.7);}
 // BU: chapel volume and geometric Gothic tracery, without an invented bell tower.
 {
  const buildingStart=new Set(district.children),x=-12,z=-9,w=6,d=8,h=4.8;
  b(w,h,d,x,Y+h/2,z,'campus_limestone');courses(x,z,w,h,d,'campus_limestone');obstacle('Marsh Chapel',x,z,w+.42,d+.3,7.2);footprint('marsh-chapel','bu','Marsh Chapel',x,z,w,d);
  roof('marsh_roof',g=>{pitchedRoof(w+.35,d+.4,Y+h,x,z,'campus_slate',g,2.25);for(const xx of[x-w/2-.1,x+w/2+.1])for(const zz of[z-d/2-.07,z+d/2+.07]){b(.34,1.15,.4,xx,Y+h+.2,zz,'campus_limestone',g);cone(.25,.48,xx,Y+h+.99,zz,'campus_slate',6,g);}});
  const f=z+d/2+.18;
  for(const dx of[-2.74,2.74]){b(.48,4.45,.72,x+dx,Y+2.23,f-.22,'campus_trim');b(.58,.19,.86,x+dx,Y+4.52,f-.24,'campus_trim');}
  entrance(x,f,1.4,1.85);pointedWindow(x,Y+1.96,f+.02,1.66,1.00);
  cyl(.86,.86,.075,x,Y+3.84,f+.03,'campus_glass',low?16:24,[Math.PI/2,0,0],district);torus(.93,.095,x,Y+3.84,f+.08,'campus_trim',zero,6,low?20:32,district);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;rod([x,Y+3.84,f+.14],[x+Math.cos(a)*.79,Y+3.84+Math.sin(a)*.79,f+.14],.032,'campus_trim',district,6);}
  torus(.26,.05,x,Y+3.84,f+.15,'campus_trim',zero,5,16,district);
  b(3.5,.38,.16,x,Y+5.18,f+.07,'campus_trim');tx('MARSH CHAPEL',.21,x,Y+5.07,f+.16);
  for(const side of[-1,1])for(let i=0;i<4;i++){const zz=z-3+i*2;b(.6,3.8,.40,x+side*3.14,Y+1.9,zz,'campus_trim');b(.75,.15,.54,x+side*3.14,Y+3.84,zz,'campus_trim');}
  includeBuilding('marsh_roof',buildingStart);
  bx(8,.016,5,x,Y+.035,-1.5,'campus_paving');
 }
 // CAS: rhythmic limestone windows, string courses and a clearly framed entrance.
 {
  const buildingStart=new Set(district.children),x=-21,z=-5,w=5.2,d=6,h=4.2;
  b(w,h,d,x,Y+h/2,z,'campus_limestone');courses(x,z,w,h,d);obstacle('College of Arts and Sciences',x,z,w,d,h);footprint('cas','bu','College of Arts & Sciences',x,z,w,d);
  roof('cas_roof',g=>{b(w+.35,.28,d+.25,x,Y+h+.12,z,'campus_slate',g);b(w+.5,.15,d+.4,x,Y+h+.26,z,'campus_trim',g);});
  entrance(x,z+d/2+.12,1.2,1.65);for(const dx of[-1.7,0,1.7])for(const yy of[2.2,3.4])facadeWindow(x+dx,Y+yy,z+d/2+.14,.76,.80);
  b(4.7,.26,.15,x,Y+4.03,z+d/2+.16,'campus_trim');tx('COLLEGE OF ARTS & SCIENCES',.133,x,Y+3.97,z+d/2+.245);includeBuilding('cas_roof',buildingStart);
 }
 // Three Bay State Road houses have distinct cornices, bay windows and doors.
 {
  for(let i=0;i<3;i++){
   const buildingStart=new Set(district.children),x=-20+i*3.45,z=3.9,w=3.1,d=4,h=4.1+(i===1?.5:0),mat=i===1?'campus_brickDark':'campus_brick';
   b(w,h,d,x,Y+h/2,z,mat);courses(x,z,w,h,d,mat);obstacle('Bay State Road brownstone '+(i+1),x,z,w,d,h+.4);footprint('bay-state-'+i,'bu','Bay State Road',x,z,w,d);
   roof('brownstone_'+i,g=>{b(w+.2,.22,d+.17,x,Y+h+.08,z,'campus_slate',g);for(const yy of[h-.14,h+.2])b(w+.29,.13,.34,x,Y+yy,z+d/2+.1,'campus_trim',g);});
   entrance(x-.77,z+2.1,.65,1.55);b(.93,.12,.45,x-.77,Y+.065,z+2.28,'campus_limestone');
   if(i===1){b(1.10,.55,.24,x-.77,Y+2.05,z+2.1,'campus_iron');tx('BAY STATE',.11,x-.77,Y+2.09,z+2.232,'campus_trim');tx('ROAD',.11,x-.77,Y+1.90,z+2.232,'campus_trim');}
   for(const yy of[1.37,2.86]){b(1.36,1.27,.5,x+.58,Y+yy,z+2.0,'campus_brick');facadeWindow(x+.58,Y+yy,z+2.3,.94,.86);}
   if(!low)for(const dx of[-1.35,1.35])rod([x+dx,Y,z+2.55],[x+dx,Y+.77,z+2.55],.026,'campus_iron',district);
   includeBuilding('brownstone_'+i,buildingStart);
  }
 }
 // Green Line tram is a static backdrop, outside every walking route.
 {
  const x=-22.0,z=10.2,g=group([x,Y,z],zero,district);g.rotation.y=Math.PI/2;
  b(2.1,1.55,4.6,0,1.0,0,'campus_tram',g);b(2.1,.48,4.65,0,.64,0,'campus_trim',g);b(2.0,.22,4.65,0,1.91,0,'campus_slate',g);
  for(const zz of[-1.54,-.48,.58,1.6])for(const side of[-1,1])b(.035,.63,.73,side*1.072,1.45,zz,'campus_glass',g);
  b(1.48,.62,.03,0,1.41,2.335,'campus_glass',g);tx('B / BU CENTRAL',.11,0,1.92,2.33,'campus_trim',g);
  for(const xx of[-.78,.78])for(const zz of[-1.4,1.4])cyl(.30,.30,.18,xx,.34,zz,'campus_iron',10,[0,0,Math.PI/2],g);
  for(const xx of[-.67,.67])bx(.045,.05,5.5,xx,.08,0,'metal',g);
  obstacle('static Green Line tram',x,z,4.8,2.3,2.1);footprint('green-line','bu','Green Line',x,z,4.8,2.3);
 }
 // CMU: Hamerschlag rotunda, copper dome and lower lateral wings.
 {
  const buildingStart=new Set(district.children),x=12,z=-10;
  b(11.8,3.9,3.3,x,Y+1.95,z-2.2,'campus_sandstone');courses(x,z-2.2,11.8,3.9,3.3);obstacle('Hamerschlag Hall rear wing',x,z-2.2,11.8,3.3,5.1);
  cyl(2.75,2.8,4.8,x,Y+2.4,z,'campus_sandstone',low?20:32,zero,district);cyl(2.95,2.95,.22,x,Y+4.55,z,'campus_trim',low?20:32,zero,district);
  obstacle('Hamerschlag Hall rotunda',x,z,5.6,5.6,8.1);footprint('hamerschlag','cmu','Hamerschlag Hall',x,z-1.0,12,7.8);
  roof('hamerschlag_dome',g=>{
   cyl(2.9,2.9,.32,x,Y+4.9,z,'campus_copper',low?20:32,zero,g);
   const dome=mesh(new THREE.SphereGeometry(2.9,low?20:32,low?8:14,0,Math.PI*2,0,Math.PI/2),'campus_copper',pos(x,Y+5.07,z),zero,g);dome.scale.y=.67;
   cyl(.4,.64,.28,x,Y+7.01,z,'campus_copper',12,zero,g);cone(.39,.6,x,Y+7.43,z,'campus_copper',12,g);
   for(let i=0;i<(low?8:12);i++){const a=i*Math.PI*2/(low?8:12),points=[];for(let j=0;j<8;j++){const t=j/7*Math.PI/2;points.push([x+Math.sin(t)*2.92*Math.cos(a),Y+5.09+Math.cos(t)*1.95,z+Math.sin(t)*2.92*Math.sin(a)]);}for(let j=1;j<points.length;j++)rod(points[j-1],points[j],.027,'campus_trim',g,5);}
   for(const dx of[-4.5,4.5])pitchedRoof(3.3,3.6,Y+3.88,x+dx,z-2.2,'campus_copper',g,.83);
  });
  for(const dx of[-4.6,-3.4,3.4,4.6])facadeWindow(x+dx,Y+2.6,z-.46,.70,1.65);
  for(let i=0;i<7;i++){const a=-Math.PI*.38+i*Math.PI*.76/6,g=group([x+Math.sin(a)*2.82,Y,z+Math.cos(a)*2.82],[0,a,0],district);pointedWindow(0,1.3,.035,.68,1.75,g);b(.94,.19,.24,0,3.38,.02,'campus_trim',g);}
  entrance(x,z+2.94,1.03,1.65);
  b(2.9,.48,.66,x,Y+3.82,z+2.57,'campus_trim');tx('HAMERSCHLAG HALL',.16,x,Y+3.71,z+2.913);includeBuilding('hamerschlag_dome',buildingStart);
 }
 // Hamburg Hall: Heinz school courtyard, paired entrance and pale stone details.
 {
  const buildingStart=new Set(district.children),x=16,z=2.0,w=8,d=4.2,h=4.15;
  b(w,h,d,x,Y+h/2,z,'campus_sandstone');courses(x,z,w,h,d);obstacle('Hamburg Hall / Heinz College',x,z,w,d,h+.4);footprint('hamburg','cmu','Hamburg / Heinz',x,z,w,d);
  roof('hamburg_roof',g=>{b(w+.3,.25,d+.3,x,Y+h+.04,z,'campus_slate',g);b(w+.48,.18,.34,x,Y+h+.24,z+d/2,'campus_trim',g);});
  entrance(x,z+d/2+.12,1.4,2.1);
  for(const dx of[-3.0,-1.7,1.7,3.0])for(const yy of[1.1,2.8])facadeWindow(x+dx,Y+yy,z+d/2+.12,.74,1.0);
  b(2.5,.28,.24,x,Y+2.45,z+d/2+.15,'campus_trim');b(2.5,.32,.14,x,Y+3.64,z+d/2+.13,'campus_trim');tx('HEINZ COLLEGE',.17,x,Y+3.56,z+d/2+.21);tx('HAMBURG HALL',.15,x,Y+2.38,z+d/2+.29);includeBuilding('hamburg_roof',buildingStart);
 }
 // The Fence: paint variants share one placement, with runtime selecting one design.
 {
  const x=16,z=-3.8,g=named('anim_campus_fence',x,Y,z);
  for(const dx of[-2.4,-1.2,0,1.2,2.4]){b(.19,1.25,.19,dx,.625,0,'wood',g);cone(.16,.19,x+dx,Y+1.33,z,'wood',4,district);}
  for(const yy of[.4,.91])b(5.0,.24,.17,0,yy,.03,'wood',g);
  for(let k=0;k<3;k++){
   const design=named('anim_campus_fence_pattern_'+k,0,0,0,g);
   for(let j=0;j<9;j++){const mat=[['campus_paintBlue','campus_trim','campus_paintGold'],['campus_red','campus_trim','campus_slate'],['campus_paintRose','campus_paintGold','campus_tram']][k][j%3];b(.50,.21,.025,-2+j*.5,.90,.13,mat,design);b(.50,.21,.025,-2+j*.5,.4,.13,mat,design);}
   // All pattern groups export (GLTF onlyVisible); runtime makes two invisible on load.
  }
  obstacle('The Fence',x,z,5.1,.35,1.45);footprint('the-fence','cmu','The Fence',x,z,5.1,.6);
  layout.stations.push({id:'learning:fence',type:'action',contentId:'learning',action:'education-fence',label:'Paint The Fence',x,z:z+1.45,y:Y});
  b(2.3,.5,.10,x,Y+.55,z+.48,'campus_trim');tx('THE FENCE / TRY F',.145,x,Y+.49,z+.55);
 }
 // Two clear front-facing academic reading stations, beside open seating courts.
 plaque('bu',schoolById.get('bu').title,-9,8.0);plaque('cmu',schoolById.get('cmu').title,9,8.0);
 const windows=named('anim_bu_windows');for(const x of[-14,-12,-10])b(.58,.28,.035,x,Y+1.17,-4.80,'warmWindow',windows);
 // Shared garden book: same action and animation names as previous versions.
 {
  const x=0,z=1.5,g=named('anim_book',x,Y+.48,z);
  b(2.1,.16,1.3,0,0,0,'campus_iron',g);for(const side of[-1,1])b(.93,.14,1.18,side*.51,.11,0,'campus_trim',g,[0,0,side*.12]);
  if(!low)for(const xx of[-.51,.51])for(let i=0;i<5;i++)bx(.6,.009,.015,xx,.24,-.39+i*.16,'campus_limestone',g);
  obstacle('book sculpture',x,z,2.1,1.3,.72);layout.stations.push({id:'learning:books',type:'action',contentId:'learning',action:'learning-book',label:'Keep learning',x:0,z:3.3,y:Y});
 }
 // Shared lighthouse remains at the north water approach, clear of all walking routes.
 {
  const x=0,z=-16.0,beacon=named('anim_beacon',x,5.1,z);
  cyl(.55,.8,3.6,x,2.65,z,'campus_trim',12,zero,district);cyl(.5,.5,.7,0,0,0,'yellow',12,zero,beacon);cone(.8,.6,x,5.76,z,'campus_copper',12,district);
  torus(.60,.045,x,4.65,z,'campus_iron',[Math.PI/2,0,0],6,16,district);obstacle('navigation tower',x,z,1.6,1.6,5.2);
  layout.stations.push({id:'learning:lighthouse',type:'challenge',contentId:'learning',action:'lighthouse',label:'Lighthouse Link',x:0,z:-13.8,y:Y});
 }
 // Arrival display: overview owns E; individual school rows remain pointer targets.
 {
  const x=-3.3,z=16.15,bz=14.1,g=named('station_education:overview');
  for(const dx of[-1.57,1.57])b(.15,2.65,.18,x+dx,Y+1.325,bz,'campus_iron',g);
  b(3.8,2.36,.24,x,Y+1.55,bz,'campus_trim',g);b(3.96,.16,.34,x,Y+2.78,bz,'campus_slate',g);
  tx('EDUCATION',.27,x,Y+2.40,bz+.14,'campus_iron',g);tx('WELCOME TO CAMPUS',.123,x,Y+2.13,bz+.14,'campus_iron',g);
  tx('VIEW EDUCATION',.155,x,Y+.63,bz+.14,'campus_iron',g);
  obstacle('Education welcome guide',x,bz,3.8,.45,2.9);
  layout.stations.push({id:'education:overview',type:'read',contentId:'education',directoryOverview:true,readFull:true,readLabel:'Browse education',label:'Education overview',x,z,y:Y,hitArea:{x,y:Y+2.31,z:bz+.16,width:3.8,height:.67,yaw:0}});
  for(const[schoolId,label,yy,mat]of[['bu','BU / BOSTON UNIVERSITY',1.73,'campus_red'],['cmu','CMU / CARNEGIE MELLON',1.19,'campus_sandstone']]){
   b(3.48,.41,.035,x,Y+yy,bz+.15,mat,g);tx(label,.129,x,Y+yy-.07,bz+.18,'campus_trim',g);
   layout.stations.push({id:'education:directory-'+schoolId,type:'read',contentId:'learning',schoolId,directory:true,readFull:true,readLabel:'View education',label:schoolId==='bu'?'Boston University':'Carnegie Mellon University',x,z,y:Y,hitArea:{x,y:Y+yy,z:bz+.17,width:3.48,height:.41,yaw:0}});
  }
 }
 // Benches, planting and street furniture sit outside the 2.6 m circulation network.
 bench('bu-bench',-15.8,-2.4,0);bench('cmu-bench',19.2,-7.0,0);bench('coast-bench',-4,-16.5,0);
 for(const[id,x,z,h]of[['bu1',-23,-11,4.2],['bu2',-22.8,6.1,3.4],['bu3',-5,-10.5,4.0],['cmu1',22,-3,4.2],['cmu2',21.4,-10.7,4.4],['north',4.9,-16.7,3.6]])broadleaf(id,x,z,h);
 for(const[x,z]of[[21,5.9],[-2,-5],[13,10.8],[-2.8,12.1],[5.0,12.3]])planter(x,z);
 for(const[x,z]of[[-6.8,18.0],[6.8,18.0],[-5.6,12.7],[5.6,12.7],[-18,-11],[18,-15]]){lamp(x,z,'campus_iron',2.15);obstacle('campus lamp',x,z,.37,.37,3.25);}
 if(!low){books(18.4,1.57,-7);b(.5,.7,.35,20.4,Y+.35,-7,'campus_red');}
 // Shared loop leaves the welcome area, passes both campus courtyards and the north garden.
 // Each branch is authored before decorative paving, and checked against the same colliders.
 layout.route=[[0,27.5],[0,18],[0,10],[-9,10],[-9,8],[-5.5,8],[-5.5,1],[-8,-.6],[-15.8,-.6],[-8,-.6],[-5.5,1],[-7,-1.5],[-7,-6],[-7,-14],[-3,-14],[0,-13.8],[4.3,-14],[4.3,-7],[7,-5.8],[9,-5.8],[9,-2.35],[16,-2.35],[9,-2.35],[5.5,-2.35],[5.5,8],[9,8],[9,10],[0,10],[0,18],[0,27.5]];
 layout.paths=[
  {id:'campus-loop',width:2.6,points:layout.route},
  {id:'central-learning-walk',width:2.6,points:[[0,10],[2.8,6],[2.8,0],[2.8,-10],[4.3,-14]]},
  {id:'bu-plaza',width:2.6,points:[[-5.5,1],[-8,-.6],[-15.8,-.6]]},
  {id:'cmu-courtyard',width:2.6,points:[[16,-2.35],[20.3,-2.1],[20.3,-5.3],[19.2,-5.3]]},
  {id:'coastal-study-walk',width:2.6,points:[[-7,-14],[-4,-14.8],[-3,-14],[0,-13.8],[4.3,-14]]},
 ];
 const pavingPaths=layout.paths.map(path=>path.points.filter(p=>p[1]<layout.dock.startZ+.05));
 harborPath(pavingPaths.flat(),2.6,Y+.025,pavingPaths);
 // Shared plaza slightly above paths, avoiding z-fighting at multiple crossing strips.
 bx(12,.02,7,0,Y+.06,17,'campus_paving');
 layout.routeLength=+layout.route.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-layout.route[i][0],p[1]-layout.route[i][1]),0).toFixed(2);
 layout.estimatedWalkingSeconds=+(layout.routeLength/2.4).toFixed(1);layout.width=2.6;
 layout.validation={connectedFromDock:true,stationsReachable:layout.stations.length,routeClearance:1.2,pathWidth:2.6,campuses:2,landmarks:layout.landmarks.length};
 return {district};
}
