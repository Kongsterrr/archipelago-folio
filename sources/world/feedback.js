import * as THREE from 'three';

export class FeedbackSystem {
 constructor(scene,settings,onSound=()=>{}){
  this.settings=settings;this.onSound=onSound;this.items=[];this.cooldowns=new Map();this.dummy=new THREE.Object3D();this.color=new THREE.Color();
  this.mesh=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.1,0),new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.8,depthWrite:false}),180);
  this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.mesh.frustumCulled=false;scene.add(this.mesh);this.update(0);
 }
 splash(p,{strength=1,kind='water',celebrate=false,key=null}={}){
  const now=performance.now();if(key&&now-(this.cooldowns.get(key)||-Infinity)<300)return;
  if(key)this.cooldowns.set(key,now);this.onSound(kind,strength,p);
  if(this.settings.reduced)return;
  const count=this.settings.quality==='low'?(celebrate?18:6):(celebrate?40:12);
  for(let i=0;i<count;i++){
   const angle=Math.random()*Math.PI*2,speed=(celebrate?2.5:1.4)*Math.min(2,strength),life=celebrate?1.5:.65;
   this.items.push({x:p.x,y:(p.y||.2)+.2,z:p.z,vx:Math.cos(angle)*speed*(.3+Math.random()),vz:Math.sin(angle)*speed*(.3+Math.random()),vy:(celebrate?5:2)*(1+Math.random()*.5),age:0,life,color:celebrate?['#f9c65d','#ef8758','#e5fbf1','#72c7c2'][i%4]:'#e4fff4'});
  }
  this.items=this.items.slice(-180);
 }
 update(dt){
  this.items=this.items.filter(p=>p.age<p.life);
  for(let i=0;i<180;i++){
   const p=this.items[i];if(p){p.age+=dt;p.vy-=8*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;this.dummy.position.set(p.x,Math.max(.06,p.y),p.z);const s=Math.max(0,1-p.age/p.life);this.dummy.scale.set(s*1.3,s*.7,s*1.3);this.color.set(p.color);this.mesh.setColorAt(i,this.color);}else this.dummy.scale.setScalar(0);
   this.dummy.updateMatrix();this.mesh.setMatrixAt(i,this.dummy.matrix);
  }
  this.mesh.instanceMatrix.needsUpdate=true;if(this.mesh.instanceColor)this.mesh.instanceColor.needsUpdate=true;
 }
 clear(){this.items=[];this.update(0);}
}
