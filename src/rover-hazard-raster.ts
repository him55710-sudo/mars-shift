import type {Terrain} from './planner';
import type {RoverGrid,RoverObstacle} from './rover-navigation';

/** Identical display classes to the recorded-surface overlay; independent of the chosen route. */
export function roverHazardPixels(g:RoverGrid,t:Terrain,obstacles:RoverObstacle[]){
 const pixels=new Uint8Array(g.width*g.height*4);
 for(let i=0;i<t.valid.length;i++){
  const x=g.origin[0]+(i%g.width+.5)*g.cellSize,z=g.origin[1]+(Math.floor(i/g.width)+.5)*g.cellSize;
  const inside=obstacles.filter(o=>Math.hypot(x-o.x,z-o.z)<=o.radius+.35),sand=inside.length>0&&inside.every(o=>o.material==='sand');
  const color=sand?[255,166,61,255]:inside.length?[248,85,52,255]:!t.valid[i]?[160,172,177,100]:(t.slope[i]??0)>12?[244,181,74,170]:t.obstacleMask?.[i]?[160,172,177,100]:[0,0,0,0];
  pixels.set(color,i*4);
 }
 return pixels;
}
