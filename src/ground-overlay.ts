import {riskPixel} from './hazard-visual';
import {evidenceRisk} from './noah-data';
import * as THREE from 'three';
import type {Exclusion,Settings,Terrain} from './planner';
import {blocked} from './planner';
import {mappedHazard} from './mission-map-model';
import {sandScreen} from './sand-screening';

export function groundHazardPixels(t:Terrain,s:Settings,e:Exclusion|null){
 const pixels=new Uint8Array(t.width*t.height*4);
 const sand=sandScreen(t),withoutSand={...s,avoidSand:false};
 for(let i=0;i<t.width*t.height;i++){if(sand.excluded[i]&&!blocked(t,i,withoutSand,e)){pixels.set(sand.candidate[i]?riskPixel():riskPixel(220),i*4);continue;}if(t.noah&&t.noah.coverage.sampledFraction>0){const h=evidenceRisk(t,t.noah,i,s,e).state;pixels.set(h==='constraint'?[245,89,63,235]:h==='candidate'?[244,173,64,180]:h==='unknown'?[135,145,157,145]:[0,0,0,0],i*4);continue;}const h=mappedHazard(t,i,s,e);pixels.set(h==='excluded'?[245,89,63,235]:h==='steep-proximity'?[244,173,64,180]:h==='unknown'?[135,145,157,145]:[0,0,0,0],i*4);}return pixels;
}
export function installGroundOverlay(material:THREE.MeshStandardMaterial,width:number,height:number){
 const uniforms={uGroundHazards:{value:null as THREE.DataTexture|null},uGroundEnabled:{value:0},uGroundOverview:{value:0},uRegionalMap:{value:null as THREE.Texture|null},uRegionalEnabled:{value:0},uRegionalOrigin:{value:new THREE.Vector2()},uRegionalSize:{value:new THREE.Vector2()},uTerrainSize:{value:new THREE.Vector2(width,height)}};
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,uniforms);
  shader.vertexShader='varying vec3 vGroundPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvGroundPosition = position;');
  shader.fragmentShader='varying vec3 vGroundPosition;\nuniform sampler2D uGroundHazards;\nuniform float uGroundEnabled;\nuniform float uGroundOverview;\nuniform vec2 uTerrainSize;\nuniform sampler2D uRegionalMap;\nuniform float uRegionalEnabled;\nuniform vec2 uRegionalOrigin;\nuniform vec2 uRegionalSize;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   if(uRegionalEnabled>.5){
    float insideEdge=min(uTerrainSize.x*.5-abs(vGroundPosition.x),uTerrainSize.y*.5-abs(vGroundPosition.z));
    float contextBlend=1.-smoothstep(0.,90.,insideEdge);
    vec2 contextUv=(vGroundPosition.xz-uRegionalOrigin)/uRegionalSize;contextUv.y=1.-contextUv.y;
    diffuseColor.rgb=mix(diffuseColor.rgb,texture2D(uRegionalMap,contextUv).rgb,contextBlend);
   }
   if (uGroundEnabled > 0.5) {
    vec2 maskUv = vGroundPosition.xz / uTerrainSize + 0.5;
    vec4 hazard = texture2D(uGroundHazards, maskUv);
    float phase = (vGroundPosition.x + vGroundPosition.z) / mix(2.4, 12.0, uGroundOverview);
    float footprint = max(fwidth(phase), 0.002);
    float hatch = (1.0 - smoothstep(0.055, 0.055 + footprint, abs(fract(phase) - 0.5))) * (1.0 - smoothstep(0.12, 0.35, footprint));
    // Thin category boundaries preserve the observed optical texture beneath.
    vec2 edgeStep = vec2(0.6) / uTerrainSize;
    float boundary = max(max(length(hazard - texture2D(uGroundHazards, maskUv + vec2(edgeStep.x,0.0))), length(hazard - texture2D(uGroundHazards, maskUv - vec2(edgeStep.x,0.0)))), max(length(hazard - texture2D(uGroundHazards, maskUv + vec2(0.0,edgeStep.y))), length(hazard - texture2D(uGroundHazards, maskUv - vec2(0.0,edgeStep.y)))));
    float fade = 1.0 - smoothstep(60.0, 150.0, distance(vGroundPosition, cameraPosition));
    float sandEmphasis = step(0.8, hazard.a) * step(hazard.g, 0.48);
    float ordinary = mix(0.025,0.25,uGroundOverview) + 0.22 * hatch + 0.34 * min(1.0,boundary);
    float sandEdge = mix(0.04,0.30,uGroundOverview) + 0.32 * hatch + 0.64 * min(1.0,boundary);
    float intensity = hazard.a * mix(ordinary, sandEdge, sandEmphasis) * mix(fade,1.0,uGroundOverview);
    diffuseColor.rgb = mix(diffuseColor.rgb, hazard.rgb, intensity);
   }`);
 };
material.customProgramCacheKey=()=> 'mars-ground-hazard-v6-continuous-red';return uniforms;
}
export function routeRibbonMaterial(color:string,inbound=false,boundary=false){
 return new THREE.ShaderMaterial({uniforms:{uColor:{value:new THREE.Color(color)},uInbound:{value:inbound?1:0},uBoundary:{value:boundary?1:0}},vertexShader:'varying vec2 vRibbonUv; varying float vDistance; void main(){vRibbonUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.0);vDistance=length(mv.xyz);gl_Position=projectionMatrix*mv;}',fragmentShader:`uniform vec3 uColor; uniform float uInbound; uniform float uBoundary; varying vec2 vRibbonUv; varying float vDistance;
 void main(){
  float across=abs(vRibbonUv.x-.5)*2.;
  float aa=max(fwidth(across),.015);
  float edge=1.-smoothstep(.84-aa,1.,across);
  float core=1.-smoothstep(.17,.17+aa,across);
  float phase=mod(vRibbonUv.y,6.);
  float chevron=1.-smoothstep(.20,.20+max(fwidth(phase),.025),abs(phase-(.75-across*.6)));
  float dash=uInbound>.5?step(mod(vRibbonUv.y,4.),2.5):1.;
  float fade=1.-smoothstep(65.,140.,vDistance);
  float alpha=min(.96,mix(.14+.70*core+.85*chevron,.9,uBoundary))*edge*dash*fade;
  gl_FragColor=vec4(mix(uColor,vec3(1.),chevron*.24*(1.-uBoundary)),alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }`,transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
}
