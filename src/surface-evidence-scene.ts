import * as THREE from 'three';
import {evidenceMesh,evidencePixels} from './surface-evidence';
import type {RaisedFeature,SurfaceEvidence,SurfaceMode} from './surface-evidence';

export function createSurfaceEvidenceScene(scene:THREE.Scene,photos:THREE.Group,e:SurfaceEvidence){
 const photographicBackground=scene.background,analysisBackground=new THREE.Color('#14232b');
 const texture=new THREE.DataTexture(evidencePixels(e),e.grid.width,e.grid.height);
 texture.minFilter=THREE.NearestFilter;texture.magFilter=THREE.NearestFilter;texture.needsUpdate=true;
 const uniforms={uEvidenceMap:{value:texture},uEvidenceMode:{value:0},uEvidenceSelected:{value:0},uEvidenceBounds:{value:new THREE.Vector4(e.grid.origin[0],e.grid.origin[1],e.grid.width*e.grid.cellSize,e.grid.height*e.grid.cellSize)}};
 const mesh=(reference=false)=>{
  const a=evidenceMesh(e,reference),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(a.positions,3));g.setAttribute('color',new THREE.BufferAttribute(a.colors,3));g.setIndex(new THREE.BufferAttribute(a.indices,1));g.computeVertexNormals();
  const m=reference?new THREE.MeshBasicMaterial({color:'#94d9f7',wireframe:true,transparent:true,opacity:.35,depthWrite:false}):new THREE.MeshLambertMaterial({vertexColors:true,color:'#78999c',flatShading:true,side:THREE.DoubleSide});
  const o=new THREE.Mesh(g,m);o.visible=false;return o;
 };
 const dem=mesh(),reference=mesh(true),markers=new THREE.Group(),selection=new THREE.Group();scene.add(dem,reference,markers,selection);
 const markerMaterial=new THREE.MeshBasicMaterial({color:'#ffd080',depthTest:false,transparent:true,opacity:.8}),markerGeometry=new THREE.TorusGeometry(.055,.009,4,20);
 for(const f of e.features){const pin=new THREE.Mesh(markerGeometry,markerMaterial);pin.rotation.x=-Math.PI/2;pin.position.set(f.peak[0],f.peak[1]+.04,f.peak[2]);pin.renderOrder=6;markers.add(pin);}
 const clearSelection=()=>{selection.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.LineSegments){o.geometry.dispose();const m=o.material as THREE.Material;m.dispose();}if(o instanceof THREE.Sprite){o.material.map?.dispose();o.material.dispose();}});selection.clear();};
 let chosen:number|null=null;
 const select=(f:RaisedFeature|null)=>{
  if((f?.id??null)===chosen)return;chosen=f?.id??null;clearSelection();if(!f)return;
  const [lo,hi]=f.bounds,[bottom,top]=f.heightBounds,geometry=new THREE.BoxGeometry(Math.max(.05,hi[0]-lo[0]),Math.max(.05,top-bottom),Math.max(.05,hi[1]-lo[1])),edges=new THREE.EdgesGeometry(geometry);geometry.dispose();
  const bounds=new THREE.LineSegments(edges,new THREE.LineBasicMaterial({color:'#fff2c9',depthTest:false,transparent:true,opacity:.8}));bounds.position.set((lo[0]+hi[0])/2,(bottom+top)/2,(lo[1]+hi[1])/2);bounds.renderOrder=7;selection.add(bounds);
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#152832ee';ctx.beginPath();ctx.roundRect(1,1,510,94,20);ctx.fill();ctx.font='500 36px sans-serif';ctx.fillStyle='#fff0cb';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(`R${String(f.id).padStart(2,'0')}  ·  +${f.heightAboveReference.toFixed(2)} m`,256,49);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map,transparent:true,depthTest:false}));sprite.position.set(f.peak[0],f.peak[1]+.38,f.peak[2]);sprite.scale.set(1.1,.206,1);sprite.renderOrder=8;selection.add(sprite);
 };
 return {uniforms,dem,reference,evidence:e,
  update(mode:SurfaceMode,selected:number|null,showReference:boolean){uniforms.uEvidenceMode.value=mode==='photo'?0:mode==='features'?3:mode==='separation'?2:1;uniforms.uEvidenceSelected.value=selected??0;photos.visible=mode!=='dem';scene.background=mode==='photo'?photographicBackground:analysisBackground;dem.visible=mode==='dem';reference.visible=showReference&&mode!=='photo';markers.visible=mode!=='photo';selection.visible=mode!=='photo';select(e.features.find(f=>f.id===selected)??null);},
  dispose(){texture.dispose();for(const o of [dem,reference]){o.geometry.dispose();o.material.dispose();scene.remove(o);}markerGeometry.dispose();markerMaterial.dispose();clearSelection();scene.remove(markers,selection);}
 };
}
export type SurfaceEvidenceScene=ReturnType<typeof createSurfaceEvidenceScene>;

/** Decorate the original photo meshes; no vertex displacement or replacement rocks. */
export function addSurfaceEvidenceShader(shader:{uniforms:Record<string,unknown>;fragmentShader:string},uniforms:SurfaceEvidenceScene['uniforms']){
 Object.assign(shader.uniforms,uniforms);
 shader.fragmentShader=shader.fragmentShader.replace('if(uRoverEnabled>0.5)','if(uRoverEnabled>0.5&&uEvidenceMode<0.5)');
 shader.fragmentShader='uniform sampler2D uEvidenceMap;\nuniform float uEvidenceMode;\nuniform float uEvidenceSelected;\nuniform vec4 uEvidenceBounds;\n'+shader.fragmentShader;
 shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
  if(uEvidenceMode>0.5){
   vec2 ep=(vRoverWorld.xz-uEvidenceBounds.xy)/uEvidenceBounds.zw;
   bool inside=all(greaterThanEqual(ep,vec2(0.0)))&&all(lessThan(ep,vec2(1.0)));
   vec4 evidence=inside?texture2D(uEvidenceMap,ep):vec4(0.0);
   float cls=floor(evidence.r*255.0+0.5),ident=floor(evidence.g*255.0+0.5);
   if(uEvidenceMode>2.5&&cls!=2.0)discard;
   vec3 tint=vec3(0.45,0.53,0.55);
   if(cls==1.0)tint=vec3(0.65,0.73,0.71);
   if(cls==2.0)tint=vec3(1.0,0.56,0.20);
   if(cls==3.0)tint=vec3(0.65,0.52,0.80);
   float gray=dot(diffuseColor.rgb,vec3(0.2126,0.7152,0.0722));
   diffuseColor.rgb=mix(diffuseColor.rgb*0.72,gray*tint*1.45,cls==2.0?0.78:0.48);
   if(cls==0.0||cls==4.0){float hatch=step(0.72,fract((vRoverWorld.x+vRoverWorld.z)*7.0));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.22,0.30,0.34),0.35+0.25*hatch);}
   if(uEvidenceSelected>0.5&&abs(ident-uEvidenceSelected)<0.1)diffuseColor.rgb*=vec3(1.12,1.10,0.92);
  }
 `);
}
