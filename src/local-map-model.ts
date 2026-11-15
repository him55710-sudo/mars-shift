import type {Point,Terrain} from './planner';
import type {XRNavigationFrame} from './hazard-xr';

/** SVG cell centres use the same metric coordinates as the 3D hazard frame. */
export const localMapPoint=(p:Point)=>({x:p.x+.5,y:p.y+.5});
export function localMapFrame(t:Terrain,frame?:XRNavigationFrame){
 if(!frame||frame.coordinates!=='GRID_NORTH_EAST_METRES'||frame.crs!==t.crs||frame.cellSize!==t.cellSize||frame.bounds.length!==t.bounds.length||frame.bounds.some((v,i)=>v!==t.bounds[i]))return null;
 const fix=(p:{x:number;y:number})=>localMapPoint({x:p.x/t.cellSize,y:p.y/t.cellSize});
 return {current:frame.forecast[0]?.valid?{...fix(frame.forecast[0]),radius:frame.forecast[0].radius/t.cellSize}:null,route:frame.anchorsEnabled?frame.route.map(fix):[],source:frame.source,time:frame.timestamp};
}
