import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {METRIC_EN,metricText} from './metric-language-v15';
it('translates the observed replay including scientific limits without losing Korean',()=>{
 const source=readFileSync(new URL('./MetricVortexReplay.tsx',import.meta.url),'utf8');
 const keys=[...source.matchAll(/tx\(['"]([^'"]*[가-힣][^'"]*)['"]\)/g)].map(x=>x[1].trim());
 expect(keys.length).toBeGreaterThan(35);
 for(const key of keys){expect(METRIC_EN[key],key).toBeDefined();expect(metricText('en',key)).not.toMatch(/[가-힣]/);expect(metricText('ko',key)).toBe(key);}
 expect(source.match(/>[^<>{}\n]*[가-힣][^<>{}\n]*</g)).toBeNull();
});
