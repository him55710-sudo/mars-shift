import {it,expect} from 'vitest';
import * as THREE from 'three';
import {addHazardScene} from './hazard-scene';
import type {XRNavigationFrame} from './hazard-xr';
import type {Terrain} from './planner';
it('shows an approaching boundary before its centre enters observed map coverage',()=>{
 const group=new THREE.Group(),t={width:20,height:20,cellSize:1} as Terrain;
 const frame={forecast:[{time:0,x:-2,y:10,radius:4,envelope:5}],anchorsEnabled:false} as XRNavigationFrame;
 addHazardScene(group,t,frame,p=>new THREE.Vector3(p.x,0,p.y));
 const lines=group.children.filter(o=>o instanceof THREE.LineSegments) as THREE.LineSegments[];
 expect(lines.some(l=>l.geometry.getAttribute('position').count>0)).toBe(true);
 expect(group.children.some(o=>o instanceof THREE.Mesh)).toBe(false);
});
