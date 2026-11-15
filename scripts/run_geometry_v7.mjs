import {createRequire} from 'node:module';
const req=createRequire(import.meta.url),{build}=createRequire(req.resolve('vite/package.json'))('esbuild');
const r=await build({entryPoints:['scripts/geometry_v7_extended.ts'],bundle:true,platform:'node',format:'esm',write:false});
await import('data:text/javascript;base64,'+Buffer.from(r.outputFiles[0].contents).toString('base64'));
