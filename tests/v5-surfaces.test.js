import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {SurfaceLibrary} from '../sources/world/surface-library.js';

const manifest = JSON.parse(await fs.readFile(new URL('../static/textures/v5/manifest.json', import.meta.url), 'utf8'));
const makeLoader = (fail = () => false) => ({
  textures: [], disposed: false,
  async loadAsync(url) {
    if (fail(url)) throw new Error('Expected asset failure');
    const texture = new THREE.Texture();
    texture.url = url; texture.released = 0;
    texture.addEventListener('dispose', () => texture.released++);
    this.textures.push(texture);
    return texture;
  },
  dispose() { this.disposed = true; },
});
const makeLibrary = loader => new SurfaceLibrary({loader, fetchManifest: async () => manifest});
const model = (name = 'teak', uv = true) => {
  const root = new THREE.Group(), material = new THREE.MeshStandardMaterial({name, color: '#b18a59'});
  const geometry = new THREE.BoxGeometry();
  if (!uv) geometry.deleteAttribute('uv');
  root.add(new THREE.Mesh(geometry, material));
  return root;
};

test('V5 shipped KTX2 files have mipmaps and meet transfer/GPU budgets', async () => {
  for (const [quality, pack] of Object.entries(manifest.qualities)) {
    let bytes = 0;
    for (const maps of Object.values(pack.surfaces)) for (const entry of Object.values(maps)) {
      const data = await fs.readFile(new URL(`../static${entry.url}`, import.meta.url));
      assert.deepEqual([...data.subarray(0, 12)], [171,75,84,88,32,50,48,187,13,10,26,10]);
      assert.equal(data.readUInt32LE(20), entry.width);
      assert.equal(data.readUInt32LE(24), entry.height);
      assert.equal(data.readUInt32LE(40), entry.mipLevels);
      assert.ok(entry.width <= (quality === 'high' ? 2048 : 1024));
      assert.equal(data.length, entry.bytes);
      bytes += data.length;
    }
    assert.equal(bytes, pack.bytes);
    assert.ok(bytes + manifest.transcoderBytes < (quality === 'high' ? 8 : 3) * 1024 ** 2);
    assert.ok(pack.worstCaseRGBABytes < (quality === 'high' ? 96 : 32) * 1024 ** 2);
  }
});

test('V5 shared textures preserve source materials and livery color during quality changes', async () => {
  const loader = makeLoader(), library = makeLibrary(loader), a = model(), b = model();
  const source = a.children[0].material, originalColor = source.color.clone();
  library.bind(a, 'boat'); library.bind(b, 'harbor');
  const bound = a.children[0].material;
  assert.notEqual(bound, source);
  assert.equal(bound.map, null);
  await library.loadQuality('high');
  assert.equal(bound.map, b.children[0].material.map);
  assert.equal(library.stats().references.wood, 2);
  assert.equal(bound.map.colorSpace, THREE.SRGBColorSpace);
  assert.equal(bound.normalMap.colorSpace, THREE.NoColorSpace);
  assert.equal(bound.aoMap, bound.roughnessMap);
  assert.equal(bound.map.channel, 0);
  bound.color.set('#aa8053');
  const livery = bound.color.clone(), oldMaps = [...loader.textures];
  await library.loadQuality('low');
  assert.equal(a.children[0].material, bound);
  assert.ok(bound.color.equals(livery));
  assert.ok(source.color.equals(originalColor));
  assert.ok(oldMaps.every(texture => texture.released === 1));
  library.release(a);
  assert.equal(a.children[0].material, source);
  assert.equal(library.stats().references.wood, 1);
  assert.equal(b.children[0].material.map.released, 0);
  library.dispose();
  assert.ok(loader.disposed);
  assert.ok(loader.textures.every(texture => texture.released === 1));
});

test('V5 missing UVs and character outlines never acquire textures', async () => {
  const library = makeLibrary(makeLoader()), a = model('teak', false), b = model('Jack_CreamCanvas');
  b.children[0].material = new THREE.MeshBasicMaterial({name: 'Jack_CreamCanvas'});
  const before = [a.children[0].material, b.children[0].material];
  library.bind(a); library.bind(b);
  await library.loadQuality('high');
  assert.equal(a.children[0].material, before[0]);
  assert.equal(b.children[0].material, before[1]);
  assert.equal(a.children[0].material.map, null);
  library.dispose();
});

test('V5 one broken texture leaves that surface usable with complete base material fallback', async () => {
  const loader = makeLoader(url => url.endsWith('wood-normal.ktx2')), library = makeLibrary(loader), root = model();
  library.bind(root);
  assert.equal(await library.loadQuality('high'), true);
  assert.equal(root.children[0].material.map, null);
  assert.equal(root.children[0].material.normalMap, null);
  assert.equal(library.stats().status, 'partial');
  assert.deepEqual(library.stats().failures, ['wood']);
  assert.ok(loader.textures.filter(texture => texture.url.includes('wood-')).every(texture => texture.released === 1));
  library.dispose();
});

test('V5 superseded quality loads cannot restore old textures after disposal', async () => {
  const loader = makeLoader(), pending = [];
  const directLoad = loader.loadAsync.bind(loader);
  loader.loadAsync = url => new Promise(resolve => pending.push(async () => resolve(await directLoad(url))));
  const library = makeLibrary(loader), root = model();
  library.bind(root);
  const first = library.loadQuality('high');
  await new Promise(setImmediate);
  assert.ok(pending.length > 0, 'first decode has started');
  const second = library.loadQuality('low');
  library.dispose();
  assert.equal(loader.disposed, false, 'do not terminate workers with outstanding decodes');
  await Promise.all(pending.map(resolve => resolve()));
  assert.equal(await first, false); assert.equal(await second, false);
  await Promise.resolve(); await Promise.resolve();
  assert.equal(library.stats().status, 'disposed');
  assert.equal(root.children[0].material.map, null);
  assert.ok(loader.textures.every(texture => texture.released === 1));
  assert.ok(loader.disposed);
});

test('V5 rapid high-low-high switches serialize shared decodes and only install the latest pack', async () => {
  const loader = makeLoader(), pending = [], directLoad = loader.loadAsync.bind(loader);
  loader.loadAsync = url => new Promise(resolve => pending.push(async () => resolve(await directLoad(url))));
  const library = makeLibrary(loader), root = model();
  library.bind(root);
  const first = library.loadQuality('high');
  await new Promise(setImmediate);
  const middle = library.loadQuality('low'), latest = library.loadQuality('high');
  await Promise.all(pending.splice(0).map(resolve => resolve()));
  await new Promise(setImmediate);
  assert.ok(pending.length > 0, 'latest high pack starts after obsolete decode completes');
  await Promise.all(pending.splice(0).map(resolve => resolve()));
  assert.deepEqual(await Promise.all([first, middle, latest]), [false, false, true]);
  assert.equal(library.stats().quality, 'high');
  assert.equal(root.children[0].material.map.released, 0);
  assert.ok(loader.textures.every(texture => !texture.url.includes('/low/')));
  library.dispose();
  assert.ok(loader.textures.every(texture => texture.released === 1));
});

test('V5 manifest failure cannot block base models or content', async () => {
  const library = new SurfaceLibrary({loader: makeLoader(), fetchManifest: async () => { throw new Error('offline'); }}), root = model();
  library.bind(root);
  assert.equal(await library.loadQuality(), false);
  assert.equal(library.stats().status, 'base');
  assert.equal(root.children[0].material.map, null);
  library.dispose();
});

test('V5 baked hair uses unique UV1 without replacing the authored hair color or losing fallback', async () => {
  const data = structuredClone(manifest);
  data.qualities.high.surfaces.hair = {normal: {...data.qualities.high.surfaces.wood.normal, url: '/hair.ktx2', channel: 1, wrap: 'clamp'}};
  const loader = makeLoader(), library = new SurfaceLibrary({loader, fetchManifest: async () => data});
  const root = model('Jack_SweptHair'), mesh = root.children[0];
  mesh.geometry.setAttribute('uv1', mesh.geometry.getAttribute('uv').clone());
  const fallback = new THREE.Texture(), original = mesh.material;
  original.normalMap = fallback;
  library.bind(root, 'jack');
  assert.equal(mesh.material.normalMap, fallback);
  await library.loadQuality('high');
  assert.notEqual(mesh.material.normalMap, fallback);
  assert.equal(mesh.material.normalMap.channel, 1);
  assert.equal(mesh.material.normalMap.wrapS, THREE.ClampToEdgeWrapping);
  assert.equal(mesh.material.map, null);
  assert.ok(mesh.material.color.equals(original.color));
  library.release(root);
  assert.equal(mesh.material.normalMap, fallback);
  library.dispose();
});
