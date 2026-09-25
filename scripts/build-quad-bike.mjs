// Create high/low runtime assets from the owner's supplied quad-bike GLB.
// Usage: node scripts/build-quad-bike.mjs --input "/path/to/quad bike.glb"
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { authorQuadWheelNodes, QUAD_SOURCE_ANCHORS, QUAD_SOURCE_WHEELS } from './lib/quad-wheel-geometry.mjs';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt, prune, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const input = process.argv.includes('--input') ? path.resolve(process.argv[process.argv.indexOf('--input') + 1]) : '';
if (!input) throw new Error('Pass --input <owner-supplied GLB>.');
await fs.access(input);
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder,
  'meshopt.decoder': MeshoptDecoder,
});
const manifest = {
  version: 2,
  provenance: 'Owner-supplied Tripo GLB, optimized for the Archipelago Folio runtime.',
  coordinateSystem: 'Original Y-up, +Z nose geometry. Runtime turns PI around Y; named wheel pivots remain in original source units.',
  sourceSHA256: createHash('sha256').update(await fs.readFile(input)).digest('hex'),
  wheelRadius: .153,
  wheelPivots: QUAD_SOURCE_WHEELS,
  anchors: QUAD_SOURCE_ANCHORS,
  sourceFile: path.basename(input),
  sourceBytes: (await fs.stat(input)).size,
  variants: {},
};

for (const quality of ['high', 'low']) {
  const document = await io.read(input);
  manifest.segmentation = authorQuadWheelNodes(document);
  const destination = path.join(root, 'static/models', quality === 'low' ? 'low/quad-bike.glb' : 'quad-bike.glb');
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await document.transform(
    weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio: quality === 'high' ? .020 : .005, error: quality === 'high' ? .0015 : .005 }),
    prune(),
    textureCompress({ resize: [quality === 'high' ? 2048 : 1024, quality === 'high' ? 2048 : 1024] }),
    meshopt({ encoder: MeshoptEncoder, level: 'high' }),
  );
  await io.write(destination, document);
  const verified = await io.read(destination);
  const primitives = verified.getRoot().listMeshes().flatMap(mesh => mesh.listPrimitives());
  const triangles = primitives.reduce((sum, primitive) => sum + (primitive.getIndices()?.getCount() || primitive.getAttribute('POSITION').getCount()) / 3, 0);
  const bytes = (await fs.stat(destination)).size;
  const limit = quality === 'high' ? 120000 : 45000;
  if (!triangles || triangles > limit) throw new Error(`Quad bike ${quality} asset has ${triangles} triangles; limit is ${limit}.`);
  if (verified.getRoot().listTextures().length < 1) throw new Error(`Quad bike ${quality} asset lost its source texture.`);
  const wheelNames = verified.getRoot().listNodes().filter(node => /^quad-wheel-(front|rear)-(left|right)$/.test(node.getName())).map(node => node.getName());
  if (wheelNames.length !== 4) throw new Error('Quad asset must retain four authored wheel pivots.');
  manifest.variants[quality] = {
    wheelPivots: wheelNames,
    file: path.relative(path.join(root, 'static/models'), destination),
    bytes,
    triangles,
    vertices: primitives.reduce((sum, primitive) => sum + primitive.getAttribute('POSITION').getCount(), 0),
    textureBytes: verified.getRoot().listTextures().reduce((sum, texture) => sum + (texture.getImage()?.byteLength || 0), 0),
  };
  console.log(`quad bike ${quality}: ${triangles} triangles, ${bytes} bytes`);
}
manifest.totalBytes = Object.values(manifest.variants).reduce((sum, variant) => sum + variant.bytes, 0);
await fs.writeFile(path.join(root, 'static/models/quad-bike-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Quad bike runtime: ${manifest.totalBytes} bytes`);
