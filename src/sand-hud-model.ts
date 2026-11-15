import type {Point,Terrain} from './planner';
import {routeGuidance} from './route-explanation';
import {sandRouteAudit,sandScreen} from './sand-screening';

export const relativeBearing=(bearing:number,heading:number)=>((bearing-heading+540)%360+360)%360-180;
export function localMapWindow(t:Terrain,crew:Point,rangeMetres=200){
 const size=Math.min(t.width,t.height,rangeMetres/t.cellSize);
 return {x:Math.max(0,Math.min(t.width-size,crew.x+.5-size/2)),y:Math.max(0,Math.min(t.height-size,crew.y+.5-size/2)),size,metres:size*t.cellSize};
}
const boundaries=new WeakMap<Terrain,Point[]>();
function sandBoundary(t:Terrain){
 const existing=boundaries.get(t);if(existing)return existing;
 const {excluded}=sandScreen(t),cells:Point[]=[];
 for(let i=0;i<excluded.length;i++)if(excluded[i]){const x=i%t.width,y=Math.floor(i/t.width);if(x===0||y===0||x===t.width-1||y===t.height-1||!excluded[i-1]||!excluded[i+1]||!excluded[i-t.width]||!excluded[i+t.width])cells.push({x,y});}
 boundaries.set(t,cells);return cells;
}
/** Distances refer to declared mapped buffers, never a live soil measurement. */
export function sandHUDState(t:Terrain,cells:number[],crew:Point,heading:number,avoidSand:boolean,canMove:boolean,worldAnchors:boolean){
 const unavailable={kind:'hold' as const,title:'HOLD · verify position',detail:'Ground guidance unavailable',turn:null as number|null,waypointMetres:null as number|null,nearest:null as {metres:number;side:string}|null};
 if(!worldAnchors||![crew.x,crew.y,heading].every(Number.isFinite)||crew.x<0||crew.y<0||crew.x>t.width-1||crew.y>t.height-1)return unavailable;
 const screen=sandScreen(t),cell=Math.round(crew.y)*t.width+Math.round(crew.x),g=routeGuidance(t,cells,crew,12);
 let nearestCell:Point|null=null,metres=Infinity;
 if(screen.excluded[cell]){nearestCell=crew;metres=0;}
 else for(const q of sandBoundary(t)){const d=Math.hypot(Math.max(0,Math.abs(q.x-crew.x)-.5),Math.max(0,Math.abs(q.y-crew.y)-.5))*t.cellSize;if(d<metres){metres=d;nearestCell=q;}}
 const hazardAngle=nearestCell?relativeBearing((Math.atan2(nearestCell.x-crew.x,crew.y-nearestCell.y)*180/Math.PI+360)%360,heading):null;
 const side=metres===0?'inside buffer':hazardAngle===null?'':Math.abs(hazardAngle)<=35?'ahead':Math.abs(hazardAngle)>=145?'behind':hazardAngle<0?'left':'right';
 const nearest=nearestCell?{metres,side}:null,turn=g?relativeBearing(g.bearing,heading):null;
 const base={nearest,turn,waypointMetres:g?.distance??null};
 if(!canMove||!g)return {...base,kind:'hold' as const,title:'HOLD · verify route',detail:'Movement guidance is paused',turn:null};
 if(avoidSand&&(metres===0||sandRouteAudit(t,cells).excludedCells>0))return {...base,kind:'hold' as const,title:'HOLD · sand exclusion',detail:'Recalculate outside the mapped buffer',turn:null};
 if(g.offRoute>10)return {...base,kind:'hold' as const,title:'HOLD · off route',detail:'Check position and recalculate',turn:null};
 if(!avoidSand)return {...base,kind:'caution' as const,title:'Sand avoidance OFF',detail:'Review the route before proceeding',turn:null};
 if(!screen.knownCells||screen.unknown[cell]||cells.slice(Math.max(0,g.index-4),g.index+1).some(i=>screen.unknown[i]))return {...base,kind:'caution' as const,title:'Verify unknown ground',detail:'Texture unavailable nearby · inspect before proceeding',turn:null};
 const title=g.distance<1?'Waypoint reached':Math.abs(turn!)>150?'Turn back to the route':Math.abs(turn!)>35?`Turn ${turn!<0?'left':'right'}`:Math.abs(turn!)>12?`Bear ${turn!<0?'left':'right'}`:'Follow the marked route';
 return {...base,kind:metres<20?'caution' as const:'route' as const,title,detail:metres<20?'Keep outside the amber sand buffer':'Mapped sand avoidance active'};
}
