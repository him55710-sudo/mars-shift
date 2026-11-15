import {createRequire} from 'node:module';
const req=createRequire(import.meta.url),{build}=createRequire(req.resolve('vite/package.json'))('esbuild');
const compiled=await build({entryPoints:['scripts/analyze_local_dust.ts'],bundle:true,platform:'node',format:'esm',write:false,logLevel:'warning'});
await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].contents).toString('base64'));
