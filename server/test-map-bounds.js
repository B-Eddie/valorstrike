// Map holes and boundary containment, all six original maps, on the server collision world (the same BVH, motor and
// leash the offline client walks with; tools/map-holes.mjs and tools/map-boundary.mjs are the full sweeps).
//  1. Hole grid: every playable nav node sampled at 0.25 m; no sample where the leash lets a capsule centre stand
//     without floor under its footprint (void, crack or missing collision floor such as Lotus' moss floors).
//  2. Known escapes: map-escapes.json holds escapes the full sweep found before the leash (walking/dashing off spawn
//     backs and site edges into the void, satchel/updraft over walls out of the map); each is replayed and must stay
//     on the map. The same cases are replayed without the leash and must still escape, so the fixture keeps meaning
//     something (fails on the old motor).
//  3. Sampled sweep: every 40th border cell, all movement probes (walk, crouch-jump, Jett dash, updraft, updraft+dash,
//     Raze satchel at a jump's apex): no fall out of the world and no landing outside the playable footprint.
import fs from 'node:fs';import assert from 'node:assert/strict';import {loadWorld} from './src/world.js';import {scanHoles} from './tools/map-holes.mjs';import {scanBoundary,PROBES,index} from './tools/map-boundary.mjs';import {createRequire} from 'node:module';
process.chdir(new URL('.',import.meta.url).pathname);
const require=createRequire(import.meta.url),Motor=require('./src/motor.cjs');
const assets={fetch:async r=>new Response(await fs.promises.readFile('public'+new URL(r.url).pathname))};
const cases=JSON.parse(fs.readFileSync('map-escapes.json','utf8')),maps=process.argv.slice(2).length?process.argv.slice(2):['ascent','bind','haven','split','lotus','breeze'];
function replay(w,X,c,leash){const saved=w.leash;if(!leash)delete w.leash;try{const pr=PROBES[c.probe],y0=w.ground(c.from[0],c.from[2],c.from[1]+.1),P={x:c.from[0],z:c.from[2],y:y0,vx:0,vz:0,vy:0,ch:0},DT=1/30;let still=0;
 for(let t=0;t<pr.T;t+=DT){const inp={x:c.dir[0],z:c.dir[1],speed:6.75,jump:false,duck:false};pr.plan(t,P,inp,c.dir,w);Motor.step(P,inp,DT,w);if(P.y<X.ymin-3.5)break;const g=!P.air&&Math.abs(P.vy||0)<.01;if(g&&t>.4&&Math.hypot(P.vx,P.vz)<.05){if((still+=DT)>.25)break;}else still=0;}
 const low=X.nearest(P.x,P.z,null,1.3);if((P.y<X.ymin-3||P.y<y0-12)&&!(low&&Math.abs(low[1]-P.y)<1.5))return 'fall';if(!P.air&&!X.nearValid(P.x,P.z,3))return 'out';return null;}finally{if(saved)w.leash=saved;}}
let total=0;
for(const key of maps){const t=Date.now(),w=await loadWorld(assets,key),X=index(w);
 const h=await scanHoles(key,w),fall=h.void.concat(h.gap).filter(p=>!p.held&&p.leash);assert.equal(fall.length,0,key+': capsule can stand over a hole at '+JSON.stringify(fall.slice(0,3)));
 const list=cases[key]||[];let escapedOld=0;for(const c of list){const r=replay(w,X,c,true);assert.equal(r,null,key+': '+c.probe+' from '+c.from+' toward '+c.dir+' still escapes ('+r+')');if(replay(w,X,c,false))escapedOld++;}
 assert(list.length===0||escapedOld>0,key+': fixture no longer escapes without the leash');
 const s=await scanBoundary(key,w,{stride:40});assert.equal(s.fall.length,0,key+': fell off the map '+JSON.stringify(s.fall.slice(0,2)));assert.equal(s.out.length,0,key+': left the playable footprint '+JSON.stringify(s.out.slice(0,2)));
 total+=s.probes+list.length;console.log(key,'holes 0 /',h.samples,'samples; known escapes contained',list.length,'(old motor escapes',escapedOld+'); sweep',s.probes,'probes contained,',s.perch.length,'perches;',((Date.now()-t)/1000).toFixed(1)+'s');}
console.log('Map bounds: '+maps.length+' maps, hole grid clean, '+total+' boundary probes contained');
