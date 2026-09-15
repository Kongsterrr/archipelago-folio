import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {copyToDocument, simplifyPrimitive, meshopt, prune, dedup, unpartition} from '@gltf-transform/functions';
import {MeshoptSimplifier,MeshoptEncoder,MeshoptDecoder} from 'meshoptimizer';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const dir=new URL('../static/models/',import.meta.url);const hiManifest=JSON.parse(await fs.readFile(new URL('manifest.json',dir),'utf8'));const buildManifest=JSON.parse(await fs.readFile(new URL('../.asset-build/low-raw/manifest.json',import.meta.url),'utf8'));const hiCompression={models:hiManifest.models.map(m=>({name:m.id,compressedBytes:m.bytes})),totalCompressedBytes:hiManifest.models.reduce((s,m)=>s+m.bytes,0)};
await Promise.all([MeshoptSimplifier.ready,MeshoptEncoder.ready,MeshoptDecoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});await fs.mkdir(new URL('low/',dir),{recursive:true});
function triCount(doc){return doc.getRoot().listNodes().reduce((n,m)=>n+(m.getMesh()?.listPrimitives()||[]).reduce((s,p)=>s+(p.getIndices()?.getCount()||p.getAttribute('POSITION').getCount())/3,0),0);}
function nodeTris(node){let t=0;node.traverse(n=>{for(const p of n.getMesh()?.listPrimitives()||[])t+=(p.getIndices()?.getCount()||p.getAttribute('POSITION').getCount())/3;});return t;}
const manifest={...hiManifest,quality:'low',generator:'build-low-assets.mjs + finalize-low-assets.mjs',compression:'EXT_meshopt_compression',models:[]};const comparisons=[];
for(const hi of hiManifest.models){
  const source=await io.read(fileURLToPath(new URL(hi.file,dir)));const low=hi.id==='boat'?source:await io.read(fileURLToPath(new URL('../.asset-build/low-raw/'+hi.file,import.meta.url)));
  if(hi.id!=='boat'){
    const originals=source.getRoot().listNodes().filter(n=>hi.nodes.some(a=>a.name===n.getName()));
    const copies=copyToDocument(low,source,originals);
    for(const original of originals){const old=low.getRoot().listNodes().find(n=>n.getName()===original.getName()&&n!==copies.get(original));if(!old)throw Error('Missing original animation node');const parent=old.getParentNode();const dead=[];old.traverse(n=>dead.push(n));parent.removeChild(old);for(const n of dead.reverse())n.dispose();parent.addChild(copies.get(original));}
    // Only the explicit static foliage batch is simplified. No text, land, dock or animated group enters this path.
    for(const node of low.getRoot().listNodes())if(node.getName()==='static_leaf')for(const prim of node.getMesh().listPrimitives())simplifyPrimitive(prim,{simplifier:MeshoptSimplifier,ratio:.35,error:.015});
    await low.transform(prune(),dedup());
  }
  const triangles=triCount(low),drawCalls=low.getRoot().listNodes().reduce((s,m)=>s+(m.getMesh()?.listPrimitives().length||0),0);
  for(const original of source.getRoot().listNodes().filter(n=>hi.nodes.some(a=>a.name===n.getName()))){const copied=low.getRoot().listNodes().find(n=>n.getName()===original.getName());if(!copied||nodeTris(copied)!==nodeTris(original)||JSON.stringify(copied.getMatrix())!==JSON.stringify(original.getMatrix()))throw Error('Animation mismatch '+original.getName());}
  await low.transform(unpartition(),meshopt({encoder:MeshoptEncoder,level:'medium'}));const output=new URL('low/'+hi.file,dir);await io.write(fileURLToPath(output),low);const bytes=(await fs.stat(output)).size;
  // Readback validates every named group and all primitive numeric arrays after compression.
  const readback=await io.read(fileURLToPath(output)),names=new Set(readback.getRoot().listNodes().map(n=>n.getName()));for(const n of hi.nodes)if(!names.has(n.name))throw Error('Compressed node lost '+n.name);for(const a of readback.getRoot().listAccessors())for(const v of a.getArray()||[])if(!Number.isFinite(v))throw Error('Invalid number');
  const hiBytes=hiCompression.models.find(m=>m.name===hi.id).compressedBytes;
  comparisons.push({id:hi.id,highTriangles:hi.triangles,lowTriangles:triangles,triangleReductionPercent:+(100*(1-triangles/hi.triangles)).toFixed(1),highCompressedBytes:hiBytes,lowCompressedBytes:bytes,byteReductionPercent:+(100*(1-bytes/hiBytes)).toFixed(1),drawCalls,animatedGeometry:'identical full-quality geometry and base poses',shorePolygon:'identical high-quality polygon',dock:'full geometry retained by builder'});
  const vertices=readback.getRoot().listNodes().reduce((s,n)=>s+(n.getMesh()?.listPrimitives()||[]).reduce((q,p)=>q+p.getAttribute('POSITION').getCount(),0),0);const staticDrawCalls=readback.getRoot().listNodes().filter(n=>n.getName().startsWith('static_')).reduce((s,n)=>s+(n.getMesh()?.listPrimitives().length||0),0);
  manifest.models.push({...hi,vertices,staticDrawCalls,sourceMeshes:buildManifest.models.find(m=>m.id===hi.id).sourceMeshes,quality:hi.id==='boat'?'original':'low',bytes,triangles,drawCalls,highQualityTriangles:hi.triangles,highQualityBytes:hiBytes,triangleReductionPercent:comparisons.at(-1).triangleReductionPercent});
}
manifest.totalBytes=manifest.models.reduce((s,m)=>s+m.bytes,0);manifest.totalTriangles=manifest.models.reduce((s,m)=>s+m.triangles,0);
const report={allChecksPassed:true,highTotalTriangles:hiManifest.totalTriangles,lowTotalTriangles:manifest.totalTriangles,totalTriangleReductionPercent:+(100*(1-manifest.totalTriangles/hiManifest.totalTriangles)).toFixed(1),highTotalBytes:hiCompression.totalCompressedBytes,lowTotalBytes:manifest.totalBytes,totalByteReductionPercent:+(100*(1-manifest.totalBytes/hiCompression.totalCompressedBytes)).toFixed(1),models:comparisons};
await fs.writeFile(new URL('low/manifest.json',dir),JSON.stringify(manifest,null,2)+'\n');await fs.writeFile(new URL('low/comparison.json',dir),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
