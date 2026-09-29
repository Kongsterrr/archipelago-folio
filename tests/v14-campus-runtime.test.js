import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {SurfaceLibrary} from '../sources/world/surface-library.js';
import {exhibitReadLabel, selectLandExhibit, landPrimaryAction} from '../sources/core/project-exhibits.js';
import {Game} from '../sources/game.js';
import {islands} from '../sources/config.js';
import {islandMapGeometry} from '../sources/core/minimap.js';

test('education uses its own reading labels and keeps the expanded range with exit hysteresis',()=>{
 const overview={kind:'read',station:{directoryOverview:true,readFull:true,readLabel:'Browse education'},distance:()=>2.8};
 const row={kind:'read',station:{directory:true,readFull:true,schoolId:'bu'},distance:()=>0};
 assert.equal(selectLandExhibit([row,overview],{}),overview);
 const school={kind:'read',station:{schoolId:'cmu',readFull:true,readLabel:'View education'},distance:()=>3.4};
 assert.equal(selectLandExhibit([school],{}),null);
 assert.equal(selectLandExhibit([school],{},{previous:school}),school);
 assert.equal(selectLandExhibit([school],{},{previous:school,visible:()=>false}),null);
 assert.equal(landPrimaryAction({player:{walking:true},nearStation:school}).label,'View education');
 assert.equal(exhibitReadLabel(overview),'Browse education');
 assert.equal(exhibitReadLabel({station:{readFull:true}}),'View project');
});

test('school map labels follow stable identities and paths preserve actual north-up geometry',()=>{
 const island=islands.find(i=>i.id==='education');
 const layout={campuses:[{schoolId:'cmu',x:13,z:-3,polygon:[[4,4],[22,4],[22,-15],[4,-15]]},{schoolId:'bu',x:-12,z:-3}],paths:[{width:2.6,points:[[0,18],[0,4],[-12,4]]}]};
 const map=islandMapGeometry(island,layout);
 assert.equal(map.campuses[0].schoolId,'cmu');
 assert.equal(map.campuses[0].x,13);assert.equal(map.campuses[1].x,-12);
 assert.equal(map.campuses[0].polygon[0].z,island.z+4);
 assert.equal(map.roads[0].width,2.6);
 assert.ok(map.roads[0].points[1].z<map.roads[0].points[0].z);
});

test('school reading cameras use authored landmark target rather than the unrelated school station',()=>{
 const fixture={walkLayouts:new Map([['education',{stations:[{primary:true,schoolId:'bu',x:-9,z:8,cameraTarget:{x:-12,y:3,z:-3},camera:{distance:22}}]}]])};
 const focus=Game.prototype.educationFocus.call(fixture,'bu');
 assert.equal(focus.x,-12);assert.equal(focus.z,-79);assert.equal(focus.islandId,'education');
 assert.equal(focus.camera.azimuth,0);assert.equal(focus.camera.distance,22);
 assert.equal(Game.prototype.educationFocus.call(fixture,'cmu'),null);
});

test('campus masonry gains subtle normals without replacing authored color or animated window materials',async()=>{
 const loader={loadAsync:async()=>new THREE.Texture(),dispose(){}},manifest={qualities:{high:{surfaces:{stone:{color:{url:'/c'},normal:{url:'/n'},orm:{url:'/o'}}}},low:{surfaces:{stone:{color:{url:'/lc'},normal:{url:'/ln'},orm:{url:'/lo'}}}}}};
 const library=new SurfaceLibrary({loader,fetchManifest:async()=>manifest});
 const root=new THREE.Group(),stone=new THREE.MeshStandardMaterial({name:'campus_sandstone',color:'#c9b681'}),window=new THREE.MeshStandardMaterial({name:'campus_glass'});
 root.add(new THREE.Mesh(new THREE.BoxGeometry(),stone),new THREE.Mesh(new THREE.BoxGeometry(),window));library.bind(root);
 const bound=root.children[0].material;
 for(const quality of ['high','low']){
  await library.loadQuality(quality);
  assert.ok(bound.color.equals(stone.color));assert.equal(bound.map,null);assert.ok(bound.normalMap);
  assert.ok(bound.normalScale.x<.4);assert.equal(root.children[1].material,window);
 }
 library.release(root);assert.equal(root.children[0].material,stone);library.dispose();
});
