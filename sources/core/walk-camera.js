import {Vector3,MathUtils} from 'three';

export const WALK_CAMERA = Object.freeze({
  elevation:38*Math.PI/180,maxElevation:52*Math.PI/180,minFraction:.55,
  clearance:.35,probeSpacing:.3,recoveryDelay:.2,approachRate:14,recoveryRate:6,
  followRate:8,stairHorizontalRate:16,anticipation:.2,
});

// Camera composition can look ahead of Jack into a higher terrace. Only the
// actual, interpolated head is a visibility origin; the composition target is
// deliberately allowed to be below or inside scenery.
export class WalkingCamera {
  reset(){this.target=null;this.lastPoint=null;this.horizontalLag=new Vector3();this.stairFollowWeight=0;this.fraction=1;this.elevation=WALK_CAMERA.elevation;this.recovery=0;this.blocked=false;this.pose=null;}
  constructor(){this.reset();}

  clearFraction(pivot,eye,terrainHeight){
    const length=pivot.distanceTo(eye),steps=Math.max(2,Math.ceil(length/WALK_CAMERA.probeSpacing)),point=new Vector3();
    const clear=t=>{point.copy(pivot).lerp(eye,t);const height=terrainHeight(point);return !Number.isFinite(height)||point.y>=height+WALK_CAMERA.clearance;};
    for(let n=1;n<=steps;n++)if(!clear(n/steps)){
      let lo=(n-1)/steps,hi=n/steps;
      for(let i=0;i<5;i++){const mid=(lo+hi)/2;if(clear(mid))lo=mid;else hi=mid;}
      return Math.max(0,lo-.03/Math.max(length,.01));
    }
    return 1;
  }

  update(dt,{position,pivot,target,distance,azimuth,terrainHeight,velocity={},stairs=false,paused=false,seed=null},snap=false){
    if(paused&&this.pose&&!snap)return this.pose;
    const first=!this.target;
    if(first||snap){
      this.reset();this.target=(snap?target:seed?.target||target).clone();
      this.stairFollowWeight=stairs?1:0;
      this.followDistance=snap?distance:seed?.distance||distance;
      if(!snap&&Number.isFinite(seed?.elevation))this.elevation=MathUtils.clamp(seed.elevation,WALK_CAMERA.elevation,WALK_CAMERA.maxElevation);
    }else if(this.lastPoint){
      const delta=new Vector3(position.x-this.lastPoint.x,0,position.z-this.lastPoint.z),previousLag=this.horizontalLag.clone();
      // Nosing contacts vary capsule speed even during a steady stair climb.
      // Filter that short horizontal pulse, separately from the framing lead.
      // Fade the filter's weight across each landing boundary: dropping the
      // input abruptly would turn the old lag into a one-frame catch-up pulse.
      // Once it fades out, ordinary ground keeps its immediate follow.
      this.stairFollowWeight=MathUtils.damp(this.stairFollowWeight,stairs?1:0,WALK_CAMERA.stairHorizontalRate,dt);
      this.horizontalLag.addScaledVector(delta,this.stairFollowWeight);
      this.horizontalLag.multiplyScalar(Math.exp(-WALK_CAMERA.stairHorizontalRate*dt));
      this.target.add(delta.add(previousLag).sub(this.horizontalLag));
    }
    this.lastPoint={x:position.x,z:position.z};
    const follow=snap?1:1-Math.exp(-WALK_CAMERA.followRate*dt);
    this.target.lerp(target.clone().sub(this.horizontalLag),follow);this.followDistance=Math.max(distance*WALK_CAMERA.minFraction,MathUtils.lerp(this.followDistance,distance,follow));
    const eyeAt=elevation=>this.target.clone().add(new Vector3(Math.sin(azimuth)*Math.cos(elevation),Math.sin(elevation),Math.cos(azimuth)*Math.cos(elevation)).multiplyScalar(this.followDistance));
    const future=new Vector3(velocity.x||0,0,velocity.z||0).multiplyScalar(WALK_CAMERA.anticipation).clampLength(0,.8);
    const predicted=pivot.clone().add(future);
    if(future.lengthSq()>.001){
      const here=terrainHeight(pivot),there=terrainHeight(predicted);
      if(Number.isFinite(here)&&Number.isFinite(there))future.y=MathUtils.clamp(there-here,-.5,.5);
      predicted.y+=future.y;
    }
    const fractionAt=elevation=>{
      const eye=eyeAt(elevation),current=this.clearFraction(pivot,eye,terrainHeight);
      return future.lengthSq()>.001?Math.min(current,this.clearFraction(predicted,eye.add(future),terrainHeight)):current;
    };
    // Prefer the normal bearing and elevation, pulling closer when useful.
    // A small, bounded tilt is needed only if that would otherwise be too close.
    const minimum=Math.min(1,distance*WALK_CAMERA.minFraction/this.followDistance);
    let elevation=WALK_CAMERA.elevation,fraction=fractionAt(elevation);
    if(fraction<minimum){
      let lo=elevation,hi=WALK_CAMERA.maxElevation;
      const highFraction=fractionAt(hi);
      if(highFraction>=minimum){
        for(let n=0;n<5;n++){const mid=(lo+hi)/2;if(fractionAt(mid)>=minimum)hi=mid;else lo=mid;}
        elevation=hi;fraction=fractionAt(elevation);
      }else{elevation=hi;fraction=highFraction;}
    }
    this.blocked=fraction<minimum;
    fraction=Math.max(minimum,fraction);
    const constrained=fraction<this.fraction-1e-4||elevation>this.elevation+1e-4;
    if(constrained)this.recovery=WALK_CAMERA.recoveryDelay;
    else this.recovery=Math.max(0,this.recovery-dt);
    const rate=snap?1:1-Math.exp(-(constrained?WALK_CAMERA.approachRate:WALK_CAMERA.recoveryRate)*dt);
    if(constrained||this.recovery===0||snap){
      this.fraction=MathUtils.lerp(this.fraction,fraction,rate);
      this.elevation=MathUtils.lerp(this.elevation,elevation,rate);
    }
    this.fraction=MathUtils.clamp(this.fraction,minimum,1);
    this.elevation=MathUtils.clamp(this.elevation,WALK_CAMERA.elevation,WALK_CAMERA.maxElevation);
    const eye=eyeAt(this.elevation),framing=this.target.clone();
    // Scale both points around Jack to keep yaw and pitch fixed when shortening
    // the boom. No post-smoothing height correction can turn this into overhead.
    this.pose={position:pivot.clone().lerp(eye,this.fraction),target:pivot.clone().lerp(framing,this.fraction)};
    return this.pose;
  }
}
