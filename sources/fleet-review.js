import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const canvas=document.querySelector('canvas'),status=document.querySelector('#status');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const configs=[
 {id:'cruise',file:'cruise',scale:14,yaw:0,y:-.55,length:14},
 {id:'yacht-one',file:'yacht-one',scale:11.22,yaw:0,y:-.72,length:11},
 {id:'yacht-two',file:'yacht-two',scale:11,yaw:Math.PI/2,y:-.4,length:11},
];
const scenes=[];
for(const vessel of configs){
 const gltf=await loader.loadAsync(`/models/fleet/v10/${vessel.file}.glb`),scene=new THREE.Scene();scene.background=new THREE.Color('#334c62');
 scene.add(new THREE.HemisphereLight('#ffeac2','#35445b',2.1));const sun=new THREE.DirectionalLight('#fff1cf',3.2);sun.position.set(-12,24,-14);scene.add(sun);
 const model=gltf.scene;model.scale.setScalar(vessel.scale);model.rotation.y=vessel.yaw;model.position.y=vessel.y;model.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=true;}});scene.add(model);
 const water=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:'#376b78',roughness:.32,metalness:.08}));water.rotation.x=-Math.PI/2;water.position.y=0;scene.add(water);
 const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
 const cameras=[new THREE.PerspectiveCamera(31,1,.1,160),new THREE.PerspectiveCamera(31,1,.1,160),new THREE.PerspectiveCamera(31,1,.1,160)];
 const offsets=[new THREE.Vector3(0,5,-vessel.length*1.65),new THREE.Vector3(-vessel.length*1.05,vessel.length*.85,vessel.length*1.05),new THREE.Vector3(vessel.length*1.65,vessel.length*.45,0)];
 cameras.forEach((camera,i)=>{camera.position.copy(center).add(offsets[i]);camera.lookAt(center.x,Math.max(.2,center.y-.1),center.z);});
 scenes.push({scene,cameras,vessel,size});
}
status.textContent='All three models loaded from the V10 runtime assets.';
function render(){const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);renderer.setScissorTest(true);for(let row=0;row<scenes.length;row++){const s=scenes[row];for(let col=0;col<3;col++){const x=col*w/3,y=h-(row+1)*h/3,camera=s.cameras[col];camera.aspect=(w/3)/(h/3);camera.updateProjectionMatrix();renderer.setViewport(x,y,w/3,h/3);renderer.setScissor(x,y,w/3,h/3);renderer.render(s.scene,camera);}}renderer.setScissorTest(false);}
renderer.setAnimationLoop(render);window.addEventListener('resize',render);
