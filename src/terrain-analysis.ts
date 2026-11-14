import type {Point, Terrain} from './planner';

export type LayerId = 'optical' | 'elevation' | 'slope' | 'roughness' | 'thermal';
export type NumericLayer = Exclude<LayerId, 'optical'>;
export const LAYERS: {id: LayerId; name: string; en: string; unit: string; resolution: string; colors: string[]}[] = [
  {id:'optical', name:'Optical imagery', en:'HiRISE optical', unit:'', resolution:'Native 0.3 m · display 1 m', colors:['#b4a28b','#e5d7bd']},
  {id:'elevation', name:'Elevation', en:'Elevation', unit:'m', resolution:'Native 1 m · analysis 5 m', colors:['#294656','#538b8d','#b9c99c','#d1a56b','#f3dbb5']},
  {id:'slope', name:'Slope', en:'Maximum slope', unit:'°', resolution:'Maximum native 1 m slope per 5 m cell', colors:['#31534c','#78a78d','#e0c477','#df9063','#c95b56']},
  {id:'roughness', name:'Local relief', en:'Local relief', unit:'m', resolution:'Cell mean of 11 × 11 m elevation range', colors:['#263f51','#5d849a','#9cafb6','#d9b685','#ebd7ac']},
  {id:'thermal', name:'Thermal inertia', en:'Thermal inertia', unit:'J m⁻² K⁻¹ s⁻½', resolution:'Native 100 m · nearest-neighbour reprojection', colors:['#445875','#7987aa','#b6a0b7','#d5ac99','#e9cd9e']},
];
export const isValue = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);
export const clamp = (v:number, lo:number, hi:number) => Math.min(hi, Math.max(lo, v));
export function validCell(t:Terrain, i:number) { return !!t.valid[i] && isValue(t.elevation[i]); }
export function cellAt(t:Terrain, p:Point) { return clamp(Math.round(p.y),0,t.height-1)*t.width+clamp(Math.round(p.x),0,t.width-1); }
export function localCoordinates(t:Terrain,p:Point) { return {east:(p.x+.5)*t.cellSize,north:(t.height-p.y-.5)*t.cellSize}; }
export function statistics(t:Terrain, key:NumericLayer) {
  const values=t[key].filter((v,i):v is number=>validCell(t,i)&&isValue(v)).sort((a,b)=>a-b);
  if(!values.length) return {count:0,min:null,max:null,mean:null,median:null,p95:null};
  const quantile=(q:number)=>{const n=(values.length-1)*q, a=Math.floor(n);return values[a]+(values[Math.ceil(n)]-values[a])*(n-a);};
  return {count:values.length,min:values[0],max:values[values.length-1],mean:values.reduce((a,b)=>a+b,0)/values.length,median:quantile(.5),p95:quantile(.95)};
}
export function histogram(t:Terrain, key:NumericLayer, bins=20) {
  const s=statistics(t,key), counts=Array<number>(bins).fill(0);
  if(s.min===null||s.max===null)return {counts,min:0,max:0,total:0};
  t[key].forEach((v,i)=>{if(validCell(t,i)&&isValue(v))counts[clamp(Math.floor((v-s.min!)/(s.max!-s.min!||1)*bins),0,bins-1)]++;});
  return {counts,min:s.min,max:s.max,total:s.count};
}
export function slopeClasses(t:Terrain) {
  const groups=[{name:'Gentle',range:'0–5°',min:0,max:5,color:'#78a78d',count:0},{name:'Moderate',range:'5–15°',min:5,max:15,color:'#e0c477',count:0},{name:'Steep',range:'15–25°',min:15,max:25,color:'#df9063',count:0},{name:'Very steep',range:'25° or more',min:25,max:Infinity,color:'#c95b56',count:0}];
  let total=0;
  t.slope.forEach((v,i)=>{if(validCell(t,i)&&isValue(v)){groups.find(g=>v>=g.min&&v<g.max)!.count++;total++;}});
  return groups.map(g=>({...g,percent:total?g.count/total*100:0,area:g.count*t.cellSize*t.cellSize}));
}
export type ProfileSample = {x:number;y:number;index:number;distance:number;elevation:number|null;slope:number|null};
export function sampleProfile(t:Terrain,a:Point,b:Point) {
  const distance=Math.hypot(b.x-a.x,b.y-a.y)*t.cellSize;
  const steps=Math.max(1,Math.ceil(distance/t.cellSize));
  const samples:ProfileSample[]=Array.from({length:distance?steps+1:1},(_,n)=>{const q=distance?n/steps:0,x=a.x+(b.x-a.x)*q,y=a.y+(b.y-a.y)*q,i=cellAt(t,{x,y});return {x,y,index:i,distance:distance*q,elevation:validCell(t,i)?t.elevation[i]:null,slope:validCell(t,i)?t.slope[i]:null};});
  let ascent=0,descent=0,surfaceDistance=0,complete=true;
  samples.forEach((p,n)=>{if(!isValue(p.elevation))complete=false;if(!n)return;const prev=samples[n-1];if(!isValue(p.elevation)||!isValue(prev.elevation))return;const dz=p.elevation-prev.elevation;ascent+=Math.max(0,dz);descent+=Math.max(0,-dz);surfaceDistance+=Math.hypot(p.distance-prev.distance,dz);});
  return {samples,distance,ascent,descent,surfaceDistance:complete?surfaceDistance:null,complete};
}

// Marching squares in grid-centre coordinates. Never interpolate through NoData.
export function contours(t:Terrain, interval:number) {
  if(!Number.isFinite(interval)||interval<=0)return [];
  const s=statistics(t,'elevation');
  if(s.min===null||s.max===null)return [];
  const lines:{level:number;a:Point;b:Point}[]=[];
  for(let level=Math.ceil(s.min/interval)*interval;level<=s.max;level+=interval){
    for(let y=0;y<t.height-1;y++)for(let x=0;x<t.width-1;x++){
      const ids=[y*t.width+x,y*t.width+x+1,(y+1)*t.width+x+1,(y+1)*t.width+x];
      if(ids.some(i=>!validCell(t,i)))continue;
      const corners=[{x,y},{x:x+1,y},{x:x+1,y:y+1},{x,y:y+1}],points:Point[]=[];
      for(let e=0;e<4;e++){const f=(e+1)%4,va=t.elevation[ids[e]]!,vb=t.elevation[ids[f]]!;if((va<level)===(vb<level))continue;const q=(level-va)/(vb-va);points.push({x:corners[e].x+(corners[f].x-corners[e].x)*q,y:corners[e].y+(corners[f].y-corners[e].y)*q});}
      for(let n=0;n+1<points.length;n+=2)lines.push({level,a:points[n],b:points[n+1]});
    }
  }
  return lines;
}
export function layerColor(id:LayerId,value:number,min:number,max:number):[number,number,number] {
  const colors=LAYERS.find(l=>l.id===id)!.colors.map(c=>[parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)]);
  const q=clamp((value-min)/(max-min||1),0,1)*(colors.length-1),i=Math.min(colors.length-2,Math.floor(q)),f=q-i;
  return colors[i].map((v,n)=>Math.round(v+(colors[i+1][n]-v)*f)) as [number,number,number];
}
export function gridCSV(t:Terrain) {
  const rows=['column,row,easting_m,northing_m,elevation_m,max_slope_deg,mean_slope_deg,local_relief_m,thermal_inertia_J_m-2_K-1_s-0.5,dem_valid'];
  for(let i=0;i<t.width*t.height;i++){const x=i%t.width,y=Math.floor(i/t.width);rows.push([x,y,t.bounds[0]+(x+.5)*t.cellSize,t.bounds[3]-(y+.5)*t.cellSize,...([t.elevation[i],t.slope[i],t.meanSlope[i],t.roughness[i],t.thermal[i]].map(v=>validCell(t,i)&&isValue(v)?v:'')),validCell(t,i)?1:0].join(','));}
  return rows.join('\r\n');
}
