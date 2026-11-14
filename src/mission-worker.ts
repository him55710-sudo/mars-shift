import {calculateMission} from './mission-state';
import type {MissionRequest,MissionReply} from './mission-worker-protocol';
self.onmessage=(event:MessageEvent<MissionRequest>)=>{
 const {id,terrain,draft,history}=event.data,started=performance.now();
 let reply:MissionReply;
 try{reply={id,result:calculateMission(terrain,draft,history),elapsedMs:performance.now()-started};}
 catch(error){reply={id,error:error instanceof Error?error.message:'Route calculation failed.'};}
 self.postMessage(reply);
};
