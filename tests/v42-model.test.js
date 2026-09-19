import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createJackCharacter,JACK_SPEC} from '../scripts/jack-character.mjs';

test('head proportions, clips and single shared skin remain an explicit contract',()=>{
 const ch=createJackCharacter(),bounds=new THREE.Box3().setFromObject(ch.root),meshes=[];ch.root.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
 assert.ok(Math.abs(bounds.max.y-1.30)<1e-6);assert.ok(Math.abs(bounds.min.y)<1e-6);
 assert.ok(JACK_SPEC.headsTall>=2.15&&JACK_SPEC.headsTall<=2.25);
 assert.deepEqual(ch.animations.map(c=>c.name),['idle','walk','run','helm','interact','sit','stand']);
 assert.equal(new Set(meshes.map(m=>m.skeleton)).size,1);
});

test('a local eye blink closes eye and both highlights without moving the face',()=>{
 const ch=createJackCharacter(),eye=ch.bones.LeftEye,items=[];ch.root.updateMatrixWorld(true);ch.skeleton.update();
 ch.root.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const ids=mesh.geometry.getAttribute('skinIndex');for(let i=0;i<ids.count;i++)if(mesh.skeleton.bones[ids.getX(i)]===eye)items.push({mesh,i});});
 const localBounds=()=>{const box=new THREE.Box3();ch.root.updateMatrixWorld(true);ch.skeleton.update();const inverse=eye.parent.matrixWorld.clone().invert();for(const{mesh,i}of items)box.expandByPoint(mesh.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(inverse));return box;};
 const open=localBounds();eye.scale.y=.08;const closed=localBounds(),a=open.getSize(new THREE.Vector3()),b=closed.getSize(new THREE.Vector3());
 assert.ok(items.length>200);assert.ok(Math.abs(b.y/a.y-.08)<1e-5);assert.ok(Math.abs(b.x-a.x)<1e-6);assert.ok(Math.abs(b.z-a.z)<1e-6);
 assert.ok(closed.getCenter(new THREE.Vector3()).distanceTo(open.getCenter(new THREE.Vector3()))<.001);
 assert.equal(ch.bones.RightEye.scale.y,1);
});

test('cloth bends through blended vertices and every skin weight is normalized',()=>{
 const ch=createJackCharacter(),counts={LeftArm:0,RightArm:0,LeftUpLeg:0,RightUpLeg:0};
 ch.root.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const ids=mesh.geometry.getAttribute('skinIndex'),weights=mesh.geometry.getAttribute('skinWeight');for(let i=0;i<weights.count;i++){
  let sum=0;for(let k=0;k<4;k++)sum+=weights.getComponent(i,k);assert.ok(Math.abs(sum-1)<1e-6);
  const name=mesh.skeleton.bones[ids.getX(i)].name;if(name in counts&&weights.getX(i)>.01&&weights.getY(i)>.01)counts[name]++;
 }});
 for(const [joint,count]of Object.entries(counts))assert.ok(count>20,`${joint} has continuous blended cloth`);
});
