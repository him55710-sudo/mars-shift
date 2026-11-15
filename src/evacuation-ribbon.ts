import * as THREE from 'three';
import {routeRibbonMaterial} from './ground-overlay';
import {heightAt} from './eva-motion';
import {worldPoint,gridPoint} from './rover-navigation';
import type {RoverGrid} from './rover-navigation';
import type {Terrain} from './planner';
import type {XRNavigationFrame} from './hazard-xr';
/** Draw the exact timed path at its original fractional grid coordinates.
 * Geometry is visual only; no route smoothing or motion shortcuts. */
export function evacuationRibbon(group:THREE.Group,t:Terrain,g:RoverGrid,frame:XRNavigationFrame){
 const path=frame.route.filter((p,i,a)=>!i||Math.hypot(p.x-a[i-1].x,p.y-a[i-1].y)>1e-8);
 if(path.length<2)return;
 const pos:number[]=[],uv:number[]=[],indices:number[]=[];let length=0;
 for(let j=0;j<path.length;j++){
  const p=path[j],a=path[Math.max(0,j-1)],b=path[Math.min(path.length-1,j+1)];
  const w=worldPoint(g,{x:p.x/g.cellSize,y:p.y/g.cellSize}),from=worldPoint(g,{x:a.x/g.cellSize,y:a.y/g.cellSize}),to=worldPoint(g,{x:b.x/g.cellSize,y:b.y/g.cellSize});
  const dx=to.x-from.x,dz=to.z-from.z,n=Math.hypot(dx,dz)||1;if(j)length+=Math.hypot(w.x-from.x,w.z-from.z);
  for(const side of [-1,1]){const x=w.x-dz/n*.075*side,z=w.z+dx/n*.075*side,h=heightAt(t,gridPoint(g,x,z))??heightAt(t,{x:p.x/g.cellSize,y:p.y/g.cellSize})??0;pos.push(x,h+.065,z);uv.push((side+1)/2,length*.85);}
  if(j){const k=2*j;indices.push(k-2,k-1,k,k-1,k+1,k);}
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);
 group.add(new THREE.Mesh(geometry,routeRibbonMaterial('#b3dfd3',false)));
}
