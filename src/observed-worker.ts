import {observedSession,observedSnapshot,advanceObserved} from './observed-session';
let session:ReturnType<typeof observedSession>|null=null,snapshot:ReturnType<typeof observedSnapshot>|null=null;
self.onmessage=({data})=>{try{
 if(data.type==='init')session=observedSession(data.grid,data.event,data.heading,data.model);
 else if(session&&snapshot)advanceObserved(session,snapshot.decision);
 if(session){snapshot=observedSnapshot(session);postMessage({id:data.id,snapshot});}
 }catch(e){postMessage({id:data.id,error:e instanceof Error?e.message:String(e)});}};
