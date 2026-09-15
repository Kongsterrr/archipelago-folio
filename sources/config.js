import modelManifest from '../static/models/manifest.json' with {type:'json'};
export const WORLD_RADIUS=174;
export const islands=[
 {id:'harbor',n:1,x:-15,z:80,r:11,rotation:Math.PI*.75,name:'Jack’s Harbor',kind:'home'},
 {id:'amtrak',n:2,x:-65,z:45,r:11,rotation:Math.PI/2,name:'Amtrak',kind:'experience'},
 {id:'beaconfire',n:3,x:-83,z:-17,r:11,rotation:Math.PI/2,name:'BeaconFire',kind:'experience'},
 {id:'visionx',n:4,x:-58,z:-77,r:11,rotation:Math.PI/2,name:'VisionX',kind:'experience'},
 {id:'affirmation',n:5,x:65,z:45,r:11,rotation:-Math.PI/2,name:'ADHD Affirmation',kind:'project'},
 {id:'research',n:6,x:83,z:-17,r:11,rotation:-Math.PI/2,name:'CMU Research',kind:'project'},
 {id:'catering',n:7,x:58,z:-77,r:11,rotation:-Math.PI/2,name:'Business Catering',kind:'project'},
 {id:'learning',n:8,x:0,z:-103,r:11,rotation:0,name:'Learning Island',kind:'about'},
 {id:'connect',n:9,x:0,z:17,r:11,rotation:0,name:'Connect Island',kind:'contact'}
].map(i=>({...i,shore:modelManifest.models.find(m=>m.id===i.id)?.shorePolygon,animation:modelManifest.models.find(m=>m.id===i.id)?.animation,dock:{x:i.x+Math.sin(i.rotation)*24,z:i.z+Math.cos(i.rotation)*24},yaw:i.rotation+Math.PI,camera:{distance:46+(i.n%3)*2,azimuth:Math.PI/4+(i.n%3-1)*.12,elevation:.64,height:i.id==='harbor'?4:3},action:{x:i.x+Math.sin(i.rotation)*22+Math.cos(i.rotation)*5,z:i.z+Math.cos(i.rotation)*22-Math.sin(i.rotation)*5}}));
export const gates=[{x:-75,z:118,r:11},{x:-128,z:40,r:11},{x:-117,z:-80,r:10},{x:0,z:-139,r:9},{x:117,z:-70,r:11},{x:119,z:70,r:11}].map((g,n,all)=>{const p=n?all[n-1]:{x:-31,z:125};const d=Math.hypot(g.x-p.x,g.z-p.z);return {...g,nx:(g.x-p.x)/d,nz:(g.z-p.z)/d};});
export const raceStart={x:-31,z:125,yaw:Math.PI/2};
export const boatSpawn={x:0,z:67,yaw:0};
export function nearestIsland(p){return islands.reduce((a,b)=>Math.hypot(p.x-a.dock.x,p.z-a.dock.z)<Math.hypot(p.x-b.dock.x,p.z-b.dock.z)?a:b);}

export function inDockZone(p,i){const dx=p.x-i.x,dz=p.z-i.z;const along=dx*Math.sin(i.rotation)+dz*Math.cos(i.rotation),side=dx*Math.cos(i.rotation)-dz*Math.sin(i.rotation);return along>=18&&along<=32&&Math.abs(side)<=6;}
export function toWorld(i,x,z,y=0){return{x:i.x+x*Math.cos(i.rotation)+z*Math.sin(i.rotation),y,z:i.z-x*Math.sin(i.rotation)+z*Math.cos(i.rotation)};}
export const cargoBay={x:-31,z:-43,width:40,depth:32,spawn:{x:-31,z:-30,yaw:0}};
export const cargoBerths=[{id:'circle',symbol:'●',color:'#f2a254',x:-43,z:-55},{id:'triangle',symbol:'▲',color:'#56a9ad',x:-31,z:-55},{id:'square',symbol:'■',color:'#df8190',x:-19,z:-55}].map(b=>({...b,halfWidth:3.7,halfDepth:4}));
export const cargoStarts=[{id:'circle',x:-42,z:-39},{id:'triangle',x:-30,z:-43},{id:'square',x:-18,z:-38}];
export const lamps=[{id:'wave',name:'Wave',symbol:'≈',x:-44,z:-110,color:'#54b9bf'},{id:'star',name:'Star',symbol:'★',x:0,z:-125,color:'#f4be52'},{id:'shell',name:'Shell',symbol:'◒',x:44,z:-111,color:'#ee947d'}];
export const challenges=[{id:'buoy',name:'Buoy Run',eyebrow:'SIX GATES · OPEN WATER',x:-25,z:124,spawn:raceStart},{id:'cargo',name:'Cargo Dock',eyebrow:'THREE BOXES · ONE CAREFUL CAPTAIN',x:-31,z:-20,spawn:cargoBay.spawn},{id:'lighthouse',name:'Lighthouse Link',eyebrow:'FOLLOW THE CLUE · LIGHT THE COAST',x:11,z:-80,spawn:{x:-44,z:-123,yaw:0}}];
export const secretPlaces={bottle:{x:15,z:66},arch:{x:-27,z:-94},cove:{x:91,z:53}};
export const reefGroups=[{x:-26,z:60,r:3.6},{x:27,z:66,r:4.5},{x:33,z:3,r:4},{x:-31,z:6,r:3},{x:37,z:-48,r:3.7},{x:-105,z:15,r:3},{x:103,z:42,r:3.5},{x:102,z:70,r:4},{x:-18,z:-91,r:2.3},{x:-36,z:-95,r:2.3}];
export const islandActions={harbor:['Ring the harbor bell','All aboard. Your next island is waiting.'],amtrak:['Dispatch train','A little journey around Amtrak Island.'],beaconfire:['Run the pipeline','Concept illustration · Receive → process → respond.'],visionx:['Water the garden','Concept illustration · A little care goes a long way.'],affirmation:['One small step','One step is progress.'],research:['Run the analysis','Concept illustration · Collect → organize → analyze.'],catering:['Order up','Concept illustration · Order → prepare → deliver.'],learning:['Lighthouse Link','Follow the symbols. Light the coast.'],connect:['Light up the bay','A little signal across the archipelago.']};
