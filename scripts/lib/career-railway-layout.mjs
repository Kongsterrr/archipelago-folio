import {CAREER_TRAIN_MOTION} from '../../sources/core/career-train.js';
export function careerCoast(original){const shore=original.map(p=>[...p]);for(const[i,p]of[[6,[-29,-27]],[7,[-11,-32]],[8,[8,-32]],[9,[24,-28.5]]])shore[i]=p;return shore;}
export function careerRailway(){
 const rise=17.7,run=34,travel=Math.hypot(run,rise),reserve=3.4,c=run/travel,s=rise/travel;
 const path={type:'funicular',closed:false,from:[0,2.2-reserve*s,22+reserve*c],to:[0,19.9+reserve*s,-12-reserve*c]};
 const train={length:5,width:2.2,height:4.3,coachOffset:0,floorOffset:1.65,gauge:1.62};
 const stations=[['harbor','experience','Harbor',3.85,'right'],['visionx','visionx','01 VisionX',8.05,'right'],['beaconfire','beaconfire','02 BeaconFire',14.55,'left'],['amtrak','amtrak','03 Amtrak',21.55,'left']].map(([id,contentId,label,floor,side])=>{
  const t=(floor-3.85)/rise,z=22-run*t,sign=side==='right'?1:-1,distance=reserve+travel*t,boarding={x:sign*2.7,y:floor,z,yaw:sign*Math.PI/2};
  return{id,contentId,label,distance,centerDistance:distance,side,groundY:floor,trackY:floor-1.65,approach:{...boarding},boarding:{...boarding},exit:{...boarding},platform:{x:sign*2.65,y:floor,z,width:2.6,depth:5.8,rotation:0},door:{x:sign*1.1,y:floor,z,yaw:sign*Math.PI/2},straightLength:5.8};
 });
 return{version:3,mode:'funicular',railHeadOffset:.2,path,stations,crossings:[],train,length:travel+2*reserve,travelLength:travel,endReserve:reserve,maxGrade:rise/run,...CAREER_TRAIN_MOTION,cameraPoints:[{distance:0,viewDistance:38,azimuth:0,elevation:.49,lookAt:[0,14,-2]},{distance:stations[1].distance,viewDistance:36,azimuth:.09,elevation:.49,lookAt:[17,11,12]},{distance:stations[2].distance,viewDistance:38,azimuth:-.12,elevation:.49,lookAt:[-15,18,0]},{distance:stations[3].distance,viewDistance:40,azimuth:0,elevation:.49,lookAt:[4,27,-21]},{distance:travel+2*reserve,viewDistance:40,azimuth:0,elevation:.49,lookAt:[4,27,-21]}]};
}
