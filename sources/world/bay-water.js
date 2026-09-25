import * as THREE from 'three/webgpu';
import {color,mix,positionWorld,positionLocal,sin,cos,uniform,vec2,vec3,texture,smoothstep,transformNormalToView,cameraPosition} from 'three/tsl';
import {pointInPolygon,pointSegmentDistance} from '../core/dock.js';
import {SUN_DIRECTION,SUNSET} from './sunset-theme.js';

export function shoreDistance(x,z,coasts,reefs=[]){
 let distance=40;const p={x,z};
 for(const coast of coasts){
  if(Math.hypot(x-coast.x,z-coast.z)>coast.radius+40)continue;
  if(pointInPolygon(p,coast.polygon))return 0;
  for(let n=0;n<coast.polygon.length;n++){const a=coast.polygon[n],b=coast.polygon[(n+1)%coast.polygon.length];distance=Math.min(distance,pointSegmentDistance(p,{x:a[0],z:a[1]},{x:b[0],z:b[1]}));}
 }
 for(const reef of reefs)distance=Math.min(distance,Math.max(0,Math.hypot(x-reef.x,z-reef.z)-reef.r));
 return distance;
}
export function coastlineData(islands){return islands.map(i=>({x:i.x,z:i.z,radius:Math.max(...i.shore.map(([x,z])=>Math.hypot(x,z))),polygon:i.shore.map(([x,z])=>[i.x+x*Math.cos(i.rotation)+z*Math.sin(i.rotation),i.z-x*Math.sin(i.rotation)+z*Math.cos(i.rotation)])}));}
function depthTexture(coasts,reefs,center,span,size){
 const data=new Uint8Array(size*size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++)data[y*size+x]=Math.round(Math.min(1,shoreDistance(center.x+(x/(size-1)-.5)*span,center.z+(y/(size-1)-.5)*span,coasts,reefs)/24)*255);
 const t=new THREE.DataTexture(data,size,size,THREE.RedFormat);t.magFilter=t.minFilter=THREE.LinearFilter;t.needsUpdate=true;return t;
}
const hash=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
// Smooth periodic noise keeps the shallows organic. Cell-border textures read as
// a hexagonal floor at the close camera; no cell edges are used for this water.
function seabedTexture(){
 const size=256,data=new Uint8Array(size*size*4);
 const noise=(u,v,cells,seed)=>{
  const x=u*cells,y=v*cells,ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
  const sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
  const at=(dx,dy)=>hash(((ix+dx)%cells)+seed,((iy+dy)%cells)+seed*3);
  const a=at(0,0)*(1-sx)+at(1,0)*sx,b=at(0,1)*(1-sx)+at(1,1)*sx;
  return a*(1-sy)+b*sy;
 };
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size,v=y/size,k=(y*size+x)*4;
  data[k]=Math.round((noise(u,v,8,0)*.72+noise(u,v,16,11)*.28)*255);
  data[k+1]=Math.round((noise(u,v,16,5)*.65+noise(u,v,32,19)*.35)*255);
  data[k+2]=Math.round(noise(u,v,32,31)*255);data[k+3]=255;
 }
 const t=new THREE.DataTexture(data,size,size);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=t.minFilter=THREE.LinearFilter;t.needsUpdate=true;return t;
}
export class BayWater {
 constructor(scene,islands,reefs,settings){
  this.settings=settings;this.time=uniform(0);this.detail=uniform(settings.quality==='low'?.4:1);
  const coasts=coastlineData(islands),harbor=islands.find(i=>i.id==='about')||islands[0];
  this.depth=depthTexture(coasts,reefs,{x:0,z:0},400,512);this.harborDepth=depthTexture(coasts,reefs,harbor,72,256);this.bed=seabedTexture();
  const p=positionWorld,t=this.time,localUV=p.xz.sub(vec2(harbor.x,harbor.z)).div(72).add(.5);
  const localMask=smoothstep(.42,.47,localUV.x.sub(.5).abs().max(localUV.y.sub(.5).abs())).oneMinus();
  const d=mix(texture(this.depth,p.xz.div(400).add(.5)).r,texture(this.harborDepth,localUV).r,localMask).mul(24);
  const shallows=smoothstep(1,22,d).oneMinus(),shore=smoothstep(0,2.5,d).oneMinus();
  const warp=vec2(sin(p.z.mul(.22).add(t.mul(.21))).add(sin(p.x.mul(.13).sub(t.mul(.12))).mul(.45)),cos(p.x.mul(.19).sub(t.mul(.18))).add(sin(p.z.mul(.17).add(t.mul(.1))).mul(.4))).mul(.027);
  const bed=texture(this.bed,p.xz.mul(.031).add(warp));
  const broken=texture(this.bed,p.xz.mul(.067).add(warp.mul(1.7)).add(vec2(t.mul(.002),t.mul(-.0015))));
  // Broad cross-waves establish the sea's shape; the finer opposing ripple only
  // changes reflection. Its vertical displacement remains the established wake
  // height, so hulls and marine-life silhouettes retain their existing waterline.
  const waveA=sin(p.x.mul(.58).add(p.z.mul(.42)).add(t.mul(.48)));
  const waveB=cos(p.z.mul(.77).sub(p.x.mul(.36)).sub(t.mul(.37)));
  const fine=sin(p.x.mul(2.15).sub(p.z.mul(1.55)).add(t.mul(.85))).mul(this.detail);
  const normal=vec3(waveA.mul(.068).add(fine.mul(.013)),1,waveB.mul(.054).sub(fine.mul(.009))).normalize();
  const view=cameraPosition.sub(p).normalize();
  const light=vec3(...SUN_DIRECTION).normalize();
  const halfway=view.add(light).normalize();
  const facing=normal.dot(halfway).max(0);
  const fresnel=view.dot(normal).max(0).oneMinus().pow(3);
  const deep=mix(color(SUNSET.deepWater),color(SUNSET.middleWater),bed.r.mul(.34).add(waveA.mul(.04)).add(.2));
  const stones=smoothstep(.57,.76,bed.r).mul(smoothstep(.40,.67,broken.b));
  const sand=mix(color(SUNSET.shallowWater),color('#287479'),stones.mul(.34));
  let waterColor=mix(deep,sand,shallows.mul(.9));
  waterColor=mix(waterColor,color('#775573'),fresnel.mul(.28));
  // Reflected sunlight uses the same world-space sun as the lighting rig. A
  // bounded rough-water lobe keeps it readable from the authored high camera;
  // cross-wave breakup separates glints so the band never becomes a gold sheet.
  const across=p.x.mul(-SUN_DIRECTION[2]).add(p.z.mul(SUN_DIRECTION[0]));
  const along=p.x.mul(SUN_DIRECTION[0]).add(p.z.mul(SUN_DIRECTION[2]));
  const crest=sin(along.mul(4.8).add(sin(across.mul(.72)).mul(2.1)).add(broken.r.mul(5)).sub(t.mul(.9))).mul(.5).add(.5);
  const crossBreak=sin(across.mul(3.1).add(broken.b.mul(8)).sub(t.mul(.21))).mul(.5).add(.5);
  const sparkle=smoothstep(.82,.985,crest).mul(smoothstep(.43,.74,broken.g)).mul(smoothstep(.24,.66,crossBreak));
  const sunLobe=facing.pow(100).mul(.024).add(facing.pow(220).mul(sparkle).mul(this.detail.mul(.65).add(.35)).mul(1.08));
  const reflectedSun=mix(color(SUNSET.reflection),color('#ff9b45'),.65).mul(sunLobe).mul(smoothstep(.01,.16,view.y)).mul(smoothstep(.25,2,d));
  const foam=shore.mul(sin(d.mul(6).sub(t.mul(.45))).mul(.5).add(.5)).mul(.22).mul(broken.r.mul(.5).add(.6));
  waterColor=mix(waterColor,color(SUNSET.foam),foam);
  // Bound the stock GGX sun response: at this shallow sun angle its default
  // dielectric lobe can cover most of the screen in pale cream. The authored
  // sparse glitter below supplies the readable orange reflection instead.
  const material=new THREE.MeshPhysicalNodeMaterial({roughness:.38,metalness:0,ior:1.333,specularIntensity:.12,envMapIntensity:.055});
  material.colorNode=waterColor;
  // The specular sun supplement stays warm under both WebGPU and WebGL2; it is
  // emitted light reflected off the surface, not a transparent gold overlay.
  material.emissiveNode=reflectedSun;
  material.normalNode=transformNormalToView(normal);
  material.positionNode=positionLocal.add(vec3(0,sin(positionLocal.x.mul(.28).add(t.mul(.6))).mul(sin(positionLocal.z.mul(.32).add(t.mul(.4)))).mul(.045),0));
  this.mesh=new THREE.Mesh(new THREE.PlaneGeometry(900,900,100,100).rotateX(-Math.PI/2),material);this.mesh.position.y=-.14;this.mesh.receiveShadow=true;this.mesh.name='V6_SunsetBay';scene.add(this.mesh);
 }
 update(time){this.time.value=this.settings.reduced?0:time;}
 setQuality(q){this.detail.value=q==='low'?.4:1;this.mesh.material.roughness=q==='low'?.42:.38;}
 dispose(){this.depth.dispose();this.harborDepth.dispose();this.bed.dispose();this.mesh.geometry.dispose();this.mesh.material.dispose();this.mesh.removeFromParent();}
}
