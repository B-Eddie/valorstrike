// Spawn walls hold on the server (user: "In Breeze and Haven, the wall in buy phase isn't fully blocking the path, so I can
// sneak through it"). tools/spawn-barrier-probe.mjs: SpikeSimulation in its buy phase, a human sending real inputs from the
// spawn side of every wall piece of both spawns (along it and past both ends; run-ups, 45 deg either way, crouch-jumps, jump
// spam, hugging the wall to its end then out) must never cross a wall of its own spawn nor end up more than 1.5 m beyond the
// wall line outside its own zone. Static: every panel's top is above a jump from the highest floor reachable beside it, its
// foot under the doorway floor (+0.3 m). The page runs the same walls through its own collision at 30 / 10 fps
// (work/test_spawn_barrier_leaks_client.cjs).
//   SBL_MAPS=breeze,haven narrows the maps (default: all six).
import fs from 'node:fs';import {createRequire} from 'node:module';
import {loadWorld} from './src/world.js';import {escapes,heights} from './tools/spawn-barrier-probe.mjs';
process.chdir(new URL('.',import.meta.url).pathname);
const SB=createRequire(import.meta.url)('../vendor/spawn-barriers.cjs');
const assets={fetch:async r=>new Response(await fs.promises.readFile('public'+new URL(r.url).pathname))};
const env=process.env.SBL_MAPS||'all',maps=env==='all'?['ascent','bind','breeze','haven','lotus','split']:env.split(','),fails=[],out=[];
for(const key of maps){const w=await loadWorld(assets,key);
 const H=heights(w,key,SB);for(const h of H){if(!h.okTop)fails.push(key+' '+h.side+' panel '+h.panel+': top '+h.y[1]+' < reachable floor '+h.reach.toFixed(2)+' + jump '+(h.needTop-h.reach).toFixed(2));if(!h.okFoot)fails.push(key+' '+h.side+' panel '+h.panel+': foot '+h.y[0]+' over the doorway floor '+h.floor.toFixed(2));}
 const {runs,leaks}=escapes(w,key,SB);const row=key+': '+H.length+' panels, '+runs+' escape runs, '+leaks.length+' out';out.push(row);if(process.env.VERBOSE)console.log(row);
 if(leaks.length){const by={};for(const l of leaks){const k=l.side+' piece '+l.piece+' (panel '+l.panel+')';(by[k]=by[k]||[]).push(l);}for(const k in by)fails.push(key+' '+k+': '+by[k].length+' x, e.g. '+JSON.stringify(by[k][0]));}
 if(runs<100)fails.push(key+': too few runs ('+runs+')');}
if(fails.length){console.log('FAIL spawn walls on the server ('+fails.length+'):\n - '+fails.join('\n - '));process.exit(1);}
console.log('test-spawn-barrier-leaks: PASS\n  '+out.join('\n  '));
