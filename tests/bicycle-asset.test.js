import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {BICYCLE_RIG,classifyBicycleTriangle} from '../scripts/lib/bicycle-geometry.mjs';

await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const manifest=JSON.parse(await fs.readFile(new URL('../static/models/bicycle-manifest.json',import.meta.url),'utf8'));
const assets=Object.fromEntries(await Promise.all(['high','low'].map(async quality=>[quality,await io.read(fileURLToPath(new URL(`../static/models/${quality==='low'?'low/':''}bicycle.glb`,import.meta.url)))])));
const node=(document,name)=>document.getRoot().listNodes().find(n=>n.getName()===name);
const worldPosition=n=>n.getWorldMatrix().slice(12,15);
const transform=(matrix,p)=>[matrix[0]*p[0]+matrix[4]*p[1]+matrix[8]*p[2]+matrix[12],matrix[1]*p[0]+matrix[5]*p[1]+matrix[9]*p[2]+matrix[13],matrix[2]*p[0]+matrix[6]*p[1]+matrix[10]*p[2]+matrix[14]];
const close=(a,b,error=1e-7)=>assert.ok(Math.hypot(...a.map((v,i)=>v-b[i]))<=error,`${a} should match ${b}`);

test('source import assigns every original bicycle triangle once before lossy optimization',()=>{
  assert.equal(manifest.sourceBytes,45869820);
  assert.equal(manifest.sourceSHA256,'a2cb36e2e415692243bec151ddfaca626561f9a43e5034fbd820aad07c9688b6');
  assert.equal(manifest.segmentation.sourceTriangles,1430174);
  assert.equal(manifest.segmentation.retainedTriangles,manifest.segmentation.sourceTriangles);
  assert.equal(Object.values(manifest.segmentation.parts).reduce((a,b)=>a+b,0),manifest.segmentation.sourceTriangles);
  for(const part of ['frame','fork','wheel-front','wheel-rear','handlebar','saddle','chainring','crank-left','crank-right','pedal-left','pedal-right'])assert.ok(manifest.segmentation.parts[part]>1000,part);
  // Tire sidewall samples in all 48 sectors are wheels, including the top of
  // the rim where the fixed fork crosses the wheel's two-dimensional outline.
  for(const [id,x] of [['front',-.296],['rear',.298]])for(let i=0;i<48;i++)for(const z of [-.0145,.0145]){
    const a=i*Math.PI/24,p=[x+Math.sin(a)*.200,.203+Math.cos(a)*.200,z];
    const positions=new Float32Array([...p,...p,...p]);
    assert.equal(classifyBicycleTriangle(positions,0,1,2),`wheel-${id}`);
  }
});

test('high and low bicycle GLBs retain their source PBR textures and articulated component hierarchy',()=>{
  for(const [quality,document] of Object.entries(assets)){
    assert.equal(document.getRoot().listTextures().length,3,quality);
    const material=document.getRoot().listMaterials()[0];
    assert.ok(material.getBaseColorTexture()?.getImage()?.byteLength>10000);
    assert.ok(material.getNormalTexture()?.getImage()?.byteLength>10000);
    assert.ok(material.getMetallicRoughnessTexture()?.getImage()?.byteLength>10000);
    const steering=node(document,'bicycle-steering'),crank=node(document,'bicycle-crank');
    assert.ok(steering&&crank);
    assert.ok(steering.listChildren().includes(node(document,'bicycle-wheel-front')));
    for(const side of ['left','right']){
      assert.ok(crank.listChildren().includes(node(document,`bicycle-pedal-${side}`)));
      assert.ok(node(document,`bicycle-pedal-${side}`).listChildren().includes(node(document,`bicycle-pedal-contact-${side}`)));
      assert.ok(steering.listChildren().includes(node(document,`bicycle-grip-${side}`)));
    }
    assert.equal(document.getRoot().listMeshes().length,11);
    assert.ok(manifest.variants[quality].bytes<2500000,'On-demand runtime file must stay well below the 44 MB source.');
  }
});

test('lower brake/drop tips follow the handlebar while the inner fork and nearby tire remain separate',()=>{
  const classify=p=>classifyBicycleTriangle(new Float32Array([...p,...p,...p]),0,1,2);
  // Actual source lower-drop tip is below the old .470 stem-height split.
  for(const z of [-.12,.12])assert.equal(classify([-.23,.455,z]),'handlebar');
  // The adjacent head/fork tube must not be swept backwards with the grips.
  for(const z of [-.038,.038])assert.equal(classify([-.23,.455,z]),'fork');
  assert.equal(classify([-.296,.403,.0145]),'wheel-front');
  assert.equal(classify([-.23,.430,.060]),'fork');
});

test('both exported wheel meshes retain complete tire angular coverage and original spoke surfaces',()=>{
  const bins=48;
  for(const [quality,document] of Object.entries(assets))for(const end of ['front','rear']){
    const wheel=node(document,`bicycle-wheel-${end}`),center=worldPosition(wheel),outer=new Set(),spokes=new Set();
    const geometry=node(document,`bicycle-wheel-${end}-geometry`),matrix=geometry.getWorldMatrix();
    for(const primitive of geometry.getMesh().listPrimitives()){
      const positions=primitive.getAttribute('POSITION'),indices=primitive.getIndices().getArray();
      const vertex=i=>transform(matrix,positions.getElement(i,[]));
      const add=(set,p)=>set.add((Math.floor((Math.atan2(p[1]-center[1],p[2]-center[2])+Math.PI)/(2*Math.PI)*bins)+bins)%bins);
      for(let i=0;i<positions.getCount();i++){
        const p=vertex(i),r=Math.hypot(p[1]-center[1],p[2]-center[2]);
        if(r>BICYCLE_RIG.wheelRadius*.91&&r<BICYCLE_RIG.wheelRadius*1.06)add(outer,p);
      }
      for(let i=0;i<indices.length;i+=3){
        const points=[vertex(indices[i]),vertex(indices[i+1]),vertex(indices[i+2])],p=[0,1,2].map(k=>points.reduce((sum,v)=>sum+v[k],0)/3),r=Math.hypot(p[1]-center[1],p[2]-center[2]);
        if(r>BICYCLE_RIG.wheelRadius*.28&&r<BICYCLE_RIG.wheelRadius*.72)add(spokes,p);
      }
    }
    assert.equal(outer.size,bins,`${quality} ${end} must not contain a missing tire wedge`);
    assert.ok(spokes.size>=12,`${quality} ${end} retains separated imported spoke surfaces (${spokes.size} sectors)`);
  }
});

test('quality variants share exact saddle, grips, wheel axles and opposing pedal contact anchors',()=>{
  const names=['bicycle-saddle-top','bicycle-grip-left','bicycle-grip-right','bicycle-crank','bicycle-pedal-contact-left','bicycle-pedal-contact-right','bicycle-wheel-front','bicycle-wheel-rear'];
  for(const name of names)close(worldPosition(node(assets.high,name)),worldPosition(node(assets.low,name)));
  close(worldPosition(node(assets.high,'bicycle-saddle-top')),BICYCLE_RIG.saddleTop);
  close(worldPosition(node(assets.high,'bicycle-grip-left')),BICYCLE_RIG.grips.left);
  close(worldPosition(node(assets.high,'bicycle-grip-right')),BICYCLE_RIG.grips.right);
  const left=worldPosition(node(assets.high,'bicycle-pedal-contact-left')),right=worldPosition(node(assets.high,'bicycle-pedal-contact-right'));
  assert.equal(left[0],-.145);assert.equal(right[0],.145);
  close(left.map((v,i)=>(v+right[i])/2),[0,.44,.04]);
  assert.ok(left[2]<.04&&right[2]>.04,'Pedals start opposite, correcting the source model.');
});
