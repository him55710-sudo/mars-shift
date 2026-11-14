import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
export type PanoramaCommand={id:number;type:'in'|'out'|'reset'};
type Runtime={camera:THREE.PerspectiveCamera;controls:OrbitControls;render:()=>void;fov:(value:number)=>void};
export default function SurfacePanorama({id,command,onReady}:{id:number;command:PanoramaCommand;onReady:()=>void}){
  const host=useRef<HTMLDivElement>(null),runtime=useRef<Runtime|null>(null),latest=useRef(onReady),[error,setError]=useState(''),[fov,setFov]=useState(72);
  useEffect(()=>{latest.current=onReady;},[onReady]);
  useEffect(()=>{
    const el=host.current;if(!el)return;let active=true;setError('');let renderer:THREE.WebGLRenderer;
    try{renderer=new THREE.WebGLRenderer({antialias:true});}catch{setError('이 환경에서는 360° 그래픽을 시작할 수 없습니다. 원본 보기로 이동하세요.');latest.current();return;}
    renderer.setPixelRatio(Math.min(2,devicePixelRatio));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor('#191b16');el.append(renderer.domElement);
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(72,1,.001,10);camera.position.set(0,0,.01);
    const controls=new OrbitControls(camera,renderer.domElement);controls.enablePan=false;controls.enableZoom=false;controls.enableDamping=false;controls.rotateSpeed=-.25;controls.minDistance=.01;controls.maxDistance=.01;controls.minPolarAngle=.02;controls.maxPolarAngle=Math.PI-.02;controls.update();
    const render=()=>{if(active)renderer.render(scene,camera);},updateFov=(value:number)=>{camera.fov=Math.min(105,Math.max(15,value));camera.updateProjectionMatrix();setFov(Math.round(camera.fov));render();};
    // CubeTexture background sampling swaps +X/-X. Match the published
    // krpano left/right face convention so neighbouring edges remain aligned.
    const texture=new THREE.CubeTextureLoader().setPath(`/data/panoramas/${id}/`).load(['l.webp','r.webp','u.webp','d.webp','b.webp','f.webp'],cube=>{if(!active){cube.dispose();return;}cube.colorSpace=THREE.SRGBColorSpace;scene.background=cube;render();latest.current();},undefined,()=>{if(active){setError('관측 영상을 불러오지 못했습니다. 새로고침하거나 원본 보기로 이동하세요.');latest.current();}});
    const wheel=(e:WheelEvent)=>{e.preventDefault();updateFov(camera.fov+e.deltaY*.035);};renderer.domElement.addEventListener('wheel',wheel,{passive:false});controls.addEventListener('change',render);
    let pinch=0;const touches=(e:TouchEvent)=>{if(e.touches.length===2){const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);if(e.type==='touchmove'&&pinch)updateFov(camera.fov*pinch/d);pinch=d;}else pinch=0;};renderer.domElement.addEventListener('touchstart',touches,{passive:true});renderer.domElement.addEventListener('touchmove',touches,{passive:true});
    const observer=new ResizeObserver(()=>{const {width,height}=el.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();render();});observer.observe(el);
    runtime.current={camera,controls,render,fov:updateFov};updateFov(72);
    return()=>{active=false;runtime.current=null;observer.disconnect();controls.dispose();texture.dispose();renderer.domElement.removeEventListener('wheel',wheel);renderer.domElement.removeEventListener('touchstart',touches);renderer.domElement.removeEventListener('touchmove',touches);renderer.dispose();renderer.domElement.remove();};
  },[id]);
  useEffect(()=>{const r=runtime.current;if(!r)return;if(command.type==='reset'){r.controls.reset();r.fov(72);}else r.fov(r.camera.fov*(command.type==='in'?.8:1.25));},[command]);
  return <div ref={host} className="ma-native-panorama" tabIndex={0} role="group" aria-label="실제 Mastcam-Z 360도 영상. 드래그 또는 방향키로 둘러보고 스크롤로 확대하세요." onKeyDown={e=>{const r=runtime.current;if(!r)return;const delta:Record<string,[number,number]>={ArrowLeft:[-.08,0],ArrowRight:[.08,0],ArrowUp:[0,.08],ArrowDown:[0,-.08]};if(delta[e.key]){e.preventDefault();const p=r.camera.position,spherical=new THREE.Spherical().setFromVector3(p);spherical.theta+=delta[e.key][0];spherical.phi=Math.max(.02,Math.min(Math.PI-.02,spherical.phi+delta[e.key][1]));p.setFromSpherical(spherical);r.controls.update();r.render();}else if(e.key==='+'||e.key==='=')r.fov(r.camera.fov*.8);else if(e.key==='-')r.fov(r.camera.fov*1.25);}}>{error&&<div className="ma-panorama-error"><p>{error}</p><img src={`/data/panoramas/${id}/f.webp`} alt="실제 로버 관측 영상 정면"/></div>}<span className="ma-pano-fov">시야각 {fov}° · 실제 카메라 관측</span></div>;
}
