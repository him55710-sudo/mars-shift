/** Presentation-only locomotion. All displacement still passes through the DEM collision engine. */
export type VisorPose = {yaw:number;pitch:number;fov:number};
export type MotionVelocity = {forward:number;right:number};
export const stoppedMotion = ():MotionVelocity => ({forward:0,right:0});
export function smoothMotion(velocity:MotionVelocity,input:MotionVelocity,seconds:number,speed:number,boost=false){
 const dt=Math.max(0,Math.min(.1,seconds)),length=Math.max(1,Math.hypot(input.forward,input.right));
 const scale=Math.max(0,speed)*(boost?2:1)/length;
 const target={forward:input.forward*scale,right:input.right*scale};
 const tau=(input.forward||input.right)?.14:.055,decay=Math.exp(-dt/tau);
 const axis=(key:keyof MotionVelocity)=>({velocity:target[key]+(velocity[key]-target[key])*decay,delta:target[key]*dt+(velocity[key]-target[key])*tau*(1-decay)});
 const f=axis('forward'),r=axis('right');
 const next={forward:f.velocity,right:r.velocity};
 if(!input.forward&&!input.right&&Math.hypot(next.forward,next.right)<.001){next.forward=0;next.right=0;}
 return {velocity:next,forward:f.delta,right:r.delta};
}
export function smoothView(current:number,target:number,seconds:number,tau=.045){
 const value=target+(current-target)*Math.exp(-Math.max(0,seconds)/tau);
 return Math.abs(target-value)<1e-5?target:value;
}
export function acceptsWalkInput(target:EventTarget|null){
 return !(target instanceof HTMLElement)||!target.closest('input,select,textarea,[contenteditable="true"],[role="dialog"]');
}
