import {EXPERIENCE_DEMOS} from '../core/experience-demo.js';

const escapeHTML=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// This is a nearby exhibit control, not a modal: the simulation keeps running.
export class ExperienceDemoUI {
 constructor(root,{getGame,read,clearInput,focusWorld}){
  Object.assign(this,{root,getGame,read,clearInput,focusWorld});this.companyId=null;this.selected=null;this.lastAnnouncement='';
  root.addEventListener('click',event=>{
   const button=event.target.closest('button');if(!button||button.disabled)return;
   if(button.dataset.preset){this.selected=button.dataset.preset;this.update();}
   else if(button.dataset.demoAction==='run'){
    this.clearInput();this.getGame()?.playExperienceDemo(this.companyId,this.selected);this.update();
   }else if(button.dataset.demoAction==='read')this.read(this.companyId);
   else if(button.dataset.demoAction==='close'){this.getGame()?.cancelExperienceDemo();this.close();this.focusWorld();}
  });
 }
 open(companyId,presetId){
  const definition=EXPERIENCE_DEMOS[companyId];if(!definition)return;
  const sameCompany=this.companyId===companyId&&!!this.root.querySelector('[data-preset]');
  this.companyId=companyId;this.selected=definition.presets.some(p=>p.id===presetId)?presetId:sameCompany?this.selected:definition.presets[0].id;this.lastAnnouncement='';this.clearInput();
  // A new preset for this worktable updates the existing controls. Replacing
  // them would remove the focused Run button during keyboard activation.
  if(sameCompany){this.update();return;}
  this.root.innerHTML=`<div class="experience-demo-heading"><div><span class="eyebrow">CONCEPT ILLUSTRATION</span><h2 id="experience-demo-title">${escapeHTML(definition.title)}</h2></div><button type="button" class="experience-demo-close" data-demo-action="close" aria-label="Close example">×</button></div><div class="experience-demo-presets" role="group" aria-label="Choose an example">${definition.presets.map(p=>`<button type="button" data-preset="${escapeHTML(p.id)}" aria-pressed="false">${escapeHTML(p.label)}</button>`).join('')}</div><ol class="experience-demo-steps" aria-label="Example stages"></ol><p class="experience-demo-explanation" aria-live="polite" aria-atomic="true"></p><progress aria-label="Example progress" value="0" max="8"></progress><div class="experience-demo-actions"><button type="button" data-demo-action="run">Run example</button><button type="button" data-demo-action="read">Read experience</button></div><p class="experience-demo-note">Illustrative sample data · Move or press Esc to leave</p>`;
  this.update();
  const initial=[...this.root.querySelectorAll('[data-preset]')].find(button=>button.dataset.preset===this.selected&&!button.disabled)||this.root.querySelector('[data-demo-action="read"]');
  if(!initial?.disabled)initial?.focus({preventScroll:true});
 }
 close(){
  this.root.hidden=true;this.companyId=null;this.selected=null;document.body.classList.remove('experience-demo-active');
  if(this.root.contains(document.activeElement))this.focusWorld();
 }
 update({panelOpen=false,frozen=false}={}){
  const state=this.getGame()?.experienceDemoState?.();
  if(!state?.companyId||state.status==='idle'){this.close();return;}
  if(state.companyId!==this.companyId)return;
  const definition=EXPERIENCE_DEMOS[this.companyId],preset=definition?.presets.find(p=>p.id===this.selected);if(!preset)return;
  const focused=document.activeElement,focusInside=this.root.contains(focused);
  this.root.hidden=panelOpen;document.body.classList.toggle('experience-demo-active',!panelOpen);
  const matches=state.presetId===this.selected,playing=matches&&state.status==='playing',complete=matches&&state.status==='complete';
  for(const button of this.root.querySelectorAll('[data-preset]')){button.setAttribute('aria-pressed',String(button.dataset.preset===this.selected));button.disabled=frozen||playing;}
  const stage=complete?preset.steps.length:playing?Math.min(preset.steps.length-1,state.stage): -1;
  const stageKey=`${this.selected}:${stage}`;
  const steps=this.root.querySelector('.experience-demo-steps');
  if(steps.dataset.view!==stageKey){
   steps.innerHTML=preset.steps.map((s,i)=>`<li class="${i<stage?'done':i===stage?'current':''}" ${i===stage?'aria-current="step"':''}><span>${String(i+1).padStart(2,'0')}</span>${escapeHTML(s.label)}</li>`).join('');steps.dataset.view=stageKey;
  }
  const message=complete?preset.result:playing?preset.steps[stage]?.detail:'Choose a scenario, then watch the steps on the worktable.';
  if(this.lastAnnouncement!==message){this.root.querySelector('.experience-demo-explanation').textContent=message;this.lastAnnouncement=message;}
  const progress=this.root.querySelector('progress');progress.max=state.duration||8;progress.value=matches?state.elapsed:0;progress.hidden=!playing;
  const run=this.root.querySelector('[data-demo-action="run"]');run.disabled=frozen||playing;run.textContent=playing?'Playing example…':complete?'Run again':'Run example';
  const read=this.root.querySelector('[data-demo-action="read"]');read.disabled=frozen;
  if(!panelOpen&&!frozen&&focusInside&&focused.disabled)read.focus({preventScroll:true});
 }
}
