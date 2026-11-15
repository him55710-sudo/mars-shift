/// <reference lib="webworker" />
import {assessField,fieldTerrain,fieldPlan,lowerRiskWaypoint} from './field-navigation';
import type {FieldAssessment,FieldZone} from './field-navigation';
import type {Point,Settings,Terrain} from './planner';
let terrain:Terrain|null=null,assessment:FieldAssessment|null=null;
self.onmessage=(event:MessageEvent)=>{
 const m=event.data;
 try{
  if(m.type==='init'){terrain=m.terrain;assessment=assessField(terrain!);self.postMessage({type:'ready',assessment});return;}
  if(!terrain||!assessment)return;const revision=m.revision,began=performance.now(),prepared=fieldTerrain(terrain,m.zones as FieldZone[]),start=m.start as Point,base=m.base as Point,s=m.settings as Settings;
  if(m.type==='exit'){const proposal=lowerRiskWaypoint(prepared,assessment,start,base,s);self.postMessage({type:'exit',revision,start,...proposal});return;}
  self.postMessage({type:'stage',revision,stage:'constraints'});const plans:Record<string,unknown>={};
  for(const policy of ['shortest','balanced','cautious'] as const){plans[policy]=fieldPlan(prepared,assessment,start,m.target,base,s,policy,m.avoidSand);self.postMessage({type:'stage',revision,stage:policy});}
  self.postMessage({type:'result',revision,plans,elapsedMs:performance.now()-began,start,target:m.target});
 }catch(error){self.postMessage({type:'error',revision:m.revision,message:error instanceof Error?error.message:'Navigation assessment failed.'});}
};
