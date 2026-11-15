import {expect,it} from 'vitest';
import {matchingGuidance,pendingGuidance} from './guidance-session-v15';
import type {XRNavigationFrame} from './hazard-xr';

it('rejects a previous scenario even if it arrives after the new scenario was selected',()=>{
 const previous={session:'speed=.6;reset=0',value:{action:'DETOUR'}};
 expect(matchingGuidance(previous,'speed=.9;reset=0')).toBeNull();
 expect(matchingGuidance(previous,'speed=.6;reset=1')).toBeNull();
 expect(matchingGuidance(previous,'speed=.6;reset=0')).toEqual(previous.value);
});
it('withdraws geometry and old risk estimates from XR while retaining its coordinate frame',()=>{
 const frame:XRNavigationFrame={schemaVersion:1,revision:4,timestamp:24,coordinates:'GRID_EAST_SOUTH_METRES',crs:'LOCAL_TEST',bounds:[0,0,20,20],cellSize:1,origin:{x:2,y:3},action:'DETOUR',anchorsEnabled:true,route:[{x:2,y:3,time:24}],forecast:[],source:'SIMULATION',localizationSigma:.75,warning:null,routeEvaluation:{contactMethod:'CONTINUOUS',predictedContactSeconds:0,predictedMinClearanceMetres:3,returnMarginSeconds:80,warningTimeReference:'STATIONARY_ENVELOPE_FRONT_ENTRY'}};
 const held=pendingGuidance(frame,'new-condition');
 expect(held.action).toBe('HOLD');expect(held.anchorsEnabled).toBe(false);
 expect(held.route).toEqual([]);expect(held.forecast).toEqual([]);expect(held.routeEvaluation).toBeUndefined();
 expect(held.crs).toBe(frame.crs);expect(held.origin).toEqual(frame.origin);
 expect(frame.route).toHaveLength(1);expect(frame.anchorsEnabled).toBe(true);
 expect(pendingGuidance(frame,'failed','Planner unavailable.').warning).toBe('Planner unavailable.');
});
