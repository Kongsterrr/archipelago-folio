import * as THREE from 'three';
import { integrateHelm } from './boat.js';
import { dockLocal } from './dock.js';
import { QUAD_RIDER, addQuadRiderSupports } from '../world/quad-rider-pose.js';

export const QUAD_BIKE = Object.freeze({
  // Harbor arrival plaza: immediately inland of the Projects pier.
  localSpawn: Object.freeze({ x: 2.5, z: 27, yaw: 0 }),
  modelScale: 1.65,
  collisionHalfWidth: .64,
  collisionHalfLength: .88,
  wheelRadius: .252,
  riderAnchor: QUAD_RIDER.mount,
  speeds: Object.freeze({ cruise: 8, boost: 16, reverse: 4, boostReverse: 8 }),
});

// Full oriented rectangles catch even thin posts inside the vehicle footprint.
function overlaps(a, b) {
  const axes = [a.yaw, b.yaw].flatMap(yaw => [{x:Math.cos(yaw),z:-Math.sin(yaw)}, {x:Math.sin(yaw),z:Math.cos(yaw)}]);
  const extent = (r,axis) => r.w*Math.abs(axis.x*Math.cos(r.yaw)-axis.z*Math.sin(r.yaw)) + r.l*Math.abs(axis.x*Math.sin(r.yaw)+axis.z*Math.cos(r.yaw));
  return axes.every(axis => Math.abs((a.x-b.x)*axis.x+(a.z-b.z)*axis.z) < extent(a,axis)+extent(b,axis));
}

export function quadFootprintClear(walkWorld, point, yaw, halfWidth = QUAD_BIKE.collisionHalfWidth, halfLength = QUAD_BIKE.collisionHalfLength) {
  const c=Math.cos(yaw),s=Math.sin(yaw);
  // Sample the entire perimeter, not only corners: concave shorelines and
  // narrow bridges can cut through the middle of an otherwise valid footprint.
  const sample=(x,z)=>({x:point.x+x*c+z*s,z:point.z-x*s+z*c});
  const inside=q=>walkWorld.contains ? walkWorld.contains(q,.055) : walkWorld.clear(q,.055);
  if(!inside(point))return false;
  for(let n=0;n<=10;n++) {
    const t=n/10*2-1;
    if(!inside(sample(t*halfWidth,-halfLength))||!inside(sample(t*halfWidth,halfLength))||!inside(sample(-halfWidth,t*halfLength))||!inside(sample(halfWidth,t*halfLength)))return false;
  }
  if(walkWorld.layout && walkWorld.island){
    const p=dockLocal(point,walkWorld.island),a={...p,yaw:yaw-walkWorld.island.rotation,w:halfWidth+.04,l:halfLength+.04};
    for(const o of walkWorld.layout.obstacles||[])if(overlaps(a,{x:o.x,z:o.z,yaw:o.rotation||0,w:o.width/2,l:o.depth/2}))return false;
  }else for(const x of [-halfWidth,0,halfWidth])for(const z of [-halfLength,0,halfLength])if(!walkWorld.clear(sample(x,z),.055))return false;
  return true;
}

// Advance only through clear poses. Translational AND rotational sweeps avoid
// corner penetration when turning beside a wall. Contact never respawns a rider.
function sweepPose(walk, start, end) {
  const turn=Math.atan2(Math.sin(end.yaw-start.yaw),Math.cos(end.yaw-start.yaw));
  const steps=Math.max(1,Math.ceil(Math.hypot(end.x-start.x,end.z-start.z)/.045),Math.ceil(Math.abs(turn)/.018));
  let safe={...start};
  for(let n=1;n<=steps;n++){
    const t=n/steps,p={x:THREE.MathUtils.lerp(start.x,end.x,t),z:THREE.MathUtils.lerp(start.z,end.z,t),yaw:start.yaw+turn*t};
    p.y=walk.groundAt(p);
    if(Math.abs(p.y-safe.y)>.19||!quadFootprintClear(walk,p,p.yaw))break;
    safe=p;
  }
  return safe;
}

function disposeObject(object) {
  object?.traverse?.(node => {
    if (node.isMesh) {
      node.geometry?.dispose();
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) material?.dispose?.();
    }
  });
}

// Wheels are separated and pivoted in the asset pipeline, before compression.
// Never mutate triangle membership at runtime: it used to tear the tires apart.
export function splitQuadWheels(model) {
  const pivots=[];
  model.traverse(node=>{if(/^quad-wheel-(front|rear)-(left|right)$/.test(node.name))pivots.push(node);});
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
    addQuadRiderSupports(this.group);
    this.wheelPivots = [];
    this.model = null;
    this.quality = null;
    this.parked = true;
    this.body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased()
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
    this.walkWorld.handles?.add(this.collider.handle);
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
    for(const wheel of this.wheelPivots)wheel.rotation.order='YXZ';
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
    const current=this.position,start={...current,yaw:this.yaw};
    this.previous={...current};this.previousYaw=this.yaw;this.stepDt=dt;
    const state=integrateHelm({yaw:this.yaw,vx:this.velocity.x,vz:this.velocity.z},input,dt,{
      speeds:QUAD_BIKE.speeds,normalAcceleration:6.5,boostAcceleration:13,brakeAcceleration:14,
    });
    const target={x:current.x+state.vx*dt,z:current.z+state.vz*dt,yaw:state.yaw};
    let next=sweepPose(this.walkWorld,start,target);
    // Test the remaining horizontal components separately to slide along edges.
    for(const axis of ['x','z']){
      const candidate=sweepPose(this.walkWorld,next,{...next,[axis]:target[axis]});
      next=candidate;
    }
    const rotated=sweepPose(this.walkWorld,next,{...next,yaw:state.yaw});
    this.yaw=rotated.yaw;next.yaw=this.yaw;
    this.steering=THREE.MathUtils.damp(this.steering||0,input.steer||0,8,dt);
    this.velocity={x:(next.x-current.x)/dt,y:0,z:(next.z-current.z)/dt};
    this.body.setNextKinematicTranslation({x:next.x,y:next.y,z:next.z});
    this.body.setNextKinematicRotation({x:0,y:Math.sin(this.yaw/2),z:0,w:Math.cos(this.yaw/2)});
  }

  afterStep() {
    if(this.parked)return;
    const current=this.position;
    // Numeric safety restores the immediately previous clear pose, never spawn.
    if(!Number.isFinite(current.x)||!Number.isFinite(current.z)||!quadFootprintClear(this.walkWorld,current,this.yaw)){
      this.teleport({...this.previous,yaw:this.previousYaw});return;
    }
    const distance=(current.x-this.previous.x)*-Math.sin(this.yaw)+(current.z-this.previous.z)*-Math.cos(this.yaw);
    this.wheelAngle=(this.wheelAngle||0)+distance/QUAD_BIKE.wheelRadius;
    this.velocity={x:(current.x-this.previous.x)/(this.stepDt||1/60),y:0,z:(current.z-this.previous.z)/(this.stepDt||1/60)};
  }

  dismountPoint() {
    const forward = { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) };
    const right = { x: Math.cos(this.yaw), z: -Math.sin(this.yaw) };
    const p = this.position;
    for (const distance of [1.45, 1.8, 2.2]) for (const side of [right, { x: -right.x, z: -right.z }, { x: -forward.x, z: -forward.z }, forward]) {
      const point = { x: p.x + side.x * distance, z: p.z + side.z * distance };
      point.y = this.walkWorld.groundAt(point);
      const dx=point.x-p.x,dz=point.z-p.z;
      const outside=Math.abs(dx*right.x+dz*right.z)>QUAD_BIKE.collisionHalfWidth+.3||Math.abs(dx*forward.x+dz*forward.z)>QUAD_BIKE.collisionHalfLength+.3;
      if (outside && this.walkWorld.clear(point, .24) && this.walkWorld.visible(p,point)) return { ...point, yaw: this.yaw };
    }
    return null;
  }

  park(value) {
    this.parked = value;
    this.hold();
    this.body.setBodyType(value ? this.R.RigidBodyType.Fixed : this.R.RigidBodyType.KinematicPositionBased, true);
  }

  hold() {
    const position = this.position;
    const rotation = this.body.rotation();
    this.velocity = { x: 0, y: 0, z: 0 };
    this.body.setLinvel(this.velocity, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setNextKinematicTranslation(position);
    this.body.setNextKinematicRotation(rotation);
    // Cancel queued movement and its render history together. Otherwise a parked
    // bike keeps replaying its last driving frame as the world alpha cycles.
    this.yaw = Math.atan2(2 * (rotation.w * rotation.y + rotation.x * rotation.z), 1 - 2 * (rotation.y * rotation.y + rotation.z * rotation.z));
    this.previous = { ...position };
    this.previousYaw = this.yaw;
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
    const p = this.position, t = frozen || this.parked ? 1 : THREE.MathUtils.clamp(alpha, 0, 1);
    this.group.position.set(
      THREE.MathUtils.lerp(this.previous.x, p.x, t),
      THREE.MathUtils.lerp(this.previous.y, p.y, t),
      THREE.MathUtils.lerp(this.previous.z, p.z, t),
    );
    const yawDelta = Math.atan2(Math.sin(this.yaw - this.previousYaw), Math.cos(this.yaw - this.previousYaw));
    this.group.rotation.y = this.previousYaw + yawDelta * t;
    this.visual.rotation.z=0;
    for(const wheel of this.wheelPivots){
      wheel.rotation.x=this.wheelAngle||0;
      // GLB retains +Z-forward source coordinates, hence the steering sign.
      wheel.rotation.y=wheel.name.includes('front')?(this.steering||0)*.22:0;
    }
  }

  dispose() {
    this.walkWorld.handles?.delete(this.collider.handle);
    this.world.removeRigidBody(this.body);
    disposeObject(this.group);
  }
}
