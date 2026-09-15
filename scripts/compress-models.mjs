import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {meshopt} from '@gltf-transform/functions';
import {MeshoptEncoder,MeshoptDecoder} from 'meshoptimizer';
import {readdir,stat,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
await MeshoptEncoder.ready;await MeshoptDecoder.ready;
const dir=fileURLToPath(new URL('../static/models/',import.meta.url));
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const report=[];
for(const name of (await readdir(dir)).filter(n=>n.endsWith('.glb'))){const path=dir+name,before=(await stat(path)).size,doc=await io.read(path);await doc.transform(meshopt({encoder:MeshoptEncoder,level:'medium'}));await io.write(path,doc);report.push({name,before,after:(await stat(path)).size});}
await writeFile(dir+'compression.json',JSON.stringify(report,null,2)+'\n');console.log(report);
