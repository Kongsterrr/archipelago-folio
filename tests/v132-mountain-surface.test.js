import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const layout=JSON.parse(fs.readFileSync(new URL('../static/models/walk-layout.json',import.meta.url))).islands.find(i=>i.id==='projects');
const {vertices,indices}=layout.terrain;
const point=i=>vertices.slice(i*3,i*3+3);
const edgeDistance=(p,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[2]-a[1])*dz)/(dx*dx+dz*dz)));return Math.hypot(p[0]-a[0]-t*dx,p[2]-a[1]-t*dz);};

test('Projects mountains are real shared ridges with no unclimbable decorative summit boxes',()=>{
 const highest=Math.max(...vertices.filter((_,i)=>i%3===1));
 assert.ok(highest>9&&highest<11,'terrain itself supplies the mountain silhouette');
 assert.equal(layout.terrain.navigation.maxClimbSlopeDegrees,55);
 assert.ok(!layout.obstacles.some(o=>o.name==='scenic rock ridge'),'no flat ground hidden beneath fake boxed summits');
 for(let i=0;i<indices.length;i+=3){
  const[a,b,c]=indices.slice(i,i+3).map(point),u=b.map((v,j)=>v-a[j]),v=c.map((v,j)=>v-a[j]),normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  assert.ok(Math.atan2(Math.hypot(normal[0],normal[2]),normal[1])<=55*Math.PI/180,'every authored mountain face stays inside the shared walking/riding grade');
 }
});

test('denser northern mountain mesh joins the interior without cracks or hanging triangle edges',()=>{
 const edges=new Map();
 for(let i=0;i<indices.length;i+=3)for(let j=0;j<3;j++){
  const a=indices[i+j],b=indices[i+(j+1)%3],key=[Math.min(a,b),Math.max(a,b)].join(',');edges.set(key,(edges.get(key)||0)+1);
 }
 for(const[key,count]of edges){
  assert.ok(count<=2,'manifold surface has at most two faces per edge');
  if(count===2)continue;
  const[a,b]=key.split(',').map(Number).map(point),p=a.map((v,i)=>(v+b[i])/2);
  assert.ok(Math.min(...layout.shore.map((a,i)=>edgeDistance(p,a,layout.shore[(i+1)%layout.shore.length])))<.0001,`unpaired interior terrain edge at ${p}`);
 }
});
