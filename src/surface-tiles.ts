import * as THREE from 'three';
import type {Point,Terrain} from './planner';

export const TILE_SIZE=512,ATLAS_SIZE=1024;
export type TileLevel={level:number;pixels:number;metresPerPixel:number;tiles:{x:number;y:number;url:string;width:number;height:number;bytes:number;sha256:string}[]};
type Manifest={schemaVersion:number;bounds:number[];crs:string;tileSize:number;levels:TileLevel[]};
/** Centre a 2x2 native-pixel window around the crew, clamped to the actual footprint. */
export function tileWindow(pixels:number,eastFraction:number,southFraction:number){
 const max=Math.max(0,Math.ceil(pixels/TILE_SIZE)-2),x=Math.max(0,Math.min(max,Math.floor(eastFraction*pixels/TILE_SIZE-.5))),y=Math.max(0,Math.min(max,Math.floor(southFraction*pixels/TILE_SIZE-.5)));
 return {x,y,origin:[x*TILE_SIZE/pixels,y*TILE_SIZE/pixels],span:ATLAS_SIZE/pixels};
}
/** Inject detail before hazard hatching so hazards stay visible over observed imagery. */
export function installSurfaceDetail(material:THREE.MeshStandardMaterial){
 const uniforms={uDetailMap:{value:null as THREE.CanvasTexture|null},uDetailOrigin:{value:new THREE.Vector2()},uDetailSpan:{value:1},uDetailEnabled:{value:0}};
 const prior=material.onBeforeCompile;
 material.onBeforeCompile=(shader,renderer)=>{
  prior.call(material,shader,renderer);Object.assign(shader.uniforms,uniforms);
  shader.fragmentShader='uniform sampler2D uDetailMap;\nuniform vec2 uDetailOrigin;\nuniform float uDetailSpan;\nuniform float uDetailEnabled;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   #ifdef USE_MAP
   if(uDetailEnabled > 0.5){
    vec2 opticalUv=vec2(vMapUv.x,1.0-vMapUv.y);
    vec2 detailUv=(opticalUv-uDetailOrigin)/uDetailSpan;
    float border=min(min(detailUv.x,detailUv.y),min(1.0-detailUv.x,1.0-detailUv.y));
    float weight=smoothstep(0.0,0.12,border);
    vec4 detail=texture2D(uDetailMap,vec2(detailUv.x,1.0-detailUv.y));
    diffuseColor.rgb=mix(diffuseColor.rgb,diffuse*detail.rgb,weight*detail.a);
   }
   #endif`);
 };
 material.customProgramCacheKey=()=> 'mars-ground-detail-v1';return uniforms;
}

/** Four resident images and a 4 MB atlas; never fetch the whole native display image. */
export function createSurfaceTileStream(t:Terrain,uniforms:ReturnType<typeof installSurfaceDetail>,render:()=>void,status:(s:string)=>void){
 let alive=true,manifest:Manifest|null=null,wanted='',revision=0,enabled=false,last:Point|null=null;
 const root=(t.assetRoot??'/data')+'/surface-tiles',controller=new AbortController(),canvas=document.createElement('canvas');canvas.width=canvas.height=ATLAS_SIZE;
 const ctx=canvas.getContext('2d')!,texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.anisotropy=16;uniforms.uDetailMap.value=texture;
 const requests=new Set<HTMLImageElement>();
 const update=(p:Point,on:boolean)=>{
  last=p;enabled=on;if(!on){uniforms.uDetailEnabled.value=0;return;}if(!manifest)return;
  const level=manifest.levels.at(-1)!,w=tileWindow(level.pixels,(p.x+.5)/t.width,(p.y+.5)/t.height),key=`${level.level}:${w.x}:${w.y}`;
  if(key===wanted)return;
  if(wanted===key+':ready'){uniforms.uDetailEnabled.value=1;return;}
  wanted=key;const token=++revision;status('loading');
  const tiles=level.tiles.filter(v=>v.x>=w.x&&v.x<w.x+2&&v.y>=w.y&&v.y<w.y+2);
  Promise.all(tiles.map(tile=>new Promise<{tile:typeof tile;image:HTMLImageElement}>((resolve,reject)=>{const image=new Image();requests.add(image);image.onload=()=>{requests.delete(image);resolve({tile,image});};image.onerror=()=>{requests.delete(image);reject(Error('Detail tile unavailable'));};image.src=root+'/'+tile.url;}))).then(images=>{
   if(!alive||token!==revision)return;ctx.clearRect(0,0,ATLAS_SIZE,ATLAS_SIZE);for(const {tile,image} of images)ctx.drawImage(image,(tile.x-w.x)*TILE_SIZE,(tile.y-w.y)*TILE_SIZE);
   uniforms.uDetailOrigin.value.set(w.origin[0],w.origin[1]);uniforms.uDetailSpan.value=w.span;uniforms.uDetailEnabled.value=enabled?1:0;texture.needsUpdate=true;wanted=key+':ready';status('native detail · four tiles');render();
  }).catch(()=>{if(alive&&token===revision){status('coarse observed fallback');uniforms.uDetailEnabled.value=0;render();}});
 };
 fetch(root+'/manifest.json',{signal:controller.signal}).then(r=>{if(!r.ok)throw Error('Detail manifest unavailable');return r.json();}).then((m:Manifest)=>{
  if(!alive)return;if(m.schemaVersion!==1||m.tileSize!==TILE_SIZE||m.bounds.length!==4||m.bounds.some((v,i)=>Math.abs(v-t.bounds[i])>1e-8)||m.crs!==t.crs||!m.levels.length)throw Error('Detail registration mismatch');manifest=m;if(last)update(last,enabled);
 }).catch(()=>{if(alive)status('coarse observed fallback');});
 return {update,dispose(){alive=false;controller.abort();for(const image of requests){image.onload=null;image.onerror=null;image.src='';}requests.clear();texture.dispose();uniforms.uDetailMap.value=null;}};
}
