import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {contentFocus} from '../sources/config.js';
import {BayLighting} from '../sources/world/bay-lighting.js';

const point={x:12,y:21.55,z:8};
function fixture(){return new BayLighting(new THREE.Scene(),{shadowMap:{}},new THREE.PerspectiveCamera(),'high');}

test('island overview smoothly removes undersampled distant GTAO without changing shadow controls',()=>{
 const rig=fixture();
 rig.update(point,false,140,{viewDistance:30});const bias=rig.sun.shadow.bias,normalBias=rig.sun.shadow.normalBias;
 assert.equal(rig.contactStrength.value,.48);
 let previous=.48;
 for(let distance=30;distance<=140;distance+=.25){
  rig.update(point,false,140,{viewDistance:distance});
  const strength=rig.contactStrength.value;
  assert.ok(strength<=previous&&strength>=0);
  assert.ok(previous-strength<.005,'distance changes cannot create an AO cutoff');
  if(distance<=45)assert.equal(strength,.48);
  if(distance>=90)assert.equal(strength,0);
  assert.equal(rig.sun.shadow.bias,bias);assert.equal(rig.sun.shadow.normalBias,normalBias);
  previous=strength;
 }
 rig.dispose();
});

test('closing overview restores contact shading along the real camera approach, without stale overview state',()=>{
 const rig=fixture();rig.update(point,false,140,{viewDistance:140});
 assert.equal(rig.contactStrength.value,0);
 // The walk distance changes immediately, while the rendered eye is still far.
 let previous=0;
 for(let viewDistance=140;viewDistance>=30;viewDistance-=.25){
  rig.update(point,true,12.6,{viewDistance});
  assert.ok(rig.contactStrength.value>=previous);
  assert.ok(rig.contactStrength.value-previous<.005);
  previous=rig.contactStrength.value;
 }
 assert.equal(rig.contactStrength.value,.48);
 rig.update(point,false,100,{});
 assert.equal(rig.contactStrength.value,0,'all distant views omit undersampled contact shading');
 rig.dispose();
});

for(const island of ['about','experience','projects','education'])test(`${island} overview fades far AO, restores close views and survives quality switches`,()=>{
 const rig=fixture(),focus=contentFocus(island);
 assert.ok(focus.camera.fitBounds,'every section has a whole-island camera');
 rig.update(point,true,30);assert.equal(rig.contactStrength.value,.48);
 rig.update(point,false,140,{viewDistance:140});assert.equal(rig.contactStrength.value,0);
 const uniform=rig.contactStrength;
 rig.setQuality('low');rig.setQuality('high');
 assert.equal(rig.contactStrength,uniform,'quality switches keep the existing pipeline uniform');
 rig.update(point,true,12.6,{viewDistance:140});
 assert.equal(rig.contactStrength.value,0,'closing a panel cannot reintroduce far AO on its first frame');
 rig.update(point,true,12.6,{viewDistance:30});assert.equal(rig.contactStrength.value,.48);
 rig.update(point,false,100);assert.equal(rig.contactStrength.value,0,'distance controls shading independently of the selected island');
 rig.dispose();
});
