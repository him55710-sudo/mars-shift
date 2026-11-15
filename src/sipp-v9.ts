import type {EncounterGraph} from './encounter-v7';
import type {Point} from './planner';
import {point} from './planner';
import type {TimedPoint} from './hazard-planner';
import type {CircleState} from './dust-devil-geometry';
import {sweptContact} from './dust-devil-geometry';
import {MinHeap} from './return-feasibility';

type Interval={begin:number;end:number;id:number};
type Label={cell:number;interval:Interval;arrival:number;parent:number;depart:number};
export type SippInput={g:EncounterGraph;start:Point;entries:{i:number;ticks:number}[];goal:Point;
  circles:CircleState[];now:number;admissible:(i:number,ticks:number)=>boolean;maxStates?:number};

/** Earliest-arrival labels per safe interval (Phillips & Likhachev 2011).
 * Half-second departure lattice; continuous swept tests on every movement/wait
 * segment. Waiting must be safe throughout. Goal must remain safe to horizon.
 * If goal is unreachable, prefer the reachable safe terminal closest to goal.
 * Bounded implementation, not a global optimum under unknown future motion. */
export function safeIntervalPath({g,start,entries,goal,circles,now,admissible,maxStates=20000}:SippInput){
  const H=circles.length-1,cell=g.terrain.cellSize,cache=new Map<number,Interval[]>();
  const labels:Label[]=[],arrival:number[]=[],parent:number[]=[],departure:number[]=[],heap=new MinHeap();
  const metres=(p:Point)=>({x:p.x*cell,y:p.y*cell});
  const clear=(a:Point,b:Point,begin:number,end:number)=>{
    const A=metres(a),B=metres(b);
    if(begin===end)return Math.hypot(A.x-circles[begin].x,A.y-circles[begin].y)>=circles[begin].radius-1e-9;
    for(let k=begin;k<end;k++){
      const u=(k-begin)/(end-begin),v=(k+1-begin)/(end-begin);
      if(sweptContact({x:A.x+(B.x-A.x)*u,y:A.y+(B.y-A.y)*u},
        {x:A.x+(B.x-A.x)*v,y:A.y+(B.y-A.y)*v},circles[k],circles[k+1],g.tick)>1e-9)return false;
    }
    return true;
  };
  function intervals(i:number){
    const old=cache.get(i);if(old)return old;
    const p=point(g.terrain,i),out:Interval[]=[];let begin=-1;
    for(let k=0;k<=H;k++){
      const safe=clear(p,p,k,k),join=k>0&&clear(p,p,k-1,k);
      if(begin>=0&&(!safe||!join)){out.push({begin,end:k-1,id:labels.length});labels.push({cell:i,interval:out.at(-1)!,arrival:Infinity,parent:-1,depart:0});begin=-1;}
      if(safe&&begin<0)begin=k;
    }
    if(begin>=0){out.push({begin,end:H,id:labels.length});labels.push({cell:i,interval:out.at(-1)!,arrival:Infinity,parent:-1,depart:0});}
    cache.set(i,out);return out;
  }
  function improve(iv:Interval,time:number,prev:number,depart:number){
    if(time<(arrival[iv.id]??Infinity)){arrival[iv.id]=time;parent[iv.id]=prev;departure[iv.id]=depart;heap.push(iv.id,time);}
  }
  // Fractional starts retain the existing edge's remaining time through entries.
  for(const e of entries){if(e.ticks>H)continue;for(const iv of intervals(e.i)){
    for(let dep=Math.max(0,iv.begin-e.ticks);dep<=Math.min(H-e.ticks,iv.end-e.ticks);dep++){
      if(!clear(start,start,0,dep))break;
      const at=dep+e.ticks;if(admissible(e.i,at)&&clear(start,point(g.terrain,e.i),dep,at)){improve(iv,at,-1,dep);break;}
    }
  }}
  let expanded=0,best=-1,bestDistance=Infinity,limited=false;
  while(heap.length){
    const item=heap.pop();if(item.cost!==arrival[item.i])continue;
    if(++expanded>maxStates){limited=true;break;}
    const a=labels[item.i],p=point(g.terrain,a.cell),at=item.cost;
    if(a.interval.end===H&&admissible(a.cell,H)){
      const d=Math.hypot(p.x-goal.x,p.y-goal.y);
      if(d<bestDistance-1e-9||Math.abs(d-bestDistance)<1e-9&&at<arrival[best]){best=item.i;bestDistance=d;}
      if(d<1e-9)break;
    }
    for(const e of g.edges[a.cell])for(const iv of intervals(e.i)){
      const stop=Math.min(a.interval.end,iv.end-e.ticks,H-e.ticks);
      for(let dep=Math.max(at,iv.begin-e.ticks);dep<=stop;dep++){
        const end=dep+e.ticks;if(end>=(arrival[iv.id]??Infinity))break;
        if(admissible(e.i,end)&&admissible(a.cell,dep)&&clear(p,point(g.terrain,e.i),dep,end)){
          improve(iv,end,item.i,dep);break;
        }
      }
    }
  }
  if(best<0)return {path:null,expanded,limited};
  const chain:number[]=[];for(let id=best;id>=0;id=parent[id])chain.push(id);chain.reverse();
  const path:TimedPoint[]=[{...start,time:now}];
  for(const id of chain){
    const dep=now+departure[id]*g.tick;if(dep>path.at(-1)!.time)path.push({...path.at(-1)!,time:dep});
    const q={...point(g.terrain,labels[id].cell),time:now+arrival[id]*g.tick};
    if(q.time>path.at(-1)!.time)path.push(q);
  }
  if(path.at(-1)!.time<now+H*g.tick)path.push({...path.at(-1)!,time:now+H*g.tick});
  return {path,expanded,limited};
}
