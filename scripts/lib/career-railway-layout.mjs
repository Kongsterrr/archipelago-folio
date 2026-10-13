import {sampleTrainPath,trainPathLength,trainDistanceAtPlan} from '../../sources/core/train-path.js';

export function careerCoast(original) {
  const shore=original.map(p=>[...p]);
  for(const [i,p] of [[6,[-29,-27]],[7,[-11,-32]],[8,[8,-32]],[9,[24,-28.5]]])shore[i]=p;
  return shore;
}

/** The same analytic plan and grade profile author rails, riders and map lines. */
export function careerRailway() {
  const planSegments=[];let cursor=0;
  const line=(from,to,id)=>{const length=Math.hypot(to[0]-from[0],to[1]-from[1]);planSegments.push({id,type:'line',from,to,start:cursor,end:cursor+length});cursor+=length;};
  const arc=(center,radius,angle,sweep,id)=>{const length=radius*Math.abs(sweep);planSegments.push({id,type:'arc',center,radius,angle,sweep,start:cursor,end:cursor+length});cursor+=length;};
  const half=Math.PI/2;
  line([15,24],[10,24],'harbor-platform');
  arc([10,18],6,half,Math.PI,'harbor-garden-curve');
  const visionPlan=cursor+6;line([10,12],[22,12],'visionx-platform');
  arc([22,6],6,half,-half,'greenhouse-east-curve');
  line([28,6],[28,0],'garden-incline');
  arc([22,0],6,0,-half,'town-east-curve');
  const middleLevel=cursor+8,beaconPlan=cursor+38,crossingPlan=cursor+22;
  line([22,-6],[-24,-6],'workshop-street');
  arc([-24,-12],6,half,half,'workshop-west-curve');
  line([-30,-12],[-30,-20.5],'station-incline');
  arc([-24,-20.5],6,Math.PI,half,'station-west-curve');
  const amtrakPlan=cursor+24;line([-24,-26.5],[23,-26.5],'amtrak-platform');
  arc([23,-17.5],9,-half,half,'outer-coast-north-curve');
  line([32,-17.5],[32,15],'coastal-viaduct');
  arc([23,15],9,0,half,'outer-coast-south-curve');
  line([23,24],[15,24],'harbor-return');
  const path={type:'career-loop',closed:true,planSegments,elevation:[
    {start:0,end:5,y0:.85,y1:.85},
    {start:5,end:visionPlan-5,y0:.85,y1:1.55,ease:3},
    {start:visionPlan-5,end:visionPlan+5,y0:1.55,y1:1.55},
    {start:visionPlan+5,end:middleLevel,y0:1.55,y1:3.65,ease:3},
    {start:middleLevel,end:beaconPlan+5,y0:3.65,y1:3.65},
    {start:beaconPlan+5,end:amtrakPlan-5,y0:3.65,y1:6.4,ease:3},
    {start:amtrakPlan-5,end:amtrakPlan+5,y0:6.4,y1:6.4},
    {start:amtrakPlan+5,end:cursor-5,y0:6.4,y1:.85,ease:3},
    {start:cursor-5,end:cursor,y0:.85,y1:.85},
  ]};
  for(const span of path.elevation){span.y0+=.10;span.y1+=.10;}
  const train={length:7.95,width:1.86,height:3.05,coachOffset:4.30,floorOffset:.60,gauge:1.62};
  const stations=[['harbor','experience','Harbor — Career Line',0,'left'],['visionx','visionx','VisionX · 2023',visionPlan,'left'],['beaconfire','beaconfire','BeaconFire · 2024',beaconPlan,'left'],['amtrak','amtrak','Amtrak · 2024—Now',amtrakPlan,'right']].map(([id,contentId,label,plan,side])=>{
    const centerDistance=trainDistanceAtPlan(path,plan),distance=centerDistance+train.coachOffset/2,q=sampleTrainPath(path,centerDistance),coach=sampleTrainPath(path,distance-train.coachOffset),sign=side==='right'?1:-1,nx=-coach.tangentZ*sign,nz=coach.tangentX*sign,deck=q.y+train.floorOffset;
    const yaw=coach.yaw+(side==='right'?-Math.PI/2:Math.PI/2),boarding={x:coach.x+nx*2.25,y:deck,z:coach.z+nz*2.25,yaw};
    return{id,contentId,label,distance,centerDistance,side,groundY:q.y-.10,trackY:q.y,approach:{...boarding},boarding:{...boarding},exit:{...boarding},platform:{x:q.x-coach.tangentZ*sign*2.25,y:deck,z:q.z+coach.tangentX*sign*2.25,width:10,depth:2.1,rotation:0},door:{x:coach.x+nx*.93,y:deck,z:coach.z+nz*.93,yaw},straightLength:10};
  });
  const crossings=[{id:'career-central-crossing',distance:trainDistanceAtPlan(path,crossingPlan),width:4.4,y:3.75,polygon:[[-2.2,-7.75],[2.2,-7.75],[2.2,-4.25],[-2.2,-4.25]],gates:[0,1].map(i=>({node:'anim_career_gate_'+i,axis:'z',openAngle:Math.PI/2,closedAngle:0})),signals:[0,1].map(i=>({node:'anim_career_crossing_signal_'+i}))}];
  return{version:1,railHeadOffset:.10,path,stations,crossings,train,length:trainPathLength(path),planLength:cursor,minRadius:6,maxGrade:.08,cruiseSpeed:3.2,curveSpeed:1.8,cameraPoints:[{distance:0,azimuth:.30,lookAt:[10,2,21]},{distance:stations[1].distance,azimuth:-.28,lookAt:[18,3.3,4]},{distance:stations[2].distance,azimuth:Math.PI+.20,lookAt:[-17,6,5]},{distance:stations[3].distance,azimuth:Math.PI-.20,lookAt:[0,10,-18]},{distance:trainDistanceAtPlan(path,planSegments.find(s=>s.id==='coastal-viaduct').start+12),azimuth:.42,lookAt:[8,6,-8]}]};
}
