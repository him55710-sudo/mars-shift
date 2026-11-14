import {expect,it} from 'vitest';
import * as THREE from 'three';
import {splitSurfaceGeometry} from './surface-chunks';

it('culls spatial patches without changing triangles, UVs or shared-edge normals',()=>{
 const source=new THREE.PlaneGeometry(1000,1000,20,20);source.rotateX(-Math.PI/2);const parts=splitSurfaceGeometry(source);
 const triangles=(g:THREE.BufferGeometry)=>{const p=g.getAttribute('position'),n=g.getAttribute('normal'),uv=g.getAttribute('uv');return Array.from({length:g.index!.count/3},(_,i)=>Array.from({length:3},(_,j)=>{const k=g.index!.getX(i*3+j);return [p.getX(k),p.getY(k),p.getZ(k),n.getX(k),n.getY(k),n.getZ(k),uv.getX(k),uv.getY(k)].join(',');}).join(';'));};
 expect(parts.length).toBeGreaterThan(40);expect(parts.flatMap(triangles).sort()).toEqual(triangles(source).sort());
 expect(parts.every(g=>g.boundingSphere!.radius<150)).toBe(true);
 source.dispose();parts.forEach(g=>g.dispose());
});
