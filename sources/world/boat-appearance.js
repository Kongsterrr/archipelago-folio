import * as THREE from 'three';
// Upgrade only reflective hero surfaces, before controllers cache materials.
export function prepareBoatMaterials(model){
 const shared=new Map();model.traverse(o=>{if(!o.isMesh)return;const convert=m=>{
  if(!/^(hull|navy$|satinMetal$|windshield$)/.test(m.name)||!m.isMeshStandardMaterial)return m;
  if(shared.has(m))return shared.get(m);
  const p=new THREE.MeshPhysicalMaterial();THREE.MeshStandardMaterial.prototype.copy.call(p,m);
  if(/^hull|^navy$/.test(m.name)){p.clearcoat=.65;p.clearcoatRoughness=.18;p.metalness=0;}
  if(m.name==='satinMetal'){p.metalness=1;p.roughness=.24;}
  if(m.name==='windshield'){p.roughness=.12;p.metalness=0;p.ior=1.45;p.opacity=.32;p.depthWrite=false;}
  shared.set(m,p);return p;
 };o.material=Array.isArray(o.material)?o.material.map(convert):convert(o.material);});
 for(const m of shared.keys())m.dispose();return model;
}
export const LIVERIES=[
 {id:'marina',name:'Marina Blue',description:'Deep navy · champagne upholstery · warm brass',swatches:['#153c58','#fff0d6','#b99056'],colors:{hullOrange:'#183d59',hullIvory:'#fff2dc',navy:'#153448',upholstery:'#f6e8cd',cognac:'#b69264',teak:'#b18a59',satinMetal:'#c2a574'}},
 {id:'sunset',name:'Sunset Sport',description:'Coral orange · ivory · brushed metal',swatches:['#f07844','#fff6e3','#99acb3'],colors:{hullOrange:'#f07844',hullIvory:'#fff6e3',navy:'#213e54',upholstery:'#fff0d8',cognac:'#ce7046',teak:'#bb9464',satinMetal:'#b7c7c9'}},
 {id:'graphite',name:'Graphite Club',description:'Graphite · cream leather · copper accents',swatches:['#30383d','#f5ead8','#b68462'],colors:{hullOrange:'#30383d',hullIvory:'#efe9dc',navy:'#192d35',upholstery:'#f5ead8',cognac:'#ad7957',teak:'#aa8053',satinMetal:'#b68462'}},
];
export class BoatAppearance{
 constructor(settings){this.settings=settings;this.materials=[];this.nodes=[];this.steer=0;}
 bind(model){this.model=model;const mats=new Set();this.nodes=[];model.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])mats.add(m);if(o.name.startsWith('anim_'))this.nodes.push({object:o,name:o.name,rotation:o.rotation.clone()});});this.materials=[...mats];this.baseColors=new Map(this.materials.map(m=>[m.name,m.color?.clone()]));this.moving=[];model.traverse(o=>{if(o.isMesh&&o.material.name==='movingHardware'){const a=o.geometry.getAttribute('color'),source=[];for(let n=0;n<a.count;n++){const c=new THREE.Color(a.getX(n),a.getY(n),a.getZ(n));source.push([...this.baseColors].find(([name,b])=>name!=='movingHardware'&&b&&Math.abs(b.r-c.r)+Math.abs(b.g-c.g)+Math.abs(b.b-c.b)<.015)?.[0]||null);}this.moving.push({geometry:o.geometry,source});}});this.setLivery(this.settings.livery);}
 setLivery(id){const livery=LIVERIES.find(l=>l.id===id)||LIVERIES[0];this.settings.livery=livery.id;for(const {geometry,source}of this.moving||[]){const a=geometry.getAttribute('color');for(let n=0;n<a.count;n++){const key=source[n];if(livery.colors[key]){const c=new THREE.Color(livery.colors[key]);a.setXYZ(n,c.r,c.g,c.b);}}a.needsUpdate=true;}for(const m of this.materials){if(livery.colors[m.name])m.color.set(livery.colors[m.name]);if(/^hull/.test(m.name)){m.roughness=.3;m.metalness=0;}if(m.name==='windshield'){m.opacity=.32;m.depthWrite=false;}}return livery;}
 update(dt,input,speed,reduced,frozen){if(!frozen)this.steer=THREE.MathUtils.damp(this.steer,input.steer||0,8,dt);for(const n of this.nodes){n.object.rotation.copy(n.rotation);if(reduced)continue;if(n.name==='anim_engine')n.object.rotation.y-=this.steer*.22;else if(n.name.startsWith('anim_gauge'))n.object.rotation.z+=Math.min(speed/18,1)*2.5-1.25;}}
}
