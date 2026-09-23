import * as THREE from 'three';

// Upgrade reflective hero surfaces before other controllers cache materials.
export function prepareBoatMaterials(model) {
  const shared = new Map();
  model.traverse(object => {
    if (!object.isMesh) return;
    const convert = source => {
      if (!/^(hull|navy$|satinMetal$|windshield$)/.test(source.name) || !source.isMeshStandardMaterial) return source;
      if (source.userData.premiumBoatPrepared) return source;
      if (shared.has(source)) return shared.get(source);
      const material = new THREE.MeshPhysicalMaterial();
      THREE.MeshStandardMaterial.prototype.copy.call(material, source);
      if (/^hull|^navy$/.test(source.name)) { material.clearcoat = .58; material.clearcoatRoughness = .22; material.metalness = 0; }
      if (source.name === 'satinMetal') { material.metalness = 1; material.roughness = .28; }
      if (source.name === 'windshield') {
        material.color.set('#c6dce4'); material.roughness = .1; material.metalness = 0;
        material.ior = 1.45; material.transparent = true; material.opacity = .25; material.depthWrite = false;
      }
      material.userData = {...material.userData, premiumBoatPrepared: true};
      shared.set(source, material);
      return material;
    };
    object.material = Array.isArray(object.material) ? object.material.map(convert) : convert(object.material);
  });
  for (const source of shared.keys()) source.dispose();
  return model;
}

// The fixed golden sun provides warmth. Neutral cream and readable blue/graphite
// paint keep the three liveries distinct under both the sun and violet sky fill.
export const LIVERIES = [
  {id: 'marina', name: 'Marina Blue', description: 'Deep navy · champagne upholstery · warm brass', swatches: ['#214963', '#eee6d6', '#b99b6c'], colors: {hullOrange: '#214963', hullIvory: '#f0e9dd', navy: '#203d53', upholstery: '#eee6d6', cognac: '#b49670', teak: '#b99567', satinMetal: '#b99b6c'}},
  {id: 'sunset', name: 'Sunset Sport', description: 'Coral orange · ivory · brushed metal', swatches: ['#df805a', '#f2eadd', '#b7c3ca'], colors: {hullOrange: '#df805a', hullIvory: '#f2eadd', navy: '#29485f', upholstery: '#efe5d5', cognac: '#c38362', teak: '#c09b6d', satinMetal: '#b7c3ca'}},
  {id: 'graphite', name: 'Graphite Club', description: 'Graphite · cream leather · copper accents', swatches: ['#414b55', '#eae1d3', '#b28a70'], colors: {hullOrange: '#414b55', hullIvory: '#e7e1d7', navy: '#283b4a', upholstery: '#eae1d3', cognac: '#a98264', teak: '#b18e64', satinMetal: '#b28a70'}},
];

export class BoatAppearance {
  constructor(settings) {
    this.settings = settings; this.materials = []; this.nodes = []; this.steer = 0;
    this.movingSources = new WeakMap();
  }

  bind(model) {
    this.model = model;
    const materials = new Set();
    this.nodes = [];
    model.traverse(object => {
      if (object.isMesh) for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
      if (object.name.startsWith('anim_')) this.nodes.push({object, name: object.name, rotation: object.rotation.clone()});
    });
    this.materials = [...materials];
    // The sunset pass may have already recolored a source material. Hardware
    // COLOR_0 still refers to the original authoring palette, so resolve against
    // that palette rather than whichever livery happens to be currently visible.
    this.baseColors = new Map(this.materials.map(material => [material.name,
      material.userData.sunsetMaterial?.sourceColor ? new THREE.Color().fromArray(material.userData.sunsetMaterial.sourceColor) : material.color?.clone(),
    ]));
    this.moving = [];
    model.traverse(object => {
      if (!object.isMesh || object.material.name !== 'movingHardware') return;
      const geometry = object.geometry, attribute = geometry.getAttribute('color');
      if (!attribute) return;
      let source = this.movingSources.get(geometry);
      if (!source) {
        source = [];
        for (let i = 0; i < attribute.count; i++) {
          const color = new THREE.Color(attribute.getX(i), attribute.getY(i), attribute.getZ(i));
          source.push([...this.baseColors].find(([name, base]) => name !== 'movingHardware' && base && Math.abs(base.r - color.r) + Math.abs(base.g - color.g) + Math.abs(base.b - color.b) < .015)?.[0] || null);
        }
        this.movingSources.set(geometry, source);
      }
      this.moving.push({geometry, source});
    });
    this.setLivery(this.settings.livery);
  }

  setLivery(id) {
    const livery = LIVERIES.find(item => item.id === id) || LIVERIES[0];
    this.settings.livery = livery.id;
    for (const {geometry, source} of this.moving || []) {
      const attribute = geometry.getAttribute('color');
      for (let i = 0; i < attribute.count; i++) {
        if (!livery.colors[source[i]]) continue;
        const color = new THREE.Color(livery.colors[source[i]]);
        attribute.setXYZ(i, color.r, color.g, color.b);
      }
      attribute.needsUpdate = true;
    }
    for (const material of this.materials) {
      if (livery.colors[material.name]) material.color.set(livery.colors[material.name]);
      if (/^hull/.test(material.name)) { material.roughness = .31; material.metalness = 0; }
      if (material.name === 'windshield') { material.opacity = .25; material.depthWrite = false; }
    }
    return livery;
  }

  update(dt, input, speed, reduced, frozen) {
    if (!frozen) this.steer = THREE.MathUtils.damp(this.steer, input.steer || 0, 8, dt);
    for (const node of this.nodes) {
      node.object.rotation.copy(node.rotation);
      if (reduced) continue;
      if (node.name === 'anim_engine') node.object.rotation.y -= this.steer * .22;
      else if (node.name.startsWith('anim_gauge')) node.object.rotation.z += Math.min(speed / 18, 1) * 2.5 - 1.25;
    }
  }
}
