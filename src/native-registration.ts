import type {Terrain} from './planner';
export type NativeMetadata={width:number;height:number;cellSize:number;bounds:number[];crs:string;dataType:string;byteOrder:string;verticalUnits:string;pixelCentreOffset:number[];validation:{binarySha256:string}};
/** Fail closed before a raster can become the physical camera surface. */
export function assertNativeRegistration(t:Terrain,m:NativeMetadata,bytes:number){
 if(!Number.isInteger(m.width)||!Number.isInteger(m.height)||m.width<2||m.height<2||m.width*m.height*4!==bytes)throw Error('Native DEM dimensions are invalid.');
 if(m.cellSize!==1||m.dataType!=='float32'||m.byteOrder!=='little-endian'||m.verticalUnits!=='metres')throw Error('Native DEM units or encoding do not match this renderer.');
 if(m.crs!==t.crs||!Array.isArray(m.bounds)||m.bounds.length!==4||m.bounds.some((v,i)=>!Number.isFinite(v)||Math.abs(v-t.bounds[i])>1e-8))throw Error('Native DEM Mars registration does not match this region.');
 if(Math.abs(m.width*m.cellSize-t.width*t.cellSize)>1e-8||Math.abs(m.height*m.cellSize-t.height*t.cellSize)>1e-8||Math.abs(m.bounds[2]-m.bounds[0]-m.width*m.cellSize)>1e-8||Math.abs(m.bounds[3]-m.bounds[1]-m.height*m.cellSize)>1e-8)throw Error('Native DEM pixel spacing and physical footprint disagree.');
 if(m.pixelCentreOffset?.[0]!==.5||m.pixelCentreOffset?.[1]!==.5||!/^[a-f0-9]{64}$/.test(m.validation?.binarySha256??''))throw Error('Native DEM provenance is incomplete.');
}
