import {dockLocal} from './dock.js';

// Only an authored single-floor interior opts into a roof cutaway. The upper
// tower is scenery: retaining its faint silhouette must not hide the exhibit.
export function campusInteriorAt(island,layout,position){
 if(!island||!layout?.interiors?.length)return null;
 const p=dockLocal(position,island);
 return layout.interiors.find(({bounds:b,floorY})=>Math.abs(p.x-b.x)<b.width/2&&Math.abs(p.z-b.z)<b.depth/2&&Math.abs(position.y-floorY)<1.5)??null;
}
export function isDuanUpperOccluder(object){
 for(let node=object;node;node=node.parent){
  if(/^occluder_campus_duan_(podium_roof|lower|middle|upper|crown|terraces)$/.test(node.name))return true;
 }
 return false;
}
