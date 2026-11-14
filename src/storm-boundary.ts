/** Necessary geographic checks, not proof of registration between MDAD versions. */
export function boundaryPlausibility(points:number[][], center:{lon:number;lat:number}) {
 if(points.length<3)return {valid:false,reason:'Insufficient boundary coordinates'};
 if(points.some(p=>p.length!==2||!p.every(Number.isFinite)||p[0]<-180||p[0]>180||p[1]<-90||p[1]>90))return {valid:false,reason:'Coordinates outside geographic bounds'};
 const x=points.map(p=>((p[0]-center.lon+540)%360)-180),y=points.map(p=>p[1]);
 if(Math.min(...x)>0||Math.max(...x)<0||Math.min(...y)>center.lat||Math.max(...y)<center.lat)return {valid:false,reason:'Boundary does not enclose the catalog center bounds'};
 return {valid:true,reason:'Basic checks passed; cross-version registration still unverified'};
}
