import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,sep} from 'node:path';

// Compare the deployed photo meshes against the original recorded identities.
// This checks embedded textures as well as geometry: no lossy re-export is allowed.
const source=resolve('public'),output=resolve('dist');
const manifest=JSON.parse(await readFile(resolve(source,'data/drive1004/manifest.json'),'utf8'));
const built=JSON.parse(await readFile(resolve(output,'data/drive1004/manifest.json'),'utf8'));
const assets=manifest.calibratedAssets;
if(assets.length!==66||assets.reduce((n,a)=>n+a.triangles,0)!==1045833)throw Error('Original native photo detail changed.');
if(JSON.stringify(built.calibratedAssets)!==JSON.stringify(assets))throw Error('Native asset metadata or transforms changed during packaging.');
let bytes=0;
for(const asset of assets){
 const paths=[source,output].map(root=>{const p=resolve(root,'.'+asset.url);if(!p.startsWith(root+sep))throw Error('Invalid native asset path.');return p;});
 const [original,deployed]=await Promise.all(paths.map(p=>readFile(p)));
 const digest=b=>createHash('sha256').update(b).digest('hex');
 if(digest(original)!==asset.sha256||digest(deployed)!==asset.sha256||deployed.length!==asset.bytes)throw Error(`Native photo asset changed: ${asset.url}`);
 bytes+=deployed.length;
}
const report={surface:manifest.id,sourceCommit:manifest.sourceCommit,photoAssets:assets.length,triangles:assets.reduce((n,a)=>n+a.triangles,0),bytes,sha256Verified:assets.length,unchangedGeometryTexturesAndTransforms:true,registrationToOrbitalMission:manifest.frame.registrationToOrbitalMission,localSandEvidence:'User-reviewed candidates or explicitly simulated exclusions; no unregistered orbital classification.'};
await writeFile('analysis/native-rover-display.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
