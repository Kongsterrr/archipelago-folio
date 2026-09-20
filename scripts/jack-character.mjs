import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {addJackHair} from './jack-hair.mjs';
import {mergeGeometries, mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';

/** Original V4.5 reference-led toy adventurer. Metres, feet Y=0, facing -Z.
 * Geometry is authored on one named skeleton. No runtime retargeting or IK is
 * required: the author-time helm solve is baked into constant animation keys. */
const HEAD_SCALE=.542/.487, HEAD_Y=1.30-.253*HEAD_SCALE;
const THIGH=.165*.92, SHIN=.189*.92, HIP_Y=.020+THIGH+SHIN+.086;
const ARM=.158, RELAXED_ARM=THREE.MathUtils.degToRad(22);
const RELAXED_ELBOW=THREE.MathUtils.degToRad(10), ELBOW_FLEX=THREE.MathUtils.degToRad(12);
const headParts=new Set(['Head','LeftEye','RightEye','LeftBrow','RightBrow','Mouth']);
export const JACK_SPEC=Object.freeze({
 height:1.30,headHeight:.542,headsTall:1.30/.542,forward:'-Z',
 helmAuthorAnchor:[.292,HIP_Y,.005],helmAnchor:[.28324,.1324-HIP_Y*.97,.00485],helmScale:.97,
 benchSeatOffset:HIP_Y-.075,benchForwardOffset:.258,
 facial:{eyeBones:['LeftEye','RightEye'],browBones:['LeftBrow','RightBrow'],mouthBone:'Mouth',blinkAxis:'y',openScale:1,closedScale:.08,headBone:'Head',gazeYawLimit:.16,gazePitchLimit:.08},
 clips:['idle','walk','run','helm','interact','sit','stand'],
});

export function createJackCharacter(){
 const root=new THREE.Group();root.name='Jack';const bones=[],byName={};
 const bone=(name,parent,x=0,y=0,z=0)=>{const b=new THREE.Bone();b.name=name;b.position.set(x,y,z);(parent||root).add(b);bones.push(b);byName[name]=b;return b;};
 const hips=bone('Hips',null,0,HIP_Y,0),spine=bone('Spine',hips,0,.100,0),chest=bone('Chest',spine,0,.098,0);
 const neck=bone('Neck',chest,0,.132,0),head=bone('Head',neck,0,HEAD_Y-HIP_Y-.100-.098-.132,0);
 bone('LeftEye',head,-.078,-.036,-.187);bone('RightEye',head,.078,-.036,-.187);
 bone('LeftBrow',head,-.078,.030,-.190);bone('RightBrow',head,.078,.030,-.190);bone('Mouth',head,0,-.121,-.175);
 for(const name of headParts)if(name!=='Head')byName[name].position.multiplyScalar(HEAD_SCALE);
 for(const[side,s]of[['Left',-1],['Right',1]]){
  const arm=bone(`${side}Arm`,chest,s*.161,.068,0),elbow=bone(`${side}ForeArm`,arm,0,-ARM,0);bone(`${side}Hand`,elbow,0,-ARM,0);
  const thigh=bone(`${side}UpLeg`,hips,s*.072,-.02,0),shin=bone(`${side}Leg`,thigh,0,-THIGH,0);bone(`${side}Foot`,shin,0,-SHIN,0);
 }
 root.updateMatrixWorld(true);
 const materials={
  skin:new THREE.MeshStandardMaterial({name:'Jack_Skin',color:'#ffffff',vertexColors:true,roughness:.72}),
  cream:new THREE.MeshStandardMaterial({name:'Jack_CreamCanvas',color:'#ffffff',vertexColors:true,roughness:.84}),
  navy:new THREE.MeshStandardMaterial({name:'Jack_NavyKnit',color:'#ffffff',vertexColors:true,roughness:.9}),
  hair:new THREE.MeshStandardMaterial({name:'Jack_SweptHair',color:'#ffffff',vertexColors:true,roughness:.48}),
  ink:new THREE.MeshStandardMaterial({name:'Jack_EyesAndDetails',color:'#ffffff',vertexColors:true,roughness:.26}),
  accent:new THREE.MeshStandardMaterial({name:'Jack_OrangeDetails',color:'#ffffff',vertexColors:true,roughness:.7}),
 };
 const defaults={skin:'#ffc49a',cream:'#fff0d7',navy:'#293e52',hair:'#332720',ink:'#151a1e',accent:'#e18b4d'};
 const bins=new Map(Object.keys(materials).map(k=>[k,[]]));
 const part=(geometry,mat,joint,pos=[0,0,0],scale=[1,1,1],rot=[0,0,0],color=null)=>{
  const g=geometry,b=byName[joint],shapeScale=headParts.has(joint)?new THREE.Matrix4().makeScale(HEAD_SCALE,HEAD_SCALE,HEAD_SCALE):joint==='Chest'?new THREE.Matrix4().makeScale(1,.93,1):new THREE.Matrix4();g.applyMatrix4(b.matrixWorld.clone().multiply(shapeScale).multiply(new THREE.Matrix4().compose(new THREE.Vector3(...pos),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),new THREE.Vector3(...scale))));
  for(const name of Object.keys(g.attributes))if(!['position','normal'].includes(name))g.deleteAttribute(name);
  if(mat==='hair')g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
  g.clearGroups();if(!g.index)g.setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i));
  const n=g.attributes.position.count,ids=new Uint16Array(n*4),weights=new Float32Array(n*4),colors=new Float32Array(n*3),tint=new THREE.Color(color||defaults[mat]);
  for(let i=0;i<n;i++){ids[i*4]=bones.indexOf(b);weights[i*4]=1;colors.set(tint.toArray(),i*3);}
  g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(ids,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));bins.get(mat).push(g);
 };
 const orb=(mat,joint,pos,scale,seg=16,rings=10,color)=>part(new THREE.SphereGeometry(1,seg,rings),mat,joint,pos,scale,undefined,color);
 const capsule=(mat,joint,pos,size,color)=>{const[w,h,d]=size,r=Math.min(w,h,d)/2,g=new THREE.CapsuleGeometry(r,Math.max(0,h-r*2),4,10);part(g,mat,joint,pos,[w/(r*2),1,d/(r*2)],undefined,color);};
 const soft=(mat,joint,pos,size,rot=[0,0,0],r=.02,color)=>{
  const[w,h,d]=size;r=Math.min(r,w*.45,h*.45,d*.45);
  part(new RoundedBoxGeometry(w,h,d,2,r),mat,joint,pos,undefined,rot,color);
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
  const vs=[],ix=[],radial=20;
  for(const[y,r]of profile)for(let j=0;j<=radial;j++){const a=j/radial*Math.PI*2;vs.push(Math.cos(a)*r,y,Math.sin(a)*r*depthScale);}
  for(let i=0;i<profile.length-1;i++)for(let j=0;j<radial;j++){const a=i*(radial+1)+j,b=a+radial+1;ix.push(a,a+1,b,a+1,b+1,b);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vs,3));g.setIndex(ix);g.computeVertexNormals();
  part(g,mat,upper,undefined,undefined,undefined,color);
  const ids=g.getAttribute('skinIndex'),weights=g.getAttribute('skinWeight'),lo=bones.indexOf(byName[lower]),hi=bones.indexOf(byName[upper]);
  for(let i=0;i<profile.length;i++){const y=profile[i][0],t=THREE.MathUtils.smoothstep(hinge-y,-.04,.04);for(let j=0;j<=radial;j++){const k=i*(radial+1)+j;ids.setXYZW(k,hi,lo,0,0);weights.setXYZW(k,1-t,t,0,0);}}
 };
 // Reference face: broad cheeks and a compact rounded chin below layered hair.
 const face=new THREE.SphereGeometry(1,40,28),fp=face.getAttribute('position');
 const facePoint=(x,y,extra=.002)=>{
  const sy=(y+.023)/.211,cheek=1+.045*Math.exp(-(((sy+.38)/.48)**2)),sx=x/(.216*cheek);
  return [x,y,-.198*Math.sqrt(Math.max(.001,1-sx*sx-sy*sy))*(1-.02*sy)-extra];
 };
 for(let n=0;n<fp.count;n++){const x=fp.getX(n),y=fp.getY(n),z=fp.getZ(n),cheek=1+.045*Math.exp(-(((y+.38)/.48)**2));fp.setXYZ(n,x*.216*cheek,y*.211-.023,z*.198*(1-.02*y));}
 face.computeVertexNormals();const faceTints=[];
 for(let n=0;n<fp.count;n++){const x=fp.getX(n),y=fp.getY(n),z=fp.getZ(n),dx=(Math.abs(x)-.139)/.044,dy=(y+.079)/.027,blush=Math.exp(-(dx*dx+dy*dy)*1.5)*.26*Math.max(0,Math.min(1,-z/.12));faceTints.push(...new THREE.Color('#ffc49a').lerp(new THREE.Color('#ed9479'),blush).toArray());}
 part(face,'skin','Head');face.setAttribute('color',new THREE.Float32BufferAttribute(faceTints,3));
 for(const[side,s]of[['Left',-1],['Right',1]]){
  orb('skin','Head',[s*.214,-.073,.012],[.042,.049,.030],18,12);
  orb('skin','Head',[s*.232,-.074,-.010],[.021,.029,.013],14,10,'#eeb08c');
  const eyePart=(mat,pos,scale,segments,rings,color)=>{
   const g=new THREE.SphereGeometry(1,segments,rings);g.scale(...scale);g.translate(...pos);g.rotateY(-s*.34);part(g,mat,`${side}Eye`,undefined,undefined,undefined,color);
  };
  // The reference uses simple deep-black oval eyes, not outlined iris rings.
  eyePart('ink',[0,0,0],[.022,.034,.008],22,14,'#151719');
  eyePart('cream',[-.005,.013,-.0065],[.0045,.006,.002],12,9,'#fffdf6');
  eyePart('ink',[.007,-.014,-.006],[.003,.004,.001],10,7,'#35383a');
  const brow=[facePoint(s*.047,.020,.008),facePoint(s*.071,.034,.009),facePoint(s*.096,.030,.008),facePoint(s*.111,.017,.005)];
  facialCurve('hair',`${side}Brow`,brow.map(p=>[p[0]-s*.078,p[1]-.030,p[2]+.190]),.008,14,'#543629');
 }
 orb('skin','Head',[0,-.079,-.194],[.019,.015,.021],18,12,'#f1aa80');
 facialCurve('ink','Mouth',[facePoint(-.039,-.112,.003),facePoint(-.019,-.123,.004),facePoint(.013,-.124,.004),facePoint(.039,-.113,.003)].map(p=>[p[0],p[1]+.121,p[2]+.175]),.0025,18,'#83462f');
 addJackHair(THREE,part);
 // Open cream jacket frames a navy tee, with a proper gap down the front.
 orb('skin','Neck',[0,-.008,0],[.050,.059,.045],18,12);
 orb('navy','Chest',[0,-.022,.008],[.130,.157,.087],24,18,'#26394c');
 const coatProfile=[[.120,.063,.045],[.111,.126,.079],[.080,.148,.092],[.030,.152,.101],[-.030,.150,.105],[-.109,.146,.103],[-.157,.139,.098],[-.170,.134,.094]];
 const cp=[],ci=[],cols=34,gap=.43;
 for(let layer=0;layer<2;layer++)for(const[y,w,d]of coatProfile)for(let j=0;j<=cols;j++){
  const phi=-Math.PI/2+gap+j/cols*(Math.PI*2-gap*2),inset=layer?.009:0;
  cp.push(Math.cos(phi)*(w-inset),y,Math.sin(phi)*(d-inset)+.008);
 }
 const rings=coatProfile.length,stride=cols+1,layerSize=rings*stride;
 for(let layer=0;layer<2;layer++)for(let i=0;i<rings-1;i++)for(let j=0;j<cols;j++){
  const a=layer*layerSize+i*stride+j,b=a+stride;if(layer)ci.push(a,b,a+1,a+1,b,b+1);else ci.push(a,a+1,b,a+1,b+1,b);
 }
 for(let i=0;i<rings-1;i++)for(const j of[0,cols]){const a=i*stride+j,b=a+stride,c=a+layerSize,d=b+layerSize;if(j===0)ci.push(a,b,c,b,d,c);else ci.push(a,c,b,b,c,d);}
 for(const i of[0,rings-1])for(let j=0;j<cols;j++){const a=i*stride+j,b=a+1,c=a+layerSize,d=b+layerSize;if(i===0)ci.push(a,c,b,b,c,d);else ci.push(a,b,c,b,d,c);}
 const jacket=new THREE.BufferGeometry();jacket.setAttribute('position',new THREE.Float32BufferAttribute(cp,3));jacket.setIndex(ci);jacket.computeVertexNormals();part(jacket,'cream','Chest',undefined,undefined,undefined,'#f2e4cf');
 for(const s of[-1,1]){
  // Folded collar flaps with soft bevels, rather than a padded round neck ring.
  const points=[[s*.045,.128],[s*.112,.129],[s*.127,.077],[s*.061,.082]];if(s<0)points.reverse();const shape=new THREE.Shape(points.map(p=>new THREE.Vector2(...p)));
  const collar=new THREE.ExtrudeGeometry(shape,{depth:.010,bevelEnabled:true,bevelSize:.006,bevelThickness:.005,bevelSegments:3,steps:1});
  part(collar,'cream','Chest',[0,0,-.084],undefined,undefined,'#f8ecda');
  curve('cream','Chest',[[s*.102,-.028,-.068],[s*.117,-.051,-.059],[s*.112,-.078,-.060]],.0025,14,'#d9cbb8');
  curve('cream','Chest',coatProfile.map(([y,w,d])=>[s*w*Math.sin(gap),y,-d*Math.cos(gap)+.006]),.0031,20,'#dfd2bf');
  for(let k=0;k<17;k++){const y=.085-k*.012,point=coatProfile.reduce((best,p)=>Math.abs(p[0]-y)<Math.abs(best[0]-y)?p:best);orb('cream','Chest',[s*(point[1]*Math.sin(gap)-.002),y,-point[2]*Math.cos(gap)+.003],[.0028,.002,.0025],6,4,'#cabdaa');}
 }
 soft('accent','Chest',[.059,.016,-.094],[.012,.034,.007],[0,0,-.03],.003,'#ea8744');
 curve('cream','Chest',[[.059,.047,-.093],[.059,.039,-.095],[.059,.031,-.094]],.003,8,'#d5c6ad');
 soft('navy','Hips',[0,.001,.005],[.260,.150,.181],[0,0,0],.060,'#293b50');
 capsule('navy','Hips',[0,.040,.005],[.228,.034,.160],'#28394c');
 curve('navy','Hips',[[0,.019,-.087],[.010,-.010,-.089],[.008,-.038,-.082]],.002,12,'#233448');
 for(const[side,s]of[['Left',-1],['Right',1]]){
  cloth('cream',`${side}Arm`,`${side}ForeArm`,[[.040,0],[.033,.029],[.017,.054],[0,.064],[-.04,.066],[-.08,.064],[-.115,.061],[-.140,.060],[-.155,.059],[-.17,.058],[-.195,.057],[-.225,.055],[-.255,.053],[-.279,.049],[-.294,.027],[-.300,0]].map(([y,r])=>[y*ARM/.155,r*1.08]),-ARM,1.05);
  soft('cream',`${side}ForeArm`,[0,-ARM+.020,0],[.110,.034,.113],[0,0,0],.011,'#e5d3b3');
  orb('skin',`${side}Hand`,[0,-.011,-.004],[.042,.043,.039],16,12);
  orb('skin',`${side}Hand`,[-s*.031,-.007,-.022],[.019,.025,.021],12,9);
  cloth('navy',`${side}UpLeg`,`${side}Leg`,[[.047,0],[.040,.032],[.026,.053],[.007,.064],[-.025,.066],[-.06,.065],[-.095,.063],[-.120,.061],[-.137,.060],[-.155,.059],[-.18,.059],[-.215,.058],[-.25,.057],[-.277,.054],[-.292,.03],[-.300,0]].map(([y,r])=>[y>=-.137?y*THIGH/.137:-THIGH+(y+.137)*SHIN/.162,r]),-THIGH,1.15,'#293b50');
  soft('navy',`${side}Leg`,[0,-SHIN+.021,.003],[.132,.0396,.145],[0,0,0],.010,'#34465a');
  // Soft oversized sneaker volumes overlap into one silhouette, with no box joints.
  const soleShape=new THREE.Shape();soleShape.moveTo(-.063,.055);soleShape.quadraticCurveTo(-.077,.015,-.073,-.076);soleShape.quadraticCurveTo(-.068,-.141,0,-.146);soleShape.quadraticCurveTo(.068,-.141,.073,-.076);soleShape.quadraticCurveTo(.077,.015,.063,.055);soleShape.quadraticCurveTo(0,.088,-.063,.055);soleShape.closePath();
  const sole=new THREE.ExtrudeGeometry(soleShape,{depth:.018,curveSegments:10,bevelEnabled:true,bevelThickness:.005,bevelSize:.003,bevelSegments:3,steps:1});sole.rotateX(Math.PI/2);part(sole,'cream',`${side}Foot`,[0,-.063,0],undefined,undefined,'#e7d7bc');
  orb('cream',`${side}Foot`,[0,-.023,-.032],[.074,.043,.112],24,14,'#fff2dd');
  orb('cream',`${side}Foot`,[0,.006,.038],[.056,.044,.060],16,10,'#f3e5ce');
  for(const z of[-.060,-.033])curve('cream',`${side}Foot`,[[-.030,.018,z],[0,.025,z-.002],[.030,.018,z]],.004,7,'#ddccae');
 }
 // Keep the original swept crown contour after scaling the whole head, face
 // pivots included. Shoes retain their original thickness and Y=0 datum.
 let crown=-Infinity;for(const g of bins.get('hair')){const pos=g.getAttribute('position');for(let i=0;i<pos.count;i++)crown=Math.max(crown,pos.getY(i));}
 for(const g of bins.get('hair')){const pos=g.getAttribute('position');for(let i=0;i<pos.count;i++){const y=pos.getY(i);const crownBase=HEAD_Y+.103*HEAD_SCALE;if(y>crownBase)pos.setY(i,crownBase+(y-crownBase)*(1.30-crownBase)/(crown-crownBase));}g.computeVertexNormals();}
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
   const arm=byName[`${side}Arm`],S=arm.getWorldPosition(new THREE.Vector3()),T=new THREE.Vector3(s*.093,(.1615-JACK_SPEC.helmAnchor[1])/JACK_SPEC.helmScale,-.228),D=T.clone().sub(S),d=D.length(),u=D.normalize(),a=d/2,h=Math.sqrt(Math.max(0,ARM**2-a*a));
   if(d>ARM*2)throw Error(`${side} helm grip is outside arm reach`);
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
  // Arms point down (-Y): Z must have the same sign as shoulder X to abduct.
  // All land clips share this relaxed base; gait adds swing without closing it.
  for(const[side,s]of[['Left',-1],['Right',1]]){p(`${side}Arm`,.055,0,s*RELAXED_ARM);p(`${side}ForeArm`,ELBOW_FLEX,0,-s*RELAXED_ELBOW);}
  if(state==='helm'||state==='sit'){
   for(const side of['Left','Right']){p(`${side}UpLeg`,state==='helm'?1.45:1.235);p(`${side}Leg`,state==='helm'?-1.40:-1.235);if(state==='helm')p(`${side}Foot`,-.05);}
   p('Spine',-.12);p('Chest',.025);
   if(state==='helm'){p('Spine',-.26);p('Chest',-.07);p('Neck',.21);for(const side of['Left','Right'])for(const segment of['Arm','ForeArm','Hand'])r[side+segment].r=[...helmPose[side+segment].r];}
   else{for(const[side,s]of[['Left',-1],['Right',1]]){p(`${side}Arm`,.36,0,s*RELAXED_ARM);p(`${side}ForeArm`,1.05,0,-s*RELAXED_ELBOW);}p('Head',-.035,Math.sin(t*Math.PI)*.025);}
  }else if(state==='walk'||state==='run'){
   const running=state==='run',cycle=t*Math.PI*2/(running?.48:.72),amp=running?.75:.48;
   r.Hips.p[1]+=(running?.010:.005)*Math.sin(cycle*2);
   p('Spine',running?-.10:-.02,Math.sin(cycle)*.025,Math.sin(cycle)*.025);p('Head',running?.06:.015,0,-Math.sin(cycle)*.02);
   for(const[side,s]of[['Left',1],['Right',-1]]){const swing=Math.sin(cycle)*s;p(`${side}UpLeg`,swing*amp);p(`${side}Leg`,-Math.max(0,-swing)*(running?.9:.48));p(`${side}Foot`,Math.max(0,swing)*.12);p(`${side}Arm`,.055-swing*(running?.50:.32),0,(side==='Left'?-1:1)*RELAXED_ARM);p(`${side}ForeArm`,running?.78:ELBOW_FLEX,0,(side==='Left'?1:-1)*RELAXED_ELBOW);}
  }else if(state==='stand'){
   const u=Math.min(1,t/.6),s=1-u*u*(3-2*u);for(const side of['Left','Right']){p(`${side}UpLeg`,1.235*s);p(`${side}Leg`,-1.235*s);p(`${side}Arm`,.055+(.36-.055)*s,0,(side==='Left'?-1:1)*RELAXED_ARM);p(`${side}ForeArm`,ELBOW_FLEX+(1.05-ELBOW_FLEX)*s,0,(side==='Left'?1:-1)*RELAXED_ELBOW);}p('Spine',-.12*s);p('Chest',.025*s);
  }else if(state==='interact'){
   const e=Math.sin(Math.PI*Math.min(1,t/1.1));p('RightArm',.055+e*1.12,0,RELAXED_ARM);p('RightForeArm',ELBOW_FLEX+e*.30,0,-RELAXED_ELBOW);p('RightHand',0,0,Math.sin(t*7)*e*.07);p('Head',e*.055,-e*.07);
  }else{p('Chest',Math.sin(t*Math.PI)*.011,0,Math.sin(t*Math.PI)*.012);p('Head',-.01+Math.cos(t*Math.PI)*.007,Math.sin(t*Math.PI)*.024,-Math.sin(t*Math.PI)*.012);}
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
