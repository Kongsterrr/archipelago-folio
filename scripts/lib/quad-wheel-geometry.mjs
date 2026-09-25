// Measured in the owner's original GLB frame: +Z nose, +Y up, tire contact Y=0.
// Split before quantization, so mesh-local optimizer transforms never affect axle pivots.
export const QUAD_SOURCE_WHEELS = [
  { id: 'front-left', center: [.283, .153, .347] },
  { id: 'front-right', center: [-.283, .153, .347] },
  { id: 'rear-left', center: [.281, .151, -.317] },
  { id: 'rear-right', center: [-.281, .151, -.317] },
];
export const QUAD_SOURCE_ANCHORS = {
  saddle: [0, .428, -.10],
  leftGrip: [.224, .552, .114],
  rightGrip: [-.224, .552, .114],
  leftFootrest: [.205, .170, -.05],
  rightFootrest: [-.205, .170, -.05],
};

export function classifyQuadTriangle(position, a, b, c) {
  const x = (position[a * 3] + position[b * 3] + position[c * 3]) / 3;
  const y = (position[a * 3 + 1] + position[b * 3 + 1] + position[c * 3 + 1]) / 3;
  const z = (position[a * 3 + 2] + position[b * 3 + 2] + position[c * 3 + 2]) / 3;
  if (Math.abs(x) <= .207) return 0;
  for (let i = 0; i < QUAD_SOURCE_WHEELS.length; i++) {
    const [wx, wy, wz] = QUAD_SOURCE_WHEELS[i].center;
    if (Math.sign(wx) === Math.sign(x) && Math.hypot(y - wy, z - wz) < .168) return i + 1;
  }
  return 0;
}

export function authorQuadWheelNodes(document) {
  const root = document.getRoot();
  const sourceNode = root.listNodes().find(node => node.getMesh());
  if (!sourceNode || root.listMeshes().length !== 1 || sourceNode.getMesh().listPrimitives().length !== 1) {
    throw new Error('This wheel selection is calibrated to the supplied single-mesh quad asset.');
  }
  if (sourceNode.getTranslation().some(v => v !== 0) || sourceNode.getScale().some(v => v !== 1)) {
    throw new Error('Segment the unquantized original GLB, not an already optimized model.');
  }
  const source = sourceNode.getMesh().listPrimitives()[0];
  const position = source.getAttribute('POSITION').getArray();
  const indices = source.getIndices().getArray();
  const partitions = Array.from({ length: 5 }, () => []);
  for (let i = 0; i < indices.length; i += 3) {
    partitions[classifyQuadTriangle(position, indices[i], indices[i + 1], indices[i + 2])].push(indices[i], indices[i + 1], indices[i + 2]);
  }
  if (partitions.some(p => p.length === 0) || partitions.reduce((sum, p) => sum + p.length, 0) !== indices.length) {
    throw new Error('Wheel extraction must retain every original triangle exactly once.');
  }
  const frame = document.createNode('quad-bike-source-frame');
  const buffer = root.listBuffers()[0];
  partitions.forEach((partition, index) => {
    const wheel = index ? QUAD_SOURCE_WHEELS[index - 1] : null;
    const center = wheel?.center || [0, 0, 0];
    const name = wheel ? `quad-wheel-${wheel.id}` : 'quad-chassis';
    const remap = new Map();
    const sourceVertices = [];
    const newIndices = new Uint32Array(partition.length);
    partition.forEach((old, i) => {
      if (!remap.has(old)) { remap.set(old, remap.size); sourceVertices.push(old); }
      newIndices[i] = remap.get(old);
    });
    const primitive = document.createPrimitive().setMaterial(source.getMaterial());
    for (const semantic of source.listSemantics()) {
      const original = source.getAttribute(semantic);
      const components = original.getElementSize();
      const oldArray = original.getArray();
      const array = new oldArray.constructor(sourceVertices.length * components);
      sourceVertices.forEach((old, i) => {
        for (let j = 0; j < components; j++) array[i * components + j] = oldArray[old * components + j] - (semantic === 'POSITION' ? center[j] : 0);
      });
      primitive.setAttribute(semantic, document.createAccessor(`${name}-${semantic}`).setType(original.getType()).setArray(array).setBuffer(buffer));
    }
    primitive.setIndices(document.createAccessor(`${name}-indices`).setType('SCALAR').setArray(newIndices).setBuffer(buffer));
    const mesh = document.createMesh(`${name}-mesh`).addPrimitive(primitive);
    // An explicit pivot parent survives meshopt's child-local quantization transform.
    const pivot = document.createNode(name).setTranslation(center).setExtras({ role: wheel ? 'wheel-pivot' : 'chassis', sourceTriangles: partition.length / 3 });
    pivot.addChild(document.createNode(`${name}-geometry`).setMesh(mesh));
    frame.addChild(pivot);
  });
  for (const scene of root.listScenes()) { scene.removeChild(sourceNode); scene.addChild(frame); }
  sourceNode.dispose();
  const result = { sourceTriangles: indices.length / 3, partitions: Object.fromEntries(partitions.map((p, i) => [i ? QUAD_SOURCE_WHEELS[i - 1].id : 'chassis', p.length / 3])) };
  frame.setExtras({ ...result, sourceAnchors: QUAD_SOURCE_ANCHORS, sourceWheelRadius: .153 });
  return result;
}
