import * as THREE from 'three';

const FOV = 28;
const AZIMUTH = Math.PI / 4;
const ELEVATION = THREE.MathUtils.degToRad(38);
export const ZOOM_LEVELS = [0.85, 1, 1.25];
export const ZOOM_NAMES = ['Close', 'Standard', 'Wide'];
const clamp = THREE.MathUtils.clamp;

export class CameraRig {
  constructor(camera, settings, width = 1440, height = 900) {
    this.camera = camera;
    this.settings = settings;
    this.target = new THREE.Vector3();
    this.position = new THREE.Vector3();
    this.heading = new THREE.Vector3(0, 0, -1);
    this.probe = new THREE.PerspectiveCamera(FOV, width / height, .2, 600);
    this.direction = new THREE.Vector3(Math.sin(AZIMUTH) * Math.cos(ELEVATION), Math.sin(ELEVATION), Math.cos(AZIMUTH) * Math.cos(ELEVATION));
    this.flatForward = new THREE.Vector3(-Math.sin(AZIMUTH), 0, -Math.cos(AZIMUTH));
    this.cooldown = 0;
    this.resize(width, height);
    this.distance = this.baseDistance;
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this.portrait = height > width;
    this.baseDistance = Math.max(30, 53 * (height / width) / (844 / 390));
    this.camera.fov = FOV;
    this.camera.aspect = this.probe.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.probe.updateProjectionMatrix();
  }

  get yaw() {
    const d = this.camera.getWorldDirection(new THREE.Vector3());
    return Math.atan2(-d.x, -d.z);
  }

  setZoom(index) { this.settings.zoom = clamp(index, 0, 2); }

  pose(distance, point, heading, ahead) {
    // Ground-plane framing puts the boat below centre without tilting the world.
    const bias = distance * Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * .2 / Math.sin(ELEVATION);
    const target = new THREE.Vector3(point.x, point.y + .03, point.z)
      .addScaledVector(this.flatForward, bias).addScaledVector(heading, ahead);
    return {target, position: target.clone().addScaledVector(this.direction, distance)};
  }

  fits(distance, point, heading, ahead, visibleDistance) {
    const pose = this.pose(distance, point, heading, ahead);
    this.probe.position.copy(pose.position);
    this.probe.lookAt(pose.target);
    this.probe.updateMatrixWorld();
    const projected = new THREE.Vector3(point.x, 0, point.z).addScaledVector(heading, visibleDistance).project(this.probe);
    const boat = new THREE.Vector3(point.x, point.y, point.z).project(this.probe);
    return Math.abs(projected.x) < .94 && projected.y > -.85 && projected.y < .82 && Math.abs(boat.x) < .7 && Math.abs(boat.y) < .68;
  }

  update(dt, {position, velocity = {x:0,z:0}, yaw = 0, speed = 0, input = {}, focus = null, locomotion = 'sailing'}, snap = false) {
    if(this.lastPoint&&!focus&&!this.lastFocus&&!snap){const delta=new THREE.Vector3(position.x-this.lastPoint.x,position.y-this.lastPoint.y,position.z-this.lastPoint.z);this.position.add(delta);this.target.add(delta);}
    this.lastPoint={...position};this.lastFocus=!!focus;
    let desired;
    if(focus?.boatStudio){
      const point=new THREE.Vector3(position.x,position.y+.1,position.z),right=new THREE.Vector3(Math.cos(AZIMUTH),0,-Math.sin(AZIMUTH));
      const desktopDistance=16;
      if(this.width>this.height)point.addScaledVector(right,(this.width>=900?460:360)/this.height*desktopDistance*Math.tan(THREE.MathUtils.degToRad(FOV/2)));
      if(this.height>this.width)point.addScaledVector(this.flatForward,-4.5);
      const distance=this.width>=900?desktopDistance:this.height>this.width?24:16;desired={target:point,position:point.clone().addScaledVector(this.direction,distance)};
    } else if (focus) {
      const cfg = focus.camera || {};
      const az = cfg.azimuth ?? AZIMUTH;
      const el = cfg.elevation ?? .64;
      const distance = (cfg.distance || 47) * Math.max(1, this.height / this.width * .9);
      const right = new THREE.Vector3(Math.cos(az), 0, -Math.sin(az));
      const target = new THREE.Vector3(focus.x, cfg.height || 3, focus.z);
      if (this.width >= 900) target.addScaledVector(right, focus.exhibit?460/this.height*distance*Math.tan(THREE.MathUtils.degToRad(FOV/2)):7.4);
      desired = {target, position: target.clone().add(new THREE.Vector3(Math.sin(az)*Math.cos(el), Math.sin(el), Math.cos(az)*Math.cos(el)).multiplyScalar(distance))};
    } else if (locomotion === 'walking') {
      const base = Math.max(12.5, 24 * (this.height / this.width) / (844 / 390));
      const distance = base * ZOOM_LEVELS[this.settings.walkZoom ?? 1];
      const heading = new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
      this.heading.lerp(heading,snap?1:1-Math.exp(-5*dt)).normalize();
      const target=new THREE.Vector3(position.x,position.y+.65,position.z);
      target.addScaledVector(this.flatForward,distance*Math.tan(THREE.MathUtils.degToRad(FOV/2))*.16/Math.sin(ELEVATION));
      if(!this.settings.reduced)target.addScaledVector(this.heading,Math.min(1.2,speed*.3));
      this.distance=distance;desired={target,position:target.clone().addScaledVector(this.direction,distance)};
    } else {
      const moving = Math.hypot(velocity.x, velocity.z) > 2;
      const wantedHeading = moving ? new THREE.Vector3(velocity.x, 0, velocity.z).normalize() : new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
      this.heading.lerp(wantedHeading, snap ? 1 : 1-Math.exp(-7*dt)).normalize();
      const boosting = !!input.boost && (speed > 2 || input.throttle > 0);
      const ahead = this.settings.reduced ? 0 : (boosting || speed > 12.2 ? 8 : Math.min(4, speed / 3));
      let wantedDistance = this.baseDistance * ZOOM_LEVELS[this.settings.zoom ?? 1];
      if (this.settings.reduced) wantedDistance = this.baseDistance * (this.portrait ? 2.35 : 2.6);
      else if (boosting || speed > 6) {
        this.cooldown = .8;
        const need = Math.max(speed, boosting ? 18 : 0) + 2;
        let lo = wantedDistance, hi = this.baseDistance * (this.portrait ? 2 : 64/30);
        // Unusually narrow viewports can need more room than the reference devices.
        while (!this.fits(hi, position, this.heading, ahead, need) && hi < this.baseDistance * 4) hi *= 1.15;
        for (let i=0; i<12; i++) { const mid=(lo+hi)/2; if(this.fits(mid,position,this.heading,ahead,need)) hi=mid; else lo=mid; }
        wantedDistance = Math.max(wantedDistance, hi);
      } else if (this.cooldown > 0) { this.cooldown -= dt; wantedDistance = Math.max(wantedDistance, this.distance); }
      this.distance = snap ? wantedDistance : THREE.MathUtils.damp(this.distance, wantedDistance, wantedDistance > this.distance ? 5 : 3, dt);
      desired = this.pose(this.distance, position, this.heading, ahead);
    }
    const rate = snap ? 1 : 1-Math.exp(-(focus ? 4 : 8)*dt);
    this.position.lerp(desired.position, rate);
    this.target.lerp(desired.target, rate);
    this.camera.position.copy(this.position);
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
  }

  reset(position, yaw=0) {
    this.heading.set(-Math.sin(yaw),0,-Math.cos(yaw));
    this.cooldown = 0;
    this.update(0, {position, yaw}, true);
  }

  visibleSeaPolygon() {
    const ray = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0,1,0),0);
    return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>{
      ray.setFromCamera(new THREE.Vector2(x,y),this.camera);
      const point=ray.ray.intersectPlane(plane,new THREE.Vector3());
      return point ? {x:point.x,z:point.z} : null;
    }).filter(Boolean);
  }
}
