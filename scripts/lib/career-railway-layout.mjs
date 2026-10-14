import {sampleTrainPath,trainPathLength,trainDistanceAtPlan} from '../../sources/core/train-path.js';
import {CAREER_TRAIN_MOTION} from '../../sources/core/career-train.js';

export function careerCoast(original){const shore=original.map(p=>[...p]);for(const[i,p]of[[6,[-29,-27]],[7,[-11,-32]],[8,[8,-32]],[9,[24,-28.5]]])shore[i]=p;return shore;}

/** V20: a compact valley circuit. Plan, grade, platform and map use one curve. */
export function careerRailway(){
 const planSegments=[];let cursor=0;
 const line=(from,to,id)=>{const length=Math.hypot(to[0]-from[0],to[1]-from[1]);planSegments.push({id,type:'line',from,to,start:cursor,end:cursor+length});cursor+=length;};
 const arc=(center,radius,angle,sweep,id)=>{const length=radius*Math.abs(sweep);planSegments.push({id,type:'arc',center,radius,angle,sweep,start:cursor,end:cursor+length});cursor+=length;};
 line([-15,15],[15,15],'garden-platform-street');arc([15,8],7,Math.PI/2,-Math.PI,'valley-east-curve');
 const rear=cursor;line([15,1],[-15,1],'town-platform-street');const west=cursor;arc([-15,8],7,-Math.PI/2,-Math.PI,'valley-stone-viaduct');
 const path={type:'career-loop',closed:true,planSegments,elevation:[{start:0,end:29,y0:.95,y1:.95},{start:29,end:rear+1,y0:.95,y1:2.15,ease:3},{start:rear+1,end:west-1,y0:2.15,y1:2.15},{start:west-1,end:cursor,y0:2.15,y1:.95,ease:3}]};
 const train={length:7.95,width:1.86,height:3.05,coachOffset:4.30,floorOffset:.60,gauge:1.62};
 const stations=[['harbor','experience','Harbor — Career Line',6,'right'],['visionx','visionx','VisionX · 2023',24,'left'],['beaconfire','beaconfire','BeaconFire · 2024',rear+6,'right'],['amtrak','amtrak','Amtrak · 2024—Now',rear+24,'right']].map(([id,contentId,label,plan,side])=>{
  const centerDistance=trainDistanceAtPlan(path,plan),distance=centerDistance+train.coachOffset/2,q=sampleTrainPath(path,centerDistance),coach=sampleTrainPath(path,distance-train.coachOffset),sign=side==='right'?1:-1,nx=-coach.tangentZ*sign,nz=coach.tangentX*sign,deck=q.y+train.floorOffset,yaw=coach.yaw+(side==='right'?-Math.PI/2:Math.PI/2),boarding={x:coach.x+nx*2.25,y:deck,z:coach.z+nz*2.25,yaw};
  return{id,contentId,label,distance,centerDistance,side,groundY:q.y-.10,trackY:q.y,approach:{...boarding},boarding:{...boarding},exit:{...boarding},platform:{x:q.x-coach.tangentZ*sign*2.25,y:deck,z:q.z+coach.tangentX*sign*2.25,width:10,depth:2.1,rotation:0},door:{x:coach.x+nx*.93,y:deck,z:coach.z+nz*.93,yaw},straightLength:10};
 });
 const crossings=[['harbor',15,15,.95],['town',rear+15,1,2.15]].map(([id,plan,z,y],index)=>({id:'career-'+id+'-crossing',distance:trainDistanceAtPlan(path,plan),width:4.4,y,polygon:[[-2.2,z-1.75],[2.2,z-1.75],[2.2,z+1.75],[-2.2,z+1.75]],gates:[0,1].map(i=>({node:'anim_career_gate_'+(index*2+i),axis:'z',openAngle:Math.PI/2,closedAngle:0})),signals:[0,1].map(i=>({node:'anim_career_crossing_signal_'+(index*2+i)}))}));
 return{version:2,railHeadOffset:.10,path,stations,crossings,train,length:trainPathLength(path),planLength:cursor,minRadius:7,maxGrade:.08,...CAREER_TRAIN_MOTION,cameraPoints:[{distance:0,viewDistance:32,azimuth:.24,elevation:.56,lookAt:[0,4,3]},{distance:stations[1].distance,viewDistance:32,azimuth:.18,elevation:.56,lookAt:[13,3,8]},{distance:stations[2].distance,viewDistance:32,azimuth:.10,elevation:.56,lookAt:[11,5,-7.5]},{distance:stations[3].distance,viewDistance:32,azimuth:.27,elevation:.56,lookAt:[-11,9,-9]},{distance:trainDistanceAtPlan(path,west+11),viewDistance:36,azimuth:.34,elevation:.56,lookAt:[-8,5,2]}]};
}
