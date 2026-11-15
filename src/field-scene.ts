import * as THREE from 'three';
import {groundRibbon} from './surface-geometry';
import {heightAt} from './eva-motion';
import type {NativeDEM} from './eva-motion';
import type {Terrain} from './planner';
import type {FieldZone} from './field-navigation';
import {FIELD_COLORS} from './field-navigation';

export type FieldOverlay={markerNumbers?:Record<string,number>;pixels:Uint8Array;paths:{cells:number[];color:string;dashed?:boolean;flow?:boolean}[];markers:FieldZone[];selectedId:string|null;revision:number;animate:boolean};

/** Display geometry only: the unsmoothed graph paths still determine every decision. */
export function createFieldScene(t:Terrain,native:NativeDEM|null,min:number,overlay:FieldOverlay){
 const group=new THREE.Group(),animated:THREE.ShaderMaterial[]=[];
 for(const path of overlay.paths){
  const data=groundRibbon(t,native,path.cells,min,path.flow?4:2.5);
  for(let i=1;i<data.positions.length;i+=3)data.positions[i]+=.7;
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(data.positions,3));geometry.setAttribute('uv',new THREE.BufferAttribute(data.uv,2));geometry.setIndex(new THREE.BufferAttribute(data.indices,1));
  const material=new THREE.ShaderMaterial({uniforms:{uColor:{value:new THREE.Color(path.color)},uTime:{value:0},uFlow:{value:path.flow?1:0},uDashed:{value:path.dashed?1:0}},vertexShader:'varying vec2 vUv; varying float vCameraDistance; void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.);vCameraDistance=length(mv.xyz);gl_Position=projectionMatrix*mv;}',fragmentShader:`uniform vec3 uColor; uniform float uTime; uniform float uFlow; uniform float uDashed; varying vec2 vUv; varying float vCameraDistance;
   void main(){float edge=1.-smoothstep(.76,1.,abs(vUv.x-.5)*2.);float phase=mod(vUv.y-uTime*12.,22.);float arrow=1.-smoothstep(1.,2.5,abs(phase-(5.-abs(vUv.x-.5)*7.)));float dash=mix(1.,step(mod(vUv.y,12.),7.),uDashed);gl_FragColor=vec4(mix(uColor,vec3(1.),arrow*uFlow*.7),edge*dash*mix(.65,.95,uFlow)*smoothstep(120.,420.,vCameraDistance));
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
  }`,transparent:true,depthTest:true,depthWrite:false,side:THREE.DoubleSide});
  const mesh=new THREE.Mesh(geometry,material);mesh.renderOrder=5;group.add(mesh);if(path.flow)animated.push(material);
 }
 for(const [number,zone] of overlay.markers.entries()){
  const color=zone.source!=='derived'?'#f17a82':FIELD_COLORS[zone.kind];
  const centre=heightAt(t,zone.point,native);if(centre===null)continue;
  const radius=zone.source==='derived'?Math.min(22,Math.max(7,Math.sqrt(zone.area/Math.PI))):zone.radius;
  const points:THREE.Vector3[]=[];
  for(let k=0;k<=64;k++){
   const angle=k*Math.PI/32,p={x:zone.point.x+Math.cos(angle)*radius/t.cellSize,y:zone.point.y+Math.sin(angle)*radius/t.cellSize},h=heightAt(t,p,native);
   points.push(new THREE.Vector3((p.x+.5-t.width/2)*t.cellSize,(h??centre)-min+1,(p.y+.5-t.height/2)*t.cellSize));
  }
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color,depthTest:false,depthWrite:false,transparent:true,opacity:zone.id===overlay.selectedId?1:.8}));line.renderOrder=7;line.userData.fieldZone=zone;group.add(line);
  const pin=new THREE.Mesh(new THREE.OctahedronGeometry(zone.id===overlay.selectedId?5:3.4),new THREE.MeshBasicMaterial({color,depthTest:false,depthWrite:false}));pin.position.set((zone.point.x+.5-t.width/2)*t.cellSize,centre-min+9,(zone.point.y+.5-t.height/2)*t.cellSize);pin.renderOrder=8;pin.userData.fieldZone=zone;group.add(pin);
  const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#12202dee';ctx.beginPath();ctx.arc(32,32,28,0,Math.PI*2);ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke();ctx.fillStyle=color;ctx.font='600 27px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(overlay.markerNumbers?.[zone.id]??number+1).padStart(2,'0'),32,33);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;const label=new THREE.Sprite(new THREE.SpriteMaterial({map,transparent:true,depthTest:false,depthWrite:false,sizeAttenuation:false}));label.position.copy(pin.position).add(new THREE.Vector3(0,6,0));label.scale.set(.036,.036,1);label.userData.fieldZone=zone;label.renderOrder=9;group.add(label);
 }
 return {group,tick:(seconds:number)=>animated.forEach(m=>{m.uniforms.uTime.value=seconds;})};
}
