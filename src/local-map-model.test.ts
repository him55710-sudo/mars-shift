import {describe,it,expect} from 'vitest';
import {localMapPoint,localMapFrame} from './local-map-model';
import type {Terrain} from './planner';
import type {XRNavigationFrame} from './hazard-xr';
const t={width:160,height:160,cellSize:.25,crs:'LOCAL:NORTH-EAST',bounds:[-8,-4,32,36]} as Terrain;
const f={coordinates:'GRID_NORTH_EAST_METRES',crs:t.crs,bounds:t.bounds,cellSize:.25,timestamp:20,source:'SIMULATION',anchorsEnabled:true,route:[{x:2,y:3,time:20}],forecast:[{x:3,y:4,radius:1,valid:true}]} as XRNavigationFrame;
describe('Shared 2D and 3D local frame',()=>{
 it('places the same metric frame and crew at SVG cell centres',()=>{expect(localMapPoint({x:8,y:12})).toEqual({x:8.5,y:12.5});const map=localMapFrame(t,f)!;expect(map.route[0]).toEqual({x:8.5,y:12.5});expect(map.current).toEqual({x:12.5,y:16.5,radius:4});expect(map.time).toBe(20);expect(map.source).toBe('SIMULATION');});
 it('withholds unregistered, mis-scaled or wrong-axis frames',()=>{for(const bad of [{...f,crs:'ORBITAL'},{...f,cellSize:5},{...f,coordinates:'GRID_EAST_SOUTH_METRES' as const},{...f,bounds:[0,0,40,40]}])expect(localMapFrame(t,bad)).toBeNull();});
 it('does not show movement anchors when the planner withholds the route',()=>{expect(localMapFrame(t,{...f,anchorsEnabled:false})?.route).toEqual([]);expect(localMapFrame(t,{...f,forecast:[{...f.forecast[0],valid:false}]})?.current).toBeNull();});
});
