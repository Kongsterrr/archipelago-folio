import * as THREE from 'three';
import {islandActions} from '../config.js';

export class IslandController {
 constructor(island,group){this.island=island;this.group=group;this.nodes=[];this.glowing=[];this.occluders=[];this.elapsed=99;this.duration=0;this.lastActive=false;this.model=null;}
 bind(model){
  this.model=model;this.nodes=[];this.glowing=[];this.occluders=[];
  model.traverse(o=>{
   if(o.name.startsWith('anim_'))this.nodes.push({object:o,name:o.name,position:o.position.clone(),rotation:o.rotation.clone(),scale:o.scale.clone()});
   if(o.isMesh){
    const list=Array.isArray(o.material)?o.material:[o.material];
    let branch=o,occludes=false;while(branch&&branch!==model){if(branch.name.startsWith('occluder_')||branch.name.startsWith('station_')||branch.userData.occluder)occludes=true;branch=branch.parent;}if(occludes){
     o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();
     const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats){m.transparent=true;m.opacity=1;}
     this.occluders.push(o);
    }
    for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.emissive&&['glass','glassBlue','yellow','orange'].includes(m.name))this.glowing.push(m);
   }
  });
  this.glowing=[...new Set(this.glowing)];
 }
 activate(){this.elapsed=0;this.duration=this.island.id==='amtrak'?10:this.island.id==='learning'?10:6;return islandActions[this.island.id]?.[1];}
 update(dt,position,time,focused=false,reduced=false){
  const distance=Math.hypot(position.x-this.island.x,position.z-this.island.z);
  let advance=dt;if(this.island.id==='amtrak'&&this.pedestrian&&this.elapsed<this.duration){const tr=this.island.animation?.train,c=tr?.trackCentre||[0,0,-1.4],r=tr?.trackRadii||[8.8,5.8],p=this.pedestrian,dx=p.x-this.island.x,dz=p.z-this.island.z,co=Math.cos(this.island.rotation),si=Math.sin(this.island.rotation),px=dx*co-dz*si,pz=dx*si+dz*co;for(let n=0;n<=8;n++){const a=(this.elapsed+n*.06)/Math.max(1,this.duration)*Math.PI*2;if(Math.hypot(c[0]+Math.cos(a)*r[0]-px,c[2]+Math.sin(a)*r[1]-pz)<2.2){advance=0;break;}}}this.elapsed+=advance;const playing=this.elapsed<this.duration;
  if(distance>80&&!focused&&!playing)return;
  const t=this.elapsed,phase=Math.min(1,t/Math.max(1,this.duration)),envelope=playing?Math.sin(Math.min(1,t*2)*Math.PI/2)*Math.min(1,(this.duration-t)*2):0;
  for(const node of this.nodes){
   const o=node.object,n=node.name;o.position.copy(node.position);o.rotation.copy(node.rotation);o.scale.copy(node.scale);
   if(!playing||reduced)continue;
   if(n==='anim_train'){
    const track=this.island.animation?.train,c=track?.trackCentre||[0,0,-1.4],r=track?.trackRadii||[8.8,5.8],a=phase*Math.PI*2;
    o.position.set(c[0]+Math.cos(a)*r[0],node.position.y,c[2]+Math.sin(a)*r[1]);o.rotation.y=Math.atan2(Math.sin(a)*r[0],-Math.cos(a)*r[1]);
   }else if(n.includes('bell'))o.rotation.z+=Math.sin(t*13)*.3*envelope;
   else if(n.includes('flag'))o.rotation.y+=Math.sin(t*6)*.12;
   else if(n.includes('packet')||n.includes('data')){const index=Number(n.split('_').at(-1))||0,stage=Math.max(0,Math.min(1,(t-index*1.5)/1.2));o.position.x+=stage*1.1;o.position.y+=Math.sin(stage*Math.PI)*.45;o.scale.multiplyScalar(.75+stage*.4);}
   else if(n.includes('signal'))o.rotation.y+=playing?Math.PI:0;
   else if(n.includes('rotor')||n.includes('antenna')||n.includes('dish')||n.includes('sprinkler'))o.rotation.y+=Math.sin(t*1.2)*.65;
   else if(n.includes('plant'))o.scale.y*=1+.22*envelope;
   else if(n.includes('card')||n.includes('order'))o.rotation.x+=Math.PI*Math.min(1,Math.max(0,t-(n.includes('order')?3:0))/1.2);
   else if(n.includes('meal'))o.position.x+=Math.min(1,t/3)*2;
   else if(n.includes('beacon'))o.rotation.y+=t*1.2;
   else if(n.includes('book'))o.rotation.z+=Math.sin(t)*.12;
   else if(n.includes('light'))o.scale.multiplyScalar(1+Math.max(0,Math.sin(t*2-(Number(n.at(-1))||0)*1.3))*.6);
  }
  if(playing||focused||this.lastActive){for(const m of this.glowing){m.emissive.set('#ffd68a');m.emissiveIntensity=playing?.25+Math.sin(time*3)*.1:focused?.15:0;}}
  this.lastActive=playing||focused;
 }
}
