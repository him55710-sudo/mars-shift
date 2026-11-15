import type {Terrain} from './planner';
import type {RoverGrid,RoverObstacle} from './rover-navigation';

/** Identical display classes to the recorded-surface overlay; independent of the chosen route. */
export function roverHazardPixels(g:RoverGrid,t:Terrain,obstacles:RoverObstacle[]){
 const pixels=new Uint8Array(g.width*g.height*4);
 for(let i=0;i<t.valid.length;i++){
  const x=g.origin[0]+(i%g.width+.5)*g.cellSize,z=g.origin[1]+(Math.floor(i/g.width)+.5)*g.cellSize;
  const excluded=obstacles.some(o=>Math.hypot(x-o.x,z-o.z)<=o.radius+.35);
  const color=excluded?[248,85,52,255]:!t.valid[i]?[160,172,177,100]:(t.slope[i]??0)>12?[244,181,74,170]:t.obstacleMask?.[i]?[160,172,177,100]:[0,0,0,0];
  pixels.set(color,i*4);
 }
 return pixels;
}
