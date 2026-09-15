const pierEdges=new WeakMap();
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function pointInPolygon(p,polygon){let inside=false;for(let a=0,b=polygon.length-1;a<polygon.length;b=a++){const [ax,az]=polygon[a],[bx,bz]=polygon[b];if((az>p.z)!==(bz>p.z)&&p.x<(bx-ax)*(p.z-az)/(bz-az)+ax)inside=!inside;}return inside;}
export function pointSegmentDistance(p,a,b){const dx=b.x-a.x,dz=b.z-a.z,t=clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1),0,1);return Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz);}
export function dockLocal(p,i){const dx=p.x-i.x,dz=p.z-i.z;return{x:dx*Math.cos(i.rotation)-dz*Math.sin(i.rotation),z:dx*Math.sin(i.rotation)+dz*Math.cos(i.rotation)};}
export function dockDistance(p,i){const q=dockLocal(p,i),d=i.pier||{width:3,startZ:7.9,endZ:15.8};return Math.hypot(Math.max(0,Math.abs(q.x)-d.width/2),Math.max(d.startZ-q.z,0,q.z-d.endZ));}
export function inDockZone(p,i,buffer=0){
 const q=dockLocal(p,i),d=i.pier||{width:3,startZ:7.9,endZ:15.8};
 if(i.shore&&pointInPolygon(q,i.shore))return false;
 const legacy=q.z>=18-buffer&&q.z<=32+buffer&&Math.abs(q.x)<=6+buffer;
 if(!legacy&&dockDistance(p,i)>5+buffer)return false;
 if(Math.abs(q.x)<d.width/2&&q.z>d.startZ&&q.z<d.endZ)return false;
 // A concave shoreline can obscure the closest corner while another pier edge remains exposed.
 let edges=pierEdges.get(i);if(!edges){edges=[];for(let z=d.startZ;z<=d.endZ;z+=.35)for(const side of [-1,1])edges.push({x:side*d.width/2,z});for(let x=-d.width/2;x<=d.width/2;x+=.35)for(const z of[d.startZ,d.endZ])edges.push({x,z});pierEdges.set(i,edges);}
 const nearest={x:clamp(q.x,-d.width/2,d.width/2),z:clamp(q.z,d.startZ,d.endZ)};
 for(const target of [nearest,...edges]){const distance=Math.hypot(q.x-target.x,q.z-target.z);if(!legacy&&distance>5+buffer)continue;if(i.shore&&pointInPolygon(target,i.shore))continue;let visible=true;const steps=Math.ceil(distance/.15);for(let n=1;n<steps;n++){const t=n/steps;if(i.shore&&pointInPolygon({x:q.x+(target.x-q.x)*t,z:q.z+(target.z-q.z)*t},i.shore)){visible=false;break;}}if(visible)return true;}
 return false;
}
export class DockInteraction{
 constructor(islands){this.islands=islands;this.current=null;}
 update(p){const previous=this.current,candidates=this.islands.filter(i=>inDockZone(p,i)).sort((a,b)=>dockDistance(p,a)-dockDistance(p,b));let next=candidates[0]||null;
  if(previous&&inDockZone(p,previous,.75)&&(!next||dockDistance(p,previous)<=dockDistance(p,next)+1))next=previous;
  return this.current=next;
 }
 reset(){this.current=null;}
}
