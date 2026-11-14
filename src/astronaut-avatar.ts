import * as THREE from 'three';

export type AstronautAvatar={group:THREE.Group;update:(walkPhase:number,moving:boolean)=>void};

/** Illustrative crew figure. Local -Z is forward; neutral soles sit at y=0 metres. */
export function createAstronautAvatar():AstronautAvatar {
 const group=new THREE.Group();group.name='Simulated EVA crew avatar';
 group.userData={classification:'illustrative simulation',units:'metres',forward:'local -Z',ground:'neutral soles at local y=0'};
 const suit=new THREE.MeshStandardMaterial({color:'#e8e5d9',roughness:.72,metalness:.05});
 const trim=new THREE.MeshStandardMaterial({color:'#2d3740',roughness:.7,metalness:.15});
 const sole=new THREE.MeshStandardMaterial({color:'#182129',roughness:.95});
 const accent=new THREE.MeshStandardMaterial({color:'#e77732',roughness:.48,metalness:.15});
 const panel=new THREE.MeshStandardMaterial({color:'#697d85',roughness:.55,metalness:.32});
 const visor=new THREE.MeshStandardMaterial({color:'#6f4d20',roughness:.19,metalness:.8});
 const seal=new THREE.MeshStandardMaterial({color:'#bba574',roughness:.34,metalness:.6});
 const capsule=(radius:number,length:number)=>new THREE.CapsuleGeometry(radius,length,4,12);
 const sphere=(radius:number)=>new THREE.SphereGeometry(radius,20,12);
 const torus=(radius:number,tube:number)=>new THREE.TorusGeometry(radius,tube,6,20);
 const mesh=(parent:THREE.Group,geometry:THREE.BufferGeometry,material:THREE.Material,position:[number,number,number],scale?:[number,number,number])=>{
  const part=new THREE.Mesh(geometry,material);part.position.set(...position);if(scale)part.scale.set(...scale);part.castShadow=true;part.receiveShadow=true;parent.add(part);return part;
 };

 // Rounded pressure suit and life-support pack, with a clear readable back silhouette.
 mesh(group,capsule(.17,.25),suit,[0,1.025,0],[1.23,1,.78]);
 mesh(group,capsule(.15,.10),suit,[0,.80,0],[1.38,.68,.86]);
 const waist=mesh(group,torus(.175,.026),trim,[0,.84,0],[1.23,.76,1]);waist.rotation.x=Math.PI/2;
 const collar=mesh(group,torus(.128,.032),trim,[0,1.325,0]);collar.rotation.x=Math.PI/2;
 mesh(group,capsule(.175,.22),suit,[0,1.055,.19],[1.07,1.08,.76]);
 mesh(group,capsule(.145,.11),panel,[0,1.075,.326],[1.08,1.3,.16]);
 mesh(group,new THREE.BoxGeometry(.29,.036,.027),accent,[0,1.17,.35]);
 mesh(group,new THREE.BoxGeometry(.18,.12,.032),panel,[0,1.115,-.142]);
 mesh(group,new THREE.BoxGeometry(.14,.018,.008),accent,[0,1.145,-.162]);

 // Helmet and the gold front visor are geometric UI assets, not observational imagery.
 mesh(group,sphere(.215),suit,[0,1.522,0],[1,1.075,.98]);
 mesh(group,new THREE.SphereGeometry(.222,24,12,Math.PI*1.04,Math.PI*.92,Math.PI*.28,Math.PI*.45),visor,[0,1.522,-.003],[1,1.075,.98]);
 const rim=mesh(group,torus(.174,.012),seal,[0,1.547,-.145],[1,.76,1]);rim.rotation.y=Math.PI;
 mesh(group,new THREE.BoxGeometry(.052,.022,.018),accent,[0,1.714,-.081]);

 const arms:THREE.Group[]=[],forearms:THREE.Group[]=[],legs:THREE.Group[]=[],knees:THREE.Group[]=[];
 for(const side of [-1,1]){
  const arm=new THREE.Group();arm.position.set(side*.278,1.205,0);arm.rotation.z=side*.09;group.add(arm);arms.push(arm);
  mesh(arm,capsule(.077,.14),suit,[0,-.12,0]);
  const elbow=new THREE.Group();elbow.position.set(0,-.26,0);arm.add(elbow);forearms.push(elbow);
  const elbowSeal=mesh(elbow,torus(.064,.018),trim,[0,0,0]);elbowSeal.rotation.x=Math.PI/2;
  mesh(elbow,capsule(.067,.125),suit,[0,-.115,-.012]);
  mesh(elbow,sphere(.079),trim,[0,-.265,-.025],[1,1.13,1.04]);
  const patch=mesh(arm,new THREE.BoxGeometry(.025,.078,.075),accent,[side*.071,-.11,-.005]);patch.rotation.z=-side*.06;

  const leg=new THREE.Group();leg.position.set(side*.11,.78,0);group.add(leg);legs.push(leg);
  mesh(leg,capsule(.088,.20),suit,[0,-.15,0],[1.02,1,1.02]);
  const knee=new THREE.Group();knee.position.set(0,-.34,0);leg.add(knee);knees.push(knee);
  const kneeSeal=mesh(knee,torus(.075,.019),trim,[0,0,0]);kneeSeal.rotation.x=Math.PI/2;
  mesh(knee,capsule(.077,.16),suit,[0,-.13,0]);
  mesh(knee,sphere(.1),trim,[0,-.365,-.06],[.95,.75,1.65]);
  mesh(knee,new THREE.BoxGeometry(.20,.03,.30),sole,[0,-.425,-.06]);
 }

 const update=(walkPhase:number,moving:boolean)=>{
  const phase=Number.isFinite(walkPhase)?walkPhase:0,stride=moving?Math.sin(phase):0;
  arms.forEach((arm,i)=>{const sign=i===0?1:-1;arm.rotation.x=-sign*stride*.23;arm.rotation.z=(i===0?-1:1)*.09;});
  forearms.forEach((arm,i)=>{arm.rotation.x=-.09-Math.max(0,(i===0?-1:1)*stride)*.10;});
  legs.forEach((leg,i)=>{leg.rotation.x=(i===0?1:-1)*stride*.26;});
  knees.forEach((knee,i)=>{knee.rotation.x=moving?Math.max(0,(i===0?-1:1)*stride)*.30:0;});
 };
 update(0,false);
 return {group,update};
}
