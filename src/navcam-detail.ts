export type SurfacePosition={x:number;z:number};
export type NavcamGrid={width:number;height:number;cellSize:number;origin:number[];elevation:(number|null)[];slope:(number|null)[];start:SurfacePosition;target:SurfacePosition};
export type NavcamTile={url:string;transform:number[];bounds:number[][];triangles:number;bytes:number;sha256:string;sourceProduct:string;contextOnly?:boolean};
export type RecordedCamera={position:number[];direction:number[];imageSamplePixels:number[];verticalFovDegrees:number;sourceProduct:string};
export type NavcamManifest={inspectionCamera?:RecordedCamera;schemaVersion:number;title:string;credit:string;sourceCommit:string;sourceUrl:string;usagePolicyUrl:string;grid:string;start:SurfacePosition;target:SurfacePosition;assets:NavcamTile[];detailAssets:NavcamTile[];calibratedAssets?:NavcamTile[];calibratedProcessing?:{triangles:number;bytes:number;tilesRetextured:number};detailProcessing:{triangles:number;bytes:number};frame:{registrationToOrbitalMission:null}};
export type SurfaceView='eye'|'detail'|'orbit';
export function validateNavcamManifest(value:unknown):NavcamManifest{
 const m=value as NavcamManifest;
 if(!m||m.schemaVersion!==1||!Array.isArray(m.detailAssets)||!m.detailAssets.length||!Array.isArray(m.assets)||!m.assets.length||m.grid!=='/data/drive1004/navigation-grid.json'||m.frame?.registrationToOrbitalMission!==null)throw Error('Recorded terrain manifest is invalid.');
 if(m.inspectionCamera&&(![m.inspectionCamera.position,m.inspectionCamera.direction].every(v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite))||Math.abs(Math.hypot(...m.inspectionCamera.direction)-1)>.001||!Number.isFinite(m.inspectionCamera.verticalFovDegrees)||m.inspectionCamera.verticalFovDegrees<20||m.inspectionCamera.verticalFovDegrees>85||!m.assets.some(a=>a.sourceProduct===m.inspectionCamera!.sourceProduct)))throw Error('Recorded camera is invalid.');
 for(const a of [...m.assets,...m.detailAssets,...(m.calibratedAssets??[])])if(!/^\/data\/drive1004\/[a-zA-Z0-9/.-]+\.glb$/.test(a.url)||a.url.includes('..')||!Array.isArray(a.transform)||a.transform.length!==16||!a.transform.every(Number.isFinite)||a.bounds?.length!==2||a.bounds.some(v=>v.length!==3||!v.every(Number.isFinite))||!Number.isInteger(a.triangles)||a.triangles<=0||!Number.isFinite(a.bytes)||a.bytes<=0||!/^[a-f0-9]{64}$/.test(a.sha256))throw Error('Recorded terrain tile metadata is invalid.');
 return m;
}
export function validateNavcamGrid(value:unknown):NavcamGrid{
 const g=value as NavcamGrid,n=g?.width*g?.height;
 if(!g||!Number.isInteger(g.width)||!Number.isInteger(g.height)||g.width<2||g.height<2||n>1e6||!Number.isFinite(g.cellSize)||g.cellSize<=0||g.origin?.length!==2||!g.origin.every(Number.isFinite)||g.elevation?.length!==n||g.slope?.length!==n||!g.elevation.every(v=>v===null||Number.isFinite(v))||!g.slope.every(v=>v===null||Number.isFinite(v))||![g.start?.x,g.start?.z,g.target?.x,g.target?.z].every(Number.isFinite))throw Error('Recorded terrain height support is invalid.');
 return g;
}
/** Conservative visual camera support; never fills a missing stereo sample. */
export function observedHeight(g:NavcamGrid,p:SurfacePosition):number|null{
 const x=(p.x-g.origin[0])/g.cellSize-.5,z=(p.z-g.origin[1])/g.cellSize-.5;if(!Number.isFinite(x)||!Number.isFinite(z)||x<0||z<0||x>g.width-1||z>g.height-1)return null;
 const x0=Math.floor(x),z0=Math.floor(z),x1=Math.min(g.width-1,x0+1),z1=Math.min(g.height-1,z0+1),fx=x-x0,fz=z-z0;
 const samples=[[z0*g.width+x0,(1-fx)*(1-fz)],[z0*g.width+x1,fx*(1-fz)],[z1*g.width+x0,(1-fx)*fz],[z1*g.width+x1,fx*fz]];
 let height=0;for(const [i,w] of samples){if(w<1e-10)continue;const v=g.elevation[i];if(v===null||g.slope[i]===null||g.slope[i]!>35)return null;height+=v*w;}return height;
}
export function moveInspection(g:NavcamGrid,from:SurfacePosition,dx:number,dz:number){
 const distance=Math.hypot(dx,dz);let p={...from},h=observedHeight(g,p),moved=0;
 if(!Number.isFinite(distance)||h===null)return {position:p,moved,reason:'Outside verified stereo ground'};
 const count=Math.max(1,Math.ceil(distance/.08));
 for(let n=1;n<=count;n++){const q={x:from.x+dx*n/count,z:from.z+dz*n/count},next=observedHeight(g,q),step=Math.hypot(q.x-p.x,q.z-p.z);
  if(next===null)return {position:p,moved,reason:'End of observed walking surface'};
  if(Math.abs(next-h)>step*Math.tan(35*Math.PI/180)+.002)return {position:p,moved,reason:'Steep observed surface'};
  moved+=step;p=q;h=next;
 }return {position:p,moved,reason:''};
}
/** Load the finest original leaves nearest the initial view first. */
export function prioritizedTiles(tiles:NavcamTile[],p:SurfacePosition){
 const distance=(a:NavcamTile)=>{const [lo,hi]=a.bounds;return Math.hypot(Math.max(lo[0]-p.x,0,p.x-hi[0]),Math.max(lo[2]-p.z,0,p.z-hi[2]))+(a.contextOnly?50:0);};
 return tiles.slice().sort((a,b)=>distance(a)-distance(b));
}
