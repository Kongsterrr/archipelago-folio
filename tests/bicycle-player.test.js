import test from 'node:test';
import assert from 'node:assert/strict';
import {PlayerController,BoardingController} from '../sources/core/player.js';
import {landPrimaryAction,selectLandExhibit} from '../sources/core/project-exhibits.js';

function fixture(){
 const calls=[],walkWorld={island:{id:'education'}};
 const character={walkWorld,seated:true,enable:value=>calls.push(['enable',value]),teleport:(point,walk)=>calls.push(['teleport',point,walk])};
 const boat={position:{x:0,y:0,z:0}},bicycle={position:{x:3.2,y:.85,z:-57.7}},quad={position:{x:49,y:.85,z:10.5}};
 const player=new PlayerController(boat,character);
 player.mode='walking';player.island={id:'education'};player.berth={landing:{x:0,y:.85,z:-48.5}};player.quad=quad;
 return {calls,character,boat,bicycle,quad,player};
}

test('Education bicycle becomes the sole active actor without replacing the stored Projects quad',()=>{
 const f=fixture();
 assert.equal(f.player.rideBicycle(f.bicycle),true);
 assert.equal(f.player.mode,'riding-bicycle');
 assert.equal(f.player.ridingBicycle,true);assert.equal(f.player.ridingQuad,false);
 assert.equal(f.player.ridingVehicle,true);assert.equal(f.player.onLand,true);
 assert.equal(f.player.activeVehicle,f.bicycle);assert.equal(f.player.activeActor,f.bicycle);
 assert.equal(f.player.quad,f.quad);assert.equal(f.character.seated,false);
 assert.deepEqual(f.calls,[['enable',false]]);
 const landing={x:4.5,y:.85,z:-57.7,yaw:.25};
 assert.equal(f.player.leaveBicycle(landing),true);
 assert.equal(f.player.walking,true);assert.equal(f.player.ridingVehicle,false);
 assert.equal(f.player.activeVehicle,null);assert.equal(f.player.activeActor,f.character);
 assert.equal(f.player.island.id,'education');assert.ok(f.player.berth);
 assert.deepEqual(f.calls.slice(1),[['teleport',landing,f.character.walkWorld],['enable',true]]);
});

test('a paused or transitioning player cannot mount and repeat E cannot mount twice',()=>{
 const f=fixture();
 for(const reason of ['read','hidden','travel']){
  f.player.pauseReasons.add(reason);assert.equal(f.player.rideBicycle(f.bicycle),false);f.player.pauseReasons.delete(reason);
 }
 for(const mode of ['sailing','boarding','disembarking']){
  f.player.mode=mode;assert.equal(f.player.rideBicycle(f.bicycle),false);
 }
 f.player.mode='walking';assert.equal(f.player.rideBicycle(null),false);assert.deepEqual(f.calls,[]);
 assert.equal(f.player.rideBicycle(f.bicycle),true);assert.equal(f.player.rideBicycle(f.bicycle),false);
 assert.deepEqual(f.calls,[['enable',false]]);
});

test('paused cycling and unavailable dismount keep the same actor until a valid fresh dismount',()=>{
 const f=fixture();f.player.rideBicycle(f.bicycle);
 const landing={x:4.5,y:.85,z:-57.7};
 for(const reason of ['read','hidden']){
  f.player.pauseReasons.add(reason);assert.equal(f.player.leaveBicycle(landing),false);f.player.pauseReasons.delete(reason);
 }
 assert.equal(f.player.leaveBicycle(null),false);assert.equal(f.player.leaveQuad(landing),false);
 assert.equal(f.player.activeActor,f.bicycle);assert.deepEqual(f.calls,[['enable',false]]);
 assert.equal(new BoardingController(f.player).board(),false,'returning to the boat requires leaving the bicycle first');
 assert.equal(f.player.leaveBicycle(landing),true);assert.equal(f.player.leaveBicycle(landing),false);
});

test('Travel to sea invalidates old transitions and preserves both parked vehicle references for later visits',()=>{
 const f=fixture();f.player.rideBicycle(f.bicycle);
 const epoch=f.player.transitionEpoch;f.player.transition={epoch,commit:()=>assert.fail('stale boarding callback')};
 f.player.toSailing();f.player.tick(1);
 assert.equal(f.player.mode,'sailing');assert.equal(f.player.activeActor,f.boat);
 assert.equal(f.player.ridingVehicle,false);assert.equal(f.player.onLand,false);assert.equal(f.player.activeVehicle,null);
 assert.equal(f.player.transitionEpoch,epoch+1);assert.equal(f.player.transition,null);
 assert.equal(f.player.bicycle,f.bicycle);assert.equal(f.player.quad,f.quad);
 assert.equal(f.player.island,null);assert.equal(f.player.berth,null);
});

test('quad mount and dismount retain their existing actor and API after bicycle use',()=>{
 const f=fixture();f.player.rideBicycle(f.bicycle);f.player.leaveBicycle({x:4.5,y:.85,z:-57.7});
 f.player.island={id:'projects'};
 assert.equal(f.player.rideQuad(f.quad),true);assert.equal(f.player.ridingQuad,true);
 assert.equal(f.player.ridingBicycle,false);assert.equal(f.player.ridingVehicle,true);
 assert.equal(f.player.activeVehicle,f.quad);assert.equal(f.player.activeActor,f.quad);
 assert.equal(f.player.leaveBicycle({x:50,y:.85,z:11}),false);
 assert.equal(f.player.leaveQuad({x:50,y:.85,z:11}),true);assert.equal(f.player.activeActor,f.character);
});

test('bicycle E actions beat overlapping education boards while existing quad dispatch kinds stay unchanged',()=>{
 const f=fixture(),nearStation={kind:'read',station:{readFull:true,readLabel:'View education'}};
 const context={player:f.player,canRideBicycle:true,canBoard:true,nearStation};
 assert.deepEqual(landPrimaryAction(context),{kind:'mount-bicycle',label:'Ride bicycle'});
 f.player.rideBicycle(f.bicycle);
 assert.deepEqual(landPrimaryAction(context),{kind:'dismount-bicycle',label:'Dismount bicycle'});
 f.player.leaveBicycle({x:4.5,y:.85,z:-57.7});context.canRideBicycle=false;
 assert.deepEqual(landPrimaryAction(context),{kind:'read',label:'View education'});
 context.canRideQuad=true;assert.deepEqual(landPrimaryAction(context),{kind:'mount',label:'Ride quad bike'});
 f.player.rideQuad(f.quad);assert.deepEqual(landPrimaryAction(context),{kind:'dismount',label:'Dismount quad bike'});
 f.player.toSailing();assert.equal(landPrimaryAction(context),null);
});

test('cycling F selection allows the closest complete education article and excludes benches and devices',()=>{
 const action=(kind,distance,station={})=>({kind,station,distance:()=>distance});
 const bench=action('bench',.2),device=action('action',.1),education=action('read',3.2,{readFull:true,schoolId:'bu'}),directory=action('read',.15,{readFull:true,directory:true});
 assert.equal(selectLandExhibit([bench,device,education,directory],{},{riding:true}),education);
 assert.equal(selectLandExhibit([education],{},{riding:true,visible:()=>false}),null,'buildings continue to block remote reading');
});
