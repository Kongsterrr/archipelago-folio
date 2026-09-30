import * as THREE from 'three';

// Compare the rendered jacket with the actual, isolated driver-seat surface.
// Measure the central upper back only: armholes, headrests and seat cushions
// are not substitutes for support behind the torso.
export function createCarBackrestProbe(car) {
  car.group.updateWorldMatrix(true, true);
  const inverse = car.group.matrixWorld.clone().invert(), triangles = [];
  car.model.traverse(mesh => {
    if (!mesh.isMesh || !mesh.name.startsWith('car-driver-seat')) return;
    const positions = mesh.geometry.attributes.position, indices = mesh.geometry.index;
    const transform = inverse.clone().multiply(mesh.matrixWorld);
    for (let n = 0; n < (indices?.count ?? positions.count); n += 3) {
      const points = [0, 1, 2].map(k => new THREE.Vector3().fromBufferAttribute(positions, indices ? indices.getX(n + k) : n + k).applyMatrix4(transform));
      const [a, b, c] = points, normal = b.clone().sub(a).cross(c.clone().sub(a));
      if (Math.abs(normal.z) < normal.length() * .35) continue;
      const denominator = (b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
      if (Math.abs(denominator) > 1e-12) triangles.push({a, b, c, denominator});
    }
  });
  return avatar => {
    car.group.updateWorldMatrix(true, true);
    const inverse = car.group.matrixWorld.clone().invert();
    const localJoint = name => avatar.carPose.bones[name].getWorldPosition(new THREE.Vector3()).applyMatrix4(inverse);
    const hips = localJoint('Hips'), chest = localJoint('Chest'), gaps = [];
    avatar.model.traverse(mesh => {
      if (!mesh.isSkinnedMesh || !mesh.visible) return;
      mesh.skeleton.update();
      const ids = mesh.geometry.attributes.skinIndex, weights = mesh.geometry.attributes.skinWeight;
      const transform = inverse.clone().multiply(mesh.matrixWorld);
      for (let n = 0; n < ids.count; n++) {
        let major = 0;
        for (let k = 1; k < 4; k++) if (weights.getComponent(n,k) > weights.getComponent(n,major)) major = k;
        if (!['Spine', 'Chest'].includes(mesh.skeleton.bones[ids.getComponent(n,major)].name)) continue;
        const v = mesh.getVertexPosition(n, new THREE.Vector3()).applyMatrix4(transform);
        if (Math.abs(v.x-hips.x) > .09 || v.y < hips.y+.08 || v.y > chest.y+.055 || v.z < chest.z) continue;
        let surface = Infinity;
        for (const {a,b,c,denominator} of triangles) {
          const aa = ((b.y-c.y)*(v.x-c.x)+(c.x-b.x)*(v.y-c.y))/denominator;
          const bb = ((c.y-a.y)*(v.x-c.x)+(a.x-c.x)*(v.y-c.y))/denominator;
          if (Math.min(aa,bb,1-aa-bb) < -1e-6) continue;
          const z = aa*a.z+bb*b.z+(1-aa-bb)*c.z;
          // A front cushion edge below the back cannot count as a backrest.
          if (z > hips.z-.02) surface = Math.min(surface,z);
        }
        if (Number.isFinite(surface)) gaps.push(surface-v.z);
      }
    });
    gaps.sort((a,b) => a-b);
    return {covered:gaps.length, minimum:gaps[0]??Infinity, median:gaps[Math.floor(gaps.length/2)]??Infinity, penetrating:gaps.filter(g=>g<0).length};
  };
}
