// Install one or more generated car manifests without discarding other bays.
// node scripts/install-garage-assets.mjs /path/to/generated/manifest.json
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export async function installGarageAssets(project, manifests) {
 const target=path.join(project,'static/models'),file=path.join(target,'garage-cars.json');
 let combined;
 try { combined=JSON.parse(await fs.readFile(file,'utf8')); }
 catch(error) { if(error.code!=='ENOENT')throw error;combined={version:2,coordinateSystem:'Meters; Y up, ground Y=0; forward -Z; driver -X.',models:[]}; }
 await fs.mkdir(path.join(target,'low'),{recursive:true});
 for(const manifestPath of manifests){
  const incoming=JSON.parse(await fs.readFile(manifestPath,'utf8'));
  for(const entry of incoming.models){
   for(const variant of Object.values(entry.variants)){
    const destination=path.resolve(target,variant.file);
    if(!destination.startsWith(path.resolve(target)+path.sep))throw Error('Car asset must remain under static/models.');
    await fs.copyFile(path.resolve(path.dirname(manifestPath),variant.file),destination);
   }
   const index=combined.models.findIndex(model=>model.id===entry.id);
   if(index<0)combined.models.push(entry);else combined.models[index]=entry;
  }
 }
 combined.sourceGeometry='Owner-supplied body, cabin, roof, UVs and textures retained. Wheel separation and source-profile rubber corrections are documented per model.';
 await fs.writeFile(file,JSON.stringify(combined,null,2)+'\n');
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const manifests=process.argv.slice(2);if(!manifests.length)throw Error('Provide generated car manifest paths.');
 await installGarageAssets(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),manifests);
}
