import test from 'node:test';
import assert from 'node:assert/strict';
import {EXPERIENCE_DEMOS,ExperienceDemoController,experiencePreset} from '../sources/core/experience-demo.js';
import {Game} from '../sources/game.js';
import {createVoyageTools} from '../sources/core/webmcp.js';

for(const [companyId,definition] of Object.entries(EXPERIENCE_DEMOS))for(const preset of definition.presets)test(`${companyId}/${preset.id}: deterministic eight-second example, pause, replay and cancel`,()=>{
 const demo=new ExperienceDemoController();assert.equal(demo.open(companyId),true);assert.equal(demo.status,'choosing');
 assert.equal(demo.play(companyId,preset.id),true);demo.step(1.75);assert.equal(demo.snapshot().stage,0);
 const before=demo.snapshot();demo.step(9,{paused:true});assert.deepEqual(demo.snapshot(),before);
 demo.step(.5);assert.equal(demo.snapshot().stage,1);demo.step(6);assert.equal(demo.status,'complete');assert.equal(demo.elapsed,8);assert.equal(demo.snapshot().stage,3);
 demo.step(90);assert.equal(demo.elapsed,8);demo.play(companyId,preset.id);assert.equal(demo.elapsed,0);
 assert.equal(demo.cancel(),true);assert.equal(demo.cancel(),false);assert.equal(demo.snapshot().companyId,null);
});

test('invalid company/preset cannot replace an active example; negative/nonfinite dt cannot corrupt time',()=>{
 const demo=new ExperienceDemoController();demo.play('visionx','low-light');demo.step(2);const expected=demo.snapshot();
 assert.equal(demo.open('missing'),false);assert.equal(demo.open('__proto__'),false);assert.equal(demo.play('constructor','valid'),false);assert.equal(demo.play('visionx','duplicate'),false);assert.equal(experiencePreset('missing','valid'),null);
 for(const dt of [NaN,Infinity,-3,0])demo.step(dt);assert.deepEqual(demo.snapshot(),expected);
 demo.play('amtrak','duplicate');assert.equal(demo.companyId,'amtrak');assert.equal(demo.elapsed,0);
});

test('reduced motion has static complete results and switching it on finishes without moving time while paused',()=>{
 const demo=new ExperienceDemoController();demo.play('beaconfire','retrieval',{reduced:true});assert.equal(demo.snapshot().progress,1);assert.equal(demo.status,'complete');
 demo.play('visionx','sunny-balcony');demo.step(2);demo.step(0,{paused:true,reduced:true});assert.equal(demo.elapsed,2);
 demo.step(0,{reduced:true});assert.equal(demo.elapsed,8);assert.equal(demo.status,'complete');
});

function gameFixture(){
 const events=[],demo=new ExperienceDemoController(),station={station:{demoId:'visionx'},position:{x:1,y:8.05,z:2},available:()=>true,distance(p){return Math.hypot(p.x-1,p.z-2);}};
 const game=Object.create(Game.prototype);Object.defineProperty(game,'frozen',{value:false,writable:true});
 Object.assign(game,{player:{walking:true,island:{id:'experience'},transitioning:false},character:{position:{x:1,y:8.05,z:3},walkWorld:{visible:()=>true},hold(){}},landActions:new Map([['experience',[station]]]),controllers:new Map([['experience',{experienceDemo:demo,refreshExperienceFeedback(){}}]]),settings:{reduced:false},cameraRig:{yaw:0},inputs:{clear(){},readWalking:()=>({x:0,z:0})},events:{trigger(name,payload){events.push({name,payload});}},jack:{interact(){}}});
 return {game,demo,events,station};
}

test('game opens/plays only the visible nearby worktable on foot; invalid actions preserve the current session',()=>{
 const {game,demo,events}=gameFixture();assert.equal(game.openExperienceDemo('visionx'),true);assert.deepEqual(events[0],{name:'experiencedemoopen',payload:[{companyId:'visionx'}]});
 assert.equal(game.playExperienceDemo('visionx','sunny-balcony'),true);assert.equal(game.playExperienceDemo('visionx','duplicate'),false);assert.equal(demo.presetId,'sunny-balcony');
 const guards=[f=>f.game.frozen=true,f=>f.game.player.walking=false,f=>f.game.player.island.id='projects',f=>f.game.character.position.x=40,f=>f.game.character.position.y=14.55,f=>f.game.character.walkWorld.visible=()=>false];
 for(const guard of guards){const f=gameFixture();guard(f);assert.equal(f.game.openExperienceDemo('visionx'),false);assert.equal(f.game.playExperienceDemo('visionx','low-light'),false);assert.equal(f.demo.status,'idle');}
});

test('modal pauses preserve state; actual movement, boarding transitions and invalidated proximity cancel',()=>{
 const {game,demo,events}=gameFixture();game.openExperienceDemo('visionx');game.playExperienceDemo('visionx','low-light');demo.step(2);
 game.frozen=true;game.inputs.readWalking=()=>({x:1,z:0});game.validateExperienceDemo(true);assert.equal(demo.elapsed,2);assert.equal(game.experienceDemoState().paused,true);
 game.frozen=false;game.validateExperienceDemo(false);assert.equal(demo.status,'idle');assert.equal(events.at(-1).name,'experiencedemoclose');
 game.inputs.readWalking=()=>({x:0,z:0});game.openExperienceDemo('visionx');game.player.transitioning=true;game.validateExperienceDemo(true);assert.equal(demo.status,'idle','boarding cancellation works during transition freeze');
 game.player.transitioning=false;game.openExperienceDemo('visionx');game.character.position.x=20;game.validateExperienceDemo(false);assert.equal(demo.status,'idle');
});

test('automation uses the same company-preset contract and passes no unchecked remote command',async()=>{
 const calls=[],tool=createVoyageTools({islands:[],status:()=>({available3D:true}),experienceDemo:input=>{calls.push(input);return true;}}).find(t=>t.name==='experience_example');
 await tool.execute({action:'open',companyId:'visionx'});await tool.execute({action:'play',companyId:'amtrak',presetId:'duplicate'});await tool.execute({action:'close'});assert.equal(calls.length,3);
 for(const input of [{action:'play',companyId:'visionx',presetId:'duplicate'},{action:'close',companyId:'visionx'},{action:'open',companyId:'missing'},{action:'open',companyId:'visionx',presetId:'low-light'}])await assert.rejects(()=>tool.execute(input));
 assert.equal(calls.length,3);
});

 test('automation play from idle opens the HUD with the selected preset without reopening repeated plays',()=>{
 const {game,events}=gameFixture();assert.equal(game.playExperienceDemo('visionx','sunny-balcony'),true);
 assert.deepEqual(events,[{name:'experiencedemoopen',payload:[{companyId:'visionx',presetId:'sunny-balcony'}]}]);
 game.playExperienceDemo('visionx','sunny-balcony');assert.equal(events.length,1);
 game.playExperienceDemo('visionx','low-light');assert.deepEqual(events.at(-1),{name:'experiencedemoopen',payload:[{companyId:'visionx',presetId:'low-light'}]});
 game.cancelExperienceDemo();game.playExperienceDemo('visionx','low-light');assert.equal(events.at(-1).name,'experiencedemoopen');
 });

test('repeated F or a second worktable click cannot discard a running example or reset the selected preset',()=>{
 const {game,demo,events}=gameFixture();game.openExperienceDemo('visionx');game.playExperienceDemo('visionx','sunny-balcony');demo.step(2);
 const before=demo.snapshot(),count=events.length;assert.equal(game.openExperienceDemo('visionx'),true);
 assert.deepEqual(demo.snapshot(),before);assert.equal(events.length,count);
});
