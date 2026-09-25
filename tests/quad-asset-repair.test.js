import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { Matrix4, Vector3 } from 'three';
import { QUAD_SOURCE_WHEELS } from '../scripts/lib/quad-wheel-geometry.mjs';

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const manifest = JSON.parse(await fs.readFile(new URL('../static/models/quad-bike-manifest.json', import.meta.url), 'utf8'));

test('quad wheel authoring partitions the original asset without discarding any source triangles', () => {
  assert.equal(manifest.version, 2);
  assert.equal(manifest.segmentation.sourceTriangles, 1882496);
  assert.equal(Object.values(manifest.segmentation.partitions).reduce((a, b) => a + b, 0), manifest.segmentation.sourceTriangles);
  assert.match(manifest.sourceSHA256, /^[a-f0-9]{64}$/);
  for (const wheel of QUAD_SOURCE_WHEELS) assert.ok(manifest.segmentation.partitions[wheel.id] > 50000);
});

for (const quality of ['high', 'low']) {
  test(`quad ${quality}: authored complete wheels retain all angular sectors and correct source-space transforms`, async () => {
    const doc = await io.read(fileURLToPath(new URL(`../static/models/${manifest.variants[quality].file}`, import.meta.url)));
    const nodes = doc.getRoot().listNodes();
    const pivots = nodes.filter(n => /^quad-wheel-(front|rear)-(left|right)$/.test(n.getName()));
    assert.equal(pivots.length, 4);
    assert.ok(doc.getRoot().listTextures()[0].getImage().byteLength > 100000);
    for (const wheel of QUAD_SOURCE_WHEELS) {
      const pivot = pivots.find(n => n.getName() === `quad-wheel-${wheel.id}`);
      assert.deepEqual(pivot.getTranslation(), wheel.center);
      assert.deepEqual(pivot.getScale(), [1, 1, 1]);
      const sectors = new Uint32Array(36);
      const min = new Vector3(Infinity, Infinity, Infinity), max = new Vector3(-Infinity, -Infinity, -Infinity);
      let triangles = 0;
      const stack = [...pivot.listChildren()];
      while (stack.length) {
        const node = stack.pop(); stack.push(...node.listChildren());
        if (!node.getMesh()) continue;
        // Includes optimizer-generated local .5 scale and offset: pivots themselves stay unquantized.
        const matrix = new Matrix4().fromArray(node.getWorldMatrix());
        for (const primitive of node.getMesh().listPrimitives()) {
          triangles += primitive.getIndices().getCount() / 3;
          const position = primitive.getAttribute('POSITION');
          for (let i = 0; i < position.getCount(); i++) {
            const world = new Vector3().fromArray(position.getElement(i, [])).applyMatrix4(matrix);
            min.min(world); max.max(world);
            const dy = world.y - wheel.center[1], dz = world.z - wheel.center[2];
            if (Math.hypot(dy, dz) > .13) sectors[Math.floor(((Math.atan2(dy, dz) + Math.PI) / (Math.PI * 2)) * 36) % 36]++;
          }
        }
      }
      assert.ok(triangles > (quality === 'high' ? 3000 : 800), `${wheel.id} retains tread geometry`);
      assert.ok([...sectors].every(count => count > 4), `${wheel.id} has a complete 360-degree tire, not a partial cutout`);
      assert.ok(max.x - min.x > .12 && max.x - min.x < .17, `${wheel.id} full tire width`);
      assert.ok(max.y - min.y > .28 && max.y - min.y < .33, `${wheel.id} full tire diameter`);
      assert.ok(max.z - min.z > .28 && max.z - min.z < .34, `${wheel.id} full tread circumference`);
      assert.ok(min.y >= -.003 && min.y <= .02, `${wheel.id} rests at original ground height`);
    }
  });
}
