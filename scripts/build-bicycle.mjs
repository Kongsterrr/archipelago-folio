// Usage: node scripts/build-bicycle.mjs --input "/path/to/bicycle+3d+model.glb"
// Component authoring precedes simplification and texture compression. The raw
// 44 MB owner-supplied source is never copied to the public assets directory.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {meshopt,prune,simplify,textureCompress,weld} from '@gltf-transform/functions';
import {MeshoptDecoder,MeshoptEncoder,MeshoptSimplifier} from 'meshoptimizer';
import {authorBicycleNodes,BICYCLE_RIG,BICYCLE_SOURCE} from './lib/bicycle-geometry.mjs';

const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),arg=process.argv.indexOf('--input');
if(arg<0||!process.argv[arg+1])throw new Error('Pass --input <owner-supplied bicycle GLB>.');
const input=path.resolve(process.argv[arg+1]);await fs.access(input);
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready,MeshoptSimplifier.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const raw=await fs.readFile(input),manifest={version:2,provenance:'Owner-supplied Tripo bicycle GLB; imported geometry, colors and all three texture maps retained. Original handlebar shape with measured upper-bar grip contacts; compact frame and short-crank fit for Jack.',sourceFile:path.basename(input),sourceBytes:raw.length,sourceSHA256:createHash('sha256').update(raw).digest('hex'),coordinateSystem:'Y-up, -Z forward, tire contact Y=0. Geometry is already in world units; runtime scale is 1.',rig:BICYCLE_RIG,source:BICYCLE_SOURCE,variants:{}};
for(const quality of ['high','low']){
  const document=await io.read(input);manifest.segmentation=authorBicycleNodes(document);
  await document.transform(weld(),simplify({simplifier:MeshoptSimplifier,ratio:quality==='high'?.035:.012,error:quality==='high'?.006:.018}),prune({keepLeaves:true}),textureCompress({resize:quality==='high'?[2048,2048]:[1024,1024]}),meshopt({encoder:MeshoptEncoder,level:'high'}));
  const destination=path.join(root,'static/models',quality==='low'?'low/bicycle.glb':'bicycle.glb');await fs.mkdir(path.dirname(destination),{recursive:true});await io.write(destination,document);
  const verified=await io.read(destination),primitives=verified.getRoot().listMeshes().flatMap(m=>m.listPrimitives()),triangles=primitives.reduce((sum,p)=>sum+(p.getIndices()?.getCount()||p.getAttribute('POSITION').getCount())/3,0),bytes=(await fs.stat(destination)).size;
  for(const name of ['bicycle-steering','bicycle-wheel-front','bicycle-wheel-rear','bicycle-crank','bicycle-pedal-left','bicycle-pedal-right','bicycle-saddle-top','bicycle-grip-left','bicycle-grip-right','bicycle-pedal-contact-left','bicycle-pedal-contact-right'])if(!verified.getRoot().listNodes().some(n=>n.getName()===name))throw new Error(`Missing required bicycle node: ${name}`);
  if(verified.getRoot().listTextures().length!==3)throw new Error('Bicycle must retain base color, normal and metallic/roughness textures.');
  const bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
  for(const node of verified.getRoot().listNodes())if(node.getMesh()){
    const m=node.getWorldMatrix();for(const primitive of node.getMesh().listPrimitives()){
      const positions=primitive.getAttribute('POSITION');for(let i=0;i<positions.getCount();i++){
        const p=positions.getElement(i,[]),q=[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];
        for(let j=0;j<3;j++){bounds.min[j]=Math.min(bounds.min[j],q[j]);bounds.max[j]=Math.max(bounds.max[j],q[j]);}
      }
    }
  }
  manifest.variants[quality]={file:path.relative(path.join(root,'static/models'),destination),bytes,triangles,vertices:primitives.reduce((s,p)=>s+p.getAttribute('POSITION').getCount(),0),draws:primitives.length,textures:verified.getRoot().listTextures().map(t=>({name:t.getName(),bytes:t.getImage()?.byteLength||0})),bounds};
  console.log(`${quality} bicycle: ${triangles} triangles, ${bytes} bytes`);
}
await fs.writeFile(path.join(root,'static/models/bicycle-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
