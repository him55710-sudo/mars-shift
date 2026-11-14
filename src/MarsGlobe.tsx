import {useEffect,useRef,useState} from 'react';
import {circleCoordinates,MARS_WKID,neighborhood,SERVICES,summarizeHeights} from './mars-atlas';
import type {MarsPosition,TerrainSamples} from './mars-atlas';

// Isolate the CDN SDK's dynamic AMD boundary. Application data remain typed.
type SDKModule=new(options?:any)=>any;
type AMDWindow=Window&{require?:(ids:string[],resolve:(...modules:SDKModule[])=>void,reject:(e:Error)=>void)=>void};
let sdkPromise:Promise<SDKModule[]>|null=null;
const MODULES=['esri/Map','esri/views/SceneView','esri/layers/ElevationLayer','esri/layers/TileLayer','esri/layers/GraphicsLayer','esri/Graphic','esri/geometry/Point','esri/geometry/Multipoint','esri/geometry/Polygon','esri/core/reactiveUtils'];
function loadSDK(){
  if(sdkPromise)return sdkPromise;
  sdkPromise=new Promise<SDKModule[]>((resolve,reject)=>{
    const link=document.createElement('link');link.rel='stylesheet';link.href='https://js.arcgis.com/4.34/esri/themes/dark/main.css';link.dataset.marsSdk='css';if(!document.querySelector('[data-mars-sdk="css"]'))document.head.append(link);
    const ready=()=>{const amd=(window as unknown as AMDWindow).require;if(!amd){reject(Error('Could not initialize the map engine.'));return;}amd(MODULES,(...modules)=>resolve(modules),reject);};
    if((window as unknown as AMDWindow).require){ready();return;}
    const script=document.createElement('script');script.src='https://js.arcgis.com/4.34/';script.async=true;script.dataset.marsSdk='js';
    const timer=setTimeout(()=>{script.remove();reject(Error('Map connection timed out. Check your network and retry.'));},45000);
    script.onload=()=>{clearTimeout(timer);ready();};script.onerror=()=>{clearTimeout(timer);script.remove();reject(Error('Could not load the map engine. Check your network.'));};document.head.append(script);
  }).catch(e=>{sdkPromise=null;throw e;});return sdkPromise;
}
export type AtlasCommand={id:number;type:'home'|'fly'|'around'|'top'|'in'|'out'|'north';position?:MarsPosition;scale?:number};
export type GlobeStatus={ready:boolean;updating:boolean;scale:number;altitude:number;tilt:number;error:string};
type Props={position:MarsPosition;myPosition:MarsPosition|null;radius:number;command:AtlasCommand;base:'ctx'|'color';hirise:boolean;onPick:(p:MarsPosition)=>void;onStatus:(s:GlobeStatus)=>void;onSamples:(s:TerrainSamples)=>void};
type Runtime={view:any;map:any;elevation:any;ctx:any;color:any;hirise:any;jezero:any;markers:any;Graphic:SDKModule;Point:SDKModule;Multipoint:SDKModule;Polygon:SDKModule;reactive:any};
const startingStatus:GlobeStatus={ready:false,updating:true,scale:0,altitude:0,tilt:0,error:''};
export default function MarsGlobe(props:Props){
  const host=useRef<HTMLDivElement>(null),runtime=useRef<Runtime|null>(null),latest=useRef(props),[ready,setReady]=useState(false),[attempt,setAttempt]=useState(0),[error,setError]=useState('');
  useEffect(()=>{latest.current=props;});
  useEffect(()=>{
    const el=host.current;if(!el)return;let cancelled=false,view:any,handles:{remove:()=>void}[]=[];
    setError('');setReady(false);latest.current.onStatus(startingStatus);
    loadSDK().then(async([Map,SceneView,ElevationLayer,TileLayer,GraphicsLayer,Graphic,Point,Multipoint,Polygon,reactiveModule])=>{
      if(cancelled)return;
      const reactive=reactiveModule as unknown as {watch:(get:()=>unknown,callback:(value:any)=>void,options?:unknown)=>{remove:()=>void}};
      const elevation=new ElevationLayer({url:SERVICES.elevation,copyright:'NASA GSFC / DLR / USGS / JPL / Esri · 200 m DEM'});
      const color=new TileLayer({url:SERVICES.color,visible:latest.current.base==='color',copyright:'NASA / USGS / Esri · Viking MDIM 231 m'});
      const ctx=new TileLayer({url:SERVICES.ctx,visible:latest.current.base==='ctx',copyright:'NASA/JPL/MSSS/Caltech Murray Lab/Esri · CTX ~5 m'});
      const hirise=new TileLayer({url:SERVICES.hirise,customParameters:{blankTile:true},visible:latest.current.hirise,minScale:350000,copyright:'NASA/JPL/University of Arizona/USGS/Esri · HiRISE coverage varies'});
      // The NASA WMTS and CTX grids share 2 x 1 geographic root tiles.
      // Reuse ArcGIS's Mars-compatible TileLayer scheme; NASA's 256 px images
      // fill the same footprint as its 512 px tiles. This resizes display pixels,
      // and does not increase the original image's observational resolution.
      const JezeroLayer=(TileLayer as any).createSubclass({
        fetchTile(level:number,row:number,col:number,options?:{signal?:AbortSignal}){
          const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;
          const span=180/2**level,west=-180+col*span,north=90-row*span;
          if(west>77.583964||west+span<77.2229331||north<18.3067994||north-span>18.669315||level>17)return Promise.resolve(canvas);
          return new Promise<HTMLCanvasElement>((resolve,reject)=>{
            const img=new Image();img.crossOrigin='anonymous';
            const abort=()=>{img.onload=null;img.onerror=null;img.src='';reject(new DOMException('Tile request cancelled','AbortError'));};
            const finish=()=>options?.signal?.removeEventListener('abort',abort);
            img.onload=()=>{finish();const context=canvas.getContext('2d')!;context.drawImage(img,0,0,512,512);resolve(canvas);};
            img.onerror=()=>{finish();resolve(canvas);};
            if(options?.signal?.aborted){abort();return;}options?.signal?.addEventListener('abort',abort,{once:true});
            img.src=SERVICES.jezero.replace('{level}',String(level)).replace('{row}',String(row)).replace('{col}',String(col));
          });
        }
      });
      const jezero=new JezeroLayer({url:SERVICES.ctx,title:'NASA Trek Jezero 25 cm orthomosaic',visible:latest.current.hirise,minScale:250000,copyright:'NASA Trek · JPL/University of Arizona/USGS · Jezero 25 cm ortho'});

      const markers=new GraphicsLayer({elevationInfo:{mode:'on-the-ground'}}),map=new Map({ground:{layers:[elevation],surfaceColor:[105,84,65]},layers:[color,ctx,hirise,jezero,markers]});
      view=new SceneView({container:el,map,spatialReference:{wkid:MARS_WKID},qualityProfile:'high',ui:{components:['attribution']},camera:{position:{x:77.45,y:18.44,z:18000000*Math.max(1,el.clientHeight/el.clientWidth),spatialReference:{wkid:MARS_WKID}},heading:0,tilt:0},environment:{atmosphereEnabled:false,starsEnabled:true,background:{type:'color',color:[9,14,12]},lighting:{type:'virtual',directShadowsEnabled:true}},navigation:{mouseWheelZoomEnabled:true,momentumEnabled:true}});
      runtime.current={view,map,elevation,ctx,color,hirise,jezero,markers,Graphic,Point,Multipoint,Polygon,reactive};
      await view.when();if(cancelled)return;
      setReady(true);
      const report=()=>{if(!cancelled&&!view.destroyed)latest.current.onStatus({ready:true,updating:view.updating,scale:view.scale,altitude:view.camera.position.z,tilt:view.camera.tilt,error:''});};
      handles.push(reactive.watch(()=>view.updating,report),reactive.watch(()=>view.stationary,(stationary:boolean)=>{if(stationary)report();}));
      handles.push(view.on('click',(event:any)=>{const p=event.mapPoint;if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y))latest.current.onPick({lon:p.x,lat:p.y});}));report();
    }).catch(e=>{if(!cancelled){const message=e?.message||'Could not initialize the 3D map.';setError(message);latest.current.onStatus({...startingStatus,updating:false,error:message});}});
    return()=>{cancelled=true;handles.forEach(h=>h.remove());const state=runtime.current;runtime.current=null;if(view){view.map=null;view.destroy();}state?.map.destroy();el.replaceChildren();};
  },[attempt]);
  useEffect(()=>{const r=runtime.current;if(!r)return;r.ctx.visible=props.base==='ctx';r.color.visible=props.base==='color';r.hirise.visible=props.hirise;r.jezero.visible=props.hirise;},[props.base,props.hirise,ready]);
  useEffect(()=>{
    const r=runtime.current;if(!r||!ready)return;const {command}=props,point=command.position??latest.current.position;
    const target=new r.Point({x:point.lon,y:point.lat,spatialReference:{wkid:MARS_WKID}}),duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:850;
    let destination:any;
    if(command.type==='home')destination={position:{x:point.lon,y:point.lat,z:18000000*Math.max(1,r.view.height/r.view.width),spatialReference:{wkid:MARS_WKID}},heading:0,tilt:0};
    else if(command.type==='fly')destination={target,scale:command.scale??180000,tilt:38,heading:0};
    else if(command.type==='around')destination={target,scale:28000,tilt:68,heading:r.view.camera.heading};
    else if(command.type==='top')destination={target,scale:Math.min(r.view.scale,350000),tilt:0,heading:0};
    else if(command.type==='north'){const camera=r.view.camera.clone();camera.heading=0;destination=camera;}
    else destination={target:r.view.center,scale:Math.max(90,r.view.scale*(command.type==='in'?.5:2)),tilt:r.view.camera.tilt};
    r.view.goTo(destination,{duration}).catch((e:any)=>{if(e.name!=='AbortError'&&e.name!=='view:goto-interrupted')latest.current.onStatus({...startingStatus,ready:true,updating:false,error:'Could not move the view. Retry when the map is ready.'});});
  },[props.command,ready]);
  useEffect(()=>{
    const r=runtime.current;if(!r||!ready)return;const {position,myPosition,radius}=props,graphics=[];
    const pointGraphic=(p:MarsPosition,color:string,size:number)=>new r.Graphic({geometry:new r.Point({x:p.lon,y:p.lat,spatialReference:{wkid:MARS_WKID}}),symbol:{type:'simple-marker',style:'circle',color,size,outline:{color:'#f9f2df',width:1.5}}});
    graphics.push(pointGraphic(position,'#e8b080',9));
    if(myPosition){graphics.push(new r.Graphic({geometry:new r.Polygon({rings:[circleCoordinates(myPosition,radius)],spatialReference:{wkid:MARS_WKID}}),symbol:{type:'simple-fill',color:[159,216,187,.10],outline:{color:[169,223,195,.9],width:1.5,style:'dash'}}}),pointGraphic(myPosition,'#b8dfc5',12));}
    r.markers.removeAll();r.markers.addMany(graphics);
  },[props.position,props.myPosition,props.radius,ready]);
  useEffect(()=>{
    const r=runtime.current;if(!r||!ready)return;let current=true;const position=props.position;
    latest.current.onSamples({...summarizeHeights([]),position,status:'loading',resolution:200});
    const points=neighborhood(position).map(p=>[p.lon,p.lat]);
    r.elevation.queryElevation(new r.Multipoint({points,spatialReference:{wkid:MARS_WKID}}),{demResolution:'finest-contiguous',returnSampleInfo:true,noDataValue:-999999}).then((result:any)=>{if(!current)return;const values=result.geometry.points.map((p:number[])=>p[2]);latest.current.onSamples({...summarizeHeights(values),position,status:'ready',resolution:Math.max(0,...(result.sampleInfo??[]).map((s:any)=>Number.isFinite(s.demResolution)?s.demResolution:200))||200});}).catch(()=>{if(current)latest.current.onSamples({...summarizeHeights([]),position,status:'error',resolution:200});});
    return()=>{current=false;};
  },[props.position,ready]);
  return <><div className="ma-globe" ref={host} aria-label="Global Mars 3D map. Scroll to zoom, drag to pan, right-drag to rotate. Click to select a point."/>{error&&<div className="ma-engine-error"><h2>Could not load the global map</h2><p>{error}</p><button onClick={()=>setAttempt(v=>v+1)}>Reload</button><a href="https://murray-lab.caltech.edu/CTX/V01/SceneView/MurrayLabCTXmosaic.html" target="_blank" rel="noreferrer">Open original Caltech map ↗</a></div>}</>;
}
