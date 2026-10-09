import * as THREE from 'three';
import {islandActions,toWorld} from '../config.js';

export class IslandController {
 constructor(island,group){this.island=island;this.group=group;this.nodes=[];this.glowing=[];this.occluders=[];this.elapsed=99;this.duration=0;this.lastActive=false;this.model=null;this.ownedMaterials=new Set();this.materialBindings=[];this.campusState={fencePattern:0,fenceElapsed:1,schoolId:null,duanTheme:0,duanStarted:false,duanElapsed:5,studyActive:false,studyElapsed:2};this.campusWindows=[];this.campusPatterns=[];this.duanThemes=[];this.duanPulses=[];this.studyPages=[];this.studyLights=[];}
 bind(model){
  this.release();
  this.model=model;this.nodes=[];this.glowing=[];this.occluders=[];this.children=[];
  for(const district of this.island.districts||[]){
   const root=model.getObjectByName('district_'+district.id);if(!root)continue;
   const position=toWorld(this.island,district.x,district.z,(this.island.y||0)+(district.y||0));
   const child=new IslandController({...district,...position,rotation:this.island.rotation+(district.rotation||0)},root);
   child.campusState=this.campusState;
   child.bind(root);this.children.push(child);
  }
  const glowMaterials=new Map();
  model.traverse(o=>{
   if(this.children.length){let parent=o;while(parent&&parent!==model){if(parent.name.startsWith('district_'))return;parent=parent.parent;}}
   // Named batches inside an animated group inherit its transform; animate the group once.
   if(o.name.startsWith('anim_')&&!o.isMesh)this.nodes.push({object:o,name:o.name,position:o.position.clone(),rotation:o.rotation.clone(),scale:o.scale.clone()});
   if(o.isMesh){
    const original=o.material;
    let branch=o,occludes=false,campusWindow=false,studyLight=false;while(branch&&branch!==model){if(branch.name.startsWith('occluder_')||branch.name.startsWith('station_')||branch.userData.occluder)occludes=true;if(branch.name==='anim_bu_windows')campusWindow=true;if(branch.name==='anim_campus_study_lights')studyLight=true;branch=branch.parent;}
    // Districts share source materials in a GLB, but their device feedback is independent.
    const isolate=m=>{if(!m.emissive||!['glass','glassBlue','yellow','orange','junction_glass','junction_clear'].includes(m.name))return m;if(!glowMaterials.has(m))glowMaterials.set(m,this.ownMaterial(m));return glowMaterials.get(m);};
    o.material=Array.isArray(o.material)?o.material.map(isolate):isolate(o.material);
    if(occludes||campusWindow||studyLight){
     o.material=Array.isArray(o.material)?o.material.map(m=>this.ownMaterial(m)):this.ownMaterial(o.material);
     const mats=Array.isArray(o.material)?o.material:[o.material];
     if(occludes){for(const m of mats){m.userData.occlusionBaseOpacity=m.opacity;m.transparent=true;}this.occluders.push(o);}
     if(studyLight)for(const m of mats)if(m.emissive)this.studyLights.push({material:m,emissive:m.emissive.clone(),intensity:m.emissiveIntensity});
     if(campusWindow)for(const m of mats)if(m.emissive)this.campusWindows.push({material:m,emissive:m.emissive.clone(),intensity:m.emissiveIntensity});
    }
    if(o.material!==original)this.materialBindings.push({mesh:o,original,assigned:o.material});
    for(const m of Array.isArray(o.material)?o.material:[o.material])if(!campusWindow&&!studyLight&&m.emissive&&['glass','glassBlue','yellow','orange','junction_glass','junction_clear'].includes(m.name))this.glowing.push(m);
   }
  });
  this.glowing=[...new Set(this.glowing)];
  this.campusPatterns=this.nodes.filter(n=>/^anim_campus_fence_pattern_[0-2]$/.test(n.name));
  this.duanThemes=this.nodes.filter(n=>/^anim_duan_theme_[0-2]$/.test(n.name));
  this.duanPulses=this.nodes.filter(n=>/^anim_duan_pulse_[0-2]$/.test(n.name));
  this.studyPages=this.nodes.filter(n=>n.name==='anim_campus_study_page');
  this.applyCampusFeedback(true);
  for(const child of this.children)this.occluders.push(...child.occluders);
 }
 ownMaterial(source){const material=source.clone();this.ownedMaterials.add(material);return material;}
 // Release after SurfaceLibrary.release and before releaseSunsetMaterials. Only
 // these per-controller material clones are owned here, never maps or geometry.
 release(){
  for(const child of this.children||[])child.release();
  for(const {mesh,original,assigned} of this.materialBindings)if(mesh.material===assigned)mesh.material=original;
  for(const material of this.ownedMaterials)material.dispose();
  this.ownedMaterials.clear();this.materialBindings=[];this.children=[];this.nodes=[];this.glowing=[];this.occluders=[];this.campusWindows=[];this.campusPatterns=[];this.duanThemes=[];this.duanPulses=[];this.studyPages=[];this.studyLights=[];this.model=null;
 }
 campusController(){return this.island.id==='learning'?this:this.children?.find(child=>child.island.id==='learning');}
 cycleCampusFence(reduced=false){
  const controller=this.campusController();if(!controller)return null;
  this.campusState.fencePattern=(this.campusState.fencePattern+1)%3;this.campusState.fenceElapsed=reduced?1:0;
  controller.applyCampusFeedback(reduced);return this.campusState.fencePattern;
 }
 cycleDuanTheme(reduced=false){
  const controller=this.campusController();if(!controller)return null;
  const state=this.campusState;
  if(state.duanStarted)state.duanTheme=(state.duanTheme+1)%3;
  state.duanStarted=true;state.duanElapsed=reduced?5:0;
  controller.applyCampusFeedback(reduced);return state.duanTheme;
 }
 setStudySeated(active){
  const state=this.campusState,next=!!active;
  if(state.studyActive===next)return;
  state.studyActive=next;state.studyElapsed=next?0:2;
  this.campusController()?.applyCampusFeedback(false);
 }
 readSchool(schoolId){
  const controller=this.campusController();if(!controller&&!['education','learning'].includes(this.island.id))return false;
  this.campusState.schoolId=schoolId==='bu'||schoolId==='cmu'?schoolId:null;
  // Reading freezes simulation time. Apply now rather than waiting for a tick.
  controller?.applyCampusFeedback(true);return true;
 }
 applyCampusFeedback(reduced=false){
  const state=this.campusState;
  for(const node of this.campusPatterns){
   node.object.visible=Number(node.name.at(-1))===state.fencePattern;
   node.object.scale.copy(node.scale);
   if(node.object.visible&&!reduced&&state.fenceElapsed<.65){const progress=Math.min(1,state.fenceElapsed/.65);node.object.scale.x*=.08+.92*(1-(1-progress)**3);}
  }
  for(const node of this.duanThemes)node.object.visible=Number(node.name.at(-1))===state.duanTheme;
  // Pulses use authored coordinates. Translate only a few centimetres, never
  // scale their world-local geometry around the origin of the whole island.
  for(const node of this.duanPulses){
   node.object.position.copy(node.position);
   if(!reduced&&state.duanStarted&&state.duanElapsed<5){
    const phase=state.duanElapsed/5;
    node.object.position.x+=Math.sin(phase*Math.PI*4)*.08*Math.sin(phase*Math.PI);
   }
  }
  for(const node of this.studyPages){
   node.object.rotation.copy(node.rotation);
   if(state.studyActive&&!reduced&&state.studyElapsed<1.8)node.object.rotation.z+=Math.sin(state.studyElapsed/1.8*Math.PI)*.9;
  }
  for(const {material,emissive,intensity} of this.studyLights){
   material.emissive.copy(emissive);material.emissiveIntensity=intensity;
   if(state.studyActive){material.emissive.set('#ffd59a');material.emissiveIntensity=Math.max(intensity,.6);}
  }
  for(const {material,emissive,intensity} of this.campusWindows){
   material.emissive.copy(emissive);material.emissiveIntensity=intensity;
   if(state.schoolId==='bu'){material.emissive.set('#ffd59a');material.emissiveIntensity=Math.max(intensity,.48);}
  }
 }
 activate(actionId){if(this.children?.length){const child=actionId==null?this.children[0]:this.children.find(c=>c.island.id===actionId);if(!child)return;const result=child.activate();this.elapsed=0;this.duration=child.duration;return result;}this.elapsed=0;this.duration=this.island.id==='amtrak'?(this.island.animation?.train?.duration||10):this.island.id==='learning'?10:6;return islandActions[this.island.id]?.[1];}
 update(dt,position,time,focused=false,reduced=false,focusedDistrict=null){
  if(this.children?.length){for(const child of this.children){child.pedestrian=this.pedestrian;child.update(dt,position,time,focused&&(!focusedDistrict||child.island.id===focusedDistrict),reduced);}this.elapsed+=dt;return;}
  const distance=Math.hypot(position.x-this.island.x,position.z-this.island.z);
  if(this.island.id==='learning'){this.campusState.fenceElapsed=Math.min(1,this.campusState.fenceElapsed+Math.max(0,dt));this.campusState.duanElapsed=Math.min(5,this.campusState.duanElapsed+Math.max(0,dt));this.campusState.studyElapsed=Math.min(2,this.campusState.studyElapsed+Math.max(0,dt));this.applyCampusFeedback(reduced);}
  let advance=dt;if(this.island.id==='amtrak'&&this.pedestrian&&this.elapsed<this.duration){const tr=this.island.animation?.train,c=tr?.trackCentre||[0,0,-1.4],r=tr?.trackRadii||[8.8,5.8],p=this.pedestrian,dx=p.x-this.island.x,dz=p.z-this.island.z,co=Math.cos(this.island.rotation),si=Math.sin(this.island.rotation),px=dx*co-dz*si,pz=dx*si+dz*co,trackY=(this.island.y||0)+(tr?.surfaceY??c[1]);
   const sameLevel=!Number.isFinite(p.y)||!Number.isFinite(tr?.surfaceY)||Math.abs(p.y-trackY)<1.4;
   if(sameLevel)for(let n=0;n<=8;n++){const a=(tr?.initialAngle||0)+(this.elapsed+n*.06)/Math.max(1,this.duration)*Math.PI*2;if(Math.hypot(c[0]+Math.cos(a)*r[0]-px,c[2]+Math.sin(a)*r[1]-pz)<2.2){advance=0;break;}}
  }this.elapsed+=advance;const playing=this.elapsed<this.duration;
  if(distance>80&&!focused&&!playing)return;
  const t=this.elapsed,phase=Math.min(1,t/Math.max(1,this.duration)),envelope=playing?Math.sin(Math.min(1,t*2)*Math.PI/2)*Math.min(1,(this.duration-t)*2):0;
  for(const node of this.nodes){
   const o=node.object,n=node.name;if(n.startsWith('anim_duan_')||n.startsWith('anim_campus_study_'))continue;o.position.copy(node.position);o.rotation.copy(node.rotation);o.scale.copy(node.scale);
   if(!playing||reduced)continue;
   if(n==='anim_train'){
    const track=this.island.animation?.train,c=track?.trackCentre||[0,0,-1.4],r=track?.trackRadii||[8.8,5.8],a=(track?.initialAngle||0)+phase*Math.PI*2;
    o.position.set(c[0]+Math.cos(a)*r[0],track?.rootY??node.position.y,c[2]+Math.sin(a)*r[1]);o.rotation.y=Math.atan2(Math.sin(a)*r[0],-Math.cos(a)*r[1]);
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
  if(this.island.id==='learning')this.applyCampusFeedback(reduced);
 }
}
