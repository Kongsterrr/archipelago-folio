import * as THREE from 'three';

export class Interactable {
 constructor({id,label,position,range=7,run,available=()=>true,object=null}){Object.assign(this,{id,label,position,range,run,available,object});}
 distance(p){return Math.hypot(p.x-this.position.x,p.z-this.position.z);}
 visible(camera){const p=new THREE.Vector3(this.position.x,this.position.y||1.2,this.position.z).project(camera);return p.z>0&&p.z<1&&Math.abs(p.x)<.98&&Math.abs(p.y)<.85;}
 static nearest(list,p,camera){return list.filter(i=>i.available()&&i.distance(p)<=i.range&&i.visible(camera)).sort((a,b)=>a.distance(p)-b.distance(p))[0]||null;}
}
