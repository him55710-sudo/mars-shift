import type {RoverGrid} from './rover-navigation';

export type SurfaceMode='photo'|'dem'|'separation'|'features';
export type RaisedFeature={id:number;peak:number[];heightAboveReference:number;meanHeightAboveReference:number;area:number;bounds:number[][];heightBounds:number[];supportFraction:number;kind:string;reviewStatus:string;footprint:{type:'MultiPolygon';coordinates:number[][][][]}};
export type SurfaceEvidence={schemaVersion:number;extractionId:string;sourceCommit:string;sourceManifestSha256:string;sourceUrl:string;frame:{units:string;axes:string[];registrationToOrbitalMission:null};grid:{width:number;height:number;cellSize:number;origin:number[]};elevation:(number|null)[];referenceGround:(number|null)[];residual:(number|null)[];classes:number[];featureIds:number[];features:RaisedFeature[];elevationRange:number[];summary:{sourceTriangles:number;observedCells:number;conflictCells:number;knownCells:number;assessedCells:number;unassessedObservedCells:number;featureCells:number;featureCount:number};method:Record<string,string>;limitations:string[]};

/** Check both the numeric payload and its registration to the observed local map. */
export function validateSurfaceEvidence(value:unknown,nav:RoverGrid):SurfaceEvidence{
 const e=value as SurfaceEvidence,g=e?.grid,n=g?.width*g?.height;
 if(!e||e.schemaVersion!==1||!g||!Number.isInteger(g.width)||!Number.isInteger(g.height)||g.width<2||g.height<2||n>262144||!Number.isFinite(g.cellSize)||g.cellSize<=0||g.origin?.length!==2||!g.origin.every(Number.isFinite)||e.frame?.units!=='metres'||e.frame.registrationToOrbitalMission!==null||e.frame.axes?.join(',')!=='north,up,east')throw Error('Surface evidence frame is invalid.');
 if(g.origin.some((v,i)=>Math.abs(v-nav.origin[i])>1e-5)||Math.abs(g.width*g.cellSize-nav.width*nav.cellSize)>1e-5||Math.abs(g.height*g.cellSize-nav.height*nav.cellSize)>1e-5)throw Error('Surface evidence does not match this recorded region.');
 if(!/^[a-f0-9]{64}$/.test(e.extractionId)||!/^[a-f0-9]{40}$/.test(e.sourceCommit)||!/^[a-f0-9]{64}$/.test(e.sourceManifestSha256)||![e.elevation,e.referenceGround,e.residual].every(a=>Array.isArray(a)&&a.length===n&&a.every(v=>v===null||Number.isFinite(v)))||e.classes?.length!==n||e.featureIds?.length!==n||!Array.isArray(e.features)||e.features.length>255||e.elevationRange?.length!==2||!e.elevationRange.every(Number.isFinite))throw Error('Surface evidence arrays are invalid.');
 const ids=new Set<number>();
 for(const f of e.features){if(!Number.isInteger(f.id)||f.id<1||f.id>255||ids.has(f.id)||f.peak?.length!==3||!f.peak.every(Number.isFinite)||!Number.isFinite(f.area)||f.area<=0||!Number.isFinite(f.heightAboveReference)||f.heightAboveReference<.15||f.bounds?.length!==2||f.bounds.some(v=>v.length!==2||!v.every(Number.isFinite))||f.heightBounds?.length!==2||!f.heightBounds.every(Number.isFinite)||!Number.isFinite(f.supportFraction)||f.supportFraction<.55||f.supportFraction>1)throw Error('Raised-feature metadata is invalid.');ids.add(f.id);}
 for(let i=0;i<n;i++){const c=e.classes[i],id=e.featureIds[i];if(!Number.isInteger(c)||c<0||c>4||!Number.isInteger(id)||id<0||id>255||id>0&&!ids.has(id)||(c===0)!==(e.elevation[i]===null)||(c===2)!==(id>0)||[1,2,3].includes(c)&&(e.referenceGround[i]===null||e.residual[i]===null))throw Error('Surface evidence masks are inconsistent.');}
 return e;
}

export function evidenceIndex(e:SurfaceEvidence,x:number,z:number){const g=e.grid,c=Math.floor((x-g.origin[0])/g.cellSize),r=Math.floor((z-g.origin[1])/g.cellSize);return c<0||r<0||c>=g.width||r>=g.height?-1:r*g.width+c;}
export function featureAt(e:SurfaceEvidence,x:number,z:number){const i=evidenceIndex(e,x,z);return i<0?null:e.features.find(f=>f.id===e.featureIds[i])??null;}
export function featureExclusion(f:RaisedFeature){const [lo,hi]=f.bounds;return {x:(lo[0]+hi[0])/2,z:(lo[1]+hi[1])/2,radius:Math.hypot(hi[0]-lo[0],hi[1]-lo[1])/2};}
export function preferredFeature(e:SurfaceEvidence,x:number,z:number){
 const complete=e.features.filter(f=>{const i=evidenceIndex(e,f.peak[0],f.peak[2]),c=i%e.grid.width,r=Math.floor(i/e.grid.width);if(c<1||r<1||c>=e.grid.width-1||r>=e.grid.height-1)return false;for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++)if(e.elevation[i+dr*e.grid.width+dc]===null)return false;return true;});
 const supported=complete.filter(f=>f.supportFraction>=.75&&f.area>=.2),pool=supported.length?supported:complete.length?complete:e.features;
 return pool.slice().sort((a,b)=>Math.hypot(a.peak[0]-x,a.peak[2]-z)-Math.hypot(b.peak[0]-x,b.peak[2]-z))[0]??null;
}
export function evidencePixels(e:SurfaceEvidence){const a=new Uint8Array(e.classes.length*4);for(let i=0;i<e.classes.length;i++)a.set([e.classes[i],e.featureIds[i],Math.min(255,Math.round((e.residual[i]??0)*100)),255],i*4);return a;}

/** A centre-sampled DEM, with no triangles crossing a missing/conflicted cell. */
export function evidenceMesh(e:SurfaceEvidence,reference=false){
 const g=e.grid,z=reference?e.referenceGround:e.elevation,positions=new Float32Array(z.length*3),colors=new Float32Array(z.length*3),indices:number[]=[];
 const palette=[[.15,.29,.37],[.35,.56,.60],[.78,.78,.60],[.94,.86,.68]];
 for(let i=0;i<z.length;i++){
  positions.set([g.origin[0]+(i%g.width+.5)*g.cellSize,z[i]??0,g.origin[1]+(Math.floor(i/g.width)+.5)*g.cellSize],i*3);
  const t=Math.max(0,Math.min(1,((e.elevation[i]??e.elevationRange[0])-e.elevationRange[0])/Math.max(.001,e.elevationRange[1]-e.elevationRange[0])))*3,lo=Math.min(2,Math.floor(t)),f=t-lo;
  colors.set(palette[lo].map((v,j)=>v+(palette[lo+1][j]-v)*f),i*3);
 }
 for(let r=0;r<g.height-1;r++)for(let c=0;c<g.width-1;c++){const a=r*g.width+c,b=a+1,d=a+g.width,cc=d+1;if([a,b,d,cc].some(i=>z[i]===null||e.elevation[i]===null))continue;indices.push(a,d,b,b,d,cc);}
 return {positions,colors,indices:new Uint32Array(indices)};
}
