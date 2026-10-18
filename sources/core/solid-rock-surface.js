// Local closed rock meshes are physical solids, not decorative skins. Only
// upward-facing triangles can support feet; an overhanging top is not a floor
// that a character standing below it may snap onto.
export class SolidRockSurface {
 constructor(rocks){
  this.bins=new Map();this.cell=4;
  for(const rock of rocks){const vertices=rock.vertices,indices=rock.indices;
   for(let i=0;i<indices.length;i+=3){
    const [a,b,c]=indices.slice(i,i+3).map(n=>({x:vertices[n*3],y:vertices[n*3+1],z:vertices[n*3+2]}));
    const u={x:b.x-a.x,y:b.y-a.y,z:b.z-a.z},v={x:c.x-a.x,y:c.y-a.y,z:c.z-a.z};
    const nx=u.y*v.z-u.z*v.y,ny=u.z*v.x-u.x*v.z,nz=u.x*v.y-u.y*v.x,length=Math.hypot(nx,ny,nz);
    if(length<1e-9)continue;
    const determinant=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);if(Math.abs(determinant)<1e-9)continue;
    const triangle={a,b,c,determinant,normal:{x:nx/length,y:ny/length,z:nz/length},slope:Math.acos(Math.min(1,ny/length)),rockId:rock.id};
    for(let x=Math.floor(Math.min(a.x,b.x,c.x)/this.cell);x<=Math.floor(Math.max(a.x,b.x,c.x)/this.cell);x++)for(let z=Math.floor(Math.min(a.z,b.z,c.z)/this.cell);z<=Math.floor(Math.max(a.z,b.z,c.z)/this.cell);z++){
     const key=x+','+z;if(!this.bins.has(key))this.bins.set(key,[]);this.bins.get(key).push(triangle);
    }
   }
  }
 }
 contains(x,y,z){
  const crossings=new Map();
  for(const t of this.bins.get(Math.floor(x/this.cell)+','+Math.floor(z/this.cell))||[]){
   const{a,b,c,determinant}=t,u=((b.z-c.z)*(x-c.x)+(c.x-b.x)*(z-c.z))/determinant,v=((c.z-a.z)*(x-c.x)+(a.x-c.x)*(z-c.z))/determinant,w=1-u-v;
   if(u< -1e-7||v< -1e-7||w< -1e-7)continue;
   const height=u*a.y+v*b.y+w*c.y;if(height<=y+1e-6)continue;
   if(!crossings.has(t.rockId))crossings.set(t.rockId,[]);
   const heights=crossings.get(t.rockId);if(!heights.some(h=>Math.abs(h-height)<1e-5))heights.push(height);
  }
  return [...crossings.values()].some(heights=>heights.length%2===1);
 }
 sample(x,z,maxHeight=Infinity){
  let result=null;
  for(const t of this.bins.get(Math.floor(x/this.cell)+','+Math.floor(z/this.cell))||[]){
   if(t.normal.y<=1e-8)continue;
   const{a,b,c,determinant}=t,u=((b.z-c.z)*(x-c.x)+(c.x-b.x)*(z-c.z))/determinant,v=((c.z-a.z)*(x-c.x)+(a.x-c.x)*(z-c.z))/determinant,w=1-u-v;
   if(u< -1e-7||v< -1e-7||w< -1e-7)continue;
   const height=u*a.y+v*b.y+w*c.y;if(height>maxHeight+1e-6||height<=(result?.height??-Infinity))continue;
   result={height,normal:t.normal,slope:t.slope,rockId:t.rockId};
  }
  return result;
 }
}
