export const WORLD_RADIUS=174;
export const islands=[
 {id:'harbor',n:1,x:0,z:90,r:11,rotation:Math.PI,name:'Jack’s Harbor',kind:'home'},
 {id:'amtrak',n:2,x:-65,z:45,r:11,rotation:Math.PI/2,name:'Amtrak',kind:'experience'},
 {id:'beaconfire',n:3,x:-83,z:-17,r:11,rotation:Math.PI/2,name:'BeaconFire',kind:'experience'},
 {id:'visionx',n:4,x:-58,z:-77,r:11,rotation:Math.PI/2,name:'VisionX',kind:'experience'},
 {id:'affirmation',n:5,x:65,z:45,r:11,rotation:-Math.PI/2,name:'ADHD Affirmation',kind:'project'},
 {id:'research',n:6,x:83,z:-17,r:11,rotation:-Math.PI/2,name:'CMU Research',kind:'project'},
 {id:'catering',n:7,x:58,z:-77,r:11,rotation:-Math.PI/2,name:'Business Catering',kind:'project'},
 {id:'learning',n:8,x:0,z:-103,r:11,rotation:0,name:'Learning Island',kind:'about'},
 {id:'connect',n:9,x:0,z:17,r:11,rotation:0,name:'Connect Island',kind:'contact'}
].map(i=>({...i,dock:{x:i.x+Math.sin(i.rotation)*19,z:i.z+Math.cos(i.rotation)*19},yaw:i.rotation+Math.PI}));
export const gates=[{x:-75,z:118,r:11},{x:-128,z:40,r:11},{x:-117,z:-80,r:10},{x:0,z:-139,r:9},{x:117,z:-70,r:11},{x:119,z:70,r:11}].map((g,n,all)=>{const p=n?all[n-1]:{x:-31,z:125};const d=Math.hypot(g.x-p.x,g.z-p.z);return {...g,nx:(g.x-p.x)/d,nz:(g.z-p.z)/d};});
export const raceStart={x:-31,z:125,yaw:Math.PI/2};
export const boatSpawn={x:0,z:67,yaw:0};
export function nearestIsland(p){return islands.reduce((a,b)=>Math.hypot(p.x-a.dock.x,p.z-a.dock.z)<Math.hypot(p.x-b.dock.x,p.z-b.dock.z)?a:b);}

export function inDockZone(p,i){const dx=p.x-i.x,dz=p.z-i.z;const along=dx*Math.sin(i.rotation)+dz*Math.cos(i.rotation),side=dx*Math.cos(i.rotation)-dz*Math.sin(i.rotation);return along>=18&&along<=27&&Math.abs(side)<=5;}
