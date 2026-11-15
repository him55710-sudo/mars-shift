import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{build}=createRequire(require.resolve('vite/package.json'))('esbuild');
const r=await build({entryPoints:['scripts/evaluate_sand_rehearsal.ts'],bundle:true,platform:'node',format:'esm',write:false,logLevel:'warning'});
await import('data:text/javascript;base64,'+Buffer.from(r.outputFiles[0].contents).toString('base64'));
