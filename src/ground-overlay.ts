import * as THREE from 'three';
import type {Exclusion,Settings,Terrain} from './planner';
import {mappedHazard} from './mission-map-model';

export function groundHazardPixels(t:Terrain,s:Settings,e:Exclusion|null){
 const pixels=new Uint8Array(t.width*t.height*4);
 for(let i=0;i<t.width*t.height;i++){const h=mappedHazard(t,i,s,e);pixels.set(h==='excluded'?[245,89,63,235]:h==='steep-proximity'?[244,173,64,180]:h==='unknown'?[165,145,201,210]:[0,0,0,0],i*4);}return pixels;
}
export function installGroundOverlay(material:THREE.MeshStandardMaterial,width:number,height:number){
 const uniforms={uGroundHazards:{value:null as THREE.DataTexture|null},uGroundEnabled:{value:0},uTerrainSize:{value:new THREE.Vector2(width,height)}};
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,uniforms);
  shader.vertexShader='varying vec3 vGroundPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvGroundPosition = position;');
  shader.fragmentShader='varying vec3 vGroundPosition;\nuniform sampler2D uGroundHazards;\nuniform float uGroundEnabled;\nuniform vec2 uTerrainSize;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   if (uGroundEnabled > 0.5) {
    vec2 maskUv = vGroundPosition.xz / uTerrainSize + 0.5;
    vec4 hazard = texture2D(uGroundHazards, maskUv);
    float hatch = smoothstep(0.5, 0.65, fract((vGroundPosition.x + vGroundPosition.z) / 1.6));
    float fade = 1.0 - smoothstep(140.0, 280.0, distance(vGroundPosition, cameraPosition));
    float intensity = hazard.a * (0.17 + 0.52 * hatch) * fade;
    diffuseColor.rgb = mix(diffuseColor.rgb, hazard.rgb, intensity);
   }`);
 };
 material.customProgramCacheKey=()=> 'mars-ground-hazard-v1';return uniforms;
}
export function routeRibbonMaterial(color:string,inbound=false){
 return new THREE.ShaderMaterial({uniforms:{uColor:{value:new THREE.Color(color)},uTime:{value:0},uInbound:{value:inbound?1:0}},vertexShader:'varying vec2 vRibbonUv; void main(){vRibbonUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`uniform vec3 uColor; uniform float uTime; uniform float uInbound; varying vec2 vRibbonUv;
 void main(){float across=abs(vRibbonUv.x-.5)*2.;float edge=1.-smoothstep(.68,1.,across);float core=1.-smoothstep(.06,.28,across);float phase=mod(vRibbonUv.y-uTime*.8,12.);float chevron=step(abs(vRibbonUv.x-.5),max(0.,1.7-phase)*.24)*step(phase,1.7);float dash=uInbound>.5?step(mod(vRibbonUv.y,4.),2.):1.;float alpha=(.13+core*.55+chevron*.65)*edge*dash;gl_FragColor=vec4(mix(uColor,vec3(1.),chevron*.45),alpha);}`,transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
}
