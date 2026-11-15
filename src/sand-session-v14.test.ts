import {expect,it} from 'vitest';
import {travelLimit} from './constrained-planner';
import {remainingSandSettings} from './sand-session-v14';

it('keeps the original 37.5 oxygen / 35 battery reserve as the crew advances',()=>{
 for(const spent of [0,10,30,80]){
  const s=remainingSandSettings(spent,150,true),travel=travelLimit(s);
  expect(s.oxygenMinutes*(s.reservePercent/100)).toBeGreaterThanOrEqual(37.5-1e-9);
  expect(s.powerMinutes*(s.reservePercent/100)).toBeGreaterThanOrEqual(35-1e-9);
  // Full mission consumption at the remaining travel limit must preserve
  // the departure reserve, even after many independent replans.
  expect(150-(spent+travel)*1.12).toBeGreaterThanOrEqual(37.5-1e-9);
  expect(140-(spent+travel)*1.06).toBeGreaterThanOrEqual(35-1e-9);
 }
});
it('does not renew time or usable reserves on return after the budget is spent',()=>{
 expect(travelLimit(remainingSandSettings(110,150,true))).toBeLessThanOrEqual(0);
 expect(travelLimit(remainingSandSettings(60,60,true))).toBeLessThanOrEqual(0);
});
