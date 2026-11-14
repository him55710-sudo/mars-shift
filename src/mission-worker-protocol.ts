import type {Terrain} from './planner';
import type {MissionDraft,MissionHistory,MissionSnapshot} from './mission-state';
export type MissionRequest={id:number;terrain:Terrain;draft:MissionDraft;history:MissionHistory};
export type MissionReply={id:number;result:MissionSnapshot;elapsedMs:number}|{id:number;error:string};
/** Minimal transport allows deterministic delayed-response tests without DOM globals. */
export interface MissionWorker {
 onmessage:((event:MessageEvent<MissionReply>)=>void)|null;
 onerror:((event:ErrorEvent)=>void)|null;
 postMessage(request:MissionRequest):void;
 terminate():void;
}
