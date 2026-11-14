import type {Terrain} from './planner';

export const SCIENCE_FIELDS=['slope','aspect','tri','tpi11','tpi51','profileCurvature','planCurvature','relief11','relief51','exposure','coverage','support3','support11','support51','uncertaintyMask','opticalCueFraction'] as const;
export type ScienceField=typeof SCIENCE_FIELDS[number];
export type TerrainScience={schemaVersion:1;width:number;height:number;cellSize:number;bounds:number[];crs:string;nativeResolution:number;fields:Record<ScienceField,(number|null)[]>;metadata:Record<string,unknown>;summary:Record<string,unknown>};
/** Reject unregistered, incomplete or nonfinite products instead of shifting overlays. */
export function validateScience(t:Terrain,value:unknown):TerrainScience {
 const s=value as TerrainScience,n=t.width*t.height;
 if(!s||s.schemaVersion!==1||s.width!==t.width||s.height!==t.height||s.cellSize!==t.cellSize||s.crs!==t.crs||s.nativeResolution!==1||!Array.isArray(s.bounds)||s.bounds.length!==4||s.bounds.some((v,i)=>!Number.isFinite(v)||Math.abs(v-t.bounds[i])>1e-6)||!s.fields)throw Error('Scientific products are not registered to this terrain.');
 for(const field of SCIENCE_FIELDS)if(!Array.isArray(s.fields[field])||s.fields[field].length!==n||s.fields[field].some(v=>v!==null&&(typeof v!=='number'||!Number.isFinite(v))))throw Error(`Invalid scientific field: ${field}`);
 return s;
}
