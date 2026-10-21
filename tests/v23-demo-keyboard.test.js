import test from 'node:test';
import assert from 'node:assert/strict';
import {ExperienceDemoUI} from '../sources/ui/experience-demo.js';
import {EXPERIENCE_DEMOS,ExperienceDemoController} from '../sources/core/experience-demo.js';

function fixture(t){
 const previous=globalThis.document,document={activeElement:null,body:{classList:{remove(){},toggle(){}}}};
 globalThis.document=document;t.after(()=>{globalThis.document=previous;});
 const root={hidden:true,renders:0,buttons:[],elements:new Map(),listeners:new Map(),
  addEventListener(name,listener){this.listeners.set(name,listener);},
  contains(element){return this.buttons.includes(element);},
  querySelectorAll(selector){return selector==='[data-preset]'?this.buttons.filter(button=>button.dataset.preset):[];},
  querySelector(selector){
   if(selector==='[data-preset]')return this.querySelectorAll(selector)[0];
   const action=selector.match(/^\[data-demo-action="([a-z]+)"\]$/);
   if(action)return this.buttons.find(button=>button.dataset.demoAction===action[1]);
   if(!this.elements.has(selector))this.elements.set(selector,{dataset:{},textContent:'',innerHTML:''});
   return this.elements.get(selector);
  },
  set innerHTML(value){
   if(this.contains(document.activeElement))document.activeElement=document.body;
   this.renders++;this.elements.clear();
   this.buttons=[...value.matchAll(/<button\b([^>]*)>/g)].map(match=>{
    let disabled=false;
    const button={dataset:{},attributes:{},get disabled(){return disabled;},set disabled(value){disabled=value;if(value&&document.activeElement===this)document.activeElement=document.body;},
     focus(){if(!disabled)document.activeElement=this;},closest:()=>button,setAttribute(name,value){this.attributes[name]=value;}};
    const preset=match[1].match(/data-preset="([^"]+)"/),action=match[1].match(/data-demo-action="([^"]+)"/);
    if(preset)button.dataset.preset=preset[1];if(action)button.dataset.demoAction=action[1];return button;
   });
  }};
 const controller=new ExperienceDemoController();let ui;
 const game={experienceDemoState:()=>controller.snapshot(),cancelExperienceDemo:()=>controller.cancel(),
  playExperienceDemo(companyId,presetId){const previous=controller.snapshot();controller.play(companyId,presetId);if(previous.status==='idle'||previous.companyId!==companyId||previous.presetId!==presetId)ui.open(companyId,presetId);return true;}};
 ui=new ExperienceDemoUI(root,{getGame:()=>game,read(){},clearInput(){},focusWorld(){document.activeElement=document.body;}});
 return {ui,root,controller,document,
  open(companyId){controller.open(companyId);ui.open(companyId);},
  click(button){button.focus();root.listeners.get('click')({target:button});},
  button:action=>root.querySelector(`[data-demo-action="${action}"]`)};
}

for(const companyId of Object.keys(EXPERIENCE_DEMOS))test(`${companyId}: running the second preset preserves controls and moves disabled Run focus to Read`,t=>{
 const f=fixture(t);f.open(companyId);
 const presets=f.root.querySelectorAll('[data-preset]'),run=f.button('run'),read=f.button('read');
 f.click(presets[1]);f.click(run);
 assert.equal(f.controller.presetId,EXPERIENCE_DEMOS[companyId].presets[1].id);
 assert.equal(f.controller.status,'playing');assert.equal(f.root.renders,1);
 assert.equal(f.root.querySelectorAll('[data-preset]')[1],presets[1]);
 assert.equal(presets[1].attributes['aria-pressed'],'true');assert.equal(run.disabled,true);
 assert.equal(f.document.activeElement,read);assert.equal(read.disabled,false);
 f.controller.step(8);f.ui.update();
 assert.equal(f.document.activeElement,read,'completion does not steal focus');assert.equal(run.disabled,false);
});

test('first-preset playback also retains an enabled keyboard destination',t=>{
 const f=fixture(t);f.open('visionx');f.click(f.button('run'));
 assert.equal(f.document.activeElement,f.button('read'));assert.equal(f.root.renders,1);
 assert.equal(f.controller.presetId,'low-light');
});

test('a different worktable rebuilds its controls and automation playback focuses an enabled action',t=>{
 const f=fixture(t);f.open('visionx');f.open('amtrak');assert.equal(f.root.renders,2);
 assert.equal(f.document.activeElement,f.root.querySelectorAll('[data-preset]')[0]);
 f.controller.play('beaconfire','retrieval');f.ui.open('beaconfire','retrieval');
 assert.equal(f.root.renders,3);assert.equal(f.ui.selected,'retrieval');
 assert.equal(f.document.activeElement,f.button('read'));assert.equal(f.button('read').disabled,false);
});

test('modal or background updates never pull keyboard focus out of the active menu',t=>{
 const f=fixture(t);f.open('visionx');f.click(f.button('run'));
 const menuButton={};f.document.activeElement=menuButton;
 f.ui.update({panelOpen:true,frozen:true});assert.equal(f.root.hidden,true);
 assert.equal(f.document.activeElement,menuButton);
 f.ui.update({panelOpen:false,frozen:true});assert.equal(f.document.activeElement,menuButton);
 f.ui.update();assert.equal(f.document.activeElement,menuButton,'resume does not refocus the widget unless one of its controls was disabled');
});
