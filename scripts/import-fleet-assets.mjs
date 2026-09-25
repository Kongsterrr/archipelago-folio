// Build compact high/low runtime GLBs from the owner-supplied Tripo models.
// Usage: node scripts/import-fleet-assets.mjs --cruise <file> --yacht-one <file> --yacht-two <file>
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt, prune, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i], process.argv[i + 1]);
const output = path.resolve(args.get('--output') || path.join(root, 'static/models/fleet/v10'));
const sources = [
  { id: 'cruise', option: '--cruise', label: 'Owner-supplied cruise ship', input: args.get('--cruise'), highRatio: .022, lowRatio: .0045 },
  { id: 'yacht-one', option: '--yacht-one', label: 'Owner-supplied luxury yacht 1', input: args.get('--yacht-one'), highRatio: .012, lowRatio: .0025 },
  { id: 'yacht-two', option: '--yacht-two', label: 'Owner-supplied luxury yacht 2', input: args.get('--yacht-two'), highRatio: .022, lowRatio: .0045 },
];
for (const source of sources) {
  if (!source.input) throw new Error(`Missing input for ${source.id}. Pass ${source.option} <file>.`);
  source.input = path.resolve(source.input);
  await fs.access(source.input);
}

await fs.mkdir(path.join(output, 'low'), { recursive: true });
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder,
  'meshopt.decoder': MeshoptDecoder,
});
const manifest = {
  version: 10,
  provenance: 'Three user-provided GLB files, optimized for this portfolio runtime.',
  coordinateSystem: 'Y up; model transforms are applied by AmbientFleet.',
  lods: { high: { maxTexture: 1024 }, low: { maxTexture: 512 } },
  models: [],
};

for (const source of sources) {
  const stat = await fs.stat(source.input);
  const entry = { id: source.id, label: source.label, sourceFile: path.basename(source.input), sourceBytes: stat.size, variants: {} };
  for (const quality of ['high', 'low']) {
    const document = await io.read(source.input);
    const ratio = quality === 'high' ? source.highRatio : source.lowRatio;
    const maxTexture = quality === 'high' ? 1024 : 512;
    const destination = path.join(output, quality === 'low' ? 'low' : '', `${source.id}.glb`);
    await document.transform(
      weld(),
      simplify({ simplifier: MeshoptSimplifier, ratio, error: quality === 'high' ? .002 : .006 }),
      prune(),
      textureCompress({ resize: [maxTexture, maxTexture] }),
      meshopt({ encoder: MeshoptEncoder, level: 'high' }),
    );
    await io.write(destination, document);
    const verified = await io.read(destination);
    const primitives = verified.getRoot().listMeshes().flatMap(mesh => mesh.listPrimitives());
    const triangles = primitives.reduce((count, primitive) => count + (primitive.getIndices()?.getCount() || primitive.getAttribute('POSITION').getCount()) / 3, 0);
    const bytes = (await fs.stat(destination)).size;
    const maxTriangles = quality === 'high' ? 30000 : 7000;
    if (!triangles || triangles > maxTriangles) throw new Error(`${source.id}/${quality} has ${triangles} triangles; limit is ${maxTriangles}.`);
    if (verified.getRoot().listTextures().length < 1) throw new Error(`${source.id}/${quality} lost its source textures.`);
    entry.variants[quality] = {
      file: path.relative(output, destination), bytes, triangles,
      vertices: primitives.reduce((count, primitive) => count + primitive.getAttribute('POSITION').getCount(), 0),
      textureSizes: verified.getRoot().listTextures().map(texture => ({
        name: texture.getName(), mimeType: texture.getMimeType(), bytes: texture.getImage()?.byteLength || 0,
      })),
    };
    console.log(`${source.id} ${quality}: ${triangles} triangles, ${bytes} bytes`);
  }
  manifest.models.push(entry);
}
manifest.totalBytes = manifest.models.reduce((sum, model) => sum + Object.values(model.variants).reduce((n, variant) => n + variant.bytes, 0), 0);
await fs.writeFile(path.join(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Fleet V10 runtime: ${manifest.totalBytes} bytes in ${output}`);
