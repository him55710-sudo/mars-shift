import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
export default function PlanetBackdrop(){
 const host=useRef<HTMLDivElement>(null),[failed,setFailed]=useState(false);
 useEffect(()=>{const el=host.current;if(!el)return;let renderer:THREE.WebGLRenderer;try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});}catch{setFailed(true);return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;el.append(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(36,1,.1,150),group=new THREE.Group();scene.add(group);camera.position.z=8;
  const geometry=new THREE.SphereGeometry(1.95,96,64),material=new THREE.MeshStandardMaterial({roughness:1,color:'#b67d5e'}),planet=new THREE.Mesh(geometry,material);group.add(planet);
  const texture=new THREE.TextureLoader().load('/media/mars-global.jpg',t=>{t.colorSpace=THREE.SRGBColorSpace;material.map=t;material.color.set('#fff');material.needsUpdate=true;},undefined,()=>setFailed(true));
  group.rotation.z=.12;planet.rotation.y=2.8;
  scene.add(new THREE.AmbientLight('#d8e5f8',.28));const light=new THREE.DirectionalLight('#ffe7d4',3.6);light.position.set(-4,3,5);scene.add(light);
  const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(2.005,64,48),new THREE.ShaderMaterial({transparent:true,side:THREE.BackSide,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{color:{value:new THREE.Color('#a35232')}},vertexShader:'varying vec3 n;varying vec3 v;void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',fragmentShader:'varying vec3 n;varying vec3 v;uniform vec3 color;void main(){float a=pow(1.-abs(dot(normalize(n),normalize(v))),3.);gl_FragColor=vec4(color,a*.65);}'}));group.add(atmosphere);
  const stars=new THREE.BufferGeometry(),positions=new Float32Array(600*3);let seed=841;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};for(let i=0;i<600;i++){const a=random()*Math.PI*2,z=random()*2-1,r=Math.sqrt(1-z*z);positions.set([r*Math.cos(a)*65,r*Math.sin(a)*65,z*65],i*3);}stars.setAttribute('position',new THREE.BufferAttribute(positions,3));const dots=new THREE.Points(stars,new THREE.PointsMaterial({color:'#bfcde0',size:.07,transparent:true,opacity:.55}));scene.add(dots);
  const resize=()=>{const w=innerWidth,h=innerHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();};resize();addEventListener('resize',resize);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');let frame=0,progress=0,last=0,active=true;
  const visibility=()=>{active=!document.hidden;};document.addEventListener('visibilitychange',visibility);
  const tick=(now:number)=>{frame=requestAnimationFrame(tick);if(!active||now-last<32)return;last=now;const p=scrollY/Math.max(1,document.documentElement.scrollHeight-innerHeight);progress+=((reduced.matches?0:p)-progress)*.07;
   const side=Math.min(1,innerWidth/1200),scale=(1.7-Math.sin(progress*Math.PI)*.95)*Math.max(.66,Math.min(1,innerWidth/1000));group.scale.setScalar(scale);group.position.set(Math.sin(progress*Math.PI*2)*2.5*side,-2.65+Math.sin(progress*Math.PI)*3.2,0);planet.rotation.y=2.8+progress*2.4+(reduced.matches?0:now*.000008);renderer.render(scene,camera);
  };frame=requestAnimationFrame(tick);
  return()=>{cancelAnimationFrame(frame);removeEventListener('resize',resize);document.removeEventListener('visibilitychange',visibility);texture.dispose();geometry.dispose();material.dispose();atmosphere.geometry.dispose();atmosphere.material.dispose();stars.dispose();(dots.material as THREE.Material).dispose();renderer.dispose();renderer.domElement.remove();};
 },[]);
 return <div ref={host} className={`ms-planet ${failed?'ms-planet-fallback':''}`} aria-hidden="true"/>;
}
