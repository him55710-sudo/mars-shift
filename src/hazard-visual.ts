import type {Terrain} from './planner';
import type {XRNavigationFrame} from './hazard-xr';

// Shared warning color; opacity and labels distinguish evidence and forecast.
export const RISK_RED='#ff4052';
export const RISK_BUFFER='#ff8792';
export const riskPixel=(alpha=255):[number,number,number,number]=>[255,64,82,alpha];

/** Ground footprint in the frame's own metric grid, never a new detection. */
export function stormDisplayPixels(t:Terrain,frame:XRNavigationFrame|undefined,base:Uint8Array=new Uint8Array(t.width*t.height*4)){
 const pixels=base.slice();
 if(!frame||frame.crs!==t.crs||frame.cellSize!==t.cellSize||frame.bounds.length!==t.bounds.length||frame.bounds.some((v,i)=>v!==t.bounds[i]))return pixels;
 const valid=(p:XRNavigationFrame['forecast'][number])=>p.valid&&[p.x,p.y,p.radius,p.envelope,p.time].every(Number.isFinite)&&p.radius>=0&&p.envelope>=p.radius;
 const fixes=frame.forecast;
 for(let i=0;i<t.width*t.height;i++){
  if(!t.valid[i]||t.elevation[i]===null)continue;
  const x=i%t.width*t.cellSize,y=Math.floor(i/t.width)*t.cellSize;
  let alpha=0;
  const current=fixes[0];
  if(current&&valid(current)&&Math.hypot(x-current.x,y-current.y)<=current.radius)alpha=255;
  else for(let j=0;j<fixes.length;j++){
   const a=fixes[j];if(!valid(a))continue;
   const b=fixes[j+1];
   if(b&&valid(b)&&b.time>a.time){
    const dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy,u=len?Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/len)):0;
    if(Math.hypot(x-a.x-u*dx,y-a.y-u*dy)<=Math.max(a.envelope,b.envelope)){alpha=105;break;}
   }else if(Math.hypot(x-a.x,y-a.y)<=a.envelope){alpha=105;break;}
  }
  // Existing reviewed constraints retain their stronger red warning.
  const strongerRed=pixels[i*4]>200&&pixels[i*4+1]<120&&pixels[i*4+3]>=alpha;
  if(alpha&&!strongerRed)pixels.set(riskPixel(alpha),i*4);
 }
 return pixels;
}
