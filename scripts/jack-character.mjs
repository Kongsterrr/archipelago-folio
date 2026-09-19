import * as THREE from 'three';
import {mergeGeometries, mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';

/** Original V4.1 round chibi figure. Metres, feet Y=0, facing -Z.
 * Geometry is authored on one named skeleton. No runtime retargeting or IK is
 * required: the author-time helm solve is baked into constant animation keys. */
export const JACK_SPEC=Object.freeze({
 height:1.30,headHeight:.48,headsTall:1.30/.48,forward:'-Z',
 helmAuthorAnchor:[.292,.425,.005],helmAnchor:[.28324,-.34775,.00485],helmScale:.97,
 benchSeatOffset:.425,benchForwardOffset:.22,
 clips:['idle','walk','run','helm','interact','sit','stand'],
});

export function createJackCharacter(){
 const root=new THREE.Group();root.name='Jack';const bones=[],byName={};
 const bone=(name,parent,x=0,y=0,z=0)=>{const b=new THREE.Bone();b.name=name;b.position.set(x,y,z);(parent||root).add(b);bones.push(b);byName[name]=b;return b;};
 const hips=bone('Hips',null,0,.49,0),spine=bone('Spine',hips,0,.095,0),chest=bone('Chest',spine,0,.095,0);
 const neck=bone('Neck',chest,0,.137,0),head=bone('Head',neck,0,.219,0);
 for(const[side,s]of[['Left',-1],['Right',1]]){
  const arm=bone(`${side}Arm`,chest,s*.139,.078,0),elbow=bone(`${side}ForeArm`,arm,0,-.17,0);bone(`${side}Hand`,elbow,0,-.16,0);
  const thigh=bone(`${side}UpLeg`,hips,s*.067,-.02,0),shin=bone(`${side}Leg`,thigh,0,-.175,0);bone(`${side}Foot`,shin,0,-.219,0);
 }
 root.updateMatrixWorld(true);
 const materials={
  skin:new THREE.MeshStandardMaterial({name:'Jack_Skin',color:'#ffffff',vertexColors:true,roughness:.76}),
  cream:new THREE.MeshStandardMaterial({name:'Jack_CreamCanvas',color:'#ffffff',vertexColors:true,roughness:.84}),
  navy:new THREE.MeshStandardMaterial({name:'Jack_NavyKnit',color:'#ffffff',vertexColors:true,roughness:.9}),
  hair:new THREE.MeshStandardMaterial({name:'Jack_SweptHair',color:'#ffffff',vertexColors:true,roughness:.51}),
  ink:new THREE.MeshStandardMaterial({name:'Jack_EyesAndDetails',color:'#ffffff',vertexColors:true,roughness:.29}),
  accent:new THREE.MeshStandardMaterial({name:'Jack_OrangeDetails',color:'#ffffff',vertexColors:true,roughness:.7}),
 };
 const defaults={skin:'#e4b181',cream:'#f5edde',navy:'#273e50',hair:'#48352d',ink:'#192126',accent:'#df9057'};
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
 const capsule=(mat,joint,pos,size,color)=>{const[w,h,d]=size,r=Math.min(w,d)/2,g=new THREE.CapsuleGeometry(r,Math.max(.002,h-r*2),5,12);part(g,mat,joint,pos,[w/(r*2),1,d/(r*2)],undefined,color);};
 const soft=(mat,joint,pos,size,rot=[0,0,0],r=.02,color)=>{
  const[w,h,d]=size;r=Math.min(r,w*.28,h*.28,d*.28);const a=w/2-r,b=h/2-r,s=new THREE.Shape();
  s.moveTo(-a,-b);s.lineTo(a,-b);s.lineTo(a,b);s.lineTo(-a,b);s.closePath();const g=new THREE.ExtrudeGeometry(s,{depth:d-2*r,bevelEnabled:true,bevelThickness:r,bevelSize:r,bevelSegments:3,steps:1});g.translate(0,0,-d/2+r);part(g,mat,joint,pos,undefined,rot,color);
 };
 const rod=(mat,joint,a,b,r=.006,color)=>{const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),delta=bv.clone().sub(av),g=new THREE.CylinderGeometry(r,r,delta.length(),7);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));part(g,mat,joint,av.add(bv).multiplyScalar(.5).toArray(),undefined,undefined,color);};
 const curve=(mat,joint,points,r,segments=12,color)=>part(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),segments,r,6,false),mat,joint,undefined,undefined,undefined,color);
 // Round face with fuller lower cheeks and a short, friendly chin.
 const face=new THREE.SphereGeometry(1,24,16),fp=face.getAttribute('position');
 for(let n=0;n<fp.count;n++){const x=fp.getX(n),y=fp.getY(n),z=fp.getZ(n);const cheek=1+.07*Math.exp(-(((y+.3)/.45)**2));fp.setXYZ(n,x*.178*cheek,y*.205-.011,z*.158*(1-.03*y));}face.computeVertexNormals();part(face,'skin','Head');
 for(const s of[-1,1]){
  orb('skin','Head',[s*.180,-.049,.002],[.031,.052,.026],12,9);
  orb('skin','Head',[s*.188,-.049,-.018],[.015,.028,.007],10,8,'#d79f76');
  orb('ink','Head',[s*.065,.040,-.150],[.022,.033,.011],16,12);
  orb('cream','Head',[s*.065-.005,.051,-.160],[.0065,.008,.003],10,8,'#fffdf4');
  curve('hair','Head',[[s*.040,.093,-.138],[s*.062,.101,-.140],[s*.085,.092,-.133]],.008,10,'#403027');
 }
 orb('skin','Head',[0,-.008,-.164],[.019,.016,.017],14,10,'#e4a57b');
 curve('ink','Head',[[-.031,-.064,-.149],[-.016,-.071,-.155],[.010,-.072,-.156],[.032,-.064,-.149]],.0032,12,'#754d37');
 // Hair cap follows the whole back of the skull but leaves eyes/forehead clear.
 const hairPositions=[],hairIndices=[],rows=10,columns=28;
 for(let j=0;j<=rows;j++)for(let i=0;i<=columns;i++){
  const phi=i/columns*Math.PI*2,front=Math.max(0,-Math.sin(phi)),back=Math.max(0,Math.sin(phi));
  const limit=1.72-.56*front+.35*back,theta=j/rows*limit;
  hairPositions.push(.187*Math.sin(theta)*Math.cos(phi),.019+.218*Math.cos(theta),.009+.164*Math.sin(theta)*Math.sin(phi));
 }
 for(let j=0;j<rows;j++)for(let i=0;i<columns;i++){const a=j*(columns+1)+i,b=a+columns+1;hairIndices.push(a,a+1,b,a+1,b+1,b);}
 const cap=new THREE.BufferGeometry();cap.setAttribute('position',new THREE.Float32BufferAttribute(hairPositions,3));cap.setIndex(hairIndices);cap.computeVertexNormals();for(let i=0;i<=columns;i++)cap.getAttribute('normal').setXYZ(i,0,1,0);part(cap,'hair','Head');
 const lock=(points,width,color)=>{
  const path=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),vs=[],ix=[],segments=15,sides=8;
  for(let i=0;i<=segments;i++){const t=i/segments,p=path.getPoint(t),tan=path.getTangent(t).normalize(),u=new THREE.Vector3(0,0,1).cross(tan).normalize(),v=tan.clone().cross(u).normalize();
   const radius=width*Math.sin(Math.PI*(.08+.87*t))*(1-.63*t);
   for(let k=0;k<=sides;k++){const a=k/sides*Math.PI*2,q=p.clone().addScaledVector(u,Math.cos(a)*radius).addScaledVector(v,Math.sin(a)*radius*.72);vs.push(...q.toArray());}
  }
  for(let i=0;i<segments;i++)for(let k=0;k<sides;k++){const a=i*(sides+1)+k,b=a+sides+1;ix.push(a,a+1,b,a+1,b+1,b);}
  for(let k=1;k<sides-1;k++){ix.push(0,k+1,k);const end=segments*(sides+1);ix.push(end,end+k,end+k+1);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vs,3));g.setIndex(ix);g.computeVertexNormals();part(g,'hair','Head',undefined,undefined,undefined,color);
 };
 lock([[-.177,.043,-.067],[-.170,.116,-.110],[-.087,.201,-.143],[.060,.223,-.103]],.044,'#503b30');
 lock([[-.132,.115,-.134],[-.066,.159,-.165],[.060,.206,-.138],[.149,.196,-.066]],.048,'#5d4333');
 lock([[-.094,.212,-.075],[-.010,.244,-.069],[.093,.244,-.025],[.119,.259,.010]],.026,'#5a4233');
 lock([[.156,.047,-.069],[.159,.118,-.112],[.121,.185,-.108],[.051,.216,-.066]],.035,'#4e382d');
 lock([[-.137,.081,.117],[-.171,.158,.055],[-.104,.214,-.015],[.017,.236,.014]],.036,'#503c31');
 // Small neck and soft bomber silhouette, with open front and a broad collar.
 orb('skin','Neck',[0,.005,0],[.051,.049,.048],12,8);
 capsule('navy','Chest',[0,-.023,-.009],[.214,.278,.176]);
 for(const s of[-1,1]){
  capsule('cream','Chest',[s*.087,-.025,.007],[.124,.285,.193]);
  soft('cream','Chest',[s*.071,.098,-.079],[.092,.060,.043],[.10,0,-s*.27],.012,'#f8efdd');
  rod('cream','Chest',[s*.031,.065,-.102],[s*.043,-.149,-.099],.006,'#e1d5bd');
  curve('cream','Chest',[[s*.091,-.052,-.087],[s*.108,-.076,-.083],[s*.117,-.095,-.078]],.0035,8,'#d5c6ab');
 }
 capsule('cream','Chest',[0,-.020,.085],[.258,.259,.077]);
 soft('cream','Chest',[0,-.155,.008],[.253,.038,.182],undefined,.011,'#e5dac4');
 soft('accent','Chest',[.040,.027,-.112],[.012,.038,.011],undefined,.004);
 rod('ink','Chest',[.042,.046,-.111],[.042,.053,-.109],.004,'#b49c70');
 // Pants sit under the jacket hem, with soft rounded hips and discreet center seam.
 orb('navy','Hips',[0,.006,.007],[.115,.067,.085],16,10,'#2b4153');
 soft('navy','Hips',[0,.048,.005],[.218,.033,.155],undefined,.010,'#223749');
 rod('navy','Hips',[0,.025,-.078],[0,-.033,-.077],.0025,'#3b5061');
 for(const[side,s]of[['Left',-1],['Right',1]]){
  capsule('cream',`${side}Arm`,[0,-.063,0],[.113,.176,.115]);
  capsule('cream',`${side}ForeArm`,[0,-.053,0],[.097,.170,.105]);
  orb('cream',`${side}ForeArm`,[0,0,0],[.049,.049,.052],12,8);
  soft('cream',`${side}ForeArm`,[0,-.139,0],[.091,.035,.093],undefined,.010,'#dfd2b9');
  orb('skin',`${side}Hand`,[0,-.012,-.005],[.037,.044,.035],14,10);
  orb('skin',`${side}Hand`,[-s*.029,-.007,-.018],[.017,.025,.020],10,8);
  capsule('navy',`${side}UpLeg`,[0,-.075,.002],[.114,.209,.135],'#2c4254');
  capsule('navy',`${side}Leg`,[0,-.092,.003],[.103,.229,.119],'#2c4254');
  orb('navy',`${side}Leg`,[0,0,.003],[.051,.050,.057],12,8,'#2c4254');
  soft('navy',`${side}Leg`,[0,-.199,.003],[.111,.032,.126],undefined,.010,'#3b5060');
  // Broad rounded sneakers: continuous sole, domed toe, heel and two raised lace bars.
  soft('cream',`${side}Foot`,[0,-.061,-.025],[.140,.030,.222],undefined,.010,'#e2d5bd');
  orb('cream',`${side}Foot`,[0,-.023,-.030],[.066,.040,.104],16,10,'#f7efdf');
  soft('cream',`${side}Foot`,[0,-.010,.043],[.105,.052,.051],undefined,.015,'#eee3d0');
  for(const z of[-.055,-.030])curve('cream',`${side}Foot`,[[-.026,.011,z],[0,.017,z-.002],[.026,.011,z]],.0036,6,'#e1d3bc');
  soft('accent',`${side}Foot`,[s*.060,-.019,-.016],[.005,.012,.043],undefined,.001);
 }
 const skeleton=new THREE.Skeleton(bones);skeleton.calculateInverses();
 for(const[key,gs]of bins){const geometry=mergeVertices(mergeGeometries(gs,false),1e-6);geometry.normalizeNormals();const mesh=new THREE.SkinnedMesh(geometry,materials[key]);mesh.name=materials[key].name;mesh.bind(skeleton);mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;root.add(mesh);}
 const bind=Object.fromEntries(bones.map(b=>[b.name,{p:b.position.toArray(),q:b.quaternion.toArray()}]));
 const emptyPose=()=>Object.fromEntries(bones.map(b=>[b.name,{p:[...bind[b.name].p],r:[0,0,0]}]));
 // Solve the two arm chains once against the neutral wheel. The exact constant
 // rotations are baked into all helm frames; steering never changes these keys.
 const solveHelm=()=>{
  const r=emptyPose();r.Spine.r=[-.12,0,0];r.Chest.r=[.025,0,0];
  for(const b of bones){b.position.fromArray(r[b.name].p);b.rotation.set(...r[b.name].r);}root.updateMatrixWorld(true);
  for(const[side,s]of[['Left',-1],['Right',1]]){
   const arm=byName[`${side}Arm`],S=arm.getWorldPosition(new THREE.Vector3()),T=new THREE.Vector3(s*.093,.525,-.228),D=T.clone().sub(S),d=D.length(),u=D.normalize(),a=(.17**2-.16**2+d*d)/(2*d),h=Math.sqrt(Math.max(0,.17**2-a*a));
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
   if(state==='helm'){for(const side of['Left','Right'])for(const segment of['Arm','ForeArm','Hand'])r[side+segment].r=[...helmPose[side+segment].r];}
   else{for(const[side,s]of[['Left',-1],['Right',1]]){p(`${side}Arm`,.36,0,-s*.13);p(`${side}ForeArm`,1.05);}p('Head',-.035,Math.sin(t*Math.PI)*.025);}
  }else if(state==='walk'||state==='run'){
   const running=state==='run',cycle=t*Math.PI*2/(running?.62:.92),amp=running?.75:.46;
   r.Hips.p[1]+=(running?.010:.005)*Math.sin(cycle*2);
   p('Spine',running?-.10:-.02,Math.sin(cycle)*.025);p('Head',running?.06:.015);
   for(const[side,s]of[['Left',1],['Right',-1]]){const swing=Math.sin(cycle)*s;p(`${side}UpLeg`,swing*amp);p(`${side}Leg`,-Math.max(0,-swing)*(running?.9:.48));p(`${side}Foot`,Math.max(0,swing)*.12);p(`${side}Arm`,-swing*(running?.50:.32),0,side==='Left'?.06:-.06);p(`${side}ForeArm`,running?.85:.16);}
  }else if(state==='stand'){
   const u=Math.min(1,t/.6),s=1-u*u*(3-2*u);for(const side of['Left','Right']){p(`${side}UpLeg`,1.235*s);p(`${side}Leg`,-1.235*s);p(`${side}Arm`,.36*s,0,side==='Left'?.06+.07*s:-.06-.07*s);p(`${side}ForeArm`,1.05*s);}p('Spine',-.12*s);p('Chest',.025*s);
  }else if(state==='interact'){
   const e=Math.sin(Math.PI*Math.min(1,t/1.1));p('RightArm',e*1.12,0,-.10);p('RightForeArm',e*.30);p('RightHand',0,0,Math.sin(t*7)*e*.07);p('Head',e*.055,-e*.07);p('LeftArm',0,0,.06);
  }else{p('LeftArm',0,0,.06);p('RightArm',0,0,-.06);p('Chest',Math.sin(t*Math.PI)*.006);p('Head',-.005,Math.sin(t*Math.PI)*.020);}
  return r;
 };
 const animations=[];
 const footVertices=[];root.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const ids=mesh.geometry.getAttribute('skinIndex');for(let n=0;n<ids.count;n++)if(['LeftFoot','RightFoot'].includes(bones[ids.getX(n)].name))footVertices.push({mesh,index:n});});
 const correctGround=(pp,target)=>{
  for(const b of bones){b.position.fromArray(pp[b.name].p);b.rotation.set(...pp[b.name].r);}root.updateMatrixWorld(true);skeleton.update();
  let sole=Infinity;for(const{mesh,index}of footVertices)sole=Math.min(sole,mesh.getVertexPosition(index,new THREE.Vector3()).y);
  pp.Hips.p[1]+=target-sole;
 };
 for(const state of JACK_SPEC.clips){const duration=state==='walk'?.92:state==='run'?.62:state==='interact'?1.1:state==='stand'?.6:2,frames=state==='walk'||state==='run'?60:12,times=Array.from({length:frames+1},(_,i)=>duration*i/frames),poses=times.map(t=>pose(state,t)),tracks=[];
  // Bake contact against the actual deformed sole vertices. The runtime still
  // drives only the capsule and plays ordinary clips. Walk has a 1.5mm seam
  // allowance; run has a brief, deliberate flight phase capped below 2cm.
  if(state==='walk'||state==='run')poses.forEach((pp,i)=>correctGround(pp,.0015+(state==='run'?.018*Math.sin(times[i]/duration*Math.PI*2)**2:0)));
  for(const b of bones){const values=[];for(const pp of poses)values.push(...new THREE.Quaternion().setFromEuler(new THREE.Euler(...pp[b.name].r)).toArray());tracks.push(new THREE.QuaternionKeyframeTrack(`${b.name}.quaternion`,times,values));}
  tracks.push(new THREE.VectorKeyframeTrack('Hips.position',times,poses.flatMap(pp=>pp.Hips.p)));animations.push(new THREE.AnimationClip(state,duration,tracks));
 }
 for(const b of bones){b.position.fromArray(bind[b.name].p);b.quaternion.fromArray(bind[b.name].q);}root.updateMatrixWorld(true);skeleton.update();
 root.animations=animations;root.userData={originalProceduralAsset:true,characterSpec:JACK_SPEC,...JACK_SPEC,rig:'One17-joint skeleton; rounded weighted toy geometry',benchPlacement:'Root Y = seat surface Y - characterSpec.benchSeatOffset; move root characterSpec.benchForwardOffset toward seated facing. Restore floor position while stand plays .6s.',helm:'Runtime boatVisual anchor/scale are characterSpec.helmAnchor/.helmScale. All helm body and hand keys are constant.'};root.updateMatrixWorld(true);
 return{root,bones:byName,skeleton,animations,materials};
}
