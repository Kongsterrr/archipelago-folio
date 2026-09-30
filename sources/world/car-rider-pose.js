import * as THREE from 'three';
import {BicycleRiderPose} from './bicycle-rider-pose.js';

const sides = [['Left', -1], ['Right', 1]];
const worldRotation = object => object.getWorldQuaternion(new THREE.Quaternion());
const axisX = new THREE.Vector3(1, 0, 0);
const rounded = value => Array.isArray(value) ? value.map(rounded) : typeof value === 'number' ? Math.round(value * 1e8) / 1e8 : value;

// The car supplies neutral, fixed contacts in group-local coordinates. Road
// wheel steering must not move these cockpit contacts. Reuse Jack's measured
// soles and palm anchors, and the existing two-bone solver without stretching.
export class CarRiderPose extends BicycleRiderPose {
  constructor(model, avatarRoot, spec) {
    super(model, avatarRoot, spec);
    this.carFits = new WeakMap();
  }

  invalidate(car) { this.carFits.delete(car); }

  apply(car) {
    const frame = car.group, mount = car.mountPoint;
    const targets = car.contactTargets();
    const lean = targets.torsoLean ?? targets.pose?.lean ?? .08;
    const handPitch = targets.handPitch ?? targets.pose?.handPitch ?? 1.1;
    const footPitch = targets.footPitch ?? targets.pose?.footPitch ?? 0;
    const signature = JSON.stringify(rounded([
      targets.pelvis, targets.grips.Left, targets.grips.Right,
      targets.feet.Left, targets.feet.Right, lean, handPitch, footPitch,
    ]));
    if (this.root.parent !== mount) mount.add(this.root);
    this.root.quaternion.identity();
    this.root.scale.setScalar(1);
    this.root.position.fromArray(targets.pelvis).sub(mount.position).sub(this.restHips);

    const cached = this.carFits.get(car);
    if (cached && cached.model === car.model && cached.signature === signature) {
      for (const [name, quaternion] of cached.rotations) {
        this.bones[name].position.copy(this.bind.get(name).position);
        this.bones[name].quaternion.copy(quaternion);
      }
      this.contacts = cached.contacts;
      this.legContacts = cached.legContacts;
      frame.updateWorldMatrix(true, true);
      return;
    }

    this.restore();
    this.contacts = {};
    this.legContacts = {};
    frame.updateWorldMatrix(true, true);
    const frameQ = worldRotation(frame);
    const toWorld = coordinates => frame.localToWorld(new THREE.Vector3(...coordinates));

    // A shallow hip/torso hinge keeps the pelvis on the supplied cushion and
    // looks ahead; the car's seat controls the fit, not the bicycle's deep lean.
    for (const [name, amount] of [['Hips', -lean * .5], ['Spine', -lean * .3], ['Chest', -lean * .2], ['Neck', lean * .9]]) {
      const bone = this.bones[name];
      const delta = new THREE.Quaternion().setFromAxisAngle(axisX.clone().applyQuaternion(frameQ), amount);
      bone.quaternion.copy(worldRotation(bone.parent).invert().multiply(delta).multiply(worldRotation(bone))).normalize();
      bone.updateWorldMatrix(false, true);
    }

    const shoePitch = new THREE.Quaternion().setFromAxisAngle(axisX, footPitch);
    for (const [side, sign] of sides) {
      const foot = this.bones[side + 'Foot'];
      const sole = toWorld(targets.feet[side]);
      const footQ = frameQ.clone().multiply(shoePitch).multiply(this.bind.get(side + 'Foot').worldQuaternion);
      const offset = this.soleAnchors[side].clone().multiply(foot.getWorldScale(new THREE.Vector3())).applyQuaternion(footQ);
      const result = this.solve(side, 'UpLeg', 'Leg', 'Foot', sole.clone().sub(offset), new THREE.Vector3(sign * .22, .15, -1).applyQuaternion(frameQ));
      foot.quaternion.copy(worldRotation(foot.parent).invert().multiply(footQ)).normalize();
      foot.updateWorldMatrix(false, true);
      this.legContacts[side] = {...result, error: this.soleAnchors[side].clone().applyMatrix4(foot.matrixWorld).distanceTo(sole)};
    }

    const wristPitch = new THREE.Quaternion().setFromAxisAngle(axisX, handPitch);
    for (const [side, sign] of sides) {
      const hand = this.bones[side + 'Hand'];
      const grip = toWorld(targets.grips[side]);
      const palmLocal = new THREE.Vector3(...this.spec.helmPalmAnchors[side].local);
      const handQ = frameQ.clone().multiply(wristPitch).multiply(this.bind.get(side + 'Hand').worldQuaternion);
      const offset = palmLocal.clone().multiply(hand.getWorldScale(new THREE.Vector3())).applyQuaternion(handQ);
      const result = this.solve(side, 'Arm', 'ForeArm', 'Hand', grip.clone().sub(offset), new THREE.Vector3(sign, -.5, .25).applyQuaternion(frameQ));
      hand.quaternion.copy(worldRotation(hand.parent).invert().multiply(handQ)).normalize();
      hand.updateWorldMatrix(false, true);
      this.contacts[side] = {...result, error: palmLocal.clone().applyMatrix4(hand.matrixWorld).distanceTo(grip)};
    }
    frame.updateWorldMatrix(true, true);
    // Each car/model/anchor set owns its fit. Reapplying cached local rotations
    // freezes the seated pose through steering, pauses and world-frame changes.
    this.carFits.set(car, {
      model: car.model, signature,
      rotations: new Map(Object.entries(this.bones).map(([name, bone]) => [name, bone.quaternion.clone()])),
      contacts: {...this.contacts}, legContacts: {...this.legContacts},
    });
  }

  contactStatus(car) {
    const status = super.contactStatus(car);
    status.pelvisError = new THREE.Vector3(...status.pelvis).distanceTo(new THREE.Vector3(...car.contactTargets().pelvis));
    return status;
  }
}
