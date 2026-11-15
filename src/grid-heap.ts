/** Parallel-array heap adapted from Gale Marswalk Planner's MIT-licensed Heap.
 * Copyright (c) 2026 AstroNox team. See public/licenses/gale-planner-MIT.txt.
 * Adaptation: typed API, configurable growth, stable empty-pop contract and keys.
 */
export class GridHeap {
 private keys:Float64Array;
 private ids:Int32Array;
 private count=0;
 constructor(capacity=1024){const n=Math.max(1,Math.trunc(capacity)||1);this.keys=new Float64Array(n);this.ids=new Int32Array(n);}
 get length(){return this.count;}
 push(i:number,cost:number){
  if(this.count===this.keys.length){const keys=new Float64Array(this.count*2),ids=new Int32Array(this.count*2);keys.set(this.keys);ids.set(this.ids);this.keys=keys;this.ids=ids;}
  let n=this.count++;
  while(n){const parent=(n-1)>>1;if(this.keys[parent]<=cost)break;this.keys[n]=this.keys[parent];this.ids[n]=this.ids[parent];n=parent;}
  this.keys[n]=cost;this.ids[n]=i;
 }
 pop(){
  if(!this.count)throw Error('Cannot pop an empty route heap.');
  const first={i:this.ids[0],cost:this.keys[0]},n=--this.count,key=this.keys[n],id=this.ids[n];let j=0;
  while(j*2+1<n){let child=j*2+1;if(child+1<n&&this.keys[child+1]<this.keys[child])child++;if(this.keys[child]>=key)break;this.keys[j]=this.keys[child];this.ids[j]=this.ids[child];j=child;}
  if(n){this.keys[j]=key;this.ids[j]=id;}return first;
 }
}
