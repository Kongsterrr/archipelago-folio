import * as THREE from 'three';
import {SUNSET} from './sunset-theme.js';
import {oceanHeight} from './water-space.js';
export class WakePool{
 constructor(scene,settings,capacity=180){this.settings=settings;this.capacity=capacity;this.items=[];this.last=new Map();this.dummy=new THREE.Object3D();this.mesh=new THREE.InstancedMesh(new THREE.CircleGeometry(1,10),new THREE.MeshBasicMaterial({color:SUNSET.foam,transparent:true,opacity:.3,depthWrite:false}),capacity);this.mesh.frustumCulled=false;scene.add(this.mesh);this.update(0,0);}
 emit(id,p,yaw,speed,width,time){if(speed<.3||this.settings.reduced||time-(this.last.get(id)??-10)<(this.settings.quality==='low'?.45:.22))return;this.last.set(id,time);for(const s of [-1,1])this.items.push({x:p.x+Math.cos(yaw)*s*width/3,z:p.z-Math.sin(yaw)*s*width/3,dx:Math.cos(yaw)*s,dz:-Math.sin(yaw)*s,time,width:width*.25});this.items=this.items.slice(-this.capacity);}
 update(time,waterTime){this.items=this.items.filter(i=>time-i.time<2.5);for(let n=0;n<this.capacity;n++){const i=this.items[n];if(i){const age=time-i.time,x=i.x+i.dx*age*.5,z=i.z+i.dz*age*.5,size=(i.width+age*.4)*(1-age/2.5);this.dummy.position.set(x,oceanHeight(x,z,waterTime)+.018,z);this.dummy.rotation.set(-Math.PI/2,0,0);this.dummy.scale.set(size*1.6,size*.5,1);}else this.dummy.scale.setScalar(0);this.dummy.updateMatrix();this.mesh.setMatrixAt(n,this.dummy.matrix);}this.mesh.instanceMatrix.needsUpdate=true;}
 clear(){this.items=[];this.last.clear();}
 dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
