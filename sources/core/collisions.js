import {ShapeUtils,Vector2} from 'three';
// Concave coastlines are decomposed into convex triangular prisms for Rapier.
export function createIslandColliders(R,world,island){
 const i=island;
 const body=world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(i.x,0,i.z).setRotation({x:0,y:Math.sin(i.rotation/2),z:0,w:Math.cos(i.rotation/2)}));
 if(i.shore){
  const points=i.shore.map(([x,z])=>new Vector2(x,z));
  for(const triangle of ShapeUtils.triangulateShape(points,[])){
   const vertices=[];for(const y of [-2,3])for(const index of triangle){const p=points[index];vertices.push(p.x,y,p.y);}
   const shape=R.ColliderDesc.convexHull(new Float32Array(vertices));if(shape)world.createCollider(shape.setFriction(.12).setRestitution(.08),body);
  }
 }else world.createCollider(R.ColliderDesc.cylinder(3,10.7).setFriction(.12).setRestitution(.08),body);
 world.createCollider(R.ColliderDesc.cuboid(1.5,2,3.95).setTranslation(0,0,11.85).setFriction(.1),body);
 for(const x of [-1.65,1.65])for(const z of [11,14.5]){
  const px=i.x+x*Math.cos(i.rotation)+z*Math.sin(i.rotation),pz=i.z-x*Math.sin(i.rotation)+z*Math.cos(i.rotation);
  world.createCollider(R.ColliderDesc.cylinder(1.8,.27).setTranslation(px,0,pz).setFriction(.1));
 }
}
export function createBoundaryColliders(R,world,radius){
 for(let i=0;i<90;i++){
  const mid=(i+.5)/90*Math.PI*2,yaw=Math.PI/2-mid;
  world.createCollider(R.ColliderDesc.cuboid(6.5,3,.6).setTranslation(Math.cos(mid)*(radius+2),0,Math.sin(mid)*(radius+2)).setRotation({x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)}).setRestitution(.15));
 }
}
