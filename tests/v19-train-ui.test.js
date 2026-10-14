import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import content from '../sources/content.json' with {type:'json'};
import {createVoyageTools} from '../sources/core/webmcp.js';

const main=await fs.readFile(new URL('../sources/main.js',import.meta.url),'utf8');
const html=await fs.readFile(new URL('../sources/index.html',import.meta.url),'utf8');
const css=await fs.readFile(new URL('../sources/style.css',import.meta.url),'utf8');
// Exercise the production passenger UI helpers without initializing a renderer.
const hudSource=main.slice(main.indexOf('function trainHUDState('),main.indexOf('function updateTrainHUD('));
const actionSource=main.slice(main.indexOf('async function trainAction('),main.indexOf("$('#train-options').onclick"));
const hudState=vm.runInNewContext(hudSource+';trainHUDState',{content});

test('the train card uses the actual chronological career content at each stop',()=>{
 for(const id of ['visionx','beaconfire','amtrak']){
  const actual=content.find(entry=>entry.id===id),view=hudState({stopped:true,currentStation:id,canRead:true,canGetOff:true,canContinue:true});
  assert.equal(view.title,actual.title);assert.equal(view.period,actual.period);assert.equal(view.summary,actual.summary);
  assert.equal(view.display,id);assert.equal(view.phase,'AT THE PLATFORM');
  assert.equal(view.read,true);assert.equal(view.getOff,true);assert.equal(view.continue,true);
 }
 const steps=[...html.matchAll(/data-train-stop="([^"]+)"/g)].map(match=>match[1]);
 assert.deepEqual(steps,['harbor','visionx','beaconfire','amtrak']);
 assert.equal(hudState({stopped:true,currentStation:'amtrak'}).continueLabel,'Return to harbor');
 assert.equal(hudState({stopped:true,currentStation:'harbor'}).continueLabel,'Ride again');
});

test('moving passengers see the next story but cannot read, leave or advance before stopping',()=>{
 const view=hudState({phase:'moving',stopped:false,currentStation:'visionx',nextStation:'beaconfire',canRead:true,canGetOff:true,canContinue:true});
 assert.equal(view.display,'beaconfire');assert.equal(view.phase,'NEXT STOP');
 assert.equal(view.read,false);assert.equal(view.getOff,false);assert.equal(view.continue,false);
 const returning=hudState({phase:'returning',stopped:false,currentStation:'amtrak',nextStation:'harbor'});
 assert.equal(returning.title,'Harbor Station');assert.equal(returning.phase,'RETURNING TO HARBOR');
 assert.match(returning.summary,/coast back to the harbor/);
});

test('a stopped train never offers actions not explicitly allowed by its runtime state',()=>{
 const view=hudState({stopped:true,currentStation:'visionx'});
 assert.equal(view.read,false);assert.equal(view.getOff,false);assert.equal(view.continue,false);
 const harbor=hudState({stopped:true,currentStation:'harbor',canRead:true});
 assert.equal(harbor.read,false,'Harbor has no career story and cannot mark an experience viewed');
});

function passengerActions({panelOpen=false,frozen=false,result=true}={}){
 const calls=[],panel={open:panelOpen},game={boat:{},player:{ridingTrain:true},frozen};
 for(const method of ['boardTrain','leaveTrain','continueTrain','readTrainExperience','returnTrainHarbor','callTrain'])game[method]=async station=>{calls.push([method,station]);return result;};
 const action=vm.runInNewContext(actionSource+';trainAction',{game,inputs:{clear(){calls.push(['clear']);}},$:selector=>selector==='#panel'?panel:{focus(options){calls.push(['focus',options.preventScroll]);}}});
 return {action,calls,game,panel};
}

test('passenger buttons and automation call the same proximity-checked game methods',async()=>{
 const f=passengerActions(),methods={board:'boardTrain',get_off:'leaveTrain',continue:'continueTrain',read:'readTrainExperience',return_harbor:'returnTrainHarbor',call:'callTrain'};
 for(const [action,method]of Object.entries(methods)){
  f.calls.length=0;
  assert.equal(await f.action(action,action==='call'?'beaconfire':undefined),true);
  assert.deepEqual(f.calls,[['clear'],[method,action==='call'?'beaconfire':undefined],['focus',true]]);
 }
 const refused=passengerActions({result:false});
 assert.equal(await refused.action('board'),false,'a refused mount cannot be turned into success by UI');
});

test('open readers, background pauses and unavailable game methods cannot issue stale passenger actions',async()=>{
 for(const state of [{panelOpen:true},{frozen:true}]){
  const f=passengerActions(state);
  for(const action of ['board','get_off','continue','read','return_harbor','call'])assert.equal(await f.action(action,'visionx'),false);
  assert.deepEqual(f.calls,[],'paused controls do not clear or mutate the gameplay state');
 }
 const f=passengerActions();delete f.game.boardTrain;
 assert.equal(await f.action('board'),false);assert.equal(await f.action('teleport'),false);assert.deepEqual(f.calls,[]);
});

function toolsFixture({available3D=true,returnValue=true}={}){
 const calls=[],tool=createVoyageTools({islands:[{id:'experience',name:'Experience'}],status:()=>({available3D,train:{phase:'station',currentStation:'harbor'}}),careerTrain:async action=>{calls.push(action);return returnValue;}}).find(item=>item.name==='career_train');
 return {tool,calls};
}

test('the railway WebMCP tool exposes passenger actions and keeps train status',async()=>{
 const f=toolsFixture();
 assert.deepEqual(f.tool.inputSchema.properties.action.enum,['board','get_off','continue','read','return_harbor','call']);
 for(const action of f.tool.inputSchema.properties.action.enum){
  const request=action==='call'?{action,station:'visionx'}:{action},response=await f.tool.execute(request);
  assert.equal(response.train.currentStation,'harbor');assert.deepEqual(f.calls.at(-1),request);
 }
});

test('train automation rejects invalid calls, missing 3D and failed proximity checks',async()=>{
 const f=toolsFixture();
 for(const request of [{action:'teleport'},{action:'call',station:'projects'},{action:'continue',station:'amtrak'},null])await assert.rejects(f.tool.execute(request),/listed|known station/);
 assert.deepEqual(f.calls,[]);
 const unavailable=toolsFixture({available3D:false});await assert.rejects(unavailable.tool.execute({action:'board'}),/unavailable/);assert.deepEqual(unavailable.calls,[]);
 const refused=toolsFixture({returnValue:false});await assert.rejects(refused.tool.execute({action:'board'}),/unavailable here/);assert.equal(refused.calls.length,1);
});

test('train UI has distinct accessible controls, a noninteractive timeline and minimum touch targets',()=>{
 for(const id of ['train-read','train-get-off','train-continue','train-options'])assert.match(html,new RegExp(`<button[^>]*id="${id}"[^>]*type="button"`));
 assert.match(html,/train-stop-heading" aria-live="polite" aria-atomic="true"/);
 assert.doesNotMatch(html,/<button[^>]+data-train-stop=/,'timeline cannot skip stops');
 assert.match(css,/\.train-actions button\{[^}]*min-height:44px/);
 assert.match(css,/\.riding-train \.touch-controls,[^}]*display:none!important/);
 assert.match(css,/\.no-3d \.train-hud,[^}]*display:none!important/);
});
