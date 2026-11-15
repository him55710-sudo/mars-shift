import {roverTerrain} from './rover-navigation';
import type {RoverTerrain} from './rover-navigation';
import {planTraining} from './sand-rehearsal';
let base:RoverTerrain|null=null;
self.onmessage=({data})=>{try{base??=roverTerrain(data.grid,[]);postMessage({key:data.key,result:planTraining(base,data.grid,data.crew,data.target,data.obstacles,data.remainingSeconds,data.mode)});}catch(e){postMessage({key:data.key,error:e instanceof Error?e.message:String(e)});}};
