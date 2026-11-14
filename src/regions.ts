export const REGIONS=[
 {id:'floor',name:'Central floor',label:'CENTRAL FLOOR',terrain:'Gentler terrain',relief:'23 m relief',root:'/data',coords:'18.4500° N · 77.6400° E'},
 {id:'ridge',name:'Eastern ridge',label:'EASTERN RIDGE',terrain:'More rugged terrain',relief:'109 m relief',root:'/data/ridge',coords:'18.5044° N · 77.7315° E'},
 {id:'noah',name:'NOAH-H overlap',label:'NOAH-H OVERLAP',terrain:'Published texture classification',relief:'27 m relief',root:'/data/noah',coords:'18.4600° N · 77.5650° E'},
] as const;
export type RegionId=typeof REGIONS[number]['id'];
export const regionInfo=(id:string)=>REGIONS.find(r=>r.id===id)??REGIONS[1];
