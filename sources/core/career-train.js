import {sampleTrainPath,trainPathLength} from './train-path.js';

export const CAREER_TRAIN_MOTION = Object.freeze({
  cruiseSpeed:5.5, curveSpeed:3.2, acceleration:1.7, braking:2.2,
  boardingDelay:.6, stationDwell:4,
});
export const CAREER_TRAIN = Object.freeze({
  coachOffset:4.30, floorY:.60, seatSurfaceY:1.12,
  seatPosition:Object.freeze([0,1.12,-.65]),
  ...CAREER_TRAIN_MOTION, turnSpeed:CAREER_TRAIN_MOTION.curveSpeed,
  cars:Object.freeze([
    Object.freeze({name:'career-locomotive',offset:0,halfLength:1.85,halfWidth:.93,wheelRadius:.42}),
    Object.freeze({name:'career-coach',offset:4.30,halfLength:1.80,halfWidth:.93,wheelRadius:.36}),
  ]),
});
export const TRAIN_SPEC=CAREER_TRAIN;
const ORDER=['harbor','visionx','beaconfire','amtrak'];
const wrap=(d,length)=>(d%length+length)%length;
const approach=(from,to,amount)=>from+Math.max(-amount,Math.min(amount,to-from));
const inside=(p,polygon)=>{let hit=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>p.z)!==(b[1]>p.z)&&p.x<(b[0]-a[0])*(p.z-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;};

/** Session-owned train simulation. Distances never reset on wrap or model reload.
 * Layout and station coordinates are island-local; public actor poses are world.
 * Game advances this once per fixed step. The model is only a view of this state.
 */
export class CareerTrainController {
  constructor(railway,{island={x:0,y:0,z:0,rotation:0}}={}){
    if(!railway?.path)throw new Error('Career railway needs a shared path.');
    this.railway=railway;this.path=railway.path;this.island=island;this.length=trainPathLength(this.path);
    this.stations=ORDER.map(id=>railway.stations.find(s=>s.id===id));
    if(this.stations.some(s=>!s||!Number.isFinite(s.distance)))throw new Error('Career railway needs four authored stop distances.');
    this.distance=this.stations[0].distance;this.previousDistance=this.distance;this.initialDistance=this.distance;
    this.stationId='harbor';this.targetStationId=null;this.targetDistance=this.distance;
    this.state='stopped';this.mission=null;this.passenger=false;this.speed=0;this.paused=false;
    this.velocity={x:0,y:0,z:0};this.revision=0;this._pose={};this._a={};this._b={};
  }
  get currentStation(){return this.state==='stopped'?this.stations.find(s=>s.id===this.stationId)||null:null;}
  get nextStation(){return this.stations.find(s=>s.id===this.targetStationId)||this.stations[(this.stations.findIndex(s=>s.id===this.stationId)+1)%this.stations.length];}
  get position(){const p=this.carPose(1);return{x:p.x,y:p.y+CAREER_TRAIN.floorY,z:p.z};}
  get yaw(){return this.carPose(1,1,this._pose).yaw;}
  get pitch(){return this.carPose(1,1,this._pose).pitch;}
  get forwardSpeed(){return this.speed;}
  get occupied(){return this.passenger;}
  get eta(){
    if(this.state==='stopped')return 0;
    if(this.state==='waiting-crossing')return null;
    let seconds=0,remaining=Math.max(0,this.targetDistance-this.distance);
    for(let d=0;d<remaining;d+=2)seconds+=Math.min(2,remaining-d)/this.speedLimit(this.distance+d);
    return Math.ceil(seconds+Math.max(0,CAREER_TRAIN.cruiseSpeed-this.speed)/CAREER_TRAIN.acceleration*.5);
  }
  canBoard(id=this.stationId){return !this.paused&&!this.passenger&&this.state==='stopped'&&id===this.stationId;}
  board(id=this.stationId){if(!this.canBoard(id))return false;this.passenger=true;this.revision++;return true;}
  leave(){if(this.paused||!this.passenger||this.state!=='stopped')return false;this.passenger=false;this.revision++;return true;}
  continue(){if(this.paused||!this.passenger||this.state!=='stopped')return false;return this.depart(this.nextStation.id,'tour');}
  call(id){if(this.paused||this.passenger||!this.stations.some(s=>s.id===id))return false;return this.depart(id,'call');}
  cancelRide(){this.passenger=false;this.revision++;return this.depart('harbor','return');}
  returnToHarbor(){return this.depart('harbor',this.passenger?'tour':'return');}
  /** Integration calls this only while an entry/boarding mask is fully opaque.
   * Keep odometry monotonic, but remove interpolation across the reposition.
   */
  parkAtStation(id='harbor'){
    const station=this.stations.find(s=>s.id===id);if(!station||this.passenger)return false;
    this.distance+=wrap(station.distance-this.distance,this.length);this.previousDistance=this.distance;
    this.stationId=id;this.targetStationId=null;this.targetDistance=this.distance;
    this.state='stopped';this.mission=null;this.hold();this.revision++;return true;
  }
  depart(id,mission){
    const station=this.stations.find(s=>s.id===id);if(!station)return false;
    if(this.state==='stopped'&&this.stationId===id){this.mission=null;return true;}
    if(this.targetStationId===id&&this.state!=='stopped'){this.mission=mission;return true;}
    const remaining=wrap(station.distance-this.distance,this.length);
    this.targetDistance=this.distance+remaining;this.targetStationId=id;this.stationId=null;this.mission=mission;this.state='moving';this.revision++;return true;
  }
  hold(){this.speed=0;this.previousDistance=this.distance;this.velocity.x=this.velocity.y=this.velocity.z=0;}
  afterStep(){}
  localPoint(point){const c=Math.cos(this.island.rotation||0),s=Math.sin(this.island.rotation||0),x=point.x-this.island.x,z=point.z-this.island.z;return{x:x*c-z*s,y:point.y-(this.island.y||0),z:x*s+z*c};}
  worldPoint(point,target={}){const c=Math.cos(this.island.rotation||0),s=Math.sin(this.island.rotation||0),{x,y,z}=point;target.x=this.island.x+x*c+z*s;target.y=(this.island.y||0)+y;target.z=this.island.z-x*s+z*c;return target;}
  carPose(index,alpha=1,target={}){
    const car=CAREER_TRAIN.cars[index],distance=this.previousDistance+(this.distance-this.previousDistance)*Math.max(0,Math.min(1,alpha));
    sampleTrainPath(this.path,distance-car.offset,target);const yaw=target.yaw+(this.island.rotation||0),pitch=target.pitch??Math.asin(Math.max(-1,Math.min(1,target.tangentY||0)));
    this.worldPoint(target,target);target.yaw=yaw;target.pitch=pitch;return target;
  }
  seatPose(alpha=1,target={}){
    this.carPose(1,alpha,target);const [x,y,z]=CAREER_TRAIN.seatPosition,c=Math.cos(target.yaw),s=Math.sin(target.yaw),cp=Math.cos(target.pitch),sp=Math.sin(target.pitch),yy=y*cp-z*sp,zz=y*sp+z*cp;
    target.x+=x*c+zz*s;target.y+=yy;target.z+=-x*s+zz*c;return target;
  }
  speedLimit(distance){
    const a=sampleTrainPath(this.path,distance-.5,this._a),b=sampleTrainPath(this.path,distance+.5,this._b);
    const turn=Math.acos(Math.max(-1,Math.min(1,a.tangentX*b.tangentX+(a.tangentY||0)*(b.tangentY||0)+a.tangentZ*b.tangentZ)));
    return turn>.04?CAREER_TRAIN.curveSpeed:CAREER_TRAIN.cruiseSpeed;
  }
  intersectsPedestrian(distance,p){
    for(const car of CAREER_TRAIN.cars){
      const q=sampleTrainPath(this.path,distance-car.offset,this._pose);
      if(Number.isFinite(p.y)&&Math.abs(p.y-q.y)>1.6)continue;
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
        // Wrap the crossing centre, not its stop line. At the stop line a tiny
        // floating-point overshoot must not turn zero clearance into a full lap.
        const distance=wrap(crossing.distance-this.distance,this.length)-(crossing.width||2)/2-CAREER_TRAIN.cars[0].halfLength-.4;
        if(distance<=lookahead)clear=Math.min(clear,Math.max(0,distance));
      }
      for(let d=0;d<=lookahead;d+=.16)if(this.intersectsPedestrian(this.distance+d,p)){clear=Math.min(clear,Math.max(0,d-.24));break;}
    }return clear;
  }
  step(dt,{paused=false,pedestrians=[]}={}){
    this.paused=paused;
    if(paused){this.hold();return;}
    if(!Number.isFinite(dt)||dt<=0)return;
    this.previousDistance=this.distance;const before=this.position;
    for(let remaining=dt;remaining>1e-8;){const h=Math.min(1/60,remaining);remaining-=h;this.advance(h,pedestrians);}
    const after=this.position;this.velocity.x=(after.x-before.x)/dt;this.velocity.y=(after.y-before.y)/dt;this.velocity.z=(after.z-before.z)/dt;
  }
  advance(dt,pedestrians){
    if(this.state==='stopped'){this.speed=0;return;}
    const remaining=Math.max(0,this.targetDistance-this.distance),braking=CAREER_TRAIN.braking;
    // The end-of-step speed leaves enough distance for the following braking
    // steps, including this step's trapezoidal movement. The final stop can
    // therefore reach zero without a visible last-frame velocity snap.
    const brakeStep=braking*dt,stopLimit=Math.max(0,(Math.sqrt(Math.max(0,brakeStep*brakeStep-4*brakeStep*this.speed+8*braking*remaining))-brakeStep)/2);
    let limit=Math.min(CAREER_TRAIN.cruiseSpeed,stopLimit);
    const anticipation=Math.max(6,CAREER_TRAIN.cruiseSpeed**2/(2*braking)+1);
    for(let d=0;d<=anticipation;d+=.25)limit=Math.min(limit,Math.sqrt(this.speedLimit(this.distance+d)**2+2*braking*Math.max(0,d-.25)));
    const clearance=this.clearDistance(pedestrians,Math.max(3,this.speed*this.speed/(2*braking)+1.4));
    if(Number.isFinite(clearance))limit=Math.min(limit,Math.sqrt(2*braking*clearance));
    const oldSpeed=this.speed;this.speed=approach(this.speed,limit,(limit<this.speed?braking:CAREER_TRAIN.acceleration)*dt);
    let travel=(oldSpeed+this.speed)*.5*dt;
    if(Number.isFinite(clearance))travel=Math.min(travel,clearance);
    if(clearance<.001){this.speed=0;this.state='waiting-crossing';return;}
    if(this.state==='waiting-crossing')this.state='moving';
    if(travel>=remaining||remaining<1e-7&&this.speed<=brakeStep){this.distance=this.targetDistance;this.stationId=this.targetStationId;this.targetStationId=null;this.state='stopped';this.speed=0;this.mission=null;this.revision++;}
    else this.distance+=travel;
  }
  status(){return{state:this.state,mission:this.mission,passenger:this.passenger,currentStation:this.currentStation?.id||null,nextStation:this.nextStation?.id||null,targetStation:this.targetStationId,distance:wrap(this.distance,this.length),speed:this.speed,eta:this.eta,paused:this.paused};}
}
