import {evidenceRisk} from './noah-data';
import * as THREE from 'three';
import type {Exclusion,Settings,Terrain} from './planner';
import {mappedHazard} from './mission-map-model';

export function groundHazardPixels(t:Terrain,s:Settings,e:Exclusion|null){
 const pixels=new Uint8Array(t.width*t.height*4);
 for(let i=0;i<t.width*t.height;i++){if(t.noah&&t.noah.coverage.sampledFraction>0){const h=evidenceRisk(t,t.noah,i,s,e).state;pixels.set(h==='constraint'?[245,89,63,235]:h==='candidate'?[244,173,64,180]:h==='unknown'?[135,145,157,145]:[0,0,0,0],i*4);continue;}const h=mappedHazard(t,i,s,e);pixels.set(h==='excluded'?[245,89,63,235]:h==='steep-proximity'?[244,173,64,180]:h==='unknown'?[135,145,157,145]:[0,0,0,0],i*4);}return pixels;
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
    float phase = (vGroundPosition.x + vGroundPosition.z) / 2.4;
    float footprint = max(fwidth(phase), 0.002);
    float hatch = (1.0 - smoothstep(0.055, 0.055 + footprint, abs(fract(phase) - 0.5))) * (1.0 - smoothstep(0.12, 0.35, footprint));
    // Thin category boundaries preserve the observed optical texture beneath.
    vec2 edgeStep = vec2(0.6) / uTerrainSize;
    float boundary = max(max(length(hazard - texture2D(uGroundHazards, maskUv + vec2(edgeStep.x,0.0))), length(hazard - texture2D(uGroundHazards, maskUv - vec2(edgeStep.x,0.0)))), max(length(hazard - texture2D(uGroundHazards, maskUv + vec2(0.0,edgeStep.y))), length(hazard - texture2D(uGroundHazards, maskUv - vec2(0.0,edgeStep.y)))));
    float fade = 1.0 - smoothstep(35.0, 110.0, distance(vGroundPosition, cameraPosition));
    float intensity = hazard.a * (0.025 + 0.22 * hatch + 0.34 * min(1.0,boundary)) * fade;
    diffuseColor.rgb = mix(diffuseColor.rgb, hazard.rgb, intensity);
   }`);
 };
 material.customProgramCacheKey=()=> 'mars-ground-hazard-v2';return uniforms;
}
export function routeRibbonMaterial(color:string,inbound=false,boundary=false){
 return new THREE.ShaderMaterial({uniforms:{uColor:{value:new THREE.Color(color)},uInbound:{value:inbound?1:0},uBoundary:{value:boundary?1:0}},vertexShader:'varying vec2 vRibbonUv; varying float vDistance; void main(){vRibbonUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.0);vDistance=length(mv.xyz);gl_Position=projectionMatrix*mv;}',fragmentShader:`uniform vec3 uColor; uniform float uInbound; uniform float uBoundary; varying vec2 vRibbonUv; varying float vDistance;
 void main(){
  float across=abs(vRibbonUv.x-.5)*2.;
  float aa=max(fwidth(across),.015);
  float edge=1.-smoothstep(.84-aa,1.,across);
  float core=1.-smoothstep(.09,.09+aa,across);
  float phase=mod(vRibbonUv.y,6.);
  float chevron=1.-smoothstep(.12,.12+max(fwidth(phase),.025),abs(phase-(.75-across*.6)));
  float dash=uInbound>.5?step(mod(vRibbonUv.y,4.),2.5):1.;
  float fade=1.-smoothstep(65.,140.,vDistance);
  float alpha=mix(.10+.65*core+.72*chevron,.8,uBoundary)*edge*dash*fade;
  gl_FragColor=vec4(mix(uColor,vec3(1.),chevron*.24*(1.-uBoundary)),alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }`,transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
}
