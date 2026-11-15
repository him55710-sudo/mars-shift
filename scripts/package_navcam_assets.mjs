import {readFile,writeFile,access,rm,stat} from 'node:fs/promises';
import {resolve,sep} from 'node:path';

// Preserve all original research inputs in source. Visitors use the calibrated
// native leaves and the separate efficient leaves, so omit superseded atlases.
const output=resolve('dist'),root=resolve(output,'data/drive1004');
const manifestPath=resolve(root,'manifest.json');
const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
if(manifest.calibratedAssets?.length){
  for(const asset of [...manifest.assets,...manifest.calibratedAssets]){
    const target=resolve(output,'.'+asset.url);
    if(!target.startsWith(root+sep))throw Error('Navcam output escaped the static directory.');
    await access(target);
    if((await stat(target)).size!==asset.bytes)throw Error(`Navcam output size mismatch: ${asset.url}`);
  }
  manifest.detailAssets=manifest.calibratedAssets;
  manifest.detailProcessing={...manifest.detailProcessing,bytes:manifest.calibratedProcessing.bytes};
  manifest.buildPackaging={originalAtlases:'Retained in the source repository; superseded by calibrated PDS tiles in this static build.',nativeAssets:'calibratedAssets',efficientAssets:'assets'};
  await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
  for(const name of ['detail-0','detail-1','detail-2','detail-3']){
    const target=resolve(root,name);
    if(!root.startsWith(output+sep)||!target.startsWith(root+sep))throw Error('Unsafe build cleanup target.');
    await rm(target,{recursive:true,force:true});
  }
  console.log('Packaged calibrated Navcam leaves; preserved all source inputs.');
}
