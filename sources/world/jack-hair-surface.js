import * as THREE from 'three';
import {createHairNormalData} from './jack-hair-normal.js';

// One shared original strand field; no image request or per-frame allocation.
// Broad locks remain actual geometry, so the silhouette survives at any quality.
let normal;
export function applyJackHairSurface(model) {
  model.traverse(object => {
    if (!object.isMesh || !object.geometry.getAttribute('uv')) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material.name !== 'Jack_SweptHair') continue;
      if (!normal) {
        const {data, width, height} = createHairNormalData();
        normal = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
        normal.name = 'Jack_OriginalFineStrands';
        normal.wrapS = THREE.RepeatWrapping;
        normal.magFilter = THREE.LinearFilter;
        normal.minFilter = THREE.LinearMipmapLinearFilter;
        normal.generateMipmaps = true;
        normal.needsUpdate = true;
      }
      material.normalMap = normal;
      material.normalScale.set(.4, .4);
      material.needsUpdate = true;
    }
  });
}
