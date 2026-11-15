import type {XRNavigationFrame} from './hazard-xr';

export type SessionReply<T>={session:string;value:T};
/** A result for a previous configuration is invalid immediately, including the
 * render before React dispatches the next worker initialization effect. */
export function matchingGuidance<T>(reply:SessionReply<T>|null,session:string):T|null{
 return reply?.session===session?reply.value:null;
}
export function pendingGuidance(previous:XRNavigationFrame,session:string,warning='Conditions changed. Awaiting a matching calculation.'):XRNavigationFrame&{session:string}{
 return {...previous,session,action:'HOLD',anchorsEnabled:false,route:[],forecast:[],routeEvaluation:undefined,warning};
}
