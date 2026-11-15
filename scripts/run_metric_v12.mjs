import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{build}=createRequire(require.resolve('vite/package.json'))('esbuild');
import {mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
mkdirSync('.local',{recursive:true});await build({entryPoints:['scripts/analyze_metric_v12.ts'],outfile:'.local/metric-v12.mjs',bundle:true,platform:'node',format:'esm'});
const p=spawnSync(process.execPath,['.local/metric-v12.mjs',...process.argv.slice(2)],{stdio:'inherit'});process.exit(p.status??1);
