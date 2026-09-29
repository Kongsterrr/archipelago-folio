import * as THREE from 'three';

// Campus paving is a thin visual finish above the navigation slab. Extract its
// actual exported triangles once, including meshopt quantization transforms.
// Furniture/roof meshes are deliberately excluded, even if they share materials.
const FLOOR_NAMES = new Set(['static_sand', 'static_grass', 'static_wood',
 'district_learning_campus_paving', 'district_learning_campus_limestone']);
const CELL = 2;
export class BicycleSurface {
 constructor(model, walk) {
  this.walk = walk; this.cells = new Map(); this.triangleCount = 0;
  if (!model) return;
  model.updateWorldMatrix(true, true);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const edge = new THREE.Vector3(), normal = new THREE.Vector3();
  model.traverse(mesh => {
   if (!mesh.isMesh || !FLOOR_NAMES.has(mesh.name)) return;
   const positions = mesh.geometry.getAttribute('position'), indices = mesh.geometry.index;
   for (let n = 0; n < (indices?.count ?? positions.count); n += 3) {
    for (const [offset, p] of [[0,a],[1,b],[2,c]]) p.fromBufferAttribute(positions, indices ? indices.getX(n + offset) : n + offset).applyMatrix4(mesh.matrixWorld);
    normal.subVectors(b,a).cross(edge.subVectors(c,a)).normalize();
    if (normal.y < .98) continue;
    // Only ground finishes; no sign bases, stairs, tabletops or upper floors.
    if ([a,b,c].some(p => Math.abs(p.y - walk.groundAt(p)) > .10)) continue;
    const denominator = (b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);
    if (Math.abs(denominator) < 1e-10) continue;
    const tri = {a:a.clone(),b:b.clone(),c:c.clone(),denominator};
    for (let x = Math.floor(Math.min(a.x,b.x,c.x)/CELL); x <= Math.floor(Math.max(a.x,b.x,c.x)/CELL); x++) {
     for (let z = Math.floor(Math.min(a.z,b.z,c.z)/CELL); z <= Math.floor(Math.max(a.z,b.z,c.z)/CELL); z++) {
      const key = `${x},${z}`; if (!this.cells.has(key)) this.cells.set(key,[]); this.cells.get(key).push(tri);
     }
    }
    this.triangleCount++;
   }
  });
 }
 heightAt(point) {
  let height = this.walk.groundAt(point);
  for (const {a,b,c,denominator} of this.cells.get(`${Math.floor(point.x/CELL)},${Math.floor(point.z/CELL)}`) || []) {
   const u = ((b.z-c.z)*(point.x-c.x)+(c.x-b.x)*(point.z-c.z))/denominator;
   const v = ((c.z-a.z)*(point.x-c.x)+(a.x-c.x)*(point.z-c.z))/denominator;
   if (u >= -1e-7 && v >= -1e-7 && u+v <= 1+1e-7) height = Math.max(height,u*a.y+v*b.y+(1-u-v)*c.y);
  }
  return height;
 }
}

// Cache a stable rolling envelope from the imported tire, not its nominal rig
// radius. The source tread is slightly irregular; following each rotating vertex
// would introduce a new bobbing bug. This envelope clears it at every wheel phase.
export function bicycleTireEnvelope(wheel, fallbackRadius) {
 wheel.updateWorldMatrix(true,true);
 const inverse = wheel.matrixWorld.clone().invert(), matrix = new THREE.Matrix4(), p = new THREE.Vector3();
 let radius = fallbackRadius, halfWidth = .025;
 wheel.traverse(mesh => {
  if (!mesh.isMesh) return;
  matrix.multiplyMatrices(inverse,mesh.matrixWorld);
  const positions = mesh.geometry.getAttribute('position');
  for (let n = 0; n < positions.count; n++) {
   p.fromBufferAttribute(positions,n).applyMatrix4(matrix);
   radius = Math.max(radius,Math.hypot(p.y,p.z)); halfWidth = Math.max(halfWidth,Math.abs(p.x));
  }
 });
 const points = [];
 // A semicircle lets the tire climb paving edges before its axle crosses them.
 for (const x of [-halfWidth,0,halfWidth]) for (let n = 0; n <= 96; n++) {
  const angle = -Math.PI/2+n*Math.PI/96;
  points.push(new THREE.Vector3(x,-Math.cos(angle)*radius,Math.sin(angle)*radius));
 }
 return {radius,points};
}

const p = new THREE.Vector3(), inverse = new THREE.Matrix4(), relative = new THREE.Matrix4();
const rotation = new THREE.Matrix4();
export function fitBicycleToSurface(bicycle) {
 const {group,visual,surface,wheelPivots,tireEnvelopes} = bicycle;
 if (!surface || !tireEnvelopes?.length || bicycle.tireWheelbase < .01) return;
 // super.updateVisual has restored the current interpolated navigation pose.
 // Move the whole frame AND rider seat together; never detach tire/hand anchors.
 const wheelbase = bicycle.tireWheelbase;
 for (let iteration = 0; iteration < 3; iteration++) {
  group.updateWorldMatrix(true,true); inverse.copy(group.matrixWorld).invert();
  const corrections = wheelPivots.map((wheel,index) => {
   // Remove rolling rotation from the circular envelope, retaining fork steer.
   relative.multiplyMatrices(inverse,wheel.matrixWorld);
   rotation.makeRotationX(-wheel.rotation.x); relative.multiply(rotation);
   let lift = -Infinity;
   for (const sample of tireEnvelopes[index].points) {
    p.copy(sample).applyMatrix4(relative).applyMatrix4(group.matrixWorld);
    lift = Math.max(lift,surface.heightAt(p)-p.y);
   }
   return lift;
  });
  if (corrections.some(value => !Number.isFinite(value))) return;
  group.position.y += (corrections[0]+corrections[1])/2;
  group.rotation.x += Math.atan2(corrections[0]-corrections[1],wheelbase);
 }
 // Cover sub-millimetre GLB quantization and circular sampling at slab edges.
 group.position.y += .002;
 visual.rotation.z = 0;
 group.updateWorldMatrix(true,true);
}
