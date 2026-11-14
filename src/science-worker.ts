import {computeReturnMap,fastestRoundTrip,routeSensitivity,SENSITIVITY_DEFAULTS} from './return-feasibility';
import type {Exclusion,Point,Route,Settings,Terrain} from './planner';
import type {SensitivityConfig} from './return-feasibility';
self.onmessage=(event:MessageEvent<{terrain:Terrain;base:Point;target:Point;settings:Settings;exclusion:Exclusion|null;route:Route|null;config:SensitivityConfig}>)=>{
 try{const {terrain:t,base,target,settings:s,exclusion:e,route,config}=event.data,map=computeReturnMap(t,base,s,e),other=computeReturnMap(t,base,{...s,mobilityModel:s.mobilityModel===2?1:2},e);let gained=0,lost=0,commonKnown=0;
 for(let i=0;i<map.state.length;i++)if(map.state[i]&&other.state[i]){commonKnown++;if(map.state[i]===2&&other.state[i]!==2)gained++;if(other.state[i]===2&&map.state[i]!==2)lost++;}
 self.postMessage({map,comparison:{otherFeasible:other.counts.feasible,gained,lost,commonKnown},fastest:fastestRoundTrip(t,map,base,target),sensitivity:route?routeSensitivity(t,route,s,e,config??SENSITIVITY_DEFAULTS):null});
 }catch(error){self.postMessage({error:error instanceof Error?error.message:'Scientific calculation failed.'});}
};
