import {it,expect} from 'vitest';
import {pressureCandidates} from './meda-detection';
it('detects only a sustained causal pressure dip and resets across a recording gap',()=>{
 const a=Array.from({length:40},(_,i)=>({time:i,pressurePa:i<30?750:748}));
 expect(pressureCandidates(a,31)).toHaveLength(0);expect(pressureCandidates(a,32)[0].time).toBe(32);
 const changed=a.map(p=>p.time>32?{...p,pressurePa:0}:p);expect(pressureCandidates(changed,32)).toEqual(pressureCandidates(a,32));
 expect(pressureCandidates(a.filter(p=>p.time!==31),32)).toHaveLength(0);
});
