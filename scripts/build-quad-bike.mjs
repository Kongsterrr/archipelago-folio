// Create high/low runtime assets from the owner's supplied quad-bike GLB.
// Usage: node scripts/build-quad-bike.mjs --input "/path/to/quad bike.glb"
import fs from 'node:fs/promises';
import path from 'node:path';
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
  version: 1,
  provenance: 'Owner-supplied Tripo GLB, optimized for the Archipelago Folio runtime.',
  coordinateSystem: 'Y up; local -Z forward; runtime scale and heading are defined by QuadBikeController.',
  sourceFile: path.basename(input),
  sourceBytes: (await fs.stat(input)).size,
  variants: {},
};

for (const quality of ['high', 'low']) {
  const document = await io.read(input);
  const destination = path.join(root, 'static/models', quality === 'low' ? 'low/quad-bike.glb' : 'quad-bike.glb');
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await document.transform(
    weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio: quality === 'high' ? .010 : .0025, error: quality === 'high' ? .0018 : .007 }),
    prune(),
    textureCompress({ resize: [quality === 'high' ? 1024 : 512, quality === 'high' ? 1024 : 512] }),
    meshopt({ encoder: MeshoptEncoder, level: 'high' }),
  );
  await io.write(destination, document);
  const verified = await io.read(destination);
  const primitives = verified.getRoot().listMeshes().flatMap(mesh => mesh.listPrimitives());
  const triangles = primitives.reduce((sum, primitive) => sum + (primitive.getIndices()?.getCount() || primitive.getAttribute('POSITION').getCount()) / 3, 0);
  const bytes = (await fs.stat(destination)).size;
  const limit = quality === 'high' ? 40000 : 11000;
  if (!triangles || triangles > limit) throw new Error(`Quad bike ${quality} asset has ${triangles} triangles; limit is ${limit}.`);
  if (verified.getRoot().listTextures().length < 1) throw new Error(`Quad bike ${quality} asset lost its source texture.`);
  manifest.variants[quality] = {
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
