/** Independent-label intake. No synthetic labels are accepted as field validation. */
export type SandLabel={id:string;episode:string;split:'development'|'test';score:number|null;label:0|1;source:string;beforeTraversal:boolean};
export type SandValidation={schema:1;task:'terrain-sand'|'rover-slip'|'astronaut-sinkage';labelProvenance:'independent-observation';threshold:number;rows:SandLabel[]};
export function evaluateSandLabels(input:SandValidation){
 if(input.schema!==1||!['terrain-sand','rover-slip','astronaut-sinkage'].includes(input.task)||input.labelProvenance!=='independent-observation'||!Array.isArray(input.rows)||input.rows.length>100000||!Number.isFinite(input.threshold)||input.threshold<0||input.threshold>1)throw Error('Invalid evaluation schema, provenance or locked threshold');
 const ids=new Set<string>(),splits=new Map<string,string>();
 for(const r of input.rows){if(!r.id||ids.has(r.id)||!r.episode||!r.source||!['development','test'].includes(r.split)||r.beforeTraversal!==true||![0,1].includes(r.label)||r.score!==null&&(!Number.isFinite(r.score)||r.score<0||r.score>1))throw Error('Duplicate ID, missing source, invalid score or post-traversal leakage');ids.add(r.id);if(splits.has(r.episode)&&splits.get(r.episode)!==r.split)throw Error('Episode leakage between development and test');splits.set(r.episode,r.split);}
 const test=input.rows.filter(r=>r.split==='test'),known=test.filter((r):r is SandLabel&{score:number}=>r.score!==null);let tp=0,fp=0,tn=0,fn=0;
 for(const r of known){if(r.score>=input.threshold){if(r.label)tp++;else fp++;}else if(r.label)fn++;else tn++;}
 const ratio=(a:number,b:number)=>b?a/b:null,precision=ratio(tp,tp+fp),recall=ratio(tp,tp+fn);
 // Tied scores are processed together. Average precision is explicitly NOT trapezoidal PR-AUC.
 const ordered=[...known].sort((a,b)=>b.score-a.score),positives=tp+fn;let hits=0,total=0,ap=0;
 for(let i=0;i<ordered.length;){let j=i,positiveGroup=0;while(j<ordered.length&&ordered[j].score===ordered[i].score){positiveGroup+=ordered[j].label;j++;}hits+=positiveGroup;total+=j-i;if(positives)ap+=hits/total*positiveGroup/positives;i=j;}
 return {task:input.task,testSamples:test.length,scoredSamples:known.length,unknown:test.length-known.length,coverage:ratio(known.length,test.length),episodes:new Set(test.map(r=>r.episode)).size,tp,fp,tn,fn,precision,recall,f1:ratio(2*tp,2*tp+fp+fn),falsePositiveRate:ratio(fp,fp+tn),averagePrecision:positives?ap:null,threshold:input.threshold,independence:'Declared by uploader; provenance requires external audit',trappingClaimAllowed:false};
}
