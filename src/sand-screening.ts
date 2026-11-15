import type {Terrain} from './planner';

/** Declared planning exclusions from published texture, not measured soil failure. */
export const SAND_POLICY={version:1,rippleClasses:[3,5,6,9,12,14],minimumCoverage:.95,minimumRippleFraction:.25,bufferMetres:5} as const;
export type SandScreen={candidate:Uint8Array;excluded:Uint8Array;unknown:Uint8Array;candidateCells:number;excludedCells:number;knownCells:number;totalCells:number};
const cache=new WeakMap<Terrain,SandScreen>();
export function sandScreen(t:Terrain):SandScreen{
 const cached=cache.get(t);if(cached)return cached;
 const n=t.width*t.height,candidate=new Uint8Array(n),excluded=new Uint8Array(n),unknown=new Uint8Array(n);let candidateCells=0,knownCells=0;
 for(let i=0;i<n;i++){
  const coverage=t.noah?.fields.coverage[i]??0,f=t.noah?.fields.classFractions[i];
  if(coverage<SAND_POLICY.minimumCoverage||!f){unknown[i]=1;continue;}
  knownCells++;
  if(SAND_POLICY.rippleClasses.reduce((sum,id)=>sum+f[id-1],0)>=SAND_POLICY.minimumRippleFraction){candidate[i]=1;candidateCells++;}
 }
 // Expand full planning cells by at least the declared buffer. Corner cutting
 // is rejected by the shared graph, including the cells beside diagonal edges.
 const r=Math.ceil(SAND_POLICY.bufferMetres/t.cellSize);
 for(let i=0;i<n;i++)if(candidate[i]){const x=i%t.width,y=Math.floor(i/t.width);for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){const xx=x+dx,yy=y+dy;if(xx>=0&&yy>=0&&xx<t.width&&yy<t.height)excluded[yy*t.width+xx]=1;}}
 const result={candidate,excluded,unknown,candidateCells,knownCells,totalCells:n,excludedCells:excluded.reduce((sum,v)=>sum+v,0)};cache.set(t,result);return result;
}
export function sandRouteAudit(t:Terrain,cells:readonly number[]){
 const s=sandScreen(t),unique=[...new Set(cells)];
 return {candidateCells:unique.filter(i=>s.candidate[i]).length,excludedCells:unique.filter(i=>s.excluded[i]).length,unknownCells:unique.filter(i=>s.unknown[i]).length};
}
