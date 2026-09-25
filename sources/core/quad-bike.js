import * as THREE from 'three';
import { integrateHelm } from './boat.js';

export const QUAD_BIKE = Object.freeze({
  // The local +X road runs off the Research observatory footbridge.
  localSpawn: Object.freeze({ x: 8.2, z: -8.95, yaw: 0 }),
  modelScale: 2.4,
  collisionHalfWidth: .88,
  collisionHalfLength: 1.22,
  wheelRadius: .33,
  riderAnchor: Object.freeze([0, .60, 0]),
  speeds: Object.freeze({ cruise: 8, boost: 16, reverse: 4, boostReverse: 8 }),
});

const WHEELS = [
  // GLB vertex coordinates are normalized by its parent node's 0.5 scale.
  { id: 'front-left', x: -.59, y: -.28, z: .76 },
  { id: 'front-right', x: .59, y: -.28, z: .76 },
  { id: 'rear-left', x: -.59, y: -.28, z: -.76 },
  { id: 'rear-right', x: .59, y: -.28, z: -.76 },
];

export function quadFootprintClear(walkWorld, point, yaw, halfWidth = QUAD_BIKE.collisionHalfWidth, halfLength = QUAD_BIKE.collisionHalfLength) {
  const forward = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
  const right = { x: Math.cos(yaw), z: -Math.sin(yaw) };
  for (const along of [-1, 0, 1]) for (const across of [-1, 0, 1]) {
    const sample = {
      x: point.x + forward.x * halfLength * along + right.x * halfWidth * across,
      z: point.z + forward.z * halfLength * along + right.z * halfWidth * across,
    };
    if (!walkWorld.clear(sample, .12)) return false;
  }
  return true;
}

function disposeObject(object) {
  object?.traverse?.(node => {
    if (node.isMesh) {
      node.geometry?.dispose();
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) material?.dispose?.();
    }
  });
}

function wheelIndexForTriangle(position, a, b, c) {
  const x = (position.getX(a) + position.getX(b) + position.getX(c)) / 3;
  const y = (position.getY(a) + position.getY(b) + position.getY(c)) / 3;
  const z = (position.getZ(a) + position.getZ(b) + position.getZ(c)) / 3;
  for (let i = 0; i < WHEELS.length; i++) {
    const wheel = WHEELS[i];
    // The source is one fused mesh, so isolate each wheel's compact tire/rim
    // volume into a pivot while leaving the fenders and suspension on the chassis.
    if (Math.abs(x - wheel.x) < .10 && Math.hypot(y - wheel.y, z - wheel.z) < .18) return i;
  }
  return -1;
}

export function splitQuadWheels(model) {
  const pivots = [];
  model.updateMatrixWorld(true);
  model.traverse(mesh => {
    if (!mesh.isMesh || !mesh.geometry?.getAttribute('position')) return;
    const source = mesh.geometry;
    const position = source.getAttribute('position');
    const index = source.getIndex();
    if (!index) return;
    const chassis = [], separated = WHEELS.map(() => []);
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
      const wheel = wheelIndexForTriangle(position, a, b, c);
      (wheel < 0 ? chassis : separated[wheel]).push(a, b, c);
    }
    if (separated.every(triangles => triangles.length < 36)) return;
    source.setIndex(chassis);
    source.computeBoundingSphere();
    for (let i = 0; i < separated.length; i++) {
      if (separated[i].length < 36) continue;
      const wheel = WHEELS[i], pivot = new THREE.Group();
      pivot.name = `quad-wheel-${wheel.id}`;
      pivot.position.set(wheel.x, wheel.y, wheel.z);
      const geometry = new THREE.BufferGeometry();
      for (const [name, attribute] of Object.entries(source.attributes)) {
        if (name === 'position') {
          const values = new Float32Array(attribute.count * 3);
          for (let vertex = 0; vertex < attribute.count; vertex++) {
            values[vertex * 3] = attribute.getX(vertex) - wheel.x;
            values[vertex * 3 + 1] = attribute.getY(vertex) - wheel.y;
            values[vertex * 3 + 2] = attribute.getZ(vertex) - wheel.z;
          }
          geometry.setAttribute(name, new THREE.BufferAttribute(values, 3));
        } else geometry.setAttribute(name, attribute);
      }
      geometry.setIndex(separated[i]);
      geometry.computeBoundingSphere();
      const tire = new THREE.Mesh(geometry, mesh.material);
      tire.name = `quad-tire-${wheel.id}`;
      tire.castShadow = true;
      tire.receiveShadow = true;
      pivot.add(tire);
      mesh.parent.add(pivot);
      pivots.push(pivot);
    }
  });
  return pivots;
}

export class QuadBikeController {
  constructor(R, world, walkWorld, spawn) {
    this.R = R;
    this.world = world;
    this.walkWorld = walkWorld;
    this.spawn = { ...spawn };
    this.yaw = spawn.yaw || 0;
    this.previousYaw = this.yaw;
    this.velocity = { x: 0, y: 0, z: 0 };
    this.previous = { x: spawn.x, y: spawn.y, z: spawn.z };
    this.group = new THREE.Group();
    this.group.name = 'Jack quad bike';
    this.visual = new THREE.Group();
    this.visual.name = 'quad-bike-model-frame';
    this.visual.scale.setScalar(QUAD_BIKE.modelScale);
    this.group.add(this.visual);
    this.mountPoint = new THREE.Group();
    this.mountPoint.name = 'quad-bike-rider-seat';
    this.mountPoint.position.fromArray(QUAD_BIKE.riderAnchor);
    this.group.add(this.mountPoint);
    this.wheelPivots = [];
    this.model = null;
    this.quality = null;
    this.parked = true;
    this.body = world.createRigidBody(R.RigidBodyDesc.dynamic()
      .setTranslation(spawn.x, spawn.y, spawn.z)
      .setGravityScale(0)
      .enabledTranslations(true, false, true)
      .enabledRotations(false, true, false)
      .setCcdEnabled(true)
      .setLinearDamping(0)
      .setAngularDamping(5));
    this.collider = world.createCollider(R.ColliderDesc.cuboid(QUAD_BIKE.collisionHalfWidth, .29, QUAD_BIKE.collisionHalfLength)
      .setTranslation(0, .38, 0)
      .setCollisionGroups(0x00020002)
      .setFriction(.65)
      .setRestitution(.06)
      .setDensity(.8), this.body);
    this.park(true);
    this.teleport(spawn);
  }

  setModel(model, quality = 'high') {
    if (this.model) {
      this.visual.remove(this.model);
      this.wheelPivots = [];
      disposeObject(this.model);
    }
    model.name = `quad-bike-${quality}`;
    model.rotation.y = Math.PI; // The Tripo source faces +Z; the game uses -Z forward.
    model.traverse(node => {
      if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; }
    });
    this.wheelPivots = splitQuadWheels(model);
    this.visual.add(model);
    this.model = model;
    this.quality = quality;
    this.updateVisual(0, true);
  }

  get position() { return this.body.translation(); }
  get speed() { return Math.hypot(this.velocity.x, this.velocity.z); }
  get forwardSpeed() {
    const forward = { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) };
    return this.velocity.x * forward.x + this.velocity.z * forward.z;
  }

  step(input, dt) {
    if (this.parked) return;
    const current = this.position, before = { x: current.x, y: current.y, z: current.z };
    this.previous = before;
    this.previousYaw = this.yaw;
    const state = integrateHelm({ yaw: this.yaw, vx: this.velocity.x, vz: this.velocity.z }, input, dt, {
      speeds: QUAD_BIKE.speeds,
      normalAcceleration: 6.5,
      boostAcceleration: 13,
      brakeAcceleration: 14,
    });
    let next = { x: current.x + state.vx * dt, y: current.y, z: current.z + state.vz * dt };
    if (!quadFootprintClear(this.walkWorld, next, state.yaw)) {
      // Let the ATV slide along a garden edge instead of clipping or locking
      // diagonally against it. The sampled footprint includes its full wheelbase.
      const xOnly = { ...next, z: current.z }, zOnly = { ...next, x: current.x };
      if (!quadFootprintClear(this.walkWorld, xOnly, state.yaw)) state.vx = 0;
      if (!quadFootprintClear(this.walkWorld, zOnly, state.yaw)) state.vz = 0;
      next = { x: current.x + state.vx * dt, y: current.y, z: current.z + state.vz * dt };
      if (!quadFootprintClear(this.walkWorld, next, state.yaw)) { state.vx = 0; state.vz = 0; next = before; }
    }
    this.yaw = state.yaw;
    this.velocity = { x: state.vx, y: 0, z: state.vz };
    this.body.setRotation({ x: 0, y: Math.sin(this.yaw / 2), z: 0, w: Math.cos(this.yaw / 2) }, true);
    this.body.setLinvel(this.velocity, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  afterStep() {
    const current = this.position;
    if (!quadFootprintClear(this.walkWorld, current, this.yaw)) this.teleport(this.spawn);
  }

  dismountPoint() {
    const forward = { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) };
    const right = { x: Math.cos(this.yaw), z: -Math.sin(this.yaw) };
    const p = this.position;
    for (const distance of [1.45, 1.8, 2.2]) for (const side of [right, { x: -right.x, z: -right.z }, { x: -forward.x, z: -forward.z }, forward]) {
      const point = { x: p.x + side.x * distance, z: p.z + side.z * distance };
      point.y = this.walkWorld.groundAt(point);
      if (this.walkWorld.clear(point, .24)) return { ...point, yaw: this.yaw };
    }
    return null;
  }

  park(value) {
    this.parked = value;
    this.hold();
    this.body.setBodyType(value ? this.R.RigidBodyType.Fixed : this.R.RigidBodyType.Dynamic, true);
  }

  hold() {
    this.velocity = { x: 0, y: 0, z: 0 };
    this.body.setLinvel(this.velocity, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  teleport(point) {
    this.yaw = point.yaw || 0;
    this.velocity = { x: 0, y: 0, z: 0 };
    this.body.setTranslation({ x: point.x, y: point.y, z: point.z }, true);
    this.body.setRotation({ x: 0, y: Math.sin(this.yaw / 2), z: 0, w: Math.cos(this.yaw / 2) }, true);
    this.hold();
    this.previous = { x: point.x, y: point.y, z: point.z };
    this.previousYaw = this.yaw;
    this.updateVisual(0, true);
  }

  updateVisual(dt, frozen = false, alpha = 1) {
    const p = this.position, t = frozen ? 1 : THREE.MathUtils.clamp(alpha, 0, 1);
    this.group.position.set(
      THREE.MathUtils.lerp(this.previous.x, p.x, t),
      THREE.MathUtils.lerp(this.previous.y, p.y, t),
      THREE.MathUtils.lerp(this.previous.z, p.z, t),
    );
    const yawDelta = Math.atan2(Math.sin(this.yaw - this.previousYaw), Math.cos(this.yaw - this.previousYaw));
    this.group.rotation.y = this.previousYaw + yawDelta * t;
    const steer = this.speed > .1 ? Math.sign(this.velocity.x * -Math.cos(this.yaw) + this.velocity.z * Math.sin(this.yaw)) : 0;
    this.visual.rotation.z = frozen ? 0 : THREE.MathUtils.damp(this.visual.rotation.z, -steer * Math.min(this.speed, 12) * .0015, 8, dt);
    if (!frozen) {
      const rotation = -this.forwardSpeed * dt / QUAD_BIKE.wheelRadius;
      for (const wheel of this.wheelPivots) wheel.rotation.x += rotation;
    }
  }

  dispose() {
    this.world.removeRigidBody(this.body);
    disposeObject(this.group);
  }
}
