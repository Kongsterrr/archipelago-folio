import * as THREE from 'three';

const EPSILON = .001;

// Measure the decoded, posed skin. Material names and effective bone weights
// survive GLB merging/quantization; authoring dimensions and userData do not
// participate. In particular, the sleeve set includes Chest/Arm blends while
// excluding triangles supported by Chest alone.
export function createV7BodySampler(model) {
  const meshes = [], joints = new Map();
  model.traverse(mesh => {
    if (!mesh.isSkinnedMesh) return;
    const g = mesh.geometry, ids = g.getAttribute('skinIndex'), weights = g.getAttribute('skinWeight');
    for (const joint of mesh.skeleton.bones) joints.set(joint.name, joint);
    const contributors = Array.from({length: ids.count}, (_, i) => [0, 1, 2, 3]
      .filter(k => weights.getComponent(i, k) > EPSILON)
      .map(k => mesh.skeleton.bones[ids.getComponent(i, k)].name));
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const count = g.index?.count ?? ids.count, triangles = [];
    for (const group of g.groups.length ? g.groups : [{start: 0, count, materialIndex: 0}]) {
      if (!/CreamCanvas/.test(materials[group.materialIndex || 0]?.name || '')) continue;
      for (let offset = group.start; offset < group.start + group.count; offset += 3) {
        const vi = [0, 1, 2].map(k => g.index ? g.index.getX(offset + k) : offset + k);
        const names = [...new Set(vi.flatMap(i => contributors[i]))];
        if (names.every(n => n === 'Chest')) triangles.push({vi, region: 'coat'});
        for (const side of ['Left', 'Right']) {
          const limb = new RegExp(`^${side}(Arm|ForeArm)$`);
          if (names.some(n => limb.test(n)) && names.every(n => n === 'Chest' || limb.test(n))) {
            triangles.push({vi, region: side, blended: names.includes('Chest')});
          }
        }
      }
    }
    meshes.push({mesh, contributors, triangles});
  });
  if (!meshes.length) throw new Error('No actual character skin to sample');

  return () => {
    model.updateWorldMatrix(true, true);
    const inverse = name => {
      const joint = joints.get(name);
      if (!joint) throw new Error(`Missing ${name} joint`);
      return joint.matrixWorld.clone().invert();
    };
    const chestInverse = inverse('Chest');
    const parts = Object.fromEntries(['LeftFoot', 'RightFoot', 'LeftHand', 'RightHand'].map(name =>
      [name, {bounds: new THREE.Box3(), inverse: inverse(name), vertices: 0}]));
    const regions = {coat: [], Left: [], Right: []}, blends = {Left: 0, Right: 0};
    for (const {mesh, contributors, triangles} of meshes) {
      mesh.skeleton.update();
      const points = contributors.map((names, i) => {
        const p = mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
        const part = names.length === 1 ? parts[names[0]] : null;
        if (part) { part.bounds.expandByPoint(p.clone().applyMatrix4(part.inverse)); part.vertices++; }
        return p.applyMatrix4(chestInverse);
      });
      for (const {vi, region, blended} of triangles) {
        regions[region].push(vi.map(i => points[i]));
        if (blended) blends[region]++;
      }
    }
    const dimensions = Object.fromEntries(Object.entries(parts).map(([name, part]) => [name, {
      dimensions: part.bounds.getSize(new THREE.Vector3()).toArray(),
      min: part.bounds.min.toArray(), max: part.bounds.max.toArray(), vertices: part.vertices,
    }]));
    const shoulders = {};
    for (const [side, sign] of [['Left', -1], ['Right', 1]]) {
      const shoulder = joints.get(`${side}Arm`).getWorldPosition(new THREE.Vector3()).applyMatrix4(chestInverse);
      const armInverse = inverse(`${side}Arm`).multiply(joints.get('Chest').matrixWorld);
      const armTriangles = regions[side].map(tri => tri.map(p => p.clone().applyMatrix4(armInverse)));
      const band = slice(armTriangles, -.05), armWidth = range(band.map(p => p.x));
      const armDepth = range(band.map(p => p.z));
      shoulders[side] = {
        sleeveTriangles: regions[side].length, blendedTriangles: blends[side],
        upperArmWidth: armWidth.max - armWidth.min, upperArmDepth: armDepth.max - armDepth.min,
        slices: [-.020, -.005, .010].map(offset => {
          const y = shoulder.y + offset;
          const sleeve = slice(regions[side], y), coat = slice(regions.coat, y).filter(p => sign * p.x >= 0);
          return {offset, y, sleeveIntersections: sleeve.length, coatIntersections: coat.length,
            projections: [0, Math.PI / 4, Math.PI / 2].map(angle => {
              const project = p => sign * p.x * Math.cos(angle) + p.z * Math.sin(angle);
              const a = range(sleeve.map(project)), b = range(coat.map(project));
              return {view: angle === 0 ? 'front' : angle === Math.PI / 2 ? 'side' : 'three-quarter',
                gap: Math.max(a.min, b.min) - Math.min(a.max, b.max)};
            })};
        }),
      };
    }
    const coatWidth = y => {const r = range(slice(regions.coat, y).map(p => p.x)); return r.max - r.min;};
    return {parts: dimensions, shoulders, coat: {upperWidth: coatWidth(.015), waistWidth: coatWidth(-.12)}};
  };
}

function range(values) {
  if (!values.length) return {min: NaN, max: NaN};
  return {min: Math.min(...values), max: Math.max(...values)};
}

// Horizontal intersections with real triangles, not mesh bounding boxes. Their
// projected ranges detect a visible split between the torso and sleeve root.
function slice(triangles, y) {
  const result = [];
  for (const triangle of triangles) for (let i = 0; i < 3; i++) {
    const a = triangle[i], b = triangle[(i + 1) % 3];
    if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
      result.push(a.clone().lerp(b, (y - a.y) / (b.y - a.y)));
    }
  }
  return result;
}
