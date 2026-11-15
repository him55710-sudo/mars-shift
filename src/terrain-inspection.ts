import {heightAt} from './eva-motion';
import type {NativeDEM} from './eva-motion';
import type {Point,Terrain} from './planner';

export type TerrainCameraAction={id:number;type:'reset'|'in'|'out'|'north'|'left'|'right'|'inspect';point?:Point};
/** Display inspection never changes a mission target or its planning cell. */
export function inspectionTarget(t:Terrain,p:Point,native:NativeDEM|null,min:number){
 if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.y<0||p.x>t.width-1||p.y>t.height-1)return null;
 const elevation=heightAt(t,p,native);if(elevation===null)return null;
 return {x:(p.x+.5-t.width/2)*t.cellSize,y:elevation-min+1.5,z:(p.y+.5-t.height/2)*t.cellSize};
}
export function inspectionFocus(t:Terrain,x:number,z:number):Point|null{
 const p={x:x/t.cellSize+t.width/2-.5,y:z/t.cellSize+t.height/2-.5};
 return p.x>=0&&p.y>=0&&p.x<=t.width-1&&p.y<=t.height-1?p:null;
}
