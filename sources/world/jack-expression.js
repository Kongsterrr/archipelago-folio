import * as THREE from 'three';

// Facial motion uses the same paused simulation delta as the body. Keeping it
// below the head joint preserves the authored hand contacts at the helm.
export class JackExpression {
  constructor(model) {
    this.head = model.getObjectByName('Head');
    this.eyes = ['LeftEye', 'RightEye'].map(name => model.getObjectByName(name)).filter(Boolean);
    this.brows = ['LeftBrow', 'RightBrow'].map(name => model.getObjectByName(name)).filter(Boolean);
    this.mouth = model.getObjectByName('Mouth');
    this.nodes = [this.head, ...this.eyes, ...this.brows, this.mouth].filter(Boolean);
    this.base = new Map();
    this.offset = new THREE.Quaternion();
    this.euler = new THREE.Euler();
    this.reset();
  }

  restore() {
    for (const [node, pose] of this.base) {
      node.position.copy(pose.position);
      node.quaternion.copy(pose.quaternion);
      node.scale.copy(pose.scale);
    }
  }

  reset() {
    this.restore();
    this.base.clear();
    this.time = 0;
    this.gaze = 0;
    this.blink = 0;
  }

  update(dt, {reduced, frozen, walking, moving, yaw = 0, position, lookTarget, interacting}) {
    // Called after restore() and the mixer. Snapshot authored transforms before
    // applying an expression, so zero-delta/pause frames never accumulate drift.
    for (const node of this.nodes) {
      let pose = this.base.get(node);
      if (!pose) {
        pose = {position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), scale: new THREE.Vector3()};
        this.base.set(node, pose);
      }
      pose.position.copy(node.position);
      pose.quaternion.copy(node.quaternion);
      pose.scale.copy(node.scale);
    }
    if (reduced) {
      this.gaze = this.blink = 0;
      return;
    }
    const step = frozen ? 0 : dt;
    this.time += step;
    const phase = this.time % 16.8;
    this.blink = 0;
    for (const start of [2.7, 6.8, 7.13, 12.4]) {
      const age = phase - start;
      if (age >= 0 && age < .19) this.blink = Math.max(this.blink, Math.sin(age / .19 * Math.PI) ** 2);
    }

    const rest = (1 - Math.cos(this.time * Math.PI / 5.6)) * .5;
    let desired = moving ? 0 : Math.sin(this.time * .53) * .13 * rest;
    if (walking && !moving && position && lookTarget) {
      const targetYaw = Math.atan2(position.x - lookTarget.x, position.z - lookTarget.z);
      desired = THREE.MathUtils.clamp(Math.atan2(Math.sin(targetYaw - yaw), Math.cos(targetYaw - yaw)), -.24, .24);
    }
    this.gaze = THREE.MathUtils.damp(this.gaze, desired, 5, step);
    const happy = interacting ? .5 - .5 * Math.cos(Math.min(interacting / 1.1, 1) * Math.PI * 2) : 0;
    // A smile also softens the eyes; a complete blink always reaches the same
    // closed pose, independently of the active expression.
    for (const eye of this.eyes) eye.scale.y *= THREE.MathUtils.lerp(1 - happy * .08, .06, this.blink);
    if (this.head) {
      const nod = moving ? 0 : Math.sin(this.time * 1.25) * .017 * rest;
      this.euler.set(nod - happy * .04, this.gaze * (walking ? 1 : .4), moving ? 0 : Math.sin(this.time * .72) * .017 * rest);
      this.head.quaternion.multiply(this.offset.setFromEuler(this.euler));
    }
    for (const [index, brow] of this.brows.entries()) {
      brow.position.y += happy * .008;
      this.euler.set(0, 0, (index === 0 ? -1 : 1) * happy * .035);
      brow.quaternion.multiply(this.offset.setFromEuler(this.euler));
    }
    if (this.mouth) {
      this.mouth.scale.x *= 1 + happy * .08;
      this.mouth.scale.y *= 1 + happy * .18;
    }
  }
}
