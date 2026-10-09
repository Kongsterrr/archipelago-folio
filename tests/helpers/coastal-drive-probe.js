import assert from 'node:assert/strict';
import R from '@dimforge/rapier3d-compat/rapier.es.js';
import {GarageCarController,GARAGE_CARS,garageSpawn,integrateCarDrive} from '../../sources/core/garage-car.js';
import {IslandWalkWorld,localToWorld} from '../../sources/core/character.js';
import {dockLocal} from '../../sources/core/dock.js';

export const STEP=1/60;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const wrap=n=>Math.atan2(Math.sin(n),Math.cos(n));
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);

export function drivingFixture(island,layout,{initialPose}={}){
 const world=new R.World({x:0,y:0,z:0});world.timestep=STEP;
 const walk=new IslandWalkWorld(R,world,island,layout);
 const cars=GARAGE_CARS.map(config=>{
  const initial=initialPose?.(config),spawn=initial?localToWorld(island,initial):garageSpawn(walk,config.bay);
  spawn.y=walk.groundAt(spawn);
  return new GarageCarController(R,world,walk,spawn,config);
 });
 for(const car of cars)car.teleport=()=>assert.fail(`${car.id}: a driving scenario must not teleport or reset`);
 const parked=new Map(cars.map(car=>[car,{...car.position}]));
 return {world,walk,cars,island,layout,parked,
  local(car){const p=dockLocal(car.position,island);return [p.x,p.z];},
  tick(car,input){
   assert.ok(Math.abs(input.steer||0)<=1,'test driver uses bounded ordinary steering');
   assert.ok(Math.abs(input.throttle||0)<=1,'test driver uses bounded ordinary throttle');
   const before={...car.position},expected=integrateCarDrive({yaw:car.yaw,vx:car.velocity.x,vz:car.velocity.z},input,STEP);
   car.step(input,STEP);world.step();car.afterStep();
   const error=Math.hypot(car.position.x-before.x-expected.vx*STEP,car.position.z-before.z-expected.vz*STEP);
   assert.ok(error<5e-5,`${car.id}: driving was clipped by an obstacle at ${this.local(car)}; error=${error}`);
   assert.ok(Math.abs(wrap(car.yaw-expected.yaw))<1e-7,`${car.id}: corner rotation was clipped`);
   assert.ok(car.clearPose(car.position,car.yaw),`${car.id}: full vehicle footprint stays clear`);
   assert.ok(Math.abs(car.position.y-walk.groundAt(car.position))<.03,'tyres retain the authored road height');
   return car.speed;
  },
  verifyParked(except){for(const other of cars)if(other!==except){assert.equal(other.parked,true);assert.equal(other.speed,0);assert.deepEqual({...other.position},parked.get(other),'the other three parked cars never move');}},
  close(){for(const car of cars)car.dispose();world.free();}
 };
}

function polyline(points){
 const clean=points.filter((p,i)=>!i||distance(p,points[i-1])>1e-8),segments=[];let length=0;
 for(let i=1;i<clean.length;i++){const a=clean[i-1],b=clean[i],size=distance(a,b);segments.push({a,b,size,start:length});length+=size;}
 assert.ok(length>0,'driving path has positive length');
 return {points:clean,segments,length,
  at(s){s=clamp(s,0,length);const segment=segments.find(segment=>segment.start+segment.size>=s)||segments.at(-1),t=(s-segment.start)/segment.size;return [segment.a[0]+(segment.b[0]-segment.a[0])*t,segment.a[1]+(segment.b[1]-segment.a[1])*t];},
  project(point,lo=0,hi=length){let best={distance:Infinity,s:lo};for(const segment of segments){if(segment.start+segment.size<lo||segment.start>hi)continue;const {a,b,size,start}=segment,t=clamp(((point[0]-a[0])*(b[0]-a[0])+(point[1]-a[1])*(b[1]-a[1]))/(size*size),clamp((lo-start)/size,0,1),clamp((hi-start)/size,0,1)),p=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],d=distance(point,p);if(d<best.distance)best={distance:d,s:start+t*size};}return best;}
 };
}

// A deterministic pure-pursuit driver sends the same inputs a player can use.
// It never supplies positions, velocities, a different physics step or steering
// outside [-1,1]. Per-step predicted motion detects wall contact and sliding,
// instead of accepting a route merely because the controller eventually escapes.
export function follow(f,car,points,{reverse=false,speed=reverse?3:8,stop=true,maxDeviation=.9}={}){
 const path=polyline(points),limit=reverse?3:8,stats={maxSpeed:0,maxDeviation:0,distance:0,frames:0};
 assert.ok(speed<=limit,'the test must retain production normal speed limits');
 let progress=0;
 const budget=Math.ceil((path.length/Math.max(speed*.5,.1)+15)/STEP);
 car.park(false);
 for(let frame=0;frame<budget;frame++){
  const local=f.local(car),nearest=path.project(local,Math.max(0,progress-.25),Math.min(path.length,progress+18));
  progress=Math.max(progress,nearest.s);stats.maxDeviation=Math.max(stats.maxDeviation,nearest.distance);
  assert.ok(nearest.distance<=maxDeviation,`${car.id}: left the intended lane by ${nearest.distance.toFixed(3)}m at ${local}; path progress ${progress.toFixed(2)}/${path.length.toFixed(2)}`);
  const remaining=path.length-progress,endDistance=distance(local,path.points.at(-1));
  if(remaining<.08&&endDistance<.16&&(!stop||car.speed<.45)){
   if(stop)brake(f,car);
   f.verifyParked(car);return {...stats,length:path.length,endDistance};
  }
  const lookahead=Math.max(1.1,Math.min(2.8,car.speed*.30+1.1)),target=path.at(progress+lookahead),world=localToWorld(f.island,{x:target[0],z:target[1]});
  const dx=world.x-car.position.x,dz=world.z-car.position.z,look=Math.hypot(dx,dz),heading=Math.atan2(-dx,-dz),motionHeading=car.yaw+(reverse?Math.PI:0),error=wrap(heading-motionHeading);
  const curvature=2*Math.sin(error)/Math.max(.25,look),steer=clamp(Math.atan((reverse?-1:1)*2.7*(1+car.speed/40)*curvature)/.72,-1,1);
  const desired=stop?Math.min(speed,Math.max(.12,remaining*1.7)):speed;
  const previous=f.local(car),actual=f.tick(car,{throttle:(reverse?-1:1)*desired/limit,steer});
  stats.maxSpeed=Math.max(stats.maxSpeed,actual);stats.distance+=distance(previous,f.local(car));stats.frames++;
 }
 assert.fail(`${car.id}: failed to complete ${reverse?'reverse':'forward'} path within ${budget} fixed steps; position ${f.local(car)}, progress ${progress}/${path.length}`);
}

export function brake(f,car,{steer=0,onStep=()=>{}}={}){for(let i=0;i<90&&car.speed>1e-5;i++){f.tick(car,{throttle:0,steer,brake:true});onStep();}assert.ok(car.speed<1e-5,'ordinary braking stops the car');}

export function quarterTurn(x,z,direction,radius=3.5){
 // Start travelling +Z, finish travelling east (+1) or west (-1).
 return Array.from({length:36},(_,i)=>{const a=i/35*Math.PI/2;return [x+direction*radius*(1-Math.cos(a)),z+radius*Math.sin(a)];});
}

export function departure(layout,config,direction){
 const bay=layout.garageBays[config.bay],radius=3.5,route=layout.driveRoute;
 const left=Math.min(...route.points.map(p=>p[0])),front=Math.max(...route.points.map(p=>p[1])),cornerX=left+route.cornerRadius,cornerZ=front-route.cornerRadius;
 if(direction<0&&bay.x-radius<cornerX){
  // The westernmost bay joins a bend, not the front straight. Its exit arc
  // is internally tangent to that R8 corner, so reversing the same route
  // does not demand an instantaneous heading change at the merge.
  const centerX=bay.x-radius,offsetX=centerX-cornerX,between=route.cornerRadius-radius;
  assert.ok(Math.abs(offsetX)<between,'a tangent exit circle fits the western bay');
  const offsetZ=Math.sqrt(between*between-offsetX*offsetX),startZ=cornerZ+offsetZ,sweep=Math.acos(offsetX/between),count=Math.ceil(sweep/.035);
  const arc=Array.from({length:count+1},(_,i)=>{const a=sweep*i/count;return[centerX+radius*Math.cos(a),startZ+radius*Math.sin(a)];});
  return [[bay.x,bay.z],...arc];
 }
 const startZ=bay.entrance.z+(config.length??4.7)/2+.35;
 return [[bay.x,bay.z],...quarterTurn(bay.x,startZ,direction,radius)];
}

export function ringPath(route,start,{direction=1,end,full=false}={}){
 const points=route.points.map(p=>p.length===3?[p[0],p[2]]:p);
 if(distance(points[0],points.at(-1))>1e-6)points.push(points[0]);
 const ring=polyline(points),startS=ring.project(start).s,endS=end?ring.project(end).s:startS;
 // Choose route orientation by its front straight's X travel direction.
 const frontZ=Math.max(...points.map(p=>p[1])),front=ring.segments.find(s=>Math.abs(s.a[1]-frontZ)<.01&&Math.abs(s.b[1]-frontZ)<.01&&Math.abs(s.b[0]-s.a[0])>.01);
 assert.ok(front,'the authored ring includes the front straight');
 const sign=Math.sign(front.b[0]-front.a[0])===direction?1:-1;
 let length=full?ring.length:((sign*(endS-startS))%ring.length+ring.length)%ring.length;
 if(!end&&!full)length=ring.length;
 const count=Math.ceil(length/.20),result=[];
 for(let i=0;i<=count;i++){const s=((startS+sign*length*i/count)%ring.length+ring.length)%ring.length;result.push(ring.at(s));}
 return result;
}
