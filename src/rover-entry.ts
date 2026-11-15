import type {RoverGrid} from './rover-navigation';

/** Display entry only. The frozen source grid and recorded MEDA scenarios stay intact. */
export const OBSERVED_ENTRY={start:{x:-2.625,z:7.875},target:{x:-6.375,z:10.375}};
export function explorationGrid(g:RoverGrid,original=false):RoverGrid{
 return original?g:{...g,...OBSERVED_ENTRY};
}
export function observedCoverage(g:RoverGrid,x:number,z:number,radius=3){
 let known=0,total=0,clearance=Infinity;
 for(let row=-1;row<=g.height;row++)for(let col=-1;col<=g.width;col++){
  const d=Math.hypot(g.origin[0]+(col+.5)*g.cellSize-x,g.origin[1]+(row+.5)*g.cellSize-z);
  const supported=col>=0&&row>=0&&col<g.width&&row<g.height&&g.elevation[row*g.width+col]!==null;
  if(!supported)clearance=Math.min(clearance,d);
  if(d<=radius){total++;if(supported)known++;}
 }
 return {known,total,fraction:total?known/total:0,clearance};
}
