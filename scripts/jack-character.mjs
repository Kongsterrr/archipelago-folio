import * as THREE from 'three';
import {addJackHair} from './jack-hair.mjs';
import {mergeGeometries, mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';

/** Original V4.3 soft toy adventurer. Metres, feet Y=0, facing -Z.
 * Geometry is authored on one named skeleton. No runtime retargeting or IK is
 * required: the author-time helm solve is baked into constant animation keys. */
export const JACK_SPEC=Object.freeze({
 height:1.30,headHeight:.596,headsTall:1.30/.596,forward:'-Z',
 helmAuthorAnchor:[.292,.515,.005],helmAnchor:[.28324,-.26045,.00485],helmScale:.97,
 benchSeatOffset:.330,benchForwardOffset:.270,
 facial:{eyeBones:['LeftEye','RightEye'],browBones:['LeftBrow','RightBrow'],mouthBone:'Mouth',blinkAxis:'y',openScale:1,closedScale:.08,headBone:'Head',gazeYawLimit:.16,gazePitchLimit:.08},
 clips:['idle','walk','run','helm','interact','sit','stand'],
});

export function createJackCharacter(){
 const root=new THREE.Group();root.name='Jack';const bones=[],byName={};
 const bone=(name,parent,x=0,y=0,z=0)=>{const b=new THREE.Bone();b.name=name;b.position.set(x,y,z);(parent||root).add(b);bones.push(b);byName[name]=b;return b;};
 const hips=bone('Hips',null,0,.405,0),spine=bone('Spine',hips,0,.10,0),chest=bone('Chest',spine,0,.11,0);
 const neck=bone('Neck',chest,0,.125,0),head=bone('Head',neck,0,.264,0);
 bone('LeftEye',head,-.087,-.047,-.211);bone('RightEye',head,.087,-.047,-.211);
 bone('LeftBrow',head,-.087,.040,-.220);bone('RightBrow',head,.087,.040,-.220);bone('Mouth',head,0,-.159,-.200);
 for(const[side,s]of[['Left',-1],['Right',1]]){
  const arm=bone(`${side}Arm`,chest,s*.146,.074,0),elbow=bone(`${side}ForeArm`,arm,0,-.155,0);bone(`${side}Hand`,elbow,0,-.155,0);
  const thigh=bone(`${side}UpLeg`,hips,s*.072,-.02,0),shin=bone(`${side}Leg`,thigh,0,-.137,0);bone(`${side}Foot`,shin,0,-.162,0);
 }
 root.updateMatrixWorld(true);
 const materials={
  skin:new THREE.MeshStandardMaterial({name:'Jack_Skin',color:'#ffffff',vertexColors:true,roughness:.72}),
  cream:new THREE.MeshStandardMaterial({name:'Jack_CreamCanvas',color:'#ffffff',vertexColors:true,roughness:.84}),
  navy:new THREE.MeshStandardMaterial({name:'Jack_NavyKnit',color:'#ffffff',vertexColors:true,roughness:.9}),
  hair:new THREE.MeshStandardMaterial({name:'Jack_SweptHair',color:'#ffffff',vertexColors:true,roughness:.72}),
  ink:new THREE.MeshStandardMaterial({name:'Jack_EyesAndDetails',color:'#ffffff',vertexColors:true,roughness:.18}),
  accent:new THREE.MeshStandardMaterial({name:'Jack_OrangeDetails',color:'#ffffff',vertexColors:true,roughness:.7}),
 };
 const defaults={skin:'#f0bd98',cream:'#fff0d7',navy:'#293e52',hair:'#332720',ink:'#151a1e',accent:'#e18b4d'};
 const bins=new Map(Object.keys(materials).map(k=>[k,[]]));
 const part=(geometry,mat,joint,pos=[0,0,0],scale=[1,1,1],rot=[0,0,0],color=null)=>{
  const g=geometry,b=byName[joint];g.applyMatrix4(b.matrixWorld.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(...pos),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),new THREE.Vector3(...scale))));
  for(const name of Object.keys(g.attributes))if(!['position','normal'].includes(name))g.deleteAttribute(name);
  g.clearGroups();if(!g.index)g.setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i));
  const n=g.attributes.position.count,ids=new Uint16Array(n*4),weights=new Float32Array(n*4),colors=new Float32Array(n*3),tint=new THREE.Color(color||defaults[mat]);
  for(let i=0;i<n;i++){ids[i*4]=bones.indexOf(b);weights[i*4]=1;colors.set(tint.toArray(),i*3);}
  g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(ids,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));bins.get(mat).push(g);
 };
 const orb=(mat,joint,pos,scale,seg=16,rings=10,color)=>part(new THREE.SphereGeometry(1,seg,rings),mat,joint,pos,scale,undefined,color);
 const capsule=(mat,joint,pos,size,color)=>{const[w,h,d]=size,r=Math.min(w,h,d)/2,g=new THREE.CapsuleGeometry(r,Math.max(0,h-r*2),4,10);part(g,mat,joint,pos,[w/(r*2),1,d/(r*2)],undefined,color);};
 const soft=(mat,joint,pos,size,rot=[0,0,0],r=.02,color)=>{
  const[w,h,d]=size;r=Math.min(r,w*.28,h*.28,d*.28);const a=w/2-r,b=h/2-r,s=new THREE.Shape();
  s.moveTo(-a,-b);s.lineTo(a,-b);s.lineTo(a,b);s.lineTo(-a,b);s.closePath();const g=new THREE.ExtrudeGeometry(s,{depth:d-2*r,bevelEnabled:true,bevelThickness:r,bevelSize:r,bevelSegments:3,steps:1});g.translate(0,0,-d/2+r);part(g,mat,joint,pos,undefined,rot,color);
 };
 const rod=(mat,joint,a,b,r=.006,color)=>{const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),delta=bv.clone().sub(av),g=new THREE.CylinderGeometry(r,r,delta.length(),7);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));part(g,mat,joint,av.add(bv).multiplyScalar(.5).toArray(),undefined,undefined,color);};
 const curve=(mat,joint,points,r,segments=12,color)=>part(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),segments,r,6,false),mat,joint,undefined,undefined,undefined,color);
 // Taper facial strokes into the skin so brows and smile have soft tips,
 // rather than the flat ends of a cut tube.
 const facialCurve=(mat,joint,points,r,segments,color)=>{
  const path=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),g=new THREE.TubeGeometry(path,segments,r,8,false),p=g.getAttribute('position');
  for(let i=0;i<=segments;i++){const center=path.getPointAt(i/segments),scale=.18+.82*Math.pow(Math.sin(Math.PI*i/segments),.45);for(let j=0;j<=8;j++){const n=i*9+j,v=new THREE.Vector3().fromBufferAttribute(p,n).sub(center).multiplyScalar(scale).add(center);p.setXYZ(n,...v.toArray());}}
  g.computeVertexNormals();part(g,mat,joint,undefined,undefined,undefined,color);
 };
 // Continuous rounded cloth with a smooth two-joint weight transition.
 // The cylinder rings retain the same cross-section through the hinge, so bent
 // arms and knees deform as soft clothing rather than stacked rigid beads.
 const cloth=(mat,upper,lower,profile,hinge,depthScale=1,color)=>{
  const vs=[],ix=[],radial=14;
  for(const[y,r]of profile)for(let j=0;j<=radial;j++){const a=j/radial*Math.PI*2;vs.push(Math.cos(a)*r,y,Math.sin(a)*r*depthScale);}
  for(let i=0;i<profile.length-1;i++)for(let j=0;j<radial;j++){const a=i*(radial+1)+j,b=a+radial+1;ix.push(a,a+1,b,a+1,b+1,b);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vs,3));g.setIndex(ix);g.computeVertexNormals();
  part(g,mat,upper,undefined,undefined,undefined,color);
  const ids=g.getAttribute('skinIndex'),weights=g.getAttribute('skinWeight'),lo=bones.indexOf(byName[lower]),hi=bones.indexOf(byName[upper]);
  for(let i=0;i<profile.length;i++){const y=profile[i][0],t=THREE.MathUtils.smoothstep(hinge-y,-.04,.04);for(let j=0;j<=radial;j++){const k=i*(radial+1)+j;ids.setXYZW(k,hi,lo,0,0);weights.setXYZW(k,1-t,t,0,0);}}
 };
 // A broad round head, full cheeks, small chin and a low-set friendly face.
 const face=new THREE.SphereGeometry(1,36,26),fp=face.getAttribute('position');
 const facePoint=(x,y,extra=.002)=>{
  const sy=(y+.015)/.28,cheek=1+.055*Math.exp(-(((sy+.36)/.52)**2)),sx=x/(.246*cheek);
  return [x,y,-.222*Math.sqrt(Math.max(.001,1-sx*sx-sy*sy))*(1-.025*sy)-extra];
 };
 for(let n=0;n<fp.count;n++){const x=fp.getX(n),y=fp.getY(n),z=fp.getZ(n),cheek=1+.055*Math.exp(-(((y+.36)/.52)**2));fp.setXYZ(n,x*.246*cheek,y*.28-.015,z*.222*(1-.025*y));}
 face.computeVertexNormals();const faceTints=[];
 for(let n=0;n<fp.count;n++){const x=fp.getX(n),y=fp.getY(n),z=fp.getZ(n),dx=(Math.abs(x)-.156)/.046,dy=(y+.109)/.030,blush=Math.exp(-(dx*dx+dy*dy)*1.5)*.32*Math.max(0,Math.min(1,-z/.12));faceTints.push(...new THREE.Color('#f0bd98').lerp(new THREE.Color('#e48d82'),blush).toArray());}
 part(face,'skin','Head');face.setAttribute('color',new THREE.Float32BufferAttribute(faceTints,3));
 for(const[side,s]of[['Left',-1],['Right',1]]){
  orb('skin','Head',[s*.246,-.058,.009],[.032,.049,.034],14,10);
  orb('skin','Head',[s*.262,-.058,-.012],[.014,.027,.012],10,8,'#dca080');
  // Follow the cheek surface rather than projecting a spherical button out of
  // the face. Iris, pupil and catchlights still share one blink pivot.
  const eyePart=(mat,pos,scale,segments,rings,color)=>{
   const g=new THREE.SphereGeometry(1,segments,rings);g.scale(...scale);g.translate(...pos);g.rotateY(-s*.34);part(g,mat,`${side}Eye`,undefined,undefined,undefined,color);
  };
  eyePart('ink',[0,0,0],[.034,.044,.009],18,12,'#2e2421');
  eyePart('ink',[0,-.003,-.008],[.025,.031,.003],16,10,'#72513b');
  eyePart('ink',[0,.002,-.010],[.019,.025,.002],16,10,'#241d1b');
  eyePart('cream',[-.010,.015,-.012],[.007,.009,.002],12,8,'#fffdf5');
  eyePart('cream',[.011,-.014,-.011],[.003,.004,.0015],10,7,'#f3e8dc');
  const brow=[facePoint(s*.058,.032,.009),facePoint(s*.086,.040,.009),facePoint(s*.116,.031,.008)];
  facialCurve('hair',`${side}Brow`,brow.map(p=>[p[0]-s*.087,p[1]-.040,p[2]+.220]),.006,10,'#634536');

 }
 orb('skin','Head',[0,-.101,-.217],[.023,.020,.025],16,10,'#eab18e');
 facialCurve('ink','Mouth',[facePoint(-.033,-.152,.004),facePoint(-.015,-.164,.005),facePoint(.012,-.164,.005),facePoint(.034,-.151,.004)].map(p=>[p[0],p[1]+.159,p[2]+.200]),.0037,14,'#995b48');
 // One sculpted hair surface with a rolled hairline and no detached locks.
 addJackHair(THREE,part);
 // A compact puffy bomber with rounded sleeves and a continuous belly.
 orb('skin','Neck',[0,.005,0],[.055,.052,.049],14,10);
 orb('cream','Chest',[0,-.015,.011],[.158,.167,.113],20,14);
 orb('navy','Chest',[0,.094,-.041],[.058,.043,.073],14,10,'#2f4353');
 for(const s of[-1,1]){
  orb('cream','Chest',[s*.065,.099,-.055],[.058,.044,.050],14,10,'#fff4df');
  curve('accent','Chest',[[s*.088,-.047,-.086],[s*.102,-.066,-.084],[s*.113,-.083,-.077]],.004,10,'#cb8956');
  curve('cream','Chest',[[s*.128,.049,-.061],[s*.147,-.018,-.045],[s*.128,-.106,-.050]],.0026,12,'#decaa9');
 }
 capsule('cream','Chest',[0,-.153,.010],[.242,.038,.168],'#e6d7bb');
 curve('accent','Chest',[[0,.092,-.098],[0,.033,-.106],[0,-.057,-.101],[0,-.139,-.069]],.0042,15,'#bc8152');
 capsule('accent','Chest',[.012,.022,-.112],[.015,.035,.010]);
 orb('ink','Chest',[0,.044,-.111],[.008,.008,.003],10,7,'#a77a4e');
 // Tiny orange fabric chest patch and seam are legible from normal play distance.
 soft('accent','Chest',[-.089,.032,-.084],[.037,.025,.006],[0,-.40,0],.003,'#e9a15b');
 rod('cream','Chest',[-.101,.032,-.091],[-.077,.032,-.095],.002,'#fff4df');
 orb('navy','Hips',[0,0,.007],[.127,.075,.095],18,12,'#2b4153');
 capsule('navy','Hips',[0,.040,.005],[.224,.039,.160],'#23384b');
 rod('navy','Hips',[0,.021,-.085],[0,-.037,-.085],.0025,'#3b5368');
 for(const[side,s]of[['Left',-1],['Right',1]]){
  cloth('cream',`${side}Arm`,`${side}ForeArm`,[[.040,0],[.033,.029],[.017,.054],[0,.064],[-.04,.066],[-.08,.064],[-.115,.061],[-.140,.060],[-.155,.059],[-.17,.058],[-.195,.057],[-.225,.055],[-.255,.053],[-.279,.049],[-.294,.027],[-.300,0]],-.155,1.05);
  capsule('cream',`${side}ForeArm`,[0,-.135,0],[.102,.039,.108],'#e5d3b3');
  curve('accent',`${side}ForeArm`,[[s*.042,-.109,-.027],[s*.044,-.125,-.025],[s*.042,-.144,-.020]],.003,7,'#d79555');
  orb('skin',`${side}Hand`,[0,-.011,-.004],[.042,.043,.039],16,12);
  orb('skin',`${side}Hand`,[-s*.031,-.007,-.022],[.019,.025,.021],12,9);
  cloth('navy',`${side}UpLeg`,`${side}Leg`,[[.047,0],[.040,.032],[.026,.053],[.007,.064],[-.025,.066],[-.06,.065],[-.095,.063],[-.120,.061],[-.137,.060],[-.155,.059],[-.18,.059],[-.215,.058],[-.25,.057],[-.277,.054],[-.292,.03],[-.300,0]],-.137,1.15,'#2c4254');
  capsule('navy',`${side}Leg`,[0,-.147,.003],[.119,.031,.134],'#3a5062');
  // Soft oversized sneaker volumes overlap into one silhouette, with no box joints.
  capsule('cream',`${side}Foot`,[0,-.072,-.030],[.153,.028,.235],'#e0d1b7');
  orb('cream',`${side}Foot`,[0,-.020,-.034],[.075,.045,.111],18,10,'#fff2dd');
  orb('cream',`${side}Foot`,[0,.006,.038],[.056,.044,.060],16,10,'#f3e5ce');
  for(const z of[-.060,-.033])curve('cream',`${side}Foot`,[[-.030,.018,z],[0,.025,z-.002],[.030,.018,z]],.004,7,'#ddccae');
  curve('accent',`${side}Foot`,[[s*.068,-.006,-.046],[s*.073,-.004,-.018],[s*.069,.001,.004]],.005,8);
 }
 // Normalize only the hair's crown to exactly 1.30m; face and body proportions
 // stay authored in metres and all footwear shares the Y=0 contact datum.
 let crown=-Infinity;for(const g of bins.get('hair')){const pos=g.getAttribute('position');for(let i=0;i<pos.count;i++)crown=Math.max(crown,pos.getY(i));}
 for(const g of bins.get('hair')){const pos=g.getAttribute('position');for(let i=0;i<pos.count;i++){const y=pos.getY(i);if(y>1.15)pos.setY(i,1.15+(y-1.15)*(1.30-1.15)/(crown-1.15));}g.computeVertexNormals();}
 const skeleton=new THREE.Skeleton(bones);skeleton.calculateInverses();
 for(const[key,gs]of bins){const geometry=mergeVertices(mergeGeometries(gs,false),1e-6);geometry.normalizeNormals();const mesh=new THREE.SkinnedMesh(geometry,materials[key]);mesh.name=materials[key].name;mesh.bind(skeleton);mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;root.add(mesh);}
 const bind=Object.fromEntries(bones.map(b=>[b.name,{p:b.position.toArray(),q:b.quaternion.toArray()}]));
 const emptyPose=()=>Object.fromEntries(bones.map(b=>[b.name,{p:[...bind[b.name].p],r:[0,0,0]}]));
 // Solve the two arm chains once against the neutral wheel. The exact constant
 // rotations are baked into all helm frames; steering never changes these keys.
 const solveHelm=()=>{
  const r=emptyPose();r.Spine.r=[-.26,0,0];r.Chest.r=[-.07,0,0];r.Neck.r=[.21,0,0];
  for(const b of bones){b.position.fromArray(r[b.name].p);b.rotation.set(...r[b.name].r);}root.updateMatrixWorld(true);
  for(const[side,s]of[['Left',-1],['Right',1]]){
   const arm=byName[`${side}Arm`],S=arm.getWorldPosition(new THREE.Vector3()),T=new THREE.Vector3(s*.093,.435,-.228),D=T.clone().sub(S),d=D.length(),u=D.normalize(),a=(.155**2-.155**2+d*d)/(2*d),h=Math.sqrt(Math.max(0,.155**2-a*a));
   const pole=new THREE.Vector3(s*.25,-.05,.8);pole.addScaledVector(u,-pole.dot(u)).normalize();const E=S.clone().addScaledVector(u,a).addScaledVector(pole,h);
   const upperQ=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,-1,0),E.clone().sub(S).normalize()),lowerQ=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,-1,0),T.clone().sub(E).normalize());
   r[`${side}Arm`].r=new THREE.Euler().setFromQuaternion(arm.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(upperQ)).toArray().slice(0,3);
   r[`${side}ForeArm`].r=new THREE.Euler().setFromQuaternion(upperQ.clone().invert().multiply(lowerQ)).toArray().slice(0,3);
   const handQ=new THREE.Quaternion().setFromEuler(new THREE.Euler(.10,0,-s*.10));r[`${side}Hand`].r=new THREE.Euler().setFromQuaternion(lowerQ.clone().invert().multiply(handQ)).toArray().slice(0,3);
  }
  for(const b of bones){b.position.fromArray(bind[b.name].p);b.quaternion.fromArray(bind[b.name].q);}root.updateMatrixWorld(true);return r;
 };
 const helmPose=solveHelm();
 const pose=(state,t)=>{
  const r=emptyPose(),p=(name,x=0,y=0,z=0)=>{r[name].r=[x,y,z];};
  if(state==='helm'||state==='sit'){
   for(const side of['Left','Right']){p(`${side}UpLeg`,1.235);p(`${side}Leg`,-1.235);}
   p('Spine',-.12);p('Chest',.025);
   if(state==='helm'){p('Spine',-.26);p('Chest',-.07);p('Neck',.21);for(const side of['Left','Right'])for(const segment of['Arm','ForeArm','Hand'])r[side+segment].r=[...helmPose[side+segment].r];}
   else{for(const[side,s]of[['Left',-1],['Right',1]]){p(`${side}Arm`,.36,0,-s*.13);p(`${side}ForeArm`,1.05);}p('Head',-.035,Math.sin(t*Math.PI)*.025);}
  }else if(state==='walk'||state==='run'){
   const running=state==='run',cycle=t*Math.PI*2/(running?.48:.72),amp=running?.75:.48;
   r.Hips.p[1]+=(running?.010:.005)*Math.sin(cycle*2);
   p('Spine',running?-.10:-.02,Math.sin(cycle)*.025,Math.sin(cycle)*.025);p('Head',running?.06:.015,0,-Math.sin(cycle)*.02);
   for(const[side,s]of[['Left',1],['Right',-1]]){const swing=Math.sin(cycle)*s;p(`${side}UpLeg`,swing*amp);p(`${side}Leg`,-Math.max(0,-swing)*(running?.9:.48));p(`${side}Foot`,Math.max(0,swing)*.12);p(`${side}Arm`,-swing*(running?.50:.32),0,side==='Left'?.06:-.06);p(`${side}ForeArm`,running?.78:.26);}
  }else if(state==='stand'){
   const u=Math.min(1,t/.6),s=1-u*u*(3-2*u);for(const side of['Left','Right']){p(`${side}UpLeg`,1.235*s);p(`${side}Leg`,-1.235*s);p(`${side}Arm`,.36*s,0,side==='Left'?.06+.07*s:-.06-.07*s);p(`${side}ForeArm`,1.05*s);}p('Spine',-.12*s);p('Chest',.025*s);
  }else if(state==='interact'){
   const e=Math.sin(Math.PI*Math.min(1,t/1.1));p('RightArm',e*1.12,0,-.10);p('RightForeArm',e*.30);p('RightHand',0,0,Math.sin(t*7)*e*.07);p('Head',e*.055,-e*.07);p('LeftArm',0,0,.06);
  }else{p('LeftArm',.055,0,.11);p('RightArm',.055,0,-.11);p('LeftForeArm',.16);p('RightForeArm',.16);p('Chest',Math.sin(t*Math.PI)*.011,0,Math.sin(t*Math.PI)*.012);p('Head',-.01+Math.cos(t*Math.PI)*.007,Math.sin(t*Math.PI)*.024,-Math.sin(t*Math.PI)*.012);}
  return r;
 };
 const animations=[];
 const footVertices=[];root.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const ids=mesh.geometry.getAttribute('skinIndex');for(let n=0;n<ids.count;n++)if(['LeftFoot','RightFoot'].includes(bones[ids.getX(n)].name))footVertices.push({mesh,index:n});});
 const correctGround=(pp,target)=>{
  for(const b of bones){b.position.fromArray(pp[b.name].p);b.rotation.set(...pp[b.name].r);}root.updateMatrixWorld(true);skeleton.update();
  let sole=Infinity;for(const{mesh,index}of footVertices)sole=Math.min(sole,mesh.getVertexPosition(index,new THREE.Vector3()).y);
  pp.Hips.p[1]+=target-sole;
 };
 for(const state of JACK_SPEC.clips){const duration=state==='walk'?.72:state==='run'?.48:state==='interact'?1.1:state==='stand'?.6:2,frames=state==='walk'||state==='run'?60:12,times=Array.from({length:frames+1},(_,i)=>duration*i/frames),poses=times.map(t=>pose(state,t)),tracks=[];
  // Bake contact against the actual deformed sole vertices. The runtime still
  // drives only the capsule and plays ordinary clips. Walk has a 1.5mm seam
  // allowance; run has a brief, deliberate flight phase capped below 2cm.
  if(state==='walk'||state==='run')poses.forEach((pp,i)=>correctGround(pp,.0015+(state==='run'?.018*Math.sin(times[i]/duration*Math.PI*2)**2:0)));
  for(const b of bones){const values=[];for(const pp of poses)values.push(...new THREE.Quaternion().setFromEuler(new THREE.Euler(...pp[b.name].r)).toArray());tracks.push(new THREE.QuaternionKeyframeTrack(`${b.name}.quaternion`,times,values));}
  tracks.push(new THREE.VectorKeyframeTrack('Hips.position',times,poses.flatMap(pp=>pp.Hips.p)));animations.push(new THREE.AnimationClip(state,duration,tracks));
 }
 for(const b of bones){b.position.fromArray(bind[b.name].p);b.quaternion.fromArray(bind[b.name].q);}root.updateMatrixWorld(true);skeleton.update();
 root.animations=animations;root.userData={originalProceduralAsset:true,characterSpec:JACK_SPEC,...JACK_SPEC,rig:'One 22-joint skeleton including independently blinkable eyes; rounded soft toy geometry',benchPlacement:'Root Y = seat surface Y - characterSpec.benchSeatOffset; move root characterSpec.benchForwardOffset toward seated facing. Restore floor position while stand plays .6s.',helm:'Runtime boatVisual anchor/scale are characterSpec.helmAnchor/.helmScale. All helm body and hand keys are constant.'};root.updateMatrixWorld(true);
 return{root,bones:byName,skeleton,animations,materials};
}
