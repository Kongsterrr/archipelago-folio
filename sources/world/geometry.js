import * as THREE from 'three';
export const palette={ivory:'#fff5dd',wood:'#bf865b',woodLight:'#dfb280',navy:'#254f62',orange:'#f28a49',teal:'#56adb1',sand:'#eddaaa',grass:'#8bb86b',yellow:'#f7c65e',pink:'#dc91a2'};
const materials=new Map();
export function material(color,options={}){const value=palette[color]||color,key=value+JSON.stringify(options);if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color:value,roughness:.78,...options}));return materials.get(key);}
export function mesh(parent,geometry,color,position=[0,0,0],options={}){const m=new THREE.Mesh(geometry,typeof color==='object'?color:material(color,options));m.position.set(...position);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
export function box(parent,size,color,position=[0,0,0]){return mesh(parent,new THREE.BoxGeometry(...size),color,position);}
export function cylinder(parent,radius,height,color,position=[0,0,0],segments=10){return mesh(parent,new THREE.CylinderGeometry(radius*.9,radius,height,segments),color,position);}
export function ring(parent,radius,tube,color,position=[0,0,0]){const m=mesh(parent,new THREE.TorusGeometry(radius,tube,5,32),color,position);m.rotation.x=-Math.PI/2;return m;}
export function label(text,{width=256,height=96,color='#fff5dd',background='#254f62',worldWidth=5,fontSize=36}={}){
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const c=canvas.getContext('2d');
 c.fillStyle=background;c.beginPath();c.roundRect(3,3,width-6,height-6,12);c.fill();c.fillStyle=color;c.font=`700 ${fontSize}px sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText(text,width/2,height/2,width-24);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthWrite:false}));sprite.scale.set(worldWidth,worldWidth*height/width,1);return sprite;
}
export function disposeObject(root){root.traverse(o=>{o.geometry?.dispose();if(o.material?.map)o.material.map.dispose();});}
