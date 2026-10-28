// Foliage / thin-decor collision (user: "parts on the map like a plant ... blocking me", "a lilypad ... that blocks").
// In VALORANT players walk (and shoot) through grass, leaves, vines, small plants, lilypads, wires and hanging decor
// (patch 9.07 fixed Lotus A "hanging foliage" stopping damage); planters, pots and tree trunks block. collision.bin kept
// every source object whose NAME missed the exporter's foliage regex, so plant beds (Plant_*), potted-plant leaves,
// lilypads, wires and puddles blocked the capsule. work/build_foliage_exclude.py writes collision-exclude.bin per map
// (runs of collision.bin triangles); server/build-world.cjs and the page fallback (nmRawCollision) drop them.
// Checks, on the prebuilt server worlds (public/worlds = what the client fetches and the server walks):
//  1. collision-exclude.bin is well-formed on all six maps (sorted, disjoint runs inside collision.bin).
//  2. should-NOT-block: a capsule at the height the nav bake stood on the plant / lilypad is free, and real floor lies
//     under it within 2 m (several bake heights were leaf tops: Breeze banana bed 1.7 m above the beach slope, Haven
//     potted-plant leaves 0.5-1 m above the floor), never the void.
//  3. walking through: the shared motor walks a player straight through a Lotus lilypad patch and a Breeze/Bind/Haven
//     plant bed without stopping, jumping or being lifted onto the plant.
//  4. should-block: pots, planters and palm trunks next to the excluded leaves still block the capsule.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {loadWorld} from './src/world.js';
const here=path.dirname(new URL(import.meta.url).pathname),require=createRequire(import.meta.url),Motor=require('./src/motor.cjs');
const MAPS=['ascent','bind','haven','split','lotus','breeze'],WROOT=process.env.VS_WORLDS_ROOT||path.join(here,'public'),assets={fetch:async r=>new Response(await fs.promises.readFile(path.join(WROOT,new URL(r.url).pathname)))};// VS_WORLDS_ROOT: a dir holding worlds/<map>/ (e.g. worlds built without the exclusion, to see this test fail)
// 1. exclusion files
for(const k of MAPS){const dir=path.join(here,'../models/valorant/maps',k),c=fs.readFileSync(path.join(dir,'collision.bin')),tris=c.readUInt32LE(4)/3,f=path.join(dir,'collision-exclude.bin');
 assert.ok(fs.existsSync(f),k+': collision-exclude.bin exists');const e=fs.readFileSync(f),n=e.readUInt32LE(0);assert.equal(e.length,4+n*8,k+': run table size');assert.ok(n>0,k+': has excluded foliage');
 let end=0,sum=0;for(let r=0;r<n;r++){const s=e.readUInt32LE(4+r*8),l=e.readUInt32LE(8+r*8);assert.ok(l>0&&s>=end&&s+l<=tris,k+': run '+r+' sorted, disjoint, in range');end=s+l;sum+=l;}
 assert.ok(sum<tris*.6,k+': excludes '+sum+' of '+tris+' triangles (foliage only, never most of the map; Lotus is ~50%: its beach-cabbage beds alone are ~28% of collision.bin)');}
// [map, x, floorY, z, what]: plant / decor centres beside playable navigation that blocked a standing capsule before
const FREE=[['lotus',-43.35,4.34,-1.32,'C Main lilypad'],['lotus',40.85,7.61,-43.1,'A fern'],['lotus',-43.0,4.93,3.6,'C ramp jasmine / beach cabbage (0.5 m east of the old -43.5,3.5 fixture, which sits under the C Main rock overhang at 6.2 m that has collision since map-render-walls)'],
 ['breeze',-9.54,4.2,49.97,'beach cabbage'],['breeze',7.8,8.06,-31.78,'agave'],['breeze',0.26,8.08,-41.12,'morning glory'],['breeze',30.97,6.3,38.55,'banana plant'],
 ['bind',9.82,4.67,68.04,'dry desert bush'],['bind',7.12,4.99,56.06,'desert plant'],['bind',-9.71,7.22,16.78,'desert plant C'],
 ['haven',15.06,8.05,32.66,'bush'],['haven',-7.77,6.04,18.36,'potted plant leaves'],['haven',-16.01,5.95,29.43,'potted plant']];
// pots / planters / trunks: must still block
const SOLID=[['ascent',1.22,7.07,36.36,'clay pot'],['ascent',-11.33,7.55,38.84,'clay pot'],['ascent',-9.74,8.5,-29.74,'small clay pot'],['haven',-57.54,6.01,1.46,'pot'],
 ['haven',13.87,7.04,33.32,'garden planter wall under the bushes'],['breeze',31.69,6.3,39.63,'palm trunk'],['bind',-65.56,9.35,-38.44,'palm trunk']];
// [map, x, floorY, z, dirX, dirZ, what]: straight walks through foliage (start 1.6 m before the plant); on the worlds
// without the exclusion each of these walks is lifted 0.15-0.26 m onto the foliage
const WALK=[['lotus',-47.4,4.28,-5.5,1,0,'C Main lilypads over the C water floor'],['breeze',0.76,8.0,-41.12,0,-1,'morning glory bed'],['breeze',-11.4,4.0,51,1,0,'beach cabbage bed']];
const worlds={};for(const k of new Set([...FREE,...SOLID,...WALK].map(f=>f[0])))worlds[k]=await loadWorld(assets,k);
const report=[];
for(const [k,x,y,z,what] of FREE){const W=worlds[k];assert.equal(W.blocked(x,z,.38,y,1.8),false,k+' '+what+' at '+[x,y,z]+': plant blocks a standing player');
 const g=W.ground(x,z,y+.6);assert.ok(Number.isFinite(g)&&g<=y+.35&&y-g<2,k+' '+what+': real floor under the plant within 2 m, never the void ('+g+' vs '+y+')');report.push(k+' '+what);}
for(const [k,x,y,z,what] of SOLID)assert.equal(worlds[k].blocked(x,z,.38,y,1.8),true,k+' '+what+' at '+[x,y,z]+' must still block');
for(const [k,x,y,z,dx,dz,what] of WALK){const W=worlds[k],u={x:x-dx*1.6,y:0,z:z-dz*1.6};u.y=W.ground(u.x,u.z,y+.6);assert.ok(Math.abs(u.y-y)<.3,k+' '+what+': start on the floor');
 const y0=u.y;let lift=0;for(let i=0;i<Math.round(128*.75);i++){const r=Motor.step(u,{x:dx,z:dz,speed:4},1/128,W);assert.ok(!(r&&r.jumped),k+' '+what+': no jump');lift=Math.max(lift,u.y-y0);}
 const prog=(u.x-(x-dx*1.6))*dx+(u.z-(z-dz*1.6))*dz;assert.ok(prog>2.2,k+' '+what+': walked '+prog.toFixed(2)+' m of 3 in 0.75 s (blocked by foliage)');assert.ok(lift<.12,k+' '+what+': not lifted onto the foliage ('+lift.toFixed(2)+' m)');report.push(k+' walk '+what+' '+prog.toFixed(2)+' m');}
assert.equal(fs.readFileSync(path.join(here,'src/motor.cjs'),'utf8'),fs.readFileSync(path.join(here,'../vendor/valorant-feel.js'),'utf8'),'client and server motor are the same file');
console.log('Foliage collision: exclusion tables on 6 maps; free '+FREE.length+' plants/lilypads; '+SOLID.length+' pots/planters/trunks still block; walks: '+report.filter(r=>r.includes('walk')).join(', '));
