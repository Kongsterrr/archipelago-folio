import * as THREE from 'three';
import {QuadRiderPose} from './quad-rider-pose.js';

const sides = [['Left', -1], ['Right', 1]];
const worldRotation = object => object.getWorldQuaternion(new THREE.Quaternion());

// Jack keeps the same skeleton and scale. The bicycle supplies moving contact
// points in its own frame; in particular, feet are sole contacts on the level
// pedal platforms, rather than ankle joints at the crank endpoints.
export class BicycleRiderPose extends QuadRiderPose {
  constructor(model, avatarRoot, spec) {
    super(model, avatarRoot, spec);
    // SkeletonUtils.clone() binds a new SkinnedMesh before its final parent
    // matrices are current. Refresh the SkinnedMesh override (not merely
    // updateWorldMatrix) before measuring actual soles in the rest pose.
    model.updateMatrixWorld(true);
    this.footVertices = {Left: [], Right: []};
    model.traverse(mesh => {
      if (!mesh.isSkinnedMesh) return;
      mesh.skeleton.update();
      const ids = mesh.geometry.getAttribute('skinIndex');
      const weights = mesh.geometry.getAttribute('skinWeight');
      for (let index = 0; index < ids.count; index++) {
        let major = 0;
        for (let k = 1; k < 4; k++) if (weights.getComponent(index, k) > weights.getComponent(index, major)) major = k;
        const name = mesh.skeleton.bones[ids.getComponent(index, major)].name;
        const side = name === 'LeftFoot' ? 'Left' : name === 'RightFoot' ? 'Right' : null;
        if (side) this.footVertices[side].push({mesh, index});
      }
    });
    this.soleAnchors = {};
    for (const [side] of sides) {
      const samples = this.skinFoot(side);
      if (!samples.length) throw new Error(`Jack is missing ${side} shoe vertices.`);
      const lowest = Math.min(...samples.map(point => point.y));
      const sole = samples.filter(point => point.y < lowest + .006);
      const center = sole.reduce((sum, point) => sum.add(point), new THREE.Vector3()).divideScalar(sole.length);
      center.y = lowest;
      this.soleAnchors[side] = this.bones[side + 'Foot'].worldToLocal(center);
    }
    this.legContacts = {};
  }

  skinFoot(side) {
    return this.footVertices[side].map(({mesh, index}) => mesh.getVertexPosition(index, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));
  }

  restore() {
    for (const [name, rest] of this.bind) {
      this.bones[name].position.copy(rest.position);
      this.bones[name].quaternion.copy(rest.quaternion);
    }
  }

  apply(bicycle) {
    const frame = bicycle.group, mount = bicycle.mountPoint;
    const targets = bicycle.contactTargets();
    if (this.root.parent !== mount) mount.add(this.root);
    this.root.quaternion.identity();
    this.root.scale.setScalar(1);
    this.root.position.fromArray(targets.pelvis).sub(mount.position).sub(this.restHips);
    this.restore();
    frame.updateWorldMatrix(true, true);
    const frameQ = worldRotation(frame);
    const toWorld = coordinates => frame.localToWorld(new THREE.Vector3(...coordinates));

    // Hinge at the hips to reach the original forward bar shoulders instead of stretching
    // the cockpit toward an upright rider. Counter-rotate the neck to look
    // ahead. IK below keeps the pelvis seated and soles on the moving pedals.
    // Bone translations, lengths and Jack's scale remain unchanged.
    for (const [name, amount] of [['Hips', -.75], ['Spine', -.15], ['Chest', -.10], ['Neck', .88]]) {
      const bone = this.bones[name];
      const delta = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0).applyQuaternion(frameQ), amount);
      bone.quaternion.copy(worldRotation(bone.parent).invert().multiply(delta).multiply(worldRotation(bone))).normalize();
      bone.updateWorldMatrix(false, true);
    }

    for (const [side, sign] of sides) {
      const foot = this.bones[side + 'Foot'];
      const sole = toWorld(targets.feet[side]);
      const footQ = frameQ.clone().multiply(this.bind.get(side + 'Foot').worldQuaternion);
      const offset = this.soleAnchors[side].clone().multiply(foot.getWorldScale(new THREE.Vector3())).applyQuaternion(footQ);
      const result = this.solve(side, 'UpLeg', 'Leg', 'Foot', sole.clone().sub(offset), new THREE.Vector3(sign * .3, .2, -1).applyQuaternion(frameQ));
      foot.quaternion.copy(worldRotation(foot.parent).invert().multiply(footQ)).normalize();
      foot.updateWorldMatrix(false, true);
      this.legContacts[side] = {...result, error: this.soleAnchors[side].clone().applyMatrix4(foot.matrixWorld).distanceTo(sole)};
    }

    const steeringQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), targets.gripYaw || 0);
    const handPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 1.1);
    for (const [side, sign] of sides) {
      const hand = this.bones[side + 'Hand'];
      const grip = toWorld(targets.grips[side]);
      const palmLocal = new THREE.Vector3(...this.spec.helmPalmAnchors[side].local);
      const handQ = frameQ.clone().multiply(steeringQ).multiply(handPitch).multiply(this.bind.get(side + 'Hand').worldQuaternion);
      const offset = palmLocal.clone().multiply(hand.getWorldScale(new THREE.Vector3())).applyQuaternion(handQ);
      const result = this.solve(side, 'Arm', 'ForeArm', 'Hand', grip.clone().sub(offset), new THREE.Vector3(sign, -.6, .2).applyQuaternion(frameQ));
      hand.quaternion.copy(worldRotation(hand.parent).invert().multiply(handQ)).normalize();
      hand.updateWorldMatrix(false, true);
      this.contacts[side] = {...result, error: palmLocal.clone().applyMatrix4(hand.matrixWorld).distanceTo(grip)};
    }
    frame.updateWorldMatrix(true, true);
  }

  contactStatus(bicycle) {
    bicycle.group.updateWorldMatrix(true, true);
    this.model.updateMatrixWorld(true);
    this.model.traverse(mesh => {if (mesh.isSkinnedMesh) mesh.skeleton.update();});
    const targets = bicycle.contactTargets(), palms = {}, soles = {};
    for (const [side] of sides) {
      const palm = new THREE.Vector3(...this.spec.helmPalmAnchors[side].local).applyMatrix4(this.bones[side + 'Hand'].matrixWorld);
      const sole = this.soleAnchors[side].clone().applyMatrix4(this.bones[side + 'Foot'].matrixWorld);
      bicycle.group.worldToLocal(palm); bicycle.group.worldToLocal(sole);
      const skinPalm = bicycle.group.worldToLocal(this.skinPalm(side));
      const footPoints = this.skinFoot(side).map(point => bicycle.group.worldToLocal(point));
      const lowest = Math.min(...footPoints.map(point => point.y));
      const bottom = footPoints.filter(point => point.y < lowest + .006);
      const skinSole = bottom.reduce((sum, point) => sum.add(point), new THREE.Vector3()).divideScalar(bottom.length);
      palms[side] = {position: palm.toArray(), error: palm.distanceTo(new THREE.Vector3(...targets.grips[side])), skinCentroid: skinPalm.toArray(), skinError: skinPalm.distanceTo(new THREE.Vector3(...targets.grips[side])), reach: this.contacts[side]?.reach, requested: this.contacts[side]?.requested};
      soles[side] = {position: sole.toArray(), error: sole.distanceTo(new THREE.Vector3(...targets.feet[side])), skinCentroid: skinSole.toArray(), skinError: skinSole.distanceTo(new THREE.Vector3(...targets.feet[side])), lowest, surfaceError: Math.abs(lowest - targets.feet[side][1]), reach: this.legContacts[side]?.reach, requested: this.legContacts[side]?.requested};
    }
    return {palms, soles, pelvis: bicycle.group.worldToLocal(this.bones.Hips.getWorldPosition(new THREE.Vector3())).toArray()};
  }
}
