import * as THREE from 'three';

// Read decoded, posed geometry; no metadata dimensions or authoring parameters.
export function measureV46Geometry(model) {
 model.updateWorldMatrix(true,true);
 const invModel=model.matrixWorld.clone().invert(),head=model.getObjectByName('Head');
 if(!head) throw Error('Missing Head joint');
 const invHead=head.matrixWorld.clone().invert(), all=new THREE.Box3(),coat=new THREE.Box3();
 const faceCandidates=[],pantsCandidates=[];
 let triangles=0;
 model.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  mesh.skeleton.update();
  const g=mesh.geometry,pos=g.getAttribute('position'),ids=g.getAttribute('skinIndex'),w=g.getAttribute('skinWeight');
  const verts=Array.from({length:pos.count},(_,i)=>mesh.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));
  for(const v of verts)all.expandByPoint(v.clone().applyMatrix4(invModel));
  const names=Array.from({length:pos.count},(_,i)=>[0,1,2,3].filter(k=>w.getComponent(i,k)>.01).map(k=>mesh.skeleton.bones[ids.getComponent(i,k)].name));
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material],count=g.index?.count??pos.count;
  for(const gr of g.groups.length?g.groups:[{start:0,count,materialIndex:0}]){
   const mat=materials[gr.materialIndex??0]?.name??'';
   for(let j=gr.start;j<gr.start+gr.count;j+=3){
    triangles++;const vi=[0,1,2].map(d=>g.index?g.index.getX(j+d):j+d),joints=new Set(vi.flatMap(i=>names[i]));
    if(/CreamCanvas/.test(mat)&&[...joints].every(n=>n==='Chest'))for(const i of vi)coat.expandByPoint(verts[i].clone().applyMatrix4(invModel));
    if(/Skin/.test(mat)&&[...joints].every(n=>n==='Head'))faceCandidates.push({vertices:vi.map(i=>verts[i].clone().applyMatrix4(invHead)),joints});
    if(/NavyKnit/.test(mat)&&[...joints].every(n=>/^(Hips|(Left|Right)(UpLeg|Leg))$/.test(n)))pantsCandidates.push({vertices:vi.map(i=>verts[i].clone().applyMatrix4(invModel)),joints});
   }
  }
 });
 function components(ts){
  const uf=ts.map((_,i)=>i),points=new Map(),find=i=>uf[i]===i?i:(uf[i]=find(uf[i]));
  for(let i=0;i<ts.length;i++)for(const p of ts[i].vertices){
   // Decoded seams may duplicate a position; quantize to 0.01mm, below meshopt error.
   const k=p.toArray().map(n=>Math.round(n*1e5)).join(',');
   if(points.has(k))uf[find(i)]=find(points.get(k));else points.set(k,i);
  }
  const groups=new Map();for(let i=0;i<ts.length;i++){const k=find(i);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(ts[i]);}
  return [...groups.values()].sort((a,b)=>b.length-a.length);
 }
 const faces=components(faceCandidates),face=faces[0];
 if(!face||face.length<500)throw Error('No connected main facial skin found');
 const b=new THREE.Box3();for(const t of face)for(const p of t.vertices)b.expandByPoint(p);
 function faceSlice(t){
  const y=THREE.MathUtils.lerp(b.min.y,b.max.y,t);let left=Infinity,right=-Infinity;
  for(const tri of face)for(let i=0;i<3;i++){
   const a=tri.vertices[i],c=tri.vertices[(i+1)%3];
   if((a.y<=y&&c.y>y)||(c.y<=y&&a.y>y)){const x=a.x+(c.x-a.x)*(y-a.y)/(c.y-a.y);left=Math.min(left,x);right=Math.max(right,x);}
  }
  const ray=new THREE.Ray(new THREE.Vector3(0,y,b.min.z-1),new THREE.Vector3(0,0,1));let front=Infinity;
  for(const tri of face){const hit=ray.intersectTriangle(...tri.vertices,false,new THREE.Vector3());if(hit)front=Math.min(front,hit.z);}
  return {t,y,width:right-left,frontZ:front};
 }
 const pants=components(pantsCandidates),faceDims=b.getSize(new THREE.Vector3()),height=all.max.y-all.min.y;
 return {height,hemY:coat.min.y,hemToFloor:coat.min.y-all.min.y,hemToFloorFraction:(coat.min.y-all.min.y)/height,
 face:{mainTriangles:face.length,components:faces.map(c=>c.length),width:faceDims.x,height:faceDims.y,depth:faceDims.z,widthHeight:faceDims.x/faceDims.y,slices:[.15,.2,.3,.45,.6,.75,.85].map(faceSlice)},
 pants:{totalTriangles:pantsCandidates.length,components:pants.map(c=>({triangles:c.length,joints:[...new Set(c.flatMap(t=>[...t.joints]))]}))},triangles};
}
