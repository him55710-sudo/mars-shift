export type RenderQuality='auto'|'detail'|'efficient';
export function qualityLimits(mode:RenderQuality,deviceRatio:number){
 const device=Number.isFinite(deviceRatio)?Math.max(.75,deviceRatio):1;
 return {max:Math.min(device,mode==='detail'?2:mode==='efficient'?1:1.5),min:Math.min(device,mode==='detail'?1.25:mode==='efficient'?.75:1),shadowSize:mode==='efficient'?512:1024};
}
/** Ignore initial shader compilation, hidden tabs and idle gaps. CPU submission and optional non-blocking GPU
 * timing are separate signals; neither is a universal frame-rate guarantee. */
export class RenderBudget {
 ratio=1;private slow=0;private fast=0;private frames=0;
 constructor(public mode:RenderQuality,private device:number){this.ratio=qualityLimits(mode,device).max;}
 sample(cpuMs:number,frameMs:number,visible:boolean,gpuMs:number|null=null){
  const limits=qualityLimits(this.mode,this.device);this.frames++;
  if(this.mode!=='auto'||this.frames<20||!visible||!Number.isFinite(cpuMs)||frameMs<5||frameMs>100)return false;
  const cost=Math.max(cpuMs,typeof gpuMs==='number'&&Number.isFinite(gpuMs)?gpuMs:0);
  const slow=cost>22&&frameMs>28;
  this.slow=slow?this.slow+1:Math.max(0,this.slow-1);
  this.fast=!slow&&cost<9&&frameMs<23?this.fast+1:0;
  const old=this.ratio;
  if(this.slow>=24){this.ratio=Math.max(limits.min,this.ratio*.85);this.slow=0;this.fast=0;}
  else if(this.fast>=120){this.ratio=Math.min(limits.max,this.ratio+.1);this.fast=0;}
  return Math.abs(old-this.ratio)>.001;
 }
}
