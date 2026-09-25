import * as THREE from 'three';

// Coordinates in the vehicle's game frame: tyres touch Y=0, forward is -Z.
// These are seat and grip contacts, not offsets copied from the boat animation.
export const QUAD_RIDER = Object.freeze({
  mount: [0, 0, 0],
  scale: 1,
  pelvis: [0, .79, .06],
  grips: {Left: [-.350625, .9108, -.1881], Right: [.350625, .9108, -.1881]},
  feet: {Left: [-.21, .60, -.075], Right: [.21, .60, -.075]},
});

// The imported character has deliberately short legs. Discreet raised pegs
// support that fixed anatomy; stretching the rig would change Jack's identity.
export function addQuadRiderSupports(group) {
  if (group.getObjectByName('quad-chibi-footrests')) return;
  const supports = new THREE.Group();
  supports.name = 'quad-chibi-footrests';
  const rubber = new THREE.MeshStandardMaterial({color: '#1e2429', roughness: .83});
  const metal = new THREE.MeshStandardMaterial({color: '#41484e', roughness: .45, metalness: .65});
  for (const side of [-1, 1]) {
    const peg = new THREE.Mesh(new THREE.BoxGeometry(.17, .022, .225), rubber);
    peg.name = side < 0 ? 'quad-left-raised-peg' : 'quad-right-raised-peg';
    peg.position.set(side * .258, .5425, -.108);
    const bracket = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, .22, 8), metal);
    bracket.position.set(side * .258, .4215, -.058);
    supports.add(peg, bracket);
    for (const object of [peg, bracket]) {object.castShadow = true; object.receiveShadow = true;}
  }
  group.add(supports);
  return supports;
}

const point = object => object.getWorldPosition(new THREE.Vector3());
const rotation = object => object.getWorldQuaternion(new THREE.Quaternion());

export class QuadRiderPose {
  constructor(model, avatarRoot, spec) {
    this.model = model;
    this.root = avatarRoot;
    this.spec = spec;
    model.updateWorldMatrix(true, true);
    this.bones = {};
    this.bind = new Map();
    model.traverse(bone => {
      if (!bone.isBone) return;
      this.bones[bone.name] = bone;
      this.bind.set(bone.name, {position: bone.position.clone(), quaternion: bone.quaternion.clone(), worldQuaternion: rotation(bone)});
    });
    this.restHips = avatarRoot.worldToLocal(point(this.bones.Hips));
    this.contacts = {};
    this.handVertices = {Left: [], Right: []};
    model.traverse(mesh => {
      if (!mesh.isSkinnedMesh) return;
      const ids = mesh.geometry.getAttribute('skinIndex'), weights = mesh.geometry.getAttribute('skinWeight');
      for (let i = 0; i < ids.count; i++) for (let k = 0; k < 4; k++) {
        const weight = weights.getComponent(i, k);
        if (weight < .65) continue;
        const name = mesh.skeleton.bones[ids.getComponent(i, k)].name;
        const side = name === 'LeftHand' ? 'Left' : name === 'RightHand' ? 'Right' : null;
        if (side) this.handVertices[side].push({mesh, index: i, weight});
      }
    });
  }

  skinPalm(side) {
    const centroid = new THREE.Vector3(); let total = 0;
    for (const {mesh, index, weight} of this.handVertices[side]) {
      const position = mesh.getVertexPosition(index, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
      centroid.addScaledVector(position, weight); total += weight;
    }
    return centroid.divideScalar(total || 1);
  }

  aim(name, childName, target) {
    const bone = this.bones[name];
    const oldDirection = point(this.bones[childName]).sub(point(bone)).normalize();
    const newDirection = target.clone().sub(point(bone)).normalize();
    const delta = new THREE.Quaternion().setFromUnitVectors(oldDirection, newDirection);
    bone.quaternion.copy(rotation(bone.parent).invert().multiply(delta).multiply(rotation(bone))).normalize();
    bone.updateWorldMatrix(false, true);
  }

  solve(side, upperName, lowerName, endName, target, pole) {
    const upper = this.bones[side + upperName], lower = this.bones[side + lowerName], end = this.bones[side + endName];
    const start = point(upper), first = point(lower), last = point(end);
    const a = start.distanceTo(first), b = first.distanceTo(last);
    const direction = target.clone().sub(start), requested = direction.length();
    const distance = THREE.MathUtils.clamp(requested, Math.abs(a - b) + .00001, a + b - .00001);
    direction.normalize();
    const along = (a * a - b * b + distance * distance) / (2 * distance);
    const height = Math.sqrt(Math.max(0, a * a - along * along));
    pole.addScaledVector(direction, -pole.dot(direction)).normalize();
    const elbow = start.clone().addScaledVector(direction, along).addScaledVector(pole, height);
    const reachable = start.clone().addScaledVector(direction, distance);
    this.aim(side + upperName, side + lowerName, elbow);
    this.aim(side + lowerName, side + endName, reachable);
    return {requested, reach: a + b};
  }

  apply(quad) {
    const frame = quad.group, mount = quad.mountPoint;
    if (this.root.parent !== mount) mount.add(this.root);
    this.root.quaternion.identity();
    this.root.scale.setScalar(QUAD_RIDER.scale);
    // Put the pelvis on the saddle instead of placing the avatar's feet at it.
    this.root.position.fromArray(QUAD_RIDER.pelvis).sub(mount.position).addScaledVector(this.restHips, -QUAD_RIDER.scale);
    for (const [name, rest] of this.fittedPose || this.bind) {
      this.bones[name].position.copy(rest.position);
      this.bones[name].quaternion.copy(rest.quaternion);
    }
    if (this.fittedPose) return;
    frame.updateWorldMatrix(true, true);
    const frameQ = rotation(frame);
    // An ATV riding stance leans forward from the hips. Counter-rotate the
    // neck so Jack can see ahead instead of looking into the dashboard.
    for (const [name, amount] of [['Spine', -.43], ['Chest', -.22], ['Neck', .52]]) {
      const bone = this.bones[name];
      const change = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0).applyQuaternion(frameQ), amount);
      bone.quaternion.copy(rotation(bone.parent).invert().multiply(change).multiply(rotation(bone))).normalize();
      bone.updateWorldMatrix(false, true);
    }
    const toWorld = coordinates => frame.localToWorld(new THREE.Vector3(...coordinates));
    // Open the knees around the saddle; short lower legs stay outside the tank.
    for (const [side, sign] of [['Left', -1], ['Right', 1]]) {
      const target = toWorld(QUAD_RIDER.feet[side]);
      this.solve(side, 'UpLeg', 'Leg', 'Foot', target, new THREE.Vector3(sign, .1, -1).applyQuaternion(frameQ));
      const foot = this.bones[side + 'Foot'];
      foot.quaternion.copy(rotation(foot.parent).invert().multiply(frameQ).multiply(this.bind.get(side + 'Foot').worldQuaternion)).normalize();
      foot.updateWorldMatrix(false, true);
    }
    for (const [side, sign] of [['Left', -1], ['Right', 1]]) {
      const hand = this.bones[side + 'Hand'];
      const grip = toWorld(QUAD_RIDER.grips[side]);
      const restWorld = this.bind.get(side + 'Hand').worldQuaternion;
      const wristWorld = frameQ.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 1.10)).multiply(restWorld);
      const palmLocal = new THREE.Vector3(...this.spec.helmPalmAnchors[side].local);
      const offset = palmLocal.clone().multiply(hand.getWorldScale(new THREE.Vector3())).applyQuaternion(wristWorld);
      const result = this.solve(side, 'Arm', 'ForeArm', 'Hand', grip.clone().sub(offset), new THREE.Vector3(sign, -.6, .2).applyQuaternion(frameQ));
      hand.quaternion.copy(rotation(hand.parent).invert().multiply(wristWorld)).normalize();
      hand.updateWorldMatrix(false, true);
      this.contacts[side] = {...result, error: palmLocal.clone().applyMatrix4(hand.matrixWorld).distanceTo(grip)};
    }
    frame.updateWorldMatrix(true, true);
    // The handlebars are fixed in the bike frame. Cache the fitted local pose,
    // so driving only follows the vehicle transform, without solving IK again.
    this.fittedPose = new Map(Object.entries(this.bones).map(([name, bone]) => [name, {position: bone.position.clone(), quaternion: bone.quaternion.clone()}]));
  }
}
