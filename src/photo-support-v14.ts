import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

/** Separate visual backing. It is never added to the picking/walking meshes. */
export async function loadPhotoSupport(signal:AbortSignal){
 const root='/data/drive1004/display-v14/';
 const [metaResponse,meshResponse]=await Promise.all([fetch(root+'manifest.json',{signal}),fetch(root+'photo-support.glb',{signal})]);
 if(!metaResponse.ok||!meshResponse.ok)throw Error('Photo context unavailable');
 const [meta,bytes]=await Promise.all([metaResponse.json(),meshResponse.arrayBuffer()]);
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
 if(meta.kind!=='DISPLAY_ONLY_INTERPOLATED_DEPTH'||meta.sha256!==hash)throw Error('Photo context integrity check failed');
 const gltf=await new GLTFLoader().parseAsync(bytes,'');
 gltf.scene.traverse(o=>{if(o instanceof THREE.Mesh){o.renderOrder=-10;o.raycast=()=>{};for(const m of Array.isArray(o.material)?o.material:[o.material]){m.depthWrite=false;m.toneMapped=false;const texture=(m as THREE.MeshBasicMaterial).map;if(texture){texture.anisotropy=8;texture.needsUpdate=true;}}}});
 return gltf.scene;
}
export function disposePhotoSupport(group:THREE.Group){
 const textures=new Set<THREE.Texture>();group.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){const texture=(m as THREE.MeshBasicMaterial).map;if(texture)textures.add(texture);m.dispose();}}});textures.forEach(t=>t.dispose());group.clear();
}
