import type {Terrain} from './planner';
import type {ReturnMap} from './return-feasibility';
export const SCIENCE_LAYERS=[['none','Optical / current base layer',''],['feasibility','Return feasibility','Green: feasible · red: budget · gray: blocked · striped: unknown'],['localCost','Local outgoing time cost','s/m mean mapped outgoing edges'],['outbound','Minimum outbound time','min'],['inbound','Minimum return time','min'],['total','Minimum round trip + science','min'],['tri','Ruggedness · native 3 m TRI','m'],['tpi11','Topographic position · 11 m','m'],['tpi51','Topographic position · 51 m','m'],['profileCurvature','Profile curvature · 3 m','1/m · convex positive'],['planCurvature','Plan curvature · 3 m','1/m · convex positive'],['aspect','Downslope aspect · 3 m','° clockwise from north'],['relief11','Local relief · 11 m','m'],['relief51','Local relief · 51 m','m'],['opticalCueFraction','Optical cue area fraction','fraction · unvalidated mask, not rock abundance'],['coverage','Native DEM coverage','fraction · not vertical accuracy']] as const;
export type ScienceLayer=typeof SCIENCE_LAYERS[number][0];
export function scienceValues(t:Terrain,m:ReturnMap|null,layer:ScienceLayer):ArrayLike<number|null>|null {
 if(layer==='localCost')return m?.localSecondsPerMetre??null;
 if(['outbound','inbound','total'].includes(layer))return m?.[layer as 'outbound'|'inbound'|'total']??null;
 return t.science?.fields[layer as keyof NonNullable<Terrain['science']>['fields']]??null;
}
export function scienceDomain(values:ArrayLike<number|null>|null,layer:ScienceLayer){
 if(!values)return {min:0,max:1};const finite=Array.from(values).filter((v):v is number=>v!==null&&Number.isFinite(v)).sort((a,b)=>a-b);if(!finite.length)return {min:0,max:1};
 if(layer==='aspect')return {min:0,max:360};if(layer==='coverage')return {min:0,max:1};
 const lo=finite[Math.floor((finite.length-1)*.01)],hi=finite[Math.ceil((finite.length-1)*.99)];if(['tpi11','tpi51','profileCurvature','planCurvature'].includes(layer)){const a=Math.max(Math.abs(lo),Math.abs(hi),1e-9);return {min:-a,max:a};}return {min:Math.min(0,lo),max:hi||1};
}
export function scienceRaster(t:Terrain,map:ReturnMap|null,layer:ScienceLayer){
 if(layer==='none'||!t.science||layer==='feasibility'&&!map)return null;
 const canvas=document.createElement('canvas');canvas.width=t.width;canvas.height=t.height;const ctx=canvas.getContext('2d')!,image=ctx.createImageData(t.width,t.height),values=scienceValues(t,map,layer),domain=scienceDomain(values,layer);
 for(let i=0;i<t.width*t.height;i++){
  let rgb:number[],alpha=225;const value=values?.[i];
  if(layer==='feasibility'){const status=map!.state[i];rgb=status===2?[84,214,161]:status===1?[232,115,99]:status===3?[62,74,90]:status===4?[156,135,173]:(i%t.width+Math.floor(i/t.width))%4<2?[208,206,167]:[65,72,89];alpha=status===2?185:215;}
  else if(value===null||value===undefined||!Number.isFinite(value)){rgb=(i%t.width+Math.floor(i/t.width))%4<2?[197,195,157]:[65,72,89];}
  else {const q=Math.max(0,Math.min(1,(value-domain.min)/(domain.max-domain.min||1)));if(domain.min<0)rgb=q<.5?[75+q*260,139+q*170,200+q*70]:[230,224-(q-.5)*270,235-(q-.5)*310];else rgb=[52+q*197,103+Math.sin(q*Math.PI)*100,166-q*92];}
  image.data.set([...rgb.map(Math.round),alpha],i*4);
 }ctx.putImageData(image,0,0);return canvas;
}
export function compositeScience(base:HTMLCanvasElement|null,raster:HTMLCanvasElement|null,opacity:number){
 if(!base||!raster)return base;const c=document.createElement('canvas');c.width=base.width;c.height=base.height;const ctx=c.getContext('2d')!;ctx.drawImage(base,0,0);ctx.imageSmoothingEnabled=false;ctx.globalAlpha=opacity;ctx.drawImage(raster,0,0,c.width,c.height);return c;
}
