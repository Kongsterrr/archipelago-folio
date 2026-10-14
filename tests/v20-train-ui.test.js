import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import content from '../sources/content.json' with {type:'json'};
import {createVoyageTools} from '../sources/core/webmcp.js';

const main=await fs.readFile(new URL('../sources/main.js',import.meta.url),'utf8');
const html=await fs.readFile(new URL('../sources/index.html',import.meta.url),'utf8');
const css=await fs.readFile(new URL('../sources/style.css',import.meta.url),'utf8');
const hudSource=main.slice(main.indexOf('function trainHUDState('),main.indexOf('function openTrainOptions('));

function fixture(overrides={}){
 const nodes=new Map(),holds=[],document={activeElement:null,body:{classList:{toggle(){}}},querySelectorAll(){return [];}};
 const node=id=>{
  if(!nodes.has(id))nodes.set(id,{id,hidden:false,disabled:false,textContent:'',attributes:{},style:{setProperty(name,value){this[name]=value;}},
   closest(selector){return (selector==='#train-hud button'&&['#train-read','#train-get-off','#train-continue','#train-options'].includes(id))||(selector==='#train-read,#train-get-off,#train-options'&&['#train-read','#train-get-off','#train-options'].includes(id))?this:null;},
   matches(){return true;},setAttribute(name,value){this.attributes[name]=value;},
   blur(){if(document.activeElement===this)document.activeElement=null;this.blurred=(this.blurred||0)+1;}});
  return nodes.get(id);
 };
 node('#panel').open=false;
 const status={stopped:true,currentStation:'visionx',nextStation:'beaconfire',canRead:true,canGetOff:true,canContinue:true,autoDeparture:{remaining:4,duration:4,phase:'station'},...overrides};
 const game={player:{ridingTrain:true},frozen:false,trainStatus:()=>status,journey:{holdDeparture(reason){holds.push(reason);status.autoDeparture=null;}}};
 const context=vm.createContext({game,document,content,$:node});
 vm.runInContext(hudSource,context);
 return {context,game,status,node,holds,document,
  view:()=>vm.runInContext('trainHUDState(game.trainStatus())',context),
  render:()=>vm.runInContext('updateTrainHUD(game.frozen)',context),
  modality:value=>vm.runInContext(`trainFocusModality=${JSON.stringify(value)}`,context),
  focus:id=>{document.activeElement=node(id);return vm.runInContext('holdTrainForFocus()',context);}};
}

test('V20 starts after settling without a second Start journey action',()=>{
 const f=fixture({currentStation:'harbor',autoDeparture:{remaining:.6,duration:.6,phase:'boarding'}});
 const view=f.view();assert.equal(view.phase,'SETTLING IN');assert.equal(view.continueLabel,'Continue now');
 f.render();assert.equal(f.node('#train-departure').hidden,true,'the brief seat settle does not show a four-second station bar');
 assert.doesNotMatch(html,/Start journey/);
});

test('company dwell shows a quiet four-second progress without a growing card or live countdown spam',()=>{
 const f=fixture();f.render();
 assert.equal(f.node('#train-phase').textContent,'CONTINUING IN 4s');
 assert.equal(f.node('#train-continue span').textContent,'Continue now');
 assert.equal(f.node('#train-departure').hidden,false);
 assert.equal(f.node('#train-departure').style['--departure-remaining'],'1');
 f.status.autoDeparture.remaining=2.25;f.render();
 assert.equal(f.node('#train-phase').textContent,'CONTINUING IN 3s');
 assert.equal(f.node('#train-departure').style['--departure-remaining'],String(2.25/4));
 assert.equal(f.node('#train-departure').attributes['aria-valuenow'],'3');
 assert.match(html,/id="train-departure" role="progressbar"[^>]*aria-valuemax="4"/);
 assert.doesNotMatch(html,/<[^>]+id="train-(?:phase|departure)"[^>]*aria-live/);
 assert.match(css,/\.train-departure\{[^}]*position:absolute[^}]*height:3px/);
});

test('keyboard entry into a stop action cancels auto departure and keeps that control focused',()=>{
 const f=fixture();f.modality('keyboard');
 assert.equal(f.focus('#train-read'),true);f.render();
 assert.deepEqual(f.holds,['keyboard-focus']);assert.equal(f.status.autoDeparture,null);
 assert.equal(f.document.activeElement,f.node('#train-read'));
 assert.equal(f.node('#train-departure').hidden,true);
 assert.equal(f.node('#train-continue span').textContent,'Continue journey');
 f.render();assert.equal(f.holds.length,1,'focus holding is not reissued every frame');
});

test('existing keyboard focus at arrival holds the new stop but pointer focus does not',()=>{
 for(const modality of ['keyboard','pointer']){
  const f=fixture({stopped:false,autoDeparture:null});f.modality(modality);f.focus('#train-options');
  f.status.stopped=true;f.status.autoDeparture={remaining:4,duration:4,phase:'station'};f.render();
  assert.equal(f.holds.length,modality==='keyboard'?1:0);
  assert.equal(f.document.activeElement,f.node('#train-options'),'the HUD never steals focus from an available control');
 }
});

test('departure releases unavailable stop controls without carrying their focus to another station',()=>{
 const f=fixture();f.modality('pointer');f.focus('#train-continue');f.render();
 assert.equal(f.holds.length,0);
 f.status.stopped=false;f.status.autoDeparture=null;f.render();
 assert.equal(f.node('#train-continue').hidden,true);assert.equal(f.document.activeElement,null);
 assert.equal(f.node('#train-continue').blurred,1);
 f.status.stopped=true;f.status.currentStation='beaconfire';f.status.autoDeparture={remaining:4,duration:4,phase:'station'};f.render();
 assert.equal(f.holds.length,0);assert.equal(f.document.activeElement,null);
 assert.equal(f.node('#train-continue').hidden,false);
 f.focus('#train-options');f.game.player.ridingTrain=false;f.render();
 assert.equal(f.document.activeElement,null,'leaving the train does not keep focus on the hidden card');
});

test('a deliberate pointer press on Read or Get off holds a nearly expired stop before click',()=>{
 for(const id of ['#train-read','#train-get-off','#train-options','#train-continue']){
  const f=fixture({autoDeparture:{remaining:.01,duration:4,phase:'station'}});f.modality('pointer');f.focus(id);
  const held=vm.runInContext('holdTrainForPointer(document.activeElement)',f.context);
  assert.equal(held,id!=='#train-continue');assert.equal(f.holds.length,id==='#train-continue'?0:1);
 }
});

test('paused, absent and disabled rider actions do not hold or restart automatic departure',()=>{
 for(const block of ['panel','frozen','absent','disabled']){
  const f=fixture();f.modality('keyboard');
  if(block==='panel')f.node('#panel').open=true;
  if(block==='frozen')f.game.frozen=true;
  if(block==='absent')f.game.player.ridingTrain=false;
  if(block==='disabled')f.node('#train-read').disabled=true;
  assert.equal(f.focus('#train-read'),false);assert.deepEqual(f.holds,[]);
 }
 const f=fixture({currentStation:'harbor',autoDeparture:null});f.render();
 assert.equal(f.node('#train-continue span').textContent,'Ride again');
 assert.equal(f.node('#train-departure').hidden,true);assert.equal(f.node('#train-get-off').hidden,false);
});

test('legacy station preparation stays distinct from boarding and preserves runtime refusal',async()=>{
 const calls=[],bridge=createVoyageTools({islands:[],status:()=>({available3D:true}),careerTrain:async input=>{calls.push(input);return input.station!=='amtrak';}}).find(tool=>tool.name==='career_train');
 assert.match(bridge.description,/legacy call action only prepares/);assert.match(bridge.description,/never boards Jack/);
 await bridge.execute({action:'call',station:'visionx'});
 assert.deepEqual(calls,[{action:'call',station:'visionx'}]);
 await assert.rejects(bridge.execute({action:'call',station:'amtrak'}),/unavailable here/);
 await bridge.execute({action:'board'});assert.deepEqual(calls.at(-1),{action:'board'});
});
