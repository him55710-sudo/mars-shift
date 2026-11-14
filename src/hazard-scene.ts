import * as THREE from 'three';
import type {XRNavigationFrame} from './hazard-xr';
import type {Point,Terrain} from './planner';
/** Renderer-only geometry. Funnel height is illustrative; only radius has a model estimate. */
export function addHazardScene(group:THREE.Group,t:Terrain,frame:XRNavigationFrame,world:(p:Point,z?:number,offset?:number)=>THREE.Vector3){
 const inside=(p:Point)=>p.x>=0&&p.y>=0&&p.x<t.width&&p.y<t.height;
 const line=(points:THREE.Vector3[],color:string,opacity=1)=>{const g=new THREE.BufferGeometry().setFromPoints(points);group.add(new THREE.LineSegments(g,new THREE.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false})));};
 const forecasts=frame.forecast;
 forecasts.forEach((f,j)=>{
  const center={x:f.x/t.cellSize,y:f.y/t.cellSize};if(!inside(center))return;
  for(const [radius,opacity] of [[f.envelope,.65-j*.055],[f.radius,j===0?.95:.18]]){
   const vertices:THREE.Vector3[]=[];for(let k=1;k<=96;k++){const a=(k-1)/96*Math.PI*2,b=k/96*Math.PI*2,p={x:center.x+Math.cos(a)*radius/t.cellSize,y:center.y+Math.sin(a)*radius/t.cellSize},q={x:center.x+Math.cos(b)*radius/t.cellSize,y:center.y+Math.sin(b)*radius/t.cellSize};if(inside(p)&&inside(q))vertices.push(world(p,undefined,.25),world(q,undefined,.25));}
   line(vertices,j===0?'#ffb45b':'#ffd591',opacity);
  }
  if(j===0){const height=32;for(let layer=0;layer<3;layer++){const geometry=new THREE.CylinderGeometry(f.radius*(.7+layer*.2),f.radius*(.2+layer*.25),height,24,8,true),material=new THREE.MeshBasicMaterial({color:'#d39b72',transparent:true,opacity:.10,side:THREE.DoubleSide,depthWrite:false}),mesh=new THREE.Mesh(geometry,material);mesh.position.copy(world(center,undefined,height/2));group.add(mesh);}}
  if(j>0){const previous=forecasts[j-1],p={x:previous.x/t.cellSize,y:previous.y/t.cellSize};if(inside(p))line([world(p,undefined,1.5),world(center,undefined,1.5)],'#ffe1aa',.7);}
 });
 if(frame.anchorsEnabled){const material=new THREE.MeshBasicMaterial({color:'#82ffe2'});frame.route.slice(1).forEach((p,i)=>{const a={x:frame.route[i].x/t.cellSize,y:frame.route[i].y/t.cellSize},b={x:p.x/t.cellSize,y:p.y/t.cellSize};if(!inside(a)||!inside(b))return;const from=world(a,undefined,.32),to=world(b,undefined,.32),direction=to.clone().sub(from),length=direction.length();if(length<.01)return;const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.11,.11,length,6),material);mesh.position.copy(from).add(to).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());group.add(mesh);});}
}
