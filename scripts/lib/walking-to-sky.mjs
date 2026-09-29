// Original stylized miniature of Walking to the Sky by Jonathan Borofsky.
// Six fixed painted figures; no NPC, skeleton, or animation controller.
import * as THREE from 'three';

export function buildWalkingToSky(api) {
 const {district,layout,Y,low,b,tx,named,obstacle,footprint,mesh,cyl}=api;
 const p=api.placement||{},x=p.x??16,z=p.z??8.5,height=p.height??9.2;
 const dx=p.dx??(p.run!==undefined||p.yaw!==undefined?(p.run??Math.hypot(5.2,1.4))*Math.sin(p.yaw??Math.atan2(5.2,-1.4)):5.2);
 const dz=p.dz??(p.run!==undefined||p.yaw!==undefined?(p.run??Math.hypot(5.2,1.4))*Math.cos(p.yaw??Math.atan2(5.2,-1.4)):-1.4);
 const run=Math.hypot(dx,dz),yaw=Math.atan2(dx,dz),rise=height-.18,length=Math.hypot(run,rise);
 if(!(height>2&&run>.1))throw new Error('Walking to the Sky requires height > 2 and a nonzero horizontal run.');
 const zero=[0,0,0],up=new THREE.Vector3(0,1,0),tangent=new THREE.Vector3(0,rise,run).normalize();
 const normal=new THREE.Vector3(0,run,-rise).normalize(),slope=new THREE.Quaternion().setFromUnitVectors(up,tangent);
 // The source hierarchy retains descriptive part names. The existing campus
 // exporter need only preserve this single occluder, batching parts by material.
 const root=named('campus_walking_to_sky',x,Y,z,district);root.rotation.y=yaw;
 const art=named('occluder_campus_walking_to_sky',0,0,0,root);
 const base=named('sky_base',0,0,0,root);base.rotation.y=-yaw;
 const pole=named('sky_pole',0,0,0,art);
 const r0=.17,r1=.12;
 const poleMesh=cyl(r1,r0,length,0,(height+.18)/2,run/2,'campus_sculptureSteel',low?10:16,zero,pole);
 poleMesh.quaternion.copy(slope);
 const unitBall=new THREE.SphereGeometry(1,low?5:10,low?3:6);
 const hairCap=new THREE.SphereGeometry(1,low?6:10,low?3:5,0,Math.PI*2,0,Math.PI*.59);
 const ball=(at,scale,mat,parent,geometry=unitBall)=>{const m=mesh(geometry,mat,at,zero,parent);m.scale.set(...scale);return m;};
 ball([0,height,run],[r1,r1,r1],'campus_sculptureSteel',pole);
 // Grounded stone plinth and a small collar. Lettering faces the campus arrival
 // camera (+Z), independent of the pole's configurable horizontal direction.
 b(1.38,.25,1.04,0,.125,0,'campus_limestone',base);
 b(1.20,.055,.90,0,.2725,0,'campus_trim',base);
 const collar=cyl(.25,.27,.20,0,.25,0,'campus_sculptureSteel',low?10:16,zero,pole);collar.quaternion.copy(slope);
 b(1.24,.19,.035,0,.142,.539,'campus_bronze',base);
 tx('WALKING TO THE SKY',.060,0,.160,.561,'campus_trim',base);
 tx('JONATHAN BOROFSKY',.045,0,.087,.561,'campus_trim',base);
 if(!low)for(const xx of[-.56,.56])for(const yy of[.078,.209])ball([xx,yy,.563],[.012,.012,.008],'campus_iron',base);

 const world=(q)=>{const v=new THREE.Vector3(...q).applyAxisAngle(up,yaw);return{x:+(x+v.x).toFixed(5),y:+(Y+v.y).toFixed(5),z:+(z+v.z).toFixed(5)};};
 const specs=[
  {t:.20,shirt:'campus_paintBlue',pants:'campus_iron',skin:'campus_trim',hair:'campus_brickDark',size:1.02,stride:.22,lead:1},
  {t:.33,shirt:'campus_tram',pants:'campus_slate',skin:'campus_bronze',hair:'campus_iron',size:.99,stride:.20,lead:-1},
  {t:.46,shirt:'campus_red',pants:'campus_iron',skin:'campus_trim',hair:'campus_brickDark',size:1.00,stride:.23,lead:1},
  {t:.59,shirt:'campus_trim',pants:'campus_paintBlue',skin:'campus_bronze',hair:'campus_iron',size:1.04,stride:.21,lead:-1},
  {t:.72,shirt:'campus_paintGold',pants:'campus_iron',skin:'campus_trim',hair:'campus_brickDark',size:.97,stride:.22,lead:1},
  {t:.85,shirt:'campus_iron',pants:'campus_slate',skin:'campus_bronze',hair:'campus_iron',size:1.02,stride:.20,lead:-1},
 ];
 const figures=[];
 const figureRotation=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(1,0,0),normal,tangent));
 function limb(a,bb,r,mat,parent){
  const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...bb),d=bv.clone().sub(av),distance=d.length();
  const g=new THREE.CapsuleGeometry(r,Math.max(.001,distance-2*r),low?1:2,low?5:8);
  const m=mesh(g,mat,av.clone().add(bv).multiplyScalar(.5).toArray(),zero,parent);
  m.quaternion.setFromUnitVectors(up,d.normalize());return m;
 }
 for(let i=0;i<specs.length;i++){
  const s=specs[i],radius=r0+(r1-r0)*s.t,center=new THREE.Vector3(0,.18+rise*s.t,run*s.t).addScaledVector(normal,radius);
  const name='sky_walker_'+String(i+1).padStart(2,'0'),g=named(name,...center.toArray(),art);
  g.quaternion.copy(figureRotation);g.scale.setScalar(s.size);
  g.userData={staticSculpture:true,figureIndex:i+1,artist:'Jonathan Borofsky'};
  // A compact adult silhouette: broad shoulders, soft torso, a separate hip
  // mass, and substantial rounded sleeves/trouser legs rather than thin rods.
  ball([0,.653,.027],[.144,.196,.096],s.shirt,g);
  ball([0,.494,.017],[.122,.091,.084],s.pants,g);
  ball([0,.835,.049],[.047,.055,.044],s.skin,g);
  ball([0,.946,.061],[.088,.109,.086],s.skin,g);
  ball([0,.976,.051],[.094,.099,.091],s.hair,g,hairCap);
  ball([0,.946,.145],[.019,.025,.025],s.skin,g);
  if(!low){
   for(const side of[-1,1])ball([side*.086,.945,.060],[.020,.033,.025],s.skin,g);
   // A small visible collar gives the cream and dark jackets definition.
   for(const side of[-1,1]){const lapel=ball([side*.045,.805,.101],[.027,.044,.011],i===3?'campus_paintBlue':'campus_trim',g);lapel.rotation.z=side*.45;}
  }
  const contacts=[];
  for(const side of[-1,1]){
   const front=side===s.lead,footZ=front?s.stride:-s.stride*.92,footX=side*.064;
   // Each sole touches the upper cylinder at its lateral and longitudinal
   // position; the small radius change along the tapered pole is included.
   const footT=s.t+footZ*s.size/length,footRadius=r0+(r1-r0)*footT;
   const contactY=(Math.sqrt(Math.max(.0001,footRadius**2-(footX*s.size)**2))-radius)/s.size;
   const foot=[footX,contactY,footZ],ankle=[footX,contactY+.092,footZ];
   const knee=[side*.070,front?.294:.267,front?s.stride*.77:-s.stride*.51];
   const hip=[side*.075,.504,.020];
   limb(hip,knee,.062,s.pants,g);limb(knee,ankle,.047,s.pants,g);
   ball([footX,contactY+.034,footZ+.035],[.050,.034,.112],'campus_iron',g);
   if(!low)ball([footX,contactY+.013,footZ+.040],[.052,.013,.114],'campus_trim',g);
   // Opposing arm swing follows the leading leg, with a bent elbow and small
   // hands; the two poses alternate up the pole instead of cloning one stance.
   const forwardArm=!front;
   const shoulder=[side*.130,.774,.039];
   const elbow=[side*.181,.646,forwardArm?.155:-.066];
   const wrist=[side*.172,forwardArm?.601:.516,forwardArm?.243:-.123];
   limb(shoulder,elbow,.049,s.shirt,g);
   limb(elbow,wrist,.038,i===2?s.skin:s.shirt,g);
   ball(wrist,[.036,.043,.035],s.skin,g);
   const point=new THREE.Vector3(...foot).multiplyScalar(s.size).applyQuaternion(figureRotation).add(center);
   contacts.push(world(point.toArray()));
  }
  figures.push({name,index:i+1,t:s.t,garment:s.shirt,static:true,anchor:world(center.toArray()),footContacts:contacts});
 }
 // Physics is confined to the actual plinth and the cylinder below avatar
 // clearance. No rectangle is placed beneath the elevated sculpture span.
 obstacle('Walking to the Sky plinth',x,z,1.38,1.04,.30);
 const clearance=Math.min(p.clearanceHeight??1.9,height),tEnd=Math.min(1,(clearance-.18)/rise);
 const ex=dx*tEnd,ez=dz*tEnd,collisionRadius=r0+.025;
 obstacle('Walking to the Sky lower pole',x+ex/2,z+ez/2,Math.abs(ex)+collisionRadius*2,Math.abs(ez)+collisionRadius*2,clearance);
 footprint('walking-to-the-sky','cmu','Walking to the Sky',x,z,1.38,1.04);
 const entry={id:'walking-to-the-sky',name:'Walking to the Sky',artist:'Jonathan Borofsky',group:'occluder_campus_walking_to_sky',figureCount:6,static:true,base:{x,y:Y,z},poleStart:world([0,.18,0]),poleEnd:world([0,height,run]),direction:{x:dx/run,z:dz/run},height,run,yaw,baseFootprint:{x,z,width:1.38,depth:1.04},figures};
 layout.sculptures??=[];layout.sculptures.push(entry);
 return{root,art,pole,base,metadata:entry};
}
