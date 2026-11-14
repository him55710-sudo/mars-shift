/** Optional non-blocking WebGL2 timing. Never synchronously waits for the GPU. */
export class GpuTimer {
 private extension:any;private query:WebGLQuery|null=null;private running=false;
 milliseconds:number|null=null;
 private gl:WebGL2RenderingContext;
 constructor(context:WebGL2RenderingContext|WebGLRenderingContext){this.gl=context as WebGL2RenderingContext;this.extension='beginQuery' in context?context.getExtension('EXT_disjoint_timer_query_webgl2'):null;}
 get supported(){return Boolean(this.extension);}
 begin(){
  if(!this.extension||this.gl.isContextLost())return;
  if(this.query){
   if(this.gl.getQueryParameter(this.query,this.gl.QUERY_RESULT_AVAILABLE)){
    this.milliseconds=this.gl.getParameter(this.extension.GPU_DISJOINT_EXT)?null:this.gl.getQueryParameter(this.query,this.gl.QUERY_RESULT)/1e6;
    this.gl.deleteQuery(this.query);this.query=null;
   }else return;
  }
  this.query=this.gl.createQuery();if(!this.query)return;
  this.gl.beginQuery(this.extension.TIME_ELAPSED_EXT,this.query);this.running=true;
 }
 end(){if(this.running){this.gl.endQuery(this.extension.TIME_ELAPSED_EXT);this.running=false;}}
 dispose(){if(this.running)this.end();if(this.query)this.gl.deleteQuery(this.query);this.query=null;}
}
