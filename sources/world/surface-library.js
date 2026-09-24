import * as THREE from 'three';
import {KTX2Loader} from 'three/addons/loaders/KTX2Loader.js';

const ROOT = '/textures/v5';
export const SURFACE_PROFILES = Object.freeze({
  wood: {normalScale: .55, ao: .35},
  canvas: {normalScale: .38, ao: .18},
  leather: {normalScale: .42, ao: .2},
  stone: {normalScale: .65, ao: .32},
  sand: {normalScale: .35, ao: .18},
  rope: {normalScale: .65, ao: .35},
  hair: {normalScale: .55, ao: .0},
});
const MATERIAL_SURFACES = Object.freeze({
  teak: 'wood', cognac: 'leather', upholstery: 'leather',
  wood: 'wood', darkWood: 'wood', stone: 'stone', sand: 'sand', sandEdge: 'sand',
  Jack_CreamCanvas: 'canvas', Jack_NavyKnit: 'canvas',
  Jack_SweptHair: 'hair',
  v5_dock_wood: 'wood', v5_rope: 'rope', v5_stone: 'stone', v5_sand: 'sand',
  v5_dock_darkwood: 'wood', v5_wetsand: 'sand',
  v5_dockWood: 'wood', v5_teak: 'wood', v5_canvas: 'canvas',
});
const MAP_KEYS = ['map', 'normalMap', 'aoMap', 'roughnessMap', 'metalnessMap'];
export const surfaceForMaterial = name => MATERIAL_SURFACES[name] || null;
const qualityName = quality => quality === 'low' ? 'low' : 'high';
const disposeMaps = surfaces => {
  const unique = new Set();
  for (const maps of surfaces.values()) for (const texture of Object.values(maps)) if (texture?.isTexture) unique.add(texture);
  for (const texture of unique) texture.dispose();
};

/** Owns shared texture packs, never the caller's geometry or source materials.
 * bind BEFORE other controllers cache materials; material clones stay stable
 * during quality changes, allowing liveries to continue updating their colors.
 * Instantiate after renderer.init(), load after the scene can already be used.
 */
export class SurfaceLibrary {
  constructor({renderer, quality = 'high', loader, fetchManifest} = {}) {
    this.renderer = renderer;
    this.quality = qualityName(quality);
    this.loader = loader || new KTX2Loader().setTranscoderPath(`${ROOT}/basis/`).setWorkerLimit(2);
    if (!loader && renderer) this.loader.detectSupport(renderer);
    this.fetchManifest = fetchManifest || (() => fetch(`${ROOT}/manifest.json`).then(response => {
      if (!response.ok) throw new Error(`Surface manifest ${response.status}`);
      return response.json();
    }));
    this.models = new Map();
    this.surfaces = new Map();
    this.requests = new Set();
    this.epoch = 0;
    this.failures = [];
    this.status = 'base';
    this.disposed = false;
  }

  bind(model, kind = 'world') {
    if (this.disposed || !model) return model;
    if (this.models.has(model)) return model;
    const materials = new Map(), meshes = [];
    model.traverse(mesh => {
      // Basic outlines and non-UV runtime toys must remain untouched.
      if (!mesh.isMesh || !mesh.geometry?.getAttribute('uv')) return;
      const original = mesh.material;
      const mapped = (Array.isArray(original) ? original : [original]).map(source => {
        const profile = surfaceForMaterial(source?.name);
        if (!profile || !source.isMeshStandardMaterial) return source;
        if (profile === 'hair' && !mesh.geometry.getAttribute('uv1')) return source;
        if (!materials.has(source)) {
          const material = source.clone();
          const record = {material, profile, original: source, base: Object.fromEntries(MAP_KEYS.map(key => [key, source[key]])), normalScale: source.normalScale.clone(), ao: source.aoMapIntensity};
          material.userData = {...material.userData, v5Surface: profile};
          materials.set(source, record);
          this.apply(record);
        }
        return materials.get(source).material;
      });
      if (mapped.every((m, index) => m === (Array.isArray(original) ? original[index] : original))) return;
      mesh.material = Array.isArray(original) ? mapped : mapped[0];
      meshes.push({mesh, original});
    });
    this.models.set(model, {kind, materials, meshes});
    return model;
  }

  apply(record) {
    const {material, profile, base} = record, maps = this.surfaces.get(profile);
    for (const key of MAP_KEYS) material[key] = base[key] || null;
    material.normalScale.copy(record.normalScale);
    material.aoMapIntensity = record.ao;
    if (maps) {
      if (maps.color) material.map = maps.color;
      if (maps.normal && !(profile === 'hair' && material.userData.normalSource === 'strand-flow')) material.normalMap = maps.normal;
      if (maps.orm) material.aoMap = material.roughnessMap = material.metalnessMap = maps.orm;
      if (!(profile === 'hair' && material.userData.normalSource === 'strand-flow')) material.normalScale.setScalar(SURFACE_PROFILES[profile].normalScale);
      material.aoMapIntensity = SURFACE_PROFILES[profile].ao;
    }
    material.needsUpdate = true;
  }

  async loadQuality(quality = this.quality) {
    if (this.disposed) return false;
    const target = qualityName(quality);
    if (this.pending?.quality === target) return this.pending.promise;
    if (this.status === 'ready' && this.quality === target) return true;
    const epoch = ++this.epoch;
    this.status = 'loading';
    // FileLoader deduplicates in-flight URLs and KTX2Loader reuses the decoded
    // texture for that buffer. Serialize pack swaps so an obsolete high→low→high
    // request cannot dispose textures owned by the latest request.
    const previousRequests = [...this.requests];
    const promise = Promise.allSettled(previousRequests).then(() => this.loadPack(target, epoch));
    this.requests.add(promise);
    promise.finally(() => this.requests.delete(promise));
    this.pending = {quality: target, promise};
    return promise;
  }

  async loadPack(quality, epoch) {
    if (this.disposed || epoch !== this.epoch) return false;
    const next = new Map(), failures = [];
    try {
      const manifest = this.manifest || await this.fetchManifest();
      this.manifest = manifest;
      const entries = manifest.qualities[quality].surfaces;
      // Parallel families, but one shared loader and two decoding workers.
      await Promise.all(Object.entries(entries).map(async ([profile, maps]) => {
        const loaded = {}, channels = Object.entries(maps);
        const results = await Promise.allSettled(channels.map(async ([channel, entry]) => {
          const texture = await this.loader.loadAsync(entry.url);
          texture.name = `v5:${quality}:${profile}:${channel}`;
          texture.colorSpace = channel === 'color' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
          texture.wrapS = texture.wrapT = entry.wrap === 'clamp' ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
          texture.flipY = false;
          texture.channel = entry.channel || 0;
          const tile = profile === 'sand' ? 20 : profile === 'stone' ? 1.5 : 1;
          texture.repeat.setScalar(tile);
          texture.anisotropy = quality === 'low' ? 2 : 4;
          texture.userData.v5Bytes = entry.bytes;
          loaded[channel] = texture;
        }));
        if (results.some(result => result.status === 'rejected')) {
          for (const texture of Object.values(loaded)) texture.dispose();
          failures.push(profile);
        } else next.set(profile, loaded);
      }));
      if (this.disposed || epoch !== this.epoch) { disposeMaps(next); return false; }
      const previous = this.surfaces;
      this.surfaces = next;
      this.quality = quality;
      this.failures = failures;
      for (const {materials} of this.models.values()) for (const record of materials.values()) this.apply(record);
      disposeMaps(previous);
      this.status = failures.length ? 'partial' : 'ready';
      return true;
    } catch (error) {
      disposeMaps(next);
      if (!this.disposed && epoch === this.epoch) {
        this.status = this.surfaces.size ? 'partial' : 'base';
        this.failures = [error.message];
      }
      return false;
    } finally {
      if (epoch === this.epoch) this.pending = null;
    }
  }

  release(model) {
    const binding = this.models.get(model);
    if (!binding) return;
    for (const {mesh, original} of binding.meshes) mesh.material = original;
    for (const {material} of binding.materials.values()) material.dispose();
    this.models.delete(model);
  }

  stats() {
    const references = Object.fromEntries(Object.keys(SURFACE_PROFILES).map(key => [key, 0]));
    for (const {materials} of this.models.values()) for (const {profile} of materials.values()) references[profile]++;
    const entries = this.manifest?.qualities[this.quality]?.surfaces;
    let textures = 0, transferBytes = 0, actualTextureBytes = 0, worstCaseRGBABytes = 0;
    for (const [profile, maps] of this.surfaces) for (const [channel, texture] of Object.entries(maps)) {
      textures++;
      transferBytes += entries?.[profile]?.[channel]?.bytes || 0;
      worstCaseRGBABytes += Math.floor((entries?.[profile]?.[channel]?.width || 0) ** 2 * 4 * 4 / 3);
      for (const mip of texture.mipmaps || []) actualTextureBytes += mip.data?.byteLength || 0;
    }
    return {status: this.status, quality: this.quality, models: this.models.size, references, textures, transferBytes, actualTextureBytes, worstCaseRGBABytes, failures: [...this.failures]};
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.epoch++;
    for (const model of [...this.models.keys()]) this.release(model);
    disposeMaps(this.surfaces);
    this.surfaces.clear();
    // Finish in-flight decode before terminating the shared workers.
    if (this.requests.size) Promise.allSettled([...this.requests]).then(() => this.loader.dispose());
    else this.loader.dispose();
    this.status = 'disposed';
  }
}
