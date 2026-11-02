const PAVING_MATERIALS=new Set(['estate_paving','estate_asphalt','campus_paving']);

// These authored surfaces sit only 25mm above grass. At whole-island camera
// distances that gap can quantize to the same depth value. Reserve two depth
// steps for paving without moving geometry or changing camera/shadow clipping.
export function applyPavingDepthBias(material){
 if(!PAVING_MATERIALS.has(material.name))return material;
 material.polygonOffset=true;
 material.polygonOffsetFactor=0;
 material.polygonOffsetUnits=-2;
 return material;
}
