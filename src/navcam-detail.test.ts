import {describe,it,expect} from 'vitest';
import {observedHeight,moveInspection,validateNavcamGrid,validateNavcamManifest,prioritizedTiles} from './navcam-detail';
import type {NavcamGrid,NavcamTile} from './navcam-detail';
import manifest from '../public/data/drive1004/manifest.json';
import realGrid from '../public/data/drive1004/navigation-grid.json';
const fixture=():NavcamGrid=>({width:4,height:4,cellSize:1,origin:[0,0],elevation:Array.from({length:16},(_,i)=>i%4*.1+Math.floor(i/4)*.2),slope:Array(16).fill(13),start:{x:1.5,z:1.5},target:{x:2.5,z:2.5}});
describe('recorded ground camera support',()=>{
 it('interpolates an analytic metric plane without changing its scale',()=>{const g=fixture();expect(observedHeight(g,{x:1.75,z:2.25})).toBeCloseTo(.1*1.25+.2*1.75);expect(moveInspection(g,g.start,.4,.2).moved).toBeCloseTo(Math.hypot(.4,.2));});
 it('does not infill holes or borrow a zero-weight missing neighbour',()=>{const g=fixture();g.elevation[6]=null;expect(observedHeight(g,{x:1.5,z:1.5})).toBeCloseTo(.3);expect(observedHeight(g,{x:2,z:1.5})).toBeNull();expect(moveInspection(g,g.start,1,0).moved).toBeLessThan(.1);});
 it('holds at unknown support, steep samples, height steps and invalid input',()=>{const g=fixture();expect(observedHeight(g,{x:-1,z:1})).toBeNull();g.slope[6]=45;expect(moveInspection(g,g.start,1,0).reason).toMatch(/observed/);g.slope[6]=0;g.elevation[6]=3;expect(moveInspection(g,g.start,1,0).reason).toMatch(/Steep/);expect(moveInspection(g,g.start,NaN,0).moved).toBe(0);});
 it('starts on actual observed source support and makes a bounded inspection step',()=>{const g=validateNavcamGrid(realGrid);expect(observedHeight(g,g.start)).not.toBeNull();const r=moveInspection(g,g.start,-.1,.1);expect(observedHeight(g,r.position)).not.toBeNull();expect(r.moved).toBeLessThanOrEqual(Math.SQRT2*.1+1e-9);});
});
describe('published NASA tile contract',()=>{
 it('preserves an explicitly separate local frame and finest leaf sources',()=>{const m=validateNavcamManifest(manifest);expect(m.sourceCommit).toBe('76444abbb4faff1b05f46a09b81ca2c24602b333');expect(m.detailAssets.reduce((n,a)=>n+a.triangles,0)).toBe(1045833);expect(m.detailAssets.every(a=>a.url.startsWith('/data/drive1004/'))).toBe(true);});
 it('uses real PDS reprojection tiles and the published source camera',()=>{const m=validateNavcamManifest(manifest),g=validateNavcamGrid(realGrid);expect(m.calibratedAssets?.filter(a=>a.url.includes('/calibrated-')).length).toBe(61);expect(m.calibratedAssets?.reduce((n,a)=>n+a.triangles,0)).toBe(1045833);expect(m.inspectionCamera?.position[1]).toBeCloseTo(1.9690017544,8);expect(Math.hypot(...m.inspectionCamera!.direction)).toBeCloseTo(1,10);expect(observedHeight(g,g.start)).not.toBeNull();});
 it('rejects external paths, malformed transformations and invalid ground dimensions',()=>{const m=structuredClone(manifest);m.detailAssets[0].url='https://example.com/data.glb';expect(()=>validateNavcamManifest(m)).toThrow();const n=structuredClone(manifest);n.detailAssets[0].transform=[1,2];expect(()=>validateNavcamManifest(n)).toThrow();expect(()=>validateNavcamGrid({...fixture(),elevation:[0]})).toThrow();});
 it('loads near original leaves before distant context without mutating the manifest',()=>{const tiles=manifest.detailAssets as NavcamTile[],before=tiles.map(v=>v.url);const p=prioritizedTiles(tiles,manifest.start);expect(p[0].contextOnly).not.toBe(true);expect(new Set(p.map(v=>v.url)).size).toBe(tiles.length);expect(tiles.map(v=>v.url)).toEqual(before);});
});
