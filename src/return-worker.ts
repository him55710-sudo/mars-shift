import {emergencyReturn} from './emergency-return';
import type {ReturnReply,ReturnRequest} from './emergency-return';
self.onmessage=(event:MessageEvent<ReturnRequest>)=>{const started=performance.now(),request=event.data;let reply:ReturnReply;try{reply={id:request.id,result:emergencyReturn(request),elapsedMs:performance.now()-started};}catch(error){reply={id:request.id,error:error instanceof Error?error.message:'Emergency return calculation failed.'};}self.postMessage(reply);};
