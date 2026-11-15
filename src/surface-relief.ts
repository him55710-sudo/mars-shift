import * as THREE from 'three';
/** Precomputed DEM horizon occlusion; no ray marches in the render loop.
 * Same fixed display sun as EVA, disabled for orbit and quantitative layers.
 */
export function installTerrainRelief(material:THREE.MeshStandardMaterial){
 const uniforms={uTerrainRelief:{value:null as THREE.Texture|null},uReliefEnabled:{value:0}},prior=material.onBeforeCompile,cache=material.customProgramCacheKey.bind(material);
 material.onBeforeCompile=(shader,renderer)=>{
  prior.call(material,shader,renderer);Object.assign(shader.uniforms,uniforms);
  shader.fragmentShader='uniform sampler2D uTerrainRelief;\nuniform float uReliefEnabled;\n'+shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
   #ifdef USE_MAP
   if(uReliefEnabled > 0.5){
    float visibility=texture2D(uTerrainRelief,vMapUv).r;
    reflectedLight.directDiffuse *= mix(0.15,1.0,visibility);
   }
   #endif`);
 };
 material.customProgramCacheKey=()=>cache()+'-dem-relief-v1';return uniforms;
}
