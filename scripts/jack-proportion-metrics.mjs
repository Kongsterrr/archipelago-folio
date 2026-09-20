import * as THREE from 'three';

const HEAD_JOINT = /^(Head|LeftEye|RightEye|LeftBrow|RightBrow|Mouth)$/;
const ARM_JOINT = /^(Left|Right)(Arm|ForeArm)$/;
const HAND_JOINT = /^(Left|Right)Hand$/;
const PANTS_JOINT = /^(Hips|(Left|Right)(UpLeg|Leg))$/;
const WAIST_OFFSETS = [.03, .05, .07];

function regionFor(material, names) {
  if (!names.length) return null;
  const every = expression => names.every(name => expression.test(name));
  if (every(HEAD_JOINT)) return 'head';
  if (/CreamCanvas/.test(material) && names.every(name => name === 'Chest')) return 'coat';
  if (/CreamCanvas/.test(material) && every(ARM_JOINT)) return 'sleeves';
  if (/Skin/.test(material) && every(HAND_JOINT)) return 'hands';
  if (/NavyKnit/.test(material) && every(PANTS_JOINT)) return 'pants';
  return null;
}

// Cross the rendered triangles with a horizontal plane. Extrema of these
// segments are the actual front silhouette, including thickness and thumbs;
// an axis-aligned 3D box would include empty corners and miss this distinction.
function section(triangles, y, side) {
  let inner = Infinity, outer = -Infinity, intersections = 0;
  const add = x => {
    x *= side;
    if (x < 0) return;
    inner = Math.min(inner, x);
    outer = Math.max(outer, x);
    intersections++;
  };
  for (const triangle of triangles) for (let edge = 0; edge < 3; edge++) {
    const a = triangle[edge], b = triangle[(edge + 1) % 3];
    if (Math.abs(a.y - y) < 1e-10) add(a.x);
    if ((a.y < y && b.y > y) || (a.y > y && b.y < y)) {
      add(a.x + (b.x - a.x) * ((y - a.y) / (b.y - a.y)));
    }
  }
  return {inner: intersections ? inner : null, outer: intersections ? outer : null, intersections};
}

function gapBetween(innerPart, outerPart, y, side) {
  const inside = section(innerPart, y, side), outside = section(outerPart, y, side);
  return {
    y,
    gap: inside.intersections && outside.intersections ? inside.inner - outside.outer : null,
    innerEdge: inside.inner,
    outerEdge: outside.outer,
    innerIntersections: inside.intersections,
    outerIntersections: outside.intersections,
  };
}

/** Read-only sampler of current deformed skin in the model's own coordinate
 * space. It does not change poses, weights, metadata, or geometry. Topology is
 * cached; callers advance their AnimationMixer before each sample.
 *
 * Supports both one mesh with material groups and GLTFLoader's child mesh per
 * primitive. Classification follows material and skin contributions, so it
 * survives mesh merging, vertex welding, and meshopt quantization.
 */
export function createJackProportionSampler(model) {
  const meshes = [], skeletons = new Set(), joints = new Map();
  model.traverse(mesh => {
    if (!mesh.isSkinnedMesh) return;
    const geometry = mesh.geometry, indices = geometry.getAttribute('skinIndex');
    const weights = geometry.getAttribute('skinWeight'), position = geometry.getAttribute('position');
    if (!indices || !weights || !position) throw new Error('Character skin is missing vertex attributes');
    skeletons.add(mesh.skeleton);
    for (const bone of mesh.skeleton.bones) joints.set(bone.name, bone);
    const contributors = Array.from({length: position.count}, (_, i) => {
      const names = [];
      for (let k = 0; k < 4; k++) if (weights.getComponent(i, k) > .01) {
        const bone = mesh.skeleton.bones[indices.getComponent(i, k)];
        if (!bone) throw new Error('Character skin references an unknown bone');
        names.push(bone.name);
      }
      return names;
    });
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const count = geometry.index?.count ?? position.count;
    const groups = geometry.groups.length ? geometry.groups : [{start: 0, count, materialIndex: 0}];
    const triangles = [];
    for (const group of groups) {
      const name = materials[group.materialIndex || 0]?.name || '';
      const end = Math.min(count, group.start + group.count);
      for (let offset = group.start; offset + 2 < end; offset += 3) {
        const ids = [0, 1, 2].map(n => geometry.index ? geometry.index.getX(offset + n) : offset + n);
        const regions = ids.map(i => regionFor(name, contributors[i]));
        triangles.push({ids, region: regions[0] && regions.every(r => r === regions[0]) ? regions[0] : null});
      }
    }
    meshes.push({mesh, triangles, vertices: Array.from({length: position.count}, () => new THREE.Vector3())});
  });
  if (!meshes.length) throw new Error('No skinned character geometry to measure');

  return function sample() {
    model.updateWorldMatrix(true, true);
    for (const skeleton of skeletons) skeleton.update();
    const inverse = model.matrixWorld.clone().invert();
    const regions = {head: [], coat: [], sleeves: [], hands: [], pants: []};
    const fullBounds = new THREE.Box3(), headBounds = new THREE.Box3(), coatBounds = new THREE.Box3();
    for (const {mesh, triangles, vertices} of meshes) {
      const transform = inverse.clone().multiply(mesh.matrixWorld);
      for (let i = 0; i < vertices.length; i++) {
        mesh.getVertexPosition(i, vertices[i]).applyMatrix4(transform);
        if (!vertices[i].toArray().every(Number.isFinite)) throw new Error('Non-finite deformed character vertex');
        fullBounds.expandByPoint(vertices[i]);
      }
      for (const {ids, region} of triangles) if (region) {
        const triangle = ids.map(i => vertices[i]);
        regions[region].push(triangle);
        if (region === 'head' || region === 'coat') {
          const bounds = region === 'head' ? headBounds : coatBounds;
          for (const point of triangle) bounds.expandByPoint(point);
        }
      }
    }
    for (const [name, triangles] of Object.entries(regions)) {
      if (!triangles.length) throw new Error(`Cannot identify the actual ${name} geometry`);
    }
    const jointPosition = name => {
      const bone = joints.get(name);
      if (!bone) throw new Error(`Missing joint ${name}`);
      return bone.getWorldPosition(new THREE.Vector3()).applyMatrix4(inverse);
    };
    const sides = {};
    for (const [name, sign] of [['Left', -1], ['Right', 1]]) {
      const shoulder = jointPosition(`${name}Arm`), elbow = jointPosition(`${name}ForeArm`), hand = jointPosition(`${name}Hand`);
      sides[name] = {
        waist: WAIST_OFFSETS.map(offset => ({offset, ...gapBetween(regions.sleeves, regions.coat, coatBounds.min.y + offset, sign)})),
        hand: gapBetween(regions.hands, regions.pants, hand.y - .011, sign),
        elbowOutward: (elbow.x - shoulder.x) * sign,
        handOutward: (hand.x - shoulder.x) * sign,
      };
    }
    const height = fullBounds.max.y - fullBounds.min.y, headHeight = headBounds.max.y - headBounds.min.y;
    return {
      height, headHeight, headsTall: height / headHeight,
      footY: fullBounds.min.y, crownY: fullBounds.max.y, chinY: headBounds.min.y,
      triangleCounts: Object.fromEntries(Object.entries(regions).map(([name, tris]) => [name, tris.length])),
      sides,
    };
  };
}

export function measureJackProportions(model) {
  return createJackProportionSampler(model)();
}
