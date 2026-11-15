import {riskPixel} from './hazard-visual';
import type {Terrain} from './planner';
import {sandScreen} from './sand-screening';
export function sandOverlay(t:Terrain){
 const s=sandScreen(t),canvas=document.createElement('canvas');canvas.width=t.width;canvas.height=t.height;
 const ctx=canvas.getContext('2d')!,pixels=ctx.createImageData(t.width,t.height);
 for(let i=0;i<s.totalCells;i++){
  const stripe=(i%t.width+Math.floor(i/t.width))%4<2;
  pixels.data.set(s.candidate[i]?riskPixel(185):s.excluded[i]?riskPixel(70):s.unknown[i]&&stripe?[188,174,209,100]:[0,0,0,0],i*4);
 }
 ctx.putImageData(pixels,0,0);return canvas.toDataURL();
}
