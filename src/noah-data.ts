import {hasMobilityData} from './mobility';
import type {Terrain,Settings,Exclusion} from './planner';
import {blocked} from './planner';

export type NoahTerrain={schemaVersion:1;grid:{width:number;height:number;cellSize:number;bounds:number[];crs:string};classes:{id:number;label:string;group:string;color:string}[];classFractionOrder:number[];fields:{dominantClass:(number|null)[];coverage:number[];dominantAreaFraction:(number|null)[];classFractions:(number[]|null)[]};source:{title:string;doi:string;published:string;license:string;credit:string};registration:{residualMetres:number|null;status:string};coverage:{sampledFraction:number}};
export function validateNoah(t:Terrain,value:unknown):NoahTerrain{
 const n=value as NoahTerrain,count=t.width*t.height,g=n?.grid,f=n?.fields;
 if(n?.schemaVersion!==1||!g||g.width!==t.width||g.height!==t.height||g.cellSize!==t.cellSize||g.crs!==t.crs||g.bounds?.length!==4||g.bounds.some((v,i)=>!Number.isFinite(v)||Math.abs(v-t.bounds[i])>1e-8)||!f)throw Error('NOAH-H is not registered to this terrain.');
 if(!Array.isArray(n.classes)||n.classes.length!==14||n.classes.some((c,i)=>c.id!==i+1||typeof c.label!=='string'||!/^#[\da-f]{6}$/i.test(c.color))||n.classFractionOrder?.join(',')!=='1,2,3,4,5,6,7,8,9,10,11,12,13,14')throw Error('Unrecognized NOAH-H published mosaic legend.');
 if(!n.source?.doi||!n.source.license||!n.registration||n.registration.residualMetres!==null&&(!Number.isFinite(n.registration.residualMetres)||n.registration.residualMetres<0))throw Error('Missing NOAH-H provenance.');
 for(const field of ['dominantClass','coverage','dominantAreaFraction','classFractions'] as const)if(!Array.isArray(f[field])||f[field].length!==count)throw Error('Invalid NOAH-H field length.');
 for(let i=0;i<count;i++){
  const coverage=f.coverage[i],id=f.dominantClass[i],fractions=f.classFractions[i],dominant=f.dominantAreaFraction[i];
  if(!Number.isFinite(coverage)||coverage<0||coverage>1)throw Error('Invalid classification coverage.');
  if(coverage===0){if(id!==null||fractions!==null||dominant!==null)throw Error('Unknown classification assigned a class.');continue;}
  if(!Number.isInteger(id)||id!<1||id!>14||!Array.isArray(fractions)||fractions.length!==14||fractions.some(v=>!Number.isFinite(v)||v<0||v>1)||Math.abs(fractions.reduce((a,b)=>a+b,0)-coverage)>2e-5||dominant===null||Math.abs(dominant-fractions[id!-1])>1e-6||Math.abs(dominant-Math.max(...fractions))>1e-6)throw Error('Invalid class area fractions.');
 }
 return n;
}

/** Published texture areas, kept separate from physical soil/rock observations. */
export function noahEvidence(n:NoahTerrain|undefined,index:number){
 const id=n?.fields.dominantClass[index],fractions=n?.fields.classFractions[index],known=n?.fields.coverage[index]??0;
 const sum=(ids:number[])=>fractions?ids.reduce((total,id)=>total+(fractions[id-1]??0),0):null;
 return {classification:known?'DERIVED' as const:'UNKNOWN' as const,label:id?n!.classes[id-1].label:'Unclassified',coverage:known,
  dominantAreaFraction:n?.fields.dominantAreaFraction[index]??null,boulderFieldAreaFraction:sum([11]),rippleAreaFraction:sum([3,5,6,9,12,14]),
  sourcePixelMetres:.25,planningCellMetres:n?.grid.cellSize??5,observationDate:null,publicationDate:n?.source.published??null,
  registrationResidualMetres:n?.registration.residualMetres??null,
  limitations:'Published texture classification; area is not boulder count, soil strength, model confidence or failure probability. Independent local registration error and observation dates are unknown.'};
}

export type EvidenceRisk={state:'constraint'|'candidate'|'lower'|'unknown';reasons:string[];routingImpact:string};
/** Display rule; optional sand exclusions are applied by the shared graph first. */
export function evidenceRisk(t:Terrain,n:NoahTerrain|undefined,i:number,s:Settings,e:Exclusion|null):EvidenceRisk{
 if(!t.valid[i]||t.elevation[i]===null||t.slope[i]===null||!Number.isFinite(t.elevation[i])||!Number.isFinite(t.slope[i])||!hasMobilityData(t,i,s))return {state:'unknown',reasons:['DEM, slope or mobility support missing'],routingImpact:'Blocked by terrain coverage policy'};
 if(blocked(t,i,s,e))return {state:'constraint',reasons:['Configured slope, mobility support, sand screening or exclusion constraint'],routingImpact:'Blocked by the shared routing graph'};
 const evidence=noahEvidence(n,i),reasons:string[]=[];
 if(t.exposure[i])reasons.push('Derived steep-slope proximity');
 if((evidence.boulderFieldAreaFraction??0)>=.25)reasons.push('At least 25% published boulder-field texture');
 if((evidence.rippleAreaFraction??0)>=.25)reasons.push('At least 25% published ripple texture; soil support unmeasured');
 if(reasons.length)return {state:'candidate',reasons,routingImpact:'Contextual texture candidate; enable sand avoidance for ripple exclusions or confirm an obstacle buffer'};
 if(evidence.coverage<.95)return {state:'unknown',reasons:['Less than 95% classification sample coverage'],routingImpact:'Current routing uses DEM constraints; classification uncertainty is not a measured obstacle'};
 return {state:'lower',reasons:['No selected constraint or texture-candidate rule triggered'],routingImpact:'Relatively lower under displayed rules; unresolved obstacles and soil strength remain unknown'};
}
