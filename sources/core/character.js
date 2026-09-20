import {ShapeUtils,Vector2} from 'three';
import {pointInPolygon,dockLocal} from './dock.js';

export const SEA_GROUP=0x00010001;
export const WALK_GROUP=0x00020002;
export const CHARACTER={radius:.22,halfHeight:.35,height:1.14,walk:2.4,run:4,offset:.012};
export function localToWorld(island,p){const c=Math.cos(island.rotation),s=Math.sin(island.rotation);return{x:island.x+p.x*c+p.z*s,y:p.y??.85,z:island.z-p.x*s+p.z*c,yaw:(p.yaw||0)+island.rotation};}
function inRect(p,r,margin=0){const c=Math.cos(r.rotation||0),s=Math.sin(r.rotation||0),dx=p.x-r.x,dz=p.z-r.z;return Math.abs(dx*c-dz*s)<=r.width/2+margin&&Math.abs(dx*s+dz*c)<=r.depth/2+margin;}

// The two physics layers share one fixed clock, but never share false-height floors.
export class IslandWalkWorld{
 constructor(R,world,island,layout){Object.assign(this,{R,world,island,layout});this.colliders=[];this.handles=new Set();this.obstacles=[];
  const body=world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(island.x,0,island.z).setRotation({x:0,y:Math.sin(island.rotation/2),z:0,w:Math.cos(island.rotation/2)}));this.body=body;
  const add=(desc,obstacle=false)=>{const c=world.createCollider(desc.setCollisionGroups(WALK_GROUP).setFriction(0),body);this.colliders.push(c);this.handles.add(c.handle);if(obstacle)this.obstacles.push(c);return c;};
  const points=(layout.shore||island.shore).map(([x,z])=>new Vector2(x,z)),y=layout.groundY??.85;
  // Modest triangles avoid capsule sweep precision loss on broad coplanar faces.
  const verticesList=points.map(p=>[p.x,y,p.y]),indicesList=[],midpoints=new Map();
  const midpoint=(a,b)=>{const key=[Math.min(a,b),Math.max(a,b)].join(':');if(midpoints.has(key))return midpoints.get(key);const id=verticesList.length;verticesList.push(verticesList[a].map((v,n)=>(v+verticesList[b][n])/2));midpoints.set(key,id);return id;};
  const triangle=(a,b,c)=>{const length=(u,v)=>Math.hypot(verticesList[u][0]-verticesList[v][0],verticesList[u][2]-verticesList[v][2]);if(Math.max(length(a,b),length(b,c),length(c,a))<=8){indicesList.push(a,c,b);return;}const ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);triangle(a,ab,ca);triangle(ab,b,bc);triangle(ca,bc,c);triangle(ab,bc,ca);};
  for(const t of ShapeUtils.triangulateShape(points,[]))triangle(...t);
  const vertices=new Float32Array(verticesList.flat()),indices=new Uint32Array(indicesList);
  add(R.ColliderDesc.trimesh(vertices,indices,R.TriMeshFlags.FIX_INTERNAL_EDGES));
  this.surfaces=layout.surfaces?.length?layout.surfaces:[{x:0,z:11.85,width:3,depth:7.9,y:.85}];
  for(const f of this.surfaces){const pitch=-Math.atan(f.slope||0),cy=Math.cos((f.rotation||0)/2),sy=Math.sin((f.rotation||0)/2),cx=Math.cos(pitch/2),sx=Math.sin(pitch/2);add(R.ColliderDesc.cuboid(f.width/2,.1,f.depth/2/Math.cos(pitch)).setTranslation(f.x,f.y-.1/Math.cos(pitch),f.z).setRotation({x:sx*cy,y:cx*sy,z:-sx*sy,w:cx*cy}));}
  for(const o of layout.obstacles||[]){add(R.ColliderDesc.cuboid(o.width/2,o.height/2,o.depth/2).setTranslation(o.x,(o.y??y)+o.height/2,o.z).setRotation({x:0,y:Math.sin((o.rotation||0)/2),z:0,w:Math.cos((o.rotation||0)/2)}),true);}
 }
 contains(point,radius=CHARACTER.radius){const p=dockLocal(point,this.island),shore=this.layout.shore||this.island.shore;
  const inside=q=>pointInPolygon(q,shore)||this.surfaces.some(r=>inRect(q,r));
  if(!inside(p))return false;for(let n=0;n<12;n++){const a=n/12*Math.PI*2;if(!inside({x:p.x+Math.cos(a)*radius,z:p.z+Math.sin(a)*radius}))return false;}return true;
 }
 groundAt(point){const p=dockLocal(point,this.island);let y=this.layout.groundY??.85;for(const f of this.surfaces)if(inRect(p,f)){const dz=(p.x-f.x)*Math.sin(f.rotation||0)+(p.z-f.z)*Math.cos(f.rotation||0);y=Math.max(y,f.y+(f.slope||0)*dz);}return y;}
 clear(point,radius=CHARACTER.radius){if(!this.contains(point,radius))return false;const p=dockLocal(point,this.island);return !(this.layout.obstacles||[]).some(o=>inRect(p,o,radius+.03));}
 visible(a,b){const ray=new this.R.Ray({x:a.x,y:a.y+.65,z:a.z},{x:b.x-a.x,y:(b.y??a.y)+.6-(a.y+.65),z:b.z-a.z});return !this.world.castRay(ray,1,true,undefined,WALK_GROUP,undefined,undefined,c=>this.obstacles.includes(c));}
 dispose(){this.world.removeRigidBody(this.body);}
}

export class CharacterController{
 constructor(R,world){this.R=R;this.world=world;this.body=world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0,-50,0));this.collider=world.createCollider(R.ColliderDesc.capsule(CHARACTER.halfHeight,CHARACTER.radius).setCollisionGroups(WALK_GROUP),this.body);this.collider.setEnabled(false);
  this.controller=world.createCharacterController(CHARACTER.offset);this.controller.enableAutostep(.18,.25,false);this.controller.enableSnapToGround(.20);this.controller.setMaxSlopeClimbAngle(Math.PI/6);this.controller.setMinSlopeSlideAngle(Math.PI/5);this.controller.setApplyImpulsesToDynamicBodies(false);
  this.yaw=0;this.velocity={x:0,y:0,z:0};this.previous={x:0,y:0,z:0};this.active=false;this.seated=false;
 }
 get position(){const p=this.body.translation();return{x:p.x,y:p.y-CHARACTER.height/2-CHARACTER.offset,z:p.z};}
 get speed(){return Math.hypot(this.velocity.x,this.velocity.z);}
 teleport(point,walkWorld=this.walkWorld){this.walkWorld=walkWorld;this.yaw=point.yaw||0;const y=point.y??walkWorld.groundAt(point);this.body.setTranslation({x:point.x,y:y+CHARACTER.height/2+CHARACTER.offset,z:point.z},true);this.body.setNextKinematicTranslation(this.body.translation());this.hold();this.previous={...this.position};this.lastSafe={...this.position,yaw:this.yaw};this.seated=false;}
 enable(value){this.active=value;this.collider.setEnabled(value);this.hold();}
 hold(){this.velocity={x:0,y:0,z:0};this.body.setLinvel({x:0,y:0,z:0},true);this.body.setNextKinematicTranslation(this.body.translation());}
 step(input,dt){if(!this.active)return;const p=this.position;this.previous={...p};let x=input.x||0,z=input.z||0;const length=Math.hypot(x,z);if(length>.05&&this.seated)this.seated=false;if(this.seated){this.hold();return;}
  const scale=(input.run?CHARACTER.run:CHARACTER.walk)/Math.max(1,length);x*=scale;z*=scale;
  let next={x:p.x+x*dt,z:p.z+z*dt};if(!this.walkWorld.contains(next)){if(this.walkWorld.contains({x:next.x,z:p.z}))next.z=p.z;else if(this.walkWorld.contains({x:p.x,z:next.z}))next.x=p.x;else next={x:p.x,z:p.z};}
  this.controller.computeColliderMovement(this.collider,{x:next.x-p.x,y:-Math.max(.08,5*dt),z:next.z-p.z},undefined,WALK_GROUP,c=>this.walkWorld.handles.has(c.handle));
  const movement=this.controller.computedMovement(),body=this.body.translation();this.body.setNextKinematicTranslation({x:body.x+movement.x,y:body.y+movement.y,z:body.z+movement.z});this.velocity={x:movement.x/dt,y:movement.y/dt,z:movement.z/dt};
  if(this.speed>.06){const target=Math.atan2(-movement.x,-movement.z),delta=Math.atan2(Math.sin(target-this.yaw),Math.cos(target-this.yaw));this.yaw+=delta*Math.min(1,12*dt);}
 }
 afterStep(){const p=this.position;if(this.walkWorld.contains(p)&&Math.abs(p.y-this.walkWorld.groundAt(p))<.3)this.lastSafe={...p,yaw:this.yaw};else if(!this.walkWorld.contains(p,.18)||p.y<this.walkWorld.groundAt(p)-.4||!Number.isFinite(p.y))this.teleport(this.lastSafe);}
 snapshot(){return{position:{...this.position},yaw:this.yaw,seated:this.seated};}
}
