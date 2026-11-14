import {useEffect, useMemo, useRef, useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import type {Point, Terrain} from './planner';
import {cellAt, clamp, contours, isValue, layerColor, statistics, validCell} from './terrain-analysis';
import type {LayerId, ProfileSample} from './terrain-analysis';

export function useSurfaceTexture(t:Terrain, layer:LayerId, opacity:number) {
  const [optical,setOptical]=useState<HTMLImageElement|null>(null),[failed,setFailed]=useState(false);
  const [surface,setSurface]=useState<HTMLCanvasElement|null>(null);
  useEffect(()=>{let active=true;const img=new Image();img.onload=()=>{if(active)setOptical(img);};img.onerror=()=>{if(active)setFailed(true);};img.src='/data/optical.webp';return()=>{active=false;};},[]);
  useEffect(()=>{
    const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=1000;const ctx=canvas.getContext('2d');if(!ctx)return;
    ctx.fillStyle='#786e5d';ctx.fillRect(0,0,1000,1000);
    if(optical)ctx.drawImage(optical,0,0,1000,1000);
    if(layer!=='optical'){
      const values=t[layer],s=statistics(t,layer),raster=document.createElement('canvas');raster.width=t.width;raster.height=t.height;const rc=raster.getContext('2d')!;const data=rc.createImageData(t.width,t.height);
      values.forEach((v,i)=>{const rgb=validCell(t,i)&&isValue(v)?layerColor(layer,v,s.min??0,s.max??1):[42,47,46];data.data.set([...rgb,255],i*4);});rc.putImageData(data,0,0);ctx.imageSmoothingEnabled=false;ctx.globalAlpha=opacity;ctx.drawImage(raster,0,0,1000,1000);ctx.globalAlpha=1;
    }
    // Unobserved cells remain visibly masked even over the optical basemap.
    ctx.fillStyle='#202925';t.valid.forEach((_,i)=>{if(!validCell(t,i))ctx.fillRect(i%t.width/t.width*1000,Math.floor(i/t.width)/t.height*1000,1000/t.width,1000/t.height);});
    setSurface(canvas);
  },[t,layer,opacity,optical]);
  return {surface,opticalFailed:failed};
}

type SceneProps={terrain:Terrain;surface:HTMLCanvasElement|null;layer:LayerId;exaggeration:number;contourInterval:number;showContours:boolean;showGrid:boolean;route:number[];selected:Point;profile:ProfileSample[];profileMode:boolean;view:'3d'|'2d';cameraAction:{id:number;type:'reset'|'in'|'out'|'north'};onPick:(p:Point)=>void;onUnavailable:()=>void};
type Runtime={renderer:THREE.WebGLRenderer;scene:THREE.Scene;camera:THREE.PerspectiveCamera;controls:OrbitControls;mesh:THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>;overlays:THREE.Group;render:()=>void;min:number;fit:()=>void};
const disposeObject=(object:THREE.Object3D)=>object.traverse(child=>{if(child instanceof THREE.Mesh||child instanceof THREE.Line){child.geometry.dispose();const materials=Array.isArray(child.material)?child.material:[child.material];materials.forEach(m=>m.dispose());}});

export default function TerrainScene(props:SceneProps) {
  const {terrain:t,surface,layer,view,onPick,onUnavailable}=props;
  const host=useRef<HTMLDivElement>(null),runtime=useRef<Runtime|null>(null),latest=useRef({onPick,onUnavailable});
  const [unavailable,setUnavailable]=useState(false),[contextLost,setContextLost]=useState(false),[flatZoom,setFlatZoom]=useState(1);
  useEffect(()=>{latest.current={onPick,onUnavailable};},[onPick,onUnavailable]);
  const contourLines=useMemo(()=>contours(t,props.contourInterval),[t,props.contourInterval]);
  useEffect(()=>{
    const el=host.current;if(!el||view!=='3d')return;
    let renderer:THREE.WebGLRenderer;
    try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});}catch{setUnavailable(true);latest.current.onUnavailable();return;}
    setUnavailable(false);setContextLost(false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.setClearColor('#141c19',1);renderer.outputColorSpace=THREE.SRGBColorSpace;el.appendChild(renderer.domElement);
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(40,1,1,12000),controls=new OrbitControls(camera,renderer.domElement);
    const min=statistics(t,'elevation').min??0;
    controls.minDistance=240;controls.maxDistance=3700;controls.maxPolarAngle=Math.PI*.48;controls.enableDamping=false;controls.target.set(0,50,0);
    const fit=()=>{const factor=Math.max(.92,1.5/camera.aspect);controls.target.set(0,50,0);camera.position.set(1030*factor,50+1000*factor,1200*factor);controls.update();};
    fit();
    scene.add(new THREE.AmbientLight('#fff3df',1.65));const sun=new THREE.DirectionalLight('#fff3df',2.1);sun.position.set(-650,1000,-300);scene.add(sun);
    const positions=new Float32Array(t.width*t.height*3),uvs=new Float32Array(t.width*t.height*2),indices:number[]=[];
    for(let y=0;y<t.height;y++)for(let x=0;x<t.width;x++){const i=y*t.width+x;positions.set([(x+.5-t.width/2)*t.cellSize,0,(y+.5-t.height/2)*t.cellSize],i*3);uvs.set([(x+.5)/t.width,1-(y+.5)/t.height],i*2);if(x<t.width-1&&y<t.height-1){const a=i,b=i+1,c=i+t.width,d=c+1;if([a,b,c].every(j=>validCell(t,j)))indices.push(a,c,b);if([b,c,d].every(j=>validCell(t,j)))indices.push(b,c,d);}}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2));geometry.setIndex(indices);
    const material=new THREE.MeshStandardMaterial({roughness:1,metalness:0,side:THREE.DoubleSide}),mesh=new THREE.Mesh(geometry,material);scene.add(mesh);
    const overlays=new THREE.Group();scene.add(overlays);
    const pedestal=new THREE.Mesh(new THREE.BoxGeometry(t.width*t.cellSize,30,t.height*t.cellSize),new THREE.MeshStandardMaterial({color:'#25332c',roughness:1}));pedestal.position.y=-22;scene.add(pedestal);
    const grid=new THREE.GridHelper(2200,22,'#405247','#2b3931');grid.position.y=-39;scene.add(grid);
    const render=()=>renderer.render(scene,camera);controls.addEventListener('change',render);
    let previousAspect=0;
    const observer=new ResizeObserver(()=>{const {width,height}=el.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();if(!previousAspect||Math.abs(camera.aspect-previousAspect)>.25){fit();previousAspect=camera.aspect;}render();});observer.observe(el);
    let down={x:0,y:0},pointerId=-1;
    const pointerDown=(e:PointerEvent)=>{if(e.button!==0)return;down={x:e.clientX,y:e.clientY};pointerId=e.pointerId;};
    const pointerUp=(e:PointerEvent)=>{if(e.pointerId!==pointerId||Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)return;pointerId=-1;const b=renderer.domElement.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1),camera);const hit=ray.intersectObject(mesh)[0];if(!hit)return;const x=clamp(Math.round(hit.point.x/t.cellSize+t.width/2-.5),0,t.width-1),y=clamp(Math.round(hit.point.z/t.cellSize+t.height/2-.5),0,t.height-1);latest.current.onPick({x,y});};
    const lost=(e:Event)=>{e.preventDefault();setContextLost(true);latest.current.onUnavailable();};
    renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('pointerup',pointerUp);renderer.domElement.addEventListener('webglcontextlost',lost);
    runtime.current={renderer,scene,camera,controls,mesh,overlays,render,min,fit};
    return()=>{runtime.current=null;observer.disconnect();controls.dispose();disposeObject(scene);material.map?.dispose();renderer.dispose();renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('pointerup',pointerUp);renderer.domElement.removeEventListener('webglcontextlost',lost);renderer.domElement.remove();};
  },[t,view]);
  useEffect(()=>{
    const r=runtime.current;if(!r||!surface)return;const previous=r.mesh.material.map,texture=new THREE.CanvasTexture(surface);texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=layer==='optical'?THREE.LinearFilter:THREE.NearestFilter;texture.anisotropy=Math.min(8,r.renderer.capabilities.getMaxAnisotropy());r.mesh.material.map=texture;r.mesh.material.needsUpdate=true;previous?.dispose();r.render();
  },[surface,layer,view]);
  useEffect(()=>{
    const r=runtime.current;if(!r)return;
    const pos=r.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    t.elevation.forEach((e,i)=>pos.setY(i,((e??r.min)-r.min)*props.exaggeration));pos.needsUpdate=true;r.mesh.geometry.computeVertexNormals();r.mesh.geometry.computeBoundingSphere();r.render();
  },[t,props.exaggeration,view]);
  useEffect(()=>{
    const r=runtime.current;if(!r)return;const {exaggeration,showContours,showGrid,selected,profile,route}=props;
    disposeObject(r.overlays);r.overlays.clear();
    const world=(p:Point,height?:number,offset=1.5)=>new THREE.Vector3((p.x+.5-t.width/2)*t.cellSize,((height??t.elevation[cellAt(t,p)]??r.min)-r.min)*exaggeration+offset,(p.y+.5-t.height/2)*t.cellSize);
    const segments=(vertices:THREE.Vector3[],color:string,opacity:number)=>{const g=new THREE.BufferGeometry().setFromPoints(vertices);const l=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color,transparent:true,opacity}));r.overlays.add(l);};
    if(showContours)segments(contourLines.flatMap(l=>[world(l.a,l.level,.7),world(l.b,l.level,.7)]),'#f1e5bd',.48);
    if(showGrid){const vs:THREE.Vector3[]=[];for(let y=0;y<t.height;y+=10)for(let x=0;x<t.width;x+=10){if(x+10<t.width&&validCell(t,y*t.width+x)&&validCell(t,y*t.width+x+10))vs.push(world({x,y}),world({x:x+10,y}));if(y+10<t.height&&validCell(t,y*t.width+x)&&validCell(t,(y+10)*t.width+x))vs.push(world({x,y}),world({x,y:y+10}));}segments(vs,'#e4e5cb',.18);}
    if(route.length)segments(route.slice(1).flatMap((i,n)=>[world({x:route[n]%t.width,y:Math.floor(route[n]/t.width)},undefined,2.8),world({x:i%t.width,y:Math.floor(i/t.width)},undefined,2.8)]),'#a9dfc3',1);
    const profileSegments:THREE.Vector3[]=[];profile.forEach((p,n)=>{if(n&&isValue(p.elevation)&&isValue(profile[n-1].elevation))profileSegments.push(world(profile[n-1],profile[n-1].elevation!,3),world(p,p.elevation,3));});segments(profileSegments,'#f2bf83',1);
    const marker=(p:Point,color:string,radius:number)=>{if(!validCell(t,cellAt(t,p)))return;const ring=new THREE.Mesh(new THREE.RingGeometry(radius*.7,radius,40),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,depthTest:false}));ring.rotation.x=-Math.PI/2;ring.position.copy(world(p,undefined,4));ring.renderOrder=2;r.overlays.add(ring);};
    marker(selected,'#ffffff',9);if(profile.length){marker(profile[0],'#f2bf83',9);marker(profile[profile.length-1],'#f2bf83',9);}
    r.render();
  },[t,props.exaggeration,props.showContours,contourLines,props.showGrid,props.selected,props.profile,props.route,view]);
  useEffect(()=>{
    const type=props.cameraAction.type;
    if(view==='2d'){setFlatZoom(z=>type==='in'?Math.min(4,z*1.3):type==='out'?Math.max(1,z/1.3):1);return;}
    const r=runtime.current;if(!r)return;
    if(type==='reset'){r.fit();}
    else if(type==='north'){const distance=r.camera.position.distanceTo(r.controls.target);r.camera.position.copy(r.controls.target).add(new THREE.Vector3(0,distance*.75,distance*.66));}
    else {const delta=r.camera.position.clone().sub(r.controls.target);delta.multiplyScalar(type==='in'?.8:1.25);delta.clampLength(r.controls.minDistance,r.controls.maxDistance);r.camera.position.copy(r.controls.target).add(delta);}
    r.controls.update();r.render();
  },[props.cameraAction,view]);
  const dataUrl=useMemo(()=>surface?.toDataURL('image/png'),[surface]);
  return <div ref={host} className={`tl-scene ${props.profileMode?'tl-drawing':''}`}>
    {view==='3d'&&(unavailable||contextLost)&&<div className="tl-scene-error">3D 표시를 사용할 수 없습니다. 2D 지도로 전환해 분석을 계속하세요.</div>}
    {view==='2d'&&<svg className="tl-flat-map" viewBox={`${t.width/2-t.width/(2*flatZoom)} ${t.height/2-t.height/(2*flatZoom)} ${t.width/flatZoom} ${t.height/flatZoom}`} aria-label="Jezero 2D 지형 지도. 지점을 클릭해 분석" onClick={e=>{const matrix=e.currentTarget.getScreenCTM();if(!matrix)return;const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());if(p.x<0||p.y<0||p.x>=t.width||p.y>=t.height)return;onPick({x:clamp(Math.floor(p.x),0,t.width-1),y:clamp(Math.floor(p.y),0,t.height-1)});}}>
      {dataUrl&&<image href={dataUrl} width={t.width} height={t.height} style={{imageRendering:layer==='optical'?'auto':'pixelated'}}/>}
      {props.showGrid&&<g stroke="#fff" strokeWidth=".15" opacity=".25">{Array.from({length:19},(_,i)=><path key={i} d={`M${(i+1)*10} 0V200M0 ${(i+1)*10}H200`}/>)}</g>}
      {props.showContours&&<g stroke="#fff2c9" strokeWidth=".16" opacity=".65">{contourLines.map((l,i)=><path key={i} d={`M${l.a.x+.5} ${l.a.y+.5}L${l.b.x+.5} ${l.b.y+.5}`}/>)}</g>}
      {!!props.route.length&&<polyline points={props.route.map(i=>`${i%t.width+.5},${Math.floor(i/t.width)+.5}`).join(' ')} fill="none" stroke="#a9dfc3" strokeWidth=".8"/>}
      <g fill="none" stroke="#f2bf83" strokeWidth=".65">{props.profile.slice(1).map((p,n)=>isValue(p.elevation)&&isValue(props.profile[n].elevation)?<path key={n} d={`M${props.profile[n].x+.5} ${props.profile[n].y+.5}L${p.x+.5} ${p.y+.5}`}/>:null)}</g>
      <circle cx={props.selected.x+.5} cy={props.selected.y+.5} r="1.7" fill="none" stroke="white" strokeWidth=".5"/>
      {props.profile.length>0&&[props.profile[0],props.profile[props.profile.length-1]].map((p,i)=><g key={i}><circle cx={p.x+.5} cy={p.y+.5} r="2.3" fill="#f2bf83"/><text x={p.x+.5} y={p.y-3} textAnchor="middle" fill="white" fontSize="4">{i?'B':'A'}</text></g>)}
    </svg>}
  </div>;
}
