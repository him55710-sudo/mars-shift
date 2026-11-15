import * as THREE from 'three';
import type {NativeDEM} from './eva-motion';
import {nativeNormalPixels} from './surface-geometry';

/** Measured object-space normals in RGB; bounded local concavity in alpha.
 * Opposing sample pairs cancel planar slopes. Missing pairs contribute nothing.
 * This is a display shade, never a height, surface class or planner input.
 */
export function measuredSurfacePixels(native:NativeDEM){
 const pixels=nativeNormalPixels(native),{width:w,height:h,values,cellSize}=native;
 const samples=[1,3,8].flatMap(radius=>[[1,0],[0,1],[1,1],[1,-1]].map(([x,y])=>({dx:x*radius,dy:y*radius,inverseDistance:1/(radius*cellSize*Math.hypot(x,y))})));
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const centre=values[y*w+x];if(!Number.isFinite(centre))continue;
  let cavity=0,weight=0;
  for(const {dx,dy,inverseDistance} of samples){
   const ax=x+dx,ay=y+dy,bx=x-dx,by=y-dy;
   if(ax<0||ay<0||bx<0||by<0||ax>=w||bx>=w||ay>=h||by>=h)continue;
   const a=values[ay*w+ax],b=values[by*w+bx];if(!Number.isFinite(a)||!Number.isFinite(b))continue;
   cavity+=Math.max(0,(a+b)/2-centre)*inverseDistance;weight++;
  }
  const visibility=1-Math.min(.34,1.8*cavity/Math.max(1,weight));
  pixels[((h-1-y)*w+x)*4+3]=Math.round(visibility*255);
 }
 return pixels;
}

/** Apply measured cavity shading to ambient light, preserving the physical normals. */
export function installMeasuredShape(material:THREE.MeshStandardMaterial){
 const uniforms={uMeasuredShape:{value:0}},prior=material.onBeforeCompile,cache=material.customProgramCacheKey.bind(material);
 material.onBeforeCompile=(shader,renderer)=>{
  prior.call(material,shader,renderer);Object.assign(shader.uniforms,uniforms);
  shader.fragmentShader='uniform float uMeasuredShape;\n'+shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
   #ifdef USE_NORMALMAP_OBJECTSPACE
    float measuredVisibility=texture2D(normalMap,vNormalMapUv).a;
    reflectedLight.indirectDiffuse*=mix(1.,measuredVisibility,uMeasuredShape);
   #endif`);
 };
 material.customProgramCacheKey=()=>cache()+'-measured-shape-v1';return uniforms;
}
