import * as THREE from 'three';

/** Partition existing triangles; preserve shared positions, UVs and normals exactly.
 * Tight bounds let Three.js reject off-screen patches before issuing draw calls.
 */
export function splitSurfaceGeometry(source:THREE.BufferGeometry,size=128){
 const position=source.getAttribute('position'),uv=source.getAttribute('uv'),normal=source.getAttribute('normal'),index=source.index;
 if(!index||!position||!uv||!normal)throw Error('Indexed surface with UVs and normals required');
 const bins=new Map<string,number[]>();
 for(let i=0;i<index.count;i+=3){
  const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2),x=(position.getX(a)+position.getX(b)+position.getX(c))/3,z=(position.getZ(a)+position.getZ(b)+position.getZ(c))/3;
  const key=`${Math.floor(x/size)}:${Math.floor(z/size)}`,bin=bins.get(key)??[];bin.push(a,b,c);bins.set(key,bin);
 }
 return [...bins.values()].map(indices=>{
  const mapping=new Map<number,number>(),p:number[]=[],n:number[]=[],u:number[]=[],local:number[]=[];
  for(const i of indices){let mapped=mapping.get(i);if(mapped===undefined){mapped=mapping.size;mapping.set(i,mapped);p.push(position.getX(i),position.getY(i),position.getZ(i));n.push(normal.getX(i),normal.getY(i),normal.getZ(i));u.push(uv.getX(i),uv.getY(i));}local.push(mapped);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(u,2));geometry.setIndex(local);geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
 });
}

export function refreshSurfaceChunks(group:THREE.Group,source:THREE.BufferGeometry,material:THREE.Material){
 for(const child of group.children)if(child instanceof THREE.Mesh)child.geometry.dispose();group.clear();
 for(const geometry of splitSurfaceGeometry(source)){const mesh=new THREE.Mesh(geometry,material);mesh.receiveShadow=true;group.add(mesh);}
}
