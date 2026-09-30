import * as THREE from 'three';
export class EstatePracticeView{
 constructor(scene,island){this.root=new THREE.Group();this.root.position.set(island.x,0,island.z);this.root.rotation.y=island.rotation;scene.add(this.root);const mat=new THREE.MeshStandardMaterial({color:'#faf3d5',roughness:.72});this.ball=new THREE.Mesh(new THREE.SphereGeometry(1,14,10),mat);this.ball.castShadow=true;this.root.add(this.ball);this.shadow=new THREE.Mesh(new THREE.CircleGeometry(.18,20).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:'#253c35',transparent:true,opacity:.25,depthWrite:false}));this.root.add(this.shadow);this.target=new THREE.Mesh(new THREE.RingGeometry(.55,.61,40).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:'#f4d17e',side:THREE.DoubleSide,depthWrite:false}));this.root.add(this.target);this.aim=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(2,0,0)]),new THREE.LineBasicMaterial({color:'#fff3cc'}));this.root.add(this.aim);this.root.visible=false;}
 update(practice){this.root.visible=practice.active;if(!practice.active)return;const b=practice.ball,ground=practice.groundY;this.ball.visible=!!b;this.shadow.visible=!!b;if(b){this.ball.position.set(b.x,b.y,b.z);this.ball.scale.setScalar(practice.kind==='tennis'?.095:.07);this.ball.material.color.set(practice.kind==='tennis'?'#e9e883':'#fff9e8');this.shadow.position.set(b.x,practice.kind==='tennis'?practice.tennisConfig.surfaceY+.018:b.y-.052,b.z);}
  const tennis=practice.kind==='tennis';this.target.visible=tennis&&practice.state!=='finished';if(tennis)this.target.position.set(practice.targetX,(practice.tennisConfig?.surfaceY??ground)+.018,practice.actor.z-.5);
  this.aim.visible=!tennis&&practice.stage==='ready';if(this.aim.visible){this.aim.position.set(b.x,b.y,b.z);this.aim.rotation.y=-practice.aim;}
 }
 dispose(){this.root.removeFromParent();this.root.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
}

// One shared alpha-cutout weave stays readable without hundreds of thin wires.
let weave;
export function installEstateNet(model,layout){
 const net=model.getObjectByName('occluder_estate_tennis_net');if(!net||net.userData.fineNet)return;
 if(!weave){const bytes=new Uint8Array(16*16*4);for(let y=0;y<16;y++)for(let x=0;x<16;x++){const i=(y*16+x)*4;bytes[i]=bytes[i+1]=bytes[i+2]=x<2||y<2?255:0;bytes[i+3]=255;}weave=new THREE.DataTexture(bytes,16,16);weave.wrapS=weave.wrapT=THREE.RepeatWrapping;weave.repeat.set(42,4);weave.magFilter=THREE.LinearFilter;weave.minFilter=THREE.LinearMipmapLinearFilter;weave.generateMipmaps=true;weave.needsUpdate=true;}
 const material=new THREE.MeshStandardMaterial({color:'#354e50',alphaMap:weave,alphaTest:.35,side:THREE.DoubleSide,roughness:1});
 const face=new THREE.Mesh(new THREE.PlaneGeometry(10,.80),material);face.position.set(16,layout.groundY+.53,-4.985);face.name='estate-net-weave';net.add(face);net.userData.fineNet=true;
}
