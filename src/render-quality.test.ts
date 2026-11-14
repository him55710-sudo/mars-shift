import {describe,it,expect} from 'vitest';
import {RenderBudget,qualityLimits} from './render-quality';
describe('bounded display adaptation',()=>{
 it('does not sacrifice clarity for initial compilation, hidden tabs or idle gaps',()=>{
  const b=new RenderBudget('auto',2);
  for(let i=0;i<19;i++)b.sample(80,80,true);
  for(let i=0;i<200;i++){b.sample(80,80,false);b.sample(80,500,true);}
  expect(b.ratio).toBe(1.5);
 });
 it('reduces sustained CPU pressure, respects the native-display floor, and recovers',()=>{
  const b=new RenderBudget('auto',2);
  for(let i=0;i<400;i++)b.sample(35,40,true);
  expect(b.ratio).toBe(1);
  for(let i=0;i<650;i++)b.sample(5,16.7,true);
  expect(b.ratio).toBe(1.5);
 });
 it('keeps user-selected modes stable and caps device resolution',()=>{
  for(const mode of ['detail','efficient'] as const){const b=new RenderBudget(mode,3);for(let i=0;i<100;i++)b.sample(90,95,true);expect(b.ratio).toBe(qualityLimits(mode,3).max);}
  expect(qualityLimits('detail',1).max).toBe(1);expect(qualityLimits('efficient',2).shadowSize).toBe(512);
 });
 it('responds to measured GPU pressure even when CPU submission is cheap',()=>{const b=new RenderBudget('auto',2);for(let i=0;i<70;i++)b.sample(4,40,true,34);expect(b.ratio).toBeLessThan(1.5);});
});
