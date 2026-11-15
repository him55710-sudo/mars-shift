import {groundRouteRaster} from './rover-ground-route';
import {RISK_RED,stormDisplayPixels} from './hazard-visual';
import {loadPhotoSupport,disposePhotoSupport} from './photo-support-v14';
import {evacuationRibbon} from './evacuation-ribbon';
import {createSurfaceEvidenceScene,addSurfaceEvidenceShader} from './surface-evidence-scene';
import type {SurfaceEvidenceScene} from './surface-evidence-scene';
import {featureAt} from './surface-evidence';
import type {SurfaceEvidence,SurfaceMode,RaisedFeature} from './surface-evidence';
import {roverHazardPixels} from './rover-hazard-raster';
import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createAstronautAvatar} from './astronaut-avatar';
import {heightAt} from './eva-motion';
import {acceptsWalkInput,smoothMotion,smoothView,stoppedMotion} from './visor-motion';
import {routeRibbonMaterial} from './ground-overlay';
import {gridPoint,moveOnRover,worldPoint} from './rover-navigation';
import type {RoverGrid,RoverObstacle} from './rover-navigation';
import type {Point,Route,Settings,Terrain} from './planner';
import {addHazardScene} from './hazard-scene';
import type {XRNavigationFrame} from './hazard-xr';

export type RoverManifest={inspectionCamera?:{position:number[]};title:string;credit:string;sourceUrl:string;grid:string;assets:{url:string;transform?:number[];triangles?:number;sha256?:string}[];calibratedAssets?:{url:string;transform?:number[]}[];detailAssets?:{url:string;transform?:number[]}[]};
type Props={photoSupport?:boolean;evidence:SurfaceEvidence|null;surfaceMode:SurfaceMode;selectedFeature:number|null;showReference:boolean;focusFeature:{id:number;feature:RaisedFeature|null};onSelectFeature:(id:number)=>void;manifest:RoverManifest;grid:RoverGrid;terrain:Terrain;settings:Settings;crew:Point;target:Point;route:Route|null;alternatives:Route[];obstacles:RoverObstacle[];hazards:boolean;overview:boolean;thirdPerson:boolean;pickMode:'target'|'obstacle'|'sand'|null;paused:boolean;command:{id:number;action:'in'|'out'|'reset'};motion:{forward:number;right:number};onMove:(p:Point,d:number,yaw:number,reason:string)=>void;onPick:(p:Point)=>void;onStatus:(status:string)=>void;hazardFrame?:XRNavigationFrame;controlled?:boolean;hazardRouteStyle?:'ribbon'|'tube'};
type Runtime={photoSupport:THREE.Group;evidenceScene:SurfaceEvidenceScene|null;scene:THREE.Scene;renderer:THREE.WebGLRenderer;camera:THREE.PerspectiveCamera;controls:OrbitControls;objects:THREE.Group;overlays:THREE.Group;draw:()=>void;walk:Point;yaw:number;pitch:number;targetYaw:number;targetPitch:number;resetMotion:()=>void;visorFov:number;keys:Set<string>;dirty:boolean;routeTexture:THREE.DataTexture|null;routeUniforms:{uRoverRoute:{value:THREE.DataTexture|null};uRouteEnabled:{value:number};uRouteColor:{value:THREE.Color}};hazardTexture:THREE.DataTexture|null;hazardUniforms:{uRoverHazards:{value:THREE.DataTexture|null};uRoverEnabled:{value:number};uRoverBounds:{value:THREE.Vector4}}};
function frameRoverOverview(r:Runtime,p:Props){
 if(p.hazardRouteStyle==='ribbon'){
  const points=[p.crew,p.target,gridPoint(p.grid,p.grid.start.x,p.grid.start.z),...(p.hazardFrame?.route??[]).map(q=>({x:q.x/p.grid.cellSize,y:q.y/p.grid.cellSize}))].map(q=>{const w=worldPoint(p.grid,q);return new THREE.Vector3(w.x,heightAt(p.terrain,q)??0,w.z);});
  const box=new THREE.Box3().setFromPoints(points),centre=box.getCenter(new THREE.Vector3());
  const direction=new THREE.Vector3(p.grid.target.x-p.grid.start.x,0,p.grid.target.z-p.grid.start.z).normalize();
  if(direction.lengthSq()<.1)direction.set(0,0,1);
  const offset=direction.multiplyScalar(-.55).add(new THREE.Vector3(0,.835,0)).normalize();
  r.camera.fov=50;r.camera.position.copy(centre).add(offset);r.camera.lookAt(centre);r.camera.updateMatrixWorld();
  const inverse=r.camera.quaternion.clone().invert(),tan=Math.tan(25*Math.PI/180);let distance=16;
  // Fit route, current position, start and target to both axes of a portrait view.
  for(const point of points){const q=point.clone().sub(centre).applyQuaternion(inverse);distance=Math.max(distance,q.z+Math.abs(q.x)/(tan*r.camera.aspect)*1.65,q.z+Math.abs(q.y)/tan*1.65);}
  r.controls.minDistance=3;r.controls.maxDistance=Math.max(150,distance*1.5);r.controls.target.copy(centre);r.camera.position.copy(centre).addScaledVector(offset,distance);r.camera.updateProjectionMatrix();r.controls.update();return;
 }
 const w=worldPoint(p.grid,p.crew),goal=worldPoint(p.grid,p.target),h=heightAt(p.terrain,p.crew)??0,cx=(w.x+goal.x)/2,cz=(w.z+goal.z)/2-(innerWidth>600?4:0);r.controls.minDistance=3;r.controls.target.set(cx,h,cz);r.camera.position.set(cx-18,h+28,cz);r.camera.fov=50;r.camera.updateProjectionMatrix();r.controls.update();}
const clear=(g:THREE.Group)=>{g.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}else if(o instanceof THREE.Sprite){o.material.map?.dispose();o.material.dispose();}});g.clear();};
const DEFAULT_EVIDENCE={evidence:null,surfaceMode:'photo' as const,selectedFeature:null,showReference:false,focusFeature:{id:0,feature:null},onSelectFeature:(_id:number)=>{}};
export default function RoverScene(input:Omit<Props,keyof typeof DEFAULT_EVIDENCE>&Partial<Pick<Props,keyof typeof DEFAULT_EVIDENCE>>){
 const props:Props={...DEFAULT_EVIDENCE,...input};
 const host=useRef<HTMLDivElement>(null),latest=useRef(props),runtime=useRef<Runtime|null>(null),[error,setError]=useState(''),[tileRevision,setTileRevision]=useState(0);latest.current=props;
 useEffect(()=>{
  const el=host.current;if(!el)return;el.dataset.loaded='false';el.dataset.photoAssets=String(props.manifest.assets.length);el.dataset.photoTriangles=String(props.manifest.assets.reduce((n,a)=>n+(a.triangles??0),0));el.dataset.photoQuality=props.manifest.assets.some(a=>a.url.includes('/calibrated-'))?'native-pds':'source';delete el.dataset.benchmark;setError('');let alive=true,renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});}catch{setError('3D graphics are unavailable. Return to orbital mission planning using the region switch.');return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.setClearColor('#302a27');el.append(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(50,1,.06,1000),controls=new OrbitControls(camera,renderer.domElement),objects=new THREE.Group(),overlays=new THREE.Group();controls.enabled=false;controls.enableDamping=false;controls.maxPolarAngle=Math.PI*.48;controls.minDistance=3;controls.maxDistance=150;scene.add(objects,overlays);
  const skyCanvas=document.createElement('canvas');skyCanvas.width=256;skyCanvas.height=128;const ctx=skyCanvas.getContext('2d')!,gradient=ctx.createLinearGradient(0,0,0,128);gradient.addColorStop(0,'#493e37');gradient.addColorStop(.5,'#c1a387');gradient.addColorStop(1,'#55483e');ctx.fillStyle=gradient;ctx.fillRect(0,0,256,128);const sky=new THREE.CanvasTexture(skyCanvas);sky.mapping=THREE.EquirectangularReflectionMapping;sky.colorSpace=THREE.SRGBColorSpace;scene.background=sky;
  const pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromEquirectangular(sky);scene.environment=environment.texture;
  scene.add(new THREE.HemisphereLight('#fff0dc','#635449',1.0));const sun=new THREE.DirectionalLight('#fff2d7',2.2);sun.position.set(-20,35,-15);scene.add(sun);
  const avatar=createAstronautAvatar(false,'/models/nasa-emu-surface.glb');scene.add(avatar.group);avatar.group.visible=latest.current.thirdPerson;
  const contact=new THREE.Mesh(new THREE.CircleGeometry(.5,24),new THREE.MeshBasicMaterial({color:'#241d18',transparent:true,opacity:.22,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));contact.rotation.x=-Math.PI/2;scene.add(contact);
  const initial=worldPoint(props.grid,props.crew),goal=worldPoint(props.grid,props.target),bounds=new THREE.Vector4(props.grid.origin[0],props.grid.origin[1],props.grid.width*props.grid.cellSize,props.grid.height*props.grid.cellSize);
  const routeUniforms={uRoverRoute:{value:null as THREE.DataTexture|null},uRouteEnabled:{value:0},uRouteColor:{value:new THREE.Color('#8bf4d3')}};
  const uniforms={uRoverHazards:{value:null as THREE.DataTexture|null},uRoverEnabled:{value:0},uRoverBounds:{value:bounds}};
  const evidence=props.evidence?createSurfaceEvidenceScene(scene,objects,props.evidence):null;
  let renders=0,lastRender=0,measureStart=0,measureFrames=0,lastInput=0,frame=0,phase=0,total=0,lastEmit=0,drag=false,dragDistance=0,lastX=0,lastY=0,followDistance=4.4,eyeHeight=NaN;let velocity=stoppedMotion();
  const labelSize=new THREE.Vector2();const draw=()=>{if(!alive||document.hidden)return;const start=performance.now();renderer.getSize(labelSize);overlays.children.forEach(o=>{if(o instanceof THREE.Sprite){const h=30*2*Math.tan(camera.fov*Math.PI/360)/Math.max(1,labelSize.y);o.scale.set(h*5,h,1);}});renderer.render(scene,camera);const gap=start-lastRender;lastRender=start;Object.assign(el.dataset,{surfaceLayer:latest.current.surfaceMode,selectedFeature:String(latest.current.selectedFeature??''),evidenceSource:props.evidence?.sourceCommit??'',featureCount:String(props.evidence?.features.length??0),demTriangles:String((evidence?.dem.geometry.index?.count??0)/3),referenceGround:String(evidence?.reference.visible??false),renderCount:String(++renders),triangles:String(renderer.info.render.triangles),drawCalls:String(renderer.info.render.calls),renderMs:(performance.now()-start).toFixed(2),camera:JSON.stringify({position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),fov:camera.fov}),avatar:avatar.group.userData.assetStatus,frameMs:gap<150?gap.toFixed(1):'idle',pixelRatio:renderer.getPixelRatio().toFixed(2)});if(measureStart){measureFrames++;if(start-measureStart>=5000){el.dataset.benchmark=JSON.stringify({seconds:(start-measureStart)/1000,frames:measureFrames,fps:measureFrames/((start-measureStart)/1000),triangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls,dpr:renderer.getPixelRatio()});measureStart=0;}}};
  const photoSupport=new THREE.Group();scene.add(photoSupport);const photoController=new AbortController();
  const r:Runtime={photoSupport,evidenceScene:evidence,scene,renderer,camera,controls,objects,overlays,draw,walk:{...props.crew},yaw:Math.atan2(goal.x-initial.x,goal.z-initial.z),pitch:-.52,targetYaw:Math.atan2(goal.x-initial.x,goal.z-initial.z),targetPitch:-.52,resetMotion:()=>{velocity=stoppedMotion();},visorFov:50,keys:new Set(),dirty:true,routeTexture:null,routeUniforms,hazardTexture:null,hazardUniforms:uniforms};runtime.current=r;latest.current.onMove({...r.walk},0,r.yaw,'');
  const applyMaterial=(mat:THREE.Material)=>{
   const m=mat as THREE.MeshBasicMaterial;if(m.map){m.map.anisotropy=Math.min(16,renderer.capabilities.getMaxAnisotropy());m.map.minFilter=THREE.LinearMipmapLinearFilter;m.map.magFilter=THREE.LinearFilter;m.map.generateMipmaps=true;m.map.needsUpdate=true;}m.toneMapped=false;m.side=THREE.DoubleSide;
   m.onBeforeCompile=shader=>{Object.assign(shader.uniforms,uniforms,routeUniforms);shader.vertexShader='varying vec3 vRoverWorld;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRoverWorld=(modelMatrix*vec4(position,1.0)).xyz;');shader.fragmentShader='varying vec3 vRoverWorld;\nuniform sampler2D uRoverHazards;uniform float uRoverEnabled;uniform vec4 uRoverBounds;uniform sampler2D uRoverRoute;uniform float uRouteEnabled;uniform vec3 uRouteColor;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    vec2 uv=(vRoverWorld.xz-uRoverBounds.xy)/uRoverBounds.zw;
    if(all(greaterThanEqual(uv,vec2(0.0)))&&all(lessThanEqual(uv,vec2(1.0)))){
     if(uRoverEnabled>0.5){
      vec4 h=texture2D(uRoverHazards,uv);vec2 texel=vec2(0.25)/uRoverBounds.zw;
      float boundary=max(max(length(h-texture2D(uRoverHazards,uv+vec2(texel.x,0))),length(h-texture2D(uRoverHazards,uv-vec2(texel.x,0)))),max(length(h-texture2D(uRoverHazards,uv+vec2(0,texel.y))),length(h-texture2D(uRoverHazards,uv-vec2(0,texel.y)))));
      float phase=(vRoverWorld.x+vRoverWorld.z)*1.5,aa=max(fwidth(phase),.002);
      float stripe=(1.-smoothstep(.07,.07+aa,abs(fract(phase)-.5)))*(1.-smoothstep(.15,.4,aa));
      float warning=step(h.g,.18)*step(.01,h.a);
      float opacity=mix(.035,.10,warning)+stripe*.20+min(1.,boundary)*.62;
      diffuseColor.rgb=mix(diffuseColor.rgb,h.rgb,h.a*opacity);
     }
     if(uRouteEnabled>.5){
      vec4 mark=texture2D(uRoverRoute,uv);float aa=max(fwidth(mark.r),.025);
      float core=smoothstep(.52-aa,.52+aa,mark.r),halo=smoothstep(0.,.5,mark.r)*.14;
      float dash=1.-smoothstep(.08,.16,abs(mark.g-.5));
      diffuseColor.rgb=mix(diffuseColor.rgb,uRouteColor,min(.92,core*(.68+.24*dash)+halo));
     }
    }
   `);if(evidence)addSurfaceEvidenceShader(shader,evidence.uniforms);};m.customProgramCacheKey=()=> evidence?'rover-ground-projection-v35-evidence':'rover-ground-projection-v35';m.needsUpdate=true;
  };
  if(props.photoSupport!==undefined)loadPhotoSupport(photoController.signal).then(group=>{if(!alive){disposePhotoSupport(group);return;}photoSupport.add(group);photoSupport.visible=!!latest.current.photoSupport&&latest.current.surfaceMode==='photo';el.dataset.photoSupport='ready';r.dirty=true;}).catch(e=>{if(e.name!=='AbortError')el.dataset.photoSupport='unavailable';});
  let loaded=0;const textures=new Set<THREE.Texture>();const loader=new GLTFLoader();
  const loadAsset=(asset:RoverManifest['assets'][number])=>loader.loadAsync(asset.url).then(gltf=>{if(!alive){gltf.scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){Object.values(m).forEach(v=>{if(v instanceof THREE.Texture)v.dispose();});m.dispose();}}});return;}const group=new THREE.Group();if(asset.transform){group.matrix.fromArray(asset.transform);group.matrixAutoUpdate=false;}group.add(gltf.scene);objects.add(group);gltf.scene.traverse(o=>{if(o instanceof THREE.Mesh){o.frustumCulled=true;for(const m of Array.isArray(o.material)?o.material:[o.material]){Object.values(m).forEach(v=>{if(v instanceof THREE.Texture)textures.add(v);});applyMaterial(m);}}});loaded++;latest.current.onStatus(`Loading observed surface ${loaded}/${props.manifest.assets.length}`);r.dirty=true;});let nextAsset=0;Promise.all(Array.from({length:4},async()=>{while(nextAsset<props.manifest.assets.length&&alive)await loadAsset(props.manifest.assets[nextAsset++]);})).then(()=>{if(alive){el.dataset.loaded='true';setTileRevision(n=>n+1);latest.current.onStatus('Observed rover surface ready');r.dirty=true;}}).catch(()=>{if(alive){setError('Some observed terrain tiles failed to load. Movement is paused. Retry or return to orbital planning.');el.dataset.loaded='false';}});
  const groundCamera=(dt:number)=>{
   const p=latest.current,w=worldPoint(p.grid,r.walk),h=heightAt(p.terrain,r.walk);if(h===null)return;
   avatar.group.position.set(w.x,h,w.z);avatar.group.rotation.y=r.yaw+Math.PI;avatar.group.visible=p.thirdPerson&&!p.overview;contact.visible=avatar.group.visible;contact.position.set(w.x,h+.025,w.z);
   if(p.overview)return;
   eyeHeight=Number.isFinite(eyeHeight)?smoothView(eyeHeight,h+1.7,dt,.09):h+1.7;
   const sx=Math.sin(r.yaw),cz=Math.cos(r.yaw),rightX=cz,rightZ=-sx;
   if(p.thirdPerson){const desired=new THREE.Vector3(w.x-sx*followDistance+rightX*-.8,h+2.6,w.z-cz*followDistance+rightZ*-.8);camera.position.copy(desired);camera.lookAt(w.x+sx*5,h+1.0+Math.sin(r.pitch)*5,w.z+cz*5);}else{camera.position.set(w.x,eyeHeight,w.z);camera.lookAt(w.x+sx*Math.cos(r.pitch)*10,eyeHeight+Math.sin(r.pitch)*10,w.z+cz*Math.cos(r.pitch)*10);}
  };
  const onDown=(e:PointerEvent)=>{if(e.button!==0||latest.current.paused&&!latest.current.overview&&!latest.current.controlled)return;el.focus({preventScroll:true});drag=true;dragDistance=0;lastX=e.clientX;lastY=e.clientY;lastInput=performance.now();renderer.domElement.setPointerCapture(e.pointerId);};
  const onMove=(e:PointerEvent)=>{if(!drag)return;const dx=e.clientX-lastX,dy=e.clientY-lastY;dragDistance+=Math.abs(dx)+Math.abs(dy);if(latest.current.overview){lastX=e.clientX;lastY=e.clientY;return;}r.targetYaw-=dx*.003;r.targetPitch=THREE.MathUtils.clamp(r.targetPitch-dy*.003,-1.1,.65);lastX=e.clientX;lastY=e.clientY;r.dirty=true;};
  const onUp=(ev:PointerEvent)=>{const p=latest.current;if(drag&&dragDistance<8&&(p.pickMode||p.surfaceMode!=='photo')){objects.updateMatrixWorld(true);evidence?.dem.updateMatrixWorld(true);const rect=renderer.domElement.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((ev.clientX-rect.left)/rect.width*2-1,-(ev.clientY-rect.top)/rect.height*2+1),camera);const hits=ray.intersectObject(p.surfaceMode==='dem'&&evidence?evidence.dem:objects,true),hit=p.surfaceMode==='features'&&p.evidence?hits.find(h=>featureAt(p.evidence!,h.point.x,h.point.z)):hits[0];if(hit){if(p.pickMode)p.onPick(gridPoint(p.grid,hit.point.x,hit.point.z));else if(p.evidence){const f=featureAt(p.evidence,hit.point.x,hit.point.z);if(f)p.onSelectFeature(f.id);}}}drag=false;};
  const wheel=(e:WheelEvent)=>{if(latest.current.overview)return;e.preventDefault();if(latest.current.thirdPerson)followDistance=THREE.MathUtils.clamp(followDistance*Math.exp(e.deltaY*.001),1.8,7);else{camera.fov=THREE.MathUtils.clamp(camera.fov+e.deltaY*.025,35,80);camera.updateProjectionMatrix();}r.dirty=true;};
  const keydown=(e:KeyboardEvent)=>{if(e.defaultPrevented||!acceptsWalkInput(e.target)||latest.current.paused||latest.current.overview||document.hidden)return;if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'].includes(e.code)){e.preventDefault();r.keys.add(e.code);}if(e.code==='F8'){e.preventDefault();measureStart=performance.now();measureFrames=0;el.dataset.benchmark='running';}};
  const keyup=(e:KeyboardEvent)=>r.keys.delete(e.code),blur=()=>{r.keys.clear();velocity=stoppedMotion();drag=false;};
  renderer.domElement.addEventListener('pointerdown',onDown);renderer.domElement.addEventListener('pointermove',onMove);renderer.domElement.addEventListener('pointerup',onUp);renderer.domElement.addEventListener('pointercancel',blur);renderer.domElement.addEventListener('wheel',wheel,{passive:false});addEventListener('keydown',keydown);addEventListener('keyup',keyup);addEventListener('blur',blur);document.addEventListener('visibilitychange',blur);
  controls.addEventListener('change',()=>{r.dirty=true;});const resize=new ResizeObserver(()=>{const b=el.getBoundingClientRect();renderer.setSize(b.width,b.height);camera.aspect=b.width/b.height;camera.updateProjectionMatrix();r.dirty=true;});resize.observe(el);
  const tick=(now:number)=>{if(!alive)return;const delta=Math.min(.05,(now-lastInput)/1000||.016);lastInput=now;const p=latest.current;let moving=false;
   const allowed=!p.overview&&!p.pickMode&&!p.paused&&!document.hidden&&el.dataset.loaded==='true'&&!!p.route;
   if(allowed){const forward=Number(r.keys.has('KeyW')||r.keys.has('ArrowUp'))-Number(r.keys.has('KeyS')||r.keys.has('ArrowDown'))+p.motion.forward,right=Number(r.keys.has('KeyD'))-Number(r.keys.has('KeyA'))+p.motion.right;
    if(r.keys.has('ArrowLeft'))r.targetYaw+=delta;if(r.keys.has('ArrowRight'))r.targetYaw-=delta;
    const boost=r.keys.has('ShiftLeft')||r.keys.has('ShiftRight'),step=smoothMotion(velocity,{forward,right},delta,p.settings.speed,boost);velocity=step.velocity;el.dataset.pace=boost?'2x rehearsal':'1x';
    if(Math.hypot(step.forward,step.right)>1e-6){const dx=Math.sin(r.yaw)*step.forward-Math.cos(r.yaw)*step.right,dz=Math.cos(r.yaw)*step.forward+Math.sin(r.yaw)*step.right,result=moveOnRover(p.terrain,r.walk,dx,dz,p.settings);r.walk=result.point;total+=result.distance;moving=result.distance>0;phase+=result.distance*6;r.dirty=true;if(result.reason)velocity=stoppedMotion();if(now-lastEmit>90){latest.current.onMove({...r.walk},total,r.yaw,result.reason);total=0;lastEmit=now;}}
   }else{velocity=stoppedMotion();r.keys.clear();el.dataset.pace='paused';}
   const newYaw=smoothView(r.yaw,r.targetYaw,delta),newPitch=smoothView(r.pitch,r.targetPitch,delta);if(newYaw!==r.yaw||newPitch!==r.pitch){r.yaw=newYaw;r.pitch=newPitch;r.dirty=true;}
   const ground=heightAt(p.terrain,r.walk);if(!p.overview&&ground!==null&&Math.abs(eyeHeight-ground-1.7)>.0001)r.dirty=true;
   if(!moving&&r.dirty&&now-lastEmit>90){latest.current.onMove({...r.walk},total,r.yaw,'');total=0;lastEmit=now;}
   if(p.thirdPerson&&avatar.group.userData.assetStatus==='deferred')void avatar.load().then(()=>{r.dirty=true;});if(p.thirdPerson&&avatar.update(phase,moving,delta))r.dirty=true;
   if(measureStart){r.targetYaw+=delta*.12;r.dirty=true;}
   if(r.dirty){groundCamera(delta);draw();r.dirty=false;}
   frame=requestAnimationFrame(tick);
  };frame=requestAnimationFrame(tick);
  return()=>{alive=false;photoController.abort();disposePhotoSupport(photoSupport);cancelAnimationFrame(frame);removeEventListener('keydown',keydown);removeEventListener('keyup',keyup);removeEventListener('blur',blur);document.removeEventListener('visibilitychange',blur);resize.disconnect();controls.dispose();evidence?.dispose();avatar.dispose();clear(objects);clear(overlays);textures.forEach(t=>t.dispose());r.hazardTexture?.dispose();r.routeTexture?.dispose();contact.geometry.dispose();contact.material.dispose();environment.dispose();pmrem.dispose();sky.dispose();renderer.dispose();renderer.domElement.remove();runtime.current=null;};
 },[props.manifest,props.grid,props.evidence]);
 useEffect(()=>{const r=runtime.current;if(!r)return;r.photoSupport.visible=!!props.photoSupport&&props.surfaceMode==='photo';r.dirty=true;},[props.photoSupport,props.surfaceMode]);
 useEffect(()=>{const r=runtime.current;if(!r)return;if(props.paused){r.keys.clear();r.resetMotion();}},[props.paused]);
 useEffect(()=>{const r=runtime.current;if(!r)return;r.evidenceScene?.update(props.surfaceMode,props.selectedFeature,props.showReference);r.overlays.visible=props.surfaceMode!=='features';r.dirty=true;},[props.surfaceMode,props.selectedFeature,props.showReference,props.evidence,props.manifest,tileRevision]);
 useEffect(()=>{const r=runtime.current;if(!r)return;r.controls.enabled=props.overview;r.keys.clear();r.resetMotion();if(props.overview){r.visorFov=r.camera.fov;frameRoverOverview(r,props);}else{r.camera.fov=r.visorFov;r.camera.updateProjectionMatrix();}r.dirty=true;},[props.overview,props.manifest]);
 useEffect(()=>{const r=runtime.current,f=props.focusFeature.feature;if(!r||!props.overview)return;if(!f){frameRoverOverview(r,props);r.dirty=true;return;}r.controls.minDistance=.35;const target=new THREE.Vector3(...f.peak),origin=props.manifest.inspectionCamera?.position??[.34,1.97,.55],offset=new THREE.Vector3(origin[0]-target.x,0,origin[2]-target.z).normalize().multiplyScalar(2.5);if(offset.lengthSq()<.1)offset.set(-2.5,0,-1);offset.y=1.8;r.controls.target.copy(target);r.camera.position.copy(target).add(offset);r.camera.fov=48;r.camera.updateProjectionMatrix();r.controls.update();r.dirty=true;},[props.focusFeature.id,props.manifest]);
 useEffect(()=>{const r=runtime.current;if(!r)return;const q=r.walk;if(props.controlled||Math.hypot(q.x-props.crew.x,q.y-props.crew.y)>2){r.walk={...props.crew};}if(props.controlled&&props.hazardFrame){const from=worldPoint(props.grid,props.crew),next=props.hazardFrame.route.find(p=>Math.hypot(p.x/props.grid.cellSize-props.crew.x,p.y/props.grid.cellSize-props.crew.y)>1);if(next){const w=worldPoint(props.grid,{x:next.x/props.grid.cellSize,y:next.y/props.grid.cellSize});r.yaw=r.targetYaw=Math.atan2(w.x-from.x,w.z-from.z);}}r.dirty=true;},[props.crew,props.thirdPerson,props.manifest,props.controlled,props.hazardFrame]);
 useEffect(()=>{const r=runtime.current;if(!r)return;const a=props.command.action;if(a==='reset'){r.walk={...props.crew};r.pitch=-.52;r.targetPitch=-.52;r.camera.fov=50;}else if(props.overview){r.camera.position.sub(r.controls.target).multiplyScalar(a==='in'?.75:1.3).add(r.controls.target);r.controls.update();}else r.camera.fov=THREE.MathUtils.clamp(r.camera.fov*(a==='in'?.85:1.15),32,85);r.camera.updateProjectionMatrix();r.dirty=true;},[props.command,props.manifest]);
 useEffect(()=>{
  const r=runtime.current;if(!r)return;clear(r.overlays);const {grid:g,terrain:t}=props;
  const addPath=(path:number[],color:string,inbound=false)=>{if(path.length<2)return;const pos:number[]=[],uv:number[]=[],indices:number[]=[];let distance=0;
   for(let j=0;j<path.length;j++){const i=path[j],p={x:i%g.width,y:Math.floor(i/g.width)},w=worldPoint(g,p),before=worldPoint(g,{x:path[Math.max(0,j-1)]%g.width,y:Math.floor(path[Math.max(0,j-1)]/g.width)}),after=worldPoint(g,{x:path[Math.min(path.length-1,j+1)]%g.width,y:Math.floor(path[Math.min(path.length-1,j+1)]/g.width)}),dx=after.x-before.x,dz=after.z-before.z,len=Math.hypot(dx,dz)||1;if(j)distance+=Math.hypot(w.x-before.x,w.z-before.z);
    for(const side of [-1,1]){const x=w.x-dz/len*.14*side,z=w.z+dx/len*.14*side,h=heightAt(t,gridPoint(g,x,z))??t.elevation[i]!;pos.push(x,h+.06+(inbound?.018:0),z);uv.push((side+1)/2,distance*.85);}if(j){const k=j*2;indices.push(k-2,k-1,k,k-1,k+1,k);}
   }const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);r.overlays.add(new THREE.Mesh(geometry,routeRibbonMaterial(color,inbound)));
  };
  if(props.overview)for(const route of props.alternatives)if(route.mode!==props.route?.mode)addPath(route.outbound,'#91a3a8');
  if(props.route&&props.overview){addPath(props.route.outbound,'#b3dfd3');if(props.overview)addPath(props.route.inbound,'#d4e1df',true);}
  const target=worldPoint(g,props.target),h=heightAt(t,props.target);if(h!==null){const ring=new THREE.Mesh(new THREE.TorusGeometry(.38,.035,6,28),new THREE.MeshBasicMaterial({color:'#b3dfd3'}));ring.rotation.x=-Math.PI/2;ring.position.set(target.x,h+.07,target.z);r.overlays.add(ring);const marker=new THREE.Mesh(new THREE.ConeGeometry(.10,.25,12),new THREE.MeshBasicMaterial({color:'#b3dfd3'}));marker.rotation.z=Math.PI;marker.position.set(target.x,h+.9,target.z);r.overlays.add(marker);}
  const label=(point:Point,text:string,warning=false)=>{const w=worldPoint(g,point),h=heightAt(t,point);if(h===null)return;const canvas=document.createElement('canvas');canvas.width=320;canvas.height=64;const ctx=canvas.getContext('2d')!;ctx.fillStyle=warning?'#30151d':'#172025';ctx.beginPath();ctx.roundRect(1,1,318,62,10);ctx.fill();ctx.strokeStyle=warning?RISK_RED:'#a6bbbf';ctx.lineWidth=2;ctx.stroke();ctx.font='500 28px sans-serif';ctx.fillStyle='#f2f5f5';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,160,34);const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map,transparent:true,depthTest:false,sizeAttenuation:false}));sprite.position.set(w.x,h+1.15,w.z);sprite.scale.set(.22,.044,1);sprite.center.set(.5,0);sprite.renderOrder=5;r.overlays.add(sprite);};
  for(const o of props.obstacles.filter(o=>o.material==='sand')){
   const points:THREE.Vector3[]=[];for(let n=0;n<64;n++){const a=n/64*Math.PI*2,b=(n+1)/64*Math.PI*2,radius=o.radius+.35,x0=o.x+Math.cos(a)*radius,z0=o.z+Math.sin(a)*radius,x1=o.x+Math.cos(b)*radius,z1=o.z+Math.sin(b)*radius,h0=heightAt(t,gridPoint(g,x0,z0)),h1=heightAt(t,gridPoint(g,x1,z1));if(h0!==null&&h1!==null)points.push(new THREE.Vector3(x0,h0+.055,z0),new THREE.Vector3(x1,h1+.055,z1));}
   r.overlays.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:RISK_RED,depthWrite:false})));if(props.overview)label(gridPoint(g,o.x,o.z),o.kind==='simulated'?'SAND · SIMULATED':'SAND · REVIEWED',true);
  }
  label(props.target,props.controlled&&props.hazardFrame?props.hazardFrame.action==='RETURN'?'A · Start / return':'B · Route target':'B · Observation');if(props.overview)label(gridPoint(g,g.start.x,g.start.z),'A · Start / return');
  if(props.hazardFrame?.coordinates==='GRID_NORTH_EAST_METRES'&&props.hazardFrame.crs===t.crs){if(props.hazardRouteStyle==='ribbon'&&props.hazardFrame.anchorsEnabled)evacuationRibbon(r.overlays,t,g,props.hazardFrame);addHazardScene(r.overlays,t,props.hazardRouteStyle==='ribbon'?{...props.hazardFrame,anchorsEnabled:false}:props.hazardFrame,(p,_z,offset=0)=>{const w=worldPoint(g,p);return new THREE.Vector3(w.x,(heightAt(t,p)??0)+offset,w.z);});}
  r.dirty=true;
 },[props.terrain,props.route,props.overview,props.target,props.alternatives,props.manifest,tileRevision,props.hazardFrame,props.obstacles,props.hazardRouteStyle]);
 useEffect(()=>{
  const r=runtime.current;if(!r)return;
  const data=groundRouteRaster(props.grid,props.terrain,props.route);
  r.routeTexture?.dispose();r.routeTexture=new THREE.DataTexture(data.pixels,data.width,data.height);
  r.routeTexture.minFilter=THREE.LinearFilter;r.routeTexture.magFilter=THREE.LinearFilter;r.routeTexture.needsUpdate=true;
  r.routeUniforms.uRoverRoute.value=r.routeTexture;r.routeUniforms.uRouteColor.value.set(props.route?.mode==='shortest'?'#ffce7a':props.route?.mode==='time'?'#b9b4ff':'#8bf4d3');r.dirty=true;
 },[props.grid,props.terrain,props.route,props.manifest]);
 useEffect(()=>{const r=runtime.current;if(r){r.routeUniforms.uRouteEnabled.value=!props.overview&&props.surfaceMode==='photo'&&!!props.route?1:0;r.dirty=true;}},[props.overview,props.surfaceMode,props.route,props.manifest]);
 useEffect(()=>{
  const r=runtime.current;if(!r)return;const {grid:g,terrain:t}=props;
  const started=performance.now(),pixels=stormDisplayPixels(t,props.hazardFrame?.coordinates==='GRID_NORTH_EAST_METRES'?props.hazardFrame:undefined,props.hazards?roverHazardPixels(g,t,props.obstacles):new Uint8Array(g.width*g.height*4));if(host.current){host.current.dataset.stormSource=props.hazardFrame?.source??'none';host.current.dataset.warningCells=String(pixels.filter((v,i)=>i%4===3&&v>0&&pixels[i-2]<120&&pixels[i-3]>200).length);}if(host.current){host.current.dataset.hazardBuilds=String(Number(host.current.dataset.hazardBuilds??0)+1);host.current.dataset.hazardBuildMs=(performance.now()-started).toFixed(2);}r.hazardTexture?.dispose();r.hazardTexture=new THREE.DataTexture(pixels,g.width,g.height);r.hazardTexture.needsUpdate=true;r.hazardTexture.colorSpace=THREE.SRGBColorSpace;r.hazardUniforms.uRoverHazards.value=r.hazardTexture;r.dirty=true;
 },[props.grid,props.terrain,props.obstacles,props.manifest,props.hazards,props.hazardFrame]);
 useEffect(()=>{const r=runtime.current;if(r){r.hazardUniforms.uRoverEnabled.value=props.hazards||props.hazardFrame?.forecast.length?1:0;r.dirty=true;}},[props.hazards,props.manifest,props.hazardFrame]);
 return <div ref={host} className="rover-scene" tabIndex={0} role="application" aria-label={props.controlled?"Simulated helmet camera on recorded NASA terrain. Drag to look; route controls movement.":"Walk on recorded NASA terrain using WASD. Hold Shift for faster rehearsal movement. Drag to look. Scroll to zoom."}>{error&&<div className="rover-error" role="alert">{error}<button onClick={()=>location.reload()}>Retry terrain</button></div>}</div>;
}
