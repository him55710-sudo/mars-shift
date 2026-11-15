import type {RoverGrid} from './rover-navigation';
import type {Route,Terrain} from './planner';

/** Display mask only, 5 cm texels. Sampling does not add terrain or navigation precision. */
export function groundRouteRaster(g:RoverGrid,t:Terrain,route:Route|null){
 const scale=5,width=g.width*scale,height=g.height*scale,spacing=g.cellSize/scale;
 const pixels=new Uint8Array(width*height*4);let distance=0;
 const path=route?.outbound??[];
 for(let n=1;n<path.length;n++){
  const a=path[n-1],b=path[n];if(!t.valid[a]||!t.valid[b]||t.obstacleMask?.[a]||t.obstacleMask?.[b])continue;
  const ax=(a%g.width+.5)*g.cellSize,az=(Math.floor(a/g.width)+.5)*g.cellSize;
  const bx=(b%g.width+.5)*g.cellSize,bz=(Math.floor(b/g.width)+.5)*g.cellSize;
  const dx=bx-ax,dz=bz-az,length=Math.hypot(dx,dz);if(!length)continue;
  const radius=.24;
  for(let y=Math.max(0,Math.floor((Math.min(az,bz)-radius)/spacing));y<=Math.min(height-1,Math.ceil((Math.max(az,bz)+radius)/spacing));y++)
   for(let x=Math.max(0,Math.floor((Math.min(ax,bx)-radius)/spacing));x<=Math.min(width-1,Math.ceil((Math.max(ax,bx)+radius)/spacing));x++){
    const cell=Math.floor(y/scale)*g.width+Math.floor(x/scale);if(!t.valid[cell]||t.obstacleMask?.[cell])continue;
    const px=(x+.5)*spacing,pz=(y+.5)*spacing,u=Math.max(0,Math.min(1,((px-ax)*dx+(pz-az)*dz)/(length*length)));
    const d=Math.hypot(px-ax-u*dx,pz-az-u*dz),strength=Math.round(255*Math.max(0,1-d/radius)),i=(y*width+x)*4;
    if(strength>pixels[i]){pixels[i]=strength;pixels[i+1]=Math.round(((distance+u*length)%2)/2*255);pixels[i+3]=255;}
   }
  distance+=length;
 }
 return {pixels,width,height,spacing};
}
