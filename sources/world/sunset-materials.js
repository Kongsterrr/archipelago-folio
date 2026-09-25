import * as THREE from 'three';

// These are restrained surface colors, not a second orange light filter.
// Golden highlights and violet shade belong to the shared Sunset Bay lighting.
const COMMON = Object.freeze({
  sand: '#e8d6b2', sandEdge: '#cdb48c', grass: '#8aa276',
  wood: '#b99168', darkWood: '#79624f', ivory: '#eee7da',
  stone: '#bcb8af', leaf: '#547e5c', glass: '#aecbd2',
  metal: '#a0a7aa', navy: '#304c65', black: '#39434c',
  pink: '#d8a7ac', lilac: '#aba0be', terracotta: '#bb785b', blue: '#728caa',
  rope: '#e2d7bd',
});

export const SUNSET_ISLAND_PALETTES = Object.freeze({
  harbor: Object.freeze({wood: '#bd966b', darkWood: '#816652', ivory: '#f0e8d9', stone: '#c4bbaa', roof: '#b88063'}),
  amtrak: Object.freeze({wood: '#ad805f', darkWood: '#745344', terracotta: '#a76451', metal: '#af8b72', roof: '#a76451'}),
  beaconfire: Object.freeze({wood: '#b18c69', stone: '#b6b5b1', metal: '#9ca8b1', glass: '#aecdd8', blue: '#788ba5', roof: '#788ba5'}),
  visionx: Object.freeze({leaf: '#4c7c59', grass: '#91a67b', terracotta: '#bc7b5b', glass: '#b1d0ce'}),
  affirmation: Object.freeze({pink: '#dfa89c', lilac: '#b5a1bc', ivory: '#f0e4d8', wood: '#bd9b7c', grass: '#98a983'}),
  research: Object.freeze({navy: '#2d4867', blue: '#586f94', stone: '#b3bcc4', glass: '#adccdc', roof: '#586f94'}),
  catering: Object.freeze({terracotta: '#cf9774', ivory: '#f1e6d6', wood: '#b8946d', roof: '#cf9774'}),
  learning: Object.freeze({ivory: '#e9e4db', stone: '#c4beb2', leaf: '#61876c', roof: '#a195b6'}),
  connect: Object.freeze({ivory: '#eee6d9', metal: '#b4947c', darkWood: '#846953', roof: '#ae856e'}),
});

const ALIASES = Object.freeze({
  v5_dock_wood: 'wood', v5_dockWood: 'wood', v5_dock_darkwood: 'darkWood',
  v5_stone: 'stone', v5_sand: 'sand', v5_wetsand: 'sandEdge', v5_foliage: 'leaf', v5_rope: 'rope',
  woodLight: 'wood', trunk: 'darkWood', cream: 'ivory', white: 'ivory',
  grassDark: 'grass', leafLight: 'leaf', stoneLight: 'stone', glassBlue: 'glass', red: 'terracotta',
});
const SIGNALS = new Set(['orange', 'yellow', 'teal']);
const bindings = new WeakMap();

function contextFor(mesh, model) {
  let roof = false, animated = false;
  for (let object = mesh; object; object = object.parent) {
    roof ||= /(?:roof|canopy)/i.test(object.name);
    animated ||= object.name.startsWith('anim_');
    if (object === model) break;
  }
  return animated ? 'animated' : roof ? 'roof' : 'static';
}

function materialPlan(source, kind, context) {
  const name = source.name || '';
  const short = name.replace(/^detail_/, '');
  if (short === 'sunsetLantern') return {role: 'lantern', color: '#f1d4a5', roughness: .45, emissive: '#ffc279', intensity: .65};
  if (short === 'warmWindow') return {role: 'window', color: '#d8c9b5', roughness: .25, emissive: '#ffc98d', intensity: .35};

  if (kind === 'jack') {
    const roughness = {Jack_Skin: .68, Jack_CreamCanvas: .84, Jack_NavyKnit: .88, Jack_SweptHair: .44, Jack_EyesAndDetails: .23, Jack_OrangeDetails: .72}[name];
    // Jack's blush, cloth variation, hair grooves and eye glints live in COLOR_0.
    // Keep its neutral multiplier; painting the material chestnut would tint eyes
    // and eyebrows twice and suppress the authored highlights.
    return roughness === undefined ? null : {role: name, roughness, env: name === 'Jack_EyesAndDetails' ? .95 : .7};
  }

  if (kind === 'boat') {
    // BoatAppearance owns livery colors, including matching animated hardware.
    if (name === 'windshield') return {role: 'windshield', color: '#c6dce4', roughness: .1, metalness: 0, opacity: .25, env: .75};
    if (name === 'teakSeam') return {role: 'teakSeam', color: '#7c6953', roughness: .85};
    if (name === 'rubber') return {role: 'rubber', color: '#333e47', roughness: .84};
    return null;
  }

  if (!SUNSET_ISLAND_PALETTES[kind]) return null;
  const key = ALIASES[short] || short;
  // Signals, puzzle clues and animated devices retain their source colors.
  // A roof sharing teal with a signal can get its own clone without recoloring
  // the actual signal; glass greenhouse roofs retain their cool glass role.
  const palette = SUNSET_ISLAND_PALETTES[kind];
  if (context === 'animated') return null;
  const roof = context === 'roof' && palette.roof && ['terracotta', 'teal', 'blue', 'lilac'].includes(key);
  if (SIGNALS.has(key) && !roof) return null;
  const color = roof ? palette.roof : palette[key] || COMMON[key];
  if (!color) return null;
  const roughness = key === 'glass' ? .27 : key === 'metal' ? .34 : ['wood', 'darkWood', 'rope'].includes(key) ? .8 : .79;
  return {role: roof ? 'roof' : key, color, roughness, metalness: key === 'metal' ? .35 : 0, env: key === 'glass' ? .65 : .7,
    ...(key === 'glass' ? {opacity: .48} : {})};
}

/** Apply once, before SurfaceLibrary.bind / IslandController.bind.
 * kind: 'jack', 'boat', or a physical parent island or legacy district id ('island:id' also accepted).
 * Material names, textures, vertex colors, UVs and signal colors survive.
 * Authored opacity survives except for the explicit glass/windshield treatment.
 * Only material instances are owned here; source materials and geometry are not.
 */
export function applySunsetMaterials(model, kind = model?.userData?.island || 'world') {
  if (!model || bindings.has(model)) return model;
  kind = String(kind).replace(/^(?:island|detail):/, '').toLowerCase();
  const clones = new Map(), replacements = [], roles = new Set();
  model.traverse(mesh => {
    if (!mesh.isMesh) return;
    const original = mesh.material, list = Array.isArray(original) ? original : [original];
    const context = contextFor(mesh, model);
    let paletteKind=({about:'harbor',experience:'amtrak',projects:'affirmation',education:'learning'})[kind]||kind;
    for(let branch=mesh;branch&&branch!==model;branch=branch.parent)if(branch.name.startsWith('district_')){paletteKind=branch.name.slice(9);break;}
    const assigned = list.map(source => {
      if (!source?.isMeshStandardMaterial) return source;
      const plan = materialPlan(source, paletteKind, context);
      if (!plan) return source;
      let variations = clones.get(source);
      if (!variations) clones.set(source, variations = new Map());
      const signature = JSON.stringify(plan);
      if (!variations.has(signature)) {
        const material = source.clone();
        const base = source.userData?.sunsetMaterial?.sourceColor || source.color.toArray();
        material.color.fromArray(base);
        // Unknown multicolor batches must not be flattened by a palette override.
        if (plan.color && !material.vertexColors) material.color.set(plan.color);
        material.roughness = plan.roughness;
        if (plan.metalness !== undefined) material.metalness = plan.metalness;
        if (plan.env !== undefined) material.envMapIntensity = plan.env;
        if (plan.opacity !== undefined) { material.transparent = true; material.opacity = plan.opacity; material.depthWrite = false; }
        if (plan.emissive) { material.emissive.set(plan.emissive); material.emissiveIntensity = plan.intensity; }
        material.userData = {...material.userData, sunsetMaterial: {version: 6, kind, role: plan.role, sourceColor: [...base]}};
        variations.set(signature, material); roles.add(plan.role);
      }
      return variations.get(signature);
    });
    if (assigned.every((material, i) => material === list[i])) return;
    mesh.material = Array.isArray(original) ? assigned : assigned[0];
    replacements.push({mesh, original, assigned: mesh.material});
  });
  const materials = [...clones.values()].flatMap(variations => [...variations.values()]);
  bindings.set(model, {materials, replacements});
  model.userData.sunsetMaterials = {version: 6, kind, materialCount: materials.length, roles: [...roles]};
  return model;
}

/** Call after SurfaceLibrary.release when unloading the model. */
export function releaseSunsetMaterials(model) {
  const binding = bindings.get(model);
  if (!binding) return;
  for (const {mesh, original, assigned} of binding.replacements) if (mesh.material === assigned) mesh.material = original;
  for (const material of binding.materials) material.dispose();
  bindings.delete(model);
  delete model.userData.sunsetMaterials;
}
