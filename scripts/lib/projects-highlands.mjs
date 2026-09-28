// Authored V13 terrain shared by the visible island, collision and navigation.
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
const seg=(x,z,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz));return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);};

// The rendered ground has a small cutout beneath the wooden pier. Physics keeps
// the continuous terrain plus its explicit deck surface; overlapping surfaces
// must not both be rendered at exactly the .85m arrival height.
export function highlandsVisibleTerrain(terrain, dock) {
 const vertices=[],grass=[],rock=[],cliff=[],lookup=new Map();
 const vertex=p=>{const key=p.map(v=>v.toFixed(7)).join(',');if(!lookup.has(key)){lookup.set(key,vertices.length/3);vertices.push(...p);}return lookup.get(key);};
 const cut=(poly,axis,value,sign)=>{
  const out=[];
  for(let i=0;i<poly.length;i++){
   const p=poly[i],q=poly[(i+1)%poly.length],a=sign*(p[axis]-value),b=sign*(q[axis]-value);
   if(a>=-1e-9)out.push(p);
   if((a<0)!==(b<0)){const t=a/(a-b);out.push(p.map((v,k)=>v+(q[k]-v)*t));}
  }
  return out;
 };
 const edges=[[0,-dock.width/2,1],[0,dock.width/2,-1],[2,dock.startZ,1],[2,dock.endZ,-1]];
 for(let i=0;i<terrain.indices.length;i+=3){
  const points=terrain.indices.slice(i,i+3).map(j=>terrain.vertices.slice(j*3,j*3+3));
  const[a,b,c]=points,ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
  const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,slope=Math.atan2(Math.hypot(nx,nz),ny);
  // Match the quad's actual 12-degree drive limit, including formerly grassy
  // 12–23 degree banks. Steeper cliff faces receive a separate deeper shade.
  const indices=slope>Math.PI/6?cliff:slope>Math.PI/15+1e-6?rock:grass;
  let inner=points;const visible=[];
  for(const[axis,value,sign]of edges){if(!inner.length)break;const outside=cut(inner,axis,value,-sign);if(outside.length>=3)visible.push(outside);inner=cut(inner,axis,value,sign);}
  for(const poly of visible)for(let j=1;j<poly.length-1;j++){
   const p=poly[0],q=poly[j],r=poly[j+1],area=(q[0]-p[0])*(r[2]-p[2])-(q[2]-p[2])*(r[0]-p[0]);
   if(Math.abs(area)>1e-10)indices.push(vertex(p),vertex(q),vertex(r));
  }
 }
 return{vertices,grass,rock,cliff};
}

// Thin mineral seams lie on the actual bank triangles rather than standing in
// for new boulders. They add readable strata without changing any collision.
export function highlandsRockStrata(visible) {
 const vertices=[],dark=[],light=[];
 const clip=(poly,y,above)=>{
  const out=[];
  for(let i=0;i<poly.length;i++){
   const p=poly[i],q=poly[(i+1)%poly.length],a=(p[1]-y)*(above?1:-1),b=(q[1]-y)*(above?1:-1);
   if(a>=0)out.push(p);
   if((a<0)!==(b<0)){const t=a/(a-b);out.push(p.map((v,k)=>v+(q[k]-v)*t));}
  }
  return out;
 };
 const indices=[...visible.rock,...visible.cliff];
 for(let i=0;i<indices.length;i+=3){
  const points=indices.slice(i,i+3).map(j=>visible.vertices.slice(j*3,j*3+3)),[a,b,c]=points;
  const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
  const normal=[uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx],length=Math.hypot(...normal);
  if(length<1e-8)continue;
  const cx=(a[0]+b[0]+c[0])/3,cz=(a[2]+b[2]+c[2])/3;
  for(let level=1.5;level<7;level+=1.1){
   // Interrupted runs read as stone layers, not a continuous navigation grid.
   if(Math.sin(cx*.47+cz*.31+level*.73)<-.42)continue;
   for(const [lo,hi,out]of[[level-.025,level+.015,dark],[level+.015,level+.027,light]]){
    const poly=clip(clip(points,lo,true),hi,false);
    if(poly.length<3)continue;
    const base=vertices.length/3;
    for(const p of poly)vertices.push(...p.map((v,k)=>v+normal[k]/length*.026));
    for(let j=1;j<poly.length-1;j++)out.push(base,base+j,base+j+1);
   }
  }
 }
 return{vertices,dark,light};
}
export function highlandsHeight(x,z,shore){
 const theta=Math.abs(Math.atan2(x/28,z/22));
 const roadHeight=theta<1.4?.85+1.95*smooth((theta-.22)/1.18):theta<=1.70?2.8:2.8+3.7*smooth((theta-1.70)/1.32);let h=roadHeight;
 const radius=Math.hypot(x/28,z/22),inner=smooth((.78-radius)/.42);
 h=h*(1-inner)+4.4*inner;
 for(const p of [{x:-20,z:0,w:17,d:19,y:2.8},{x:20,z:0,w:17,d:19,y:2.8},{x:0,z:-14,w:21,d:19,y:6.5}]){
  const d=Math.hypot(Math.max(0,Math.abs(x-p.x)-p.w/2),Math.max(0,Math.abs(z-p.z)-p.d/2)),mix=1-smooth(d/2.5);h=h*(1-mix)+p.y*mix;
 }
 // An open, level arrival apron connects directly to the existing wooden pier.
 const arrival=1-smooth(Math.max(Math.abs(x)-7,22-z)/4);h=h*(1-arrival)+.85*arrival;
 // Preserve the full five-metre road and wheel shoulders through every apron.
 const corridor=1-smooth((Math.abs(radius-1)*25-3.4)/2.8);h=h*(1-corridor)+roadHeight*corridor;
 // Broad, gently feathered pull-ins leave the ring itself free for passing.
 const pullIn=smooth((28-Math.abs(x))/6)*(1-smooth(Math.max(0,Math.abs(z-7)-2.7)/3.5));
 if(Math.abs(x)>13)h=h*(1-pullIn)+2.8*pullIn;
 const edge=Math.min(...shore.map((p,i)=>seg(x,z,p,shore[(i+1)%shore.length])));
 return +(.85+(h-.85)*smooth(edge/3)).toFixed(5);
}
export function createHighlands(shore){
 const step=1,minX=-38,minZ=-29,columns=77,rows=59,vertices=[],indices=[],lookup=new Map();
 const area=shore.reduce((a,p,i)=>a+p[0]*shore[(i+1)%shore.length][1]-shore[(i+1)%shore.length][0]*p[1],0),sign=Math.sign(area);
 function clip(poly){for(let j=0;j<shore.length;j++){const a=shore[j],b=shore[(j+1)%shore.length],cross=p=>sign*((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]));const out=[];for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],u=cross(p),v=cross(q);if(u>=-1e-7)out.push(p);if((u<0)!==(v<0)){const t=u/(u-v);out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}}poly=out;if(!poly.length)break;}return poly;}
 function id(p){const x=+p[0].toFixed(5),z=+p[1].toFixed(5),key=x+','+z;if(!lookup.has(key)){lookup.set(key,vertices.length/3);vertices.push(x,highlandsHeight(x,z,shore),z);}return lookup.get(key);}
 for(let z=minZ;z<minZ+rows-1;z+=step)for(let x=minX;x<minX+columns-1;x+=step)for(const tri of [[[x,z],[x,z+step],[x+step,z]],[[x+step,z],[x,z+step],[x+step,z+step]]]){const p=clip(tri);for(let i=1;i<p.length-1;i++){const a=id(p[0]),b=id(p[i]),c=id(p[i+1]);if(new Set([a,b,c]).size===3)indices.push(a,b,c);}}
 // Limit the *triangulated wheel surface*, not merely the road centerline.
 // Adjacent terrace blending must never introduce an unexpected steep shoulder.
 const corridors=[{a:[-27,5.82],b:[-24,7]},{a:[-24,7],b:[-18,7]},{a:[27,5.82],b:[24,7]},{a:[24,7],b:[18,7]}];
 const nearRoad=(x,z)=>Math.abs(Math.hypot(x/28,z/22)-1)*25<4.4||corridors.some(p=>seg(x,z,p.a,p.b)<3.5);
 const walk=[[-10,-20.55],[-8,-17],[-8,-8],[0,-8],[8,-8],[8,-17],[10,-20.55]];
 const guarded=[];for(let i=0;i<indices.length;i+=3){const tri=indices.slice(i,i+3),drive=tri.some(j=>nearRoad(vertices[j*3],vertices[j*3+2])),foot=tri.some(j=>walk.slice(1).some((p,k)=>seg(vertices[j*3],vertices[j*3+2],walk[k],p)<1.8));if(drive||foot)guarded.push({tri,target:Math.tan((drive?11.45:24)*Math.PI/180)});}
 const count=vertices.length/3;
 for(let pass=0;pass<320;pass++){
  const sums=new Float64Array(count),weights=new Uint16Array(count);let max=0;
  for(const{tri,target}of guarded){const[a,b,c]=tri.map(j=>vertices.slice(j*3,j*3+3)),ux=b[0]-a[0],uz=b[2]-a[2],vx=c[0]-a[0],vz=c[2]-a[2],det=ux*vz-uz*vx;if(Math.abs(det)<1e-8)continue;
   const gx=((b[1]-a[1])*vz-(c[1]-a[1])*uz)/det,gz=(ux*(c[1]-a[1])-vx*(b[1]-a[1]))/det,gradient=Math.hypot(gx,gz);max=Math.max(max,gradient-target);if(gradient<=target)continue;
   const mean=(a[1]+b[1]+c[1])/3,f=target/gradient;for(const j of tri){sums[j]+=(mean+(vertices[j*3+1]-mean)*f)-vertices[j*3+1];weights[j]++;}
  }
  if(max<=.006)break;
  for(let j=0;j<count;j++)if(weights[j])vertices[j*3+1]+=sums[j]/weights[j]*.9;
 }
 const bins=new Map();for(let i=0;i<indices.length;i+=3){const tri=indices.slice(i,i+3).map(j=>vertices.slice(j*3,j*3+3));for(let x=Math.floor(Math.min(...tri.map(p=>p[0]))/2);x<=Math.floor(Math.max(...tri.map(p=>p[0]))/2);x++)for(let z=Math.floor(Math.min(...tri.map(p=>p[2]))/2);z<=Math.floor(Math.max(...tri.map(p=>p[2]))/2);z++){const key=x+','+z;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(tri);}}
 const height=(x,z)=>{for(const[a,b,c]of bins.get(Math.floor(x/2)+','+Math.floor(z/2))||[]){const d=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(d)<1e-8)continue;const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/d,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/d,w=1-u-v;if(u>=-1e-5&&v>=-1e-5&&w>=-1e-5)return u*a[1]+v*b[1]+w*c[1];}return highlandsHeight(x,z,shore);};
 const at=(x,z)=>[+x.toFixed(4),+height(x,z).toFixed(5),+z.toFixed(4)];
 const points=Array.from({length:193},(_,i)=>{const a=-i*Math.PI*2/192;return at(28*Math.sin(a),22*Math.cos(a));});
 const roads=[{id:'highlands-loop',closed:true,width:5,points},{id:'arrival',width:5,points:[at(0,26.8),at(0,22)]},
  {id:'affirmation-apron',width:5,points:[at(-27,5.82),at(-24,7),at(-18,7)]},
  {id:'research-walk',kind:'footpath',width:2.2,points:[at(-10,-20.55),at(-8,-17),at(-8,-8),at(0,-8),at(8,-8),at(8,-17),at(10,-20.55)]},
  {id:'catering-apron',width:5,points:[at(27,5.82),at(24,7),at(18,7)]}];
 return {terrain:{vertices,indices,grid:{minX,minZ,step,columns,rows},version:1},roads,at,height};
}
