import {useEffect, useMemo, useRef, useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import type {Exclusion, Mode, Point, Route, Settings, Terrain} from './planner';
import {attemptMove,heightAt} from './eva-motion';
import type {NativeDEM} from './eva-motion';
import type {ObstacleAnnotation} from './obstacles';
import {cellAt, clamp, contours, isValue, layerColor, statistics, validCell} from './terrain-analysis';
import type {LayerId, ProfileSample} from './terrain-analysis';

export function useSurfaceTexture(t:Terrain, layer:LayerId, opacity:number) {
  const [optical,setOptical]=useState<HTMLImageElement|null>(null),[failed,setFailed]=useState(false);
  const [surface,setSurface]=useState<HTMLCanvasElement|null>(null);
  useEffect(()=>{let active=true;const img=new Image();img.onload=()=>{if(active)setOptical(img);};img.onerror=()=>{if(active)setFailed(true);};img.src=(t.assetRoot??'/data')+'/optical.webp';return()=>{active=false;};},[t.assetRoot]);
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

export type SceneRoute={mode:Mode;outbound:number[];inbound:number[];color:string;active:boolean};
type SceneProps={terrain:Terrain;surface:HTMLCanvasElement|null;layer:LayerId;exaggeration:number;contourInterval:number;showContours:boolean;showGrid:boolean;route:number[];selected:Point;profile:ProfileSample[];profileMode:boolean;view:'3d'|'2d';cameraAction:{id:number;type:'reset'|'in'|'out'|'north'};onPick:(p:Point)=>void;onUnavailable:()=>void;mode?:'orbit'|'eva';native?:NativeDEM|null;crew?:Point;base?:Point;target?:Point;routes?:SceneRoute[];previous?:Route|null;invalidated?:number[];exclusion?:Exclusion|null;settings?:Settings;annotations?:ObstacleAnnotation[];showHazards?:boolean;motion?:{forward:number;right:number};onMove?:(p:Point,moved:number,reason:string,yaw:number)=>void;onExitEVA?:()=>void};
type Runtime={renderer:THREE.WebGLRenderer;scene:THREE.Scene;camera:THREE.PerspectiveCamera;controls:OrbitControls;mesh:THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>;overlays:THREE.Group;render:()=>void;min:number;fit:()=>void;heights:Float32Array;walk:Point;yaw:number;pitch:number;keys:Set<string>};
const disposeObject=(object:THREE.Object3D)=>object.traverse(child=>{if(child instanceof THREE.Mesh||child instanceof THREE.Line){child.geometry.dispose();const materials=Array.isArray(child.material)?child.material:[child.material];materials.forEach(m=>m.dispose());}});
export default function TerrainScene(props:SceneProps){
 const {terrain:t,surface,layer,view}=props,host=useRef<HTMLDivElement>(null),runtime=useRef<Runtime|null>(null),latest=useRef(props);
 const [unavailable,setUnavailable]=useState(false),[flatZoom,setFlatZoom]=useState(1),[lookMessage,setLookMessage]=useState('');
 useEffect(()=>{latest.current=props;});
 const contourLines=useMemo(()=>contours(t,props.contourInterval),[t,props.contourInterval]);
 const exag=props.mode==='eva'?1:props.exaggeration;
 useEffect(()=>{
  const el=host.current;if(!el||view!=='3d')return;let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true});}catch{setUnavailable(true);latest.current.onUnavailable();return;}
  setUnavailable(false);renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor('#141c19');renderer.outputColorSpace=THREE.SRGBColorSpace;el.append(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(40,1,.05,12000),controls=new OrbitControls(camera,renderer.domElement),min=statistics(t,'elevation').min??0;
  controls.minDistance=20;controls.maxDistance=4000;controls.maxPolarAngle=Math.PI*.49;controls.enableDamping=false;
  const fit=()=>{const factor=Math.max(.75,.85/camera.aspect);camera.fov=40;camera.updateProjectionMatrix();controls.target.set(0,25,0);camera.position.set(830*factor,25+750*factor,900*factor);controls.update();};fit();
  scene.add(new THREE.AmbientLight('#fff3df',1.65));const sun=new THREE.DirectionalLight('#fff3df',2.1);sun.position.set(-650,1000,-300);scene.add(sun);
  const native=latest.current.native,step=native?2:1,w=native?Math.ceil((native.width-1)/step)+1:t.width,h=native?Math.ceil((native.height-1)/step)+1:t.height,count=w*h,positions=new Float32Array(count*3),heights=new Float32Array(count),uvs=new Float32Array(count*2),valid=new Uint8Array(count),indices:number[]=[];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x,nx=native?Math.min(native.width-1,x*step):x,ny=native?Math.min(native.height-1,y*step):y,size=native?.cellSize??t.cellSize,east=(nx+.5)*size,south=(ny+.5)*size,p={x:east/t.cellSize-.5,y:south/t.cellSize-.5},e=native?native.values[ny*native.width+nx]:t.elevation[i];heights[i]=e??NaN;valid[i]=Number.isFinite(e)&&validCell(t,cellAt(t,p))?1:0;positions.set([east-t.width*t.cellSize/2,(Number.isFinite(e)?e!-min:0)*(latest.current.mode==='eva'?1:latest.current.exaggeration),south-t.height*t.cellSize/2],i*3);uvs.set([east/(t.width*t.cellSize),1-south/(t.height*t.cellSize)],i*2);if(x<w-1&&y<h-1){const a=i,b=i+1,c=i+w,d=c+1;indices.push(a,c,b,b,c,d);}}
  const good:number[]=[];for(let i=0;i<indices.length;i+=3)if(valid[indices[i]]&&valid[indices[i+1]]&&valid[indices[i+2]])good.push(indices[i],indices[i+1],indices[i+2]);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2));geometry.setIndex(good);geometry.computeVertexNormals();
  const material=new THREE.MeshStandardMaterial({roughness:1,side:THREE.DoubleSide}),mesh=new THREE.Mesh(geometry,material),overlays=new THREE.Group();scene.add(mesh,overlays);
  const grid=new THREE.GridHelper(1800,18,'#405247','#2b3931');grid.position.y=-8;scene.add(grid);
  const render=()=>renderer.render(scene,camera);controls.addEventListener('change',render);
  runtime.current={renderer,scene,camera,controls,mesh,overlays,render,min,fit,heights,walk:latest.current.crew??latest.current.selected,yaw:0,pitch:0,keys:new Set()};
  const observer=new ResizeObserver(()=>{const {width,height}=el.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();render();});observer.observe(el);
  let down={x:0,y:0},drag=false,pointer=-1;
  const pointerDown=(e:PointerEvent)=>{if(e.button!==0)return;down={x:e.clientX,y:e.clientY};pointer=e.pointerId;drag=true;if(latest.current.mode==='eva'&&document.pointerLockElement!==renderer.domElement)try{const request=renderer.domElement.requestPointerLock();if(request)request.catch(()=>setLookMessage('Drag to look. Pointer lock is unavailable here.'));}catch{setLookMessage('Drag to look; use WASD or on-screen controls.');}};
  const pointerUp=(e:PointerEvent)=>{drag=false;if(latest.current.mode==='eva'||pointer!==e.pointerId||Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)return;const rect=renderer.domElement.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);const hit=ray.intersectObject(mesh)[0];if(hit)latest.current.onPick({x:clamp(Math.round(hit.point.x/t.cellSize+t.width/2-.5),0,t.width-1),y:clamp(Math.round(hit.point.z/t.cellSize+t.height/2-.5),0,t.height-1)});};
  const mouse=(e:MouseEvent)=>{const r=runtime.current;if(!r||latest.current.mode!=='eva'||document.pointerLockElement!==renderer.domElement&&!drag)return;r.yaw-=e.movementX*.0025;r.pitch=clamp(r.pitch-e.movementY*.0025,-1.35,1.35);};
  const keyDown=(e:KeyboardEvent)=>{const r=runtime.current;if(!r||latest.current.mode!=='eva'||(e.target as HTMLElement)?.matches('input,select,textarea'))return;if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){e.preventDefault();r.keys.add(e.code);}if(e.code==='Escape')latest.current.onExitEVA?.();};
  const keyUp=(e:KeyboardEvent)=>runtime.current?.keys.delete(e.code),blur=()=>{runtime.current?.keys.clear();drag=false;},lock=()=>{if(latest.current.mode==='eva'&&document.pointerLockElement!==renderer.domElement){runtime.current?.keys.clear();latest.current.onExitEVA?.();}},lost=(e:Event)=>{e.preventDefault();latest.current.onUnavailable();};
  renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('pointerup',pointerUp);renderer.domElement.addEventListener('webglcontextlost',lost);document.addEventListener('mousemove',mouse);document.addEventListener('keydown',keyDown);document.addEventListener('keyup',keyUp);window.addEventListener('blur',blur);document.addEventListener('pointerlockchange',lock);
  return()=>{if(document.pointerLockElement===renderer.domElement)document.exitPointerLock();runtime.current=null;observer.disconnect();controls.dispose();material.map?.dispose();disposeObject(scene);renderer.dispose();renderer.domElement.remove();document.removeEventListener('mousemove',mouse);document.removeEventListener('keydown',keyDown);document.removeEventListener('keyup',keyUp);window.removeEventListener('blur',blur);document.removeEventListener('pointerlockchange',lock);};
 },[t,view,props.native]);
 useEffect(()=>{const r=runtime.current;if(!r||!surface)return;const previous=r.mesh.material.map,texture=new THREE.CanvasTexture(surface);texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=layer==='optical'?THREE.LinearFilter:THREE.NearestFilter;texture.anisotropy=Math.min(8,r.renderer.capabilities.getMaxAnisotropy());r.mesh.material.map=texture;r.mesh.material.needsUpdate=true;previous?.dispose();r.render();},[surface,layer,view,props.native]);
 useEffect(()=>{const r=runtime.current;if(!r)return;const pos=r.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;r.heights.forEach((e,i)=>pos.setY(i,Number.isFinite(e)?(e-r.min)*exag:0));pos.needsUpdate=true;r.mesh.geometry.computeVertexNormals();r.mesh.geometry.computeBoundingSphere();r.render();},[exag,view,props.native,t]);
 useEffect(()=>{
  const r=runtime.current;if(!r)return;r.keys.clear();r.controls.enabled=props.mode!=='eva';setLookMessage('');
  if(props.mode!=='eva'){if(document.pointerLockElement===r.renderer.domElement)document.exitPointerLock();r.fit();return;}
  r.walk=latest.current.crew??latest.current.base??props.selected;r.camera.fov=75;r.camera.updateProjectionMatrix();let frame=0,last=performance.now(),broadcast=0,totalMoved=0,reason='';
  const tick=(time:number)=>{const dt=Math.min(.05,(time-last)/1000);last=time;const current=latest.current,s=current.settings;let forward=(r.keys.has('KeyW')||r.keys.has('ArrowUp')?1:0)-(r.keys.has('KeyS')||r.keys.has('ArrowDown')?1:0)+(current.motion?.forward??0),right=(r.keys.has('KeyD')||r.keys.has('ArrowRight')?1:0)-(r.keys.has('KeyA')||r.keys.has('ArrowLeft')?1:0)+(current.motion?.right??0);const norm=Math.max(1,Math.hypot(forward,right));forward/=norm;right/=norm;
   if(s&&(forward||right)){const speed=Math.min(1.5,Math.max(.1,s.speed)),dx=(Math.cos(r.yaw)*right-Math.sin(r.yaw)*forward)*speed*dt,dy=(-Math.sin(r.yaw)*right-Math.cos(r.yaw)*forward)*speed*dt,result=attemptMove(current.terrain,r.walk,dx,dy,s,current.exclusion??null,current.native);r.walk=result.point;totalMoved+=result.moved;reason=result.reason;}else reason='';
   const elevation=heightAt(current.terrain,r.walk,current.native);r.camera.position.set((r.walk.x+.5-t.width/2)*t.cellSize,(elevation??r.min)-r.min+1.7,(r.walk.y+.5-t.height/2)*t.cellSize);r.camera.rotation.set(r.pitch,r.yaw,0,'YXZ');r.render();if(time-broadcast>=100){broadcast=time;current.onMove?.({...r.walk},totalMoved,reason,r.yaw);totalMoved=0;}frame=requestAnimationFrame(tick);
  };frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
 },[props.mode,view,props.native,t]);
 useEffect(()=>{
  const r=runtime.current;if(!r)return;disposeObject(r.overlays);r.overlays.clear();
  const world=(p:Point,z?:number,offset=props.mode==='eva'?.12:1.2)=>new THREE.Vector3((p.x+.5-t.width/2)*t.cellSize,((z??heightAt(t,p,props.native)??t.elevation[cellAt(t,p)]??r.min)-r.min)*exag+offset,(p.y+.5-t.height/2)*t.cellSize);
  const line=(points:THREE.Vector3[],color:string,opacity=1)=>{if(!points.length)return;const geometry=new THREE.BufferGeometry().setFromPoints(points);r.overlays.add(new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color,transparent:opacity<1,opacity})));};
  const routeLine=(cells:number[],color:string,opacity=1,dashed=false)=>line(cells.slice(1).flatMap((i,n)=>dashed&&n%2?[]:[world({x:cells[n]%t.width,y:Math.floor(cells[n]/t.width)}),world({x:i%t.width,y:Math.floor(i/t.width)})]),color,opacity);
  if(props.showContours)line(contourLines.flatMap(l=>[world(l.a,l.level,.25),world(l.b,l.level,.25)]),'#f1e5bd',.45);
  if(props.showGrid){const points:THREE.Vector3[]=[];for(let y=0;y<t.height;y+=10)for(let x=0;x<t.width;x+=10){if(x+10<t.width)points.push(world({x,y}),world({x:x+10,y}));if(y+10<t.height)points.push(world({x,y}),world({x,y:y+10}));}line(points,'#d9e6cd',.2);}
  if(props.routes)props.routes.forEach(route=>{routeLine(route.outbound,route.color,route.active?1:.28);routeLine(route.inbound,route.color,route.active?.65:.15,true);});else routeLine(props.route,'#a9dfc3');
  if(props.previous)routeLine(props.previous.outbound,'#ed8f7c',.8,true);
  if(props.invalidated?.length){const old=props.previous?.outbound??[];const invalid=new Set(props.invalidated);line(old.slice(1).flatMap((i,n)=>invalid.has(i)||invalid.has(old[n])?[world({x:old[n]%t.width,y:Math.floor(old[n]/t.width)},undefined,2),world({x:i%t.width,y:Math.floor(i/t.width)},undefined,2)]:[]),'#ff5e41');}
  const profileSegments:THREE.Vector3[]=[];props.profile.forEach((p,n)=>{if(n&&isValue(p.elevation)&&isValue(props.profile[n-1].elevation))profileSegments.push(world(props.profile[n-1],props.profile[n-1].elevation!,.7),world(p,p.elevation,.7));});line(profileSegments,'#f2bf83');
  const ring=(p:Point,radius:number,color:string)=>{const vertices=Array.from({length:65},(_,i)=>{const angle=i/64*Math.PI*2;return world({x:clamp(p.x+Math.cos(angle)*radius/t.cellSize,0,t.width-1),y:clamp(p.y+Math.sin(angle)*radius/t.cellSize,0,t.height-1)});});line(vertices.slice(1).flatMap((v,i)=>[vertices[i],v]),color);};
  const marker=(p:Point|undefined,color:string)=>{if(!p)return;const m=new THREE.Mesh(new THREE.SphereGeometry(props.mode==='eva'?.3:3,10,8),new THREE.MeshBasicMaterial({color}));m.position.copy(world(p));r.overlays.add(m);};
  marker(props.base,'#b8d8a7');marker(props.target,'#edba84');if(props.mode!=='eva')marker(props.crew,'#ffffff');if(!props.routes)ring(props.selected,5,'#ffffff');
  if(props.showHazards){if(props.exclusion)ring(props.exclusion,props.exclusion.radius,'#f09b7f');for(const a of props.annotations??[])ring(a.point,a.radius,a.status==='verified'?'#e48477':a.status==='simulated'?'#e8bc83':a.status==='uncertain'?'#a3afd1':'#d5ce84');const points:THREE.Vector3[]=[];for(let i=0;i<t.exposure.length;i+=2)if(t.exposure[i]&&t.valid[i]){const p={x:i%t.width,y:Math.floor(i/t.width)};points.push(world(p,undefined,.3),world({...p,x:p.x+.7},undefined,.3));}line(points,'#ed987d',.55);}
  r.render();
 },[t,props.native,props.routes,props.route,props.previous,props.invalidated,props.selected,props.profile,props.base,props.target,props.mode==='eva'?undefined:props.crew,props.exclusion,props.annotations,props.showHazards,props.showContours,props.showGrid,props.mode,contourLines,exag,view]);
 useEffect(()=>{const type=props.cameraAction.type;if(view==='2d'){setFlatZoom(z=>type==='in'?Math.min(5,z*1.3):type==='out'?Math.max(1,z/1.3):1);return;}const r=runtime.current;if(!r||props.mode==='eva')return;if(type==='reset')r.fit();else if(type==='north'){const d=r.camera.position.distanceTo(r.controls.target);r.camera.position.copy(r.controls.target).add(new THREE.Vector3(0,d*.75,d*.66));}else{const delta=r.camera.position.clone().sub(r.controls.target).multiplyScalar(type==='in'?.8:1.25).clampLength(20,4000);r.camera.position.copy(r.controls.target).add(delta);}r.controls.update();r.render();},[props.cameraAction,view]);
 const dataUrl=useMemo(()=>surface?.toDataURL('image/png'),[surface]);
 const poly=(cells:number[])=>cells.map(i=>`${i%t.width+.5},${Math.floor(i/t.width)+.5}`).join(' ');
 return <div ref={host} className={`tl-scene ${props.profileMode?'tl-drawing':''}`} data-eva-mode={props.mode==='eva'}>
  {unavailable&&view==='3d'&&<div className="tl-scene-error">3D is unavailable. Continue with the 2D map.</div>}
  {props.mode==='eva'&&<><span className="eva-crosshair">+</span>{lookMessage&&<span className="eva-look-message">{lookMessage}</span>}</>}
  {view==='2d'&&<svg className="tl-flat-map" viewBox={`${t.width/2-t.width/(2*flatZoom)} ${t.height/2-t.height/(2*flatZoom)} ${t.width/flatZoom} ${t.height/flatZoom}`} aria-label="Real Jezero 2D map. Click to inspect or choose a target." onClick={e=>{const matrix=e.currentTarget.getScreenCTM();if(!matrix)return;const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());if(p.x<0||p.y<0||p.x>=t.width||p.y>=t.height)return;props.onPick({x:Math.floor(p.x),y:Math.floor(p.y)});}}>
   {dataUrl&&<image href={dataUrl} width={t.width} height={t.height} style={{imageRendering:layer==='optical'?'auto':'pixelated'}}/>}
   {props.showContours&&<g stroke="#fff2c9" strokeWidth=".16" opacity=".6">{contourLines.map((l,i)=><path key={i} d={`M${l.a.x+.5} ${l.a.y+.5}L${l.b.x+.5} ${l.b.y+.5}`}/>)}</g>}
   {props.showGrid&&<g stroke="#dae6c7" strokeWidth=".15" opacity=".3">{Array.from({length:Math.ceil(t.width/10)},(_,n)=><path key={'x'+n} d={`M${n*10} 0V${t.height}`}/>)}{Array.from({length:Math.ceil(t.height/10)},(_,n)=><path key={'y'+n} d={`M0 ${n*10}H${t.width}`}/>)}</g>}
   {props.profile.slice(1).map((p,n)=>isValue(p.elevation)&&isValue(props.profile[n].elevation)?<path key={'p'+n} d={`M${props.profile[n].x+.5} ${props.profile[n].y+.5}L${p.x+.5} ${p.y+.5}`} fill="none" stroke="#f2bf83" strokeWidth=".8"/>:null)}
   {props.routes?props.routes.map(route=><g key={route.mode} fill="none" stroke={route.color} strokeWidth={route.active?1:.5} opacity={route.active?1:.35}><polyline points={poly(route.outbound)}/><polyline points={poly(route.inbound)} strokeDasharray="2 1"/></g>):<polyline points={poly(props.route)} fill="none" stroke="#a9dfc3" strokeWidth=".8"/>}
   {props.previous&&<polyline points={poly(props.previous.outbound)} fill="none" stroke="#ed8f7c" strokeWidth=".8" strokeDasharray="2 2"/>}
   {props.showHazards&&props.exclusion&&<circle cx={props.exclusion.x+.5} cy={props.exclusion.y+.5} r={props.exclusion.radius/t.cellSize} fill="#e78f792c" stroke="#efaa88" strokeWidth=".6"/>}
   {props.showHazards&&props.annotations?.map(a=><circle key={a.id} cx={a.point.x+.5} cy={a.point.y+.5} r={a.radius/t.cellSize} fill="#eac58133" stroke={a.status==='verified'?'#e48477':'#e8ce8f'} strokeWidth=".5"/>)}
   {[[props.base,'#b8d8a7'],[props.target,'#edba84'],[props.crew,'#fff']] .map(([p,color],i)=>p&&<circle key={i} cx={(p as Point).x+.5} cy={(p as Point).y+.5} r="1.8" fill={color as string}/>)}
   <circle cx={props.selected.x+.5} cy={props.selected.y+.5} r="2" fill="none" stroke="#fff" strokeWidth=".4"/>
  </svg>}
 </div>;
}
