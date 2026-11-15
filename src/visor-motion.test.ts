import {describe,expect,it} from 'vitest';
import {smoothMotion,smoothView,stoppedMotion} from './visor-motion';
import {moveOnRover,roverTerrain} from './rover-navigation';
import type {RoverGrid} from './rover-navigation';

function travel(fps:number,diagonal=false,boost=false){
 let v=stoppedMotion(),x=0,y=0;
 for(let i=0;i<fps*2;i++){const s=smoothMotion(v,{forward:1,right:diagonal?1:0},1/fps,.6,boost);v=s.velocity;x+=s.forward;y+=s.right;}
 return {distance:Math.hypot(x,y),velocity:v};
}
describe('Visor locomotion independent of the scientific route model',()=>{
 it('integrates the same travel distance at 30, 60 and 120 FPS',()=>{expect(travel(30).distance).toBeCloseTo(travel(60).distance,10);expect(travel(60).distance).toBeCloseTo(travel(120).distance,10);});
 it('eases acceleration without a faster diagonal or an overshooting speed',()=>{const first=smoothMotion(stoppedMotion(),{forward:1,right:0},1/60,.6);expect(first.velocity.forward).toBeGreaterThan(0);expect(first.velocity.forward).toBeLessThan(.6);expect(travel(60,true).distance).toBeCloseTo(travel(60).distance,10);expect(travel(60).velocity.forward).toBeLessThanOrEqual(.6);});
 it('doubles rehearsal displacement for held Shift without changing the input speed',()=>{expect(travel(60,false,true).distance).toBeCloseTo(2*travel(60).distance,10);});
 it('brakes quickly on release and resets without residual movement',()=>{let v=travel(60).velocity,after=0;for(let i=0;i<30;i++){const step=smoothMotion(v,stoppedMotion(),1/60,.6);after+=step.forward;v=step.velocity;}expect(after).toBeLessThan(.034);expect(v).toEqual(stoppedMotion());expect(smoothMotion(stoppedMotion(),stoppedMotion(),.05,.6).forward).toBe(0);});
 it('preserves swept collision at boost speed and never crosses unobserved cells',()=>{const g:RoverGrid={width:40,height:40,cellSize:.25,origin:[0,0],elevation:Array(1600).fill(0),slope:Array(1600).fill(0),start:{x:1,z:1},target:{x:7,z:7}};for(let y=0;y<40;y++)g.elevation[y*40+20]=null;const t=roverTerrain(g,[]);let p={x:14,y:15},v=stoppedMotion(),blocked=false;for(let i=0;i<180;i++){const step=smoothMotion(v,{forward:1,right:0},1/30,.6,true);v=step.velocity;const moved=moveOnRover(t,p,step.forward,0);p=moved.point;if(moved.reason){blocked=true;v=stoppedMotion();}}expect(blocked).toBe(true);expect(p.x).toBeLessThan(19);});
 it('damps look without overshoot and converges identically across frame rates',()=>{const result=(fps:number)=>{let n=0;for(let i=0;i<fps/2;i++){n=smoothView(n,1,1/fps);expect(n).toBeLessThanOrEqual(1);}return n;};expect(result(30)).toBeCloseTo(result(120),4);});
});
