import * as THREE from 'three';
import {applyJackHairSurface} from './jack-hair-surface.js';
import {JackExpression} from './jack-expression.js';

const locomotion = name => name === 'walk' || name === 'run';
const shortestAngle = angle => Math.atan2(Math.sin(angle), Math.cos(angle));

export class JackAvatar {
  constructor(scene, loader) {
    this.scene = scene;
    this.loader = loader;
    this.root = new THREE.Group();
    this.root.name = 'Jack';
    scene.add(this.root);
    this.ready = false;
    this.pose = null;
    this.interactTime = 0;
  }

  async load() {
    if (this.promise) return this.promise;
    this.promise = this.loader.loadAsync('/models/jack.glb').then(gltf => {
      this.model = gltf.scene;
      applyJackHairSurface(this.model);
      this.root.add(this.model);
      this.spec = {helmAnchor: [.28324, -.4496, .00485], helmScale: .97, benchSeatOffset: .52};
      this.model.traverse(o => { if (o.userData.characterSpec) Object.assign(this.spec, o.userData.characterSpec); });
      this.poseBones = [];
      this.model.traverse(o => { if (o.isBone) this.poseBones.push(o); });
      this.mixer = new THREE.AnimationMixer(this.model);
      this.actions = new Map(gltf.animations.map(c => [c.name, this.mixer.clipAction(c)]));
      this.outlines = [];
      const meshes = [];
      this.model.traverse(o => {
        if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; }
        if (o.isSkinnedMesh) meshes.push(o);
      });
      for (const o of meshes) {
        const line = new THREE.SkinnedMesh(o.geometry, new THREE.MeshBasicMaterial({color: '#fff4c4', transparent: true, opacity: .4, depthTest: false, depthWrite: false}));
        line.bind(o.skeleton, o.bindMatrix);
        line.position.copy(o.position);
        line.rotation.copy(o.rotation);
        line.scale.copy(o.scale);
        line.frustumCulled = false;
        line.renderOrder = 10;
        line.visible = false;
        o.parent.add(line);
        this.outlines.push(line);
      }
      for (const name of ['interact', 'stand']) {
        const action = this.actions.get(name);
        if (action) { action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; }
      }
      this.expression = new JackExpression(this.model);
      this.ready = true;
      this.setPose('helm', 0);
      return true;
    }).catch(error => {
      this.promise = null;
      console.warn('Jack unavailable', error.message);
      return false;
    });
    return this.promise;
  }

  setPose(name, duration = .16) {
    if (this.pose === name) return;
    const next = this.actions?.get(name) || this.actions?.get('idle');
    if (!next) return;
    const prior = this.actions.get(this.pose);
    const phase = locomotion(name) && locomotion(this.pose) ? prior.time / prior.getClip().duration : null;
    const weights = new Map([...this.actions.values()].map(action => [action, action.isScheduled() ? action.getEffectiveWeight() : 0]));
    for (const action of this.actions.values()) action.stopFading().stopWarping();
    if (!duration) {
      this.mixer.stopAllAction();
      next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
      this.blend = null;
    } else {
      if (!weights.get(next)) next.reset();
      if (phase !== null) next.time = phase * next.getClip().duration;
      next.setEffectiveTimeScale(1).setEffectiveWeight(weights.get(next) || 0).play();
      this.blend = {elapsed: 0, duration, weights, next};
    }
    this.pose = name;
  }

  advanceBlend(dt) {
    if (!this.blend) return;
    const blend = this.blend;
    blend.elapsed = Math.min(blend.duration, blend.elapsed + dt);
    const progress = blend.elapsed / blend.duration;
    const eased = progress * progress * (3 - 2 * progress);
    for (const [action, weight] of blend.weights) {
      action.setEffectiveWeight(THREE.MathUtils.lerp(weight, action === blend.next ? 1 : 0, eased));
      if (progress === 1 && action !== blend.next) action.stop();
    }
    if (progress === 1) this.blend = null;
  }

  resetPose(name) {
    if (!this.ready) return;
    this.expression?.reset();
    this.mixer.stopAllAction();
    this.pose = null;
    this.interactTime = this.standTime = 0;
    this.wasSeated = false;
    this.lastSeat = this.standFrom = null;
    this.forceFrame = true;
    this.setPose(name, 0);
    this.mixer.update(0);
    this.normalizePose();
  }

  normalizePose() {
    // Compressed clip quaternions can be slightly non-unit. Keep articulated
    // transforms orthogonal before waves/boat rotation and facial expression.
    for (const bone of this.poseBones) bone.quaternion.normalize();
  }

  seatPosition(seat, seatSurfaceY, yaw = 0) {
    const forward = this.spec?.benchForwardOffset ?? 0;
    return new THREE.Vector3(seat.x - Math.sin(yaw) * forward, seatSurfaceY - (this.spec?.benchSeatOffset ?? .52), seat.z - Math.cos(yaw) * forward);
  }

  interact() {
    this.interactTime = this.actions?.get('interact')?.getClip().duration || 1.1;
    if (this.pose === 'interact') this.actions.get('interact')?.reset().play();
  }

  update(dt, {player, boatVisual, character, alpha, reduced, frozen, lookTarget}) {
    if (!this.ready) return;
    const land = player.onLand;
    const modeChanged = this.onLand !== land;
    this.onLand = land;
    if (modeChanged) this.resetPose(land ? 'idle' : 'helm');
    // A pause holds the rendered pose too. Reset/boarding may still commit a new
    // stable actor in a frozen frame, without reviving old animations.
    if (frozen && !modeChanged && !this.forceFrame) return;
    this.forceFrame = false;
    const step = frozen ? 0 : dt;
    this.expression?.restore();
    if (land) {
      const leavingSeat = !character.seated && this.wasSeated;
      if (leavingSeat) {
        this.standDuration = this.actions.get('stand')?.getClip().duration || .6;
        this.standTime = this.standDuration;
        this.standFrom = this.lastSeat.clone();
        this.standYaw = this.root.rotation.y;
      } else this.standTime = Math.max(0, (this.standTime || 0) - step);
      this.root.scale.setScalar(1);
      if (this.root.parent !== this.scene) this.scene.add(this.root);
      const p = character.position, previous = character.previous;
      this.root.position.set(THREE.MathUtils.lerp(previous.x, p.x, alpha), THREE.MathUtils.lerp(previous.y, p.y, alpha), THREE.MathUtils.lerp(previous.z, p.z, alpha));
      this.root.rotation.set(0, character.yaw, 0);
      if (character.seated && character.seatVisual) {
        this.root.position.copy(character.seatVisual);
        this.root.rotation.y = character.seatYaw;
      } else if (this.standTime > 0) {
        const progress = 1 - this.standTime / this.standDuration;
        const eased = progress * progress * (3 - 2 * progress);
        this.root.position.lerp(this.standFrom, 1 - eased);
        this.root.rotation.y = this.standYaw + shortestAngle(character.yaw - this.standYaw) * eased;
      }
      this.wasSeated = character.seated;
      if (character.seated) this.lastSeat = this.root.position.clone();
      const running = this.pose === 'run' ? character.speed > 2.55 : character.speed > 2.85;
      const desired = character.seated ? 'sit' : this.standTime > 0 ? 'stand' : this.interactTime > 0 ? 'interact' : character.speed > .1 ? (running ? 'run' : 'walk') : 'idle';
      this.setPose(desired);
      // Use one cycle rate for both strides during a blend. A collision that
      // stops the capsule also stops the feet.
      const stride = this.actions.get(this.pose === 'run' ? 'run' : 'walk');
      const cycleRate = character.speed / ((this.pose === 'run' ? 4 : 2.4) * stride.getClip().duration);
      for (const [name, action] of this.actions) {
        if (locomotion(name)) action.setEffectiveTimeScale(cycleRate * action.getClip().duration);
        else if (name === 'idle' || name === 'sit') action.setEffectiveTimeScale(reduced ? 0 : 1);
      }
    } else {
      if (this.root.parent !== boatVisual) boatVisual.add(this.root);
      this.wasSeated = false;
      this.standTime = 0;
      this.root.scale.setScalar(this.spec.helmScale);
      this.root.position.fromArray(this.spec.helmAnchor);
      this.root.rotation.set(0, 0, 0);
      this.setPose('helm');
    }
    this.interactTime = Math.max(0, this.interactTime - step);
    this.advanceBlend(step);
    this.mixer.update(step);
    this.normalizePose();
    this.expression?.update(step, {reduced, frozen, walking: land, moving: land && character.speed > .1, yaw: this.root.rotation.y, position: character.position, lookTarget: land ? lookTarget : null, interacting: this.interactTime});
  }

  outline(value) { for (const object of this.outlines || []) object.visible = value; }
}
