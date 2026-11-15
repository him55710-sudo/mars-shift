import type {Terrain} from './planner';
import type {SandMap} from './sand-traps-v14';
export function sandGroundPixels(map:SandMap){
 const pixels=new Uint8Array(map.core.length*4);for(let i=0;i<map.core.length;i++)pixels.set(map.core[i]?[255,64,82,250]:map.buffer[i]?[255,107,124,230]:map.unknown[i]?[160,164,180,100]:[0,0,0,0],i*4);return pixels;
}
/** Low-opacity fill, crisp footprint boundaries. Kept separate from source photo. */
export function sandLayerCanvas(t:Terrain,map:SandMap){
 const scale=4,c=document.createElement('canvas');c.width=t.width*scale;c.height=t.height*scale;const ctx=c.getContext('2d')!;
 for(let i=0;i<map.core.length;i++){
  const x=i%t.width,y=Math.floor(i/t.width),core=map.core[i],buffer=map.buffer[i];
  if(!buffer&&!map.unknown[i])continue;
  ctx.fillStyle=core?'#ff405250':buffer?'#ff879218':'#969eaf20';ctx.fillRect(x*scale,y*scale,scale,scale);
  if(map.unknown[i]&&(x+y)%3===0){ctx.strokeStyle='#a6aabb50';ctx.beginPath();ctx.moveTo(x*scale,y*scale);ctx.lineTo((x+1)*scale,(y+1)*scale);ctx.stroke();}
  if(!buffer)continue;ctx.strokeStyle=core?'#ff4052b0':'#ff8792bb';ctx.lineWidth=core?.8:.65;
  for(const [dx,dy,ax,ay,bx,by]of [[-1,0,0,0,0,1],[1,0,1,0,1,1],[0,-1,0,0,1,0],[0,1,0,1,1,1]]){
   const a=x+dx,b=y+dy,j=b*t.width+a,other=a>=0&&b>=0&&a<t.width&&b<t.height?(core?map.core[j]:map.buffer[j]):0;
   if(!other){ctx.beginPath();ctx.moveTo((x+ax)*scale,(y+ay)*scale);ctx.lineTo((x+bx)*scale,(y+by)*scale);ctx.stroke();}
  }
 }
 return c;
}
