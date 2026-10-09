// V17 Career Junction: one coherent, walkable coastal town. All support,
// collision, exhibit, rail and map data comes from these same authored dimensions.
import * as THREE from 'three';

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
 const {root,layout,low,Y=.85,box,bevel,cyl,cone,mesh,rod,torus,text3D,group,solid,custom,harborPath}=api;
 const zero=[0,0,0],AY=3.15,BY=1.85,VY=2.25,TRACK_RX=12.8,TRACK_RZ=7.6;
 const careerCameras={
  amtrak:{cameraTarget:{x:0,y:AY+3.5,z:-14},camera:{distance:43,fitBounds:{min:{x:-15,y:Y,z:-23.1},max:{x:15,y:AY+7.65,z:-4}}}},
  beaconfire:{cameraTarget:{x:-23,y:BY+2.7,z:-2},camera:{distance:36,fitBounds:{min:{x:-34,y:Y,z:-10.5},max:{x:-12,y:BY+7.9,z:12.5}}}},
  visionx:{cameraTarget:{x:23,y:VY+2.4,z:-3},camera:{distance:36,fitBounds:{min:{x:12,y:Y,z:-12},max:{x:34,y:VY+6,z:12}}}},
 };
 const D={amtrak:group(),beaconfire:group(),visionx:group()};
 for(const[id,g]of Object.entries(D))g.name='district_'+id;
 layout.landmarks=[];layout.interiors=[];layout.paths=[];
 const b=(w,h,d,x,y,z,m='junction_stone',p=D.amtrak,r=zero)=>bevel(w,h,d,x,y,z,m,.025,r,p);
 const bx=(w,h,d,x,y,z,m='junction_stone',p=D.amtrak,r=zero)=>box(w,h,d,x,y,z,m,r,p);
 const tx=(s,size,x,y,z,m='junction_steel',p=D.amtrak)=>text3D(s,size,x,y,z,m,.006,p);
 const named=(n,x=0,y=0,z=0,p=D.amtrak)=>{const g=group([x,y,z],zero,p);g.name=n;return g;};
 const obstruction=(n,x,z,w,d,h=2,y=Y,rotation=0)=>solid(x,z,w,d,h,y,rotation,n);
 const footprint=(id,contentId,label,x,z,width,depth,nodeGroup)=>layout.landmarks.push({id,contentId,label,x,z,width,depth,nodeGroup});
 const sph=(r,x,y,z,m='junction_leaf',p=D.amtrak,scale=[1,1,1])=>{const g=mesh(new THREE.SphereGeometry(r,low?7:10,low?4:7),m,[x,y,z],zero,p);g.scale.set(...scale);return g;};
 function bookStack(x,y,z,p){for(let i=0;i<3;i++){b(.46-i*.035,.07,.34,x+i*.026,y+i*.076,z,['junction_navy','junction_cream','junction_copper'][i],p);bx(.43-i*.035,.027,.345,x+i*.026,y+i*.076,z+.008,'junction_cream',p);}}
 function bench(id,contentId,x,z,y=Y,yaw=0){
  const g=named('junction_bench_'+id,x,y,z,D[contentId]);g.rotation.y=yaw;
  for(const zz of[-.23,0,.23])b(2.1,.10,.19,0,.55,zz,'junction_wood',g);
  for(const yy of[.91,1.12])b(2.1,.16,.11,0,yy,-.33,'junction_wood',g);
  for(const xx of[-.76,.76]){rod([xx,0,-.2],[xx,1.23,-.33],.044,'junction_steel',g,6);rod([xx,0,.22],[xx,.55,.22],.05,'junction_steel',g,6);}
  obstruction('junction bench '+id,x,z,2.15,.77,1.27,y,yaw);
  const item={id:contentId+':'+id,contentId,action:contentId,x,z,y:y+.58,yaw,rotation:yaw,approach:{x:x+Math.sin(yaw)*1.5,z:z+Math.cos(yaw)*1.5,y}};
  layout.benches.push(item);layout.bench??=item;
 }
 function terrace(id,x,z,w,d,y,p){
  bx(w,y-Y-.02,d,x,Y+(y-Y)/2-.01,z,'junction_sandstone',p);
  bx(w,.08,d,x,y-.04,z,'junction_paving',p);
  layout.surfaces.push({id,x,z,width:w,depth:d,y});
  // Horizontal masonry courses give the retaining walls a visible scale.
  for(let yy=Y+.28;yy<y-.10;yy+=.34){bx(w+.012,.026,.022,x,yy,z+d/2+.005,'junction_joint',p);bx(w+.012,.026,.022,x,yy,z-d/2-.005,'junction_joint',p);bx(.022,.026,d,x-w/2-.005,yy,z,'junction_joint',p);bx(.022,.026,d,x+w/2+.005,yy,z,'junction_joint',p);}
  if(!low)for(let xx=x-w/2+.75;xx<x+w/2;xx+=1.4){bx(.025,Math.min(.28,y-Y),.023,xx,y-.19,z+d/2+.02,'junction_joint',p);}
 }
 function fence(id,a,c,y,p,base=Y){
  const len=Math.hypot(c[0]-a[0],c[1]-a[1]),n=Math.ceil(len/2.2),angle=Math.atan2(c[0]-a[0],c[1]-a[1]);
  for(let i=0;i<=n;i++){const x=a[0]+(c[0]-a[0])*i/n,z=a[1]+(c[1]-a[1])*i/n;bx(.09,.83,.09,x,y+.415,z,'junction_steel',p);}
  for(const h of[.37,.79])rod([a[0],y+h,a[1]],[c[0],y+h,c[1]],.027,'junction_steel',p,6);
  obstruction('terrace edge '+id,(a[0]+c[0])/2,(a[1]+c[1])/2,.12,len,.9,y,angle);
  // Retaining wall stops lower-path access from below a raised garden edge.
  if(y>base+.25)obstruction('retaining wall '+id,(a[0]+c[0])/2,(a[1]+c[1])/2,.12,len,y-base,base,angle);
 }
 function ramp(id,x,z,width,depth,frontY,backY,p){
  const x0=x-width/2,x1=x+width/2,z0=z-depth/2,z1=z+depth/2,ground=Math.min(frontY,backY)-.04;
  const v=[[x0,ground,z0],[x1,ground,z0],[x1,ground,z1],[x0,ground,z1],[x0,backY,z0],[x1,backY,z0],[x1,frontY,z1],[x0,frontY,z1]];
  custom(v,[4,7,5,5,7,6,0,4,1,1,4,5,3,2,7,2,6,7,0,3,4,3,7,4,1,5,2,2,5,6],'junction_paving',p);
  const slope=(frontY-backY)/depth;
  layout.surfaces.push({id,x,z,width,depth,y:(frontY+backY)/2,slope,rotation:0});
  for(const side of[-1,1]){
   const xx=x+side*(width/2+.09);
   rod([xx,backY+.78,z0],[xx,frontY+.78,z1],.035,'junction_steel',p,6);
   for(let i=0;i<=4;i++){const zz=z0+depth*i/4,yy=backY+(frontY-backY)*i/4;bx(.10,.83,.10,xx,yy+.415,zz,'junction_steel',p);}
   // The visible wedge and long railing form one closed side, including the
   // spaces between posts. Short overlapping solids follow its sloped height
   // from the retaining base upward, so neither a terrace-side exit nor a
   // lower-ground approach can slip underneath the ramp. Both ends stay open.
   const segments=Math.ceil(depth/.5);
   for(let i=0;i<segments;i++){
    const a=Math.max(z0,z0+depth*i/segments-.006),b=Math.min(z1,z0+depth*(i+1)/segments+.006);
    const top=Math.max(backY+slope*(a-z0),backY+slope*(b-z0))+.87;
    obstruction('ramp side '+id+' '+side+' '+i,xx,(a+b)/2,.12,b-a,top-ground,ground);
   }
  }
 }
 function arch(x,y,z,w,h,p,glass=true,mat='junction_stone'){
  const stem=h-w/2,shape=new THREE.Shape();shape.moveTo(-w/2,0);shape.lineTo(w/2,0);shape.lineTo(w/2,stem);shape.absarc(0,stem,w/2,0,Math.PI,false);shape.closePath();
  if(glass)mesh(new THREE.ShapeGeometry(shape,low?8:14),'junction_glass',[x,y,z],zero,p);
  rod([x-w/2,y,z+.045],[x-w/2,y+stem,z+.045],.09,mat,p,7);rod([x+w/2,y,z+.045],[x+w/2,y+stem,z+.045],.09,mat,p,7);
  const n=low?9:15;for(let i=0;i<n;i++){const a=i*Math.PI/n,aa=(i+1)*Math.PI/n;rod([x+Math.cos(a)*w/2,y+stem+Math.sin(a)*w/2,z+.045],[x+Math.cos(aa)*w/2,y+stem+Math.sin(aa)*w/2,z+.045],.09,mat,p,7);}
  bx(w+.26,.13,.22,x,y-.06,z+.02,mat,p);
  if(glass){bx(.055,h-.14,.055,x,y+h/2-.08,z+.06,mat,p);bx(w,.052,.055,x,y+stem*.64,z+.06,mat,p);}
 }
 function canopy(name,x,z,w,d,y,rise,m,p){
  const g=named(name,0,0,0,p),n=low?12:20,vs=[],ix=[];
  for(const zz of[z-d/2,z+d/2])for(let i=0;i<=n;i++){const a=i*Math.PI/n;vs.push([x+Math.cos(a)*w/2,y+Math.sin(a)*rise,zz]);}
  for(let i=0;i<n;i++){const j=n+1+i;ix.push(i,i+1,j,i+1,j+1,j,j,i+1,i,j,j+1,i+1);}
  custom(vs,ix,m,g);
  for(let j=0;j<=(low?4:7);j++){const zz=z-d/2+d*j/(low?4:7);for(let i=0;i<n;i++){const a=i*Math.PI/n,aa=(i+1)*Math.PI/n;rod([x+Math.cos(a)*w/2,y+Math.sin(a)*rise+.04,zz],[x+Math.cos(aa)*w/2,y+Math.sin(aa)*rise+.04,zz],.047,'junction_steel',g,6);}}
  for(const xx of[x-w/2,x,x+w/2])rod([xx,y+(xx===x?rise:0)+.05,z-d/2],[xx,y+(xx===x?rise:0)+.05,z+d/2],.055,'junction_steel',g,6);
  return g;
 }
 function planter(x,z,w,d,y,p,variant=0){
  b(w,.32,d,x,y+.16,z,'junction_stone',p);bx(w-.13,.025,d-.13,x,y+.33,z,'junction_soil',p);
  for(let i=0;i<(low?3:5);i++){const xx=x-w*.36+i*w*.72/((low?3:5)-1);sph(.31,xx,y+.60,z,i%2?'junction_leafLight':'junction_leaf',p,[1,.86,.8]);if(variant)sph(.115,xx,y+.83,z,'junction_flower',p);}
  obstruction('junction planted border',x,z,w,d,.85,y);
 }
 function tree(id,x,z,y,p,h=4){
  const crown=named('occluder_junction_tree_'+id,0,0,0,p);
  rod([x,y,z],[x+.05,y+h*.77,z],.12,'junction_woodDark',p,7);
  for(const[dx,dz,s]of[[-.57,.16,1],[.50,.13,.9],[0,-.5,.85]]){rod([x,y+h*.4,z],[x+dx,y+h*.77,z+dz],.06,'junction_woodDark',p,6);sph(1.33,x+dx,y+h*.81,z+dz,'junction_leaf',crown,[s,.87*s,.87*s]);}
  obstruction('junction tree '+id,x,z,.34,.34,h,y);
 }
 function light(id,x,z,y,p){
  bx(.26,.14,.26,x,y+.07,z,'junction_stone',p);rod([x,y+.10,z],[x,y+2.4,z],.045,'junction_steel',p,7);b(.4,.42,.35,x,y+2.47,z,'junction_steel',p);bx(.27,.31,.24,x,y+2.47,z,'warmWindow',p);b(.53,.08,.47,x,y+2.74,z,'junction_steel',p);obstruction('junction lamp '+id,x,z,.30,.30,2.82,y);
 }
 function kiosk(id,contentId,label,sub,x,z,y=Y,primary=false,section=null){
  const p=D[contentId],g=named('station_'+id,0,0,0,p),zz=z-1.85,w=primary?5.0:3.9;
  for(const dx of[-w*.41,w*.41])bx(.13,2.15,.17,x+dx,y+1.075,zz,'junction_steel',g);
  b(w,1.95,.25,x,y+1.36,zz,'junction_stone',g);b(w+.19,.15,.53,x,y+2.43,zz,'junction_navy',g);
  const color={amtrak:'junction_navy',beaconfire:'junction_copper',visionx:'junction_teal'}[contentId];
  bx(.12,1.8,.027,x-w/2+.15,y+1.35,zz+.142,color,g);
  tx(label.toUpperCase(),primary?.31:.225,x,y+1.98,zz+.145,'junction_steel',g);
  sub.forEach((s,i)=>tx(s,.115,x,y+1.60-i*.21,zz+.145,'junction_steel',g));
  bx(w-.50,.39,.030,x,y+.68,zz+.145,color,g);tx(section?'READ DETAILS':'VIEW EXPERIENCE',.16,x,y+.61,zz+.178,'junction_cream',g);
  if(primary)tx({amtrak:'01',beaconfire:'02',visionx:'03'}[contentId],.27,x-w/2+.40,y+2.52,zz+.05,color,g);
  if(!low)for(const dx of[-w*.43,w*.43])for(const yy of[.53,2.20])cyl(.027,.027,.015,x+dx,y+yy,zz+.135,'junction_metal',6,[Math.PI/2,0,0],g);
  obstruction(label+' experience exhibit',x,zz,w,.42,2.57,y);
  const focus=careerCameras[contentId];
  layout.stations.push({id,type:'read',contentId,label,primary,readFull:!section,readLabel:section?'Read details':'View experience',...(section?{contentSection:section}:{}),x,z,y,...focus,hitArea:{x,y:y+1.36,z:zz+.167,width:w+.04,height:2.0,yaw:0}});
 }
 function smallSign(text,x,y,z,w,p){b(w,.34,.11,x,y,z,'junction_woodDark',p);tx(text,.14,x,y-.058,z+.07,'junction_cream',p);}
 // The unchanged shore/pier meets a generous low plaza, then three real terraces.
 terrace('amtrak-terrace',0,-13.55,30,19.1,AY,D.amtrak);
 terrace('beaconfire-terrace',-23,1,22,23,BY,D.beaconfire);
 terrace('visionx-terrace',23,0,22,24,VY,D.visionx);
 ramp('amtrak-arrival-ramp',0,3,4.2,14,Y,AY,D.amtrak);
 ramp('beaconfire-front-ramp',-23,16.5,4,8,Y,BY,D.beaconfire);
 ramp('beaconfire-rear-ramp',-23,-14.5,4,8,BY,Y,D.beaconfire);
 ramp('visionx-front-ramp',23,16,4,8,Y,VY,D.visionx);
 ramp('visionx-rear-ramp',23,-16.7,4,9.4,VY,Y,D.visionx);
 // Side walls and railings terminate before ramp openings.
 for(const[content,x,z,w,d,y]of[['amtrak',0,-13.55,30,19.1,AY],['beaconfire',-23,1,22,23,BY],['visionx',23,0,22,24,VY]]){
  const p=D[content],x0=x-w/2,x1=x+w/2,z0=z-d/2,z1=z+d/2;
  fence(content+' west',[x0,z0],[x0,z1],y,p);fence(content+' east',[x1,z0],[x1,z1],y,p);
  for(const zz of[z0,z1]){if(content==='amtrak'&&zz===z0)fence(content+' rear',[x0,zz],[x1,zz],y,p);else{fence(content+' edge-left '+zz,[x0,zz],[x-2.25,zz],y,p);fence(content+' edge-right '+zz,[x+2.25,zz],[x1,zz],y,p);}}
 }
 // Clear, readable entrance: three employers, distinct colors and direct actions.
 kiosk('amtrak:experience','amtrak','Amtrak',['FULL STACK ENGINEER','NOV 2024 - PRESENT','WORKFORCE SYSTEMS'],0,23,Y,true);
 kiosk('beaconfire:fullstack','beaconfire','BeaconFire',['FULL STACK ENGINEER','FEB 2024 - SEP 2024','SERVICES / MESSAGING / AI SEARCH'],-16,23,Y,true);
 kiosk('visionx:plants','visionx','VisionX',['SOFTWARE ENGINEER INTERN','MAY 2023 - AUG 2023','PLANT RECOMMENDATIONS'],16,23,Y,true);
 // Terminal: solid wings flank a genuinely open central concourse. Roof and wall
 // groups fade independently; no scenic roof becomes a character support plane.
 {
  const p=D.amtrak,walls=named('occluder_junction_terminal_walls',0,0,0,p),roof=named('occluder_junction_terminal_roof',0,0,0,p);
  const x=0,z=-14.8,w=18,d=7.2,front=-11.2,back=-18.4;
  footprint('career-station','amtrak','Amtrak Central',x,z,w,d,walls.name);
  bx(.28,4.9,d,-8.86,AY+2.45,z,'junction_sandstone',walls);bx(.28,4.9,d,8.86,AY+2.45,z,'junction_sandstone',walls);
  for(const side of[-1,1])for(const zz of[front,back]){const xx=side*5.52;bx(6.6,4.9,.24,xx,AY+2.45,zz,'junction_sandstone',walls);obstruction('terminal '+side+' wall '+zz,xx,zz,6.6,.24,4.9,AY);}
  for(const xx of[-8.86,8.86])obstruction('terminal side wall',xx,z,.28,d,4.9,AY);
  for(const zz of[front-.01,back+.01]){
   const face=named('terminal_arch_'+zz,0,0,0,walls);if(zz===back+.01){} // openings remain unobstructed in both walls
   arch(0,AY,zz+.15,4.45,4.15,face,false);
   for(const xx of[-6.9,-4.45,4.45,6.9])arch(xx,AY+.85,zz+.14,1.45,2.75,walls,true);
   bx(18.4,.22,.4,0,AY+4.58,zz,'junction_stone',walls);
  }
  // Roofed concourse with barrel-vault silhouette over lower tiled station wings.
  bx(18.65,.20,7.8,0,AY+5.0,z,'junction_navy',roof);
  for(const side of[-1,1]){const rx=side*5.55;bx(6.4,.20,7.7,rx,AY+5.15,z,'junction_navy',roof,[0,0,side*.055]);}
  canopy('occluder_junction_terminal_vault',0,-14.8,5.0,8.1,AY+5.16,1.7,'junction_navy',p);
  for(let i=0;i<(low?7:13);i++){const zz=-18.6+i*(low?1.27:.633);rod([-8.9,AY+5.22,zz],[-2.65,AY+5.22,zz],.022,'junction_copper',roof,5);rod([2.65,AY+5.22,zz],[8.9,AY+5.22,zz],.022,'junction_copper',roof,5);}
  b(8.1,.65,.30,0,AY+4.95,front+.23,'junction_navy',walls);tx('AMTRAK CENTRAL',.40,0,AY+4.79,front+.402,'junction_cream',walls);
  // Raised clock fronton anchors the rear composition rather than floating text.
  b(2.5,2.3,.64,0,AY+6.25,front-.35,'junction_sandstone',roof);
  b(2.95,.21,.89,0,AY+7.42,front-.35,'junction_stone',roof);
  cyl(.85,.85,.12,0,AY+6.34,front+.038,'junction_cream',low?20:32,[Math.PI/2,0,0],roof);
  torus(.91,.074,0,AY+6.34,front+.12,'junction_copper',zero,7,low?24:36,roof);
  for(let i=0;i<12;i++){const a=i*Math.PI/6;bx(.045,i%3===0?.15:.075,.025,Math.sin(a)*.73,AY+6.34+Math.cos(a)*.73,front+.133,'junction_navy',roof,[0,0,-a]);}
  rod([0,AY+6.34,front+.17],[.43,AY+6.58,front+.17],.035,'junction_navy',roof,7);rod([0,AY+6.34,front+.17],[-.19,AY+6.82,front+.17],.026,'junction_navy',roof,7);
  // Small canopy posts stand outside the 4.4 m crossing/entry axis.
  b(17.2,.15,1.7,0,AY+3.55,-10.7,'junction_navy',roof);
  for(const xx of[-8,-5.5,5.5,8]){bx(.11,3.55,.11,xx,AY+1.775,-10.1,'junction_copper',walls);obstruction('station canopy post',xx,-10.1,.14,.14,3.6,AY);}
  for(const xx of[-6.1,6.1]){
   bench('waiting-'+(xx<0?'west':'east'),'amtrak',xx,-15.1,AY,0);
   b(1.2,.74,.5,xx,AY+.37,-17.7,'junction_woodDark',p);b(1.03,.18,.42,xx,AY+.85,-17.7,'junction_cream',p);obstruction('station luggage trolley',xx,-17.7,1.4,.66,1.13,AY);
   for(const dx of[-.42,.42])cyl(.13,.13,.13,xx+dx,AY+.15,-17.65,'junction_steel',8,[0,0,Math.PI/2],p);
   rod([xx-.48,AY+.45,-17.9],[xx-.48,AY+1.27,-17.9],.035,'junction_steel',p,6);rod([xx-.48,AY+1.27,-17.9],[xx+.48,AY+1.27,-17.9],.035,'junction_steel',p,6);
  }
  layout.interiors.push({landmarkId:'career-station',floorY:AY,bounds:{x:0,z:-14.8,width:18,depth:7.2},entrances:[{id:'station-front',x:0,z:front,width:4.4,yaw:0},{id:'station-rear',x:0,z:back,width:4.4,yaw:Math.PI}],cutawayGroups:[walls.name,roof.name,'occluder_junction_terminal_vault'],walkRoute:[[0,-9.4],[0,-14.8],[0,-20]]});
  // Operations display attaches to the station wing, distinct from the action.
  kiosk('amtrak:workflow','amtrak','Workforce systems',['POSTINGS / BIDS / AWARDS','CONCEPT ILLUSTRATION'],-11,-4.65,AY,false);
  const signal=named('anim_signal',4.1,AY+2.25,-4.8,p);bx(.37,.87,.24,0,0,0,'junction_navy',signal);
  for(const yy of[-.22,.22])cyl(.105,.105,.035,0,yy,.14,yy>0?'orange':'yellow',10,[Math.PI/2,0,0],signal);
  rod([4.1,AY,-4.8],[4.1,AY+2.42,-4.8],.052,'junction_navy',p,7);obstruction('station signal',4.1,-4.8,.40,.35,2.8,AY);
  const board=named('anim_order',7.7,AY+1.65,-4.75,p);b(2.4,.90,.17,0,0,0,'junction_navy',board);tx('DEPARTURES',.14,0,.18,.11,'junction_cream',board);tx('JACK CENTRAL',.13,0,-.13,.11,'junction_cream',board);
  obstruction('departure display',7.7,-4.75,2.5,.28,2.3,AY);
  b(1.4,.7,.25,8.5,AY+.94,-4.75,'junction_stone',p);tx('DISPATCH',.17,8.5,AY+1.05,-4.60,'junction_navy',p);tx('TRY F',.13,8.5,AY+.76,-4.60,'junction_navy',p);obstruction('dispatch pedestal',8.5,-4.75,1.5,.35,1.4,AY);
  layout.stations.push({id:'amtrak:dispatch',type:'action',contentId:'amtrak',action:'amtrak',label:'Dispatch train',x:10,z:-5.0,y:AY});
  // Elliptic rail loop remains compatible with the proven animation controller.
  const rx=TRACK_RX,rz=TRACK_RZ,cz=-14,N=low?78:112;
  for(let i=0;i<N;i++){const a=i*Math.PI*2/N,x=rx*Math.cos(a),z=cz+rz*Math.sin(a),angle=Math.atan2(-rx*Math.sin(a),rz*Math.cos(a));bx(1.28,.043,.19,x,AY+.025,z,'junction_woodDark',p,[0,angle,0]);}
  for(const offset of[-.43,.43])for(let i=0;i<(low?96:144);i++){const a=i*Math.PI*2/(low?96:144),aa=(i+1)*Math.PI*2/(low?96:144);rod([(rx+offset)*Math.cos(a),AY+.060,cz+(rz+offset)*Math.sin(a)],[(rx+offset)*Math.cos(aa),AY+.060,cz+(rz+offset)*Math.sin(aa)],.033,'junction_metal',p,6);}
  for(const zz of[-14+rz,-14-rz]){
   for(let j=0;j<5;j++)bx(3.65,.024,.22,0,AY+.103,zz-.72+j*.36,'junction_cream',p);
   const noticeZ=zz>-14?-4.4:-23.0;
   for(const xx of[-3.1,3.1]){rod([xx,AY,noticeZ],[xx,AY+1.25,noticeZ],.035,'junction_steel',p,6);smallSign('LOOK',xx,AY+1.35,noticeZ,.82,p);obstruction('rail crossing notice',xx,noticeZ,.16,.16,1.65,AY);}
   layout.crossings.push({contentId:'amtrak',x:0,z:zz,y:AY,width:4.0,depth:2.8,trackCenter:[0,cz],trackRadii:[rx,rz]});
  }
  layout.crossing=layout.crossings[0];
  const train=named('anim_train',rx,AY,cz,p);train.rotation.y=Math.PI;
  b(1.22,.86,2.4,0,.81,0,'junction_navy',train);b(1.31,.18,2.5,0,1.30,0,'junction_cream',train);bx(1.25,.18,2.43,0,.46,0,'orange',train);
  b(1.15,.41,.23,0,1.14,-1.19,'junction_glass',train);bx(1.18,.12,.12,0,.56,-1.31,'junction_metal',train);
  for(const xx of[-.64,.64])for(const zz of[-.74,.75]){cyl(.235,.235,.14,xx,.285,zz,'junction_steel',12,[0,0,Math.PI/2],train);cyl(.10,.10,.153,xx,.285,zz,'junction_metal',10,[0,0,Math.PI/2],train);bx(.025,.43,.64,xx,1.00,zz,'junction_glass',train);}
  for(const xx of[-.38,.38])sph(.09,xx,.70,-1.32,'warmWindow',train);
  // Compact second car leaves full lateral clearance through the oval curves.
  b(1.18,.76,1.95,0,.76,2.5,'junction_cream',train);b(1.28,.15,2.03,0,1.20,2.5,'junction_navy',train);
  for(const xx of[-.61,.61])for(const zz of[1.92,3.02]){bx(.025,.39,.64,xx,.98,zz,'junction_glass',train);cyl(.22,.22,.13,xx,.27,zz,'junction_steel',10,[0,0,Math.PI/2],train);}
  rod([0,.4,1.2],[0,.4,1.62],.064,'junction_steel',train,6);
  layout.trainTrack={center:[0,AY,cz],radiusX:rx,radiusZ:rz,railY:AY+.06,points:Array.from({length:96},(_,i)=>{const a=i*Math.PI/48;return[rx*Math.cos(a),AY,cz+rz*Math.sin(a)];})};
 }
 // BeaconFire: brick piers, high sawtooth roof and a fully open software workshop.
 {
  const p=D.beaconfire,walls=named('occluder_junction_workshop_walls',0,0,0,p),roof=named('occluder_junction_workshop_roof',0,0,0,p);
  const x=-23,z=-2,w=14,d=8;
  footprint('software-workshop','beaconfire','BeaconFire Works',x,z,w,d,walls.name);
  for(const xx of[-30,-16]){bx(.26,4.65,8,xx,BY+2.325,z,'junction_brick',walls);obstruction('workshop sidewall',xx,z,.26,8,4.65,BY);}
  for(const zz of[-6,2])for(const side of[-1,1]){const xx=x+side*4.7;bx(4.5,4.4,.24,xx,BY+2.2,zz,'junction_brick',walls);obstruction('workshop portal wing',xx,zz,4.5,.24,4.4,BY);}
  for(const xx of[-29.75,-16.25])for(const zz of[-5.8,1.8]){bx(.29,4.95,.29,xx,BY+2.475,zz,'junction_steel',walls);}
  // Brick courses are material-local, not orange lighting painted onto everything.
  for(let yy=BY+.3;yy<BY+4.4;yy+=low?.64:.38)for(const side of[-1,1])bx(4.48,.025,.019,x+side*4.7,yy,2.135,'junction_brickJoint',walls);
  if(!low)for(let row=0;row<10;row++)for(let col=0;col<5;col++)for(const side of[-1,1])bx(.018,.30,.019,x+side*4.7-1.87+col*.86+(row%2)*.35,BY+.34+row*.38,2.147,'junction_brickJoint',walls);
  for(const xx of[-27.7,-18.3])arch(xx,BY+.76,2.17,2.4,2.9,walls,true,'junction_copper');
  bx(14.6,.21,8.6,x,BY+4.83,z,'junction_steel',roof);
  for(const xx of[-26.6,-19.4]){
   custom([[xx-3.5,BY+4.96,-6.3],[xx+3.5,BY+4.96,-6.3],[xx+1.0,BY+6.25,-6.3],[xx-3.5,BY+4.96,2.3],[xx+3.5,BY+4.96,2.3],[xx+1.0,BY+6.25,2.3]],[0,3,5,0,5,2,2,5,4,2,4,1,0,2,1,3,4,5],'junction_navy',roof);
   bx(.09,1.16,7.65,xx+1.02,BY+5.56,z,'junction_glass',roof);
   for(const zz of[-5.8,-3.9,-2,-.1,1.8])rod([xx+1.02,BY+5.0,zz],[xx+1.02,BY+6.25,zz],.043,'junction_copper',roof,6);
  }
  b(9.3,.67,.31,x,BY+4.37,2.28,'junction_navy',walls);tx('BEACONFIRE WORKS',.36,x,BY+4.21,2.46,'junction_cream',walls);
  b(5.4,.36,.12,x,BY+3.77,2.31,'junction_copper',walls);tx('BUILD / CONNECT / DELIVER',.16,x,BY+3.69,2.39,'junction_cream',walls);
  for(const xx of[-27.25,-18.75]){
   b(2.0,.13,3.6,xx,BY+.91,-1.85,'junction_wood',p);for(const dx of[-.76,.76])for(const zz of[-3.1,-.6])bx(.08,.85,.08,xx+dx,BY+.425,zz,'junction_steel',p);obstruction('workshop desk',xx,-1.85,2.0,3.6,1.03,BY);
   for(const zz of[-2.85,-.75]){b(.82,.64,.065,xx-.29,BY+1.28,zz,'junction_steel',p);bx(.69,.51,.023,xx-.29,BY+1.28,zz+.046,'junction_glass',p);bx(.72,.023,.28,xx-.22,BY+1.005,zz+.38,'junction_navy',p);bookStack(xx+.50,BY+1.06,zz+.06,p);}
  }
  for(const xx of[-29.3,-16.7]){b(.7,1.8,1.3,xx,BY+.9,-4.6,'junction_navy',p);for(let j=0;j<7;j++){bx(.62,.025,.015,xx,BY+.27+j*.21,-3.935,'junction_metal',p);sph(.035,xx+.21,BY+.32+j*.21,-3.922,'warmWindow',p);}obstruction('server cabinet',xx,-4.6,.8,1.4,1.9,BY);}
  // Copper beacon and small service roof use the same animated rotor as V1.
  const beaconX=-28.1,beaconZ=-3.7;cyl(.45,.53,1.45,beaconX,BY+6.18,beaconZ,'junction_copper',12,zero,roof);cyl(.42,.42,.51,beaconX,BY+7.12,beaconZ,'warmWindow',12,zero,roof);cone(.69,.40,beaconX,BY+7.55,beaconZ,'junction_steel',10,roof);
  const rotor=named('anim_rotor',beaconX,BY+6.78,beaconZ,p);for(let j=0;j<4;j++)bx(.70,.06,.16,Math.cos(j*Math.PI/2)*.31,0,Math.sin(j*Math.PI/2)*.31,'junction_metal',rotor,[0,-j*Math.PI/2,0]);
  // Public process nodes are grouped in the side courtyard, clear of the ramp.
  const nodeZ=6.55;
  for(let i=0;i<3;i++){const xx=-30.75+i*2.55;b(1.2,1.18,.78,xx,BY+.59,nodeZ,'junction_stone',p);b(.98,.62,.16,xx,BY+1.00,nodeZ+.48,'junction_navy',p);tx(['RETRIEVE','CONTEXT','RESPONSE'][i],.13,xx,BY+.99,nodeZ+.581,'junction_cream',p);const packet=named('anim_packet_'+i,xx-.55,BY+1.88,nodeZ,p);b(.36,.36,.36,0,0,0,i===1?'junction_teal':'junction_copper',packet);cyl(.10,.10,.07,xx,BY+1.28,nodeZ,'junction_metal',8,zero,p);obstruction('process node '+i,xx,nodeZ,1.35,.91,1.42,BY);}
  rod([-31.45,BY+1.62,nodeZ],[-24.95,BY+1.62,nodeZ],.068,'junction_copper',p,8);
  tx('CONCEPT ILLUSTRATION',.105,-28.2,BY+2.05,nodeZ+.04,'junction_steel',p);
  layout.stations.push({id:'beaconfire:pipeline',type:'action',contentId:'beaconfire',action:'beaconfire',label:'Run the pipeline',x:-28,z:8.45,y:BY});
  kiosk('beaconfire:rag','beaconfire','Retrieval to reply',['DOCUMENT SEARCH','CONCEPT ILLUSTRATION'],-17,8.7,BY,false);
  layout.interiors.push({landmarkId:'software-workshop',floorY:BY,bounds:{x,z,width:14,depth:8},entrances:[{id:'workshop-front',x,z:2,width:4.5,yaw:0},{id:'workshop-rear',x,z:-6,width:4.5,yaw:Math.PI}],cutawayGroups:[walls.name,roof.name],walkRoute:[[-23,5],[-23,-2],[-23,-9]]});
 }
 // VisionX: arched glass ribs, real open doorways and a central planting aisle.
 {
  const p=D.visionx,frame=named('occluder_junction_conservatory_frame',0,0,0,p),glass=named('occluder_junction_conservatory_glazing',0,0,0,p);
  const x=23,z=-3,w=13.4,d=10.4,front=2.2,back=-8.2;
  footprint('visionx-conservatory','visionx','VisionX Conservatory',x,z,w,d,frame.name);
  for(const xx of[16.3,29.7]){
   bx(.28,.63,d,xx,VY+.315,z,'junction_stone',frame);obstruction('conservatory side base',xx,z,.28,d,3.2,VY);
   for(let i=0;i<5;i++){const zz=back+1.04+i*2.08;bx(.058,2.55,1.96,xx,VY+1.91,zz,'junction_clear',glass);bx(.095,3.15,.12,xx,VY+1.575,back+i*2.08,'junction_teal',frame);}
   bx(.1,3.2,.1,xx,VY+1.6,front,'junction_teal',frame);bx(.12,.13,d+.2,xx,VY+3.22,z,'junction_teal',frame);
  }
  for(const zz of[front,back])for(const side of[-1,1]){const xx=x+side*4.55;bx(4.26,.6,.21,xx,VY+.30,zz,'junction_stone',frame);bx(4.12,2.46,.054,xx,VY+1.89,zz,'junction_clear',glass);obstruction('conservatory end wing',xx,zz,4.28,.21,3.2,VY);for(const dx of[-2.08,0,2.08])bx(.08,3.25,.12,xx+dx,VY+1.625,zz,'junction_teal',frame);}
  canopy('occluder_junction_conservatory_roof',x,z,w+.12,d+.32,VY+3.22,2.60,'junction_clear',p);
  // Front arch end cap retains visual transparency over the truly open doors.
  for(const zz of[front+.04,back-.04]){
   const n=low?16:24;for(let i=0;i<n;i++){const a=i*Math.PI/n,aa=(i+1)*Math.PI/n;rod([x+Math.cos(a)*w/2,VY+3.22+Math.sin(a)*2.6,zz],[x+Math.cos(aa)*w/2,VY+3.22+Math.sin(aa)*2.6,zz],.067,'junction_teal',frame,6);}
   for(const dx of[-4.6,-2.45,0,2.45,4.6]){const yy=2.6*Math.sqrt(1-(dx/(w/2))**2);rod([x+dx,VY+3.22,zz],[x+dx,VY+3.22+yy,zz],.042,'junction_teal',frame,6);}
  }
  b(8.5,.62,.27,x,VY+3.47,front+.24,'junction_teal',frame);tx('VISIONX CONSERVATORY',.295,x,VY+3.34,front+.405,'junction_cream',frame);
  for(const xx of[19.15,26.85]){
   b(2.15,.38,7.25,xx,VY+.57,-3,'junction_wood',p);for(const dx of[-.85,.85])for(const zz of[-5.85,-.15])bx(.11,.56,.11,xx+dx,VY+.28,zz,'junction_steel',p);obstruction('greenhouse growing bed',xx,-3,2.2,7.3,.90,VY);
   for(let j=0;j<4;j++){
    const zz=-5.7+j*1.75,n=j+(xx<23?0:4),plant=named('anim_plant_'+n,xx,VY+.94,zz,p);cyl(.32,.25,.43,xx,VY+.93,zz,'junction_copper',low?8:12,zero,p);
    rod([0,.10,0],[0,.92+(j%3)*.20,0],.028,'junction_leaf',plant,6);
    for(let k=0;k<(low?4:7);k++){const angle=k*Math.PI*.73,py=.23+k*.105,s=mesh(new THREE.SphereGeometry(.30,low?6:9,low?4:6),n%2?'junction_leaf':'junction_leafLight',[Math.cos(angle)*.22,py,Math.sin(angle)*.22],[0,angle,-.48],plant);s.scale.set(.48,.26,1.22);}
    if(n%3===0)sph(.16,0,1.08,0,'junction_flower',plant);
    b(.65,.17,.045,xx,VY+.76,zz+.43,'junction_cream',p);tx(['FERN','PALM','HERBS','CALATHEA'][j],.075,xx,VY+.724,zz+.465,'junction_steel',p);
   }
  }
  // A courtyard planting bed, copper watering station and real animated head.
  planter(29.8,8.6,3.9,1.45,VY,p,true);planter(14.3,8.6,3.0,1.25,VY,p);
  const sx=29.2,sz=5.3;rod([sx,VY,sz],[sx,VY+1.23,sz],.045,'junction_metal',p,7);const sprinkler=named('anim_sprinkler',sx,VY+1.23,sz,p);rod([-.59,0,0],[.59,0,0],.050,'junction_metal',sprinkler,7);for(const xx of[-.48,.48])cone(.065,.12,xx,.07,0,'junction_copper',8,sprinkler);
  obstruction('irrigation control',sx,sz,.30,.30,1.35,VY);b(1.7,.46,.18,29.2,VY+1.53,4.76,'junction_teal',p);tx('WATER THE GARDEN',.10,29.2,VY+1.47,4.87,'junction_cream',p);
  layout.stations.push({id:'visionx:water',type:'action',contentId:'visionx',action:'visionx',label:'Water the garden',x:29.2,z:6.75,y:VY});
  kiosk('visionx:assistant','visionx','Plant companions',['PERSONALIZATION / ASSISTANCE','CONCEPT ILLUSTRATION'],18.2,6.85,VY,false);
  layout.interiors.push({landmarkId:'visionx-conservatory',floorY:VY,bounds:{x,z,width:w,depth:d},entrances:[{id:'conservatory-front',x,z:front,width:4.7,yaw:0},{id:'conservatory-rear',x,z:back,width:4.7,yaw:Math.PI}],cutawayGroups:[frame.name,glass.name,'occluder_junction_conservatory_roof'],walkRoute:[[23,5],[23,-3],[23,-10.4]]});
 }
 // Coastal street furniture is deliberately clustered, leaving the formal path
 // and each exhibit approach unobstructed instead of scattering collider clutter.
 bench('harbor-seat','amtrak',7.2,21.4,Y,0);
 bench('workshop-seat','beaconfire',-32,4.1,BY,Math.PI/2);
 bench('garden-seat','visionx',31.8,-3,VY,-Math.PI/2);
 bench('coastal-seat','amtrak',-8,-22.6,AY,0);
 for(const[id,x,z,y,c,h]of[['bf-front',-31,14.8,Y,'beaconfire',4.6],['bf-back',-29,-14.1,Y,'beaconfire',4.1],['vx-front',31.2,15.8,Y,'visionx',4.8],['vx-back',30,-15.0,Y,'visionx',4.0],['harbor-west',-10.2,22.4,Y,'amtrak',3.7],['harbor-east',10.1,22.4,Y,'amtrak',3.7]])tree(id,x,z,y,D[c],h);
 for(const[id,x,z,y,c]of[['entry-left',-5.6,21.8,Y,'amtrak'],['entry-right',5.6,21.8,Y,'amtrak'],['station-left',-3.4,-4.85,AY,'amtrak'],['station-right',3.4,-4.85,AY,'amtrak'],['works-front',-26,11.2,BY,'beaconfire'],['green-front',26,10.8,VY,'visionx'],['coast-west',-18.1,-21.0,Y,'beaconfire'],['coast-east',18.2,-21.0,Y,'visionx']])light(id,x,z,y,D[c]);
 planter(-8,14,3.8,1.4,Y,D.amtrak,true);planter(8,14,3.8,1.4,Y,D.amtrak,true);
 for(const[txt,x,z,c]of[['AMTRAK CENTRAL',4.1,11.8,'amtrak'],['BEACONFIRE',-25.8,20.8,'beaconfire'],['VISIONX',25.8,20.8,'visionx']]){rod([x,Y,z],[x,Y+1.85,z],.055,'junction_woodDark',D[c],7);smallSign(txt,x,Y+1.8,z,2.45,D[c]);obstruction('junction direction sign',x,z,.17,.17,2.05,Y);}
 // One continuous route visits all three employers. Platform branches have the
 // exact same slopes as their visible ramps and exported Rapier rectangles.
 const dockZ=layout.dock.endZ-2.5;
 const careerLoop=[[0,25.8],[-8,25],[-21,23.8],[-23,22],[-23,20.5],[-23,12.5],[-23,5],[-23,-2],[-23,-10.5],[-23,-18.5],[-23,-20.5],[-20,-23],[-17,-24.6],[-14,-25],[0,-26],[14,-25],[17,-24.4],[20,-23.9],[23,-23],[23,-21.4],[23,-12],[23,-3],[23,12],[23,20],[23,22],[16,25],[0,25.8]];
 const stationAvenue=[[0,25.8],[-8,25],[-8,19],[0,16],[0,10],[0,-4],[0,-9.4],[0,-14.8],[0,-21.8]];
 layout.route=[[0,dockZ],...stationAvenue,...stationAvenue.slice(0,-1).reverse(),...careerLoop.slice(1),[0,dockZ]];
 layout.paths=[
  {id:'career-loop',kind:'walk',main:true,width:3.2,points:careerLoop},
  {id:'station-avenue',kind:'walk',main:true,width:3.2,points:stationAvenue.slice(1)},
  {id:'harbor-approach',kind:'walk',width:3.2,points:[[0,layout.dock.startZ],[0,25.8]]},
  {id:'company-directory',kind:'walk',width:3.2,points:[[-19.5,24.4],[19.5,24.4]]},
 ];
 // A single union avoids coplanar joins. Ground paving is naturally hidden by
 // terrace tops and ramp wedges, while the bridges keep their authored timber.
 const routes=layout.paths.map(p=>p.points),all=routes.flat();harborPath(all,3.2,Y+.015,routes);
 layout.routeLength=+layout.route.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-layout.route[i][0],p[1]-layout.route[i][1]),0).toFixed(2);
 layout.estimatedWalkingSeconds=+(layout.routeLength/2.4).toFixed(1);layout.width=3.2;
 layout.validation={connectedFromDock:true,routeClearance:1.3,pathWidth:3.2,mainPathWidth:3.2,terraces:3,stationsReachable:layout.stations.length,primaryExperienceEntries:3,openInteriors:3,stepFreeRamps:5};
 // Metadata uses meaningful district centres. Rebase only direct authored nodes:
 // world-space model geometry and all layout collider coordinates stay identical.
 const specs=[['amtrak',0,-14],['beaconfire',-23,-2],['visionx',23,-3]];
 layout.districts=specs.map(([id,x,z])=>{const g=D[id];for(const child of g.children){child.position.x-=x;child.position.z-=z;}g.position.set(x,0,z);return{id,x,y:0,z,rotation:0,group:g.name,...careerCameras[id]};});
 const ad=layout.districts[0];ad.crossing=layout.crossing;ad.animation={train:{trackCentre:[0,AY,0],trackRadii:[TRACK_RX,TRACK_RZ],initialAngle:0,rootY:AY,surfaceY:AY,forward:'-Z',duration:18}};
 const vd=layout.districts[2];vd.animation={sprinkler:{position:[6.2,VY+1.23,8.3],surfaceY:VY}};
 return {districts:D};
}
