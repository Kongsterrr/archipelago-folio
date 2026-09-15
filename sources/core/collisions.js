// Simplified collision geometry stays independent from the visual GLBs.
export function createIslandColliders(R,world,island){
 const i=island;
 const body=world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(i.x,0,i.z));
 world.createCollider(R.ColliderDesc.cylinder(3,10.7).setFriction(.12).setRestitution(.08),body);
 world.createCollider(R.ColliderDesc.cuboid(1.5,2,3.8).setTranslation(i.x+12*Math.sin(i.rotation),0,i.z+12*Math.cos(i.rotation)).setRotation({x:0,y:Math.sin(i.rotation/2),z:0,w:Math.cos(i.rotation/2)}).setFriction(.1));
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
