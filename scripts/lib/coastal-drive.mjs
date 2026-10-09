// Shared V16 geometry. Coordinates are island-local: +Z is the unchanged dock.
// This module has no Three.js/runtime dependency and is also used by validation.
export function roundedRectangle(minX,maxX,minZ,maxZ,radius,steps=12){
 const result=[];
 for(const[cx,cz,start]of[[maxX-radius,maxZ-radius,0],[minX+radius,maxZ-radius,Math.PI/2],[minX+radius,minZ+radius,Math.PI],[maxX-radius,minZ+radius,Math.PI*1.5]])for(let i=0;i<=steps;i++){
  const a=start+i*Math.PI/2/steps;result.push([+(cx+radius*Math.cos(a)).toFixed(6),+(cz+radius*Math.sin(a)).toFixed(6)]);
 }
 return result;
}
export function aboutCoast(){
 const coast=roundedRectangle(-45,45,-54,26,12);
 // Flatten the retained pier's landing to z=24, easing into the expanded shore.
 const front=coast.findIndex(([x,z])=>x<0&&Math.abs(z-26)<1e-5);
 coast.splice(front,0,[10,26],[8,25],[6,24],[-6,24],[-8,25],[-10,26]);
 return coast;
}
export const ESTATE_DRIVE={width:6.5,shoulder:.75,radius:8,minX:-35,maxX:35,minZ:-46,maxZ:14};
export function estateDriveRoute(){const r=roundedRectangle(-35,35,-46,14,8,16);return[...r,r[0].slice()];}
export const ESTATE_PARKING=[
 {id:'garage-forecourt',label:'Garage forecourt',x:-20,z:14,width:26,depth:14},
 {id:'arrival-court',label:'Arrival court',x:1,z:7,width:18,depth:18},
 {id:'coast-overlook',label:'Sunset parking',x:-22,z:-33,width:16,depth:14,entrance:{x:-32.5,z:-33,width:8,depth:5},stalls:[{id:'view-01',x:-20,z:-36.5,width:7,depth:4,yaw:Math.PI/2},{id:'view-02',x:-20,z:-30.5,width:7,depth:4,yaw:Math.PI/2}]},
];
export const ESTATE_WALK_PATHS=[
 {id:'arrival-walk',points:[[0,22],[0,19],[1,7],[-4,-6],[-4,-9]]},
 {id:'house-through',interior:true,points:[[-4,-9],[-4,-23]]},
 {id:'house-living',interior:true,points:[[-4,-13],[-10,-13],[-10,-14.3]]},
 {id:'house-study',interior:true,points:[[-4,-16],[2,-16]]},
 {id:'house-rear',points:[[-4,-23],[-4,-28.1],[0,-28.1],[12,-28.1]]},
 {id:'garden-loop',points:[[10,7],[12,7],[12,-29],[12,-42],[-13,-42],[-13,-27],[-17,-24],[-28,-24],[-28,-20.5]]},
 {id:'garage-to-house',points:[[-7.8,11.5],[-7.8,-5],[-4,-5]]},
 {id:'tennis-entry',points:[[12,-5],[19,-5]]},
 {id:'golf-entry',points:[[0,-28.1],[-7,-28.1],[-7,-29.5]]},
 {id:'overlook-walk',points:[[-13,-28],[-14,-28],[-14,-25.5],[-28,-25.5],[-28,-26]]},
].map(p=>({...p,width:3.2,kind:'walk'}));
export const distanceToPath=(x,z,path)=>{
 let distance=Infinity;
 for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));distance=Math.min(distance,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz));}
 return distance;
};
const rectContains=(x,z,r)=>Math.abs(x-r.x)<=r.width/2&&Math.abs(z-r.z)<=r.depth/2;
// A single classified paving surface, rather than overlapping road strips,
// gives every plaza intersection exactly one visible top face.
const pavingCache=new Map();
export function estatePavingContours(step=.04){
 if(pavingCache.has(step))return pavingCache.get(step);
 const walk=ESTATE_WALK_PATHS.filter(p=>!p.interior),regions=new Map(['drive','shoulder','plaza','walk'].map(k=>[k,new Set()]));
 const excluded=[{x:-4,z:-16,width:20,depth:14},{x:-4,z:-24.7,width:21,depth:3.4},{x:-20,z:2,width:19,depth:10},{x:23,z:-14,width:12,depth:24},{x:0,z:30,width:4,depth:13.8}];
 const joins=[{x:-32.5,z:-33,width:5,depth:8}];
 const key=(x,z)=>`${x},${z}`;
 for(let ix=Math.floor(-41/step);ix<=Math.ceil(41/step);ix++)for(let iz=Math.floor(-51/step);iz<=Math.ceil(26/step);iz++){
  const x=(ix+.5)*step,z=(iz+.5)*step;if(excluded.some(r=>rectContains(x,z,r)))continue;
  const qx=Math.abs(x)-27,qz=Math.abs(z+16)-22,roadDistance=Math.abs(Math.hypot(Math.max(qx,0),Math.max(qz,0))+Math.min(Math.max(qx,qz),0)-8);let kind=null;
  if(ESTATE_PARKING.some(r=>rectContains(x,z,r))||joins.some(r=>rectContains(x,z,r)))kind='plaza';
  else if(roadDistance<=ESTATE_DRIVE.width/2)kind='drive';
  else if(roadDistance<=ESTATE_DRIVE.width/2+ESTATE_DRIVE.shoulder)kind='shoulder';
  else if(walk.some(p=>distanceToPath(x,z,p.points)<=p.width/2))kind='walk';
  if(kind)regions.get(kind).add(key(ix,iz));
 }
 const result={};
 for(const[kind,filled]of regions){
  const edges=new Map(),add=(a,b)=>edges.set(key(...a),b);
  for(const cell of filled){const[x,z]=cell.split(',').map(Number);if(!filled.has(key(x,z-1)))add([x,z],[x+1,z]);if(!filled.has(key(x+1,z)))add([x+1,z],[x+1,z+1]);if(!filled.has(key(x,z+1)))add([x+1,z+1],[x,z+1]);if(!filled.has(key(x-1,z)))add([x,z+1],[x,z]);}
  const loops=[];
  while(edges.size){let current=edges.keys().next().value,start=current;const loop=[];do{const next=edges.get(current);if(!next)break;loop.push(current.split(',').map(v=>+v*step));edges.delete(current);current=key(...next);}while(current!==start);
   if(loop.length>3)loops.push(loop.filter((p,i)=>{const a=loop[(i+loop.length-1)%loop.length],b=loop[(i+1)%loop.length];return Math.abs((p[0]-a[0])*(b[1]-p[1])-(p[1]-a[1])*(b[0]-p[0]))>1e-7;}));
  }
  result[kind]=loops;
 }
 pavingCache.set(step,result);return result;
}
