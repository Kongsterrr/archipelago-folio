import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {meshopt} from '@gltf-transform/functions';
import {MeshoptEncoder,MeshoptDecoder} from 'meshoptimizer';
import {ISLAND_IDS,DETAIL_PALETTE,createIslandDetails} from './island-details.mjs';
const HERE=fileURLToPath(new URL('../static/models/',import.meta.url));
globalThis.FileReader=class{async readAsArrayBuffer(blob){this.result=await blob.arrayBuffer();this.onloadend?.({target:this});}async readAsDataURL(blob){this.result=`data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`;this.onloadend?.({target:this});}};
await fs.mkdir(path.join(HERE,'details/low'),{recursive:true});
await MeshoptEncoder.ready;await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const baseSource=await fs.readFile(new URL('./build-assets.mjs',import.meta.url),'utf8');
const outlines=Function(`return (${baseSource.match(/const outlines=(\{[\s\S]*?\n\});/)[1]})`)();
function inside(poly,x,z){let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const[a,b]=poly[i],[d,e]=poly[j];if(((b>z)!=(e>z))&&(x<(d-a)*(z-b)/(e-b)+a))c=!c;}return c;}
function boundaryDistance(poly,x,z){let min=Infinity;for(let i=0;i<poly.length;i++){const [ax,az]=poly[i],[bx,bz]=poly[(i+1)%poly.length],dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));min=Math.min(min,Math.hypot(x-(ax+t*dx),z-(az+t*dz)));}return min;}
const manifest={version:3,type:'supplementary-island-overlays',generator:'export-details.mjs',originalAssets:true,source:'island-details.mjs',units:'meters',coordinateSystem:'right-handed, Y up',groundY:.85,palette:DETAIL_PALETTE,models:[],notes:['Overlay origins match corresponding island GLB origins.','All 27 cluster placements are identical between high and low.','Geometry is merged per material and animation owner.','No textures. Meshopt compression required.','anim_detail_chime pivots about local Z. Optional motion: sin(time*1.25)*.07.','Collider-relevant bounds are the high/low union for each cluster.']};
for(const id of ISLAND_IDS)for(const low of[false,true]){
 const root=createIslandDetails(id,{low}),bounds=new THREE.Box3().setFromObject(root),polygon=outlines[id].map(([x,z])=>[x*.85,z*.85]);let triangles=0,drawCalls=0,vertices=0,outsideVertices=0,dockIntrusions=0,minShoreClearance=Infinity,minRailDistance=Infinity;const mats=new Set(),animations=[];
 root.updateMatrixWorld(true);root.traverse(o=>{if(o.name.startsWith('anim_'))animations.push({name:o.name,position:o.position.toArray(),rotation:o.rotation.toArray().slice(0,3),quaternion:o.quaternion.toArray(),...o.userData});if(!o.isMesh)return;drawCalls++;mats.add(o.material.name);triangles+=o.geometry.index?o.geometry.index.count/3:o.geometry.attributes.position.count/3;vertices+=o.geometry.attributes.position.count;const p=new THREE.Vector3();for(let i=0;i<o.geometry.attributes.position.count;i++){p.fromBufferAttribute(o.geometry.attributes.position,i).applyMatrix4(o.matrixWorld);if(!inside(polygon,p.x,p.z))outsideVertices++;minShoreClearance=Math.min(minShoreClearance,boundaryDistance(polygon,p.x,p.z));if(Math.abs(p.x)<1.7&&p.z>7.4)dockIntrusions++;if(id==='amtrak'){for(let j=0;j<360;j++){const a=j*Math.PI/180;minRailDistance=Math.min(minRailDistance,Math.hypot(p.x-8.8*Math.cos(a),p.z-(-1.4+5.8*Math.sin(a))));}}}});
 const rel=`${low?'details/low':'details'}/${id}.glb`,file=path.join(HERE,rel),buffer=await new GLTFExporter().parseAsync(root,{binary:true,onlyVisible:true,trs:true});await fs.writeFile(file,Buffer.from(buffer));const document=await io.read(file);await document.transform(meshopt({encoder:MeshoptEncoder,level:'medium'}));await io.write(file,document);const bytes=(await fs.stat(file)).size;
 const stats={id,lod:low?'low':'high',file:rel,bytes,uncompressedBytes:buffer.byteLength,triangles,vertices,drawCalls,materials:[...mats],bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},clusters:root.userData.clusters,animationNodes:animations,validation:{outsideGrassVertices:outsideVertices,dockIntrusions,minGrassEdgeClearance:minShoreClearance,...(id==='amtrak'?{minTrackCenterlineClearance:minRailDistance}:{}),triangleBudget:low?2500:4000,triangleBudgetPass:triangles<=(low?2500:4000),drawCallBudgetPass:drawCalls<=7,byteBudgetPass:bytes<=40000}};
 manifest.models.push(stats);console.log(JSON.stringify({id,lod:stats.lod,bytes,triangles,drawCalls,bounds:stats.bounds,...stats.validation}));
}
manifest.colliderFootprints=ISLAND_IDS.map(id=>{const versions=manifest.models.filter(m=>m.id===id);return {id,clusters:versions[0].clusters.map((cluster,i)=>({name:cluster.name,min:cluster.bounds.min.map((v,k)=>Math.min(v,versions[1].clusters[i].bounds.min[k])),max:cluster.bounds.max.map((v,k)=>Math.max(v,versions[1].clusters[i].bounds.max[k]))}))};});
manifest.totalBytes=manifest.models.reduce((sum,m)=>sum+m.bytes,0);manifest.totalTriangles=manifest.models.reduce((sum,m)=>sum+m.triangles,0);manifest.validationPass=manifest.models.every(m=>m.validation.outsideGrassVertices===0&&m.validation.dockIntrusions===0&&m.validation.triangleBudgetPass&&m.validation.drawCallBudgetPass&&m.validation.byteBudgetPass);
await fs.writeFile(path.join(HERE,'details/manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({totalBytes:manifest.totalBytes,totalTriangles:manifest.totalTriangles,validationPass:manifest.validationPass}));
