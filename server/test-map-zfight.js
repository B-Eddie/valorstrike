// Z-fighting regression on the real render meshes (scene.gltf), at the seams the map pass reported (Ascent, Split,
// Breeze; 6 m around each). tools/map-zfight.mjs finds coplanar overlapping triangles of different materials (within
// 1 cm of one plane, parallel either way, > 0.005 m2 overlap; every converted map material is double-sided). Without
// the fix these areas have open pairs; with the runtime fix (NM_ZFIX in work/native_maps_runtime.js: graded material
// polygonOffset levels, dropped duplicate faces) at most 1% of them is left on one depth level.
import fs from 'node:fs';import assert from 'node:assert/strict';import {scanZFight,overlap,SEAMS} from './tools/map-zfight.mjs';import {loadRender} from './tools/map-render.mjs';
process.chdir(new URL('.',import.meta.url).pathname);
assert.equal(overlap([[0,0],[1,0],[0,1]],[[0,0],[1,0],[0,1]]),.5,'identical triangles overlap fully');assert.equal(overlap([[0,0],[2,0],[0,2]],[[1,1],[3,1],[1,3]]),0,'touching at a point is no overlap');
assert(Math.abs(overlap([[0,0],[2,0],[0,2]],[[0,0],[0,2],[2,0]])-2)<1e-9,'winding does not matter');
const src=fs.readFileSync('../work/native_maps_runtime.js','utf8'),FIX=JSON.parse(src.match(/^var NM_ZFIX=(.*);$/m)[1]);
const maps=process.argv.slice(2).length?process.argv.slice(2):Object.keys(SEAMS);let before=0;
for(const key of maps){const t=Date.now(),R=loadRender(key,{bvh:true}),region=SEAMS[key].map(([x,z])=>[x,z,6]);
 const a=scanZFight(key,{region,R}),b=scanZFight(key,{region,R,fix:FIX[key]});before+=a.open;
 assert(a.open>0,key+': the seam areas had coplanar overlaps before the fix (fixture still meaningful)');
 // 5 offset levels cannot separate every pair of a dense overlap graph; a handful of tiny pairs (Ascent: 3 of 1,350,
 // 0.03 m2 each) may stay on one level. The bar: at most 1% of the seam overlaps and under 0.25 m2 in all.
 assert(b.open<=Math.max(1,a.open*.01)&&b.area<.25,key+': coplanar overlaps left on one depth level at the seams: '+b.open+' ('+b.area+' m2) '+JSON.stringify(b.top.slice(0,3)));
 console.log(key,'seams:',a.open,'open coplanar overlaps before ->',b.open,'after ('+b.area+' m2 left);',((Date.now()-t)/1000).toFixed(1)+'s');}
console.log('Map z-fight: '+maps.length+' maps, '+before+' seam overlaps resolved by the runtime fix');
