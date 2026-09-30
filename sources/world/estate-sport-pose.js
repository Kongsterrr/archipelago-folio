import * as THREE from 'three';
import {QuadRiderPose} from './quad-rider-pose.js';

const up = new THREE.Vector3(0, 1, 0);
const sides = [['Left', -1], ['Right', 1]];
const upperNames = ['Spine', 'Chest', 'Neck', ...sides.flatMap(([side]) => ['Shoulder', 'Arm', 'ForeArm', 'Hand'].map(part => side + part))];
const worldQ = object => object.getWorldQuaternion(new THREE.Quaternion());
const clamp01 = value => THREE.MathUtils.clamp(Number.isFinite(value) ? value : 0, 0, 1);
const ease = value => value * value * (3 - 2 * value);

function material(color, roughness = .6, metalness = 0) {
  return new THREE.MeshStandardMaterial({color, roughness, metalness});
}
function mesh(parent, geometry, mat, name, position = [0, 0, 0]) {
  const item = new THREE.Mesh(geometry, mat);
  item.name = name; item.position.fromArray(position); item.castShadow = true; item.receiveShadow = true;
  parent.add(item); return item;
}
function rod(parent, from, to, radius, mat, name) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), delta = b.clone().sub(a);
  const item = mesh(parent, new THREE.CylinderGeometry(radius, radius, delta.length(), 6), mat, name);
  item.position.copy(a.add(b).multiplyScalar(.5)); item.quaternion.setFromUnitVectors(up, delta.normalize()); return item;
}
function makeRacket() {
  const group = new THREE.Group(); group.name = 'estate-tennis-racket';
  const blue = material('#31556d', .38, .18), cream = material('#ede7d5', .85), strings = material('#d2d9d4', .72);
  // The palm sits around the middle of the wrapped handle; +Y runs toward the head.
  rod(group, [0, -.055, 0], [0, .065, 0], .018, cream, 'racket-wrapped-grip');
  rod(group, [0, .065, 0], [-.058, .19, 0], .008, blue, 'racket-throat-left');
  rod(group, [0, .065, 0], [.058, .19, 0], .008, blue, 'racket-throat-right');
  const hoop = mesh(group, new THREE.TorusGeometry(.115, .009, 5, 32), blue, 'racket-head-frame', [0, .275, 0]);
  hoop.scale.y = 1.22;
  const rx = .105, ry = .13;
  for (const x of [-.07, -.035, 0, .035, .07]) {
    const y = ry * Math.sqrt(1 - (x / rx) ** 2);
    rod(group, [x, .275 - y, 0], [x, .275 + y, 0], .0018, strings, 'racket-vertical-string');
  }
  for (const y of [-.09, -.06, -.03, 0, .03, .06, .09]) {
    const x = rx * Math.sqrt(1 - (y / ry) ** 2);
    rod(group, [-x, .275 + y, 0], [x, .275 + y, 0], .0018, strings, 'racket-horizontal-string');
  }
  group.userData.contact = [0, .275, 0]; return group;
}
function makePutter() {
  const group = new THREE.Group(); group.name = 'estate-golf-putter';
  const metal = material('#acb9bf', .27, .75), rubber = material('#304452', .88);
  rod(group, [0, .055, 0], [0, -.36, 0], .006, metal, 'putter-shaft');
  rod(group, [0, .06, 0], [0, -.035, 0], .014, rubber, 'putter-grip');
  mesh(group, new THREE.BoxGeometry(.12, .025, .036), metal, 'putter-head', [.035, -.375, 0]);
  group.userData.contact = [.035, -.375, -.021]; return group;
}
function poseCurve(progress, frames) {
  const t = clamp01(progress);
  for (let i = 1; i < frames.length; i++) {
    const [end, value] = frames[i], [start, prior] = frames[i - 1];
    if (t <= end) return new THREE.Vector3(...prior).lerp(new THREE.Vector3(...value), ease((t - start) / (end - start)));
  }
  return new THREE.Vector3(...frames.at(-1)[1]);
}

/** A post-mixer upper-body overlay for the existing imported Jack skeleton.
 * Call restore() before AnimationMixer.update(), apply() afterwards. No clocks
 * live here: swing is an externally owned 0..1 progress, so pause is exact.
 * kind is 'tennis' or 'golf'; any other value resets/hides this overlay.
 */
export class EstateSportPose extends QuadRiderPose {
  constructor(model, avatarRoot = model.parent, spec = null) {
    const characterSpec = spec || {};
    if (!spec) model.traverse(object => {if (object.userData.characterSpec) Object.assign(characterSpec, object.userData.characterSpec);});
    super(model, avatarRoot, characterSpec);
    this.modified = upperNames.filter(name => this.bones[name]);
    this.base = new Map(); this.lastApplied = new Map();
    this.props = new THREE.Group(); this.props.name = 'estate-sport-props'; this.props.visible = false;
    this.racket = makeRacket(); this.putter = makePutter(); this.props.add(this.racket, this.putter); avatarRoot.add(this.props);
    this.contact = new THREE.Vector3(); this.kind = null;
  }

  /** Restore only bones still carrying our last overlay, leaving fresh mixer output intact. */
  restore() {
    for (const name of this.modified) {
      const bone = this.bones[name], last = this.lastApplied.get(name), base = this.base.get(name);
      if (base && last && 1 - Math.abs(bone.quaternion.dot(last)) < 1e-9) bone.quaternion.copy(base);
    }
    this.lastApplied.clear();
    this.model.updateWorldMatrix(true, true);
  }

  rotateInFrame(name, axis, amount) {
    const bone = this.bones[name]; if (!bone || !amount) return;
    const change = new THREE.Quaternion().setFromAxisAngle(axis.clone().applyQuaternion(worldQ(this.root)), amount);
    bone.quaternion.copy(worldQ(bone.parent).invert().multiply(change).multiply(worldQ(bone))).normalize();
    bone.updateWorldMatrix(false, true);
  }

  apply({kind, phase = 'ready', swing = 0, charge = 0, reduced = false} = {}) {
    if (!['tennis', 'golf'].includes(kind)) {this.reset(); return;}
    // Also safe when a frozen render repeats apply() without rerunning the mixer.
    this.restore();
    this.base = new Map(this.modified.map(name => [name, this.bones[name].quaternion.clone()]));
    this.kind = kind; this.props.visible = true; this.racket.visible = kind === 'tennis'; this.putter.visible = kind === 'golf';
    const progress = phase === 'swing' || phase === 'putt' || phase === 'hit' ? clamp01(swing) : 0;
    const pulse = Math.sin(progress * Math.PI), world = worldQ(this.root);
    const grips = {}, prop = kind === 'tennis' ? this.racket : this.putter;
    let direction;
    if (kind === 'tennis') {
      this.rotateInFrame('Spine', new THREE.Vector3(1, 0, 0), -.07);
      this.rotateInFrame('Chest', new THREE.Vector3(0, 1, 0), (reduced ? .08 : .17) * pulse);
      this.rotateInFrame('Neck', new THREE.Vector3(1, 0, 0), .05);
      grips.Right = poseCurve(progress, [[0, [.215, .445, -.135]], [.2, [.245, .49, -.045]], [.5, [.14, .47, -.20]], [.8, [.025, .53, -.14]], [1, [.215, .445, -.135]]]);
      grips.Left = new THREE.Vector3(-.17, .465 - .025 * pulse, -.13 + .025 * pulse);
      direction = poseCurve(progress, [[0, [.30, .65, -.70]], [.2, [.82, .50, .1]], [.5, [.1, .16, -.98]], [.8, [-.60, .75, -.28]], [1, [.30, .65, -.70]]]).normalize();
      prop.position.copy(grips.Right); prop.quaternion.setFromUnitVectors(up, direction);
    } else {
      this.rotateInFrame('Spine', new THREE.Vector3(1, 0, 0), -.14);
      this.rotateInFrame('Chest', new THREE.Vector3(1, 0, 0), -.11);
      this.rotateInFrame('Neck', new THREE.Vector3(1, 0, 0), .17);
      // The short putter stays below Jack's face, with both hands on one grip.
      const sweep = progress ? .075 * Math.sin(progress * Math.PI * 2) : .018 * clamp01(charge);
      direction = new THREE.Vector3(-.02, 1, .25).normalize();
      grips.Right = new THREE.Vector3(.02, .414, -.175 + sweep);
      grips.Left = grips.Right.clone().addScaledVector(direction, .045);
      prop.position.copy(grips.Right); prop.quaternion.setFromUnitVectors(up, direction);
    }

    for (const [side, sign] of sides) {
      const hand = this.bones[side + 'Hand'];
      const target = this.root.localToWorld(grips[side].clone());
      const handPitch = kind === 'golf' ? .7 : side === 'Right' ? .9 - .35 * pulse : .75;
      const targetQ = world.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), handPitch)).multiply(this.bind.get(side + 'Hand').worldQuaternion);
      const palm = new THREE.Vector3(...this.spec.helmPalmAnchors[side].local);
      const offset = palm.clone().multiply(hand.getWorldScale(new THREE.Vector3())).applyQuaternion(targetQ);
      const fit = this.solve(side, 'Arm', 'ForeArm', 'Hand', target.clone().sub(offset), new THREE.Vector3(sign, -.55, .25).applyQuaternion(world));
      hand.quaternion.copy(worldQ(hand.parent).invert().multiply(targetQ)).normalize(); hand.updateWorldMatrix(false, true);
      this.contacts[side] = {...fit, error: palm.applyMatrix4(hand.matrixWorld).distanceTo(target), target: grips[side].toArray()};
    }
    this.lastApplied = new Map(this.modified.map(name => [name, this.bones[name].quaternion.clone()]));
    this.root.updateWorldMatrix(true, true);
    // Contact stays in the avatar frame so gameplay can inspect it at any yaw.
    this.contact.fromArray(prop.userData.contact).applyQuaternion(prop.quaternion).add(prop.position);
  }

  getContactPoint(target = new THREE.Vector3(), worldSpace = true) {
    target.copy(this.contact); return worldSpace ? this.root.localToWorld(target) : target;
  }

  reset() {
    this.restore(); this.base.clear(); this.kind = null; this.props.visible = false; this.contacts = {};
  }

  dispose() {
    this.reset(); this.props.removeFromParent();
    const geometries = new Set(), materials = new Set();
    this.props.traverse(object => {if (object.isMesh) {geometries.add(object.geometry); materials.add(object.material);}});
    for (const geometry of geometries) geometry.dispose(); for (const mat of materials) mat.dispose();
  }
}
