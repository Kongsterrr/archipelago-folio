import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {installEstateNet} from '../sources/world/estate-practice-view.js';
import {islandMapGeometry} from '../sources/core/minimap.js';
import {islands} from '../sources/config.js';

const layout=JSON.parse(await fs.readFile(new URL('../static/models/walk-layout.json',import.meta.url),'utf8')).islands.find(i=>i.id==='about');
await MeshoptDecoder.ready;
for(const quality of ['','low/'])test(`the ${quality||'high'} net weave stays on the relocated physical tennis net`,async()=>{
 const bytes=await fs.readFile(new URL(`../static/models/${quality}about.glb`,import.meta.url));
 const model=(await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'' )).scene;
 assert.doesNotThrow(()=>installEstateNet(model,{groundY:.85}));
 assert.equal(model.getObjectByName('estate-net-weave'),undefined,'missing layout leaves a retryable model');
 installEstateNet(model,layout);model.updateMatrixWorld(true);
 const weave=model.getObjectByName('estate-net-weave'),net=layout.sports.tennis.net;
 assert.ok(weave);const p=model.worldToLocal(weave.getWorldPosition(new THREE.Vector3()));
 assert.ok(Math.abs(p.x-(net.xMin+net.xMax)/2)<1e-5);
 assert.ok(Math.abs(p.z-net.z-.015)<1e-5);
 assert.ok(Math.abs(p.y-layout.groundY-.53)<1e-5);
 const count=model.getObjectByName('occluder_estate_tennis_net').children.length;
 installEstateNet(model,layout);assert.equal(model.getObjectByName('occluder_estate_tennis_net').children.length,count);
 model.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();});
});

test('the About map preserves vehicle road widths, pedestrian shortcuts and both overlook stalls',()=>{
 const geometry=islandMapGeometry(islands.find(i=>i.id==='about'),layout);
 assert.ok(geometry.roads.some(r=>r.kind==='drive'&&r.width===6.5));
 assert.ok(geometry.roads.some(r=>r.kind==='walk'&&r.width===3.2));
 const parking=geometry.parkingAreas.find(a=>a.id==='coast-overlook');
 assert.equal(parking.stalls.length,2);assert.equal(parking.polygon.length,4);
 for(const stall of parking.stalls)assert.equal(stall.polygon.length,4);
});
