import * as THREE from 'three';
import type {Point,Terrain} from './planner';
import {heightAt} from './eva-motion';
import type {NativeDEM} from './eva-motion';
import type {RegionalContext} from './regional-terrain';
import {regionalGeometry} from './regional-terrain';

export function createRegionalScene(t:Terrain,native:NativeDEM|null,c:RegionalContext,min:number){
 const group=new THREE.Group(),data=regionalGeometry(t,native,c,min),geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.BufferAttribute(data.positions,3));geometry.setAttribute('uv',new THREE.BufferAttribute(data.uv,2));geometry.setIndex(new THREE.BufferAttribute(data.indices,1));geometry.computeVertexNormals();geometry.computeBoundingSphere();
 const texture=new THREE.Texture(c.image);texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;texture.anisotropy=4;
 const material=new THREE.MeshStandardMaterial({map:texture,roughness:.96,metalness:0,side:THREE.DoubleSide});
 const nearTexture=c.nearImage?new THREE.Texture(c.nearImage):null;
 if(nearTexture&&c.meta.near){
  nearTexture.colorSpace=THREE.SRGBColorSpace;nearTexture.needsUpdate=true;nearTexture.anisotropy=8;
  const b=c.meta.near.bounds,cx=(t.bounds[0]+t.bounds[2])/2,cy=(t.bounds[1]+t.bounds[3])/2;
  const uniforms={uNearMap:{value:nearTexture},uNearOrigin:{value:new THREE.Vector2(b[0]-cx,cy-b[3])},uNearSize:{value:new THREE.Vector2(b[2]-b[0],b[3]-b[1])}};
  material.onBeforeCompile=shader=>{Object.assign(shader.uniforms,uniforms);shader.vertexShader='varying vec2 vRegionalXZ;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRegionalXZ=position.xz;');shader.fragmentShader='varying vec2 vRegionalXZ;\nuniform sampler2D uNearMap;\nuniform vec2 uNearOrigin;\nuniform vec2 uNearSize;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   vec2 nearUv=(vRegionalXZ-uNearOrigin)/uNearSize;nearUv.y=1.-nearUv.y;
   if(nearUv.x>=0.&&nearUv.y>=0.&&nearUv.x<=1.&&nearUv.y<=1.){float edge=min(min(nearUv.x,1.-nearUv.x)*uNearSize.x,min(nearUv.y,1.-nearUv.y)*uNearSize.y);diffuseColor.rgb=mix(diffuseColor.rgb,texture2D(uNearMap,nearUv).rgb,smoothstep(0.,160.,edge));}
  `);};material.customProgramCacheKey=()=> 'mars-ctx-near-detail-v1';
 }
 const mesh=new THREE.Mesh(geometry,material);group.add(mesh);
 const corners:number[]=[];const wx=t.width*t.cellSize/2-.5,wz=t.height*t.cellSize/2-.5;
 for(const sx of [-1,1])for(const sz of [-1,1])for(const axis of [0,1])for(let d=0;d<60;d+=4){
  for(const dd of [d,d+4]){const x=sx*(wx-(axis===0?dd:0)),z=sz*(wz-(axis===1?dd:0)),h=heightAt(t,{x:(x+t.width*t.cellSize/2)/t.cellSize-.5,y:(z+t.height*t.cellSize/2)/t.cellSize-.5},native);corners.push(x,(h??min)-min+1,z);}
 }
 const cornerGeometry=new THREE.BufferGeometry();cornerGeometry.setAttribute('position',new THREE.Float32BufferAttribute(corners,3));const cornerMaterial=new THREE.LineBasicMaterial({color:'#c0d8cd',transparent:true,opacity:.65,depthTest:false,depthWrite:false}),marks=new THREE.LineSegments(cornerGeometry,cornerMaterial);marks.renderOrder=4;group.add(marks);
 return {group,mesh,update:(focus?:Point)=>{const next=regionalGeometry(t,native,c,min,focus),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(next.positions,3));g.setAttribute('uv',new THREE.BufferAttribute(next.uv,2));g.setIndex(new THREE.BufferAttribute(next.indices,1));g.computeVertexNormals();g.computeBoundingSphere();mesh.geometry.dispose();mesh.geometry=g;return next.indices.length/3;},texture:nearTexture??texture,textureBounds:c.meta.near?.bounds??c.meta.bounds,triangles:data.indices.length/3,dispose:()=>{mesh.geometry.dispose();material.dispose();texture.dispose();nearTexture?.dispose();cornerGeometry.dispose();cornerMaterial.dispose();}};
}
