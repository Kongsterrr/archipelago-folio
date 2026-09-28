// A single indexed surface drives rendering, ground queries and the walk collider.
// Queries use island-local coordinates and a spatial index, never a GPU readback.
export class TerrainSurface {
 constructor(data){
  this.data=data;this.bins=new Map();this.triangles=[];this.cell=4;
  const {vertices:v,indices}=data;
  for(let i=0;i<indices.length;i+=3){
   const points=indices.slice(i,i+3).map(n=>({x:v[n*3],y:v[n*3+1],z:v[n*3+2]})),[a,b,c]=points;
   const determinant=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);
   if(Math.abs(determinant)<1e-9)continue;
   const u={x:b.x-a.x,y:b.y-a.y,z:b.z-a.z},w={x:c.x-a.x,y:c.y-a.y,z:c.z-a.z};
   let nx=u.y*w.z-u.z*w.y,ny=u.z*w.x-u.x*w.z,nz=u.x*w.y-u.y*w.x;
   const length=Math.hypot(nx,ny,nz),sign=ny<0?-1:1;nx=nx/length*sign;ny=ny/length*sign;nz=nz/length*sign;
   const triangle={a,b,c,determinant,normal:{x:nx,y:ny,z:nz},slope:Math.acos(Math.min(1,ny))};
   this.triangles.push(triangle);
   for(let x=Math.floor(Math.min(a.x,b.x,c.x)/this.cell);x<=Math.floor(Math.max(a.x,b.x,c.x)/this.cell);x++)for(let z=Math.floor(Math.min(a.z,b.z,c.z)/this.cell);z<=Math.floor(Math.max(a.z,b.z,c.z)/this.cell);z++){
    const key=x+','+z;if(!this.bins.has(key))this.bins.set(key,[]);this.bins.get(key).push(triangle);
   }
  }
 }
 sample(x,z){
  for(const t of this.bins.get(Math.floor(x/this.cell)+','+Math.floor(z/this.cell))||[]){
   const {a,b,c,determinant}=t;
   const u=((b.z-c.z)*(x-c.x)+(c.x-b.x)*(z-c.z))/determinant;
   const v=((c.z-a.z)*(x-c.x)+(a.x-c.x)*(z-c.z))/determinant,w=1-u-v;
   if(u>=-1e-7&&v>=-1e-7&&w>=-1e-7)return{height:u*a.y+v*b.y+w*c.y,normal:t.normal,slope:t.slope};
  }
  return null;
 }
}
