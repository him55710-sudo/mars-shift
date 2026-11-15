import type {Terrain} from './planner';
import type {NativeDEM} from './eva-motion';
import {heightAt} from './eva-motion';
import {surfaceAxis} from './surface-geometry';

export type RegionalPatch={width:number;height:number;cellSize:number;bounds:number[];binarySha256:string;imageSha256:string};
export type RegionalMetadata={near?:RegionalPatch;schemaVersion:number;width:number;height:number;cellSize:number;bounds:number[];focusBounds:number[];crs:string;dataType:string;byteOrder:string;verticalUnits:string;binarySha256:string;imageSha256:string;demSource:{nativeResolutionMetres:number[];url:string};opticalSource:{imageResolutionMetres:number}};
export type RegionalDEM={meta:RegionalMetadata;values:Float32Array;nearValues?:Float32Array};
export type RegionalContext=RegionalDEM&{image:HTMLImageElement;nearImage?:HTMLImageElement};
export function assertRegionalRegistration(t:Terrain,m:RegionalMetadata,bytes:number){
 if(m.schemaVersion!==1||!Number.isInteger(m.width)||!Number.isInteger(m.height)||m.width<2||m.height<2||m.width>1024||m.height>1024||bytes!==m.width*m.height*4)throw Error('Regional DEM dimensions are invalid.');
 if(m.crs!==t.crs||m.verticalUnits!=='metres'||m.dataType!=='float32'||m.byteOrder!=='little-endian'||!Number.isFinite(m.cellSize)||m.cellSize<=0)throw Error('Regional DEM coordinates or units differ from the analysis map.');
 if(m.bounds?.length!==4||m.focusBounds?.length!==4||m.bounds.some(v=>!Number.isFinite(v))||m.focusBounds.some((v,i)=>Math.abs(v-t.bounds[i])>1e-6))throw Error('Regional DEM is not registered to this study footprint.');
 if(Math.abs(m.bounds[2]-m.bounds[0]-m.width*m.cellSize)>1e-6||Math.abs(m.bounds[3]-m.bounds[1]-m.height*m.cellSize)>1e-6||m.bounds[0]>=t.bounds[0]-200||m.bounds[1]>=t.bounds[1]-200||m.bounds[2]<=t.bounds[2]+200||m.bounds[3]<=t.bounds[3]+200||!(/^[a-f0-9]{64}$/).test(m.binarySha256)||!(/^[a-f0-9]{64}$/).test(m.imageSha256))throw Error('Regional DEM footprint or provenance is invalid.');
 if(m.near){const n=m.near;if(!Number.isInteger(n.width)||!Number.isInteger(n.height)||n.width<2||n.height<2||n.width>1024||n.height>1024||!Number.isFinite(n.cellSize)||n.cellSize<=0||n.bounds?.length!==4||n.bounds.some(v=>!Number.isFinite(v))||Math.abs(n.bounds[2]-n.bounds[0]-n.width*n.cellSize)>1e-6||Math.abs(n.bounds[3]-n.bounds[1]-n.height*n.cellSize)>1e-6||!(/^[a-f0-9]{64}$/).test(n.binarySha256)||!(/^[a-f0-9]{64}$/).test(n.imageSha256))throw Error('Near-context grid registration is invalid.');}
}

/** Same easting/northing frame as the unchanged planning raster. */
function sampleRaster(m:{width:number;height:number;cellSize:number;bounds:number[]},values:Float32Array,east:number,north:number):number|null{
 const px=(east-m.bounds[0])/m.cellSize-.5,py=(m.bounds[3]-north)/m.cellSize-.5;
 if(px<0||py<0||px>m.width-1||py>m.height-1)return null;
 const x0=Math.floor(px),y0=Math.floor(py),x1=Math.min(m.width-1,x0+1),y1=Math.min(m.height-1,y0+1),fx=px-x0,fy=py-y0,v=[values[y0*m.width+x0],values[y0*m.width+x1],values[y1*m.width+x0],values[y1*m.width+x1]];
 if(v.some(e=>!Number.isFinite(e)))return null;
 return v[0]*(1-fx)*(1-fy)+v[1]*fx*(1-fy)+v[2]*(1-fx)*fy+v[3]*fx*fy;
}
export function regionalHeight(t:Terrain,c:RegionalDEM,x:number,z:number):number|null{
 const east=(t.bounds[0]+t.bounds[2])/2+x,north=(t.bounds[1]+t.bounds[3])/2-z,far=sampleRaster(c.meta,c.values,east,north),patch=c.meta.near;
 if(!patch||!c.nearValues)return far;
 const near=sampleRaster(patch,c.nearValues,east,north);if(near===null)return far;
 const edge=Math.min(east-patch.bounds[0],patch.bounds[2]-east,north-patch.bounds[1],patch.bounds[3]-north),q=Math.max(0,Math.min(1,edge/200)),blend=q*q*(3-2*q);
 return far===null?near:near*blend+far*(1-blend);
}

/** A conforming outer ring shares every orbital DEM boundary vertex exactly.
 * The 200 m transition is display interpolation, never a planning observation.
 */
export function regionalGeometry(t:Terrain,native:NativeDEM|null,c:RegionalDEM,min:number){
 const width=t.width*t.cellSize,height=t.height*t.cellSize,cell=native?.cellSize??t.cellSize;
 const axis=(n:number)=>native?surfaceAxis(n,0,false):Array.from({length:n},(_,i)=>i);
 const xs=axis(native?.width??t.width).map(i=>(i+.5)*cell-width/2),zs=axis(native?.height??t.height).map(i=>(i+.5)*cell-height/2);
 const left=xs[0],right=xs.at(-1)!,top=zs[0],bottom=zs.at(-1)!;
 const edge=[...xs.map(x=>({x,z:top})),...zs.slice(1).map(z=>({x:right,z})),...xs.slice(0,-1).reverse().map(x=>({x,z:bottom})),...zs.slice(1,-1).reverse().map(z=>({x:left,z}))];
 const cx=(t.bounds[0]+t.bounds[2])/2,cy=(t.bounds[1]+t.bounds[3])/2,b=c.meta.bounds;
 const outer=Math.min(cx-b[0],b[2]-cx,cy-b[1],b[3]-cy)-c.meta.cellSize;
 const maximum=outer-Math.max(right,bottom),offsets=[0,20,60,...Array.from({length:37},(_,i)=>(i+1)*40).filter(v=>v>60),1800,2200,2800,3600,4500,6000,8000,maximum].filter((v,i,a)=>v>=0&&v<=maximum&&(i===0||v>a[i-1]));
 const positions:number[]=[],uv:number[]=[],valid:boolean[]=[],indices:number[]=[];
 for(const offset of offsets)for(const p of edge){
  const x=p.x*(1+offset/right),z=p.z*(1+offset/bottom),regional=regionalHeight(t,c,x,z),sourceIndex=native?Math.round((p.z+height/2)/cell-.5)*native.width+Math.round((p.x+width/2)/cell-.5):-1,raw=native?native.values[sourceIndex]:heightAt(t,{x:(p.x+width/2)/t.cellSize-.5,y:(p.z+height/2)/t.cellSize-.5}),local=raw!==null&&Number.isFinite(raw)?raw:null;
  const q=Math.min(1,offset/200),blend=q*q*(3-2*q),e=offset===0?(local??regional):regional===null?null:local===null?regional:local*(1-blend)+regional*blend;
  positions.push(x,e===null?0:e-min,z);uv.push((cx+x-b[0])/(b[2]-b[0]),1-(b[3]-(cy-z))/(b[3]-b[1]));valid.push(e!==null);
 }
 for(let ring=0;ring<offsets.length-1;ring++)for(let i=0;i<edge.length;i++){
  const a=ring*edge.length+i,b=ring*edge.length+(i+1)%edge.length,d=(ring+1)*edge.length+i,e=(ring+1)*edge.length+(i+1)%edge.length;
  // Consistent upward winding. No quads fill the authoritative inner footprint.
  if(valid[a]&&valid[b]&&valid[d])indices.push(a,b,d);
  if(valid[b]&&valid[d]&&valid[e])indices.push(b,e,d);
 }
 return {positions:new Float32Array(positions),uv:new Float32Array(uv),indices:new Uint32Array(indices),boundaryCount:edge.length,ringCount:offsets.length};
}
