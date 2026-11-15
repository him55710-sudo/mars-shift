import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {SAND_EN,sandLanguage,sandText} from './sand-language-v15';
it('defaults shared judge links to English and preserves an explicit Korean choice',()=>{
 expect(sandLanguage('?ground=sand')).toBe('en');expect(sandLanguage('?ground=sand&lang=ko')).toBe('ko');expect(sandText('en','이동 보류 · 가능한 왕복 경로 없음')).toBe('HOLD · No feasible round trip');expect(sandText('ko','위험 지도')).toBe('위험 지도');
});
it('provides English for all Korean interface text including warnings and evidence limits',()=>{
 const source=readFileSync(new URL('./SandTrapVisor.tsx',import.meta.url),'utf8');
 const keys=[...source.matchAll(/tx\(['"]([^'"]*[가-힣][^'"]*)['"]\)/g)].map(x=>x[1].trim());
 expect(keys.length).toBeGreaterThan(35);for(const key of keys){expect(SAND_EN[key],key).toBeDefined();expect(sandText('en',key)).not.toMatch(/[가-힣]/);}
 expect(source.match(/>[^<>{}\n]*[가-힣][^<>{}\n]*</g)).toBeNull();
});
