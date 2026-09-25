export {inDockZone} from './core/dock.js';
import modelManifest from '../static/models/manifest.json' with {type:'json'};
export const WORLD_RADIUS=174;
import {portfolioGroups, islandIdFor} from './portfolio-groups.js';
const placements={about:{x:0,z:76,rotation:Math.PI},experience:{x:-76,z:8,rotation:Math.PI/2},projects:{x:76,z:8,rotation:-Math.PI/2},education:{x:0,z:-76,rotation:0}};
export const islands=portfolioGroups.map(group=>{
 const model=modelManifest.models.find(m=>m.id===group.id);
 if(!model)throw new Error('Build the V11 four-island assets before starting the world: '+group.id);
 const i={...group,...placements[group.id],kind:group.id,shore:model.shorePolygon,pier:model.dock,approach:model.clearApproach,districts:model.districts||[]};
 const spawn=model.clearApproach.spawn,p=toWorld(i,spawn[0],spawn[2]);
 return {...i,r:Math.max(...i.shore.map(([x,z])=>Math.hypot(x,z))),dock:{x:p.x,z:p.z},yaw:i.rotation+Math.PI,camera:{distance:145,azimuth:Math.PI/4,elevation:.68,height:2.5},action:toWorld(i,5,model.dock.endZ+6)};
});
export function resolveIsland(id){return islands.find(i=>i.id===islandIdFor(id));}
export function contentFocus(id){const island=resolveIsland(id);if(!island)return null;const district=island.districts.find(d=>d.id===id);return district?{...toWorld(island,district.x,district.z),id:island.id,contentId:id,exhibit:true,camera:{distance:48,height:3,azimuth:Math.PI/4,elevation:.68}}:island;}
export const gates=[{x:-75,z:118,r:11},{x:-128,z:40,r:11},{x:-117,z:-80,r:10},{x:0,z:-139,r:9},{x:117,z:-70,r:11},{x:119,z:70,r:11}].map((g,n,all)=>{const p=n?all[n-1]:{x:-31,z:125};const d=Math.hypot(g.x-p.x,g.z-p.z);return {...g,nx:(g.x-p.x)/d,nz:(g.z-p.z)/d};});
export const raceStart={x:-31,z:125,yaw:Math.PI/2};
export const boatSpawn={...islands[0].dock,yaw:islands[0].yaw};
export function nearestIsland(p){return islands.reduce((a,b)=>Math.hypot(p.x-a.dock.x,p.z-a.dock.z)<Math.hypot(p.x-b.dock.x,p.z-b.dock.z)?a:b);}


export function toWorld(i,x,z,y=0){return{x:i.x+x*Math.cos(i.rotation)+z*Math.sin(i.rotation),y,z:i.z-x*Math.sin(i.rotation)+z*Math.cos(i.rotation)};}
export const cargoBay={x:-57,z:-69,width:40,depth:32,spawn:{x:-57,z:-56,yaw:0}};
export const cargoBerths=[{id:'circle',symbol:'●',color:'#f2a254',x:-69,z:-81},{id:'triangle',symbol:'▲',color:'#56a9ad',x:-57,z:-81},{id:'square',symbol:'■',color:'#df8190',x:-45,z:-81}].map(b=>({...b,halfWidth:3.7,halfDepth:4}));
export const cargoStarts=[{id:'circle',x:-68,z:-65},{id:'triangle',x:-56,z:-69},{id:'square',x:-44,z:-64}];
export const lamps=[{id:'wave',name:'Wave',symbol:'≈',x:-44,z:-113,color:'#54b9bf'},{id:'star',name:'Star',symbol:'★',x:0,z:-119,color:'#f4be52'},{id:'shell',name:'Shell',symbol:'◒',x:44,z:-113,color:'#ee947d'}];
export const challenges=[{id:'buoy',name:'Buoy Run',eyebrow:'SIX GATES · OPEN WATER',x:-25,z:124,spawn:raceStart},{id:'cargo',name:'Cargo Dock',eyebrow:'THREE BOXES · ONE CAREFUL CAPTAIN',x:-57,z:-47,spawn:cargoBay.spawn},{id:'lighthouse',name:'Lighthouse Link',eyebrow:'FOLLOW THE CLUE · LIGHT THE COAST',x:29,z:-104,spawn:{x:-44,z:-105,yaw:0}}];
export const secretPlaces={bottle:{x:13,z:39},arch:{x:30,z:-36},cove:{x:39,z:57}};
export const reefGroups=[{x:-35,z:83,r:3},{x:35,z:83,r:3},{x:-91,z:56,r:3},{x:-96,z:-42,r:3},{x:96,z:56,r:3},{x:96,z:-42,r:3},{x:-35,z:-88,r:2.4},{x:35,z:-88,r:2.4},{x:-20,z:22,r:2.5},{x:25,z:-13,r:2.5}];
export const islandActions={harbor:['Ring the harbor bell','All aboard. Your next island is waiting.'],amtrak:['Dispatch train','A little journey around Amtrak Island.'],beaconfire:['Run the pipeline','Concept illustration · Receive, process, and respond.'],visionx:['Water the garden','Concept illustration · A little care goes a long way.'],affirmation:['One small step','One step is progress.'],research:['Run the analysis','Concept illustration · Collect, organize, and analyze.'],catering:['Order up','Concept illustration · Order, prepare, and deliver.'],learning:['Lighthouse Link','Follow the symbols. Light the coast.'],connect:['Light up the bay','A little signal across the archipelago.']};
