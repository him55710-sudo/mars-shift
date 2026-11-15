import type {Point,Route} from './planner';
import type {RoverGrid,RoverObstacle} from './rover-navigation';
import {worldPoint} from './rover-navigation';

type PhotoAssets={assets:{url:string}[];calibratedAssets?:{url:string}[];detailAssets?:{url:string}[]};
/** Keep the original calibrated photo meshes, dimensions and transforms intact. */
export function roverVisualManifest<T extends PhotoAssets>(manifest:T,native=true):T{
 const assets=native?(manifest.calibratedAssets?.length?manifest.calibratedAssets:manifest.detailAssets?.length?manifest.detailAssets:manifest.assets):manifest.assets;
 return assets===manifest.assets?manifest:{...manifest,assets};
}
export function roverSandGuidance(g:RoverGrid,route:Route|null,crew:Point,heading:number,obstacles:RoverObstacle[]){
 const sand=obstacles.filter(o=>o.material==='sand'),w=worldPoint(g,crew);
 let nearest:null|{metres:number;side:string;kind:RoverObstacle['kind']}=null;
 for(const o of sand){const metres=Math.max(0,Math.hypot(w.x-o.x,w.z-o.z)-o.radius-.35);if(nearest&&nearest.metres<=metres)continue;
  const bearing=(Math.atan2(o.z-w.z,o.x-w.x)*180/Math.PI+360)%360,angle=((bearing-heading+540)%360+360)%360-180;
  nearest={metres,side:metres===0?'inside buffer':Math.abs(angle)<35?'ahead':Math.abs(angle)>145?'behind':angle<0?'left':'right',kind:o.kind};
 }
 const crossings=route?new Set(route.cells.filter(i=>{const p=worldPoint(g,{x:i%g.width,y:Math.floor(i/g.width)});return sand.some(o=>Math.hypot(p.x-o.x,p.z-o.z)<=o.radius+.35);})).size:null;
 return {nearest,crossings,reviewed:sand.filter(o=>o.kind==='reviewed').length,simulated:sand.filter(o=>o.kind==='simulated').length,hasLocalLabels:sand.length>0};
}
