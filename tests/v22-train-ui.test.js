import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {createVoyageTools} from '../sources/core/webmcp.js';

const main=await fs.readFile(new URL('../sources/main.js',import.meta.url),'utf8');
const html=await fs.readFile(new URL('../sources/index.html',import.meta.url),'utf8');
const css=await fs.readFile(new URL('../sources/style.css',import.meta.url),'utf8');
const harborSource=main.slice(main.indexOf('function updateHarborTour('),main.indexOf('function trainHUDState('));
const actionSource=main.slice(main.indexOf('async function trainAction('),main.indexOf("$('#train-start-tour').onclick"));

function fixture(){
 const calls=[],document={activeElement:null},nodes=new Map();
 const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,disabled:false,open:false,blur(){calls.push('blur');document.activeElement=null;},focus(){calls.push('focus');}});return nodes.get(id);};
 const game={boat:{},player:{walking:true,island:{id:'experience'}},frozen:false,practice:{active:false},journey:{allowed:true,canStartFromHarbor(){calls.push('check');return this.allowed;},startFromHarbor(){calls.push('start');return true;}},boardTrain(){calls.push('board');return true;}};
 const context=vm.createContext({game,document,$:node,inputs:{clear(){calls.push('clear');}}});vm.runInContext(harborSource+actionSource,context);
 return {game,calls,node,document,update:frozen=>vm.runInContext(`updateHarborTour(${!!frozen})`,context),act:action=>vm.runInContext(`trainAction(${JSON.stringify(action)})`,context)};
}

test('V22 harbor Start tour appears only for an available walking visitor and does not board on its own',()=>{
 const f=fixture();assert.equal(f.update(false),true);assert.equal(f.node('#harbor-tour').hidden,false);assert.equal(f.node('#train-start-tour').disabled,false);assert.deepEqual(f.calls,['check']);
 for(const state of ['outside','sailing','other-island','frozen','frame-frozen','panel','practice']){
  const g=fixture();
  if(state==='outside')g.game.journey.allowed=false;
  if(state==='sailing')g.game.player.walking=false;
  if(state==='other-island')g.game.player.island.id='about';
  if(state==='frozen')g.game.frozen=true;
  if(state==='panel')g.node('#panel').open=true;
  if(state==='practice')g.game.practice.active=true;
  g.document.activeElement=g.node('#train-start-tour');
  assert.equal(g.update(state==='frame-frozen'),false,state);assert.equal(g.node('#harbor-tour').hidden,true);assert.equal(g.node('#train-start-tour').disabled,true);assert.equal(g.document.activeElement,null);
  assert.ok(!g.calls.includes('start'),'visibility updates never board the visitor');
 }
});

test('V22 Start tour delegates to the harbor transaction while normal board retains its platform action',async()=>{
 const f=fixture();assert.equal(await f.act('start_tour'),true);assert.deepEqual(f.calls,['check','clear','start','focus']);
 f.calls.length=0;assert.equal(await f.act('board'),true);assert.deepEqual(f.calls,['clear','board','focus']);
 for(const denied of ['scope','panel','frozen','unavailable']){
  const g=fixture();if(denied==='scope')g.game.journey.allowed=false;if(denied==='panel')g.node('#panel').open=true;if(denied==='frozen')g.game.frozen=true;if(denied==='unavailable')delete g.game.journey.startFromHarbor;
  assert.equal(await g.act('start_tour'),false);assert.ok(!g.calls.includes('clear')&&!g.calls.includes('start'));
 }
 const refused=fixture();refused.game.journey.startFromHarbor=()=>false;assert.equal(await refused.act('start_tour'),false,'a late runtime refusal is not converted into a successful boarding');
});

test('V22 harbor entry is an explicit accessible 44px action without replacing E or F',()=>{
 const hud=html.slice(html.indexOf('<section class="walking-hud"'),html.indexOf('<section class="train-hud"'));
 assert.match(hud,/<button id="train-start-tour" type="button" aria-describedby="train-tour-hint">Start tour<\/button>/);
 assert.match(hud,/Ride the summit train · ~35 sec/);assert.match(hud,/id="harbor-tour" hidden/);
 assert.match(css,/\.walking-hud #train-start-tour\{[^}]*min-height:44px/);
 assert.match(main,/\$\('#train-start-tour'\)\.onclick=\(\)=>trainAction\('start_tour'\)/);
 assert.match(main,/if\(key==='KeyE'\|\|key==='Enter'\)dock\(\)/);assert.match(main,/if\(key==='KeyF'\)game\?\.interact\(\)/);
});

test('V22 WebMCP Start tour uses the same scoped callback, reports availability and rejects station overrides',async()=>{
 let allowed=true;const calls=[],tools=createVoyageTools({islands:[],status:()=>({available3D:true,train:{canStartFromHarbor:allowed}}),careerTrain:input=>{calls.push(input);return allowed;}}),tool=tools.find(tool=>tool.name==='career_train');
 assert.ok(tool.inputSchema.properties.action.enum.includes('start_tour'));assert.match(tool.description,/2\.5 seconds/);assert.match(tool.description,/harbor welcome area/);
 assert.equal((await tool.execute({action:'start_tour'})).train.canStartFromHarbor,true);assert.deepEqual(calls,[{action:'start_tour'}]);
 await assert.rejects(tool.execute({action:'start_tour',station:'amtrak'}),/known station/);assert.equal(calls.length,1);
 allowed=false;await assert.rejects(tool.execute({action:'start_tour'}),/unavailable here/);
});
