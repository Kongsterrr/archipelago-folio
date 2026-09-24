// Rebuild the playable, user-supplied avatar from its locally authored skin.
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup, prune, meshopt} from '@gltf-transform/functions';
import {MeshoptEncoder, MeshoptDecoder} from 'meshoptimizer';

const project = fileURLToPath(new URL('../', import.meta.url));
const source = `${project}assets/source/imported-jack/rig.glb`;
const work = `${project}.asset-build/imported-jack`;
await fs.mkdir(work, {recursive: true});
const baked = `${work}/animated.glb`;
const result = spawnSync(process.execPath, [`${project}scripts/imported-jack-animation.mjs`, source, baked], {stdio: 'inherit'});
if (result.status !== 0) throw new Error('Imported Jack animation bake failed.');
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder});
const doc = await io.read(baked), root = doc.getRoot();
const avatar = root.listNodes().find(node => node.getName() === 'ImportedJack');
avatar.setExtras({...avatar.getExtras(), experimental: false, assetRevision: 'v9-imported-chibi'});
await doc.transform(prune(), dedup(), meshopt({encoder: MeshoptEncoder, level: 'high'}));
const path = `${project}static/models/jack-imported.glb`;
await io.write(path, doc);
const checked = await io.read(path), checkedRoot = checked.getRoot();
const primitives = checkedRoot.listMeshes().flatMap(mesh => mesh.listPrimitives());
const report = JSON.parse(await fs.readFile(baked + '.report.json', 'utf8'));
delete report.input; delete report.output;
const manifest = {
  revision: 'v9-imported-chibi', file: 'jack-imported.glb',
  source: 'User-provided chibi boy 3d model.glb, exported by Tripo',
  processing: 'UV seam welding, decimation, six detached fragment removals, fitted skeleton, corrected weights, original base-color texture, seven locally authored clips',
  bytes: (await fs.stat(path)).size,
  triangles: primitives.reduce((total, p) => total + p.getIndices().getCount() / 3, 0),
  vertices: primitives.reduce((total, p) => total + p.getAttribute('POSITION').getCount(), 0),
  materials: checkedRoot.listMaterials().length, skins: checkedRoot.listSkins().length,
  joints: checkedRoot.listSkins()[0].listJoints().map(node => node.getName()),
  animations: checkedRoot.listAnimations().map(animation => animation.getName()),
  textures: checkedRoot.listTextures().map(texture => ({mimeType: texture.getMimeType(), bytes: texture.getImage().byteLength, sha256: createHash('sha256').update(texture.getImage()).digest('hex')})),
  compression: 'EXT_meshopt_compression', ...report,
};
if (manifest.triangles > 50000 || manifest.materials !== 1 || manifest.skins !== 1 || manifest.animations.length !== 7) throw new Error('Imported character contract failed.');
await fs.writeFile(`${project}static/models/jack-imported.manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({bytes: manifest.bytes, triangles: manifest.triangles, joints: manifest.joints.length, animations: manifest.animations}));
