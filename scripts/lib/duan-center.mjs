// Original stylized model of BU's Duan Center: a permeable podium and
// offset, sun-screened volumes. Visual upper floors are never ground obstacles.
import * as THREE from 'three';

export function buildDuanCenter(a) {
 const {district,layout,Y,low,b,bx,tx,named,obstacle,footprint,mesh,cyl,rod,books}=a;
 const zero=[0,0,0],x=-17,z=-8.5;
 const mark=(name)=>named('occluder_campus_duan_'+name);
 const ground=named('duan_ground');
 const structural=mark('ground_walls');
 const podium=mark('podium_roof');
 // Opaque floor meets the island at exactly the existing walk height. Paving
 // joints are only visual and never alter character ground sampling.
 bx(10,.07,7,x,Y-.035,z,'campus_paving',ground);
 for(let i=0;i<9;i++)bx(.016,.005,6.85,x-4.5+i*1.125,Y+.006,z,'campus_limestone',ground);
 for(let i=0;i<6;i++)bx(9.85,.005,.016,x,Y+.006,z-3+i*1.2,'campus_limestone',ground);
 layout.interiors=[{landmarkId:'duan-center',floorY:Y,bounds:{x,z,width:10,depth:7},entrances:[{id:'front',x:-17,z:-5,width:3.2,yaw:0},{id:'east',x:-12,z:-8.5,width:3,yaw:Math.PI/2}],walkRoute:[[-17,-3],[-17,-6.1],[-17,-8.5],[-10.6,-8.5]]}];
 // Wall segments, rather than a single tower-wide box, keep both doorways open.
 const wall=(id,xx,zz,w,d)=>{bx(w,2.55,d,xx,Y+1.275,zz,'campus_windowClear',structural);obstacle('Duan '+id,xx,zz,w,d,2.55);};
 wall('rear wall',x,-11.94,9.88,.12);wall('west wall',-21.94,z,.12,6.88);
 wall('front west glazing',-20.3,-5.06,3.28,.12);wall('front east glazing',-13.7,-5.06,3.28,.12);
 wall('east rear glazing',-12.06,-10.9,.12,2.08);wall('east front glazing',-12.06,-6.1,.12,2.08);
 for(const[xx,zz]of[[-21.9,-11.9],[-12.1,-11.9],[-21.9,-5.1],[-12.1,-5.1],[-18.7,-5.06],[-15.3,-5.06],[-12.06,-10.05],[-12.06,-6.95]]){
  bx(.14,2.8,.14,xx,Y+1.4,zz,'campus_silver',structural);obstacle('Duan structural column',xx,zz,.16,.16,2.8);
 }
 for(const zz of[-11.5,-10.5,-9.5,-8.5,-7.5,-6.5,-5.5])bx(.055,2.50,.06,-21.86,Y+1.25,zz,'campus_silver',structural);
 for(const xx of[-21,-20,-19,-15,-14,-13])bx(.055,2.50,.08,xx,Y+1.25,-5,'campus_silver',structural);
 // Visible vertical core at the back; circulation stays in front of it.
 b(2.05,2.75,1.15,-20.5,Y+1.375,-11.30,'campus_limestone',structural);obstacle('Duan circulation core',-20.5,-11.3,2.05,1.15,2.75);
 // A low recessed bookshelf occupies the already blocked core face beside the
 // reading nook, with no new obstacle or encroachment on the through-route.
 bx(1.78,1.03,.08,-20.5,Y+.57,-10.70,'campus_iron',structural);
 for(const yy of[.08,.54,1.06])bx(1.86,.065,.20,-20.5,Y+yy,-10.66,'wood',structural);
 for(const xx of[-21.39,-19.61])bx(.055,1.02,.20,xx,Y+.57,-10.66,'wood',structural);
 for(const yy of[.12,.58])for(let i=0;i<(low?5:8);i++){
  const xx=-21.23+i*(low?.32:.205),h=.27+(i%3)*.044;
  bx(low?.18:.13,h,.13,xx,Y+yy+h/2,-10.62,['campus_red','campus_trim','campus_slate','campus_paintGold'][i%4],structural);
  if(!low)bx(.10,.016,.012,xx,Y+yy+h*.74,-10.548,'campus_trim',structural);
 }
 cyl(.115,.085,.21,-21.1,Y+1.21,-10.65,'campus_trim',low?7:10,zero,structural);
 for(const[dx,dy]of[[-.10,.14],[.08,.24],[0,.37]]){
  rod([-21.1,Y+1.31,-10.65],[-21.1+dx,Y+1.31+dy,-10.65],.013,'campus_leaf',structural,5);
  const leaf=mesh(new THREE.IcosahedronGeometry(.115,low?0:1),'campus_leaf',[-21.1+dx,Y+1.31+dy,-10.65],zero,structural);leaf.scale.set(1,.45,.65);
 }
 // Recessed service panel and visible hinge/handle beside the books.
 bx(.39,1.5,.035,-19.9,Y+1.89,-10.707,'campus_silver',structural);
 rod([-19.78,Y+1.62,-10.67],[-19.78,Y+1.89,-10.67],.019,'campus_bronze',structural,5);
 b(10,.22,7,x,Y+2.8,z,'campus_silver',podium);
 bx(9.7,.08,6.8,x,Y+2.655,z,'campus_trim',podium);
 // Layered low front canopy and the literal architectural name on its fascia.
 b(9.9,.43,.35,x,Y+2.60,-4.93,'campus_iron',podium);
 tx('DUAN FAMILY CENTER',.23,x,Y+2.66,-4.73,'campus_trim',podium);
 tx('FOR COMPUTING & DATA SCIENCES',.12,x,Y+2.46,-4.73,'campus_trim',podium);
 for(const xx of[-19.9,-14.1])bx(2.0,.027,.08,xx,Y+2.39,-4.71,'warmWindow',podium);
 // Canopy drip edges, rain leaders and handles sit beside the open portals.
 for(const zz of[-11.97,-5.025])bx(9.84,.045,.035,x,Y+2.93,zz,'campus_iron',podium);
 for(const xx of[-21.83,-12.17])rod([xx,Y+.10,-11.87],[xx,Y+2.70,-11.87],.026,'campus_silver',structural,5);
 for(const xx of[-18.79,-15.21]){
  rod([xx,Y+.91,-4.94],[xx,Y+1.36,-4.94],.026,'campus_bronze',structural,6);
  for(const yy of[.96,1.31])rod([xx,Y+yy,-5.02],[xx,Y+yy,-4.94],.022,'campus_silver',structural,5);
 }
 for(const zz of[-10.15,-6.85])rod([-11.94,Y+.93,zz],[-11.94,Y+1.36,zz],.026,'campus_bronze',structural,6);

 // Four staggered tower volumes. Wide diagonal copper screens distinguish the
 // building from a generic glass box; floor-band thickness gives scale.
 const volumes=[
  {id:'lower',x:-16.8,z:-8.4,w:6.6,d:5.8,y:3.02,h:2.50,fins:false},
  {id:'middle',x:-18.05,z:-8.0,w:7.8,d:6.35,y:5.63,h:3.07,fins:true},
  {id:'upper',x:-17.55,z:-8.95,w:7.05,d:5.75,y:8.82,h:2.45,fins:true},
  {id:'crown',x:-16.5,z:-8.5,w:5.8,d:5.0,y:11.39,h:1.88,fins:false},
 ];
 for(const v of volumes){
  const g=mark(v.id),bottom=Y+v.y,top=bottom+v.h;
  bx(v.w,.16,v.d,v.x,bottom,v.z,'campus_silver',g);
  bx(v.w-.11,v.h-.13,v.d-.11,v.x,bottom+v.h/2,v.z,'campus_reflectionBlue',g);
  // Inset backing and a few warm spaces create depth behind the facade.
  bx(v.w-.55,v.h-.4,v.d-.55,v.x,bottom+v.h/2,v.z,'campus_iron',g);
  const count=low?Math.ceil(v.w/.78):Math.ceil(v.w/.53),pitch=v.w/count;
  for(let i=0;i<count;i++){
   const xx=v.x-v.w/2+(i+.5)*pitch,front=v.z+v.d/2+.025;
   bx(pitch-.055,v.h-.18,.055,xx,bottom+v.h/2,front,'campus_reflectionBlue',g);
   if(i%3===1)bx(pitch*.72,.13,.04,xx,bottom+.50,front+.035,'campus_reflectionGold',g);
   bx(.055,v.h,.10,xx-pitch/2,bottom+v.h/2,front+.055,'campus_silver',g);
   if(v.fins){const offset=low?.33:.30;rod([xx-offset,bottom+.09,front+.17],[xx+offset,top-.09,front+.17],low?.034:.038,'campus_bronze',g,4);}
  }
  for(const side of[-1,1]){
   const countZ=low?6:9;
   for(let i=0;i<countZ;i++){const zz=v.z-v.d/2+(i+.5)*v.d/countZ,xx=v.x+side*(v.w/2+.015);bx(.07,v.h-.15,v.d/countZ-.06,xx,bottom+v.h/2,zz,'campus_reflectionBlue',g);bx(.1,v.h,.048,xx,bottom+v.h/2,zz-v.d/countZ/2,'campus_silver',g);if(v.fins)rod([xx+side*.12,bottom+.10,zz-.22],[xx+side*.12,top-.10,zz+.22],.028,'campus_bronze',g,4);}
  }
  bx(v.w+.12,.12,v.d+.12,v.x,top,v.z,'campus_silver',g);
  if(!low)for(const xx of[-.28,.28])bx(v.w-.3,.016,.018,v.x, bottom-.088,v.z+xx*v.d,'campus_iron',g);
 }
 const roof=mark('terraces');
 // Low podium terrace: planting and thin guard rails, without public access.
 for(const zz of[-11.75,-5.25]){rod([-21.65,Y+3.41,zz],[-12.35,Y+3.41,zz],.026,'campus_silver',roof,5);for(const xx of[-21.65,-19.8,-18,-16.2,-14.3,-12.35])rod([xx,Y+2.93,zz],[xx,Y+3.41,zz],.022,'campus_silver',roof,5);}
 for(const xx of[-21.35,-12.65]){b(.65,.32,2.6,xx,Y+3.09,-8.5,'campus_slate',roof);for(let i=0;i<4;i++)mesh(new THREE.IcosahedronGeometry(.35,0),'campus_leaf',[xx,Y+3.48,-9.5+i*.65],zero,roof);}
 bx(3.2,.15,2.6,-16.5,Y+13.45,-8.5,'campus_slate',roof);
 for(const xx of[-17.2,-16.1]){b(.75,.26,1.25,xx,Y+13.23,-9,'campus_silver',roof);if(!low)for(let j=0;j<5;j++)bx(.58,.035,.032,xx,Y+13.37,-9.45+j*.19,'campus_iron',roof);}
 footprint('duan-center','bu','Duan Center',x,z,10,8);
 const cameraBounds={min:{x:-22.1,y:Y,z:-12.25},max:{x:-11.9,y:Y+13.53,z:-4.55}};
 layout.landmarks.at(-1).height=13.53;
 layout.landmarks.at(-1).walkableInterior=true;
 // Two table groups leave a 2.6m central aisle from the front to the east door.
 for(const[xx,zz]of[[-20.05,-6.45],[-14,-10.55]]){
  const furniture=named('duan_furniture');
  b(2.0,.12,1.0,xx,Y+.78,zz,'wood',furniture);for(const dx of[-.79,.79])for(const dz of[-.34,.34])bx(.075,.72,.075,xx+dx,Y+.36,zz+dz,'campus_iron',furniture);
  obstacle('Duan collaborative table',xx,zz-.2,2.2,1.9,1.22);
  for(const dx of[-.57,.57]){b(.60,.10,.55,xx+dx,Y+.45,zz-.7,'campus_red',furniture);b(.6,.64,.09,xx+dx,Y+.74,zz-.96,'campus_red',furniture);for(const dz of[-.9,-.5])for(const dd of[-.24,.24])bx(.045,.4,.045,xx+dx+dd,Y+.2,zz+dz,'campus_iron',furniture);}
  b(.52,.025,.34,xx-.45,Y+.865,zz,'campus_silver',furniture);b(.52,.32,.03,xx-.45,Y+1.03,zz-.13,'campus_iron',furniture,[.14,0,0]);bx(.45,.24,.012,xx-.45,Y+1.03,zz-.105,'campus_reflectionBlue',furniture,[.14,0,0]);
  b(.42,.06,.31,xx+.3,Y+.9,zz+.03,'campus_trim',furniture);bx(.012,.065,.32,xx+.3,Y+.9,zz+.03,'campus_red',furniture);
  cyl(.085,.073,.16,xx+.73,Y+.925,zz+.2,'campus_trim',8,zero,furniture);
  cyl(.11,.11,.04,xx+.75,Y+.88,zz-.2,'campus_iron',8,zero,furniture);rod([xx+.75,Y+.89,zz-.2],[xx+.72,Y+1.32,zz-.24],.02,'campus_bronze',furniture,5);b(.24,.07,.18,xx+.63,Y+1.32,zz-.16,'campus_trim',furniture);
 }
 // Corner reading seat is a real bench interaction, clear of the through-route.
 const seatX=-20.8,seatZ=-9.45;
 b(1.65,.38,.7,seatX,Y+.25,seatZ,'campus_iron',ground);b(1.62,.14,.68,seatX,Y+.51,seatZ,'campus_red',ground);b(1.65,.68,.13,seatX,Y+.74,seatZ-.34,'campus_red',ground);
 obstacle('Duan reading nook',seatX,seatZ,1.65,.8,1.13);
 layout.benches.push({id:'learning:duan-seat',contentId:'learning',action:'learning',label:'Read by the window',x:seatX,z:seatZ,y:Y+.6,rotation:0,yaw:0,approach:{x:seatX,z:seatZ+1.2,y:Y}});
 // Thin public information tablet attaches to the podium front glazing.
 const read=named('station_learning:duan',0,0,0,structural);
 b(2.60,1.18,.12,-13.8,Y+1.12,-4.93,'campus_iron',read);
 tx('DUAN CENTER',.205,-13.8,Y+1.39,-4.855,'campus_trim',read);tx('CAMPUS LANDMARK',.103,-13.8,Y+1.15,-4.855,'campus_trim',read);tx('ABOUT THIS LANDMARK',.101,-13.8,Y+.90,-4.855,'campus_paintGold',read);
 layout.stations.push({id:'learning:duan',type:'read',contentId:'learning',landmarkId:'duan-center',schoolId:'bu',primary:false,readFull:true,readLabel:'About this landmark',label:'Duan Center',x:-13.8,z:-3.35,y:Y,cameraTarget:{x:-17,y:6.1,z:-8.5},camera:{fitBounds:cameraBounds,distance:41},hitArea:{x:-13.8,y:Y+1.12,z:-4.85,width:2.65,height:1.25,yaw:0}});
 // Three authorable concept states share the rear wall. All are exported;
 // the runtime chooses visibility, retaining the state across quality swaps.
 const panelZ=-11.80,panelX=-16.25;
 b(3.6,2.12,.09,panelX,Y+1.3,panelZ,'campus_iron',structural);
 tx('EXPLORE THE BUILDING',.151,panelX,Y+2.1,panelZ+.08,'campus_trim',structural);tx('CONCEPT ILLUSTRATION',.097,panelX,Y+.45,panelZ+.08,'campus_trim',structural);
 for(let k=0;k<3;k++){
  const theme=named('anim_duan_theme_'+k),pulse=named('anim_duan_pulse_'+k,0,0,0,theme);
  tx(['SUNLIGHT','GROUND HEAT','COLLABORATION'][k],.18,panelX,Y+1.76,panelZ+.09,'campus_paintGold',theme);
  if(k===0){cyl(.22,.22,.035,panelX-.95,Y+1.27,panelZ+.095,'campus_paintGold',12,[Math.PI/2,0,0],theme);for(let j=0;j<3;j++)rod([panelX-.58,Y+1.17+j*.13,panelZ+.1],[panelX+.62,Y+.87+j*.13,panelZ+.1],.028,'campus_paintGold',pulse,5);bx(.48,.60,.06,panelX+.82,Y+1.07,panelZ+.1,'campus_reflectionBlue',theme);}
  if(k===1){for(let j=0;j<3;j++){const xx=panelX-.95+j*.94;rod([xx,Y+1.4,panelZ+.1],[xx,Y+.83,panelZ+.1],.035,'campus_paintRose',theme,5);rod([xx,Y+.83,panelZ+.1],[xx+.47,Y+.83,panelZ+.1],.035,'campus_paintBlue',theme,5);cyl(.09,.09,.05,xx+.42,Y+1.26,panelZ+.12,'campus_paintGold',10,[Math.PI/2,0,0],pulse);}}
  if(k===2){for(const[dx,dy]of[[-1,1.25],[0,1.00],[1,1.25]]){cyl(.17,.17,.035,panelX+dx,Y+dy,panelZ+.1,'campus_paintBlue',12,[Math.PI/2,0,0],theme);rod([panelX+dx,Y+dy,panelZ+.12],[panelX,Y+1.4,panelZ+.12],.025,'campus_paintGold',pulse,5);}}
 }
 layout.stations.push({id:'learning:duan-explore',type:'action',contentId:'learning',action:'education-duan',label:'Explore the building',x:panelX,z:-10.12,y:Y});
 return {cameraBounds};
}
