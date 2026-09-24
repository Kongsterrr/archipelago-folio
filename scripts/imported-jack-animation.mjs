// Bind-axis-independent, asset-preserving motion bake for the imported Tripo rig.
// Usage: node animate.mjs input.glb output.glb [report.json]
import fs from 'node:fs/promises';
import * as T from 'three';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';

const [input, output, reportPath=output+'.report.json']=process.argv.slice(2);
if(!input||!output)throw Error('Expected input.glb output.glb');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),doc=await io.read(input),dr=doc.getRoot();
const scene=dr.getDefaultScene()||dr.listScenes()[0];
if(dr.listSkins().length!==1)throw Error('Require one tested skin');
const skin=dr.listSkins()[0],jointNodes=skin.listJoints(),required=['Hips','Spine','Chest','Neck','Head',...['Left','Right'].flatMap(s=>['Arm','ForeArm','Hand','UpLeg','Leg','Foot'].map(n=>s+n))];
const byName=new Map(jointNodes.map(n=>[n.getName(),n]));
for(const name of required)if(!byName.has(name))throw Error(`Missing ${name}`);
// Incoming fitted source rig is +Z forward at 1.000305 m. Keep its positions,
// weights, UVs and embedded source image untouched, normalizing at a shared root.
const wrapper=doc.createNode('ImportedJack').setRotation([0,1,0,0]);
wrapper.setScale(Array(3).fill(1.2/1.00030517578125));
for(const child of [...scene.listChildren()]){scene.removeChild(child);wrapper.addChild(child);}scene.addChild(wrapper);
const objects=new Map(),root=new T.Group();
function build(n,parent){const o=new T.Object3D();o.name=n.getName();o.position.fromArray(n.getTranslation());o.quaternion.fromArray(n.getRotation());o.scale.fromArray(n.getScale());parent.add(o);objects.set(n,o);for(const c of n.listChildren())build(c,o);}
for(const n of scene.listChildren())build(n,root);root.updateMatrixWorld(true);
const bones=Object.fromEntries([...byName].map(([n,node])=>[n,objects.get(node)]));
const bind=new Map(jointNodes.map(n=>{const b=objects.get(n);return[n,{position:b.position.clone(),quaternion:b.quaternion.clone(),worldQ:b.getWorldQuaternion(new T.Quaternion()),worldP:b.getWorldPosition(new T.Vector3())}]}));
const q=new T.Quaternion(),e=new T.Euler(),v=new T.Vector3();
function restore(){for(const [n,b]of bind){objects.get(n).position.copy(b.position);objects.get(n).quaternion.copy(b.quaternion);}root.updateMatrixWorld(true);}
function delta(name,x=0,y=0,z=0){const n=byName.get(name),b=bind.get(n),rotation=new T.Quaternion().setFromEuler(e.set(x,y,z));bones[name].quaternion.copy(b.quaternion).multiply(b.worldQ.clone().invert().multiply(rotation).multiply(b.worldQ));}
function moveHipWorldY(amount){root.updateMatrixWorld(true);const p=bones.Hips.parent;const local=new T.Vector3(0,amount,0).applyMatrix3(new T.Matrix3().setFromMatrix4(p.matrixWorld).invert());bones.Hips.position.add(local);root.updateMatrixWorld(true);}
const invAccessor=skin.getInverseBindMatrices(),inverseBinds=[];
for(let i=0;i<jointNodes.length;i++){const a=[];invAccessor.getElement(i,a);inverseBinds.push(new T.Matrix4().fromArray(a));}
const skinVertices=[];
for(const n of dr.listNodes()){if(n.getSkin()!==skin)continue;for(const p of n.getMesh().listPrimitives()){
 const pos=p.getAttribute('POSITION'),ids=p.getAttribute('JOINTS_0'),weights=p.getAttribute('WEIGHTS_0');
 if(!ids||!weights)throw Error('Missing skin attributes');
 for(let i=0;i<pos.getCount();i++){const point=[],j=[],w=[];pos.getElement(i,point);ids.getElement(i,j);weights.getElement(i,w);skinVertices.push({point:new T.Vector3(...point),j,w});}
}}
const restMatrices=jointNodes.map((n,i)=>objects.get(n).matrixWorld.clone().multiply(inverseBinds[i]));
function pointAt(p,matrices){const out=new T.Vector3();for(let k=0;k<p.w.length;k++)if(p.w[k]>0)out.addScaledVector(p.point.clone().applyMatrix4(matrices[p.j[k]]),p.w[k]);return out;}
const footVertices=skinVertices.filter(p=>pointAt(p,restMatrices).y<.085);
const pelvisVertices=skinVertices.filter(p=>{const v=pointAt(p,restMatrices);return Math.abs(v.x)<.085&&v.y>.245&&v.y<.34;});
function matrices(){root.updateMatrixWorld(true);return jointNodes.map((n,i)=>objects.get(n).matrixWorld.clone().multiply(inverseBinds[i]));}
function lowestFeet(){const m=matrices();let min=Infinity;for(const p of footVertices)min=Math.min(min,pointAt(p,m).y);return min;}
const hipsY=bones.Hips.getWorldPosition(new T.Vector3()).y;
const spec={height:1.2,forward:'-Z',helmScale:.97,helmAnchor:[.28324,.1324-hipsY*.97,.00485],benchSeatOffset:hipsY-.065,benchForwardOffset:.336,clips:['idle','walk','run','helm','interact','sit','stand']};
// Hips stays at the existing boat seat. Forward placement may be adjusted by the
// caller after reviewing actual body/seat intersections; never stretch bones.
if(process.env.HELM_Z)spec.helmAnchor[2]=Number(process.env.HELM_Z);
const handTargets={Left:new T.Vector3(.19303,.1615,-.21631),Right:new T.Vector3(.37345,.1615,-.21631)};
for(const key in handTargets)handTargets[key].sub(new T.Vector3(...spec.helmAnchor)).divideScalar(spec.helmScale);
// New Hand joint is the wrist, not the old character's palm. Estimate a
// central hand-mesh anchor and preserve it as an explicit reviewable contract.
const palmAnchors={};
for(const side of ['Left','Right']){
 const node=byName.get(side+'Hand'),index=jointNodes.indexOf(node),center=new T.Vector3();let sum=0;
 for(const p of skinVertices){let weight=0;for(let k=0;k<p.j.length;k++)if(p.j[k]===index)weight+=p.w[k];if(weight<.65)continue;center.addScaledVector(pointAt(p,restMatrices),weight);sum+=weight;}
 if(!sum)throw Error(`${side} hand lacks enough dominant weighted vertices`);
 center.divideScalar(sum);palmAnchors[side]={local:center.clone().applyMatrix4(bones[side+'Hand'].matrixWorld.clone().invert()).toArray(),source:'weighted centroid of dominant hand vertices; visually confirm steering contact'};
}
spec.helmPalmAnchors=palmAnchors;
function aim(boneName,childName,target){root.updateMatrixWorld(true);const b=bones[boneName],c=bones[childName],start=b.getWorldPosition(new T.Vector3()),old=c.getWorldPosition(new T.Vector3()).sub(start).normalize(),desired=target.clone().sub(start).normalize();const wq=b.getWorldQuaternion(new T.Quaternion()),d=new T.Quaternion().setFromUnitVectors(old,desired);b.quaternion.copy(b.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(d).multiply(wq));root.updateMatrixWorld(true);}
const reach=[];
function solveArm(side,target){
 root.updateMatrixWorld(true);const arm=bones[side+'Arm'],fore=bones[side+'ForeArm'],hand=bones[side+'Hand'];
 const handWorldQ=bind.get(byName.get(side+'Hand')).worldQ,handWorldScale=hand.getWorldScale(new T.Vector3());
 const palmOffset=new T.Vector3(...palmAnchors[side].local).multiply(handWorldScale).applyQuaternion(handWorldQ);
 const gripTarget=target;target=target.clone().sub(palmOffset);
 const S=arm.getWorldPosition(new T.Vector3()),E0=fore.getWorldPosition(new T.Vector3()),H0=hand.getWorldPosition(new T.Vector3()),a=S.distanceTo(E0),b=E0.distanceTo(H0),D=target.clone().sub(S),distance=D.length(),u=D.normalize();
 if(distance>a+b-.0001)throw Error(`${side} grip outside reachable envelope: ${distance.toFixed(4)} vs ${(a+b).toFixed(4)}; adjust seated placement, not arm length`);
 const along=(a*a-b*b+distance*distance)/(2*distance),h=Math.sqrt(Math.max(0,a*a-along*along));
 const pole=new T.Vector3(side==='Left'?-.65:.65,-.25,.7);pole.addScaledVector(u,-pole.dot(u)).normalize();
 const elbow=S.clone().addScaledVector(u,along).addScaledVector(pole,h);aim(side+'Arm',side+'ForeArm',elbow);aim(side+'ForeArm',side+'Hand',target);
 const rest=bind.get(byName.get(side+'Hand'));hand.quaternion.copy(hand.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(rest.worldQ));root.updateMatrixWorld(true);
 const palmWorld=new T.Vector3(...palmAnchors[side].local).applyMatrix4(hand.matrixWorld),error=palmWorld.distanceTo(gripTarget);reach.push({side,distance,maxReach:a+b,error,palmAnchor:palmAnchors[side].local});if(error>.00001)throw Error(`${side} IK residual ${error}`);
}
function setPose(state,t){
 restore();
 if(state==='helm'||state==='sit'||state==='stand'){
  const f=state==='stand'?1-T.MathUtils.smoothstep(t,0,.6):1;
  for(const s of['Left','Right']){delta(s+'UpLeg',(state==='helm'?1.40:1.22)*f);delta(s+'Leg',-(state==='helm'?1.40:1.22)*f);}
  delta('Spine',-.08*f);delta('Chest',-.04*f);delta('Neck',.10*f);
  if(state==='helm'){solveArm('Left',handTargets.Left);solveArm('Right',handTargets.Right);}
  else for(const s of['Left','Right']){delta(s+'Arm',.34*f);delta(s+'ForeArm',.82*f);}
 }else if(state==='walk'||state==='run'){
  const run=state==='run',phase=t*Math.PI*2/(run?.48:.72),amp=run?.56:.37;
  delta('Spine',run?-.07:-.02,Math.sin(phase)*.018,Math.sin(phase)*.014);delta('Head',.015,0,-Math.sin(phase)*.012);
  for(const [s,sign]of[['Left',1],['Right',-1]]){const swing=Math.sin(phase)*sign;delta(s+'UpLeg',swing*amp);delta(s+'Leg',-Math.max(0,-swing)*(run?.7:.38));delta(s+'Foot',Math.max(0,swing)*.08);delta(s+'Arm',-swing*(run?.32:.22));delta(s+'ForeArm',run?.35:.07);}
  moveHipWorldY(.0015+(run?.012*Math.sin(phase)**2:0)-lowestFeet());
 }else if(state==='interact'){
  const f=Math.sin(Math.PI*Math.min(1,t/1.1));delta('RightArm',f*.8);delta('RightForeArm',f*.30);delta('Head',f*.03,-f*.04);
 }else{delta('Chest',Math.sin(t*Math.PI)*.005);delta('Head',Math.cos(t*Math.PI)*.003,Math.sin(t*Math.PI)*.01);}
 root.updateMatrixWorld(true);
}
const buffer=dr.listBuffers()[0]||doc.createBuffer(),reports={input,output,vertices:skinVertices.length,footSamples:footVertices.length,riggedSourceOnly:true,clips:{}};
for(const a of [...dr.listAnimations()])a.dispose();
function accessor(name,type,values){return doc.createAccessor(name).setBuffer(buffer).setType(type).setArray(new Float32Array(values));}
for(const state of spec.clips){
 const duration=state==='walk'?.72:state==='run'?.48:state==='interact'?1.1:state==='stand'?.6:2,frames=state==='walk'||state==='run'?60:state==='helm'?1:24;
 const times=Array.from({length:frames+1},(_,i)=>duration*i/frames),poses=new Map(jointNodes.map(n=>[n,[]])),hips=[],ground=[];
 for(const t of times){setPose(state,t);for(const n of jointNodes)poses.get(n).push(...objects.get(n).quaternion.toArray());hips.push(...bones.Hips.position.toArray());ground.push(lowestFeet());}
 const anim=doc.createAnimation(state),time=accessor(state+'-time','SCALAR',times);
 for(const n of jointNodes){const sampler=doc.createAnimationSampler().setInput(time).setOutput(accessor(state+'-'+n.getName(),'VEC4',poses.get(n))).setInterpolation('LINEAR');const channel=doc.createAnimationChannel().setTargetNode(n).setTargetPath('rotation').setSampler(sampler);anim.addSampler(sampler).addChannel(channel);}
 const sampler=doc.createAnimationSampler().setInput(time).setOutput(accessor(state+'-hips','VEC3',hips)).setInterpolation('LINEAR');anim.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(byName.get('Hips')).setTargetPath('translation').setSampler(sampler));
 reports.clips[state]={duration,frames:frames+1,minSoleY:Math.min(...ground),maxLowestSoleY:Math.max(...ground)};
}
setPose('sit',0);const seatedMatrices=matrices();let seatContact=Infinity;
for(const p of skinVertices){
 let major=0;for(let k=1;k<p.w.length;k++)if(p.w[k]>p.w[major])major=k;
 const name=jointNodes[p.j[major]].getName(),v=pointAt(p,seatedMatrices),z=v.z-spec.benchForwardOffset;
 if(['Hips','LeftUpLeg','RightUpLeg'].includes(name)&&z>=-.31&&z<=.31)seatContact=Math.min(seatContact,v.y);
}
reports.sitting={benchSupportedPelvisContactY:seatContact,suggestedBenchSeatOffset:seatContact-.001};
if(Number.isFinite(seatContact))spec.benchSeatOffset=seatContact-.001;
let shinRear=-Infinity,hipsBottom=Infinity,slatIntersections=0,bodySlatIntersections=0;
for(const p of skinVertices){
 let major=0;for(let k=1;k<p.w.length;k++)if(p.w[k]>p.w[major])major=k;
 const name=jointNodes[p.j[major]].getName(),v=pointAt(p,seatedMatrices);v.y-=spec.benchSeatOffset;v.z-=spec.benchForwardOffset;
 if(name==='Hips')hipsBottom=Math.min(hipsBottom,v.y);
 if((name==='LeftLeg'||name==='RightLeg')&&v.y<0)shinRear=Math.max(shinRear,v.z);
 if(v.y<-.002&&v.y>-.12&&v.z>=-.31&&v.z<=.31){bodySlatIntersections++;if(['Hips','LeftUpLeg','RightUpLeg','LeftLeg','RightLeg'].includes(name))slatIntersections++;}
}
reports.benchFit={frontEdgeZ:-.31,shinRearBelowSeatZ:shinRear,shinClearance:-.31-shinRear,hipsBottomAboveSeat:hipsBottom,pantsSlatIntersections:slatIntersections,allBodySlatIntersections:bodySlatIntersections};
restore();wrapper.setExtras({characterSpec:spec,assetRevision:'imported-tripo-rig-experiment',provenance:'User supplied actual Tripo mesh and base-color texture; locally bound and animated',experimental:true});
reports.spec=spec;reports.helmReach=reach.slice(0,2);
await io.write(output,doc);await fs.writeFile(reportPath,JSON.stringify(reports,null,2)+'\n');console.log(JSON.stringify(reports,null,2));
