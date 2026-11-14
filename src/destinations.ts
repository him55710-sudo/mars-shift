import type {RegionId} from './regions';
import {DEFAULTS,nearestAllowed} from './planner';
import type {Point,Terrain} from './planner';
export const SCIENCE_GOALS=[
 {id:'texture',name:'Surface texture transect',short:'Texture transect',purpose:'Compare textured and smoother surfaces, photograph context, and return to the habitat.',point:{x:153,y:43},label:'Surface comparison'},
 {id:'relief',name:'Relief survey',short:'Relief survey',purpose:'Survey elevation changes and inspect exposed terrain from a reachable observation point.',point:{x:58,y:49},label:'Topographic study'},
 {id:'nearby',name:'Near-field observation',short:'Near-field survey',purpose:'Make a shorter surface observation, inspect optical candidates and preserve a return margin.',point:{x:110,y:143},label:'Shorter traverse'}
] as const;
export type DestinationIntent={id:number;region:RegionId;goal:string};
export function destinationFor(t:Terrain,id:string):{target:Point;targetName:string;purpose:string}{const g=SCIENCE_GOALS.find(g=>g.id===id)??SCIENCE_GOALS[0];return {target:nearestAllowed(t,g.point,DEFAULTS),targetName:g.name,purpose:g.purpose};}
