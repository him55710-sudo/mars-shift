export const MARS_RADIUS=3396190;
export const MARS_WKID=104971;
export type MarsPosition={lon:number;lat:number};
export const SERVICES={
  ctx:'https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX1/MapServer',
  color:'https://astro.arcgis.com/arcgis/rest/services/OnMars/MDIM/MapServer',
  hirise:'https://astro.arcgis.com/arcgis/rest/services/OnMars/HiRISE/MapServer',
  elevation:'https://astro.arcgis.com/arcgis/rest/services/OnMars/MDEM200M/ImageServer',
  jezero:'https://trek.nasa.gov/tiles/Mars/EQ/JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd/1.0.0/default/default028mm/{level}/{row}/{col}.png',
};
export const PLACES=[
  {id:'jezero',name:'Jezero',ko:'Jezero crater',lon:77.4508,lat:18.4447,scale:180000,detail:'Perseverance · 25 cm orthomosaic',tag:'HiRISE'},
  {id:'gale',name:'Gale',ko:'Gale crater',lon:137.4417,lat:-4.5895,scale:260000,detail:'Curiosity · Mount Sharp',tag:'ROVER'},
  {id:'olympus',name:'Olympus Mons',ko:'Olympus Mons',lon:-133.8,lat:18.65,scale:5000000,detail:'Giant shield volcano and basal cliffs',tag:'VOLCANO'},
  {id:'valles',name:'Valles Marineris',ko:'Valles Marineris',lon:-65,lat:-13.9,scale:6500000,detail:'Long canyons and steep walls',tag:'CANYON'},
  {id:'noctis',name:'Noctis Labyrinthus',ko:'Noctis Labyrinthus',lon:-102.2,lat:-7.2,scale:2200000,detail:'Intersecting valleys and depressions',tag:'RELIEF'},
  {id:'hellas',name:'Hellas Planitia',ko:'Hellas Planitia',lon:70.5,lat:-42.4,scale:14000000,detail:'Large southern impact basin',tag:'BASIN'},
  {id:'north',name:'Planum Boreum',ko:'Planum Boreum',lon:0,lat:86,scale:6500000,detail:'Northern spiral troughs and layered deposits',tag:'POLAR'},
  {id:'south',name:'Planum Australe',ko:'Planum Australe',lon:0,lat:-86,scale:6500000,detail:'Southern layered deposits',tag:'POLAR'},
] as const;
export const PANORAMAS=[
  {id:1,name:'Butler Landing',detail:'Sol 3–11 · landing site',kind:'Actual Mastcam-Z observations',lon:77.45081155,lat:18.44467749},
  {id:37,name:'Bunsen Peak',detail:'Sol 1074–1082 · rocks and horizon',kind:'Actual Mastcam-Z observations',lon:77.32720278,lat:18.49183272},
  {id:50,name:'Crocodile Bridge',detail:'Sol 1717–1754 · crater rim',kind:'Actual Mastcam-Z observations',lon:77.25129581,lat:18.42898923},
  {id:52,name:'Vingeanne',detail:'Sol 1823 · surface observation',kind:'Actual Mastcam-Z observations',lon:77.21840919,lat:18.43181976},
  {id:56,name:'Marble Mountain',detail:'Sol 1968 · surface observation',kind:'Actual Mastcam-Z observations',lon:77.23186719,lat:18.43714650},
] as const;
export const normalizeLongitude=(lon:number)=>((lon+180)%360+360)%360-180;
export function parsePosition(lon:string,lat:string):MarsPosition|null{
  if(!lon.trim()||!lat.trim())return null;const x=Number(lon),y=Number(lat);
  return Number.isFinite(x)&&Number.isFinite(y)&&x>=-180&&x<=360&&y>=-90&&y<=90?{lon:normalizeLongitude(x),lat:y}:null;
}
const rad=(n:number)=>n*Math.PI/180,deg=(n:number)=>n*180/Math.PI;
export function marsDistance(a:MarsPosition,b:MarsPosition){const h=Math.sin(rad(b.lat-a.lat)/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(rad(b.lon-a.lon)/2)**2;return 2*MARS_RADIUS*Math.asin(Math.sqrt(Math.min(1,Math.max(0,h))));}
export function destination(p:MarsPosition,distance:number,bearing:number):MarsPosition{
  const d=distance/MARS_RADIUS,b=rad(bearing),lat=rad(p.lat),lon=rad(p.lon),next=Math.asin(Math.max(-1,Math.min(1,Math.sin(lat)*Math.cos(d)+Math.cos(lat)*Math.sin(d)*Math.cos(b))));
  return {lon:normalizeLongitude(deg(lon+Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(lat),Math.cos(d)-Math.sin(lat)*Math.sin(next)))),lat:deg(next)};
}
export function neighborhood(p:MarsPosition,spacing=1000){return [-1,0,1].flatMap(y=>[-1,0,1].map(x=>!x&&!y?p:destination(p,Math.hypot(x,y)*spacing,deg(Math.atan2(x,y)))));}
export function circleCoordinates(p:MarsPosition,radius:number){return Array.from({length:97},(_,i)=>{const q=destination(p,radius,i*360/96);return [q.lon,q.lat];});}
export function inJezeroHiRISE(p:MarsPosition){return p.lon>=77.2229331&&p.lon<=77.583964&&p.lat>=18.3067994&&p.lat<=18.669315;}
export function summarizeHeights(values:unknown[]){const z=values.map(v=>typeof v==='number'&&Number.isFinite(v)&&v!==-999999?v:null),valid=z.filter((v):v is number=>v!==null);return {center:z[4]??null,min:valid.length?Math.min(...valid):null,max:valid.length?Math.max(...valid):null,count:valid.length,relief:valid.length?Math.max(...valid)-Math.min(...valid):null};}
export type TerrainSamples=ReturnType<typeof summarizeHeights>&{status:'loading'|'ready'|'error';resolution:number;position:MarsPosition};
export function trekLink(p:MarsPosition){return `https://trek.nasa.gov/mars/#v=0.1&x=${p.lon}&y=${p.lat}&z=11&p=urn%3Aogc%3Adef%3Acrs%3AEPSG%3A%3A104905`;}
