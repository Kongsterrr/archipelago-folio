// Keep the authored render mode until an occluder actually fades. Fully opaque
// architecture must stay in the opaque pass, including when it casts shadows.
export function rememberOcclusionMaterial(material){
 const base=material.userData;
 base.occlusionBaseOpacity??=material.opacity;
 base.occlusionBaseDepthWrite??=material.depthWrite;
 base.occlusionBaseTransparent??=material.transparent;
 return material;
}

export function setOcclusionOpacity(material,factor=1){
 rememberOcclusionMaterial(material);
 const base=material.userData,faded=factor<1,transparent=faded||base.occlusionBaseTransparent;
 material.opacity=base.occlusionBaseOpacity*factor;
 material.depthWrite=faded?false:base.occlusionBaseDepthWrite;
 if(material.transparent!==transparent){material.transparent=transparent;material.needsUpdate=true;}
 return material;
}
