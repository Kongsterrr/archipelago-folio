import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {applySunsetMaterials, releaseSunsetMaterials} from '../sources/world/sunset-materials.js';
import {BoatAppearance, LIVERIES, prepareBoatMaterials} from '../sources/world/boat-appearance.js';
import {IslandController} from '../sources/world/island.js';
import {SurfaceLibrary} from '../sources/world/surface-library.js';

const mesh = material => new THREE.Mesh(new THREE.BoxGeometry(), material);
const material = (name, color = '#7c927d') => new THREE.MeshStandardMaterial({name, color});
const load = async name => {
  const bytes = await fs.readFile(new URL(`../static/models/${name}.glb`, import.meta.url));
  return (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
};

test('V6 palette clones are shared within one model, isolated across models, and released once', () => {
  const source = material('wood'), original = source.color.clone(), a = new THREE.Group(), b = new THREE.Group();
  const first = mesh(source), second = mesh(source), other = mesh(source);
  a.add(first, second); b.add(other);
  applySunsetMaterials(a, 'harbor'); applySunsetMaterials(b, 'harbor');
  const assigned = first.material;
  assert.equal(second.material, assigned);
  assert.notEqual(assigned, source);
  assert.notEqual(assigned, other.material);
  assert.ok(source.color.equals(original));
  assert.equal(assigned.name, source.name);
  applySunsetMaterials(a, 'harbor');
  assert.equal(first.material, assigned);
  let disposed = 0, sourceDisposed = 0;
  assigned.addEventListener('dispose', () => disposed++);
  source.addEventListener('dispose', () => sourceDisposed++);
  releaseSunsetMaterials(a); releaseSunsetMaterials(a);
  assert.equal(first.material, source); assert.equal(second.material, source);
  assert.equal(disposed, 1); assert.equal(sourceDisposed, 0);
  assert.notEqual(other.material, source);
  releaseSunsetMaterials(b);
});

test('V6 retains real Jack color, geometry and texture data through repeated surface application', async () => {
  const model = await load('jack'), before = [];
  model.traverse(object => {
    if (object.isMesh) before.push({object, geometry: object.geometry, color: object.geometry.getAttribute('color').array.slice(), material: object.material});
  });
  applySunsetMaterials(model, 'jack');
  for (const {object, geometry, color, material: source} of before) {
    assert.equal(object.geometry, geometry);
    assert.deepEqual(object.geometry.getAttribute('color').array, color);
    assert.ok(object.material.color.equals(source.color));
    assert.equal(object.material.normalMap, source.normalMap);
    assert.equal(object.material.name, source.name);
  }
  assert.equal(model.userData.sunsetMaterials.materialCount, 6);
  releaseSunsetMaterials(model);
});

test('V6 roof recoloring does not recolor a shared animated signal or clue', () => {
  const model = new THREE.Group(), roof = new THREE.Group(), signal = new THREE.Group(), source = material('teal', '#338e8b');
  roof.name = 'occluder_campusRoof'; signal.name = 'anim_signal';
  const roofMesh = mesh(source), signalMesh = mesh(source), clueMesh = mesh(source);
  roof.add(roofMesh); signal.add(signalMesh); model.add(roof, signal, clueMesh);
  applySunsetMaterials(model, 'island:learning');
  assert.equal(roofMesh.material.userData.sunsetMaterial.role, 'roof');
  assert.notEqual(roofMesh.material.color.getHexString(), source.color.getHexString());
  assert.equal(signalMesh.material, source); assert.equal(clueMesh.material, source);
  assert.equal(source.color.getHexString(), '338e8b');
  releaseSunsetMaterials(model);
});

test('V6 lighthouse and greenhouse glass remain transparent through island occlusion binding', () => {
  const model = new THREE.Group(), roof = new THREE.Group(); roof.name = 'occluder_greenhouse';
  const pane = mesh(material('glass')), lantern = mesh(material('sunsetLantern')), window = mesh(material('warmWindow'));
  roof.add(pane); model.add(roof, lantern, window);
  applySunsetMaterials(model, 'visionx');
  const controller = new IslandController({id: 'visionx', x: 0, z: 0}, model);
  controller.bind(model);
  assert.equal(pane.material.opacity, .48);
  assert.equal(pane.material.userData.occlusionBaseOpacity, .48);
  assert.equal(pane.material.depthWrite, false);
  assert.equal(pane.material.transparent, true);
  for (const object of [lantern, window]) {
    assert.ok(object.material.emissiveIntensity > 0);
    assert.ok(object.material.emissive.r > object.material.emissive.b);
  }
  model.traverse(object => assert.equal(Boolean(object.isLight), false));
});

test('V6 palette ownership composes with shared surface binding and restoration', () => {
  const model = new THREE.Group(), source = material('wood'); model.add(mesh(source));
  applySunsetMaterials(model, 'harbor');
  const themed = model.children[0].material, palette = themed.color.clone();
  const library = new SurfaceLibrary({loader: {dispose() {}}, fetchManifest: async () => ({})});
  library.bind(model, 'harbor');
  assert.notEqual(model.children[0].material, themed);
  assert.ok(model.children[0].material.color.equals(palette));
  assert.equal(model.children[0].material.userData.sunsetMaterial.role, 'wood');
  library.release(model);
  assert.equal(model.children[0].material, themed);
  releaseSunsetMaterials(model);
  assert.equal(model.children[0].material, source);
  library.dispose();
});

test('V6 real boat keeps distinct liveries and authored hardware aliases after theme and rebind', async () => {
  const model = await load('boat');
  prepareBoatMaterials(model);
  const prepared = []; model.traverse(object => { if (object.isMesh) prepared.push(object.material); });
  prepareBoatMaterials(model);
  const repeated = []; model.traverse(object => { if (object.isMesh) repeated.push(object.material); });
  assert.deepEqual(repeated, prepared);
  applySunsetMaterials(model, 'boat');
  const settings = {livery: 'marina'}, appearance = new BoatAppearance(settings);
  appearance.bind(model);
  const identities = appearance.moving.map(({source}) => source.slice()), geometries = appearance.moving.map(({geometry}) => geometry);
  assert.ok(identities.length > 0);
  assert.ok(identities.every(source => source.some(Boolean)));
  const paints = new Set();
  for (const livery of LIVERIES) {
    appearance.setLivery(livery.id);
    const paint = appearance.materials.find(item => item.name === 'hullOrange');
    paints.add(paint.color.getHexString());
    assert.equal(`#${paint.color.getHexString()}`, livery.colors.hullOrange);
    assert.equal(settings.livery, livery.id);
    const glass = appearance.materials.find(item => item.name === 'windshield');
    assert.equal(glass.opacity, .25); assert.equal(glass.depthWrite, false);
  }
  assert.equal(paints.size, 3);
  appearance.bind(model);
  assert.deepEqual(appearance.moving.map(({source}) => source), identities);
  assert.deepEqual(appearance.moving.map(({geometry}) => geometry), geometries);
  appearance.setLivery('marina');
  for (const {geometry, source} of appearance.moving) {
    const colors = geometry.getAttribute('color'), index = source.findIndex(name => LIVERIES[0].colors[name]);
    if (index === -1) continue;
    const expected = new THREE.Color(LIVERIES[0].colors[source[index]]);
    // The shipped moving batches use normalized 8-bit COLOR_0.
    const tolerance = colors.array instanceof Uint8Array ? .5 / 255 + 1e-6 : 1e-6;
    assert.ok(Math.abs(colors.getX(index) - expected.r) < tolerance);
    assert.ok(Math.abs(colors.getY(index) - expected.g) < tolerance);
    assert.ok(Math.abs(colors.getZ(index) - expected.b) < tolerance);
  }
});
