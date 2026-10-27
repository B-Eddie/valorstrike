// Lotus C water floor (user: "a missing wall ... made me fall off the map", on the lilypad map). The exporter dropped
// every /Water/ object from collision.bin, including the C channel's riverbed floor (Jam_Water_CSite_FloorBlendMoss_MI,
// ~282 m2 under the lilypads at C Main / C Site / C Bend); only moss carpets and lilypads on it had collision, so between
// them a unit dropped to the map bottom (y -5). tools/map-render-floors.mjs appends that render floor to
// collision-patch.bin. On the prebuilt server world (public/worlds, also what the client fetches):
//  1. every render floor triangle of the material has collision under its centroid at its height (no void left);
//  2. points that were void before (between the moss patches, beside playable navigation) now hold a standing unit: a
//     capsule dropped there by the shared motor lands on the water floor (~4.3 m) instead of falling out of the map;
//  2b. outside the footprint the void pockets are 3 m invisible walls (C Bend west edge);
//  3. walking off the C Main moss patch westward into the water stays on the map (no fall below the C floor);
//  4. the tool is idempotent (re-running it adds nothing) and the patch file is what it would write.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {loadWorld} from './src/world.js';import {renderFloors,mergePatch} from './tools/map-render-floors.mjs';
const here=path.dirname(new URL(import.meta.url).pathname),require=createRequire(import.meta.url),Motor=require('./src/motor.cjs');
const W=await loadWorld({fetch:async r=>new Response(await fs.promises.readFile(path.join(here,'public'+new URL(r.url).pathname)))},'lotus');
// 4. idempotent: the shipped patch already holds every render floor triangle
const tris=renderFloors('lotus');assert.ok(tris.length>=150+100,'Lotus C water floor + void-fill triangles found ('+tris.length+')');
const before=fs.readFileSync(path.join(here,'../models/valorant/maps/lotus/collision-patch.bin'));process.env.WRITE='0';const m=mergePatch('lotus',tris);delete process.env.WRITE;
assert.equal(m.added,0,'collision-patch.bin already holds the C water floor (run node tools/map-render-floors.mjs lotus)');assert.equal(m.bytes,before.length);
// 1. collision under every floor triangle
let n=0;for(const t of tris){if(Math.max(t[0][1],t[1][1],t[2][1])-Math.min(t[0][1],t[1][1],t[2][1])>.05||t[0][1]>4.6)continue;/* floors only (void-fill walls are boxes) */const c=[0,1,2].map(a=>(t[0][a]+t[1][a]+t[2][a])/3),d=W.ray([c[0],c[1]+.03,c[2]],[0,-1,0],.1);assert.ok(Number.isFinite(d),'collision floor under C water triangle at '+c.map(v=>v.toFixed(2)));n++;}
// 2. former void points (between moss patches, within 2.5 m of playable nav) hold a dropped unit
const VOID=[[-44.5,-1.3],[-45.35,-1.32],[-41.875,-7.25],[-39.875,-7.5]]; /* first two: C water render floor; last two: void-fill floor (C Main south bank) */
for(const [x,z] of VOID){const near=W.nav.nodes[W.near(x,z,4.3)];assert.ok(Math.hypot(near[0]-x,near[2]-z)<5,'point beside the C navigation');
 const u={x,y:5.5,z};for(let i=0;i<128;i++)Motor.step(u,{x:0,z:0,speed:0},1/128,W);assert.ok(u.y>4.1&&u.y<4.6,'unit dropped at '+[x,z]+' lands on the C water floor, not the void (y '+u.y.toFixed(2)+')');}
// void-fill walls outside the official footprint (C Bend west edge) block a capsule
for(const [x,z] of [[-68.125,5.75],[-68,6.375]])assert.equal(W.blocked(x,z,.38,4.3,1.8),true,'C Bend boundary wall at '+[x,z]);
// 3. walk west off the C Main moss patch edge into the water: stays on the map
{const s=W.nav.nodes[W.near(-41.25,-1.75,4.33)],u={x:s[0],y:s[1],z:s[2]};let low=u.y;for(let i=0;i<128*1.5;i++){Motor.step(u,{x:-1,z:0,speed:6.75},1/128,W);low=Math.min(low,u.y);}
 assert.ok(low>4,'walking west off C Main moss never drops below the C floor (lowest y '+low.toFixed(2)+')');}
console.log('Lotus C water floor: '+n+' render floor triangles have collision; '+VOID.length+' former void points hold a unit; C Main walk-off stays on the map; tool idempotent');
