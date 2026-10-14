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
 const ramps=[],stairways=[];
 function ramp(id,x,z,width,depth,frontY,backY,rotation=0){
  const slope=(frontY-backY)/depth,y=(frontY+backY)/2,c=Math.cos(rotation),s=Math.sin(rotation),r={id,x,z,width,depth,y,slope,rotation,frontY,backY};ramps.push(r);
  const polygon=box(-width/2-.1,width/2+.1,-depth/2,depth/2).map(([px,pz])=>[x+px*c+pz*s,z-px*s+pz*c]);region(id,polygon,(xx,zz)=>y+slope*((xx-x)*s+(zz-z)*c),'junction_paving','ramp');
 }
 function stair(id,x,z,width,depth,frontY,backY,count,rotation=0){
  const rise=(backY-frontY)/count,treadDepth=depth/count,c=Math.cos(rotation),s=Math.sin(rotation),point=(xx,zz)=>[x+xx*c+zz*s,z-xx*s+zz*c];
  const st={id,x,z,width,depth,rotation,frontZ:z+depth/2,backZ:z-depth/2,frontY,backY,treadHeight:Math.abs(rise),maxStepHeight:Math.abs(rise),treadDepth,stepCount:count,treads:[],walkRoute:[point(0,depth/2+.5)]};
  for(let i=0;i<count;i++){const f=depth/2-i*treadDepth,b=f-treadDepth,y=frontY+(i+1)*rise,[xx,zz]=point(0,(f+b)/2),t={id:id+'-tread-'+i,x:xx,z:zz,width,depth:treadDepth,y,rotation};st.treads.push(t);region(t.id,box(-width/2,width/2,b,f).map(([xx,zz])=>point(xx,zz)),y,'junction_stone','stair');st.walkRoute.push([xx,zz]);}st.walkRoute.push(point(0,-depth/2-.5));stairways.push(st);return st;
 }
 // Natural inclined rock shoulders support the inhabited cuts.
 region('eastern-mountain',[[2.4,20],[28,23],[34,10],[30,-20],[4,-20]],(x,z)=>Math.min(21.55,3.85+(20-z)*.58),'junction_rock','mountain');
 region('western-mountain',[[-32,20],[-2.4,18],[-2.4,-18],[-24,-23],[-34,0]],(x,z)=>Math.min(21.55,3.85+(20-z)*.56),'junction_rock','mountain');
 // One continuous mountain surface. Flat courts are cut into its stone shoulders.
 region('harbor-quay',box(-17,17,20,30),.85);
 region('harbor-west-station',[[-29,18],[-1.35,18],[-1.35,25.5],[-15,27],[-29,23]],3.85);
 region('harbor-east-station',[[1.35,17.3],[12,17.3],[26,21],[23,25.8],[1.35,26]],3.85);
 region('visionx-garden',[[4,3],[26,3],[31,12],[29,22.5],[22,23],[17,21],[4,16]],8.05,'junction_lawn');
 region('visionx-conservatory-floor',box(8.5,25.5,7,17.3),8.05);
 region('visionx-platform-court',box(1.35,10,10.8,17.3),8.05);
 region('beaconfire-terrace',[[-30,-12],[-4,-12],[-4,8],[-20,11],[-30,9]],14.55);
 region('beaconfire-platform-court',box(-8,-1.35,-1.7,5),14.55);
 region('amtrak-summit',[[-25,-12],[-19,-24],[-10,-28],[12,-27],[29,-21],[30,-16],[22,-12],[5,-9],[-10,-9]],21.55);
 region('amtrak-platform-court',box(-8,-1.35,-15,-9),21.55);
 // The inclined bed replaces the old ground, including the 42cm harbor cut.
 region('funicular-bed',box(-1.3,1.3,-15.0158106649,25.0158106649),(x,z)=>2.2+(22-z)*(17.7/34)-.20,'junction_soil','rail');
 const harborRight=stair('harbor-east-stair',6.1,22.99,3.4,7.82,.85,3.85,23);
 const harborLeft=stair('harbor-west-stair',-12,22.99,3.4,7.82,.85,3.85,23);
 region('garden-stair-foot',box(7.8,9,20.3,23.7),3.85);
 region('garden-front-promenade',box(19.8,25.5,17,24.2),8.05);
 const garden=stair('garden-front-stair',14.6,22,3.4,11.2,3.85,8.05,32,-Math.PI/2);
 function flightChain(id,x,frontZ,frontY,backY,countPerFlight,flights){
  const route=[],step=.34,depth=countPerFlight*step,rise=(backY-frontY)/flights;let z=frontZ;
  for(let i=0;i<flights;i++){
   const y=frontY+rise*i,st=stair(id+'-'+i,x,z-depth/2,3.4,depth,y,y+rise,countPerFlight);route.push(...st.walkRoute);z-=depth;
   if(i<flights-1){region(id+'-landing-'+i,box(x-1.9,x+1.9,z-2,z),y+rise);z-=2;}
  }
  region(id+'-top-landing',box(x-2,x+2,z-1.3,z),backY);return{route,backZ:z};
 }
 const west=flightChain('west-cliff-stair',-27,22,3.85,14.55,20,4);
 const east=flightChain('east-cliff-stair',28,21,8.05,21.55,25,4);
 // Level connections at every flight end are distinct regions, never stacked floors.
 region('west-stair-foot',box(-29,-23,22,24.2),3.85);
 region('east-stair-foot',box(25.5,30,21,23),8.05);
 region('west-middle-link',box(-29,-23,-12.8,-11.2),14.55);
 region('east-summit-link',box(18,30,-21,-19),21.55);
 region('beacon-west-junction',box(-25.3,-23,-16.9,-7),14.55);
 region('beacon-west-top-landing',box(-29,-23,-16.9,-11.2),14.55);
 const summit=stair('summit-west-stair',-16.16,-15,3.4,17.68,14.55,21.55,52,-Math.PI/2);
 region('summit-west-top',box(-7.32,-3.8,-16.8,-9.8),21.55);
 const stairs=summit;
 const routes={harborRight:harborRight.walkRoute,harborLeft:harborLeft.walkRoute,garden:garden.walkRoute,west:west.route,east:east.route,summit:summit.walkRoute};
 const profile=(x,z)=>{for(let i=regions.length-1;i>=0;i--)if(contains(regions[i].polygon,x,z))return regions[i];return base;};
 const insideShore=(x,z)=>{let inside=false;for(let i=0,j=shore.length-1;i<shore.length;j=i++){const a=shore[i],b=shore[j];if((a[1]>z)!=(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;};
 const height=(x,z)=>profile(x,z).height(x,z);
 let patches=[];
 function subdivide(a,b,c){const d=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1]);if(Math.max(d(a,b),d(b,c),d(c,a))<=6){patches.push({polygon:ccw([a,b,c]),region:base});return;}const mid=(p,q)=>[(p[0]+q[0])/2,(p[1]+q[1])/2],ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);subdivide(a,ab,ca);subdivide(ab,b,bc);subdivide(ca,bc,c);subdivide(ab,bc,ca);}
 for(const ids of THREE.ShapeUtils.triangulateShape(shore.map(p=>new THREE.Vector2(...p)),[]))subdivide(...ids.map(i=>shore[i]));
 for(const r of regions){const next=[];for(const patch of patches){let overlap=patch.polygon;for(let i=0;i<r.polygon.length&&hasArea(overlap);i++)overlap=half(overlap,r.polygon[i],r.polygon[(i+1)%r.polygon.length],true);if(!hasArea(overlap)){next.push(patch);continue;}let remainder=patch.polygon;for(let i=0;i<r.polygon.length&&hasArea(remainder);i++){const a=r.polygon[i],b=r.polygon[(i+1)%r.polygon.length],outside=half(remainder,a,b,false);if(hasArea(outside))next.push({polygon:outside,region:patch.region});remainder=half(remainder,a,b,true);}if(hasArea(remainder))next.push({polygon:remainder,region:r});}patches=next;}
 const vertices=[],indices=[],colliderIndices=[],materials={},edges=[],vertexMap=new Map();
 const add=(vs,ix,material,collider=true)=>{const ids=vs.map(v=>{const point=v.map(n=>+n.toFixed(6)),key=point.join(',');if(!vertexMap.has(key)){vertexMap.set(key,vertices.length);vertices.push(point);}return vertexMap.get(key);});const out=ix.map(i=>ids[i]);indices.push(...out);if(collider)colliderIndices.push(...out);(materials[material]??=[]).push(...out);};
 const cuts=(a,b)=>{const values=[0,1],dx=b[0]-a[0],dz=b[1]-a[1];for(const r of regions)for(let i=0;i<r.polygon.length;i++){const c=r.polygon[i],d=r.polygon[(i+1)%r.polygon.length],ux=d[0]-c[0],uz=d[1]-c[1],den=dx*uz-dz*ux;if(Math.abs(den)<eps)continue;const t=((c[0]-a[0])*uz-(c[1]-a[1])*ux)/den,u=((c[0]-a[0])*dz-(c[1]-a[1])*dx)/den;if(t>eps&&t<1-eps&&u>=-eps&&u<=1+eps)values.push(t);}return [...new Set(values.map(t=>+t.toFixed(9)))].sort((a,b)=>a-b);};
 for(const {polygon:p,region:r} of patches){
  const v=p.map(([x,z])=>[x,r.height(x,z),z]),ix=[];for(let i=1;i<p.length-1;i++)ix.push(0,i+1,i);add(v,ix,r.material,!['stair','ramp'].includes(r.kind));
  for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(length<1e-6)continue;const nx=dz/length,nz=-dx/length,ts=cuts(a,b);
   for(let j=1;j<ts.length;j++){const point=t=>[a[0]+dx*t,a[1]+dz*t],aa=point(ts[j-1]),bb=point(ts[j]),mid=point((ts[j-1]+ts[j])/2),ox=mid[0]+nx*.002,oz=mid[1]+nz*.002,other=insideShore(ox,oz)?profile(ox,oz):base,top=r.height(...mid),bottom=other.height(ox,oz);if(top-bottom<.005)continue;
    const ha=r.height(...aa),hb=r.height(...bb),la=other.height(aa[0]+nx*.002,aa[1]+nz*.002),lb=other.height(bb[0]+nx*.002,bb[1]+nz*.002);const collider=!['stair','ramp'].includes(r.kind)&&!['stair','ramp'].includes(other.kind),tall=top-bottom>3.5,ma=tall?Math.max(la,ha-1.8):la,mb=tall?Math.max(lb,hb-1.8):lb;add([[aa[0],ha,aa[1]],[bb[0],hb,bb[1]],[aa[0],ma,aa[1]],[bb[0],mb,bb[1]]],[0,1,2,1,3,2],r.kind==='mountain'?'junction_rock':'junction_sandstone',collider);if(tall)add([[aa[0],ma,aa[1]],[bb[0],mb,bb[1]],[aa[0],la,aa[1]],[bb[0],lb,bb[1]]],[0,1,2,1,3,2],'junction_rockDark',collider);
    if(top-bottom>.32&&!['ramp','stair'].includes(r.kind)&&!['ramp','stair'].includes(other.kind))edges.push({a:aa,b:bb,top,bottom,region:r.id,outward:[nx,nz]});
   }
  }
 }
 const lines=new Map();for(const e of edges){let dx=e.b[0]-e.a[0],dz=e.b[1]-e.a[1],length=Math.hypot(dx,dz);dx/=length;dz/=length;if(dx<-.0001||(Math.abs(dx)<.0001&&dz<0)){dx=-dx;dz=-dz;}const offset=-dz*e.a[0]+dx*e.a[1],key=[dx,dz,offset,e.top,e.bottom].map(v=>v.toFixed(5)).join(',');if(!lines.has(key))lines.set(key,{dx,dz,offset,top:e.top,bottom:e.bottom,region:e.region,outward:e.outward,intervals:[]});const line=lines.get(key),a=dx*e.a[0]+dz*e.a[1],b=dx*e.b[0]+dz*e.b[1];line.intervals.push([Math.min(a,b),Math.max(a,b)]);}
 const mergedEdges=[];for(const l of lines.values()){const intervals=l.intervals.sort((a,b)=>a[0]-b[0]),merged=[];for(const interval of intervals){const last=merged.at(-1);if(last&&interval[0]<=last[1]+.00002)last[1]=Math.max(last[1],interval[1]);else merged.push([...interval]);}for(const[a,b]of merged){const p=t=>[l.dx*t-l.dz*l.offset,l.dz*t+l.dx*l.offset];mergedEdges.push({a:p(a),b:p(b),top:l.top,bottom:l.bottom,region:l.region,outward:l.outward});}}
 return{terrain:{version:1,kind:'terraced-summit',vertices:vertices.flat(),indices,colliderIndices,bounds:{min:[Math.min(...shore.map(p=>p[0])),Math.min(groundY,...vertices.map(p=>p[1])),Math.min(...shore.map(p=>p[1]))],max:[Math.max(...shore.map(p=>p[0])),21.55,Math.max(...shore.map(p=>p[1]))]}},vertices,materials,edges:mergedEdges,ramps,stairs,stairways,routes,height,isPaving:(x,z)=>insideShore(x,z)&&profile(x,z).material==='junction_paving',regions:regions.map(r=>({id:r.id,polygon:r.polygon,kind:r.kind}))};
}
