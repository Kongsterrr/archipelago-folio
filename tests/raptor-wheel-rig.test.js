import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const project=process.env.GARAGE_TEST_PROJECT||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const assetRoot=process.env.GARAGE_TEST_ASSETS||path.join(project,'static/models');
const require=createRequire(path.join(project,'package.json'));
const {NodeIO}=require('@gltf-transform/core');
const {ALL_EXTENSIONS}=require('@gltf-transform/extensions');
const {MeshoptDecoder}=require('meshoptimizer');
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
function meshData(node){
 const primitive=node.getMesh().listPrimitives()[0],position=primitive.getAttribute('POSITION'),normal=primitive.getAttribute('NORMAL'),index=primitive.getIndices(),matrix=node.getMatrix(),points=[],normals=[],v=[],n=[];
 for(let i=0;i<position.getCount();i++){position.getElement(i,v);normal.getElement(i,n);points.push([0,1,2].map(a=>matrix[a]*v[0]+matrix[a+4]*v[1]+matrix[a+8]*v[2]+matrix[a+12]));normals.push(n.slice());}
 return {primitive,points,normals,index};
}
function radialSection(points,index,x){
 const segments=[];
 for(let i=0;i<index.getCount();i+=3){const ids=[index.getScalar(i),index.getScalar(i+1),index.getScalar(i+2)],hits=[];for(let e=0;e<3;e++){const a=points[ids[e]],b=points[ids[(e+1)%3]],dx=b[0]-a[0];if(Math.abs(dx)<1e-12)continue;const t=(x-a[0])/dx;if(t>=0&&t<1)hits.push([a[1]+t*(b[1]-a[1]),a[2]+t*(b[2]-a[2])]);}if(hits.length===2)segments.push(hits);}
 const radii=[];
 for(let i=0;i<128;i++){const angle=i*2*Math.PI/128,dy=Math.cos(angle),dz=Math.sin(angle);let radius=-Infinity;for(const [a,b]of segments){const vy=b[0]-a[0],vz=b[1]-a[1],den=dy*vz-dz*vy;if(Math.abs(den)<1e-12)continue;const t=(a[0]*dz-a[1]*dy)/den,r=(a[0]*vz-a[1]*vy)/den;if(t>=0&&t<=1&&r>radius)radius=r;}if(radius>0)radii.push(radius);}
 return radii;
}

// The Raptor keeps its original knobby tread. Unlike the corrected 911 rubber,
// the tread profile is deliberately not a mathematical cylinder.
for (const quality of ['high', 'low']) test(`Raptor ${quality}: four complete source wheels, stable support and retained roof`, async () => {
  const document = await io.read(path.join(assetRoot, quality === 'low' ? 'low' : '', 'car-raptor.glb'));
  const nodes = document.getRoot().listNodes(), find = name => nodes.find(node => node.getName() === name);
  const root = nodes.find(node => node.getExtras().carRig), rig = root.getExtras().carRig;
  assert.equal(rig.id, 'raptor');
  assert.equal(rig.roofRetained, true);
  assert.equal(rig.roofCutawayNode, null);
  assert(!nodes.some(node => node.getName().includes('cutaway')));
  const roof = find('car-roof'), body = find('car-body');
  assert(roof?.getMesh() && body?.getMesh());
  for (const primitive of roof.getMesh().listPrimitives()) assert.equal(primitive.getMaterial().getAlphaMode(), 'OPAQUE');
  assert.deepEqual([...rig.wheelNodes].sort(), ['car-wheel-front-left', 'car-wheel-front-right', 'car-wheel-rear-left', 'car-wheel-rear-right']);
  assert.equal(Object.values(rig.partitionTriangleCounts).reduce((a, b) => a + b, 0), 1906729);
  const fixedMatrices = [body.getWorldMatrix().slice(), roof.getWorldMatrix().slice()];
  let largestLift = 0;
  for (const name of rig.wheelNodes) {
    const wheel = find(name), surface = find(name + '-surface'), pivot = rig.wheelCenters[name];
    assert(wheel && surface);
    assert.equal(wheel.getMesh(), null, 'Unscaled empty rolling pivot must survive meshopt quantization');
    assert.equal(surface.getParentNode(), wheel);
    if (name.includes('front')) assert.equal(wheel.getParentNode().getName(), name.replace('wheel', 'steer'));
    else assert.equal(wheel.getParentNode(), root);
    const matrix = wheel.getWorldMatrix();
    assert(Math.hypot(matrix[12] - pivot[0], matrix[13] - pivot[1], matrix[14] - pivot[2]) < 1e-8);
    const {points, index} = meshData(surface);
    assert(index.getCount() / 3 > (quality === 'high' ? 5000 : 1000), 'Original wheel detail must remain');
    const radius = Math.max(...points.map(point => Math.hypot(point[1], point[2])));
    assert(rig.wheelRadii[name] > .45 && rig.wheelRadii[name] < .47);
    assert(Math.abs(radius - rig.wheelRadii[name]) < .003, 'Actual exported tread radius stays within 3mm of original');
    largestLift = Math.max(largestLift, rig.wheelRadii[name] - pivot[1]);
    for (const x of [-.19, -.17, -.10, 0, .10, .17, .19]) {
      const radii = radialSection(points, index, x);
      assert.equal(radii.length, 128, `${name}: continuous 360° source tire section x=${x}`);
      assert(Math.max(...radii) - Math.min(...radii) < .04, 'No missing arc or body geometry in original tread');
    }
    const untouched = rig.wheelNodes.filter(other => other !== name).map(other => [find(other + '-surface'), find(other + '-surface').getWorldMatrix().slice()]);
    const initialSurface = surface.getWorldMatrix().slice();
    for (let phase = 1; phase <= 24; phase++) {
      const angle = phase * Math.PI / 12;
      wheel.setRotation([Math.sin(angle / 2), 0, 0, Math.cos(angle / 2)]);
      for (const [node, before] of untouched) assert.deepEqual(node.getWorldMatrix(), before, 'Wheel phases must be independent');
      assert.deepEqual(body.getWorldMatrix(), fixedMatrices[0]);
      assert.deepEqual(roof.getWorldMatrix(), fixedMatrices[1]);
      for (const point of points) {
        const y = pivot[1] + point[1] * Math.cos(angle) - point[2] * Math.sin(angle);
        assert(y + rig.stableGroundLift > -.001, 'Static support envelope must clear every tread phase');
      }
    }
    wheel.setRotation([Math.sin(.3), 0, 0, Math.cos(.3)]);
    assert.notDeepEqual(surface.getWorldMatrix(), initialSurface);
    wheel.setRotation([0, 0, 0, 1]);
    if (name.includes('front')) {
      const steer = wheel.getParentNode();
      steer.setRotation([0, Math.sin(.2), 0, Math.cos(.2)]);
      assert.notDeepEqual(surface.getWorldMatrix(), initialSurface);
      assert.deepEqual(body.getWorldMatrix(), fixedMatrices[0]);
      steer.setRotation([0, 0, 0, 1]);
    }
  }
  assert(Math.abs(largestLift - rig.stableGroundLift) < 1e-9);
  assert(rig.dimensions[0] < 3 && rig.dimensions[1] < 2.68 && rig.dimensions[2] <= 5.2);
  for (const texture of document.getRoot().listTextures()) assert.deepEqual(texture.getSize(), quality === 'low' ? [1024, 1024] : [2048, 2048]);
});
