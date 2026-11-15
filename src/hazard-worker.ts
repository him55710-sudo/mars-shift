import {makeScenario,trackAt,remainingResources} from './hazard-simulation';
import type {HazardScenario,ScenarioKind,WeatherEvidence} from './hazard-simulation';
import {decideEscape,prepareHazardContext,positionOnPath,HAZARD_DEFAULTS} from './hazard-planner';
import type {HazardContext,HazardConfig,EscapeDecision,HazardModel} from './hazard-planner';
import type {Terrain,Point} from './planner';
import {makeXRFrame} from './hazard-xr';
import {makeLocalScenario,localTrackAt} from './local-dust-simulation';
import type {LocalEvidence} from './local-dust-simulation';
export type HazardCommand={id:number;type:'init';terrain:Terrain;evidence:WeatherEvidence;localEvidence?:LocalEvidence;seed:number;kind:ScenarioKind;model:HazardModel;config?:HazardConfig;q?:number;regionalReturn?:boolean}|{id:number;type:'step'};
let context:HazardContext,scenario:HazardScenario,position:Point,time=0,decision:EscapeDecision,model:HazardModel='MARS SHIFT',config=HAZARD_DEFAULTS,q=.08;
self.onmessage=(event:MessageEvent<HazardCommand>)=>{const command=event.data;
 try{
  if(command.type==='init'){scenario=command.localEvidence?makeLocalScenario(command.terrain,command.localEvidence,command.seed,command.kind):makeScenario(command.terrain,command.evidence,command.seed,command.kind);if(command.regionalReturn)scenario.target={...scenario.base};context=prepareHazardContext(command.terrain,scenario.settings,scenario.base);position={...scenario.start};time=0;model=command.model;config=command.config??HAZARD_DEFAULTS;q=command.q??.08;}
  else {if(!scenario)throw Error('Scenario is not initialized');const next=Math.min(scenario.duration,time+2);if(decision.chosen)position=positionOnPath(decision.chosen.path,next);time=next;}
  const track=config.policy==='local-matched'?localTrackAt(scenario,time,config):trackAt(scenario,time,q,model==='MARS SHIFT'&&config.responsiveTracking),resources=remainingResources(scenario,time);decision=decideEscape(context,position,scenario.target,time,track,resources,model,config);
  self.postMessage({id:command.id,snapshot:{time,position,base:scenario.base,target:scenario.target,settings:scenario.settings,resources,initialResources:scenario.resources,decision,frame:makeXRFrame(context.terrain,position,decision,command.id,config.localizationSigma),done:time>=scenario.duration,catalogEvent:scenario.catalogEvent,scenario:scenario.kind,seed:scenario.seed,model,groundIndex:context.ground.risk[Math.round(position.y)*context.terrain.width+Math.round(position.x)]}});
 }catch(error){self.postMessage({id:command.id,error:error instanceof Error?error.message:String(error)});}
};
