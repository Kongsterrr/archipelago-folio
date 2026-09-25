import {islands,reefGroups,gates,cargoBay,lamps,challenges,secretPlaces,WORLD_RADIUS,raceStart,toWorld} from '../config.js';
import {pointInPolygon,pointSegmentDistance,inDockZone} from '../core/dock.js';
const polygons=islands.map(i=>i.shore.map(([x,z])=>{const p=toWorld(i,x,z);return[p.x,p.z];}));
// Shared positions keep decorative navigation posts in the same safety model
// as their physical colliders. Their spacing leaves the central fairways open.
export const CHANNEL_POSTS=[[-14,34],[15,29],[-33,20],[-33,-15],[33,20],[34,-18],[-37,-45],[40,-48],[17,-41],[-17,-40]];
export function waterClear(p,margin=0,{activities=false,docks=false}={}){
 if(Math.hypot(p.x,p.z)>WORLD_RADIUS-4-margin)return false;
 for(let n=0;n<polygons.length;n++){const polygon=polygons[n],i=islands[n];if(pointInPolygon(p,polygon))return false;
  for(let j=0;j<polygon.length;j++){const a=polygon[j],b=polygon[(j+1)%polygon.length];if(pointSegmentDistance(p,{x:a[0],z:a[1]},{x:b[0],z:b[1]})<margin)return false;}
  const pier=i.pier||{width:3,startZ:7.9,endZ:15.8},a=toWorld(i,0,pier.startZ),b=toWorld(i,0,pier.endZ);if(pointSegmentDistance(p,a,b)<pier.width/2+.4+margin)return false;
  if(docks&&inDockZone(p,i,margin))return false;
 }
 for(const r of reefGroups)if(Math.hypot(p.x-r.x,p.z-r.z)<r.r+margin)return false;
 for(const x of [-6,6])if(Math.hypot(p.x-secretPlaces.arch.x-x,p.z-secretPlaces.arch.z)<2.55+margin)return false;
 for(const [x,z]of CHANNEL_POSTS)if(Math.hypot(p.x-x,p.z-z)<.25+margin)return false;
 if(Math.abs(p.x-cargoBay.x)<cargoBay.width/2+margin&&Math.abs(p.z-cargoBay.z)<cargoBay.depth/2+margin)return false;
 for(const l of [...lamps,...challenges])if(Math.hypot(p.x-l.x,p.z-l.z)<2+margin)return false;
 if(activities){const route=[raceStart,...gates];for(let j=1;j<route.length;j++)if(pointSegmentDistance(p,route[j-1],route[j])<13+margin)return false;}
 return true;
}
export function clearSegment(a,b,margin=0,options){const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.5));for(let n=0;n<=steps;n++){const t=n/steps;if(!waterClear({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t},margin,options))return false;}return true;}
export function oceanHeight(x,z,time){return -.14+Math.sin(x*.28+time*.6)*Math.sin(z*.32+time*.4)*.045;}

export const FLEET_ROUTES=[
 {id:'cruise',kind:'cruise',model:'cruise',name:'Pacific Explorer',center:{x:-151,z:-20},rx:3.5,rz:23.5,speed:1.5,length:14,width:3.35,modelScale:14,modelYaw:0,modelOffsetY:-.55,lightY:4,phase:0},
 {id:'yacht-solstice',kind:'yacht',model:'yacht-one',name:'Solstice',center:{x:64,z:-65},rx:13,rz:8,speed:2,length:11,width:4.2,modelScale:11.22,modelYaw:0,modelOffsetY:-.72,lightY:5.25,phase:2.2},
 {id:'yacht-blue-horizon',kind:'yacht',model:'yacht-two',name:'Blue Horizon',center:{x:149,z:0},rx:5,rz:19,speed:1.7,length:11,width:3.6,modelScale:11,modelYaw:Math.PI/2,modelOffsetY:-.4,lightY:3.05,phase:.4},
];
export function routePoint(route,phase){return{x:route.center.x+Math.cos(phase)*route.rx,z:route.center.z+Math.sin(phase)*route.rz};}
export function routeYaw(route,phase){return Math.atan2(Math.sin(phase)*route.rx,-Math.cos(phase)*route.rz);}
// A sampled capsule encloses the entire rectangular hull, not only its center
// or four corners. Interpolated checks also cover the bow as a long ship turns.
export function hullWaterClear(p,yaw,route,options={activities:true,docks:true}){
 const steps=Math.ceil(route.length/Math.max(.5,route.width*.45)),radius=route.width/2+.25;
 for(let n=0;n<=steps;n++){const offset=(n/steps-.5)*route.length;if(!waterClear({x:p.x-Math.sin(yaw)*offset,z:p.z-Math.cos(yaw)*offset},radius,options))return false;}
 return true;
}
export function sweptHullWaterClear(a,b,yawA,yawB,route,options){
 const turn=Math.atan2(Math.sin(yawB-yawA),Math.cos(yawB-yawA)),steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.75),Math.ceil(Math.abs(turn)*route.length/.75));
 for(let n=0;n<=steps;n++){const t=n/steps;if(!hullWaterClear({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t},yawA+turn*t,route,options))return false;}
 return true;
}
