import {createRequire} from 'node:module';
const req=createRequire(import.meta.url),{build}=createRequire(req.resolve('vite/package.json'))('esbuild');
const result=await build({entryPoints:['scripts/analyze_storms.ts'],bundle:true,platform:'node',format:'esm',write:false,logLevel:'warning'});
await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].contents).toString('base64'));
