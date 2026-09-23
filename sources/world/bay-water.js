import * as THREE from 'three/webgpu';
import {color,mix,positionWorld,positionLocal,sin,cos,uniform,vec2,vec3,texture,smoothstep,transformNormalToView} from 'three/tsl';
import {pointInPolygon,pointSegmentDistance} from '../core/dock.js';

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
function seabedTexture(){
 const size=256,cells=8,data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const px=x/size*cells,py=y/size*cells,gx=Math.floor(px),gy=Math.floor(py);let first=99,second=99,tint=0;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const ix=gx+dx,iy=gy+dy,hx=(ix+cells)%cells,hy=(iy+cells)%cells;const d=Math.hypot(px-ix-(.15+hash(hx,hy)*.7),py-iy-(.15+hash(hx+57,hy)*.7));if(d<first){second=first;first=d;tint=hash(hx+7,hy+11);}else second=Math.min(second,d);}
  const k=(y*size+x)*4,edge=Math.min(1,(second-first)*9);
  data[k]=Math.round((.42+tint*.36)*255);data[k+1]=Math.round(Math.pow(1-edge,3)*255);data[k+2]=Math.round(Math.min(1,first)*255);data[k+3]=255;
 }
 const t=new THREE.DataTexture(data,size,size);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=t.minFilter=THREE.LinearFilter;t.needsUpdate=true;return t;
}
export class BayWater {
 constructor(scene,islands,reefs,settings){
  this.settings=settings;this.time=uniform(0);this.detail=uniform(settings.quality==='low'?.4:1);
  const coasts=coastlineData(islands),harbor=islands.find(i=>i.id==='harbor');
  this.depth=depthTexture(coasts,reefs,{x:0,z:0},400,512);this.harborDepth=depthTexture(coasts,reefs,harbor,72,256);this.bed=seabedTexture();
  const p=positionWorld,t=this.time,localUV=p.xz.sub(vec2(harbor.x,harbor.z)).div(72).add(.5);
  const localMask=smoothstep(.42,.47,localUV.x.sub(.5).abs().max(localUV.y.sub(.5).abs())).oneMinus();
  const d=mix(texture(this.depth,p.xz.div(400).add(.5)).r,texture(this.harborDepth,localUV).r,localMask).mul(24);
  const shallows=smoothstep(1,22,d).oneMinus(),shore=smoothstep(0,2.5,d).oneMinus();
  const warp=vec2(sin(p.z.mul(.62).add(t.mul(.3))).add(sin(p.x.mul(.27).sub(t.mul(.17))).mul(.45)),cos(p.x.mul(.55).sub(t.mul(.24))).add(sin(p.z.mul(.31).add(t.mul(.13))).mul(.4))).mul(.055);
  const bed=texture(this.bed,p.xz.mul(.15).add(warp));
  const lightA=texture(this.bed,p.xz.mul(.24).add(warp.mul(1.8)).add(vec2(t.mul(.006),t.mul(-.004))));
  // Interference at a second scale/heading breaks the cell edges into isolated
  // moving focuses; a single Voronoi edge map reads as a tiled hexagon floor.
  const lightB=texture(this.bed,vec2(p.x.mul(.11).add(p.z.mul(.19)),p.z.mul(.15).sub(p.x.mul(.13))).sub(warp).add(vec2(t.mul(-.004),t.mul(.003))));
  const light=lightA.g.mul(lightB.g.mul(.8).add(.08)).mul(smoothstep(.38,.70,lightB.r));
  const ripples=sin(p.x.mul(.7).add(p.z.mul(.39)).add(t.mul(.7))).mul(.5).add(.5);
  const deep=mix(color('#034d62'),color('#007f91'),ripples.mul(.12).add(.38));
  const stones=smoothstep(.60,.77,bed.r).mul(smoothstep(.18,.68,bed.b).oneMinus());
  const sand=mix(color('#10b5a2'),color('#08798a'),stones.mul(.62));
  let waterColor=mix(deep,sand,shallows.mul(.8));
  waterColor=waterColor.add(color('#96dcc2').mul(light.mul(shallows).mul(.09).mul(this.detail)));
  const foam=shore.mul(sin(d.mul(6).sub(t.mul(.65))).mul(.5).add(.5)).mul(.23);
  waterColor=mix(waterColor,color('#e0efcf'),foam);
  const material=new THREE.MeshStandardNodeMaterial({roughness:.38,metalness:0,envMapIntensity:.28});
  material.colorNode=waterColor;
  material.normalNode=transformNormalToView(vec3(sin(p.x.mul(1.1).add(p.z.mul(.8)).add(t.mul(.7))).mul(.055),1,cos(p.z.mul(1.25).sub(p.x.mul(.32)).sub(t.mul(.6))).mul(.045)).normalize());
  material.positionNode=positionLocal.add(vec3(0,sin(positionLocal.x.mul(.28).add(t.mul(.6))).mul(sin(positionLocal.z.mul(.32).add(t.mul(.4)))).mul(.045),0));
  this.mesh=new THREE.Mesh(new THREE.PlaneGeometry(900,900,100,100).rotateX(-Math.PI/2),material);this.mesh.position.y=-.14;this.mesh.receiveShadow=true;this.mesh.name='V5_ShallowBay';scene.add(this.mesh);
 }
 update(time){this.time.value=this.settings.reduced?0:time;}
 setQuality(q){this.detail.value=q==='low'?.4:1;this.mesh.material.roughness=q==='low'?.43:.38;}
 dispose(){this.depth.dispose();this.harborDepth.dispose();this.bed.dispose();this.mesh.geometry.dispose();this.mesh.material.dispose();this.mesh.removeFromParent();}
}
