import * as THREE from 'three';

// A partition, rather than stacked plates: every X/Z belongs to exactly one
// top patch. Vertical joins are then added only where adjacent heights differ.
export function careerTerraces(shore,groundY=.85){
 const eps=1e-8,regions=[];
 const area=p=>p.reduce((v,a,i)=>{const b=p[(i+1)%p.length];return v+a[0]*b[1]-b[0]*a[1];},0)/2;
 const ccw=p=>area(p)<0?[...p].reverse():p;
 const cross=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
 const clean=p=>p.filter((v,i)=>i===0||Math.hypot(v[0]-p[i-1][0],v[1]-p[i-1][1])>eps).filter((v,i,a)=>i!==a.length-1||Math.hypot(v[0]-a[0][0],v[1]-a[0][1])>eps);
 function half(poly,a,b,positive=true){
  const out=[];for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],dp=cross(a,b,p)*(positive?1:-1),dq=cross(a,b,q)*(positive?1:-1),pin=dp>=-eps,qin=dq>=-eps;if(pin)out.push(p);if(pin!==qin){const t=dp/(dp-dq);out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}}
  return clean(out);
 }
 const hasArea=p=>p.length>=3&&Math.abs(area(p))>1e-7;
 const contains=(poly,x,z)=>poly.every((a,i)=>cross(a,poly[(i+1)%poly.length],[x,z])>=-1e-7);
 const box=(x0,x1,z0,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
 const region=(id,polygon,height,material='junction_paving',kind='terrace')=>{const r={id,polygon:ccw(polygon),height:typeof height==='number'?()=>height:height,material,kind};regions.push(r);return r;};
 const base={id:'coastal-ground',height:()=>groundY,material:'junction_lawn',kind:'ground'};
 region('harbor-quay',box(-40,40,18,31),groundY);
 region('shared-town-court',box(-29.7,29.7,-2.2,16),2.4);
 region('west-lower-street',ccw([[-16,14],[-29.7,14],[-29.7,21.4],[-21,21.4]]),2.4);
 region('east-lower-street',[[16,14],[29.7,14],[29.7,21.4],[21,21.4]],2.4);
 const upper=[[-29.7,-2.2],[-29.7,-11],[-22,-22],[-18,-26],[-10,-27],[7,-26.6],[16,-26.1],[21,-23.8],[24,-20],[29.7,-11],[29.7,-2.2]];
 // The upper contour is convex; it follows the rear coast as a single town bank.
 region('station-promenade',upper,5.8);
 // Same-level gardens are true material regions in the paving, not floating mats.
 for(const [x0,x1,z0,z1] of [[-10,-5,3.1,6.4],[5,10,3.1,6.4],[-25,-17,15.3,16],[17,25,15.3,16]])region('court-garden',box(x0,x1,z0,z1),2.4,'junction_lawn');
 const ramps=[];
 function ramp(id,x,z,width,depth,frontY,backY){const slope=(frontY-backY)/depth,y=(frontY+backY)/2,r={id,x,z,width,depth,y,slope,rotation:0,frontY,backY};ramps.push(r);region(id,box(x-width/2,x+width/2,z-depth/2,z+depth/2),(xx,zz)=>y+slope*(zz-z),'junction_paving','ramp');}
 ramp('harbor-arrival-ramp',0,18.5,4.4,12,.85,2.4);
 ramp('west-town-street',-28.1,7.8,3.2,20,2.4,5.8);
 ramp('east-town-street',28.1,7.8,3.2,20,2.4,5.8);
 const stairs={id:'station-grand-stair',x:0,z:2.75,width:7.2,depth:9.9,frontZ:7.7,backZ:-2.2,frontY:2.4,backY:5.8,treadHeight:.136,maxStepHeight:.136,treadDepth:.34,stepCount:25,landing:{id:'station-stair-landing',x:0,z:2.58,width:7.2,depth:1.4,frontZ:3.28,backZ:1.88,y:4.168},treads:[]};
 function flight(count,startZ,startY,offset){for(let i=0;i<count;i++){const frontZ=startZ-i*.34,backZ=frontZ-.34,y=+(startY+(i+1)*.136).toFixed(6),id='station-stair-tread-'+(offset+i+1);region(id,box(-3.6,3.6,backZ,frontZ),y,'junction_stone','stair');stairs.treads.push({id,x:0,z:(frontZ+backZ)/2,width:7.2,depth:.34,y,frontZ,backZ});}}
 flight(13,7.7,2.4,0);region('station-stair-landing',box(-3.6,3.6,1.88,3.28),4.168,'junction_stone','stair');flight(12,1.88,4.168,13);
 stairs.walkRoute=[[0,8.25],...stairs.treads.slice(0,13).map(t=>[0,t.z]),[0,2.58],...stairs.treads.slice(13).map(t=>[0,t.z]),[0,-3.1]];
 const profile=(x,z)=>{for(let i=regions.length-1;i>=0;i--)if(contains(regions[i].polygon,x,z))return regions[i];return base;};
 const insideShore=(x,z)=>{let inside=false;for(let i=0,j=shore.length-1;i<shore.length;j=i++){const a=shore[i],b=shore[j];if((a[1]>z)!=(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;};
 const height=(x,z)=>profile(x,z).height(x,z);
 let patches=[];
 function subdivide(a,b,c){const d=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1]);if(Math.max(d(a,b),d(b,c),d(c,a))<=6){patches.push({polygon:ccw([a,b,c]),region:base});return;}const mid=(p,q)=>[(p[0]+q[0])/2,(p[1]+q[1])/2],ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);subdivide(a,ab,ca);subdivide(ab,b,bc);subdivide(ca,bc,c);subdivide(ab,bc,ca);}
 for(const ids of THREE.ShapeUtils.triangulateShape(shore.map(p=>new THREE.Vector2(...p)),[]))subdivide(...ids.map(i=>shore[i]));
 for(const r of regions){const next=[];for(const patch of patches){let remainder=patch.polygon;for(let i=0;i<r.polygon.length&&hasArea(remainder);i++){const a=r.polygon[i],b=r.polygon[(i+1)%r.polygon.length],outside=half(remainder,a,b,false);if(hasArea(outside))next.push({polygon:outside,region:patch.region});remainder=half(remainder,a,b,true);}if(hasArea(remainder))next.push({polygon:remainder,region:r});}patches=next;}
 const vertices=[],indices=[],colliderIndices=[],materials={},edges=[];
 const add=(vs,ix,material,collider=true)=>{const offset=vertices.length;vertices.push(...vs);const out=ix.map(i=>i+offset);indices.push(...out);if(collider)colliderIndices.push(...out);(materials[material]??=[]).push(...out);};
 const cuts=(a,b)=>{const values=[0,1],dx=b[0]-a[0],dz=b[1]-a[1];for(const r of regions)for(let i=0;i<r.polygon.length;i++){const c=r.polygon[i],d=r.polygon[(i+1)%r.polygon.length],ux=d[0]-c[0],uz=d[1]-c[1],den=dx*uz-dz*ux;if(Math.abs(den)<eps)continue;const t=((c[0]-a[0])*uz-(c[1]-a[1])*ux)/den,u=((c[0]-a[0])*dz-(c[1]-a[1])*dx)/den;if(t>eps&&t<1-eps&&u>=-eps&&u<=1+eps)values.push(t);}return [...new Set(values.map(t=>+t.toFixed(9)))].sort((a,b)=>a-b);};
 for(const {polygon:p,region:r} of patches){
  const v=p.map(([x,z])=>[x,r.height(x,z),z]),ix=[];for(let i=1;i<p.length-1;i++)ix.push(0,i+1,i);add(v,ix,r.material,!['stair','ramp'].includes(r.kind));
  for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(length<1e-6)continue;const nx=dz/length,nz=-dx/length,ts=cuts(a,b);
   for(let j=1;j<ts.length;j++){const point=t=>[a[0]+dx*t,a[1]+dz*t],aa=point(ts[j-1]),bb=point(ts[j]),mid=point((ts[j-1]+ts[j])/2),ox=mid[0]+nx*.002,oz=mid[1]+nz*.002,other=insideShore(ox,oz)?profile(ox,oz):base,top=r.height(...mid),bottom=other.height(ox,oz);if(top-bottom<.005)continue;
    const ha=r.height(...aa),hb=r.height(...bb),la=other.height(aa[0]+nx*.002,aa[1]+nz*.002),lb=other.height(bb[0]+nx*.002,bb[1]+nz*.002);add([[aa[0],ha,aa[1]],[bb[0],hb,bb[1]],[aa[0],la,aa[1]],[bb[0],lb,bb[1]]],[0,1,2,1,3,2],'junction_sandstone',!['stair','ramp'].includes(r.kind)&&!['stair','ramp'].includes(other.kind));
    if(top-bottom>.32&&!['ramp','stair'].includes(r.kind)&&!['ramp','stair'].includes(other.kind))edges.push({a:aa,b:bb,top,bottom,region:r.id,outward:[nx,nz]});
   }
  }
 }
 const lines=new Map();for(const e of edges){let dx=e.b[0]-e.a[0],dz=e.b[1]-e.a[1],length=Math.hypot(dx,dz);dx/=length;dz/=length;if(dx<-.0001||(Math.abs(dx)<.0001&&dz<0)){dx=-dx;dz=-dz;}const offset=-dz*e.a[0]+dx*e.a[1],key=[dx,dz,offset,e.top,e.bottom].map(v=>v.toFixed(5)).join(',');if(!lines.has(key))lines.set(key,{dx,dz,offset,top:e.top,bottom:e.bottom,region:e.region,outward:e.outward,intervals:[]});const line=lines.get(key),a=dx*e.a[0]+dz*e.a[1],b=dx*e.b[0]+dz*e.b[1];line.intervals.push([Math.min(a,b),Math.max(a,b)]);}
 const mergedEdges=[];for(const l of lines.values()){const intervals=l.intervals.sort((a,b)=>a[0]-b[0]),merged=[];for(const interval of intervals){const last=merged.at(-1);if(last&&interval[0]<=last[1]+.00002)last[1]=Math.max(last[1],interval[1]);else merged.push([...interval]);}for(const[a,b]of merged){const p=t=>[l.dx*t-l.dz*l.offset,l.dz*t+l.dx*l.offset];mergedEdges.push({a:p(a),b:p(b),top:l.top,bottom:l.bottom,region:l.region,outward:l.outward});}}
 return{terrain:{version:1,kind:'career-terraces',vertices:vertices.flat(),indices,colliderIndices,bounds:{min:[Math.min(...shore.map(p=>p[0])),groundY,Math.min(...shore.map(p=>p[1]))],max:[Math.max(...shore.map(p=>p[0])),5.8,Math.max(...shore.map(p=>p[1]))]}},vertices,materials,edges:mergedEdges,ramps,stairs,height,isPaving:(x,z)=>insideShore(x,z)&&profile(x,z).material==='junction_paving',regions:regions.map(r=>({id:r.id,polygon:r.polygon,kind:r.kind}))};
}
