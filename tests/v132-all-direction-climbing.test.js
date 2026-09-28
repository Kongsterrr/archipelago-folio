import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import R from '@dimforge/rapier3d-compat/rapier.es.js';
import {islands} from '../sources/config.js';
import {CharacterController, IslandWalkWorld, localToWorld} from '../sources/core/character.js';
import {QuadBikeController, quadGroundPose, quadFootprintClear} from '../sources/core/quad-bike.js';

await R.init();
const DT = 1 / 60, RAD = Math.PI / 180;
const projects = islands.find(i => i.id === 'projects');
const layout = JSON.parse(fs.readFileSync(new URL('../static/models/walk-layout.json', import.meta.url))).islands.find(i => i.id === 'projects');
const headings = Array.from({length:8}, (_,i) => ({x:Math.sin(i*Math.PI/4),z:Math.cos(i*Math.PI/4),label:i*45}));

function fixture(island, data) {
  const world = new R.World({x:0,y:0,z:0}); world.timestep = DT;
  const walk = new IslandWalkWorld(R,world,island,data);
  world.propagateModifiedBodyPositionsToColliders(); world.updateSceneQueries();
  return {world,walk,dispose:() => world.free()};
}

function planeFixture(direction, degrees, contour=false) {
  const gradient = Math.tan(degrees*RAD);
  const sx = (contour ? -direction.z : direction.x)*gradient;
  const sz = (contour ? direction.x : direction.z)*gradient;
  const v = [[-30,-30],[30,-30],[30,30],[-30,30]].flatMap(([x,z]) => [x,24+x*sx+z*sz,z]);
  return fixture({id:'projects',x:0,z:0,rotation:0,shore:[[-30,-30],[30,-30],[30,30],[-30,30]]}, {
    groundY:24,surfaces:[],obstacles:[],
    terrain:{vertices:v,indices:[0,2,1,0,3,2],navigation:{maxClimbSlopeDegrees:55}},
  });
}

function actorFixture(f, kind, start, direction) {
  const yaw=Math.atan2(-direction.x,-direction.z);
  let actor;
  if(kind==='walk') {
    actor=new CharacterController(R,f.world);
    actor.teleport({...start,y:f.walk.groundAt(start),yaw},f.walk); actor.enable(true);
  } else {
    const y=quadGroundPose(f.walk,start,yaw).height;
    actor=new QuadBikeController(R,f.world,f.walk,{...start,y,yaw}); actor.park(false);
    assert.ok(quadFootprintClear(f.walk,actor.position,yaw),'all tyres may occupy the authored climbable surface');
  }
  f.world.step();
  let rescues=0;
  const teleport=actor.teleport.bind(actor);
  actor.teleport=(...args)=>{rescues++;return teleport(...args);};
  return {actor,kind,rescues:()=>rescues};
}

function tick(f,a,direction,{reverse=false,run=false}={}) {
  const before={...a.actor.position};
  a.actor.step(a.kind==='walk'?{x:direction.x,z:direction.z,run}:{throttle:reverse?-1:1,steer:0},DT);
  f.world.step(); a.actor.afterStep();
  const p=a.actor.position;
  assert.ok(Number.isFinite(p.x+p.y+p.z));
  assert.ok(Math.hypot(p.x-before.x,p.y-before.y,p.z-before.z)<.3,'slope traversal stays continuous without rescue jumps');
  const ground=a.kind==='quad'?quadGroundPose(f.walk,p,a.actor.yaw).height:f.walk.groundAt(p);
  assert.ok(Math.abs(p.y-ground)<.055,`${a.kind} remains grounded, including descending and crossing triangle seams`);
  assert.ok(f.walk.contains(p,.2),'climbing never bypasses the shoreline');
  return p;
}

for(const kind of ['walk','quad']) for(const contour of [false,true]) {
  test(`${kind}: 35°/50° ${contour?'contour':'uphill and downhill'} movement is consistent across all eight headings`,()=>{
    for(const slope of [35,50]) {
      const distances=[];
      for(const direction of headings) {
        const f=planeFixture(direction,slope,contour);
        try {
          const a=actorFixture(f,kind,{x:0,z:0},direction),start={...a.actor.position};
          for(let n=0;n<120;n++)tick(f,a,direction);
          const summit={...a.actor.position},distance=Math.hypot(summit.x-start.x,summit.y-start.y,summit.z-start.z);
          assert.ok(distance>(kind==='walk'?4:10),`${direction.label}°: movement makes sustained progress instead of stalling sideways`);
          if(!contour)assert.ok(summit.y-start.y>1.5,'this exercises actual ascent, not only level motion');
          distances.push(distance);
          // Walk back down, or reverse the quad down the exact same incline.
          a.actor.hold();
          for(let n=0;n<100;n++)tick(f,a,{x:-direction.x,z:-direction.z},{reverse:kind==='quad'});
          if(!contour)assert.ok(a.actor.position.y<summit.y-.8,'descent does not float above the ground');
          assert.equal(a.rescues(),0,'normal climbing never uses safety teleportation');
        }finally{f.dispose();}
      }
      assert.ok(Math.max(...distances)/Math.min(...distances)<1.05,'equivalent inclines differ by less than 5% between front, side and diagonal headings');
    }
  });
}

// Select real, unobstructed mountain corridors using only visible ground and
// permanent obstacle/shore geometry. Do not ask the controller whether it can
// pass when choosing fixtures: that would hide slope and footprint regressions.
function ascendingCorridor(walk, direction) {
  let best=null;
  for(let x=-24;x<=24;x+=1)for(let z=-23;z<=20;z+=1) {
    const start={x,z},end={x:x+direction.x*6,z:z+direction.z*6};
    const a=localToWorld(projects,start),b=localToWorld(projects,end),gain=walk.groundAt(b)-walk.groundAt(a);
    if(gain<1.5||gain>5.5)continue;
    let clear=true,maxSlope=0;
    for(let n=0;n<=24;n++) {
      const p=localToWorld(projects,{x:x+direction.x*n/4,z:z+direction.z*n/4});
      if(!walk.clear(p,1.25)){clear=false;break;}
      maxSlope=Math.max(maxSlope,walk.groundSample(p).slope);
    }
    if(!clear||maxSlope<20*RAD||maxSlope>55.1*RAD)continue;
    const score=Math.abs(gain-3)+Math.hypot(x,z)/100;
    if(!best||score<best.score)best={a,b,gain,score,local:start};
  }
  assert.ok(best,`${direction.label}° has a genuine open uphill corridor on the shipped terrain`);
  return best;
}

for(const kind of ['walk','quad'])test(`${kind}: shipped Projects mountains can be climbed and descended from eight compass directions`,()=>{
  const survey=fixture(projects,layout);
  const corridors=headings.map(direction=>({direction,...ascendingCorridor(survey.walk,direction)}));
  survey.dispose();
  for(const corridor of corridors)for(const descending of [false,true]) {
    const f=fixture(projects,layout);
    try {
      const start=descending?corridor.b:corridor.a,end=descending?corridor.a:corridor.b;
      const direction={x:(end.x-start.x)/6,z:(end.z-start.z)/6};
      const a=actorFixture(f,kind,start,direction);
      let progress=0;
      for(let n=0;n<600&&progress<5.8;n++) {
        const p=tick(f,a,direction);
        progress=(p.x-start.x)*direction.x+(p.z-start.z)*direction.z;
        const cross=(p.x-start.x)*direction.z-(p.z-start.z)*direction.x;
        assert.ok(Math.abs(cross)<.18,'traversal does not require a sideways workaround');
      }
      assert.ok(progress>=5.8,`${corridor.direction.label}° ${descending?'descent':'ascent'} from ${JSON.stringify(corridor.local)} must complete`);
      assert.ok(Math.abs(a.actor.position.y-(kind==='quad'?quadGroundPose(f.walk,end,a.actor.yaw).height:f.walk.groundAt(end)))<.4);
      assert.equal(a.rescues(),0,'full climb completes without recovery teleport');
    }finally{f.dispose();}
  }
});

test('Projects mountain profile leaves real buildings solid and shoreline impassable',()=>{
  const f=fixture(projects,layout);
  try {
    assert.equal(layout.terrain.navigation.maxClimbSlopeDegrees,55);
    const kiosk=localToWorld(projects,{x:18,z:4});
    assert.equal(f.walk.clear(kiosk,.22),false);
    assert.equal(quadFootprintClear(f.walk,kiosk,projects.rotation),false,'climbable ground never means driving through exhibits');
    const sea=localToWorld(projects,{x:48,z:0});
    assert.equal(f.walk.contains(sea,.22),false);
    assert.equal(quadFootprintClear(f.walk,sea,projects.rotation),false);
  }finally{f.dispose();}
});

test('ground-following Jack still stops at the actual kiosk and can walk back away',()=>{
  const f=fixture(projects,layout);
  try {
    const start=localToWorld(projects,{x:18,z:8}),wall=localToWorld(projects,{x:18,z:4});
    const direction={x:(wall.x-start.x)/4,z:(wall.z-start.z)/4};
    const a=actorFixture(f,'walk',start,direction);
    for(let n=0;n<180;n++)tick(f,a,direction);
    const contact={...a.actor.position};
    const progress=(contact.x-start.x)*direction.x+(contact.z-start.z)*direction.z;
    assert.ok(progress>1&&progress<3.7,'movement actually reaches but does not cross the kiosk face');
    assert.ok(f.walk.clear(contact,.19),'capsule remains outside the building');
    for(let n=0;n<60;n++)tick(f,a,{x:-direction.x,z:-direction.z});
    assert.ok((a.actor.position.x-contact.x)*-direction.x+(a.actor.position.z-contact.z)*-direction.z>1.5);
    assert.equal(a.rescues(),0);
  }finally{f.dispose();}
});

test('ground-following Jack respects a parked quad collider even though it is not a static island prop',()=>{
  const f=fixture(projects,layout);
  try {
    const position=localToWorld(projects,{x:0,z:25,yaw:0});
    position.y=quadGroundPose(f.walk,position,position.yaw).height;
    const bike=new QuadBikeController(R,f.world,f.walk,position);
    const start=localToWorld(projects,{x:0,z:28});
    const direction={x:(position.x-start.x)/3,z:(position.z-start.z)/3};
    const a=actorFixture(f,'walk',start,direction);
    for(let n=0;n<150;n++)tick(f,a,direction);
    const p=a.actor.position,progress=(p.x-start.x)*direction.x+(p.z-start.z)*direction.z;
    assert.ok(progress>.5&&progress<2,'ground following does not walk through the parked vehicle');
    assert.ok(Math.hypot(p.x-position.x,p.z-position.z)>1);
    assert.equal(a.rescues(),0);
    bike.dispose();
  }finally{f.dispose();}
});
