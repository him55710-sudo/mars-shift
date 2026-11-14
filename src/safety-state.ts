import type {PositionFix} from './position-sensor';
import {localizationValid} from './position-sensor';
export type SafetyState={status:'READY'|'HOLD'|'LOCALIZATION DEGRADED'|'LOCALIZATION LOST'|'NO VERIFIED SAFE ROUTE';canMove:boolean;worldAnchors:boolean;reason:string};
export function safetyState(fix:PositionFix,routeReady:boolean,budgetFeasible:boolean,reason=''):SafetyState{
 if(!localizationValid(fix))return {status:fix.status==='lost'?'LOCALIZATION LOST':'LOCALIZATION DEGRADED',canMove:false,worldAnchors:false,reason:'Stop movement and re-establish the simulated position before ground-anchored guidance.'};
 if(!routeReady)return {status:'HOLD',canMove:false,worldAnchors:true,reason:reason||'Calculate and review the current route before walking.'};
 if(!budgetFeasible)return {status:'NO VERIFIED SAFE ROUTE',canMove:false,worldAnchors:true,reason:reason||'No return margin is verified under the declared resource model.'};
 return {status:'READY',canMove:true,worldAnchors:true,reason:'Within declared model constraints; unresolved local obstacles remain unknown.'};
}
