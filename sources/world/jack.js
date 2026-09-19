import * as THREE from 'three';

export class JackAvatar{
 constructor(scene,loader){this.scene=scene;this.loader=loader;this.root=new THREE.Group();this.root.name='Jack';scene.add(this.root);this.ready=false;this.pose=null;this.interactTime=0;}
 async load(){if(this.promise)return this.promise;this.promise=this.loader.loadAsync('/models/jack.glb').then(gltf=>{
  this.model=gltf.scene;this.root.add(this.model);this.spec={helmAnchor:[.28324,-.4496,.00485],helmScale:.97,benchSeatOffset:.52};this.model.traverse(o=>{if(o.userData.characterSpec)Object.assign(this.spec,o.userData.characterSpec);});this.mixer=new THREE.AnimationMixer(this.model);this.actions=new Map(gltf.animations.map(c=>[c.name,this.mixer.clipAction(c)]));this.outlines=[];
  this.model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});
  const meshes=[];this.model.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});for(const o of meshes){const line=new THREE.SkinnedMesh(o.geometry,new THREE.MeshBasicMaterial({color:'#fff4c4',transparent:true,opacity:.4,depthTest:false,depthWrite:false}));line.bind(o.skeleton,o.bindMatrix);line.position.copy(o.position);line.rotation.copy(o.rotation);line.scale.copy(o.scale);line.frustumCulled=false;line.renderOrder=10;line.visible=false;o.parent.add(line);this.outlines.push(line);}
  for(const name of ['interact','stand']){const a=this.actions.get(name);if(a){a.setLoop(THREE.LoopOnce,1);a.clampWhenFinished=true;}}this.ready=true;this.setPose('helm',0);return true;
 }).catch(e=>{this.promise=null;console.warn('Jack unavailable',e.message);return false;});return this.promise;}
 setPose(name,blend=.15){if(this.pose===name)return;const next=this.actions?.get(name)||this.actions?.get('idle');if(!next)return;const prior=this.actions.get(this.pose);if(blend===0)this.mixer.stopAllAction();next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();if(blend>0&&prior&&prior!==next){prior.fadeOut(blend);next.fadeIn(blend);}this.pose=name;}
 resetPose(name){if(!this.ready)return;this.mixer.stopAllAction();this.pose=null;this.interactTime=0;this.standTime=0;this.wasSeated=false;this.lastSeat=null;this.standFrom=null;this.setPose(name,0);this.mixer.update(0);}
 seatPosition(seat,seatSurfaceY,yaw=0){const forward=this.spec?.benchForwardOffset??0;return new THREE.Vector3(seat.x-Math.sin(yaw)*forward,seatSurfaceY-(this.spec?.benchSeatOffset??.52),seat.z-Math.cos(yaw)*forward);}
 interact(){this.interactTime=1.1;if(this.pose==='interact')this.actions.get('interact')?.reset().play();}
 update(dt,{player,boatVisual,character,alpha,reduced,frozen}){if(!this.ready)return;const land=player.onLand;const modeChanged=this.onLand!==land;this.onLand=land;if(modeChanged)this.resetPose(land?'idle':'helm');
  if(land){this.root.scale.setScalar(1);if(this.root.parent!==this.scene)this.scene.add(this.root);const p=character.position,previous=character.previous;this.root.position.set(THREE.MathUtils.lerp(previous.x,p.x,alpha),THREE.MathUtils.lerp(previous.y,p.y,alpha),THREE.MathUtils.lerp(previous.z,p.z,alpha));this.root.rotation.set(0,character.yaw,0);if(character.seated&&character.seatVisual){this.root.position.copy(character.seatVisual);this.root.rotation.y=character.seatYaw;}else if(this.wasSeated){this.standTime=.6;this.standFrom=this.lastSeat.clone();}if(!character.seated&&this.standTime>0){this.root.position.lerp(this.standFrom,this.standTime/.6);if(!frozen)this.standTime=Math.max(0,this.standTime-dt);}this.wasSeated=character.seated;if(character.seated)this.lastSeat=this.root.position.clone();
   this.setPose(character.seated?'sit':this.standTime>0?'stand':this.interactTime>0?'interact':character.speed>.1?(character.speed>2.65?'run':'walk'):'idle');if(['walk','run'].includes(this.pose))this.actions.get(this.pose)?.setEffectiveTimeScale(character.speed/(this.pose==='run'?4:2.4));else if(['idle','sit'].includes(this.pose))this.actions.get(this.pose)?.setEffectiveTimeScale(reduced?0:1);
  }else{if(this.root.parent!==boatVisual)boatVisual.add(this.root);this.wasSeated=false;this.standTime=0;this.root.scale.setScalar(this.spec.helmScale);this.root.position.fromArray(this.spec.helmAnchor);this.root.rotation.set(0,0,0);this.setPose('helm');}
  // The authored helm pose owns the hand contacts. Steering moves the boat and
  // outboard, never an independently rotated forearm or the neutral wheel.
  if(!frozen){this.interactTime=Math.max(0,this.interactTime-dt);this.mixer.update(dt);}
 }
 outline(value){for(const o of this.outlines||[])o.visible=value;}
}
