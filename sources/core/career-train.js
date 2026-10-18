import {sampleTrainPath,trainPathLength} from './train-path.js';

export const CAREER_TRAIN_MOTION = Object.freeze({
  cruiseSpeed:4.5, curveSpeed:4.5, acceleration:2.2, braking:2.6,
  boardingDelay:.6, stationDwell:2.5,
});
export const CAREER_TRAIN = Object.freeze({
  coachOffset:0, floorY:1.65, seatSurfaceY:2.17, passengerCarIndex:0,
  seatPosition:Object.freeze([0,2.17,.65]), seatYawOffset:Math.PI,
  ...CAREER_TRAIN_MOTION, turnSpeed:CAREER_TRAIN_MOTION.curveSpeed,
  cars:Object.freeze([
    Object.freeze({name:'career-funicular',offset:0,halfLength:2.5,halfWidth:1.1,wheelRadius:.30,collisionCenterY:2.4,collisionHalfHeight:1.1}),
  ]),
});
export const TRAIN_SPEC=CAREER_TRAIN;
const ORDER=['harbor','visionx','beaconfire','amtrak'];
const wrap=(d,length)=>(d%length+length)%length;
const approach=(from,to,amount)=>from+Math.max(-amount,Math.min(amount,to-from));
const inside=(p,polygon)=>{let hit=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>p.z)!==(b[1]>p.z)&&p.x<(b[0]-a[0])*(p.z-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;};

/** Session-owned simulation. Open lines have a bounded position and signed
 * direction; odometry remains cumulative. The avatar and view survive reloads.
 */
export class CareerTrainController {
  constructor(railway,{island={x:0,y:0,z:0,rotation:0}}={}){
    if(!railway?.path)throw new Error('Career railway needs a shared path.');
    this.railway=railway;this.path=railway.path;this.island=island;this.length=trainPathLength(this.path);this.closed=this.path.closed!==false;
    this.spec=railway.train?.spec||CAREER_TRAIN;this.cars=this.spec.cars;this.passengerCarIndex=this.spec.passengerCarIndex??Math.max(0,this.cars.length-1);
    this.motion={...CAREER_TRAIN_MOTION,...Object.fromEntries(Object.keys(CAREER_TRAIN_MOTION).filter(key=>Number.isFinite(railway[key])).map(key=>[key,railway[key]]))};
    this.stations=ORDER.map(id=>railway.stations.find(s=>s.id===id));
    if(this.stations.some(s=>!s||!Number.isFinite(s.distance)))throw new Error('Career railway needs four authored stop distances.');
    this.minDistance=this.stations[0].distance;this.maxDistance=this.stations.at(-1).distance;
    if(!this.closed&&(this.minDistance<0||this.maxDistance>this.length||this.stations.some((s,i)=>i&&s.distance<=this.stations[i-1].distance)))throw new Error('Open railway stops must ascend within its endpoints.');
    this.distance=this.minDistance;this.previousDistance=this.distance;this.initialDistance=this.distance;
    this.odometer=0;this.wheelDistance=0;this.previousWheelDistance=0;this.direction=1;this.reversing=false;this.reverseDirection=null;
    this.stationId='harbor';this.targetStationId=null;this.targetDistance=this.distance;
    this.state='stopped';this.mission=null;this.passenger=false;this.speed=0;this.paused=false;
    this.velocity={x:0,y:0,z:0};this.revision=0;this._pose={};this._a={};this._b={};
  }
  get currentStation(){return this.state==='stopped'?this.stations.find(s=>s.id===this.stationId)||null:null;}
  get nextStation(){
    if(this.targetStationId)return this.stations.find(s=>s.id===this.targetStationId);
    const index=this.stations.findIndex(s=>s.id===this.stationId);
    if(!this.closed&&index>0&&(index===this.stations.length-1||this.direction<0))return this.stations[0];
    return this.stations[(index+1)%this.stations.length];
  }
  get position(){const p=this.carPose(this.passengerCarIndex);return{x:p.x,y:p.y+this.spec.floorY,z:p.z};}
  get yaw(){return this.carPose(this.passengerCarIndex,1,this._pose).yaw;}
  get pitch(){return this.carPose(this.passengerCarIndex,1,this._pose).pitch;}
  get forwardSpeed(){return this.speed*this.direction;}
  get occupied(){return this.passenger;}
  get eta(){
    if(this.state==='stopped')return 0;if(this.state==='waiting-crossing')return null;
    let seconds=this.reversing?this.speed/this.motion.braking:0;const remaining=Math.abs(this.targetDistance-this.distance),sign=this.closed?1:Math.sign(this.targetDistance-this.distance);
    for(let d=0;d<remaining;d+=2)seconds+=Math.min(2,remaining-d)/this.speedLimit(this.distance+sign*d);
    return Math.ceil(seconds+Math.max(0,this.motion.cruiseSpeed-this.speed)/this.motion.acceleration*.5);
  }
  canBoard(id=this.stationId){return !this.paused&&!this.passenger&&this.state==='stopped'&&id===this.stationId;}
  board(id=this.stationId){if(!this.canBoard(id))return false;this.passenger=true;if(!this.closed)this.direction=id===this.stations.at(-1).id?-1:1;this.revision++;return true;}
  leave(){if(this.paused||!this.passenger||this.state!=='stopped')return false;this.passenger=false;this.revision++;return true;}
  continue(){if(this.paused||!this.passenger||this.state!=='stopped')return false;return this.depart(this.nextStation.id,'tour');}
  call(id){if(this.paused||this.passenger||!this.stations.some(s=>s.id===id))return false;return this.depart(id,'call');}
  cancelRide(){this.passenger=false;this.revision++;return this.depart('harbor','return');}
  returnToHarbor(){return this.depart('harbor',this.passenger?'tour':'return');}
  /** Only an opaque entry/boarding commit may relocate the empty cabin. */
  parkAtStation(id='harbor'){
    const station=this.stations.find(s=>s.id===id);if(!station||this.passenger)return false;
    this.distance=this.closed?this.distance+wrap(station.distance-this.distance,this.length):station.distance;
    this.previousDistance=this.distance;this.previousWheelDistance=this.wheelDistance;
    this.direction=!this.closed&&id===this.stations.at(-1).id?-1:1;this.reversing=false;this.reverseDirection=null;
    this.stationId=id;this.targetStationId=null;this.targetDistance=this.distance;
    this.state='stopped';this.mission=null;this.hold();this.revision++;return true;
  }
  depart(id,mission){
    const station=this.stations.find(s=>s.id===id);if(!station)return false;
    if(this.state==='stopped'&&this.stationId===id){this.mission=null;return true;}
    if(this.targetStationId===id&&this.state!=='stopped'){this.mission=mission;return true;}
    this.targetDistance=this.closed?this.distance+wrap(station.distance-this.distance,this.length):station.distance;
    const direction=this.closed?1:Math.sign(this.targetDistance-this.distance)||-this.direction;
    // An intermediate platform can be too close to stop at after a late call.
    // Brake in the current direction, then approach it from the other side.
    const ahead=(this.targetDistance-this.distance)*this.direction,tooClose=!this.closed&&ahead>=0&&ahead<this.speed*this.speed/(2*this.motion.braking)-1e-8;
    this.reversing=(direction!==this.direction||tooClose)&&this.speed>1e-8;this.reverseDirection=this.reversing?(tooClose?-this.direction:direction):null;
    if(!this.reversing)this.direction=direction;
    this.targetStationId=id;this.stationId=null;this.mission=mission;this.state=this.reversing?'reversing':'moving';this.revision++;return true;
  }
  hold(){this.speed=0;this.previousDistance=this.distance;this.previousWheelDistance=this.wheelDistance;this.velocity.x=this.velocity.y=this.velocity.z=0;}
  afterStep(){}
  localPoint(point){const c=Math.cos(this.island.rotation||0),s=Math.sin(this.island.rotation||0),x=point.x-this.island.x,z=point.z-this.island.z;return{x:x*c-z*s,y:point.y-(this.island.y||0),z:x*s+z*c};}
  worldPoint(point,target={}){const c=Math.cos(this.island.rotation||0),s=Math.sin(this.island.rotation||0),{x,y,z}=point;target.x=this.island.x+x*c+z*s;target.y=(this.island.y||0)+y;target.z=this.island.z-x*s+z*c;return target;}
  carPose(index,alpha=1,target={}){
    const car=this.cars[index];if(!car)throw new RangeError(`Unknown railway car ${index}`);
    const distance=this.previousDistance+(this.distance-this.previousDistance)*Math.max(0,Math.min(1,alpha));
    sampleTrainPath(this.path,distance-car.offset,target);const yaw=target.yaw+(this.island.rotation||0),trackPitch=target.pitch??0;
    this.worldPoint(target,target);target.yaw=yaw;target.trackPitch=trackPitch;target.pitch=this.closed?trackPitch:0;target.bodyPitch=target.pitch;return target;
  }
  seatPose(alpha=1,target={}){
    this.carPose(this.passengerCarIndex,alpha,target);const [x,y,z]=this.spec.seatPosition,c=Math.cos(target.yaw),s=Math.sin(target.yaw),cp=Math.cos(target.pitch),sp=Math.sin(target.pitch),yy=y*cp-z*sp,zz=y*sp+z*cp;
    target.x+=x*c+zz*s;target.y+=yy;target.z+=-x*s+zz*c;target.yaw+=this.spec.seatYawOffset||0;return target;
  }
  speedLimit(distance){
    const a=sampleTrainPath(this.path,distance-.5,this._a),b=sampleTrainPath(this.path,distance+.5,this._b);
    const turn=Math.acos(Math.max(-1,Math.min(1,a.tangentX*b.tangentX+(a.tangentY||0)*(b.tangentY||0)+a.tangentZ*b.tangentZ)));
    return turn>.04?this.motion.curveSpeed:this.motion.cruiseSpeed;
  }
  intersectsPedestrian(distance,p){
    for(const car of this.cars){
      const q=sampleTrainPath(this.path,distance-car.offset,this._pose),center=car.collisionCenterY??1,half=car.collisionHalfHeight??.8;
      if(Number.isFinite(p.y)&&(p.y+1.2<q.y+center-half||p.y>q.y+center+half))continue;
      const dx=p.x-q.x,dz=p.z-q.z,n=Math.hypot(q.tangentX,q.tangentZ),tx=q.tangentX/n,tz=q.tangentZ/n;
      const along=Math.max(0,Math.abs(dx*tx+dz*tz)-car.halfLength),across=Math.max(0,Math.abs(-dx*tz+dz*tx)-car.halfWidth);
      if(Math.hypot(along,across)<.37)return true;
    }return false;
  }
  clearDistance(pedestrians,lookahead){
    let clear=Infinity;
    for(const person of pedestrians){
      const p=this.localPoint(person);
      for(const crossing of this.railway.crossings||[]){
        if(!crossing.polygon||!inside(p,crossing.polygon)||Number.isFinite(p.y)&&Math.abs(p.y-(crossing.y??0))>1.6)continue;
        const q=sampleTrainPath(this.path,this.distance,this._pose),horizontal=Math.hypot(q.tangentX,q.tangentZ),nose=Math.max(...this.cars.map(car=>car.halfLength/horizontal-this.direction*car.offset));
        const ahead=this.closed?wrap(crossing.distance-this.distance,this.length):(crossing.distance-this.distance)*this.direction;
        if(!this.closed&&ahead<-(crossing.width||2)/2-nose)continue;
        const distance=ahead-(crossing.width||2)/2-nose-.4;
        if(distance<=lookahead)clear=Math.min(clear,Math.max(0,distance));
      }
      for(let d=0;d<=lookahead;d+=.16)if(this.intersectsPedestrian(this.distance+this.direction*d,p)){clear=Math.min(clear,Math.max(0,d-.24));break;}
    }return clear;
  }
  step(dt,{paused=false,pedestrians=[]}={}){
    this.paused=paused;if(paused){this.hold();return;}if(!Number.isFinite(dt)||dt<=0)return;
    this.previousDistance=this.distance;this.previousWheelDistance=this.wheelDistance;const before=this.position;
    for(let remaining=dt;remaining>1e-8;){const h=Math.min(1/60,remaining);remaining-=h;this.advance(h,pedestrians);}
    const after=this.position;this.velocity.x=(after.x-before.x)/dt;this.velocity.y=(after.y-before.y)/dt;this.velocity.z=(after.z-before.z)/dt;
  }
  advance(dt,pedestrians){
    if(this.state==='stopped'){this.speed=0;return;}
    // A paused reversal resumes from rest in its new direction, never with an
    // extra uphill frame. Moving reversals first consume the full braking time.
    if(this.reversing&&this.speed<=1e-8){this.direction=Math.sign(this.targetDistance-this.distance)||this.reverseDirection;this.reversing=false;this.reverseDirection=null;this.state='moving';}
    const bound=this.reversing?(this.direction>0?this.maxDistance:this.minDistance):this.targetDistance;
    const remaining=Math.max(0,(bound-this.distance)*this.direction),braking=this.motion.braking;
    const brakeStep=braking*dt,stopLimit=Math.max(0,(Math.sqrt(Math.max(0,brakeStep*brakeStep-4*brakeStep*this.speed+8*braking*remaining))-brakeStep)/2);
    let limit=this.reversing?0:Math.min(this.motion.cruiseSpeed,stopLimit);
    const anticipation=Math.max(6,this.motion.cruiseSpeed**2/(2*braking)+1);
    for(let d=0;d<=anticipation;d+=.25)limit=Math.min(limit,Math.sqrt(this.speedLimit(this.distance+this.direction*d)**2+2*braking*Math.max(0,d-.25)));
    const clearance=this.clearDistance(pedestrians,Math.max(3,this.speed*this.speed/(2*braking)+1.4));
    if(Number.isFinite(clearance))limit=Math.min(limit,Math.sqrt(2*braking*clearance));
    const oldSpeed=this.speed;this.speed=approach(this.speed,limit,(limit<this.speed?braking:this.motion.acceleration)*dt);
    let travel=Math.min(remaining,(oldSpeed+this.speed)*.5*dt);
    if(Number.isFinite(clearance))travel=Math.min(travel,clearance);
    if(clearance<.001){this.speed=0;this.state='waiting-crossing';return;}
    if(this.state==='waiting-crossing')this.state=this.reversing?'reversing':'moving';
    this.distance+=this.direction*travel;this.odometer+=travel;this.wheelDistance+=this.direction*travel;
    if(this.reversing){if(remaining-travel<1e-7)this.speed=0;return;}
    if(travel>=remaining||remaining<1e-7&&this.speed<=brakeStep){this.distance=this.targetDistance;this.stationId=this.targetStationId;this.targetStationId=null;this.state='stopped';this.speed=0;this.mission=null;this.revision++;}
  }
  status(){return{state:this.state,mission:this.mission,passenger:this.passenger,currentStation:this.currentStation?.id||null,nextStation:this.nextStation?.id||null,targetStation:this.targetStationId,distance:this.closed?wrap(this.distance,this.length):this.distance,odometer:this.odometer,direction:this.direction,reversing:this.reversing,speed:this.speed,eta:this.eta,paused:this.paused};}
}
