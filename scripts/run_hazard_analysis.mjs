import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),viteRequire=createRequire(require.resolve('vite/package.json'));
const {build}=viteRequire('esbuild');
const compiled=await build({entryPoints:['scripts/analyze_hazards.ts'],bundle:true,platform:'node',format:'esm',write:false,logLevel:'warning'});
await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].contents).toString('base64'));
