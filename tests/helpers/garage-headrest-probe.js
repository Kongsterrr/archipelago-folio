// Cache actual seat/headrest triangles once in car-local space. Recreate only
// after model replacement; the returned probe supports arbitrary vehicle yaw,
// position and steering. Hidden Jack outline duplicates are excluded.
// Usage: const probe=createCarHeadrestProbe(car); probe(avatar.model).
export function createCarHeadrestProbe(car, measuredBounds = {}) {
  const kind=car.id;
  car.group.updateWorldMatrix(true,true);
  const inverse=car.group.matrixWorld.clone().invert();
  const model=car.model;
  // Source seats are merged into the body mesh. These local bands exclude
  // the dashboard, rear bench and roof while retaining the driver headrest.
  const {lo,hi,top} = {...(kind === '911' ? {lo:.18,hi:.60,top:1.13} : {lo:-.005,hi:.33,top:1.735}),...measuredBounds};
  if (![lo,hi,top].every(Number.isFinite) || lo >= hi) throw new Error('Invalid car headrest bounds');
  const grid = new Map(), cell = .03;
  model.traverse(mesh => {
    if (!mesh.isMesh || !(mesh.name.startsWith('car-body') || mesh.name.startsWith('car-driver-seat'))) return;
    const p = mesh.geometry.getAttribute('position'), ix = mesh.geometry.index;
    const m = inverse.clone().multiply(mesh.matrixWorld).elements;
    const point = i => {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      return [m[0]*x+m[4]*y+m[8]*z+m[12], m[1]*x+m[5]*y+m[9]*z+m[13], m[2]*x+m[6]*y+m[10]*z+m[14]];
    };
    for (let k = 0; k < (ix?.count || p.count); k += 3) {
      const a = point(ix ? ix.getX(k) : k), b = point(ix ? ix.getX(k+1) : k+1), c = point(ix ? ix.getX(k+2) : k+2);
      if (Math.min(a[2],b[2],c[2]) > hi || Math.max(a[2],b[2],c[2]) < lo || Math.min(a[1],b[1],c[1]) > top) continue;
      const den = (b[1]-c[1])*(a[0]-c[0]) + (c[0]-b[0])*(a[1]-c[1]);
      if (Math.abs(den) < 1e-12) continue;
      const tri = {a,b,c,den};
      for (let x = Math.floor(Math.min(a[0],b[0],c[0])/cell); x <= Math.floor(Math.max(a[0],b[0],c[0])/cell); x++) {
        for (let y = Math.floor(Math.min(a[1],b[1],c[1])/cell); y <= Math.floor(Math.max(a[1],b[1],c[1])/cell); y++) {
          const key = x+','+y;
          if (!grid.has(key)) grid.set(key, []);
          grid.get(key).push(tri);
        }
      }
    }
  });
  return function measureHead(model) {
    car.group.updateWorldMatrix(true,true);
    const inverse=car.group.matrixWorld.clone().invert(),vertices=[];
    model.traverse(mesh=>{
      if(!mesh.isSkinnedMesh||!mesh.visible)return;
      mesh.skeleton.update();
      const ids=mesh.geometry.getAttribute('skinIndex'),weights=mesh.geometry.getAttribute('skinWeight');
      const transform=inverse.clone().multiply(mesh.matrixWorld);
      for(let n=0;n<ids.count;n++){
        let major=0;for(let k=1;k<4;k++)if(weights.getComponent(n,k)>weights.getComponent(n,major))major=k;
        if(mesh.skeleton.bones[ids.getComponent(n,major)].name!=='Head')continue;
        vertices.push(mesh.getVertexPosition(n,car.group.position.clone()).applyMatrix4(transform).toArray());
      }
    });
    let minimum = Infinity, covered = 0, penetrating = 0, sample = null;
    for (const v of vertices) {
      const [x,y,z] = v;
      if (y > top) continue;
      let surfaceZ = Infinity;
      for (const {a,b,c,den} of grid.get(Math.floor(x/cell)+','+Math.floor(y/cell)) || []) {
        const aa = ((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/den;
        const bb = ((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/den;
        const cc = 1-aa-bb;
        if (Math.min(aa,bb,cc) < -1e-6) continue;
        const hit = aa*a[2]+bb*b[2]+cc*c[2];
        if (hit >= lo && hit <= hi) surfaceZ = Math.min(surfaceZ, hit);
      }
      if (!Number.isFinite(surfaceZ)) continue;
      covered++;
      const clearance = surfaceZ-z;
      if (clearance < 0) penetrating++;
      if (clearance < minimum) { minimum = clearance; sample = {vertex:v, surfaceZ}; }
    }
    return {clearance:minimum, covered, penetrating, headVertices:vertices.length, sample};
  };
}
