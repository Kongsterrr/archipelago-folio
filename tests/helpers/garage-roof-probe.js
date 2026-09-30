// This measures actual GLB triangles/posed skin in car-local coordinates. It
// consumes the already-applied runtime pose and never adjusts contact anchors.
export function createG63RoofProbe(car) {
  car.group.updateWorldMatrix(true, true);
  const inverse = car.group.matrixWorld.clone().invert();
  const grid = new Map(), size = .06;
  let triangleCount = 0;
  car.model.traverse(mesh => {
    if (!mesh.isMesh) return;
    const position = mesh.geometry.getAttribute('position'), index = mesh.geometry.index;
    const transform = inverse.clone().multiply(mesh.matrixWorld);
    const vector = () => car.group.position.clone();
    for (let n = 0; n < (index?.count || position.count); n += 3) {
      const a = vector().fromBufferAttribute(position, index ? index.getX(n) : n).applyMatrix4(transform);
      const b = vector().fromBufferAttribute(position, index ? index.getX(n + 1) : n + 1).applyMatrix4(transform);
      const c = vector().fromBufferAttribute(position, index ? index.getX(n + 2) : n + 2).applyMatrix4(transform);
      // The G63 ceiling lies above 1.6 m; exclude windshield/vertical pillars.
      if (Math.max(a.y, b.y, c.y) < 1.6 || Math.min(a.y, b.y, c.y) > 2.2) continue;
      const normal = b.clone().sub(a).cross(c.clone().sub(a));
      if (Math.abs(normal.y) < normal.length() * .2) continue;
      const minX = Math.min(a.x, b.x, c.x), maxX = Math.max(a.x, b.x, c.x);
      const minZ = Math.min(a.z, b.z, c.z), maxZ = Math.max(a.z, b.z, c.z);
      if (maxX < -.85 || minX > .1 || maxZ < -.7 || minZ > .3) continue;
      const denominator = (b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);
      if (Math.abs(denominator) < 1e-12) continue;
      const triangle = {a, b, c, denominator}; triangleCount++;
      for (let x = Math.floor(minX/size); x <= Math.floor(maxX/size); x++) {
        for (let z = Math.floor(minZ/size); z <= Math.floor(maxZ/size); z++) {
          const key = x + ',' + z;
          if (!grid.has(key)) grid.set(key, []);
          grid.get(key).push(triangle);
        }
      }
    }
  });
  return function measureHead(model) {
    car.group.updateWorldMatrix(true, true);
    const inverse = car.group.matrixWorld.clone().invert();
    let clearance = Infinity, headVertices = 0, coveredVertices = 0, penetratingVertices = 0;
    model.traverse(mesh => {
      // JackAvatar adds hidden outline duplicates; only measure rendered skin.
      if (!mesh.isSkinnedMesh || !mesh.visible) return;
      mesh.skeleton.update();
      const indices = mesh.geometry.getAttribute('skinIndex'), weights = mesh.geometry.getAttribute('skinWeight');
      const transform = inverse.clone().multiply(mesh.matrixWorld);
      for (let n = 0; n < indices.count; n++) {
        let major = 0;
        for (let k = 1; k < 4; k++) if (weights.getComponent(n,k) > weights.getComponent(n,major)) major = k;
        if (mesh.skeleton.bones[indices.getComponent(n,major)].name !== 'Head') continue;
        const v = mesh.getVertexPosition(n,car.group.position.clone()).applyMatrix4(transform);
        headVertices++;
        let ceiling = Infinity;
        for (const t of grid.get(Math.floor(v.x/size)+','+Math.floor(v.z/size)) || []) {
          const a = ((t.b.z-t.c.z)*(v.x-t.c.x)+(t.c.x-t.b.x)*(v.z-t.c.z))/t.denominator;
          const b = ((t.c.z-t.a.z)*(v.x-t.c.x)+(t.a.x-t.c.x)*(v.z-t.c.z))/t.denominator;
          const c = 1-a-b;
          if (Math.min(a,b,c) < -1e-6) continue;
          ceiling = Math.min(ceiling,a*t.a.y+b*t.b.y+c*t.c.y);
        }
        if (!Number.isFinite(ceiling)) continue;
        coveredVertices++;
        const gap = ceiling-v.y;
        if (gap < 0) penetratingVertices++;
        clearance = Math.min(clearance,gap);
      }
    });
    return {clearance,headVertices,coveredVertices,penetratingVertices,triangleCount};
  };
}

