import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const esbuild=createRequire(require.resolve('vite/package.json'))('esbuild');
const mode=process.argv[2]??'protocol';
const file=['protocol','seal','preflight'].includes(mode)?'freeze_reactive_v16':'evaluate_reactive_v16';
const result=await esbuild.build({entryPoints:['scripts/'+file+'.ts'],bundle:true,platform:'node',format:'esm',write:false,logLevel:'warning'});
process.argv=[process.argv[0],process.argv[1],mode,...process.argv.slice(3)];
await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].contents).toString('base64'));
