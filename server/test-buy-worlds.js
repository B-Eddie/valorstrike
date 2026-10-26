// Buy phase on all six maps (server SpikeSimulation): both humans hold forward (attacker toward the defenders and back)
// for 10 s. The spawn walls (vendor/spawn-barriers.cjs, solid in the buy phase through spike.js world.blocked) hold them:
// no step ever crosses a wall, no capsule ends inside one or inside map collision.
import assert from 'node:assert/strict';import {loadWorld} from './src/world.js';import {SpikeSimulation} from './src/spike.js';import fs from 'node:fs/promises';import {createRequire} from 'node:module';
const SB=createRequire(import.meta.url)('../vendor/spawn-barriers.cjs');const assets={fetch:async r=>new Response(await fs.readFile('public'+new URL(r.url).pathname))};
for(const key of ['ascent','bind','haven','split','lotus','breeze']){const w=await loadWorld(assets,key),s=new SpikeSimulation(w,'five',key,()=>.5);s.add('one');s.add('two');s.start(false);assert(SB.has(key),key+' has spawn walls');
 for(let n=0;n<200;n++){const prev=s.units.map(u=>[u.x,u.z]);for(const u of s.units)s.command(u,{t:'in',seq:n,r:u.team===s.atk?0:Math.PI,p:0,f:1,s:0});s.step(.05);assert(s.buy>0,'still the buy phase');
  s.units.forEach((u,i)=>{assert(!SB.crossing(key,prev[i][0],prev[i][1],u.x,u.z,u.y+.5),key+' crossed a spawn wall at '+[u.x,u.y,u.z]);assert(!SB.blocked(key,u.x,u.z,.38,u.y,1.8),key+' inside a spawn wall');assert(!w.blocked(u.x,u.z,.38,u.y,1.8),key+' embedded');/* .38: the motor grazes stair risers at .4 (Ascent attacker steps), as test-bot-buy-phase */});}
 console.log(key,'buyworld pass',s.units.map(u=>[u.x,u.y,u.z].map(v=>+v.toFixed(2))));}
